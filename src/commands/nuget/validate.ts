import { Command } from 'commander';
import { resolve } from 'path';
import { createLogger, LogLevel } from '../../utils/index.js';
import { parseInfoIni, validateMod } from '../../formats/nuget/index.js';
import { FileSystemError } from '../../utils/errors.js';

const logger = createLogger();

/**
 * T18: Implement nuget validate command
 * Validates a mod directory against the NuGet Mod Packaging Specification
 */
export const nugetValidateCommand = new Command('validate')
  .description('Validate a mod directory')
  .argument('<path>', 'Path to mod directory')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (path: string, options) => {
    try {
      // Configure logger
      if (options.verbose) {
        logger.setLevel(LogLevel.DEBUG);
      }

      const modPath = resolve(path);

      logger.header('NuGet Validate');
      logger.info(`Mod path: ${modPath}`);

      // Parse metadata
      logger.info('Parsing info.ini...');
      const metadata = await parseInfoIni(modPath);
      logger.success(`Parsed: ${metadata.name} v${metadata.version}`);

      // Display metadata
      logger.blank();
      logger.info('Metadata:');
      if (metadata.description) {
        logger.info(`  Description: ${metadata.description}`);
      }
      if (metadata.author) {
        logger.info(`  Author: ${metadata.author}`);
      }
      if (metadata.projectUrl) {
        logger.info(`  Project URL: ${metadata.projectUrl}`);
      }
      if (metadata.tags && metadata.tags.length > 0) {
        logger.info(`  Tags: ${metadata.tags.join(', ')}`);
      }

      // Validate mod
      logger.blank();
      logger.info('Running validation checks...');

      const validation = await validateMod(modPath, metadata);

      // Display results
      logger.blank();

      if (validation.valid) {
        logger.success('✓ All validation checks passed!');
        logger.blank();
        logger.info('Your mod is ready to be packaged.');
      } else {
        logger.error('Validation failed:');
        logger.blank();

        for (const error of validation.errors) {
          logger.error(error);
          logger.blank();
        }

        if (validation.warnings.length > 0) {
          logger.warn('Warnings:');
          for (const warning of validation.warnings) {
            logger.warn(`  • ${warning}`);
          }
        }

        process.exit(1);
      }
    } catch (error) {
      if (error instanceof FileSystemError || error instanceof Error) {
        logger.error(error);
        process.exit(1);
      }
      throw error;
    }
  });
