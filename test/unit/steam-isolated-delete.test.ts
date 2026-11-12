import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

const hoisted = vi.hoisted(() => ({
  steamInit: vi.fn(),
}));

vi.mock('@hagicode/steamworks.js', () => ({
  init: hoisted.steamInit,
  isConnected: () => true,
  shutdown: () => {},
}));

import {
  RESULT_PREFIX,
  classifyOutcome,
  parseResultLine,
  runDeleteChild,
  runIsolatedDelete,
  type ChildOutcome,
  type ChildResult,
  type Spawner,
} from '../../src/formats/steam/isolated-delete.js';
import {
  deleteWorkshopItem,
  verifyItemPresence,
  type SteamWorkshopClient,
  type RawWorkshopItem,
} from '../../src/formats/steam/query.js';
import {
  runDeleteIsolated,
  DEFAULT_CHILD_SCRIPT,
  type IsolatedDeleteDeps,
} from '../../src/commands/steam/delete.js';
import { exitCodeForError } from '../../src/commands/steam/shared.js';
import {
  IndeterminateOutcomeError,
  SteamError,
  SteamNotRunningError,
} from '../../src/utils/errors.js';
import { createLogger } from '../../src/utils/logger.js';

const ITEM = 12345n;
const item: RawWorkshopItem = { publishedFileId: ITEM, title: 'Doomed Mod', timeCreated: 0, timeUpdated: 0, visibility: 0 };

interface FakeEnd {
  stdout?: string;
  code?: number | null;
  signal?: NodeJS.Signals | null;
  spawnError?: string;
}

/** A child-process stand-in that emits its output and end on the next tick */
function fakeChild(end: FakeEnd): ChildProcess {
  const emitter = new EventEmitter() as EventEmitter & Record<string, unknown>;
  emitter.stdout = new EventEmitter();
  emitter.stderr = new EventEmitter();
  emitter.pid = end.spawnError ? undefined : 4242;
  setImmediate(() => {
    if (end.spawnError) {
      emitter.emit('error', new Error(end.spawnError));
      return;
    }
    if (end.stdout) {
      (emitter.stdout as EventEmitter).emit('data', Buffer.from(end.stdout));
    }
    emitter.emit('close', end.code ?? null, end.signal ?? null);
  });
  return emitter as unknown as ChildProcess;
}

/** Spawner that records each call's arguments and the order of spawning */
function recordingSpawner(end: FakeEnd, events: string[] = []) {
  const calls: Array<{ command: string; args: string[] }> = [];
  const spawn: Spawner = (command, args) => {
    calls.push({ command, args });
    events.push('spawn');
    return fakeChild(end);
  };
  return { spawn, calls, events };
}

function resultLine(result: ChildResult): string {
  return `${RESULT_PREFIX}${JSON.stringify(result)}\n`;
}

function fakeClient(opts: { getItem?: () => Promise<RawWorkshopItem | null | undefined>; connected?: boolean; deleteError?: string } = {}) {
  const client: SteamWorkshopClient = {
    getUserItems: async () => ({ items: [], totalResults: 0 }),
    getItem: opts.getItem ?? (async () => item),
    getItems: async () => ({ items: [] }),
    getSubscribedItems: () => [],
    installInfo: () => null,
    deleteItem: async () => {
      if (opts.deleteError) throw new Error(opts.deleteError);
    },
    getAccountId: () => 42,
    isConnected: () => opts.connected ?? true,
  };
  return client;
}

/** Collect printed lines (logger writes to console) */
function captureLogs() {
  const lines: string[] = [];
  const sink = (...a: unknown[]) => void lines.push(a.map(String).join(' '));
  vi.spyOn(console, 'log').mockImplementation(sink);
  vi.spyOn(console, 'error').mockImplementation(sink);
  vi.spyOn(console, 'warn').mockImplementation(sink);
  return lines;
}

