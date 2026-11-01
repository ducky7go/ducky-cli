/**
 * Steam Workshop push handler
 * Orchestrates the entire Workshop upload process
 * Uses a subprocess to ensure proper Steamworks proxy cleanup
 *
 * --dry-run stops after validation and planning: no child process is spawned,
 * Steamworks is never initialized and no file is written.
 */

import { statSync } from 'fs';
import { Logger } from '../../utils/logger.js';
import { ValidationError } from '../../utils/errors.js';
import { loadDuckyRc } from '../../utils/config.js';
import { resolveSteamAppId, resolveSteamPushDefaults } from './config.js';
import { buildPushPlan, renderPushPlan } from './dry-run.js';
import { SteamValidator } from './validator.js';
import { runSteamUploadInChildProcess, type UploadResult } from './workshop.js';

/**
 * Push options
 */
export interface PushOptions {
  updateDescription: boolean;
  changelog?: string;
  skipTail?: boolean;
  logger: Logger;
  /** Raw --app-id value */
  appId?: string;
  /** Raw --visibility value */
  visibility?: string;
  /** Raw --tags value (comma separated) */
  tags?: string;
  /** Preview only; never contacts Steam or writes files */
  dryRun?: boolean;
}

/**
 * Steam push action
 * @param modPath - Path to the mod directory
 * @param options - Push options
 */
export async function steamPushAction(
  modPath: string,
  options: PushOptions
): Promise<UploadResult> {
  const { updateDescription, changelog, skipTail = false, logger, dryRun = false } = options;

  // Resolve configuration once in this process; the child receives the results explicitly
  const rc = loadDuckyRc()?.steam ?? {};
  const { appId } = resolveSteamAppId({
    cli: options.appId,
    env: process.env.STEAM_APP_ID,
    rc: rc.appId,
  });
  const defaults = resolveSteamPushDefaults(rc);

  if (dryRun) {
    const validation = await new SteamValidator(logger).validate(modPath, appId);
    if (!validation.isValid) {
      throw new ValidationError(
        `Dry run stopped: ${validation.errors.map((e) => e.message).join('; ')}`,
        validation.errors.flatMap((e) => e.suggestions ?? []),
      );
    }

    const plan = await buildPushPlan(modPath, {
      updateDescription,
      changelog,
      skipTail,
      appId,
      cliVisibility: options.visibility,
      cliTags: options.tags,
      defaults,
    });
    renderPushPlan(plan, logger);
    return { needsAttention: false };
  }

  logger.header('Steam Workshop Upload');
  logger.info(`Using Steam App ID: ${appId}`);

  try {
    // Build the same plan the dry run shows, so the upload matches the preview
    const plan = await buildPushPlan(modPath, {
      updateDescription,
      changelog,
      skipTail,
      appId,
      cliVisibility: options.visibility,
      cliTags: options.tags,
      defaults,
    });

    // Run the upload in a child process to ensure proper Steamworks proxy cleanup
    const result = await runSteamUploadInChildProcess(
      modPath,
      {
        updateDescription,
        changelog,
        skipTail,
        appId,
        visibility: plan.visibility,
        tags: plan.tags,
      },
      logger,
      // Progress callback - progress is handled by the child process and displayed via its logger
      undefined
    );

    logger.success('Upload completed successfully');
    return result;
  } catch (error) {
    logger.error(error as Error | string);
    throw error;
  }
}

/**
 * Outcome of one directory in a multi-directory push
 */
export interface BatchEntryResult {
  path: string;
  status: 'ok' | 'ok-needs-attention' | 'failed';
  message?: string;
}

/**
 * Push several directories in the order given. Each one is independent:
 * a failure is recorded and the remaining directories are still processed.
 * @param paths - Mod directories (or any paths; non-directories are reported as failed)
 * @param options - Shared options applied to every directory
 */
export async function steamPushMany(
  paths: string[],
  options: PushOptions
): Promise<BatchEntryResult[]> {
  const { logger } = options;
  const results: BatchEntryResult[] = [];

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    logger.info(`[${i + 1}/${paths.length}] ${path}`);

    if (!isDirectory(path)) {
      const message = 'not a mod directory';
      logger.error(`${path}: ${message}`);
      results.push({ path, status: 'failed', message });
      continue;
    }

    try {
      const result = await steamPushAction(path, options);
      results.push({ path, status: result.needsAttention ? 'ok-needs-attention' : 'ok' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ path, status: 'failed', message });
    }
  }

  return results;
}

/**
 * Print counts and one line per directory
 */
export function renderBatchSummary(results: BatchEntryResult[], logger: Logger): void {
  const succeeded = results.filter((r) => r.status === 'ok').length;
  const attention = results.filter((r) => r.status === 'ok-needs-attention').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  logger.blank();
  logger.info(`Summary: ${succeeded} succeeded, ${attention} need attention, ${failed} failed`);
  for (const result of results) {
    if (result.status === 'ok') {
      logger.success(result.path);
    } else if (result.status === 'ok-needs-attention') {
      logger.warn(`${result.path}: published, but the Workshop agreement must be accepted (see above)`);
    } else {
      logger.error(`${result.path}: ${result.message ?? 'failed'}`);
    }
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
