import { Command } from 'commander';
import { createInterface } from 'readline/promises';
import { fileURLToPath } from 'url';
import {
  withSteamSession,
  getWorkshopItem,
  deleteWorkshopItem,
  verifyItemPresence,
  type SteamWorkshopClient,
} from '../../formats/steam/query.js';
import {
  runIsolatedDelete,
  type DeleteOutcome,
  type Spawner,
} from '../../formats/steam/isolated-delete.js';
import {
  IndeterminateOutcomeError,
  SteamError,
  ValidationError,
} from '../../utils/errors.js';
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
 * Look up the item title for the confirmation prompt (best effort).
 * Returns '(title unavailable)' when the lookup fails; never throws.
 */
async function lookupTitle(client: SteamWorkshopClient, itemId: bigint, logger: Logger): Promise<string> {
  try {
    const item = await getWorkshopItem(client, itemId);
    if (item) {
      return item.title;
    }
  } catch (error) {
    logger.debug(`Could not look up the title for the confirmation prompt: ${String(error)}`);
  }
  return '(title unavailable)';
}

/**
 * Ask for confirmation unless --yes was given.
 * @throws {SteamError} When the user declines
 */
async function confirmOrCancel(
  itemId: bigint,
  title: string,
  options: { yes: boolean; confirm?: ConfirmDelete },
): Promise<void> {
  if (options.yes) {
    return;
  }
  const confirm = options.confirm ?? promptForConfirmation;
  const confirmed = await confirm(itemId.toString(), title);
  if (!confirmed) {
    throw new SteamError('Deletion cancelled: nothing was deleted', [
      `To delete, type exactly ${itemId} at the prompt, or pass --yes`,
    ]);
  }
}

/** Print the reminder shown after any confirmed deletion */
function logConfirmedDeletion(itemId: bigint, logger: Logger): void {
  logger.success(`Deleted Workshop item ${itemId}`);
  logger.info(
    `Remove "publishedFileId = ${itemId}" from any local info.ini that references this item; ducky steam delete does not edit files.`,
  );
}

/**
 * Delete a Workshop item after confirmation, in the calling process.
 * With --yes no prompt is shown. Otherwise the title is looked up (best effort) and confirm() decides.
 * The command itself uses runDeleteIsolated; this in-process form is kept for direct callers.
 * @throws {SteamError} When the user declines or Steam rejects the deletion
 */
export async function runDelete(
  client: SteamWorkshopClient,
  itemId: bigint,
  options: { yes: boolean; confirm?: ConfirmDelete },
  logger: Logger,
): Promise<void> {
  if (!options.yes) {
    const title = await lookupTitle(client, itemId, logger);
    await confirmOrCancel(itemId, title, options);
  }

  await deleteWorkshopItem(client, itemId);
  logConfirmedDeletion(itemId, logger);
}

/** Session access and process wiring for the isolated delete; injectable for tests */
export interface IsolatedDeleteDeps {
  /** Runs fn with a connected client in a fresh Steam session that is closed afterwards */
  withSession: <T>(fn: (client: SteamWorkshopClient) => Promise<T>) => Promise<T>;
  /** Compiled isolated-delete module, run as the child process */
  childScript?: string;
  spawn?: Spawner;
  retryDelayMs?: number;
}

/** Default child script: this module's compiled sibling */
export const DEFAULT_CHILD_SCRIPT = fileURLToPath(new URL('../../formats/steam/isolated-delete.js', import.meta.url));

/**
 * Report a delete outcome. Confirmed prints the success text; not-deleted and indeterminate throw
 * so the command exits with code 1 or 2.
 * @throws {SteamError} For not-deleted outcomes
 * @throws {IndeterminateOutcomeError} For indeterminate outcomes
 */
export function reportDeleteOutcome(itemId: bigint, outcome: DeleteOutcome, logger: Logger): void {
  if (outcome.outcome === 'confirmed') {
    if (outcome.childEnd) {
      logger.warn(
        `The Steam library ${outcome.childEnd}. The deletion was confirmed afterwards: item ${itemId} no longer exists.`,
      );
    }
    logConfirmedDeletion(itemId, logger);
    return;
  }
  if (outcome.outcome === 'not-deleted') {
    throw outcome.error ?? new SteamError(`Workshop item ${itemId} was not deleted`);
  }
  throw new IndeterminateOutcomeError(
    `The outcome of deleting Workshop item ${itemId} is indeterminate: the Steam library ${outcome.childEnd ?? 'did not report a result'}, and the item's state could not be confirmed.`,
    [
      `Check whether the item still exists: ducky steam info ${itemId}, or ducky steam list`,
      'Retry only after confirming the item still exists',
      'Exit code 2 means the outcome is indeterminate',
    ],
  );
}

/**
 * Delete a Workshop item with the Steam deletion isolated in a child process.
 * Order: title lookup session opened and closed, confirmation, child deletion, then (only after an
 * abnormal child end) a fresh verification session.
 * @throws {SteamError} When the user declines, the deletion is rejected or not started, or the item still exists
 * @throws {IndeterminateOutcomeError} When the item's state cannot be established
 */
export async function runDeleteIsolated(
  itemId: bigint,
  options: { yes: boolean; appId: number; confirm?: ConfirmDelete },
  deps: IsolatedDeleteDeps,
  logger: Logger,
): Promise<void> {
  if (!options.yes) {
    const title = await deps.withSession((client) => lookupTitle(client, itemId, logger));
    await confirmOrCancel(itemId, title, options);
  }

  const outcome = await runIsolatedDelete({
    itemId,
    childArgs: [String(options.appId), itemId.toString()],
    childScript: deps.childScript ?? DEFAULT_CHILD_SCRIPT,
    verify: () => deps.withSession((client) => verifyItemPresence(client, itemId)),
    spawn: deps.spawn,
    retryDelayMs: deps.retryDelayMs,
  });
  reportDeleteOutcome(itemId, outcome, logger);
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

      await runDeleteIsolated(
        BigInt(itemId),
        { yes: options.yes, appId },
        { withSession: (fn) => withSteamSession(appId, fn) },
        logger,
      );
    });
  });
}

export const steamDeleteCommand = createSteamDeleteCommand();
