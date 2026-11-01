/**
 * Push plan: the single description of what a Steam publish sends.
 *
 * The plan is used twice so the preview cannot drift from the real upload:
 *  - `--dry-run` renders it without touching Steam or any file;
 *  - the upload child turns it into the `UgcUpdate` payloads.
 */

import { relative, sep, join } from 'path';
import { stat } from 'fs/promises';
import { collectFiles } from '../../utils/fs.js';
import { ConfigError } from '../../utils/errors.js';
import { STEAM_VISIBILITY_NAMES, type SteamVisibilityName } from '../../utils/config.js';
import type { Logger } from '../../utils/logger.js';
import { parseInfoIni } from '../nuget/parser.js';
import { getPublishedFileId } from './parser.js';
import {
  loadDescriptions,
  loadTitles,
  getPrimaryLanguageContent,
  type LocalizedDescription,
} from './metadata.js';
import type { SteamPushDefaults } from './config.js';
import type { WorkshopUpdateDetails } from './workshop.js';

/**
 * Steam numeric visibility values for each allowed name
 */
export const VISIBILITY_VALUES: Record<SteamVisibilityName, number> = {
  public: 0,
  friends: 1,
  private: 2,
  unlisted: 3,
};

/**
 * Map a visibility name to the numeric value sent to Steam
 */
export function visibilityToSteam(name: SteamVisibilityName): number {
  return VISIBILITY_VALUES[name];
}

/**
 * Parse and validate a visibility name from the command line or configuration
 * @throws {ConfigError} When the value is not one of the four names
 */
export function parseVisibility(value: string, source: string): SteamVisibilityName {
  const normalized = value.trim().toLowerCase();
  if ((STEAM_VISIBILITY_NAMES as readonly string[]).includes(normalized)) {
    return normalized as SteamVisibilityName;
  }
  throw new ConfigError(
    `Invalid visibility from ${source}: "${value}" (valid values: ${STEAM_VISIBILITY_NAMES.join(', ')})`,
    [`Use one of: ${STEAM_VISIBILITY_NAMES.join(', ')}`],
  );
}

/**
 * Visibility after precedence resolution
 */
export interface ResolvedVisibility {
  name: SteamVisibilityName;
  source: 'option' | 'duckyrc' | 'default';
}

/**
 * Resolve visibility: --visibility > .duckyrc steam.visibility > public
 */
export function resolveVisibility(sources: {
  cli?: string;
  rc?: SteamVisibilityName;
}): ResolvedVisibility {
  if (sources.cli !== undefined && sources.cli.trim() !== '') {
    return { name: parseVisibility(sources.cli, '--visibility option'), source: 'option' };
  }
  if (sources.rc !== undefined) {
    return { name: sources.rc, source: 'duckyrc' };
  }
  return { name: 'public', source: 'default' };
}

/**
 * Normalize tags: split a comma-separated string if needed, trim, drop empty entries,
 * remove duplicates while keeping the first occurrence order.
 * Returns undefined when nothing usable remains (treated as "not configured").
 */
export function normalizeTags(input: string | readonly string[] | undefined): string[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  const parts = typeof input === 'string' ? input.split(',') : [...input];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    const tag = part.trim();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result.length > 0 ? result : undefined;
}

/**
 * Resolve tags: --tags > info.ini `tags` > .duckyrc steam.tags.
 * The winning source replaces the others; tags are never merged.
 */
export function resolveTags(sources: {
  cli?: string | readonly string[];
  infoIni?: readonly string[];
  rc?: readonly string[];
}): string[] | undefined {
  return normalizeTags(sources.cli) ?? normalizeTags(sources.infoIni) ?? normalizeTags(sources.rc);
}

/**
 * Append the submission footer unless skipped (same rule as the real upload)
 */
export function appendTail(content: string, skipTail: boolean): string {
  if (skipTail) {
    return content;
  }
  const footer = '[hr]Submmited via ducky cli';
  if (!content) {
    return footer;
  }
  if (content.trim().endsWith(footer)) {
    return content;
  }
  return `${content}\n\n${footer}`;
}

