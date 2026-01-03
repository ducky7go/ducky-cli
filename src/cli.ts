#!/usr/bin/env node
import { Command } from 'commander';
import { registerNuGetCommands } from './commands/nuget/index.js';
import { registerSteamCommands } from './commands/steam/index.js';
import { getVersion } from './utils/version.js';

// Initialize CLI with dynamic version
async function main() {
  // Create the main program
  const program = new Command();

  // Get version from package.json
  const version = await getVersion();

  program
    .name('ducky')
    .description('CLI tool for packaging and publishing game mods')
    .version(version);

  // Register format namespaces
  registerNuGetCommands(program);
  registerSteamCommands(program);

  // Future formats can be registered here:
  // registerZipCommands(program);
  // registerTarCommands(program);

  // Parse arguments
  program.parse(process.argv);

  // Export for testing
  return { program };
}

// Export for testing
export const { program } = await main();
