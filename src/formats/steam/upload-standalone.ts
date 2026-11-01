/**
 * Standalone Steam Workshop uploader script
 * Run as a separate process to ensure proper cleanup of Steamworks proxy.
 *
 * The parent process resolves App ID, visibility and tags and passes them in
 * (STEAM_APP_ID env, --visibility, --tags-json). This process builds the same push
 * plan that --dry-run renders and turns it into the Steamworks update payloads.
 */

import { createLogger } from '../../utils/logger.js';
import { SteamNotRunningError, SteamLibraryError } from '../../utils/errors.js';
import { savePublishedFileId } from './parser.js';
import { ProgressTracker, WorkshopUploadStatus } from './progress.js';
import { ProgressDisplay } from './progress-display.js';
import { getSteamAppId } from './config.js';
import {
  buildPushPlan,
  buildMainUpdateDetails,
  buildLanguageUpdateDetails,
} from './dry-run.js';
import {
  initSteamworks,
  shutdownSteamworks,
  createWorkshopItem,
  updateWorkshopItemWithProgress,
  isAgreementRequired,
  agreementGuidance,
  AGREEMENT_MARKER,
  UPLOAD_EXIT_STEAM_NOT_RUNNING,
  UPLOAD_EXIT_LIBRARY_FAILED,
} from './workshop.js';

/**
 * Push options
 */
interface PushOptions {
  updateDescription: boolean;
  changelog?: string;
  skipTail?: boolean;
  /** Visibility name resolved by the parent process */
  visibility?: string;
  /** Tags resolved by the parent process; omitted when none are configured */
  tags?: string[];
}

/**
 * Steam push action (internal implementation for standalone script)
 * @param modPath - Path to the mod directory
 * @param options - Push options
 */
