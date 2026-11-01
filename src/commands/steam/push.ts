import { Command } from 'commander';
import {
  steamPushAction,
  steamPushMany,
  renderBatchSummary,
  type PushOptions,
} from '../../formats/steam/push-handler.js';
import { runSteamAction, withCommonOptions } from './shared.js';

interface PushCliOptions {
  updateDescription: boolean;
  changelog?: string;
  skipTail: boolean;
  verbose: boolean;
  appId?: string;
  visibility?: string;
  tags?: string;
  dryRun: boolean;
}

export const steamPushCommand = withCommonOptions(
  new Command('push')
    .description('Push one or more mod directories to Steam Workshop')
    .argument('<paths...>', 'Path(s) to mod directories; several are published in order')
    .option('--update-description', 'Update Workshop descriptions from description/*.md files', false)
    .option('--changelog <note>', 'Update changelog notes for this update')
    .option('--skip-tail', 'Skip appending submission footer to description and changelog', false)
    .option(
      '--visibility <name>',
      'Item visibility: public, friends, private or unlisted (default: .duckyrc or public)',
    )
    .option('--tags <list>', 'Comma-separated Workshop tags (overrides info.ini tags and .duckyrc)')
    .option('--dry-run', 'Preview the publication without contacting Steam or changing files', false),
).action(async (paths: string[], options: PushCliOptions) => {
  await runSteamAction({ verbose: options.verbose }, async (logger) => {
    const pushOptions: PushOptions = {
      updateDescription: options.updateDescription,
      changelog: options.changelog,
      skipTail: options.skipTail,
      appId: options.appId,
      visibility: options.visibility,
      tags: options.tags,
      dryRun: options.dryRun,
      logger,
    };

    // A single path keeps the original flow and output
    if (paths.length === 1) {
      await steamPushAction(paths[0], pushOptions);
      if (options.dryRun) {
        logger.success('Dry run complete: nothing was published');
      } else {
        logger.success('Mod published to Steam Workshop successfully!');
      }
      process.exit(0);
    }

    // Several paths: each is independent; exit 1 if any failed
    const results = await steamPushMany(paths, pushOptions);
    renderBatchSummary(results, logger);
    const failed = results.some((r) => r.status === 'failed');
    if (options.dryRun) {
      logger.success('Dry run complete: nothing was published');
    }
    process.exit(failed ? 1 : 0);
  });
});
