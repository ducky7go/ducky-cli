import { Command } from 'commander';
import { join } from 'path';
import { fileExists } from '../../utils/fs.js';
import { ValidationError } from '../../utils/errors.js';
import type { Logger } from '../../utils/logger.js';
import { readPublishedFileId, savePublishedFileId } from '../../formats/steam/parser.js';
import { runSteamAction, withCommonOptions } from './shared.js';

/**
 * Ensure info.ini exists, with the same guidance `validate` gives
 * @throws {ValidationError} When info.ini is missing
 */
export async function requireInfoIni(modPath: string): Promise<void> {
  if (!(await fileExists(join(modPath, 'info.ini')))) {
    throw new ValidationError('info.ini not found in mod directory', [
      'Create an info.ini file in the mod directory',
      'Include required fields: name, version',
    ]);
  }
}

/**
 * Parse a Workshop item ID that must be a positive integer
 * @throws {ValidationError} For anything else
 */
export function parseWorkshopItemId(raw: string): number {
  const trimmed = raw.trim();
  const value = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(value) || value <= 0) {
    throw new ValidationError(`Invalid Workshop item ID "${raw}": a positive integer is required`, [
      'Use the numeric ID from the item page URL, for example 1234567890',
    ]);
  }
  return value;
}

/**
 * Write publishedFileId into the mod's info.ini without contacting Steam.
 * - same ID already present: no change
 * - different ID present: refused unless force is set
 * @returns 'linked' when info.ini was written, 'unchanged' when it already had this ID
 */
export async function linkModToItem(
  modPath: string,
  itemId: number,
  force: boolean,
  logger: Logger,
): Promise<'linked' | 'unchanged'> {
  await requireInfoIni(modPath);

  const existing = await readPublishedFileId(modPath);
  if (existing === itemId) {
    logger.info(`${modPath} is already linked to Workshop item ${itemId}; nothing to change`);
    return 'unchanged';
  }
  if (existing !== undefined && !force) {
    throw new ValidationError(
      `info.ini already links Workshop item ${existing}; refusing to replace it with ${itemId}`,
      [
        'Pass --force to replace the existing publishedFileId',
        'Only use --force if the new ID is the item you want future pushes to update',
      ],
    );
  }

  logger.debug(`Writing publishedFileId = ${itemId} to ${join(modPath, 'info.ini')}`);
  await savePublishedFileId(modPath, itemId);
  logger.success(`Linked ${modPath} to Workshop item ${itemId}`);
  return 'linked';
}

export function createSteamLinkCommand(): Command {
  return withCommonOptions(
    new Command('link')
      .description('Link a mod directory to an existing Workshop item (writes publishedFileId; no Steam access)')
      .argument('<path>', 'Path to the mod directory')
      .argument('<id>', 'Existing Workshop item ID')
      .option('--force', 'Replace a different publishedFileId already present in info.ini', false),
  ).action(async (path: string, id: string, options: { force: boolean; verbose: boolean }) => {
    await runSteamAction({ verbose: options.verbose }, async (logger) => {
      const itemId = parseWorkshopItemId(id);
      await linkModToItem(path, itemId, options.force, logger);
    });
  });
}

export const steamLinkCommand = createSteamLinkCommand();