const silentLogger = () => createLogger({});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseResultLine', () => {
  it('reads the last result line and ignores native output around it', () => {
    const stdout = `native noise\n${resultLine({ status: 'rejected', reason: 'old' })}more noise\n${resultLine({ status: 'deleted' })}`;
    expect(parseResultLine(stdout)).toEqual({ status: 'deleted' });
  });

  it('returns undefined when there is no usable result line', () => {
    expect(parseResultLine('')).toBeUndefined();
    expect(parseResultLine('just logs\n')).toBeUndefined();
    expect(parseResultLine(`${RESULT_PREFIX}{not json`)).toBeUndefined();
    expect(parseResultLine(`${RESULT_PREFIX}${JSON.stringify({ status: 'weird' })}`)).toBeUndefined();
  });
});

describe('classifyOutcome (pure table)', () => {
  const abort: ChildOutcome = { kind: 'abnormal', exit: { signal: 'SIGABRT', code: null } };
  const unknownResult: ChildOutcome = { kind: 'result', result: { status: 'unknown-result', reason: 'unknown Steam result 1234' } };

  it.each([
    ['child reports deleted', { kind: 'result', result: { status: 'deleted' } } as ChildOutcome, undefined, 'confirmed'],
    ['normal exit with a Steam rejection', { kind: 'result', result: { status: 'rejected', reason: 'not the owner' } } as ChildOutcome, undefined, 'not-deleted'],
    ['steam not started in the child', { kind: 'result', result: { status: 'not-started', message: 'Steam is not running or you are not logged in' } } as ChildOutcome, undefined, 'not-deleted'],
    ['child cannot be spawned', { kind: 'spawn-failed', reason: 'ENOENT' } as ChildOutcome, undefined, 'not-deleted'],
    ['abort, item absent', abort, 'absent', 'confirmed'],
    ['abort, item present', abort, 'present', 'not-deleted'],
    ['abort, verification inconclusive', abort, 'unknown', 'indeterminate'],
    ['abort, no verification answer', abort, undefined, 'indeterminate'],
    ['unknown result, item absent', unknownResult, 'absent', 'confirmed'],
    ['unknown result, item present', unknownResult, 'present', 'not-deleted'],
    ['unknown result, inconclusive', unknownResult, 'unknown', 'indeterminate'],
  ] as const)('%s -> %s', (_name, child, presence, expected) => {
    expect(classifyOutcome(child, ITEM, presence).outcome).toBe(expected);
  });

  it('a Steam rejection is not deleted and never triggers verification', () => {
    const outcome = classifyOutcome({ kind: 'result', result: { status: 'rejected', reason: 'not the owner' } }, ITEM);
    expect(outcome.attempted).toBe(true);
    expect(outcome.presence).toBeUndefined();
    expect(outcome.error?.message).toContain('was not deleted');
    expect(outcome.error?.message).toContain('not the owner');
  });

  it('a spawn failure is not deleted and says no deletion was attempted', () => {
    const outcome = classifyOutcome({ kind: 'spawn-failed', reason: 'ENOENT' }, ITEM);
    expect(outcome.attempted).toBe(false);
    expect(outcome.error?.message).toContain('Could not start the deletion process');
  });
});

describe('verifyItemPresence', () => {
  it('reports present when Steam returns the item', async () => {
    expect(await verifyItemPresence(fakeClient(), ITEM)).toBe('present');
  });

  it('reports absent when Steam has no such item', async () => {
    expect(await verifyItemPresence(fakeClient({ getItem: async () => null }), ITEM)).toBe('absent');
  });

  it('reports unknown when the query errors, never absent', async () => {
    const client = fakeClient({
      getItem: async () => {
        throw new Error('query failed');
      },
    });
    expect(await verifyItemPresence(client, ITEM)).toBe('unknown');
  });

  it('reports unknown when Steam is not connected', async () => {
    expect(await verifyItemPresence(fakeClient({ connected: false, getItem: async () => null }), ITEM)).toBe('unknown');
  });
});

