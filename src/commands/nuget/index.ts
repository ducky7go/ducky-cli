import { Command } from 'commander';
import { nugetPackCommand } from './pack.js';
import { nugetPushCommand } from './push.js';
import { nugetValidateCommand } from './validate.js';

export function registerNuGetCommands(program: Command): void {
  // Create the nuget namespace command
  const nugetCommand = new Command('nuget')
    .description('NuGet package format commands')
    .addHelpText(
      'beforeAll',
      `
NuGet commands for packaging and publishing game mods.

Examples:
  $ ducky nuget pack ./mods/MyMod
  $ ducky nuget push ./mods/MyMod.nupkg
  $ ducky nuget validate ./mods/MyMod
`,
    );

  // Register subcommands (T19: Create command registry)
  nugetCommand.addCommand(nugetPackCommand);
  nugetCommand.addCommand(nugetPushCommand);
  nugetCommand.addCommand(nugetValidateCommand);

  program.addCommand(nugetCommand);
}
