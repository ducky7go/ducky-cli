/**
 * Isolated Workshop deletion.
 *
 * The Steam deletion runs in a child process, so a native abort or fatal signal in the Steam
 * library cannot end the command before it reports an outcome. The parent reads the child's
 * structured result line. If the child ended abnormally (signal, unexpected exit, or an unknown
 * Steam result), the parent checks the item in its own fresh Steam session and classifies the
 * outcome as confirmed, not deleted, or indeterminate.
 *
 * This file is both the parent runner and the child entry point:
 *   node isolated-delete.js <appId> <itemId>
 */

import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { DuckyError, SteamError } from '../../utils/errors.js';
import {
  isUnknownOutcomeReason,
  rejectionError,
  withSteamSession,
  type ItemPresence,
  type SteamWorkshopClient,
} from './query.js';

/** Prefix of the single line the child writes on stdout with its result */
export const RESULT_PREFIX = 'DUCKY_DELETE_RESULT ';
/** Verification queries per abnormal exit; a 'present' answer may be Steam propagation delay */
export const VERIFY_ATTEMPTS = 3;
/** Pause between verification queries */
export const VERIFY_RETRY_DELAY_MS = 1000;

/** What the child reports about its own deletion attempt */
export type ChildResult =
  | { status: 'deleted' }
  | { status: 'rejected'; reason: string }
  | { status: 'unknown-result'; reason: string }
  | { status: 'not-started'; message: string; suggestions?: string[] };

/** How a child ended without a usable result */
export interface AbnormalExit {
  /** Signal name such as SIGABRT, or null when the child exited by code */
  signal: string | null;
  /** Exit code, or null when the child was killed by a signal */
  code: number | null;
}

/** What the parent observed about the child process */
export type ChildOutcome =
  | { kind: 'result'; result: ChildResult }
  | { kind: 'abnormal'; exit: AbnormalExit }
  | { kind: 'spawn-failed'; reason: string };

/**
 * Final result of a delete.
 * - confirmed: the item is gone (Steam accepted, or verification found it absent)
 * - not-deleted: Steam rejected it, nothing was attempted, or verification found it present
 * - indeterminate: the item's state could not be established
 */
export interface DeleteOutcome {
  outcome: 'confirmed' | 'not-deleted' | 'indeterminate';
  /** Whether a deletion request was sent to Steam */
  attempted: boolean;
  /** How the child ended, when it did not report a normal result */
  childEnd?: string;
  /** Verification answer, when verification ran */
  presence?: ItemPresence;
  /** Error to report for a not-deleted outcome */
  error?: SteamError;
}

/** Minimal child-process surface the parent uses, so tests can inject a fake */
export type Spawner = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

/** Parse the last result line from the child's stdout; undefined when there is none */
export function parseResultLine(stdout: string): ChildResult | undefined {
  const lines = stdout.split('\n').map((line) => line.trim()).filter((line) => line.startsWith(RESULT_PREFIX));
  const last = lines[lines.length - 1];
  if (!last) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(last.slice(RESULT_PREFIX.length)) as ChildResult;
    switch (parsed.status) {
      case 'deleted':
        return parsed;
      case 'rejected':
      case 'unknown-result':
        return typeof parsed.reason === 'string' ? parsed : undefined;
      case 'not-started':
        return typeof parsed.message === 'string' ? parsed : undefined;
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

/** True when the parent must query Steam before it can classify the outcome */
export function needsVerification(child: ChildOutcome): boolean {
  return (
    child.kind === 'abnormal' ||
    (child.kind === 'result' && child.result.status === 'unknown-result')
  );
}

/** Human-readable account of how the child ended, for the output */
export function describeChildEnd(child: ChildOutcome): string {
  if (child.kind === 'abnormal') {
    const { signal, code } = child.exit;
    if (signal) {
      return `ended by signal ${signal}`;
    }
    return code === null
      ? 'ended without reporting a result'
      : `exited with code ${code} without reporting a result`;
  }
  if (child.kind === 'result' && child.result.status === 'unknown-result') {
    return `reported an unrecognised Steam result: ${child.result.reason}`;
  }
  return 'did not report a normal result';
}

/**
 * Classify the outcome of a delete from the child's observed end and, when needed, the
 * verification answer. Pure: no process or Steam access.
 * A missing verification answer is treated as 'unknown'.
 */
export function classifyOutcome(
  child: ChildOutcome,
  itemId: bigint,
  presence?: ItemPresence,
): DeleteOutcome {
  if (child.kind === 'spawn-failed') {
    return {
      outcome: 'not-deleted',
      attempted: false,
      error: new SteamError(`Could not start the deletion process: ${child.reason}`, [
        'No deletion was attempted; check that Node.js can run and try again',
      ]),
    };
  }

  if (child.kind === 'result') {
    const result = child.result;
    if (result.status === 'deleted') {
      return { outcome: 'confirmed', attempted: true };
    }
    if (result.status === 'rejected') {
      return { outcome: 'not-deleted', attempted: true, error: rejectionError(itemId, result.reason) };
    }
    if (result.status === 'not-started') {
      return {
        outcome: 'not-deleted',
        attempted: false,
        error: new SteamError(result.message, result.suggestions),
      };
    }
  }

  // Abnormal exit, or an unknown Steam result: the item's state must be checked
  const childEnd = describeChildEnd(child);
  const answer = presence ?? 'unknown';
  if (answer === 'absent') {
    return { outcome: 'confirmed', attempted: true, childEnd, presence: answer };
  }
  if (answer === 'present') {
    return {
      outcome: 'not-deleted',
      attempted: true,
      childEnd,
      presence: answer,
      error: new SteamError(
        `Workshop item ${itemId} was not deleted: the Steam library ${childEnd}, and the item still exists on Steam`,
        [
          'Wait a moment, then check with: ducky steam info <id>',
          'Retry the deletion only if the item still exists',
        ],
      ),
    };
  }
  return { outcome: 'indeterminate', attempted: true, childEnd, presence: answer };
}

/** Run the spawner and collect the child's end; never throws */
function runChild(
  spawner: Spawner,
  script: string,
  args: string[],
): Promise<ChildOutcome> {
  return new Promise((resolveChild) => {
    let child: ChildProcess;
    try {
      child = spawner(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolveChild({ kind: 'spawn-failed', reason: reasonOf(error) });
      return;
    }

    let stdout = '';
    child.stdout?.on('data', (data: Buffer | string) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', () => {
      // Native stderr can contain panic text; it is deliberately not shown to users
    });

    let settled = false;
    child.on('error', (error: Error) => {
      // Before a process id exists, the child never started and nothing was attempted
      if (!settled && typeof child.pid !== 'number') {
        settled = true;
        resolveChild({ kind: 'spawn-failed', reason: error.message });
      }
    });
    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) {
        return;
      }
      settled = true;
      const result = parseResultLine(stdout);
      if (result && signal === null) {
        resolveChild({ kind: 'result', result });
      } else {
        resolveChild({ kind: 'abnormal', exit: { signal: signal ?? null, code: code ?? null } });
      }
    });
  });
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/**
 * Ask Steam whether the item exists, retrying a bounded number of times.
 * Stops early on 'absent'; otherwise returns the last answer.
 */
