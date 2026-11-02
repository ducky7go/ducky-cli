import { describe, it, expect, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import {
  withCommonOptions,
  runSteamAction,
  isStdinInteractive,
  exitCodeForError,
} from '../../src/commands/steam/shared.js';
import { ConfigError, IndeterminateOutcomeError, SteamError } from '../../src/utils/errors.js';

describe('steam shared command helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('withCommonOptions lists --app-id and -v, --verbose in help text', () => {
    const cmd = withCommonOptions(new Command('demo').argument('[path]', 'a path'));
    const help = cmd.helpInformation();
    expect(help).toContain('--app-id <id>');
    expect(help).toContain('-v, --verbose');
  });

  it('withCommonOptions parses --app-id and --verbose', () => {
    const cmd = withCommonOptions(new Command('demo'));
    let captured: unknown;
    cmd.action((opts) => {
      captured = opts;
    });
    cmd.parse(['--app-id', '123', '-v'], { from: 'user' });
    expect(captured).toEqual({ appId: '123', verbose: true });
  });

  it('runSteamAction prints a DuckyError through the logger and exits with code 1', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await runSteamAction({ verbose: false }, async () => {
      throw new ConfigError('Something is wrong', ['Fix it']);
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const printed = errSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(printed).toContain('Something is wrong');
    expect(printed).toContain('Fix it');
  });

  it('runSteamAction exits with code 2 for an indeterminate outcome', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await runSteamAction({ verbose: false }, async () => {
      throw new IndeterminateOutcomeError('The outcome is unknown', ['Check the item']);
    });

    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('exitCodeForError maps indeterminate to 2 and every other error to 1', () => {
    expect(exitCodeForError(new IndeterminateOutcomeError('unknown'))).toBe(2);
    expect(exitCodeForError(new SteamError('rejected'))).toBe(1);
    expect(exitCodeForError(new ConfigError('bad'))).toBe(1);
    expect(exitCodeForError('plain string')).toBe(1);
  });

  it('runSteamAction does not exit when the body succeeds', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    await runSteamAction({ verbose: false }, async () => {});
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('isStdinInteractive reflects process.stdin.isTTY', () => {
    const original = process.stdin.isTTY;
    try {
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
      expect(isStdinInteractive()).toBe(true);
      Object.defineProperty(process.stdin, 'isTTY', { value: undefined, configurable: true });
      expect(isStdinInteractive()).toBe(false);
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { value: original, configurable: true });
    }
  });
});
