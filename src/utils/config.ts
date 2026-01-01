import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ConfigError } from './errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file if it exists
dotenvConfig();

/**
 * Configuration interface for NuGet operations
 */
export interface NuGetConfig {
  apiKey?: string;
  server?: string;
  verbose?: boolean;
}

/**
 * Resolve configuration from multiple sources with precedence:
 * 1. CLI flags (highest priority)
 * 2. Environment variables
 * 3. Config file (.duckyrc)
 * 4. Default values (lowest priority)
 *
 * @param cliFlags - Configuration from CLI flags
 * @param envPrefix - Prefix for environment variables (default: 'NUGET')
 * @returns Resolved configuration
 */
export function resolveConfig(
  cliFlags: Partial<NuGetConfig> = {},
  envPrefix = 'NUGET',
): NuGetConfig {
  const config: NuGetConfig = {
    // Default values
    server: 'https://api.nuget.org/v3/index.json',
    verbose: false,
  };

  // Load from environment variables
  const envApiKey = process.env[`${envPrefix}_API_KEY`];
  const envServer = process.env[`${envPrefix}_SERVER`];
  const envVerbose = process.env[`${envPrefix}_VERBOSE`];

  if (envApiKey) {
    config.apiKey = envApiKey;
  }
  if (envServer) {
    config.server = envServer;
  }
  if (envVerbose) {
    config.verbose = envVerbose === 'true' || envVerbose === '1';
  }

  // Load from config file (optional)
  // TODO: Implement .duckyrc parsing if needed

  // Override with CLI flags (highest priority)
  if (cliFlags.apiKey !== undefined) {
    config.apiKey = cliFlags.apiKey;
  }
  if (cliFlags.server !== undefined) {
    config.server = cliFlags.server;
  }
  if (cliFlags.verbose !== undefined) {
    config.verbose = cliFlags.verbose;
  }

  return config;
}

/**
 * Get API key from configuration
 * @throws {ConfigError} If API key is required but not found
 */
export function getApiKey(config: NuGetConfig): string {
  if (!config.apiKey) {
    throw new ConfigError(
      'NuGet API key is required for this operation',
      [
        'Set the NUGET_API_KEY environment variable',
        'Use the --api-key flag',
        'For nuget.org, create an API key at https://www.nuget.org/account/apikeys',
      ],
    );
  }
  return config.apiKey;
}

/**
 * Get server URL from configuration
 * @throws {ConfigError} If server URL is invalid
 */
export function getServerUrl(config: NuGetConfig): string {
  if (!config.server) {
    return 'https://api.nuget.org/v3/index.json';
  }

  try {
    new URL(config.server);
    return config.server;
  } catch {
    throw new ConfigError(`Invalid server URL: ${config.server}`, [
      'Ensure the URL is valid (e.g., https://api.nuget.org/v3/index.json)',
      'Use the --server flag with a valid URL',
    ]);
  }
}
