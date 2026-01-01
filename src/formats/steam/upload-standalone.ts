/**
 * Standalone Steam Workshop uploader script
 * Run as a separate process to ensure proper cleanup of Steamworks proxy
 */

import { join } from 'path';
import { createLogger } from '../../utils/logger.js';
import { SteamUploadError } from '../../utils/errors.js';
import { parseInfoIni } from '../nuget/parser.js';
import { savePublishedFileId, getPublishedFileId } from './parser.js';
import { loadDescriptions, loadTitles, getPrimaryLanguageContent } from './metadata.js';
import { ProgressTracker, WorkshopUploadStatus } from './progress.js';
import { ProgressDisplay } from './progress-display.js';
import { getSteamAppId } from './config.js';
import {
  initSteamworks,
  shutdownSteamworks,
  createWorkshopItem,
  updateWorkshopItemWithProgress,
  type WorkshopUpdateDetails,
} from './workshop.js';

/**
 * Push options
 */
interface PushOptions {
  updateDescription: boolean;
  changelog?: string;
  skipTail?: boolean;
}

/**
 * Append submission footer if not skipped
 */
function appendTail(content: string, skipTail: boolean): string {
  if (skipTail) {
    return content;
  }
  const footer = '[hr]Submmited via ducky cli';
  if (!content) {
    return footer;
  }
  // Check if content already ends with the footer
  if (content.trim().endsWith(footer)) {
    return content;
  }
  return `${content}\n\n${footer}`;
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
  const { updateDescription, changelog, skipTail = false } = options;
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
    // Phase 1: Preparing
    progress.report(WorkshopUploadStatus.Preparing, 'Parsing mod metadata...');
    const metadata = await parseInfoIni(modPath);

    logger.info(`Mod: ${metadata.displayName || metadata.name}`);
    logger.info(`Version: ${metadata.version}`);

    const appId = getSteamAppId();
    logger.info(`Steam App ID: ${appId}`);

    const publishedFileId = getPublishedFileId(metadata);
    const isFirstTimeUpload = !publishedFileId;

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

    // Phase 4: Load descriptions and titles
    logger.debug('Loading descriptions and titles...');
    const descriptions = await loadDescriptions(modPath);
    const titles = await loadTitles(modPath, metadata.displayName || metadata.name);

    logger.info(`Found ${descriptions.length} description(s) and ${titles.length} title(s)`);
    if (descriptions.length > 0) {
      const langs = descriptions.map(d => d.language).join(', ');
      logger.debug(`Languages: ${langs}`);
    }

    // Phase 5: Prepare main upload details
    progress.report(WorkshopUploadStatus.StartingSteamUpload, 'Preparing Workshop upload...');

    const previewPath = join(modPath, 'preview.png');
    const primaryContent = getPrimaryLanguageContent(descriptions, titles);

    logger.debug(`Primary language: ${primaryContent.description?.language || 'N/A'}`);
    logger.debug(`Content path: ${modPath}`);
    logger.debug(`Preview path: ${previewPath}`);

    // Build update details
    const updateDetails: WorkshopUpdateDetails = {
      contentPath: modPath,
      previewPath: previewPath,
      visibility: 0, // Public
      changeNote: appendTail(changelog || '', skipTail),
    };

    if (changelog) {
      logger.debug(`Changelog: ${changelog.substring(0, 50)}${changelog.length > 50 ? '...' : ''}`);
    }

    // Phase 6: Handle descriptions based on upload type
    if (isFirstTimeUpload) {
      // First-time upload: ALWAYS set primary language description
      logger.info('Setting primary language description (required for new items)');

      if (primaryContent.title) {
        updateDetails.title = primaryContent.title.title;
        logger.info(`Title: ${primaryContent.title.title}`);
      }

      if (primaryContent.description) {
        updateDetails.description = appendTail(primaryContent.description.content, skipTail);
        logger.debug(`Description length: ${primaryContent.description.content.length} characters`);
      }
    } else if (updateDescription) {
      // Update with --update-description flag: Update primary language
      logger.info('Updating all language descriptions...');

      // Update primary language first
      if (primaryContent.title) {
        updateDetails.title = primaryContent.title.title;
      }

      if (primaryContent.description) {
        updateDetails.description = appendTail(primaryContent.description.content, skipTail);
      }
    } else {
      // Update without --update-description flag: Skip ALL descriptions
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
    if (updateDescription) {
      const otherLanguages = descriptions.filter(
        (d) => d.language !== primaryContent.description?.language
      );

      if (otherLanguages.length > 0) {
        const action = isFirstTimeUpload ? 'Uploading' : 'Updating';
        logger.info(`${action} ${otherLanguages.length} additional language(s)...`);

        for (let i = 0; i < otherLanguages.length; i++) {
          const lang = otherLanguages[i];
          progress.reportTranslationProgress(i + 1, otherLanguages.length);
          logger.info(`  [${i + 1}/${otherLanguages.length}] ${lang.language}`);

          // Find title for this language
          const langTitle = titles.find((t) => t.language === lang.language);

          // Update with only title and description for this language
          const langUpdateDetails: WorkshopUpdateDetails = {
            title: langTitle?.title,
            description: appendTail(lang.content, skipTail),
            language: lang.language,
          };

          await updateWorkshopItemWithProgress(finalPublishedFileId!, langUpdateDetails, logger);
        }

        logger.success(`All ${otherLanguages.length} language(s) processed`);
      }
    }

    // Phase 9: Complete
    if (updateDescription) {
      const languageCount = descriptions.length > 0 ? descriptions.length : 1;
      const action = isFirstTimeUpload ? 'Published' : 'Updated';
      logger.success(`${action} Workshop item: ${finalPublishedFileId} (${languageCount} language(s))`);
    } else {
      const action = isFirstTimeUpload ? 'Published' : 'Updated';
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

  try {
    await steamPushActionInternal(modPath, {
      updateDescription,
      changelog,
      skipTail,
    });
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { steamPushActionInternal };
