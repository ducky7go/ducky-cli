#!/usr/bin/env node
import { Command } from 'commander';
import { registerNuGetCommands } from './commands/nuget/index.js';
import { registerSteamCommands } from './commands/steam/index.js';

// Create the main program
const program = new Command();

program
  .name('ducky')
  .description('CLI tool for packaging and publishing game mods')
  .version('0.1.0');

// Register format namespaces
registerNuGetCommands(program);
registerSteamCommands(program);

// Future formats can be registered here:
// registerZipCommands(program);
// registerTarCommands(program);

// Parse arguments
program.parse(process.argv);

// Export for testing
export { program };
