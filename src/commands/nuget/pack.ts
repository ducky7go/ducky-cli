import { Command } from 'commander';
import { resolve, join, basename } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { createLogger, resolveConfig, LogLevel } from '../../utils/index.js';
import {
  parseInfoIni,
  generateNuspec,
  collectFilesForPackage,
  validateMod,
} from '../../formats/nuget/index.js';
import { NuGetCliManager } from '../../formats/nuget/client.js';
import { FileSystemError, ValidationError } from '../../utils/errors.js';

const logger = createLogger();

/**
 * T16: Implement nuget pack command
 * Creates a .nupkg package from a mod directory
 */
export const nugetPackCommand = new Command('pack')
  .description('Package a mod into a .nupkg file')
  .argument('<path>', 'Path to mod directory')
  .option('-o, --output <path>', 'Output directory for .nupkg file')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (path: string, options) => {
    try {
      // Configure logger
      if (options.verbose) {
        logger.setLevel(LogLevel.DEBUG);
      }

      const modPath = resolve(path);
      const outputPath = options.output ? resolve(options.output) : modPath;

      logger.header('NuGet Pack');
      logger.info(`Mod path: ${modPath}`);
      logger.info(`Output path: ${outputPath}`);

      // Parse metadata
      logger.info('Parsing info.ini...');
      const metadata = await parseInfoIni(modPath);
      logger.success(`Parsed: ${metadata.name} v${metadata.version}`);

      // Validate mod
      logger.info('Validating mod...');
      const validation = await validateMod(modPath, metadata);
      if (!validation.valid) {
        logger.error('Validation failed:');
        for (const error of validation.errors) {
          logger.error(error);
        }
        throw new ValidationError('Mod validation failed');
      }
      logger.success('Validation passed');

      // Generate .nuspec
      logger.info('Generating .nuspec file...');
      const nuspecContent = generateNuspec(metadata);
      const nuspecPath = join(modPath, `${metadata.name}.nuspec`);
      await writeFile(nuspecPath, nuspecContent, 'utf-8');
      logger.success(`Generated: ${basename(nuspecPath)}`);

      // Collect files
      logger.info('Collecting files...');
      const files = await collectFilesForPackage({
        modPath,
        outputPath,
        recursive: true,
      });
      logger.success(`Found ${files.length} files`);

      // Ensure output directory exists
      await mkdir(outputPath, { recursive: true });

      // Pack using NuGet CLI
      const client = new NuGetCliManager();
      const nupkgPath = await client.pack(nuspecPath, outputPath);

      logger.blank();
      logger.success(`Package created: ${nupkgPath}`);
    } catch (error) {
      if (error instanceof FileSystemError || error instanceof ValidationError) {
        logger.error(error);
        process.exit(1);
      } else if (error instanceof Error) {
        logger.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  });
