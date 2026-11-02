import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const realWrapper = join(here, '..', '..', 'bin', 'ducky');

/**
 * Build a throwaway copy of the wrapper whose dist/cli.js is the given stub body.
 * The copy gets its own package.json so the ESM wrapper loads as a module.
 */
function makeWrapper(stubBody: string): { root: string; wrapper: string } {
  const root = mkdtempSync(join(tmpdir(), 'ducky-wrapper-'));
  mkdirSync(join(root, 'bin'));
  mkdirSync(join(root, 'dist'));
  writeFileSync(join(root, 'package.json'), '{"type":"module"}');
  copyFileSync(realWrapper, join(root, 'bin', 'ducky'));
  writeFileSync(join(root, 'dist', 'cli.js'), stubBody);
  return { root, wrapper: join(root, 'bin', 'ducky') };
}

function runWrapper(stubBody: string): { status: number | null; signal: NodeJS.Signals | null } {
  const { root, wrapper } = makeWrapper(stubBody);
  try {
    const result = spawnSync(process.execPath, [wrapper], { encoding: 'utf8', timeout: 20000 });
    return { status: result.status, signal: result.signal };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('bin/ducky exit status', () => {
  it('passes a normal exit code through unchanged', () => {
    expect(runWrapper('process.exit(3);').status).toBe(3);
  });

  it('passes exit code 0 through as success', () => {
    expect(runWrapper('process.exit(0);').status).toBe(0);
  });

  it('turns a child killed by SIGTERM into a nonzero status (128 + 15)', () => {
    const outcome = runWrapper("process.kill(process.pid, 'SIGTERM'); setTimeout(() => {}, 5000);");
    expect(outcome.signal).toBeNull();
    expect(outcome.status).toBe(128 + 15);
  });

  it('turns a child killed by SIGABRT into a nonzero status (128 + 6)', () => {
    const outcome = runWrapper("process.kill(process.pid, 'SIGABRT'); setTimeout(() => {}, 5000);");
    expect(outcome.status).toBe(128 + 6);
  });
});