/**
 * One file that the upload would include
 */
export interface PlanFile {
  /** Path relative to the mod directory, using forward slashes */
  path: string;
  size: number;
}

/**
 * A non-primary language description that would be sent
 */
export interface PlannedLanguage {
  language: string;
  title?: string;
  description: string;
  bytes: number;
}

/**
 * Options for building a plan
 */
export interface PushPlanOptions {
  updateDescription: boolean;
  changelog?: string;
  skipTail?: boolean;
  /** Resolved App ID */
  appId: number;
  /** Raw --visibility value, if given */
  cliVisibility?: string;
  /** Raw --tags value (comma separated) or an array from --tags-json */
  cliTags?: string | string[];
  /** Defaults from .duckyrc (not re-read here) */
  defaults?: SteamPushDefaults;
}

/**
 * Everything a Steam publish would send
 */
export interface PushPlan {
  modPath: string;
  appId: number;
  isFirstTimeUpload: boolean;
  publishedFileId?: number;
  files: PlanFile[];
  totalBytes: number;
  previewPath: string;
  visibility: SteamVisibilityName;
  visibilityValue: number;
  visibilitySource: ResolvedVisibility['source'];
  tags?: string[];
  changeNote: string;
  /** Primary language that carries the title and description */
  primaryLanguage?: string;
  /** Whether the primary title/description are sent in the main update */
  sendPrimary: boolean;
  primaryTitle?: string;
  primaryDescription?: string;
  /** Languages sent after the main update (only with --update-description) */
  otherLanguages: PlannedLanguage[];
  /** Human-readable note about descriptions that are not sent */
  descriptionNotice?: string;
  /** Number of description/*.md files found */
  descriptionFileCount: number;
}

/**
 * List every file the upload would include (the whole mod directory)
 */
async function listContentFiles(modPath: string): Promise<{ files: PlanFile[]; totalBytes: number }> {
  const absolute = await collectFiles(modPath);
  const files: PlanFile[] = [];
  let totalBytes = 0;
  for (const file of absolute) {
    const { size } = await stat(file);
    totalBytes += size;
    files.push({ path: relative(modPath, file).split(sep).join('/'), size });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, totalBytes };
}

/**
 * Build the push plan for one mod directory. Reads local files only.
 * @throws {FileSystemError} When info.ini is missing
 * @throws {ConfigError} When --visibility is invalid
 */
export async function buildPushPlan(modPath: string, options: PushPlanOptions): Promise<PushPlan> {
  const metadata = await parseInfoIni(modPath);
  const publishedFileId = getPublishedFileId(metadata);
  const isFirstTimeUpload = publishedFileId === undefined;

  const defaultTitle = metadata.displayName || metadata.name;
  const descriptions: LocalizedDescription[] = await loadDescriptions(modPath);
  const titles = await loadTitles(modPath, defaultTitle);
  const primary = getPrimaryLanguageContent(descriptions, titles);

  const skipTail = options.skipTail ?? false;
  const visibility = resolveVisibility({
    cli: options.cliVisibility,
    rc: options.defaults?.visibility,
  });
  const tags = resolveTags({
    cli: options.cliTags,
    infoIni: metadata.tags,
    rc: options.defaults?.tags,
  });

  // First upload always sets the primary language; later updates only with --update-description
  const sendPrimary = isFirstTimeUpload || options.updateDescription;
  const primaryLanguage = primary.description?.language ?? primary.title?.language;

  const otherLanguages: PlannedLanguage[] = [];
  if (options.updateDescription) {
    for (const desc of descriptions) {
      if (desc.language === primary.description?.language) {
        continue;
      }
      const title = titles.find((t) => t.language === desc.language)?.title;
      otherLanguages.push({
        language: desc.language,
        title,
        description: appendTail(desc.content, skipTail),
        bytes: desc.content.length,
      });
    }
  }

  const { files, totalBytes } = await listContentFiles(modPath);

  return {
    modPath,
    appId: options.appId,
    isFirstTimeUpload,
    publishedFileId,
    files,
    totalBytes,
    previewPath: join(modPath, 'preview.png'),
    visibility: visibility.name,
    visibilityValue: visibilityToSteam(visibility.name),
    visibilitySource: visibility.source,
    tags,
    changeNote: appendTail(options.changelog || '', skipTail),
    primaryLanguage,
    sendPrimary,
    primaryTitle: sendPrimary ? primary.title?.title : undefined,
    primaryDescription:
      sendPrimary && primary.description ? appendTail(primary.description.content, skipTail) : undefined,
    otherLanguages,
    descriptionNotice: sendPrimary
      ? undefined
      : 'Descriptions will not be updated (add --update-description to update them)',
    descriptionFileCount: descriptions.length,
  };
}

