/**
 * Steam Workshop push handler
 * Orchestrates the entire Workshop upload process
 * Uses a subprocess to ensure proper Steamworks proxy cleanup
 */

import { Logger } from '../../utils/logger.js';
import { SteamUploadError } from '../../utils/errors.js';
import { runSteamUploadInChildProcess } from './workshop.js';

/**
 * Push options
 */
export interface PushOptions {
  updateDescription: boolean;
  changelog?: string;
  skipTail?: boolean;
  logger: Logger;
}

/**
 * Steam push action
 * @param modPath - Path to the mod directory
 * @param options - Push options
 */
export async function steamPushAction(
  modPath: string,
  options: PushOptions
): Promise<void> {
  const { updateDescription, changelog, skipTail = false, logger } = options;

  logger.header('Steam Workshop Upload');

  try {
    // Run the upload in a child process to ensure proper Steamworks proxy cleanup
    await runSteamUploadInChildProcess(
      modPath,
      {
        updateDescription,
        changelog,
        skipTail,
      },
      logger,
      // Progress callback - progress is handled by the child process and displayed via its logger
      undefined
    );

    logger.success('Upload completed successfully');
  } catch (error) {
    logger.error(error as Error | string);
    throw error;
  }
}
