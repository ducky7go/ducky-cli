/**
 * Steam Workshop client wrapper
 * Wraps steamworks.js for Workshop operations
 * Uses child process for proper cleanup of Steamworks proxy
 */

import { SteamAuthError, SteamUploadError, SteamConfigError } from '../../utils/errors.js';
import { getSteamAppId } from './config.js';
import type { Logger } from '../../utils/logger.js';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

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
  },
  logger: Logger,
  _onProgress?: (bytesProcessed: number, bytesTotal: number) => void
): Promise<void> {
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

  const scriptPath = resolve(__dirname, 'upload-standalone.js');

  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      // Log output line by line
      text.split('\n').filter(Boolean).forEach((line: string) => {
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

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
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

/**
 * Initialize Steamworks
 * @throws {SteamConfigError} If Steamworks initialization fails
 */
export async function initSteamworks(): Promise<void> {
  if (steamworks) {
    return; // Already initialized
  }

  try {
    // Import steamworks.js
    const steamworksModule = await import('@ducky7go/steamworks.js');
    const appId = getSteamAppId();

    // Initialize Steamworks - init is a named export, not default
    // @ts-ignore - init exists on the module
    const api = steamworksModule.init ? steamworksModule.init(appId) : steamworksModule.default.init(appId);
    steamworks = api as SteamworksClient;

    if (!steamworks) {
      throw new SteamConfigError(
        'Failed to initialize Steamworks',
        [
          'Ensure Steam is running',
          'Ensure you are logged into Steam',
          'Check that the Steam App ID is correct',
          'Try restarting Steam',
        ]
      );
    }

    // Wait a bit for Steam to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    if (error instanceof SteamConfigError || error instanceof SteamAuthError) {
      throw error;
    }
    throw new SteamConfigError(
      `Failed to load Steamworks: ${error instanceof Error ? error.message : String(error)}`,
      [
        'Ensure @ducky7go/steamworks.js is installed',
        'Try running: npm install',
        'Ensure Steam is installed and running',
      ]
    );
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
      () => {
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