/**
 * Main update payload (contentPath, preview, visibility, tags, title/description when sent)
 */
export function buildMainUpdateDetails(plan: PushPlan): WorkshopUpdateDetails {
  const details: WorkshopUpdateDetails = {
    contentPath: plan.modPath,
    previewPath: plan.previewPath,
    visibility: plan.visibilityValue,
    changeNote: plan.changeNote,
  };
  if (plan.primaryTitle !== undefined) {
    details.title = plan.primaryTitle;
  }
  if (plan.primaryDescription !== undefined) {
    details.description = plan.primaryDescription;
  }
  if (plan.tags !== undefined) {
    details.tags = plan.tags;
  }
  return details;
}

/**
 * Payload for one additional language
 */
export function buildLanguageUpdateDetails(language: PlannedLanguage): WorkshopUpdateDetails {
  return {
    title: language.title,
    description: language.description,
    language: language.language,
  };
}

/**
 * Human-readable byte size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Print the plan. Labels the output as a dry run; makes no claim about remote values.
 */
export function renderPushPlan(plan: PushPlan, logger: Logger): void {
  logger.header('Steam Workshop Dry Run');
  logger.info('DRY RUN: nothing is sent to Steam and no files are changed.');
  logger.info(`Using Steam App ID: ${plan.appId}`);

  if (plan.isFirstTimeUpload) {
    logger.info('Mode: create a new Workshop item (no publishedFileId in info.ini)');
  } else {
    logger.info(`Mode: update Workshop item ${plan.publishedFileId}`);
  }

  logger.blank();
  logger.info(`Files to upload (${plan.files.length}, ${formatSize(plan.totalBytes)}):`);
  for (const file of plan.files) {
    logger.info(`  ${file.path} (${formatSize(file.size)})`);
  }
  logger.info(`Preview image: ${plan.previewPath}`);

  logger.blank();
  logger.info(`Visibility: ${plan.visibility} (${plan.visibilityValue}, from ${plan.visibilitySource})`);
  logger.info(`Tags: ${plan.tags ? plan.tags.join(', ') : '(none; remote tags unchanged)'}`);
  logger.info(`Changelog: ${plan.changeNote.replace(/\n/g, ' ')}`);

  logger.blank();
  if (plan.sendPrimary) {
    logger.info(
      `Title: ${plan.primaryTitle ?? '(not sent)'}`,
    );
    logger.info(
      `Primary description (${plan.primaryLanguage ?? 'n/a'}): ${
        plan.primaryDescription ? formatSize(plan.primaryDescription.length) : '(not sent)'
      }`,
    );
  } else {
    logger.info('Title and description: not sent');
    if (plan.descriptionNotice) {
      logger.warn(plan.descriptionNotice);
    }
  }

  if (plan.otherLanguages.length > 0) {
    logger.info(`Additional languages (${plan.otherLanguages.length}):`);
    for (const lang of plan.otherLanguages) {
      logger.info(`  ${lang.language}: ${lang.title ?? '(no title)'}, ${formatSize(lang.bytes)}`);
    }
  }
}
