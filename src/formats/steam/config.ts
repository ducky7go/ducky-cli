/**
 * Steam configuration
 *
 * App ID precedence (first available wins):
 *   1. --app-id option
 *   2. STEAM_APP_ID environment variable
 *   3. steam.appId in .duckyrc
 *   4. default 3167020
 *
 * Visibility and tags defaults come from .duckyrc (steam.visibility, steam.tags).
 */

import { ConfigError } from '../../utils/errors.js';
import { loadDuckyRc, type DuckyRcSteam, type SteamVisibilityName } from '../../utils/config.js';

export const DEFAULT_STEAM_APP_ID = 3167020;

/**
 * Where the resolved App ID came from
 */
export type AppIdSource = 'option' | 'env' | 'duckyrc' | 'default';

/**
 * Raw App ID inputs. An absent (undefined) or empty value means "not provided".
 */
export interface SteamAppIdSources {
  /** Value of --app-id */
  cli?: string | number;
  /** Value of STEAM_APP_ID */
  env?: string;
  /** steam.appId from .duckyrc */
  rc?: number;
}

/**
 * Result of App ID resolution
 */
export interface ResolvedAppId {
  appId: number;
  source: AppIdSource;
}

const SOURCE_LABELS: Record<Exclude<AppIdSource, 'default'>, string> = {
  option: '--app-id option',
  env: 'STEAM_APP_ID environment variable',
  duckyrc: '.duckyrc (steam.appId)',
};

/**
 * Parse a positive integer App ID. Returns undefined when the value is not one.
 */
function parsePositiveInteger(raw: string | number): number | undefined {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw > 0 ? raw : undefined;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/**
 * Resolve the Steam App ID from the given sources, in precedence order.
 * Invalid values are rejected and the error names the source that supplied them.
 *
 * @throws {ConfigError} When the chosen value is not a positive integer
 */
export function resolveSteamAppId(sources: SteamAppIdSources = {}): ResolvedAppId {
  const candidates: Array<{ source: Exclude<AppIdSource, 'default'>; raw: string | number }> = [];

  if (sources.cli !== undefined && sources.cli !== '') {
    candidates.push({ source: 'option', raw: sources.cli });
  }
  if (sources.env !== undefined && sources.env !== '') {
    candidates.push({ source: 'env', raw: sources.env });
  }
  if (sources.rc !== undefined) {
    candidates.push({ source: 'duckyrc', raw: sources.rc });
  }

  const [first] = candidates;
  if (!first) {
    return { appId: DEFAULT_STEAM_APP_ID, source: 'default' };
  }

  const appId = parsePositiveInteger(first.raw);
  if (appId === undefined) {
    throw new ConfigError(
      `Invalid Steam App ID from ${SOURCE_LABELS[first.source]}: "${first.raw}" (must be a positive integer)`,
      [
        'Use a positive whole number such as 3167020',
        'Omit the value to fall back to the next source or the default 3167020',
      ],
    );
  }
  return { appId, source: first.source };
}

/**
 * Read the App ID sources available to a command: STEAM_APP_ID and .duckyrc.
 * The --app-id option is passed in by the command itself.
 */
export function readAppIdSourcesFromEnvironment(cliAppId?: string | number): SteamAppIdSources {
  const rc = loadDuckyRc();
  return {
    cli: cliAppId,
    env: process.env.STEAM_APP_ID,
    rc: rc?.steam.appId,
  };
}

/**
 * Get Steam App ID using --app-id-less precedence: STEAM_APP_ID, then .duckyrc, then default
 * @returns Steam App ID
 */
export function getSteamAppId(): number {
  return resolveSteamAppId(readAppIdSourcesFromEnvironment()).appId;
}

/**
 * Steam push defaults that come from .duckyrc
 */
export interface SteamPushDefaults {
  visibility?: SteamVisibilityName;
  tags?: string[];
}

/**
 * Resolve visibility and tags defaults from .duckyrc.
 * @param rc - Steam section of .duckyrc; loaded from the working directory when omitted
 */
export function resolveSteamPushDefaults(rc?: DuckyRcSteam): SteamPushDefaults {
  const steam = rc ?? loadDuckyRc()?.steam ?? {};
  const defaults: SteamPushDefaults = {};
  if (steam.visibility !== undefined) {
    defaults.visibility = steam.visibility;
  }
  if (steam.tags !== undefined) {
    defaults.tags = [...steam.tags];
  }
  return defaults;
}

/**
 * Steam configuration interface
 */
export interface SteamConfig {
  appId: number;
}

/**
 * Get Steam configuration
 * @returns Steam configuration
 */
export function getSteamConfig(): SteamConfig {
  return {
    appId: getSteamAppId(),
  };
}
