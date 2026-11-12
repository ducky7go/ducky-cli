import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { mkdtempSync, cpSync, rmSync, readFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const hoisted = vi.hoisted(() => ({
  spawn: vi.fn(),
  steamInit: vi.fn(),
  steamCreateItem: vi.fn(),
}));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, spawn: hoisted.spawn };
});

vi.mock('@hagicode/steamworks.js', () => ({
  init: hoisted.steamInit,
  isConnected: () => false,
  shutdown: () => {},
}));

import {
  SteamNotRunningError,
  SteamLibraryError,
  SteamAgreementError,
  WORKSHOP_AGREEMENT_URL,
} from '../../src/utils/errors.js';
import { Logger, createLogger } from '../../src/utils/logger.js';

describe('Steam error types', () => {
  it('SteamNotRunningError has the dedicated message and actionable suggestions', () => {
    const err = new SteamNotRunningError();
    expect(err.message).toBe('Steam is not running or you are not logged in');
    expect(err.code).toBe('STEAM_NOT_RUNNING');
    expect(err.suggestions?.length).toBeGreaterThan(0);
    const text = err.format();
    expect(text).toContain('Steam is not running or you are not logged in');
    expect(text).toContain('Suggestions:');
    expect(text).toContain('Start the Steam client and log in');
  });

  it('SteamLibraryError names the underlying reason and differs from the not-running message', () => {
    const err = new SteamLibraryError('dlopen failed');
    expect(err.message).toContain('The Steamworks library failed to load');
    expect(err.message).toContain('dlopen failed');
    expect(err.message).not.toBe(new SteamNotRunningError().message);
    expect(err.code).toBe('STEAM_LIBRARY_ERROR');
  });

  it('SteamAgreementError includes the Workshop agreement URL in its suggestions', () => {
    expect(WORKSHOP_AGREEMENT_URL).toBe('https://steamcommunity.com/sharedfiles/workshoplegalagreement');
    const err = new SteamAgreementError();
    expect(err.suggestions?.join('\n')).toContain(WORKSHOP_AGREEMENT_URL);
    expect(err.format()).toContain(WORKSHOP_AGREEMENT_URL);
  });

  it('custom suggestions override the defaults', () => {
    const saved = process.env.CI;
    delete process.env.CI;
    try {
      const err = new SteamNotRunningError('custom', ['only this']);
      expect(err.message).toBe('custom');
      expect(err.suggestions).toEqual(['only this']);
    } finally {
      if (saved !== undefined) process.env.CI = saved;
    }
  });
});

describe('stderr logger mode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes no output to console.log when stderr mode is enabled', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = new Logger({ verbose: true, stderr: true });

    logger.debug('debug line');
    logger.info('info line');
    logger.success('success line');
    logger.blank();
    logger.header('title');

    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
  });

  it('keeps normal console.log output when stderr mode is not enabled', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger({});
    logger.info('hello');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});

import {
  runSteamUploadInChildProcess,
} from '../../src/formats/steam/workshop.js';
import { SteamConfigError, CI_STEAM_HINT } from '../../src/utils/errors.js';
import { steamPushActionInternal } from '../../src/formats/steam/upload-standalone.js';
import { SteamValidator } from '../../src/formats/steam/validator.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');

/** Fake child process: optional stdout and stderr, then exit with a code */
function fakeChild(code: number, stdout = '', stderr = '') {
  const emitter = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; killed: boolean };
  emitter.stdout = new EventEmitter();
  emitter.stderr = new EventEmitter();
  emitter.killed = false;
  setTimeout(() => {
    if (stdout) emitter.stdout.emit('data', Buffer.from(stdout));
    if (stderr) emitter.stderr.emit('data', Buffer.from(stderr));
    emitter.emit('close', code);
  }, 0);
  return emitter;
}