async function verifyWithRetries(
  verify: () => Promise<ItemPresence>,
  attempts: number,
  delayMs: number,
): Promise<ItemPresence> {
  let answer: ItemPresence = 'unknown';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      answer = await verify();
    } catch {
      // Steam unreachable (for example not running) is inconclusive, never 'absent'
      answer = 'unknown';
    }
    if (answer === 'absent') {
      return answer;
    }
    if (attempt < attempts) {
      await sleep(delayMs);
    }
  }
  return answer;
}

export interface IsolatedDeleteOptions {
  itemId: bigint;
  /** Arguments for the child entry point after the script path (App ID and item ID) */
  childArgs: string[];
  /** Path of this module's compiled JavaScript, run as the child */
  childScript: string;
  /** Checks the item in a fresh Steam session; called only after an abnormal child end */
  verify: () => Promise<ItemPresence>;
  spawn?: Spawner;
  verifyAttempts?: number;
  retryDelayMs?: number;
}

/**
 * Run a Workshop deletion in a child process and return the verified outcome.
 * `verify` is called only when the child ended abnormally or reported an unknown result.
 */
export async function runIsolatedDelete(options: IsolatedDeleteOptions): Promise<DeleteOutcome> {
  const spawner = options.spawn ?? (nodeSpawn as unknown as Spawner);
  const child = await runChild(spawner, options.childScript, options.childArgs);

  if (!needsVerification(child)) {
    return classifyOutcome(child, options.itemId);
  }

  const presence = await verifyWithRetries(
    options.verify,
    options.verifyAttempts ?? VERIFY_ATTEMPTS,
    options.retryDelayMs ?? VERIFY_RETRY_DELAY_MS,
  );
  return classifyOutcome(child, options.itemId, presence);
}

/**
 * Child entry point: delete one item in this process and write one result line to stdout.
 * Resolves to the process exit code: 0 when deleted, 1 otherwise.
 */
export async function runDeleteChild(appId: number, itemId: bigint): Promise<number> {
  const result = await deleteInSession(appId, itemId);
  return new Promise((done) => {
    process.stdout.write(`${RESULT_PREFIX}${JSON.stringify(result)}\n`, () =>
      done(result.status === 'deleted' ? 0 : 1),
    );
  });
}

async function deleteInSession(appId: number, itemId: bigint): Promise<ChildResult> {
  let result: ChildResult | undefined;
  try {
    await withSteamSession(appId, async (client: SteamWorkshopClient) => {
      try {
        await client.deleteItem(itemId);
        result = { status: 'deleted' };
      } catch (error) {
        const reason = reasonOf(error);
        result = isUnknownOutcomeReason(reason)
          ? { status: 'unknown-result', reason }
          : { status: 'rejected', reason };
      }
    });
  } catch (error) {
    const suggestions = error instanceof DuckyError ? error.suggestions : undefined;
    return { status: 'not-started', message: reasonOf(error), suggestions };
  }
  return result ?? { status: 'not-started', message: 'Steam did not run the deletion' };
}

/** True when this module is the script Node was asked to run */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url);
}

if (isEntryPoint()) {
  const appId = Number(process.argv[2]);
  const itemIdText = process.argv[3] ?? '';
  if (!Number.isInteger(appId) || appId <= 0 || !/^\d+$/.test(itemIdText)) {
    process.stdout.write(
      `${RESULT_PREFIX}${JSON.stringify({ status: 'not-started', message: 'Invalid arguments for the delete process' })}\n`,
      () => process.exit(1),
    );
  } else {
    runDeleteChild(appId, BigInt(itemIdText)).then((code) => process.exit(code));
  }
}
