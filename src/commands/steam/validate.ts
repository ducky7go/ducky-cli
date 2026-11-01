import { Command } from 'commander';
import { SteamValidator } from '../../formats/steam/validator.js';
import { readAppIdSourcesFromEnvironment, resolveSteamAppId } from '../../formats/steam/config.js';
import { runSteamAction, withCommonOptions, type SteamCommonOptions } from './shared.js';

export const steamValidateCommand = withCommonOptions(
  new Command('validate')
    .description('Validate Steam Workshop publishing configuration (no Steam client needed)')
    .argument('<path>', 'Path to the mod directory'),
).action(async (path: string, options: SteamCommonOptions) => {
  await runSteamAction({ verbose: options.verbose }, async (logger) => {
    logger.header('Steam Workshop Validation');

    const validator = new SteamValidator(logger);

    // Resolve App ID: --app-id > STEAM_APP_ID > .duckyrc > default
    const { appId } = resolveSteamAppId(readAppIdSourcesFromEnvironment(options.appId));
    logger.info(`Using Steam App ID: ${appId}`);

    const result = await validator.validate(path, appId);

    if (result.isValid) {
      logger.success('All validations passed!');
      logger.blank();
      logger.info('Your mod is ready to publish to Steam Workshop.');
      return;
    }

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
  });
});
