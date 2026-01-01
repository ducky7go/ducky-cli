import { spawn, exec } from 'child_process';
import { join, dirname, resolve } from 'path';
import { mkdir, writeFile, chmod } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir, platform, tmpdir } from 'os';
import { createLogger } from '../../utils/logger.js';
import { NuGetError } from '../../utils/errors.js';

const logger = createLogger();

/**
 * NuGet CLI configuration
 */
interface NugetConfig {
  /** Path to NuGet executable */
  exePath?: string;
  /** Whether to use embedded/managed NuGet */
  useManaged?: boolean;
  /** Custom NuGet version */
  version?: string;
}

/**
 * NuGet CLI manager
 * Handles detection, download, and execution of NuGet CLI
 */
export class NuGetCliManager {
  private cacheDir: string;
  private version: string;
  private platform: NodeJS.Platform;

  constructor(config: NugetConfig = {}) {
    this.cacheDir = join(homedir(), '.ducky', 'nuget');
    this.version = config.version || '6.11.0';
    this.platform = platform();
  }

  /**
   * Get the path to the NuGet executable
   * Downloads NuGet if not found in PATH or cache
   */
  async getExePath(): Promise<string> {
    // First, check if NuGet is in PATH
    const pathExe = await this.findInPath();
    if (pathExe) {
      logger.debug(`Using NuGet from PATH: ${pathExe}`);
      return pathExe;
    }

    // Check cache
    const cachedExe = this.getCachedExePath();
    if (existsSync(cachedExe)) {
      logger.debug(`Using cached NuGet: ${cachedExe}`);
      return cachedExe;
    }

    // Download to cache
    logger.info(`NuGet not found in PATH or cache. Downloading v${this.version}...`);
    return await this.downloadNuGet();
  }

  /**
   * Find NuGet in system PATH
   */
  private async findInPath(): Promise<string | null> {
    return new Promise((resolve) => {
      const command = this.platform === 'win32' ? 'where nuget.exe' : 'which nuget';
      exec(command, (error, stdout) => {
        if (error) {
          resolve(null);
        } else {
          const path = stdout.trim().split('\n')[0];
          resolve(path || null);
        }
      });
    });
  }

  /**
   * Get the path to cached NuGet executable
   */
  private getCachedExePath(): string {
    const exeName = this.platform === 'win32' ? 'nuget.exe' : 'nuget.exe';
    return join(this.cacheDir, exeName);
  }

  /**
   * Download NuGet CLI to cache directory
   */
  private async downloadNuGet(): Promise<string> {
    const exePath = this.getCachedExePath();

    // Ensure cache directory exists
    await mkdir(dirname(exePath), { recursive: true });

    // For now, we'll use a shell script approach for downloading
    // In production, you'd want to verify checksums and handle HTTPS properly
    const nugetUrl = 'https://dist.nuget.org/win-x86-commandline/latest/nuget.exe';

    logger.info(`Downloading NuGet from ${nugetUrl}...`);

    // Download using curl or wget (available on most systems)
    const downloadCmd = this.platform === 'win32' ? 'powershell' : 'curl';
    const downloadArgs =
      this.platform === 'win32'
        ? [
            '-Command',
            `Invoke-WebRequest -Uri "${nugetUrl}" -OutFile "${exePath}"`,
          ]
        : ['-L', nugetUrl, '-o', exePath];

    return new Promise((resolve, reject) => {
      const child = spawn(downloadCmd, downloadArgs, { stdio: 'inherit' });

      child.on('close', async (code) => {
        if (code === 0) {
          logger.success(`NuGet downloaded to ${exePath}`);

          // Make executable on Unix-like systems
          if (this.platform !== 'win32') {
            await chmod(exePath, 0o755);
          }

          resolve(exePath);
        } else {
          reject(
            new Error(
              `Failed to download NuGet (exit code ${code}). Please install manually from https://learn.microsoft.com/en-us/nuget/install-nuget-client-tools`,
            ),
          );
        }
      });
    });
  }

  /**
   * Execute a NuGet command
   */
  async execute(args: string[], cwd?: string): Promise<string> {
    const exePath = await this.getExePath();

    logger.debug(`Executing: ${exePath} ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      const child = spawn(exePath, args, {
        cwd,
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`NuGet command failed (exit code ${code}): ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to execute NuGet: ${error.message}`));
      });
    });
  }

  /**
   * T14: Pack a .nuspec file into a .nupkg package
   * @param nuspecPath - Path to .nuspec file
   * @param outputPath - Directory for output .nupkg file
   * @returns Path to created .nupkg file
   */
  async pack(nuspecPath: string, outputPath: string): Promise<string> {
    logger.info(`Creating NuGet package from ${nuspecPath}...`);

    const outputDir = resolve(outputPath);
    const args = ['pack', nuspecPath, '-OutputDirectory', outputDir, '-NoDefaultExcludes'];

    try {
      const stdout = await this.execute(args);

      // Extract .nupkg path from output
      const match = stdout.match(/[^/\\]+\.nupkg/g);
      if (match && match.length > 0) {
        const nupkgName = match[0];
        const nupkgPath = join(outputDir, nupkgName);
        logger.success(`Created package: ${nupkgPath}`);
        return nupkgPath;
      }

      // Fallback: construct expected path
      throw new NuGetError('Failed to determine .nupkg file path from NuGet output');
    } catch (error) {
      if (error instanceof Error) {
        throw new NuGetError(`Failed to create NuGet package: ${error.message}`, [
          'Check that the .nuspec file is valid',
          'Ensure all referenced files exist',
          'Run with --verbose for more details',
        ]);
      }
      throw error;
    }
  }

  /**
   * T15: Push a .nupkg package to a NuGet server
   * @param nupkgPath - Path to .nupkg file
   * @param server - NuGet server URL
   * @param apiKey - API key for authentication
   * @returns Success message
   */
  async push(nupkgPath: string, server: string, apiKey: string): Promise<void> {
    logger.info(`Pushing ${nupkgPath} to ${server}...`);

    const args = ['push', nupkgPath, '-Source', server, '-ApiKey', apiKey];

    try {
      const stdout = await this.execute(args);

      if (stdout.includes('Your package was pushed')) {
        logger.success('Package pushed successfully!');
      } else {
        logger.info('Package push completed');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new NuGetError(`Failed to push package: ${error.message}`, [
          'Check your API key is correct',
          'Ensure the server URL is correct',
          'Verify the package version does not already exist on the server',
          'Run with --verbose for more details',
        ]);
      }
      throw error;
    }
  }
}
