import { Command } from 'commander';
import { withSteamSession, listPublishedItems, type WorkshopItemSummary } from '../../formats/steam/query.js';
import { runSteamAction, withCommonOptions, renderTable, resolveCommandAppId, type SteamCommonOptions } from './shared.js';

interface ListOptions extends SteamCommonOptions {
  json?: boolean;
  stats?: boolean;
}

/** JSON shape of one listed item (IDs as strings, ISO timestamps, visibility names) */
function toListJson(item: WorkshopItemSummary) {
  return {
    id: item.id,
    title: item.title,
    visibility: item.visibility,
    timeUpdated: item.timeUpdated,
    subscribers: item.subscribers,
    favorites: item.favorites,
    followers: item.followers,
    comments: item.comments,
    upvotes: item.upvotes,
    downvotes: item.downvotes,
    tags: item.tags,
    url: item.url,
  };
}

export function createSteamListCommand(): Command {
  return withCommonOptions(
  new Command('list')
    .description('List your published Steam Workshop items for an App ID')
    .option('--json', 'Print one JSON document on stdout (logs go to stderr)', false)
    .option('--stats', 'Also show favorites, followers, comments and votes'),
).action(async (options: ListOptions) => {
  await runSteamAction({ verbose: options.verbose, stderr: options.json }, async (logger) => {
    const { appId, source } = resolveCommandAppId(options.appId);
    logger.info(`Using Steam App ID: ${appId}`);
    logger.debug(`App ID source: ${source}`);

    const result = await withSteamSession(appId, (client) => {
      logger.debug(`Account ID: ${client.getAccountId()}`);
      return listPublishedItems(client, appId, {
        onPage: (page, entries) => logger.debug(`Fetched page ${page} (${entries} entries)`),
      });
    });

    if (result.truncated) {
      logger.warn('Stopped after 1000 pages; the list may be incomplete');
    }

    if (options.json) {
      console.log(JSON.stringify({ appId, items: result.items.map(toListJson) }, null, 2));
      return;
    }

    if (result.items.length === 0) {
      logger.info(`No published items were found for App ID ${appId}`);
      return;
    }

    const headers = ['ID', 'Title', 'Visibility', 'Updated', 'Subscribers'];
    if (options.stats) {
      headers.push('Favorites', 'Followers', 'Comments', 'Votes (up/down)');
    }
    const rows = result.items.map((item) => {
      const row = [
        item.id,
        item.title,
        item.visibility,
        item.timeUpdated ?? '-',
        String(item.subscribers),
      ];
      if (options.stats) {
        row.push(
          String(item.favorites),
          String(item.followers),
          String(item.comments),
          `${item.upvotes}/${item.downvotes}`,
        );
      }
      return row;
    });
    console.log(renderTable(headers, rows));
    logger.blank();
    logger.info(`${result.items.length} item(s)`);
  });
});
}

export const steamListCommand = createSteamListCommand();
