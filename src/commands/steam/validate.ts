import { Command } from 'commander';
import { createLogger } from '../../utils/logger.js';
import { SteamValidator } from '../../formats/steam/validator.js';
import { getSteamAppId } from '../../formats/steam/config.js';

export const steamValidateCommand = new Command('validate')
  .description('Validate Steam Workshop publishing configuration')
  .argument('<path>', 'Path to the mod directory')
  .option('-v, --verbose', 'Enable verbose output', false)
  .action(async (path: string, options: { verbose: boolean }) => {
    const logger = createLogger({ verbose: options.verbose });
    logger.header('Steam Workshop Validation');

    try {
      const validator = new SteamValidator(logger);

      // Get Steam App ID
      const appId = getSteamAppId();
      logger.info(`Using Steam App ID: ${appId}`);

      // Run validation
      const result = await validator.validate(path);

      // Display results
      if (result.isValid) {
        logger.success('All validations passed!');
        logger.blank();
        logger.info('Your mod is ready to publish to Steam Workshop.');
      } else {
        logger.error('Validation failed:');
        logger.blank();

        for (const error of result.errors) {
          logger.error(error.message);
          if (error.suggestions && error.suggestions.length > 0) {
            logger.blank();
            logger.info('Suggestions:');
            for (const suggestion of error.suggestions) {
              console.log(`  • ${suggestion}`);
            }
          }
          logger.blank();
        }

        process.exit(1);
      }
    } catch (error) {
      logger.error(error as Error | string);
      process.exit(1);
    }
  });
