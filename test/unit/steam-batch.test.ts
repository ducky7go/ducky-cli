import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { mkdtempSync, cpSync, rmSync, mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, spawn: spawnMock };
});

import { steamPushMany, renderBatchSummary } from '../../src/formats/steam/push-handler.js';
import { createLogger } from '../../src/utils/logger.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');

/** Child process that prints optional stdout, then exits with the given code */
function child(code: number, stdoutText?: string) {
  const emitter = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; killed: boolean };
  emitter.stdout = new EventEmitter();
  emitter.stderr = new EventEmitter();
  emitter.killed = false;
  setTimeout(() => {
    if (stdoutText) {
      emitter.stdout.emit('data', Buffer.from(stdoutText));
    }
    emitter.emit('close', code);
  }, 0);
  return emitter;
}

/** Name of the mod directory a spawn call was made for */
function modOf(call: unknown[]): string {
  const args = call[1] as string[];
  return args[1];
}

describe('steam push with several directories', () => {
  let root: string;
  let logs: string[];

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ducky-batch-'));
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => child(0));
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  function mod(name: string): string {
    const dir = join(root, name);
    cpSync(join(fixtures, 'steam-valid-mod'), dir, { recursive: true });
    return dir;
  }

  it('a failing directory does not stop the others, and the result is failed for it only', async () => {
    const a = mod('A');
    const b = join(root, 'B');
    mkdirSync(b); // no info.ini: the plan cannot be built, so B fails
    const c = mod('C');

    const results = await steamPushMany([a, b, c], {
      updateDescription: false,
      logger: createLogger({}),
    });

    expect(results.map((r) => [r.path, r.status])).toEqual([
      [a, 'ok'],
      [b, 'failed'],
      [c, 'ok'],
    ]);
    expect(results[1].message).toMatch(/info\.ini/);
    // Uploads ran for A and C only
    expect(spawnMock.mock.calls.map(modOf)).toEqual([a, c]);
    // Exit code 1 when any entry failed
    expect(results.some((r) => r.status === 'failed')).toBe(true);
  });

  it('all successful directories give no failed entry (exit 0)', async () => {
    const results = await steamPushMany([mod('A'), mod('C')], {
      updateDescription: false,
      logger: createLogger({}),
    });
    expect(results.every((r) => r.status === 'ok')).toBe(true);
  });

  it('a non-directory argument is reported as failed and the rest still run', async () => {
    const a = mod('A');
    const file = join(root, 'readme.txt');
    writeFileSync(file, 'x');
    const results = await steamPushMany([a, file], { updateDescription: false, logger: createLogger({}) });
    expect(results.map((r) => r.status)).toEqual(['ok', 'failed']);
    expect(results[1].message).toBe('not a mod directory');
  });

  it('shared options apply to every directory', async () => {
    const a = mod('A');
    const c = mod('C');
    await steamPushMany([a, c], {
      updateDescription: false,
      changelog: 'Fix',
      visibility: 'private',
      logger: createLogger({}),
    });
    for (const call of spawnMock.mock.calls) {
      const args = call[1] as string[];
      expect(args).toContain('--visibility');
      expect(args[args.indexOf('--visibility') + 1]).toBe('private');
      expect(args[args.indexOf('--changelog') + 1]).toBe('Fix');
    }
  });

  it('a directory that needs the agreement is listed as needing attention in the summary', async () => {
    spawnMock.mockImplementation(() => child(0, '[WARN] AGREEMENT_REQUIRED: accept it\n'));
    const results = await steamPushMany([mod('A')], { updateDescription: false, logger: createLogger({}) });
    expect(results[0].status).toBe('ok-needs-attention');
  });

  it('the summary lists counts and one line per directory', async () => {
    const logger = createLogger({});
    renderBatchSummary(
      [
        { path: 'A', status: 'ok' },
        { path: 'B', status: 'failed', message: 'boom' },
        { path: 'C', status: 'ok-needs-attention' },
      ],
      logger,
    );
    const text = logs.join('\n');
    expect(text).toContain('Summary: 1 succeeded, 1 need attention, 1 failed');
    expect(text).toContain('B: boom');
  });
});
