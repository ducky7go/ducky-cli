import { Command } from 'commander';
import { createLogger } from '../../utils/logger.js';
import { steamPushAction } from '../../formats/steam/push-handler.js';

export const steamPushCommand = new Command('push')
  .description('Push mod to Steam Workshop')
  .argument('<path>', 'Path to the mod directory')
  .option('--update-description', 'Update Workshop descriptions from description/*.md files', false)
  .option('--changelog <note>', 'Update changelog notes for this update')
  .option('--skip-tail', 'Skip appending submission footer to description and changelog', false)
  .option('-v, --verbose', 'Enable verbose output', false)
  .action(async (path: string, options: { updateDescription: boolean; changelog?: string; skipTail: boolean; verbose: boolean }) => {
    const logger = createLogger({ verbose: options.verbose });
    logger.header('Steam Workshop Publish');

    try {
      await steamPushAction(path, {
        updateDescription: options.updateDescription,
        changelog: options.changelog,
        skipTail: options.skipTail,
        logger,
      });

      logger.success('Mod published to Steam Workshop successfully!');
      process.exit(0);
    } catch (error) {
      logger.error(error as Error | string);
      process.exit(1);
    }
  });
