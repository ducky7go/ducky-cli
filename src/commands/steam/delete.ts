import { Command } from 'commander';
import { createInterface } from 'readline/promises';
import {
  withSteamSession,
  getWorkshopItem,
  deleteWorkshopItem,
  type SteamWorkshopClient,
} from '../../formats/steam/query.js';
import { SteamError, ValidationError } from '../../utils/errors.js';
import type { Logger } from '../../utils/logger.js';
import { parseWorkshopItemId } from './link.js';
import { isStdinInteractive, resolveCommandAppId, runSteamAction, withCommonOptions } from './shared.js';

/** Asks the user to confirm; resolves true only when the answer is the exact item ID */
export type ConfirmDelete = (itemId: string, title: string) => Promise<boolean>;

/**
 * Non-interactive runs must pass --yes; this is checked before any Steam call
 * @throws {ValidationError} When neither --yes nor an interactive terminal is available
 */
export function ensureConfirmationPossible(yes: boolean, interactive: boolean): void {
  if (!yes && !interactive) {
    throw new ValidationError('--yes is required when standard input is not an interactive terminal', [
      'Pass --yes to delete without a prompt, for example in scripts or CI',
    ]);
  }
}

/** Interactive confirmation: the user must type the exact item ID */
export const promptForConfirmation: ConfirmDelete = async (itemId, title) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(`About to permanently delete Workshop item ${itemId}: "${title}".`);
    console.log('This cannot be undone. Type the item ID to confirm:');
    const answer = await rl.question('> ');
    return answer.trim() === itemId;
  } finally {
    rl.close();
  }
};

/**
 * Delete a Workshop item after confirmation.
 * With --yes no prompt is shown. Otherwise the title is looked up (best effort) and confirm() decides.
 * @throws {SteamError} When the user declines or Steam rejects the deletion
 */
export async function runDelete(
  client: SteamWorkshopClient,
  itemId: bigint,
  options: { yes: boolean; confirm?: ConfirmDelete },
  logger: Logger,
): Promise<void> {
  if (!options.yes) {
    let title = '(title unavailable)';
    try {
      const item = await getWorkshopItem(client, itemId);
      if (item) {
        title = item.title;
      }
    } catch (error) {
      logger.debug(`Could not look up the title for the confirmation prompt: ${String(error)}`);
    }

    const confirm = options.confirm ?? promptForConfirmation;
    const confirmed = await confirm(itemId.toString(), title);
    if (!confirmed) {
      throw new SteamError('Deletion cancelled: nothing was deleted', [
        `To delete, type exactly ${itemId} at the prompt, or pass --yes`,
      ]);
    }
  }

  await deleteWorkshopItem(client, itemId);
  logger.success(`Deleted Workshop item ${itemId}`);
  logger.info(
    `Remove "publishedFileId = ${itemId}" from any local info.ini that references this item; ducky steam delete does not edit files.`,
  );
}

export function createSteamDeleteCommand(): Command {
  return withCommonOptions(
    new Command('delete')
      .description('Permanently delete a Workshop item you own (asks for confirmation)')
      .argument('<id>', 'Workshop item ID to delete')
      .option('--yes', 'Delete without the interactive confirmation', false),
  ).action(async (id: string, options: { yes: boolean; appId?: string; verbose: boolean }) => {
    await runSteamAction({ verbose: options.verbose }, async (logger) => {
      const itemId = parseWorkshopItemId(id);
      ensureConfirmationPossible(options.yes, isStdinInteractive());

      const { appId, source } = resolveCommandAppId(options.appId);
      logger.info(`Using Steam App ID: ${appId}`);
      logger.debug(`App ID source: ${source}`);

      await withSteamSession(appId, (client) =>
        runDelete(client, BigInt(itemId), { yes: options.yes }, logger),
      );
    });
  });
}

export const steamDeleteCommand = createSteamDeleteCommand();
