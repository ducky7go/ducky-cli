import { Command } from 'commander';
import { join } from 'path';
import { fileExists, ensureDirectory, writeTextFile } from '../../utils/fs.js';
import { SteamError, ValidationError } from '../../utils/errors.js';
import type { Logger } from '../../utils/logger.js';
import { withSteamSession, type SteamWorkshopClient, type RawWorkshopItem, type ItemQueryConfig } from '../../formats/steam/query.js';
import { readPublishedFileId } from '../../formats/steam/parser.js';
import { bbcodeToMarkdown } from '../../formats/steam/bbcode.js';
import {
  mapFilenameToLanguage,
  languageToFilename,
  supportedLanguageInputs,
} from '../../formats/steam/metadata.js';
import { resolveCommandAppId, runSteamAction, withCommonOptions } from './shared.js';
import { requireInfoIni } from './link.js';

/** Steam's default language, used for the fallback comparison */
const DEFAULT_STEAM_LANGUAGE = 'english';

/**
 * Result for one requested language
 */
export interface PullOutcome {
  language: string;
  file: string;
  status: 'written' | 'skipped' | 'failed';
  reason?: string;
}

/** Validated pull request */
export interface PullPlan {
  itemId: number;
  /** Steam language codes, deduplicated, in request order */
  languages: string[];
}

/**
 * Check the local preconditions for pull before any Steam access or write:
 * info.ini exists, the directory is linked, and every requested language is supported.
 * @throws {ValidationError} On an unlinked directory or an unsupported language
 */
export async function preparePull(modPath: string, requested: string[]): Promise<PullPlan> {
  await requireInfoIni(modPath);
  const itemId = await readPublishedFileId(modPath);
  if (itemId === undefined) {
    throw new ValidationError(`${join(modPath, 'info.ini')} has no publishedFileId`, [
      `Link the directory first: ducky steam link ${modPath} <id>`,
      `Or publish it as a new item with: ducky steam push ${modPath}`,
    ]);
  }

  const inputs = requested.length > 0 ? requested : ['en'];
  const languages: string[] = [];
  for (const input of inputs) {
    const steam = mapFilenameToLanguage(input);
    if (!steam) {
      throw new ValidationError(`Unsupported language "${input}"`, [
        `Supported values: ${supportedLanguageInputs().join(', ')}`,
      ]);
    }
    if (!languages.includes(steam)) {
      languages.push(steam);
    }
  }
  return { itemId, languages };
}

/**
 * Compose the Markdown file body: "# title" followed by the converted description,
 * unless the converted text already starts with that same H1.
 */
export function composeDescriptionFile(title: string, markdownBody: string): string {
  const heading = title.trim() ? `# ${title.trim()}` : '';
  if (!heading) {
    return markdownBody;
  }
  const firstLine = markdownBody.split('\n').find((line) => line.trim() !== '');
  if (firstLine !== undefined && firstLine.trim() === heading) {
    return markdownBody;
  }
  return markdownBody.length > 0 ? `${heading}\n\n${markdownBody}` : `${heading}\n`;
}

function sameText(a: RawWorkshopItem, b: RawWorkshopItem): boolean {
  return a.title === b.title && (a.description ?? '') === (b.description ?? '');
}

/**
 * Fetch the requested languages and write description/<file>.md for each.
 * Each file is handled independently; a failure for one file does not stop the others.
 */
export async function pullDescriptionFiles(
  client: SteamWorkshopClient,
  modPath: string,
  plan: PullPlan,
  options: { force: boolean },
  logger: Logger,
): Promise<PullOutcome[]> {
  const fetchConfig = (language: string): ItemQueryConfig => ({ includeLongDescription: true, language });

  const defaultItem = await client.getItem(BigInt(plan.itemId), fetchConfig(DEFAULT_STEAM_LANGUAGE));
  if (!defaultItem) {
    throw new SteamError(`Workshop item ${plan.itemId} was not found`, [
      'Check the item ID in info.ini',
      'Check that the item belongs to the App ID in use (--app-id, STEAM_APP_ID or .duckyrc)',
    ]);
  }

  const descDir = join(modPath, 'description');
  const outcomes: PullOutcome[] = [];

  for (const language of plan.languages) {
    const file = join(descDir, `${languageToFilename(language)}.md`);
    const outcome = (status: PullOutcome['status'], reason?: string): PullOutcome => ({
      language,
      file,
      status,
      reason,
    });

    let item: RawWorkshopItem | null | undefined = defaultItem;
    if (language !== DEFAULT_STEAM_LANGUAGE) {
      item = await client.getItem(BigInt(plan.itemId), fetchConfig(language));
      if (!item) {
        logger.warn(`Steam returned no ${language} item; skipped ${file}`);
        outcomes.push(outcome('skipped', 'no item returned for this language'));
        continue;
      }
      // Steam returns the default text when a translation does not exist
      if (sameText(item, defaultItem)) {
        logger.warn(`No distinct ${language} translation exists on Steam; skipped ${file}`);
        outcomes.push(outcome('skipped', 'no distinct translation'));
        continue;
      }
    }

    if ((await fileExists(file)) && !options.force) {
      logger.error(`${file} already exists; use --force to overwrite it`);
      outcomes.push(outcome('failed', 'file exists; use --force'));
      continue;
    }

    const converted = bbcodeToMarkdown(item!.description ?? '');
    if (converted.unknownTags.length > 0) {
      logger.debug(`Removed unsupported BBCode tags in ${language}: ${converted.unknownTags.join(', ')}`);
    }

    await ensureDirectory(descDir);
    await writeTextFile(file, composeDescriptionFile(item!.title, converted.markdown));
    logger.debug(`Wrote ${file}`);
    outcomes.push(outcome('written'));
  }

  return outcomes;
}

export function createSteamPullCommand(): Command {
  return withCommonOptions(
    new Command('pull')
      .description('Pull the remote description of a linked item into description/<language>.md')
      .argument('<path>', 'Path to the mod directory (must have publishedFileId in info.ini)')
      .option('--language <code>', 'Language to pull; repeatable (default: en)', collectLanguage)
      .option('--force', 'Overwrite existing description files', false),
  ).action(async (path: string, options: { language?: string[]; force: boolean; appId?: string; verbose: boolean }) => {
    let failed = false;
    await runSteamAction({ verbose: options.verbose }, async (logger) => {
      const plan = await preparePull(path, options.language ?? []);
      const { appId } = resolveCommandAppId(options.appId);
      logger.info(`Using Steam App ID: ${appId}`);

      const outcomes = await withSteamSession(appId, (client) =>
        pullDescriptionFiles(client, path, plan, { force: options.force }, logger),
      );

      for (const outcome of outcomes) {
        if (outcome.status === 'written') {
          logger.success(`Wrote ${outcome.file}`);
        } else if (outcome.status === 'failed') {
          failed = true;
        }
      }
      if (failed) {
        logger.error('Some description files were not written (see messages above)');
      }
    });
    if (failed) {
      process.exit(1);
    }
  });
}

function collectLanguage(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export const steamPullCommand = createSteamPullCommand();
