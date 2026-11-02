/**
 * Shared wiring for `ducky steam` subcommands:
 * common options (--app-id, -v/--verbose), uniform error handling and TTY detection.
 */

import type { Command } from 'commander';
import { Logger, createLogger } from '../../utils/logger.js';
import { DuckyError, IndeterminateOutcomeError } from '../../utils/errors.js';
import {
  readAppIdSourcesFromEnvironment,
  resolveSteamAppId,
  type ResolvedAppId,
} from '../../formats/steam/config.js';

/**
 * Options every Steam subcommand accepts
 */
export interface SteamCommonOptions {
  appId?: string;
  verbose: boolean;
}

/**
 * Add `--app-id <id>` and `-v, --verbose` to a Steam subcommand.
 * Applied per subcommand so the options appear in each subcommand's own help.
 */
export function withCommonOptions(command: Command): Command {
  return command
    .option('--app-id <id>', 'Steam App ID (overrides STEAM_APP_ID and .duckyrc)')
    .option('-v, --verbose', 'Enable verbose output', false);
}

/**
 * Options for running an action
 */
export interface RunSteamActionOptions {
  verbose: boolean;
  /** Send every non-error line to stderr (for --json output on stdout) */
  stderr?: boolean;
}

/**
 * Exit code for a failed Steam command: 2 for an indeterminate outcome, 1 for everything else
 */
export function exitCodeForError(error: unknown): number {
  return error instanceof IndeterminateOutcomeError ? error.exitCode : 1;
}

/**
 * Run a Steam subcommand body with a fresh logger.
 * DuckyError (and any other error) is printed through the logger and the process exits with code 1,
 * or with code 2 for an indeterminate outcome (see exitCodeForError).
 * The body may set process.exitCode itself for partial failures.
 */
export async function runSteamAction(
  options: RunSteamActionOptions,
  body: (logger: Logger) => Promise<void>,
): Promise<void> {
  const logger = createLogger({ verbose: options.verbose, stderr: options.stderr });
  try {
    await body(logger);
  } catch (error) {
    if (error instanceof DuckyError) {
      logger.error(error);
    } else {
      logger.error(error instanceof Error ? error : String(error));
    }
    process.exit(exitCodeForError(error));
  }
}

/**
 * True when standard input is an interactive terminal (used before prompting)
 */
export function isStdinInteractive(): boolean {
  return Boolean(process.stdin.isTTY);
}

/**
 * Resolve the App ID for a command: --app-id > STEAM_APP_ID > .duckyrc > default.
 * @throws {ConfigError} When the chosen value is not a positive integer
 */
export function resolveCommandAppId(cliAppId?: string): ResolvedAppId {
  return resolveSteamAppId(readAppIdSourcesFromEnvironment(cliAppId));
}

/**
 * Render rows as a plain-text table with aligned columns
 */
export function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );
  const format = (cells: string[]) =>
    cells.map((c, i) => (c ?? '').padEnd(widths[i])).join('  ').trimEnd();
  const lines = [format(headers), widths.map((w) => '-'.repeat(w)).join('  ')];
  for (const row of rows) {
    lines.push(format(row));
  }
  return lines.join('\n');
}
