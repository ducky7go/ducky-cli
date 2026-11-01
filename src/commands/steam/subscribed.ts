import { Command } from 'commander';
import { withSteamSession, listSubscribedItems } from '../../formats/steam/query.js';
import { runSteamAction, withCommonOptions, renderTable, resolveCommandAppId, type SteamCommonOptions } from './shared.js';

interface SubscribedOptions extends SteamCommonOptions {
  json?: boolean;
}

export function createSteamSubscribedCommand(): Command {
  return withCommonOptions(
  new Command('subscribed')
    .description('List Workshop items you are subscribed to, with local install status')
    .option('--json', 'Print one JSON document on stdout (logs go to stderr)', false),
).action(async (options: SubscribedOptions) => {
  await runSteamAction({ verbose: options.verbose, stderr: options.json }, async (logger) => {
    const { appId, source } = resolveCommandAppId(options.appId);
    logger.info(`Using Steam App ID: ${appId}`);
    logger.debug(`App ID source: ${source}`);

    const items = await withSteamSession(appId, (client) => listSubscribedItems(client));

    if (options.json) {
      console.log(JSON.stringify({ appId, items }, null, 2));
      return;
    }

    if (items.length === 0) {
      logger.info('You have no subscribed items for this App ID');
      return;
    }

    const rows = items.map((item) => [
      item.id,
      item.title,
      item.installed ? 'installed' : 'not installed',
      item.folder ?? '-',
      item.sizeOnDisk !== undefined ? `${item.sizeOnDisk} bytes` : '-',
    ]);
    console.log(renderTable(['ID', 'Title', 'Status', 'Folder', 'Size on disk'], rows));
    logger.blank();
    logger.info(`${items.length} subscribed item(s)`);
  });
});
}

export const steamSubscribedCommand = createSteamSubscribedCommand();