async function steamPushActionInternal(
  modPath: string,
  options: PushOptions
): Promise<void> {
  const { updateDescription, changelog, skipTail = false, visibility, tags } = options;
  const logger = createLogger({ verbose: true });
  const progress = new ProgressTracker();
  const progressDisplay = new ProgressDisplay();

  // Setup progress tracking with visual display
  progress.onProgress((p) => {
    logger.debug(`[${WorkshopUploadStatus[p.status]}] ${p.message}`);
    progressDisplay.update(p);
  });

  // Start the progress display
  progressDisplay.start();

  try {
    // Phase 1: Preparing - build the push plan (local files only)
    progress.report(WorkshopUploadStatus.Preparing, 'Parsing mod metadata...');

    const appId = getSteamAppId();
    logger.info(`Steam App ID: ${appId}`);

    const plan = await buildPushPlan(modPath, {
      updateDescription,
      changelog,
      skipTail,
      appId,
      cliVisibility: visibility,
      cliTags: tags,
      defaults: {},
    });

    logger.info(`Visibility: ${plan.visibility} (${plan.visibilityValue})`);
    if (plan.tags) {
      logger.info(`Tags: ${plan.tags.join(', ')}`);
    }

    const publishedFileId = plan.publishedFileId;
    const isFirstTimeUpload = plan.isFirstTimeUpload;

    if (isFirstTimeUpload) {
      progress.report(WorkshopUploadStatus.RequestingId, 'Creating new Workshop item...');
      logger.info('Mode: First-time upload');
    } else {
      logger.info(`Mode: Update existing Workshop item ${publishedFileId}`);
    }

    // Phase 2: Initialize Steamworks
    progress.report(WorkshopUploadStatus.Preparing, 'Initializing Steamworks...');
    logger.debug('Initializing Steamworks...');
    await initSteamworks();
    logger.success('Steamworks initialized');

    // Phase 3: Create Workshop item if first-time upload
    let finalPublishedFileId = publishedFileId;

    if (isFirstTimeUpload) {
      logger.info('Creating new Workshop item...');
      finalPublishedFileId = await createWorkshopItem();
      logger.success(`Created new Workshop item with ID: ${finalPublishedFileId}`);

      // Save to info.ini
      progress.report(WorkshopUploadStatus.WritingIni, 'Saving publishedFileId to info.ini...');
      await savePublishedFileId(modPath, finalPublishedFileId);
      logger.info(`Saved publishedFileId ${finalPublishedFileId} to info.ini`);
    }

    // Phase 4: Descriptions and titles (already loaded into the plan)
    logger.info(`Found ${plan.descriptionFileCount} description(s)`);
    if (plan.otherLanguages.length > 0 || plan.primaryLanguage) {
      logger.debug(`Primary language: ${plan.primaryLanguage ?? 'N/A'}`);
    }

    // Phase 5: Prepare main upload details
    progress.report(WorkshopUploadStatus.StartingSteamUpload, 'Preparing Workshop upload...');

    logger.debug(`Content path: ${modPath}`);
    logger.debug(`Preview path: ${plan.previewPath}`);

    const updateDetails = buildMainUpdateDetails(plan);

    if (changelog) {
      logger.debug(`Changelog: ${changelog.substring(0, 50)}${changelog.length > 50 ? '...' : ''}`);
    }

    // Phase 6: Handle descriptions based on upload type
    if (isFirstTimeUpload) {
      // First-time upload: ALWAYS set primary language description
      logger.info('Setting primary language description (required for new items)');
      if (plan.primaryTitle !== undefined) {
        logger.info(`Title: ${plan.primaryTitle}`);
      }
      if (plan.primaryDescription !== undefined) {
        logger.debug(`Description length: ${plan.primaryDescription.length} characters`);
      }
    } else if (updateDescription) {
      logger.info('Updating all language descriptions...');
    } else {
      logger.info('Description updates: disabled (use --update-description to enable)');
    }

    // Phase 7: Submit main update
    logger.info('Uploading content to Steam...');
    progress.report(WorkshopUploadStatus.UploadingContent, 'Uploading content to Steam...');

    await updateWorkshopItemWithProgress(
      finalPublishedFileId!,
      updateDetails,
      logger,
      (bytesProcessed, bytesTotal) => {
        progress.reportUploadProgress(bytesProcessed, bytesTotal);
      }
    );

    logger.success('Content uploaded successfully');

    // Phase 8: Update other languages if --update-description flag is set
    const otherLanguages = plan.otherLanguages;
    if (otherLanguages.length > 0) {
      const action = isFirstTimeUpload ? 'Uploading' : 'Updating';
      logger.info(`${action} ${otherLanguages.length} additional language(s)...`);

      for (let i = 0; i < otherLanguages.length; i++) {
        const lang = otherLanguages[i];
        progress.reportTranslationProgress(i + 1, otherLanguages.length);
        logger.info(`  [${i + 1}/${otherLanguages.length}] ${lang.language}`);
        await updateWorkshopItemWithProgress(
          finalPublishedFileId!,
          buildLanguageUpdateDetails(lang),
          logger
        );
      }

      logger.success(`All ${otherLanguages.length} language(s) processed`);
    }

    // Phase 9: Complete
    if (isAgreementRequired()) {
      // Printed on stdout so the parent process can flag this directory as needing attention
      console.log(`[WARN] ${AGREEMENT_MARKER}: ${agreementGuidance()}`);
    }
    const action = isFirstTimeUpload ? 'Published' : 'Updated';
    if (updateDescription) {
      const languageCount = plan.descriptionFileCount > 0 ? plan.descriptionFileCount : 1;
      logger.success(`${action} Workshop item: ${finalPublishedFileId} (${languageCount} language(s))`);
    } else {
      logger.success(`${action} Workshop item: ${finalPublishedFileId}`);
    }

    progress.reportSuccess('Upload completed successfully');
  } catch (error) {
    progress.reportFailure(
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined
    );
    throw error;
  } finally {
    // Stop the progress display
    progressDisplay.stop();
    // Shutdown Steamworks
    shutdownSteamworks();
  }
}

/**
 * Parse the --tags-json argument (a JSON array of strings)
 */
function parseTagsJson(raw: string): string[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((t) => typeof t !== 'string')) {
    throw new Error('--tags-json must be a JSON array of strings');
  }
  return parsed as string[];
}

/**
 * Map a failure to the exit code the parent process understands
 */
function exitCodeFor(error: unknown): number {
  if (error instanceof SteamNotRunningError) {
    return UPLOAD_EXIT_STEAM_NOT_RUNNING;
  }
  if (error instanceof SteamLibraryError) {
    return UPLOAD_EXIT_LIBRARY_FAILED;
  }
  return 1;
}

/**
 * Main entry point for standalone execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: steam-upload.js <modPath> [options]');
    process.exit(1);
  }

  const modPath = args[0];
  const updateDescription = args.includes('--update-description');
  const skipTail = args.includes('--skip-tail');

  const changelogIndex = args.indexOf('--changelog');
  const changelog = changelogIndex >= 0 && args[changelogIndex + 1]
    ? args[changelogIndex + 1]
    : undefined;

  const visibilityIndex = args.indexOf('--visibility');
  const visibility = visibilityIndex >= 0 && args[visibilityIndex + 1]
    ? args[visibilityIndex + 1]
    : undefined;

  const tagsIndex = args.indexOf('--tags-json');

  try {
    const tags = tagsIndex >= 0 && args[tagsIndex + 1] !== undefined
      ? parseTagsJson(args[tagsIndex + 1])
      : undefined;

    await steamPushActionInternal(modPath, {
      updateDescription,
      changelog,
      skipTail,
      visibility,
      tags,
    });
    process.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(exitCodeFor(error));
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { steamPushActionInternal };
