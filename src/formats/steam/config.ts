/**
 * Steam configuration
 *
 * App ID is fixed at 3167020 and can only be overridden via environment variable.
 * It cannot be added to info.ini.
 */

const DEFAULT_STEAM_APP_ID = 3167020;

/**
 * Get Steam App ID from environment variable or use default
 * @returns Steam App ID
 */
export function getSteamAppId(): number {
  const envAppId = process.env.STEAM_APP_ID;
  if (envAppId) {
    const appId = parseInt(envAppId, 10);
    if (isNaN(appId)) {
      throw new Error(`Invalid STEAM_APP_ID environment variable: ${envAppId}`);
    }
    return appId;
  }
  return DEFAULT_STEAM_APP_ID;
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
