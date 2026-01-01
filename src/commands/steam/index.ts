import { Command } from 'commander';
import { steamValidateCommand } from './validate.js';
import { steamPushCommand } from './push.js';

export function registerSteamCommands(program: Command): void {
  // Create the steam namespace command
  const steamCommand = new Command('steam')
    .description('Steam Workshop publishing commands')
    .addHelpText(
      'beforeAll',
      `
Steam commands for publishing game mods to Steam Workshop.

Examples:
  $ ducky steam validate ./mods/MyMod
  $ ducky steam push ./mods/MyMod
  $ ducky steam push ./mods/MyMod --update-description --changelog "Fixed bugs"
`,
    );

  // Register subcommands
  steamCommand.addCommand(steamValidateCommand);
  steamCommand.addCommand(steamPushCommand);

  program.addCommand(steamCommand);
}
