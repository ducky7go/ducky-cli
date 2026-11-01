import { Command } from 'commander';
import { steamValidateCommand } from './validate.js';
import { steamPushCommand } from './push.js';
import { steamListCommand } from './list.js';
import { steamInfoCommand } from './info.js';
import { steamSubscribedCommand } from './subscribed.js';
import { steamLinkCommand } from './link.js';
import { steamPullCommand } from './pull.js';
import { steamDeleteCommand } from './delete.js';

export function registerSteamCommands(program: Command): void {
  // Create the steam namespace command
  const steamCommand = new Command('steam')
    .description('Steam Workshop publishing and management commands')
    .addHelpText(
      'beforeAll',
      `
Steam commands for publishing and managing game mods on Steam Workshop.

Examples:
  $ ducky steam validate ./mods/MyMod
  $ ducky steam push ./mods/MyMod
  $ ducky steam push ./mods/MyMod --update-description --changelog "Fixed bugs"
  $ ducky steam push ./mods/MyMod --dry-run --visibility friends --tags a,b
  $ ducky steam list
  $ ducky steam list --json
  $ ducky steam info ./mods/MyMod
  $ ducky steam info 1234567890 --json
  $ ducky steam subscribed
  $ ducky steam delete 1234567890 --yes
  $ ducky steam link ./mods/MyMod 1234567890
  $ ducky steam pull ./mods/MyMod --language schinese --language english
`,
    );

  // Register subcommands
  steamCommand.addCommand(steamValidateCommand);
  steamCommand.addCommand(steamPushCommand);
  steamCommand.addCommand(steamListCommand);
  steamCommand.addCommand(steamInfoCommand);
  steamCommand.addCommand(steamSubscribedCommand);
  steamCommand.addCommand(steamLinkCommand);
  steamCommand.addCommand(steamPullCommand);
  steamCommand.addCommand(steamDeleteCommand);

  program.addCommand(steamCommand);
}