describe('upload child exit codes and agreement warning', () => {
  const savedCi = process.env.CI;
  beforeEach(() => {
    hoisted.spawn.mockReset();
    delete process.env.CI;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (savedCi === undefined) delete process.env.CI;
    else process.env.CI = savedCi;
  });

  it('exit code 2 maps to the Steam-not-running error', async () => {
    hoisted.spawn.mockImplementation(() => fakeChild(2));
    const error = await runSteamUploadInChildProcess('/m', { updateDescription: false }, createLogger({})).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SteamNotRunningError);
    expect((error as Error).message).toBe('Steam is not running or you are not logged in');
  });

  it('exit code 3 maps to a library error that names the reason and differs from not-running', async () => {
    hoisted.spawn.mockImplementation(() => fakeChild(3, '', 'dlopen failed'));
    const error = await runSteamUploadInChildProcess('/m', { updateDescription: false }, createLogger({})).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SteamConfigError);
    expect((error as Error).message).toContain('The Steamworks library failed to load: dlopen failed');
    expect((error as Error).message).not.toContain('not running');
  });

  it('other failures keep the generic upload error', async () => {
    hoisted.spawn.mockImplementation(() => fakeChild(1));
    await expect(runSteamUploadInChildProcess('/m', { updateDescription: false }, createLogger({}))).rejects.toThrow(
      /exited with code 1/,
    );
  });

  it('the CI hint is added only when CI is truthy', async () => {
    hoisted.spawn.mockImplementation(() => fakeChild(2));
    const withoutCi = await runSteamUploadInChildProcess('/m', { updateDescription: false }, createLogger({})).catch((e: unknown) => e);
    expect((withoutCi as Error & { suggestions?: string[] }).suggestions).not.toContain(CI_STEAM_HINT);

    process.env.CI = 'true';
    hoisted.spawn.mockImplementation(() => fakeChild(2));
    const withCi = await runSteamUploadInChildProcess('/m', { updateDescription: false }, createLogger({})).catch((e: unknown) => e);
    expect((withCi as Error & { suggestions?: string[] }).suggestions).toContain(CI_STEAM_HINT);
    expect(CI_STEAM_HINT).toContain('ducky steam validate');
    expect(CI_STEAM_HINT).toContain('ducky steam push --dry-run');
  });

  it('the agreement warning resolves the upload as needing attention', async () => {
    hoisted.spawn.mockImplementation(() => fakeChild(0, '[WARN] AGREEMENT_REQUIRED: accept it\n'));
    expect(await runSteamUploadInChildProcess('/m', { updateDescription: false }, createLogger({}))).toEqual({
      needsAttention: true,
    });
    hoisted.spawn.mockImplementation(() => fakeChild(0, '[INFO] done\n'));
    expect(await runSteamUploadInChildProcess('/m', { updateDescription: false }, createLogger({}))).toEqual({
      needsAttention: false,
    });
  });
});

describe('initialization failure in the upload child', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ducky-init-fail-'));
    hoisted.steamInit.mockReset();
    hoisted.steamInit.mockImplementation(() => {
      throw new Error('SteamAPI_Init failed');
    });
    hoisted.steamCreateItem.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('creates no item and leaves info.ini byte-identical when Steam cannot be initialized', async () => {
    const mod = join(root, 'mod');
    cpSync(join(fixtures, 'steam-valid-mod'), mod, { recursive: true });
    const before = readFileSync(join(mod, 'info.ini'));

    const error = await steamPushActionInternal(mod, { updateDescription: false }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SteamNotRunningError);
    expect(hoisted.steamInit).toHaveBeenCalled();
    expect(hoisted.steamCreateItem).not.toHaveBeenCalled();
    expect(readFileSync(join(mod, 'info.ini')).equals(before)).toBe(true);
  });
});

describe('validate never loads Steamworks', () => {
  const savedCi = process.env.CI;
  beforeEach(() => {
    hoisted.steamInit.mockReset();
    process.env.CI = 'true';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (savedCi === undefined) delete process.env.CI;
    else process.env.CI = savedCi;
  });

  it('validation passes on a valid mod with CI=true and the Steam module untouched', async () => {
    const result = await new SteamValidator(createLogger({})).validate(join(fixtures, 'steam-valid-mod'), 3167020);
    expect(result.isValid).toBe(true);
    expect(hoisted.steamInit).not.toHaveBeenCalled();
  });

  it('validation fails for an invalid mod without touching Steam', async () => {
    const result = await new SteamValidator(createLogger({})).validate(join(fixtures, 'does-not-exist'), 3167020);
    expect(result.isValid).toBe(false);
    expect(hoisted.steamInit).not.toHaveBeenCalled();
  });
});
