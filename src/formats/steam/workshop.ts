/**
 * Steam Workshop client wrapper
 * Wraps steamworks.js for Workshop operations
 * Uses child process for proper cleanup of Steamworks proxy
 */

import {
  SteamUploadError,
  SteamConfigError,
  SteamNotRunningError,
  SteamLibraryError,
  WORKSHOP_AGREEMENT_URL,
  withCiHint,
} from '../../utils/errors.js';
import { getSteamAppId } from './config.js';
import type { SteamVisibilityName } from '../../utils/config.js';
import type { Logger } from '../../utils/logger.js';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

/**
 * Exit codes of the upload child process
 */
export const UPLOAD_EXIT_STEAM_NOT_RUNNING = 2;
export const UPLOAD_EXIT_LIBRARY_FAILED = 3;

/** Marker the child prints on stdout when Steam requires the Workshop agreement */
export const AGREEMENT_MARKER = 'AGREEMENT_REQUIRED';

/** Result of one upload */
export interface UploadResult {
  /** True when Steam asked for the Workshop agreement; the item was still saved */
  needsAttention: boolean;
}

/**
 * Run Steam upload in a child process
 * @param modPath - Path to the mod directory
 * @param options - Upload options
 * @param logger - Logger instance
 * @returns Promise that resolves when upload completes
 */
export async function runSteamUploadInChildProcess(
  modPath: string,
  options: {
    updateDescription: boolean;
    changelog?: string;
    skipTail?: boolean;
    /** Resolved App ID, passed to the child as STEAM_APP_ID */
    appId?: number;
    /** Resolved visibility name */
    visibility?: SteamVisibilityName;
    /** Resolved tags; omitted when none are configured */
    tags?: string[];
  },
  logger: Logger,
  _onProgress?: (bytesProcessed: number, bytesTotal: number) => void
): Promise<UploadResult> {
  const args = [modPath];

  if (options.updateDescription) {
    args.push('--update-description');
  }
  if (options.changelog) {
    args.push('--changelog', options.changelog);
  }
  if (options.skipTail) {
    args.push('--skip-tail');
  }
  if (options.visibility) {
    args.push('--visibility', options.visibility);
  }
  if (options.tags !== undefined) {
    args.push('--tags-json', JSON.stringify(options.tags));
  }

  const scriptPath = resolve(__dirname, 'upload-standalone.js');
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (options.appId !== undefined) {
    env.STEAM_APP_ID = String(options.appId);
  }

  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    let stdout = '';
    let stderr = '';
    let needsAttention = false;

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      // Log output line by line
      text.split('\n').filter(Boolean).forEach((line: string) => {
        if (line.includes(AGREEMENT_MARKER)) {
          needsAttention = true;
        }
        if (line.includes('[SUCCESS]')) {
          logger.success(line.replace(/\[SUCCESS\]\s*/g, ''));
        } else if (line.includes('[ERROR]')) {
          logger.error(line.replace(/\[ERROR\]\s*/g, ''));
        } else if (line.includes('[INFO]')) {
          logger.info(line.replace(/\[INFO\]\s*/g, ''));
        } else if (line.includes('[WARN]')) {
          logger.warn(line.replace(/\[WARN\]\s*/g, ''));
        } else if (line.includes('[DEBUG]')) {
          logger.debug(line.replace(/\[DEBUG\]\s*/g, ''));
        } else {
          logger.info(line);
        }
      });
    });

    child.stderr?.on('data', (data) => {
      stderr += data;
    });

    child.on('close', (code, signal) => {
      const reason = stderr.trim();
      if (code === 0) {
        resolve({ needsAttention });
      } else if (code === null) {
        // Killed by a signal (for example a native abort): the publish outcome is not known
        reject(
          new SteamUploadError(
            `The upload process was stopped by signal ${signal ?? 'unknown'} before it reported a result. The publish outcome is unverified.`,
            [
              'Check the item in the Steam Workshop or with `ducky steam info <id>` before retrying',
              'Retry only after checking, so a second item is not created',
            ],
          ),
        );
      } else if (code === UPLOAD_EXIT_STEAM_NOT_RUNNING) {
        reject(new SteamNotRunningError());
      } else if (code === UPLOAD_EXIT_LIBRARY_FAILED) {
        reject(
          new SteamConfigError(
            `The Steamworks library failed to load${reason ? `: ${reason}` : ''}`,
            withCiHint([
              'Check that the platform is supported by @ducky7go/steamworks.js',
              'Reinstall dependencies with pnpm install',
            ]),
          ),
        );
      } else {
        reject(new Error(`Upload process exited with code ${code}${stderr ? ': ' + stderr : ''}`));
      }
    });

    child.on('error', (err) => {
      reject(new SteamUploadError(
        `Failed to spawn upload process: ${err.message}`,
        [
          'Ensure Node.js is properly installed',
          'Check that the upload script exists',
        ]
      ));
    });

    // Store child process reference for cleanup
    (runSteamUploadInChildProcess as any).currentChild = child;
  });
}

/**
 * Kill the current upload child process if running
 */
export function killSteamUploadProcess(): void {
  const child = (runSteamUploadInChildProcess as any).currentChild;
  if (child && !child.killed) {
    child.kill('SIGKILL');
    (runSteamUploadInChildProcess as any).currentChild = null;
  }
}

// Steamworks.js client interface (kept for reference, not used directly)
interface SteamworksClient {
  workshop?: {
    createItem(appId?: number | null): Promise<{ itemId: bigint; needsToAcceptAgreement: boolean }>;
    updateItem(itemId: bigint, updateDetails: object, appId?: number | null): Promise<{ itemId: bigint; needsToAcceptAgreement: boolean }>;
    updateItemWithCallback(
      itemId: bigint,
      updateDetails: object,
      appId: number | null,
      successCallback: () => void,
      errorCallback: (err: unknown) => void,
      progressCallback?: (data: { status: number; progress: bigint; total: bigint }) => void,
      progressCallbackIntervalMs?: number | null
    ): void;
  };
}

