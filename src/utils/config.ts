import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, statSync } from 'fs';
import { homedir } from 'os';
import { ConfigError } from './errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file if it exists
dotenvConfig({ quiet: true });

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

  // .duckyrc is not read for NuGet settings; Steam defaults come from loadDuckyRc()

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
 * File name of the optional JSON configuration file
 */
export const DUCKYRC_FILE_NAME = '.duckyrc';

/**
 * Steam visibility names accepted in .duckyrc and on the command line
 */
export const STEAM_VISIBILITY_NAMES = ['public', 'friends', 'private', 'unlisted'] as const;
export type SteamVisibilityName = (typeof STEAM_VISIBILITY_NAMES)[number];

/**
 * Steam section of .duckyrc. Every key is optional.
 */
export interface DuckyRcSteam {
  appId?: number;
  visibility?: SteamVisibilityName;
  tags?: string[];
}

/**
 * A loaded .duckyrc file
 */
export interface DuckyRcConfig {
  /** Absolute path of the file that was used */
  path: string;
  steam: DuckyRcSteam;
}

/**
 * Find the .duckyrc file that applies: the nearest one walking up from startDir,
 * otherwise the one in the home directory. The nearest file wins as a whole.
 */
function findDuckyRcPath(startDir: string, home: string): string | undefined {
  let current = resolve(startDir);
  while (true) {
    const candidate = join(current, DUCKYRC_FILE_NAME);
    if (isFile(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  const homeCandidate = join(resolve(home), DUCKYRC_FILE_NAME);
  return isFile(homeCandidate) ? homeCandidate : undefined;
}

function isFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Validate the parsed `steam` section, naming the file and key on failure.
 */
function validateSteamSection(value: unknown, path: string): DuckyRcSteam {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConfigError(`Invalid "steam" in ${path}: expected an object`, [
      'Use the form {"steam": {"appId": 3167020, "visibility": "public", "tags": []}}',
    ]);
  }
  const raw = value as Record<string, unknown>;
  const steam: DuckyRcSteam = {};

  if (raw.appId !== undefined) {
    if (typeof raw.appId !== 'number' || !Number.isInteger(raw.appId) || raw.appId <= 0) {
      throw new ConfigError(
        `Invalid steam.appId in ${path}: ${JSON.stringify(raw.appId)} is not a positive integer`,
        ['Set steam.appId to a positive whole number, for example 3167020'],
      );
    }
    steam.appId = raw.appId;
  }

  if (raw.visibility !== undefined) {
    if (
      typeof raw.visibility !== 'string' ||
      !(STEAM_VISIBILITY_NAMES as readonly string[]).includes(raw.visibility)
    ) {
      throw new ConfigError(
        `Invalid steam.visibility in ${path}: ${JSON.stringify(raw.visibility)}`,
        [`Use one of: ${STEAM_VISIBILITY_NAMES.join(', ')}`],
      );
    }
    steam.visibility = raw.visibility as SteamVisibilityName;
  }

  if (raw.tags !== undefined) {
    if (!Array.isArray(raw.tags) || raw.tags.some((t) => typeof t !== 'string')) {
      throw new ConfigError(`Invalid steam.tags in ${path}: expected an array of strings`, [
        'Use a JSON array of strings, for example ["Weapons", "Balance"]',
      ]);
    }
    steam.tags = [...raw.tags];
  }

  return steam;
}

/**
 * Load the nearest .duckyrc file (current directory and its ancestors, then the home directory).
 *
 * @param startDir - Directory to start the upward search from (default: current working directory)
 * @param home - Home directory used as the fallback location (default: os.homedir())
 * @returns The loaded configuration, or undefined when no file exists
 * @throws {ConfigError} When the file is not valid JSON or a Steam value is invalid
 */
export function loadDuckyRc(
  startDir: string = process.cwd(),
  home: string = homedir(),
): DuckyRcConfig | undefined {
  const path = findDuckyRcPath(startDir, home);
  if (!path) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Failed to parse ${path}: ${reason}`, [
      'Check that the file contains valid JSON',
      'Example: {"steam": {"appId": 3167020}}',
    ]);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ConfigError(`Invalid ${path}: the top-level value must be a JSON object`, [
      'Example: {"steam": {"appId": 3167020}}',
    ]);
  }

  // Keys outside "steam" are intentionally ignored
  const steam = validateSteamSection((parsed as Record<string, unknown>).steam, path);
  return { path, steam };
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
