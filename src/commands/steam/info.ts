import { Command } from 'commander';
import { statSync } from 'fs';
import { withSteamSession, getWorkshopItem, type WorkshopItemSummary } from '../../formats/steam/query.js';
import { readPublishedFileId } from '../../formats/steam/parser.js';
import { SteamError, ValidationError } from '../../utils/errors.js';
import { runSteamAction, withCommonOptions, resolveCommandAppId, type SteamCommonOptions } from './shared.js';

/** Characters of description shown in the human-readable view */
export const DESCRIPTION_EXCERPT_LENGTH = 500;

/** Classified argument: a mod directory or a Workshop item ID */
export type InfoTarget =
  | { kind: 'directory'; path: string }
  | { kind: 'id'; id: bigint };

/**
 * Classify the argument of `steam info`.
 * An existing directory wins over a numeric name; then digits are an ID; anything else is an error.
 */
export function classifyInfoArgument(argument: string): InfoTarget {
  let isDirectory = false;
  try {
    isDirectory = statSync(argument).isDirectory();
  } catch {
    isDirectory = false;
  }
  if (isDirectory) {
    return { kind: 'directory', path: argument };
  }
  if (/^\d+$/.test(argument) && BigInt(argument) > 0n) {
    return { kind: 'id', id: BigInt(argument) };
  }
  throw new ValidationError(`Invalid argument "${argument}": expected a Workshop item ID or a mod directory`, [
    'Pass a numeric Workshop item ID, for example 1234567890',
    'Or pass a mod directory whose info.ini has publishedFileId',
  ]);
}

/** Human-readable view of one item */
function renderItem(item: WorkshopItemSummary): string {
  const excerpt =
    item.description.length > DESCRIPTION_EXCERPT_LENGTH
      ? `${item.description.slice(0, DESCRIPTION_EXCERPT_LENGTH)}…`
      : item.description;
  const lines = [
    `Title:       ${item.title}`,
    `ID:          ${item.id}`,
    `Visibility:  ${item.visibility}`,
    `Tags:        ${item.tags.length > 0 ? item.tags.join(', ') : '(none)'}`,
    `Owner:       ${item.owner ?? '-'}`,
    `Created:     ${item.timeCreated ?? '-'}`,
    `Updated:     ${item.timeUpdated ?? '-'}`,
    `Subscribers: ${item.subscribers}   Favorites: ${item.favorites}   Followers: ${item.followers}   Comments: ${item.comments}`,
    `Votes:       up ${item.upvotes}, down ${item.downvotes}`,
    `URL:         ${item.url}`,
    '',
    'Description:',
    excerpt || '(empty)',
  ];
  return lines.join('\n');
}

export function createSteamInfoCommand(): Command {
  return withCommonOptions(
  new Command('info')
    .description('Show details of a Workshop item (by ID or by mod directory)')
    .argument('<id|path>', 'Workshop item ID or mod directory whose info.ini has publishedFileId')
    .option('--json', 'Print the full item as one JSON document on stdout (logs go to stderr)', false),
).action(async (argument: string, options: SteamCommonOptions & { json?: boolean }) => {
  await runSteamAction({ verbose: options.verbose, stderr: options.json }, async (logger) => {
    const target = classifyInfoArgument(argument);

    let id: bigint;
    if (target.kind === 'directory') {
      const published = await readPublishedFileId(target.path);
      if (published === undefined) {
        throw new SteamError(`${target.path}/info.ini has no publishedFileId`, [
          `Publish the mod with: ducky steam push ${target.path}`,
          `Or attach an existing item with: ducky steam link ${target.path} <id>`,
        ]);
      }
      id = BigInt(published);
      logger.debug(`Resolved publishedFileId ${published} from ${target.path}/info.ini`);
    } else {
      id = target.id;
    }

    const { appId, source } = resolveCommandAppId(options.appId);
    logger.info(`Using Steam App ID: ${appId}`);
    logger.debug(`App ID source: ${source}`);

    const item = await withSteamSession(appId, (client) =>
      getWorkshopItem(client, id, { includeLongDescription: true }),
    );

    if (!item) {
      throw new SteamError(`Workshop item ${id} was not found`, [
        'Check the item ID',
        `Check that it belongs to App ID ${appId} (--app-id, STEAM_APP_ID or .duckyrc)`,
      ]);
    }

    if (options.json) {
      console.log(JSON.stringify(item, null, 2));
      return;
    }
    console.log(renderItem(item));
  });
});
}

export const steamInfoCommand = createSteamInfoCommand();
