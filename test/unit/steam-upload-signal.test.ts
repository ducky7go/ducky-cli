import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

const hoisted = vi.hoisted(() => ({ spawn: vi.fn() }));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, spawn: hoisted.spawn };
});

import { runSteamUploadInChildProcess } from '../../src/formats/steam/workshop.js';
import { SteamUploadError } from '../../src/utils/errors.js';
import { createLogger } from '../../src/utils/logger.js';

/** Child that ends with the given exit code (null for a signal) and signal */
function endedChild(code: number | null, signal: NodeJS.Signals | null): EventEmitter {
  const emitter = new EventEmitter() as EventEmitter & Record<string, unknown>;
  emitter.stdout = new EventEmitter();
  emitter.stderr = new EventEmitter();
  emitter.killed = false;
  setTimeout(() => emitter.emit('close', code, signal), 0);
  return emitter;
}

describe('upload child ended by signal', () => {
  beforeEach(() => {
    hoisted.spawn.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names the signal and says the publish outcome is unverified, as an upload error', async () => {
    hoisted.spawn.mockImplementation(() => endedChild(null, 'SIGABRT'));
    const error = await runSteamUploadInChildProcess('/m', { updateDescription: false }, createLogger({})).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SteamUploadError);
    const message = (error as Error).message;
    expect(message).toContain('SIGABRT');
    expect(message).toContain('publish outcome is unverified');
    expect(message).not.toContain('exited with code null');
    expect((error as SteamUploadError).suggestions?.join('\n')).toContain('ducky steam info <id>');
  });

  it('a normal non-zero exit keeps the generic message', async () => {
    hoisted.spawn.mockImplementation(() => endedChild(1, null));
    await expect(runSteamUploadInChildProcess('/m', { updateDescription: false }, createLogger({}))).rejects.toThrow(
      /exited with code 1/,
    );
  });
});
