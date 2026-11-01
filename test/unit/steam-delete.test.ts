import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runDelete, ensureConfirmationPossible, type ConfirmDelete } from '../../src/commands/steam/delete.js';
import { parseWorkshopItemId } from '../../src/commands/steam/link.js';
import type { SteamWorkshopClient, RawWorkshopItem } from '../../src/formats/steam/query.js';
import { SteamError, ValidationError } from '../../src/utils/errors.js';
import { createLogger } from '../../src/utils/logger.js';

const item: RawWorkshopItem = {
  publishedFileId: 12345n,
  title: 'Doomed Mod',
  timeCreated: 0,
  timeUpdated: 0,
  visibility: 0,
};

function fakeClient(opts: { deleteError?: string; getItemFails?: boolean } = {}) {
  const deleted: bigint[] = [];
  const client: SteamWorkshopClient = {
    getUserItems: async () => ({ items: [], totalResults: 0 }),
    getItem: async () => {
      if (opts.getItemFails) throw new Error('lookup failed');
      return item;
    },
    getItems: async () => ({ items: [] }),
    getSubscribedItems: () => [],
    installInfo: () => null,
    deleteItem: async (id: bigint) => {
      if (opts.deleteError) throw new Error(opts.deleteError);
      deleted.push(id);
    },
    getAccountId: () => 42,
    isConnected: () => true,
  };
  return { client, deleted };
}

/** Collect the messages a logger prints (info/success go to console.log) */
function captureLogs() {
  const lines: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void lines.push(a.map(String).join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void lines.push(a.map(String).join(' ')));
  vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => void lines.push(a.map(String).join(' ')));
  return lines;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('steam delete', () => {
  it('--yes deletes without prompting and prints the confirmation and the reminder', async () => {
    const lines = captureLogs();
    const confirm = vi.fn<ConfirmDelete>(async () => true);
    const { client, deleted } = fakeClient();
    await runDelete(client, 12345n, { yes: true, confirm }, createLogger({}));
    expect(confirm).not.toHaveBeenCalled();
    expect(deleted).toEqual([12345n]);
    const text = lines.join('\n');
    expect(text).toContain('Deleted Workshop item 12345');
    expect(text).toContain('publishedFileId = 12345');
  });

  it('interactive confirmation with the exact ID deletes the item and shows the title to the prompt', async () => {
    captureLogs();
    const confirm = vi.fn<ConfirmDelete>(async () => true);
    const { client, deleted } = fakeClient();
    await runDelete(client, 12345n, { yes: false, confirm }, createLogger({}));
    expect(confirm).toHaveBeenCalledWith('12345', 'Doomed Mod');
    expect(deleted).toEqual([12345n]);
  });

  it('declining cancels with exit-worthy error and nothing is deleted', async () => {
    captureLogs();
    const confirm = vi.fn<ConfirmDelete>(async () => false);
    const { client, deleted } = fakeClient();
    const error = await runDelete(client, 12345n, { yes: false, confirm }, createLogger({})).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SteamError);
    expect((error as Error).message).toContain('Deletion cancelled');
    expect(deleted).toEqual([]);
  });

  it('a failed title lookup does not block the prompt', async () => {
    captureLogs();
    const confirm = vi.fn<ConfirmDelete>(async () => true);
    const { client, deleted } = fakeClient({ getItemFails: true });
    await runDelete(client, 12345n, { yes: false, confirm }, createLogger({}));
    expect(confirm).toHaveBeenCalledWith('12345', '(title unavailable)');
    expect(deleted).toEqual([12345n]);
  });

  it('non-interactive use without --yes fails before any Steam call', () => {
    expect(() => ensureConfirmationPossible(false, false)).toThrow(ValidationError);
    expect(() => ensureConfirmationPossible(false, false)).toThrow(/--yes is required/);
    expect(() => ensureConfirmationPossible(true, false)).not.toThrow();
    expect(() => ensureConfirmationPossible(false, true)).not.toThrow();
  });

  it('an invalid ID is rejected before Steam is contacted', () => {
    expect(() => parseWorkshopItemId('abc')).toThrow(ValidationError);
  });

  it('Steam rejection includes Steam\'s reason and suggestions', async () => {
    captureLogs();
    const { client } = fakeClient({ deleteError: 'not the owner' });
    const error = await runDelete(client, 12345n, { yes: true }, createLogger({})).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SteamError);
    expect((error as Error).message).toContain('not the owner');
    expect((error as SteamError).suggestions?.join(' ')).toContain('belongs to the signed-in Steam account');
  });

  it('no local file is changed by a deletion', async () => {
    captureLogs();
    const dir = mkdtempSync(join(tmpdir(), 'ducky-delete-'));
    try {
      const infoPath = join(dir, 'info.ini');
      writeFileSync(infoPath, 'name=X\nversion=1.0.0\npublishedFileId=12345\n');
      const before = readFileSync(infoPath);
      const { client } = fakeClient();
      await runDelete(client, 12345n, { yes: true }, createLogger({}));
      expect(readFileSync(infoPath).equals(before)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
