import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const spawnMock = vi.hoisted(() => vi.fn());
const steamworksInit = vi.hoisted(() => vi.fn());

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, spawn: spawnMock };
});

vi.mock('@ducky7go/steamworks.js', () => ({
  init: steamworksInit,
  shutdown: vi.fn(),
  isConnected: vi.fn(() => false),
}));

import { runSteamUploadInChildProcess } from '../../src/formats/steam/workshop.js';
import { steamPushAction } from '../../src/formats/steam/push-handler.js';
import { createLogger } from '../../src/utils/logger.js';
import { ValidationError } from '../../src/utils/errors.js';
import { SteamValidator } from '../../src/formats/steam/validator.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');

/** Fake child process that exits successfully on the next tick */
function fakeChild(code = 0) {
  const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; killed: boolean };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  setTimeout(() => child.emit('close', code), 0);
  return child;
}

describe('child process arguments and environment', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => fakeChild(0));
  });

  it('passes resolved App ID, visibility and tags to the child', async () => {
    await runSteamUploadInChildProcess(
      '/mods/A',
      { updateDescription: true, changelog: 'Fix', appId: 123, visibility: 'friends', tags: ['a', 'b'] },
      createLogger({}),
    );
    const [, args, opts] = spawnMock.mock.calls[0];
    expect(args.slice(1)).toEqual([
      '/mods/A',
      '--update-description',
      '--changelog',
      'Fix',
      '--visibility',
      'friends',
      '--tags-json',
      '["a","b"]',
    ]);
    expect(opts.env.STEAM_APP_ID).toBe('123');
  });

  it('is unchanged when the new options are absent', async () => {
    const before = process.env.STEAM_APP_ID;
    await runSteamUploadInChildProcess('/mods/A', { updateDescription: false }, createLogger({}));
    const [, args, opts] = spawnMock.mock.calls[0];
    expect(args.slice(1)).toEqual(['/mods/A']);
    expect(opts.env.STEAM_APP_ID).toBe(before);
  });
});

describe('--dry-run side effects and validation', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ducky-dry-'));
    spawnMock.mockReset();
    steamworksInit.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('never spawns the uploader or initializes Steamworks, and leaves info.ini byte-identical', async () => {
    const mod = join(root, 'mod');
    cpSync(join(fixtures, 'steam-described-mod'), mod, { recursive: true });
    const infoBefore = readFileSync(join(mod, 'info.ini'));

    await steamPushAction(mod, {
      updateDescription: true,
      changelog: 'Fix',
      skipTail: false,
      logger: createLogger({}),
      visibility: 'friends',
      tags: 'a,b',
      dryRun: true,
    });

    expect(spawnMock).not.toHaveBeenCalled();
    expect(steamworksInit).not.toHaveBeenCalled();
    expect(readFileSync(join(mod, 'info.ini')).equals(infoBefore)).toBe(true);
  });

  it('fails with the same validation error as validate when preview.png is missing', async () => {
    const mod = join(root, 'mod');
    cpSync(join(fixtures, 'steam-described-mod'), mod, { recursive: true });
    rmSync(join(mod, 'preview.png'));

    const validation = await new SteamValidator(createLogger({})).validate(mod, 3167020);
    expect(validation.isValid).toBe(false);
    const expected = validation.errors.map((e) => e.message);

    const error = await steamPushAction(mod, {
      updateDescription: false,
      logger: createLogger({}),
      dryRun: true,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    for (const message of expected) {
      expect((error as Error).message).toContain(message);
    }
    expect(spawnMock).not.toHaveBeenCalled();
    expect(steamworksInit).not.toHaveBeenCalled();
  });
});