describe('runIsolatedDelete with an injected spawner', () => {
  const childScript = '/dist/formats/steam/isolated-delete.js';

  it('normal success: confirmed, child arguments passed, no verification', async () => {
    const { spawn, calls } = recordingSpawner({ stdout: resultLine({ status: 'deleted' }), code: 0 });
    const verify = vi.fn(async () => 'present' as const);
    const outcome = await runIsolatedDelete({ itemId: ITEM, childArgs: ['3167020', '12345'], childScript, verify, spawn });
    expect(outcome.outcome).toBe('confirmed');
    expect(verify).not.toHaveBeenCalled();
    expect(calls[0]).toEqual({ command: process.execPath, args: [childScript, '3167020', '12345'] });
  });

  it('normal Steam rejection: not deleted, exit path without verification', async () => {
    const { spawn } = recordingSpawner({ stdout: resultLine({ status: 'rejected', reason: 'not the owner' }), code: 1 });
    const verify = vi.fn(async () => 'present' as const);
    const outcome = await runIsolatedDelete({ itemId: ITEM, childArgs: [], childScript, verify, spawn });
    expect(outcome.outcome).toBe('not-deleted');
    expect(outcome.error?.message).toContain('not the owner');
    expect(verify).not.toHaveBeenCalled();
  });

  it('abort by signal: verification finds the item absent, so confirmed, and names the signal', async () => {
    const { spawn } = recordingSpawner({ code: null, signal: 'SIGABRT' });
    const verify = vi.fn(async () => 'absent' as const);
    const outcome = await runIsolatedDelete({ itemId: ITEM, childArgs: [], childScript, verify, spawn, retryDelayMs: 0 });
    expect(outcome.outcome).toBe('confirmed');
    expect(outcome.childEnd).toContain('SIGABRT');
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('unexpected exit without a result: verification decides', async () => {
    const { spawn } = recordingSpawner({ code: 1, stdout: 'native log only\n' });
    const verify = vi.fn(async () => 'present' as const);
    const outcome = await runIsolatedDelete({ itemId: ITEM, childArgs: [], childScript, verify, spawn, retryDelayMs: 0 });
    expect(outcome.outcome).toBe('not-deleted');
    expect(outcome.childEnd).toContain('exited with code 1 without reporting a result');
    expect(outcome.error?.message).toContain('still exists');
  });

  it('spawn failure: not deleted, nothing attempted, no verification', async () => {
    const { spawn } = recordingSpawner({ spawnError: 'spawn node ENOENT' });
    const verify = vi.fn(async () => 'absent' as const);
    const outcome = await runIsolatedDelete({ itemId: ITEM, childArgs: [], childScript, verify, spawn });
    expect(outcome.outcome).toBe('not-deleted');
    expect(outcome.attempted).toBe(false);
    expect(verify).not.toHaveBeenCalled();
  });

  it('retries a present answer up to the bound and stops early on absent', async () => {
    const { spawn } = recordingSpawner({ signal: 'SIGKILL', code: null });
    const answers = ['present', 'unknown', 'absent'] as const;
    const verify = vi.fn(async () => answers[verify.mock.calls.length - 1]);
    const outcome = await runIsolatedDelete({ itemId: ITEM, childArgs: [], childScript, verify, spawn, retryDelayMs: 0 });
    expect(outcome.outcome).toBe('confirmed');
    expect(verify).toHaveBeenCalledTimes(3);
  });

  it('gives up after the bound when the item stays present', async () => {
    const { spawn } = recordingSpawner({ signal: 'SIGKILL', code: null });
    const verify = vi.fn(async () => 'present' as const);
    const outcome = await runIsolatedDelete({ itemId: ITEM, childArgs: [], childScript, verify, spawn, retryDelayMs: 0 });
    expect(outcome.outcome).toBe('not-deleted');
    expect(verify).toHaveBeenCalledTimes(3);
  });

  it('a verification that throws counts as unknown, so the outcome is indeterminate', async () => {
    const { spawn } = recordingSpawner({ signal: 'SIGABRT', code: null });
    const verify = vi.fn(async () => {
      throw new SteamNotRunningError();
    });
    const outcome = await runIsolatedDelete({ itemId: ITEM, childArgs: [], childScript, verify, spawn, retryDelayMs: 0, verifyAttempts: 2 });
    expect(outcome.outcome).toBe('indeterminate');
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('an unknown Steam result from the child is verified rather than reported as a rejection', async () => {
    const { spawn } = recordingSpawner({ stdout: resultLine({ status: 'unknown-result', reason: 'unknown Steam result 1234' }), code: 1 });
    const verify = vi.fn(async () => 'absent' as const);
    const outcome = await runIsolatedDelete({ itemId: ITEM, childArgs: [], childScript, verify, spawn, retryDelayMs: 0 });
    expect(outcome.outcome).toBe('confirmed');
    expect(outcome.childEnd).toContain('1234');
  });
});

describe('command flow: session order, output and exit codes', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  /** Session recorder: each withSession call records open and close in order */
  function recordingSessions(client: SteamWorkshopClient, events: string[], failFrom?: number) {
    let opened = 0;
    const deps: IsolatedDeleteDeps['withSession'] = async (fn) => {
      opened += 1;
      if (failFrom !== undefined && opened >= failFrom) {
        events.push('open-failed');
        throw new SteamNotRunningError();
      }
      events.push('open');
      try {
        return await fn(client);
      } finally {
        events.push('close');
      }
    };
    return deps;
  }

  it('abnormal exit: title lookup closed before spawn, verification opened only after the child ended', async () => {
    const events: string[] = [];
    const client = fakeClient({ getItem: async () => null });
    const { spawn } = recordingSpawner({ signal: 'SIGABRT', code: null }, events);
    const lines = captureLogs();

    await runDeleteIsolated(
      ITEM,
      { yes: false, appId: 3167020, confirm: async () => true },
      { withSession: recordingSessions(client, events), spawn, retryDelayMs: 0 },
      silentLogger(),
    );

    expect(events).toEqual(['open', 'close', 'spawn', 'open', 'close']);
    expect(lines.join('\n')).toContain('Deleted Workshop item 12345');
    expect(lines.join('\n')).toContain('SIGABRT');
  });

  it('an unreachable Steam at verification time gives indeterminate with exit code 2', async () => {
    const events: string[] = [];
    const client = fakeClient();
    const { spawn } = recordingSpawner({ signal: 'SIGABRT', code: null }, events);
    captureLogs();

    const error = await runDeleteIsolated(
      ITEM,
      { yes: true, appId: 3167020 },
      { withSession: recordingSessions(client, events, 1), spawn, retryDelayMs: 0 },
      silentLogger(),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(IndeterminateOutcomeError);
    expect(exitCodeForError(error)).toBe(2);
    expect(events).toEqual(['spawn', 'open-failed', 'open-failed', 'open-failed']);
  });

  it('confirmed text stays unchanged and exits 0', async () => {
    const lines = captureLogs();
    const { spawn } = recordingSpawner({ stdout: resultLine({ status: 'deleted' }), code: 0 });
    await runDeleteIsolated(ITEM, { yes: true, appId: 1 }, { withSession: async (fn) => fn(fakeClient()), spawn }, silentLogger());
    const text = lines.join('\n');
    expect(text).toContain('Deleted Workshop item 12345');
    expect(text).toContain('publishedFileId = 12345');
  });

  it('not deleted prints a not-deleted message and exits 1, without the success text', async () => {
    const lines = captureLogs();
    const { spawn } = recordingSpawner({ stdout: resultLine({ status: 'rejected', reason: 'not the owner' }), code: 1 });
    const error = await runDeleteIsolated(ITEM, { yes: true, appId: 1 }, { withSession: async (fn) => fn(fakeClient()), spawn }, silentLogger()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SteamError);
    expect(exitCodeForError(error)).toBe(1);
    expect((error as Error).message).toContain('was not deleted');
    expect(lines.join('\n')).not.toContain('Deleted Workshop item');
  });

  it('Steam not running in the child keeps its readable message and exits 1', async () => {
    captureLogs();
    const { spawn } = recordingSpawner({
      stdout: resultLine({ status: 'not-started', message: 'Steam is not running or you are not logged in', suggestions: ['Start the Steam client and log in'] }),
      code: 1,
    });
    const error = await runDeleteIsolated(ITEM, { yes: true, appId: 1 }, { withSession: async (fn) => fn(fakeClient()), spawn }, silentLogger()).catch((e: unknown) => e);
    expect((error as Error).message).toBe('Steam is not running or you are not logged in');
    expect(exitCodeForError(error)).toBe(1);
  });

  it('indeterminate names the check steps and exits 2', async () => {
    captureLogs();
    const { spawn } = recordingSpawner({ signal: 'SIGABRT', code: null });
    const error = await runDeleteIsolated(
      ITEM,
      { yes: true, appId: 1 },
      { withSession: async (fn) => fn(fakeClient({ getItem: async () => { throw new Error('offline'); } })), spawn, retryDelayMs: 0 },
      silentLogger(),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IndeterminateOutcomeError);
    expect(exitCodeForError(error)).toBe(2);
    const suggestions = ((error as IndeterminateOutcomeError).suggestions ?? []).join('\n');
    expect(suggestions).toContain('ducky steam info 12345');
    expect(suggestions).toContain('ducky steam list');
    expect((error as Error).message).not.toContain('panicked');
  });

  it('the child script defaults to the compiled sibling module', () => {
    expect(DEFAULT_CHILD_SCRIPT.endsWith('formats/steam/isolated-delete.js')).toBe(true);
  });
});

describe('deleteWorkshopItem readable unknown-outcome errors (4.7)', () => {
  it('an unrecognised result names the number and suggests verification', async () => {
    const client = fakeClient({ deleteError: 'unknown Steam result 1234' });
    const error = await deleteWorkshopItem(client, ITEM).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SteamError);
    expect((error as Error).message).toContain('1234');
    expect((error as Error).message).toContain('unknown');
    expect((error as SteamError).suggestions?.join('\n')).toContain('ducky steam info 12345');
    expect((error as Error).message).not.toMatch(/panicked|unreachable|stack/i);
  });

  it('a lost completion is reported as an unknown outcome, not a rejection', async () => {
    const client = fakeClient({ deleteError: 'completion was not received; the outcome is unknown' });
    const error = await deleteWorkshopItem(client, ITEM).catch((e: unknown) => e);
    expect((error as Error).message).toContain('unknown');
    expect((error as Error).message).not.toContain('rejected');
    expect((error as Error).message).not.toMatch(/panicked|unreachable/i);
  });

  it('an ordinary Steam rejection still says it was not deleted', async () => {
    const client = fakeClient({ deleteError: 'not the owner' });
    const error = await deleteWorkshopItem(client, ITEM).catch((e: unknown) => e);
    expect((error as Error).message).toContain('was not deleted');
    expect((error as Error).message).toContain('not the owner');
  });
});

describe('runDeleteChild (child entry point)', () => {
  const apiDeleteItem = vi.fn();

  beforeEach(() => {
    apiDeleteItem.mockReset();
    hoisted.steamInit.mockReset();
    hoisted.steamInit.mockImplementation(() => ({
      workshop: { deleteItem: apiDeleteItem },
      localplayer: { getSteamId: () => ({ accountId: 42 }) },
    }));
  });

  function captureStdout() {
    const chunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array, cb?: () => void) => {
      chunks.push(String(chunk));
      cb?.();
      return true;
    }) as typeof process.stdout.write);
    return chunks;
  }

  it('writes a deleted result and returns 0 when Steam accepts', async () => {
    apiDeleteItem.mockResolvedValue(undefined);
    const chunks = captureStdout();
    expect(await runDeleteChild(3167020, ITEM)).toBe(0);
    expect(parseResultLine(chunks.join(''))).toEqual({ status: 'deleted' });
  });

  it('writes an unknown-result report when the native error names an unknown result', async () => {
    apiDeleteItem.mockRejectedValue(new Error('unknown Steam result 1234'));
    const chunks = captureStdout();
    expect(await runDeleteChild(3167020, ITEM)).toBe(1);
    expect(parseResultLine(chunks.join(''))).toEqual({ status: 'unknown-result', reason: 'unknown Steam result 1234' });
  });

  it('writes a rejection when Steam rejects, and not-started when Steam cannot run', async () => {
    apiDeleteItem.mockRejectedValue(new Error('not the owner'));
    const chunks = captureStdout();
    expect(await runDeleteChild(3167020, ITEM)).toBe(1);
    expect(parseResultLine(chunks.join(''))).toEqual({ status: 'rejected', reason: 'not the owner' });

    hoisted.steamInit.mockImplementation(() => {
      throw new Error('init failed');
    });
    const notStarted = captureStdout();
    expect(await runDeleteChild(3167020, ITEM)).toBe(1);
    expect(parseResultLine(notStarted.join(''))?.status).toBe('not-started');
  });
});
