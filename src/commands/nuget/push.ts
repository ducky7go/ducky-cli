import { Command } from 'commander';
import { resolve, join, relative } from 'path';
import { fileExists } from '../../utils/fs.js';
import { createLogger, resolveConfig, getApiKey, getServerUrl, LogLevel } from '../../utils/index.js';
import { parseInfoIni, generateNuspec, collectFilesForPackage, validateMod, loadDescription, loadReleaseNotes } from '../../formats/nuget/index.js';
import { NuGetCliManager } from '../../formats/nuget/client.js';
import { FileSystemError, ValidationError, ConfigError } from '../../utils/errors.js';

const logger = createLogger();

/**
 * T17: Implement nuget push command
 * Publishes a .nupkg file to a NuGet server
 */
export const nugetPushCommand = new Command('push')
  .description('Publish a .nupkg file to a NuGet server')
  .argument('<path>', 'Path to .nupkg file or mod directory (with --pack)')
  .option('-p, --pack', 'Package the mod before pushing')
  .option('-s, --server <url>', 'NuGet server URL')
  .option('-k, --api-key <key>', 'NuGet API key')
  .option('-o, --output <path>', 'Output directory for .nupkg file (when using --pack)')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (path: string, options) => {
    try {
      // Configure logger
      if (options.verbose) {
        logger.setLevel(LogLevel.DEBUG);
      }

      let nupkgPath: string;

      // If --pack flag is used, first pack the mod
      if (options.pack) {
        logger.header('NuGet Push (with Pack)');
        const modPath = resolve(path);
        // Default output to project root pkg directory
        const { join } = await import('path');
        const projectRoot = process.cwd();
        const defaultOutputPath = join(projectRoot, 'pkg');
        const outputPath = options.output ? resolve(options.output) : defaultOutputPath;

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

        // Pack using NuGet CLI
        const { mkdir, writeFile } = await import('fs/promises');
        await mkdir(outputPath, { recursive: true });

        // Load description (README)
        logger.info('Loading description...');
        const longDescription = await loadDescription(modPath, metadata);
        logger.success(`Loaded description: ${longDescription.length} characters`);

        // Write README.md to pkg directory if description was loaded
        let readmeFilePath = '';
        if (longDescription && longDescription.length > 0) {
          const readmePath = join(outputPath, 'README.md');
          await writeFile(readmePath, longDescription, 'utf-8');
          // Compute relative path from modPath to outputPath
          readmeFilePath = join(relative(modPath, outputPath), 'README.md');
          logger.info('Generated README.md in pkg directory');
        }

        // Load release notes
        logger.info('Loading release notes...');
        const releaseNotes = await loadReleaseNotes(modPath, metadata);
        logger.success(`Loaded release notes: ${releaseNotes.length} characters`);

        // Generate .nuspec from template
        logger.info('Generating .nuspec file from template...');
        const nuspecPath = join(outputPath, `${metadata.name}.nuspec`);
        const nuspecContent = await generateNuspec(modPath, metadata, readmeFilePath, releaseNotes);
        await writeFile(nuspecPath, nuspecContent, 'utf-8');
        logger.success('Generated .nuspec file');

        const client = new NuGetCliManager();
        nupkgPath = await client.pack(nuspecPath, outputPath, modPath);
        logger.success(`Package created: ${nupkgPath}`);
      } else {
        // Verify .nupkg file exists
        nupkgPath = resolve(path);
        if (!(await fileExists(nupkgPath))) {
          throw new FileSystemError(
            `.nupkg file not found: ${nupkgPath}`,
            [
              'Check that the path is correct',
              'Use --pack flag to package a mod directory before pushing',
            ],
          );
        }
        logger.header('NuGet Push');
        logger.info(`Package path: ${nupkgPath}`);
      }

      // Load configuration
      const config = resolveConfig({
        server: options.server,
        apiKey: options.apiKey,
        verbose: options.verbose,
      });

      const server = getServerUrl(config);
      const apiKey = getApiKey(config);

      logger.info(`Server: ${server}`);
      logger.info(`API Key: ${apiKey ? '***' + apiKey.slice(-4) : '(none)'}`);

      // Push using NuGet CLI
      logger.blank();
      logger.info('Pushing package...');

      const client = new NuGetCliManager();
      await client.push(nupkgPath, server, apiKey);

      logger.blank();
      logger.success('Package pushed successfully!');
    } catch (error) {
      if (
        error instanceof FileSystemError ||
        error instanceof ValidationError ||
        error instanceof ConfigError
      ) {
        logger.error(error);
        process.exit(1);
      } else if (error instanceof Error) {
        logger.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  });