let steamworks: SteamworksClient | null = null;

/** Set when Steam reports needsToAcceptAgreement for a create or update */
let agreementRequired = false;

/** True when Steam asked the user to accept the Workshop agreement during this process */
export function isAgreementRequired(): boolean {
  return agreementRequired;
}

/** Workshop agreement guidance printed by the child process */
export function agreementGuidance(): string {
  return `The item stays hidden until the Steam Workshop agreement is accepted. Accept it at ${WORKSHOP_AGREEMENT_URL} while logged in with the same account, then run the push again.`;
}

/**
 * Initialize Steamworks
 * @throws {SteamLibraryError} If the native library cannot be loaded
 * @throws {SteamNotRunningError} If Steam cannot be initialized or is not connected
 */
export async function initSteamworks(): Promise<void> {
  if (steamworks) {
    return; // Already initialized
  }

  let steamworksModule: {
    init?: (appId?: number) => unknown;
    isConnected?: () => boolean;
    default?: { init: (appId?: number) => unknown };
  };
  try {
    // @ts-ignore - steamworks.js is loaded dynamically; its typings do not match the runtime module
    steamworksModule = await import('@ducky7go/steamworks.js');
  } catch (error) {
    throw new SteamLibraryError(error instanceof Error ? error.message : String(error));
  }

  const appId = getSteamAppId();
  let api: unknown;
  try {
    api = steamworksModule.init
      ? steamworksModule.init(appId)
      : steamworksModule.default!.init(appId);
  } catch (error) {
    throw new SteamNotRunningError(undefined, [
      'Start the Steam client and log in',
      'Make sure Steam and this terminal run as the same user at the same privilege level',
      `Native error: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }
  if (!api) {
    throw new SteamNotRunningError();
  }
  steamworks = api as SteamworksClient;

  // Wait a bit for Steam to fully initialize
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (steamworksModule.isConnected && !steamworksModule.isConnected()) {
    steamworks = null;
    throw new SteamNotRunningError();
  }
}

/**
 * Shutdown Steamworks
 * Note: steamworks.js doesn't have a shutdown method, so we just clear our references
 */
export function shutdownSteamworks(): void {
  steamworks = null;
}

/**
 * Create a new Workshop item
 * @returns The published file ID
 * @throws {SteamUploadError} If creation fails
 */
export async function createWorkshopItem(): Promise<number> {
  if (!steamworks?.workshop) {
    throw new SteamUploadError('Steamworks not initialized');
  }

  const appId = getSteamAppId();
  const result = await steamworks.workshop.createItem(appId);
  if (result.needsToAcceptAgreement) {
    agreementRequired = true;
  }

  if (!result.itemId || result.itemId === 0n) {
    throw new SteamUploadError(
      'Failed to create Workshop item',
      [
        'Ensure you have permission to create Workshop items',
        'Check that your Steam account is in good standing',
        'Try again later',
      ]
    );
  }

  return Number(result.itemId);
}

/**
 * Workshop update details
 */
export interface WorkshopUpdateDetails {
  title?: string;
  description?: string;
  changeNote?: string;
  previewPath?: string;
  contentPath?: string;
  tags?: Array<string>;
  visibility?: number;
  language?: string; // Steam language code for localized updates
}

/**
 * Update a Workshop item (Promise-based)
 * @param publishedFileId - The published file ID
 * @param details - Update details
 * @returns Promise that resolves when update completes
 */
export async function updateWorkshopItem(
  publishedFileId: number,
  details: WorkshopUpdateDetails
): Promise<void> {
  if (!steamworks?.workshop) {
    throw new SteamUploadError('Steamworks not initialized');
  }

  const appId = getSteamAppId();
  const itemId = BigInt(publishedFileId);

  await steamworks.workshop.updateItem(itemId, details, appId);
}

/**
 * Update a Workshop item with progress tracking
 * @param publishedFileId - The published file ID
 * @param details - Update details
 * @param logger - Logger instance
 * @param onProgress - Progress callback
 * @returns Promise that resolves when update completes
 */
export async function updateWorkshopItemWithProgress(
  publishedFileId: number,
  details: WorkshopUpdateDetails,
  _logger: Logger,
  onProgress?: (bytesProcessed: number, bytesTotal: number) => void
): Promise<void> {
  if (!steamworks?.workshop) {
    throw new SteamUploadError('Steamworks not initialized');
  }

  const appId = getSteamAppId();
  const itemId = BigInt(publishedFileId);

  return new Promise((resolve, reject) => {
    steamworks!.workshop!.updateItemWithCallback(
      itemId,
      details,
      appId,
      // Success callback
      (data?: { needsToAcceptAgreement?: boolean }) => {
        if (data?.needsToAcceptAgreement) {
          agreementRequired = true;
        }
        resolve();
      },
      // Error callback
      (err) => {
        const errorMessage = err && typeof err === 'object' && 'message' in err
          ? String(err.message)
          : String(err);
        reject(new SteamUploadError(
          `Workshop upload failed: ${errorMessage}`,
          [
            'Check your internet connection',
            'Ensure Steam is running and logged in',
            'Try again later',
          ]
        ));
      },
      // Progress callback
      onProgress ? (data) => {
        const processed = Number(data.progress);
        const total = Number(data.total);
        onProgress(processed, total);
      } : undefined,
      100 // Progress callback interval in ms
    );
  });
}

/**
 * Check if Steamworks is available
 */
export function isSteamworksAvailable(): boolean {
  return steamworks !== null;
}
