import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const steam = vi.hoisted(() => ({
  initMode: 'ok' as 'ok' | 'throw' | 'null',
  connected: true,
  api: null as unknown,
  shutdown: null as unknown,
}));

vi.mock('@hagicode/steamworks.js', () => ({
  init: (_appId?: number) => {
    if (steam.initMode === 'throw') throw new Error('SteamAPI_Init failed');
    if (steam.initMode === 'null') return null;
    return steam.api;
  },
  isConnected: () => steam.connected,
  shutdown: () => (steam.shutdown as () => void)(),
}));

import {
  listPublishedItems,
  getWorkshopItem,
  listSubscribedItems,
  deleteWorkshopItem,
  withSteamSession,
  toWorkshopItemSummary,
  type SteamWorkshopClient,
  type RawWorkshopItem,
} from '../../src/formats/steam/query.js';
import { SteamError, SteamLibraryError, SteamNotRunningError } from '../../src/utils/errors.js';
import { createSteamListCommand } from '../../src/commands/steam/list.js';
import { createSteamInfoCommand, classifyInfoArgument } from '../../src/commands/steam/info.js';
import { createSteamSubscribedCommand } from '../../src/commands/steam/subscribed.js';
import { ValidationError } from '../../src/utils/errors.js';

function raw(id: bigint, title: string, overrides: Partial<RawWorkshopItem> = {}): RawWorkshopItem {
  return {
    publishedFileId: id,
    title,
    description: `Description of ${title}`,
    owner: { steamId64: 76561198000000000n, accountId: 42 },
    timeCreated: 1700000000,
    timeUpdated: 1700000100,
    visibility: 1,
    tags: ['Weapons'],
    numUpvotes: 3,
    numDownvotes: 1,
    statistics: { numSubscriptions: 5n, numFavorites: 2n, numFollowers: 1n, numComments: 4n },
    ...overrides,
  };
}

/** Fake client for direct function tests */
function fakeClient(partial: Partial<SteamWorkshopClient>): SteamWorkshopClient {
  return {
    getUserItems: async () => ({ items: [], totalResults: 0 }),
    getItem: async () => null,
    getItems: async () => ({ items: [] }),
    getSubscribedItems: () => [],
    installInfo: () => null,
    deleteItem: async () => {},
    getAccountId: () => 42,
    isConnected: () => true,
    ...partial,
  };
}

describe('listPublishedItems', () => {
  it('follows pagination until totalResults and returns every item', async () => {
    const pages = [
      { items: [raw(1n, 'A'), raw(2n, 'B')], totalResults: 3 },
      { items: [raw(3n, 'C')], totalResults: 3 },
    ];
    const client = fakeClient({
      getUserItems: async (page) => pages[page - 1] ?? { items: [], totalResults: 3 },
    });
    const result = await listPublishedItems(client, 3167020);
    expect(result.items.map((i) => i.id)).toEqual(['1', '2', '3']);
    expect(result.pages).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it('returns an empty list for an account with no items', async () => {
    const client = fakeClient({ getUserItems: async () => ({ items: [], totalResults: 0 }) });
    const result = await listPublishedItems(client, 3167020);
    expect(result.items).toEqual([]);
  });

  it('skips null and undefined entries', async () => {
    const client = fakeClient({
      getUserItems: async () => ({ items: [null, raw(7n, 'Kept'), undefined], totalResults: 3 }),
    });
    const result = await listPublishedItems(client, 3167020);
    expect(result.items.map((i) => i.title)).toEqual(['Kept']);
  });

  it('stops at the 1000-page cap and reports truncation', async () => {
    const client = fakeClient({
      getUserItems: async () => ({ items: [raw(9n, 'Loop')], totalResults: 1_000_000 }),
    });
    const result = await listPublishedItems(client, 3167020);
    expect(result.truncated).toBe(true);
    expect(result.items).toHaveLength(1000);
  });

  it('passes the App ID for creator and consumer', async () => {
    const calls: unknown[][] = [];
    const client = fakeClient({
      getUserItems: async (...args: unknown[]) => {
        calls.push(args);
        return { items: [], totalResults: 0 };
      },
    });
    await listPublishedItems(client, 555);
    expect(calls[0]).toEqual([1, 42, 0, 0, 3, { creator: 555, consumer: 555 }]);
  });
});

describe('item conversion and lookup', () => {
  it('converts IDs to strings, times to ISO and visibility to names', () => {
    const summary = toWorkshopItemSummary(raw(123n, 'X', { visibility: 3 }));
    expect(summary.id).toBe('123');
    expect(summary.visibility).toBe('unlisted');
    expect(summary.timeUpdated).toBe(new Date(1700000100 * 1000).toISOString());
    expect(summary.subscribers).toBe(5);
    expect(summary.owner).toBe('76561198000000000');
  });

  it('falls back to the community URL when Steam returns an empty URL', () => {
    const summary = toWorkshopItemSummary(raw(77n, 'NoUrl', { url: '' }));
    expect(summary.url).toBe('https://steamcommunity.com/sharedfiles/filedetails/?id=77');
  });

  it('getWorkshopItem returns null when Steam has no item', async () => {
    const client = fakeClient({ getItem: async () => null });
    expect(await getWorkshopItem(client, 99999999n)).toBeNull();
  });
});

describe('listSubscribedItems', () => {
  it('reports installed and not-installed items with titles', async () => {
    const client = fakeClient({
      getSubscribedItems: () => [1n, 2n],
      getItems: async () => ({ items: [raw(1n, 'Installed'), raw(2n, 'Missing')] }),
      installInfo: (id) =>
        id === 1n ? { folder: '/steam/1', sizeOnDisk: 2048n, timestamp: 1700000200 } : null,
    });
    const items = await listSubscribedItems(client);
    expect(items[0]).toMatchObject({ id: '1', title: 'Installed', installed: true, folder: '/steam/1', sizeOnDisk: 2048 });
    expect(items[1]).toMatchObject({ id: '2', title: 'Missing', installed: false });
    expect(items[1].folder).toBeUndefined();
  });

  it('returns an empty list when there are no subscriptions', async () => {
    expect(await listSubscribedItems(fakeClient({}))).toEqual([]);
  });

  it('batches title lookups in chunks of 100', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => BigInt(i + 1));
    const batches: number[] = [];
    const client = fakeClient({
      getSubscribedItems: () => ids,
      getItems: async (chunk) => {
        batches.push(chunk.length);
        return { items: chunk.map((id) => raw(id, `T${id}`)) };
      },
    });
    const items = await listSubscribedItems(client);
    expect(batches).toEqual([100, 50]);
    expect(items).toHaveLength(150);
  });
});

describe('deleteWorkshopItem', () => {
  it('includes Steam\'s rejection reason in the error', async () => {
    const client = fakeClient({
      deleteItem: async () => {
        throw new Error('not owner');
      },
    });
    await expect(deleteWorkshopItem(client, 5n)).rejects.toBeInstanceOf(SteamError);
    await expect(deleteWorkshopItem(client, 5n)).rejects.toThrow(/not owner/);
  });
});

describe('error classification in withSteamSession', () => {
  it('reports a library load failure distinctly', async () => {
    await expect(
      withSteamSession(1, async () => 0, async () => {
        throw new SteamLibraryError('dlopen failed');
      }),
    ).rejects.toThrow(/Steamworks library failed to load: dlopen failed/);
  });

  it('reports init failure as Steam not running', async () => {
    steam.initMode = 'throw';
    try {
      await expect(withSteamSession(1, async () => 0)).rejects.toBeInstanceOf(SteamNotRunningError);
    } finally {
      steam.initMode = 'ok';
    }
  });

  it('reports a disconnected client as Steam not running', async () => {
    steam.connected = false;
    try {
      const error = await withSteamSession(1, async () => 0).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(SteamNotRunningError);
      expect((error as Error).message).toBe('Steam is not running or you are not logged in');
    } finally {
      steam.connected = true;
    }
  });
});

/** Fake Steamworks API used by the command tests */
function setupApi(opts: {
  pages?: Array<{ items: Array<RawWorkshopItem | null>; totalResults: number }>;
  items?: Map<bigint, RawWorkshopItem>;
  subscribed?: bigint[];
  installed?: Map<bigint, { folder: string; sizeOnDisk: bigint; timestamp: number }>;
}) {
  const pages = opts.pages ?? [];
  const items = opts.items ?? new Map<bigint, RawWorkshopItem>();
  steam.api = {
    workshop: {
      getUserItems: async (page: number) => pages[page - 1] ?? { items: [], totalResults: 0 },
      getItem: async (id: bigint) => items.get(id) ?? null,
      getItems: async (ids: bigint[]) => ({ items: ids.map((id) => items.get(id)) }),
      getSubscribedItems: () => opts.subscribed ?? [],
      installInfo: (id: bigint) => opts.installed?.get(id) ?? null,
      deleteItem: async () => {},
    },
    localplayer: { getSteamId: () => ({ accountId: 42, steamId64: 1n, steamId32: 'x' }) },
  };
}

describe('commands end to end (mocked Steamworks)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let root: string;
  const savedAppId = process.env.STEAM_APP_ID;

  beforeEach(() => {
    steam.initMode = 'ok';
    steam.connected = true;
    steam.shutdown = vi.fn();
    delete process.env.STEAM_APP_ID;
    root = mkdtempSync(join(tmpdir(), 'ducky-query-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
    if (savedAppId === undefined) delete process.env.STEAM_APP_ID;
    else process.env.STEAM_APP_ID = savedAppId;
  });

  it('list --json prints exactly one JSON document with string IDs and ISO times', async () => {
    setupApi({
      pages: [
        { items: [raw(11n, 'First'), null], totalResults: 3 },
        { items: [raw(12n, 'Second', { visibility: 2 })], totalResults: 3 },
      ],
    });
    await createSteamListCommand().parseAsync(['--json'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const doc = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(doc.appId).toBe(3167020);
    expect(doc.items.map((i: { id: string }) => i.id)).toEqual(['11', '12']);
    expect(doc.items[1].visibility).toBe('private');
    expect(doc.items[0].timeUpdated).toBe(new Date(1700000100 * 1000).toISOString());
    expect(typeof doc.items[0].subscribers).toBe('number');
    expect(doc.items[0].tags).toEqual(['Weapons']);
    expect(doc.items[0].url).toContain('11');
  });

  it('list --json with no items still prints a JSON object with an empty items array', async () => {
    setupApi({ pages: [{ items: [], totalResults: 0 }] });
    await createSteamListCommand().parseAsync(['--json'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(logSpy.mock.calls[0][0])).items).toEqual([]);
  });

  it('list --json writes nothing to stdout when Steam is unreachable', async () => {
    steam.initMode = 'throw';
    await createSteamListCommand().parseAsync(['--json'], { from: 'user' });
    expect(logSpy).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy.mock.calls.map((c) => String(c[0])).join('\n')).toContain('Steam is not running');
  });

  it('list table shows the extra columns with --stats', async () => {
    setupApi({ pages: [{ items: [raw(11n, 'First')], totalResults: 1 }] });
    await createSteamListCommand().parseAsync(['--stats'], { from: 'user' });
    const printed = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(printed).toContain('Favorites');
    expect(printed).toContain('First');
  });

  it('subscribed --json reports installed status and install details', async () => {
    setupApi({
      items: new Map([[1n, raw(1n, 'Installed')], [2n, raw(2n, 'Missing')]]),
      subscribed: [1n, 2n],
      installed: new Map([[1n, { folder: '/s/1', sizeOnDisk: 99n, timestamp: 1700000200 }]]),
    });
    await createSteamSubscribedCommand().parseAsync(['--json'], { from: 'user' });
    const doc = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(doc.items[0]).toMatchObject({ id: '1', title: 'Installed', installed: true, folder: '/s/1', sizeOnDisk: 99 });
    expect(doc.items[1]).toMatchObject({ id: '2', installed: false });
    expect(doc.items[1].folder).toBeUndefined();
  });

  it('info by ID prints a human view and --json prints the full item', async () => {
    const long = 'x'.repeat(800);
    setupApi({ items: new Map([[12345n, raw(12345n, 'Shown', { description: long })]]) });

    await createSteamInfoCommand().parseAsync(['12345'], { from: 'user' });
    const human = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(human).toContain('Title:       Shown');
    expect(human).toContain('x'.repeat(500) + '…');
    expect(human).not.toContain('x'.repeat(501));

    logSpy.mockClear();
    await createSteamInfoCommand().parseAsync(['12345', '--json'], { from: 'user' });
    const doc = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(doc.id).toBe('12345');
    expect(doc.description).toBe(long);
  });

  it('info reports a missing item with suggestions and exits 1', async () => {
    setupApi({ items: new Map() });
    await createSteamInfoCommand().parseAsync(['99999999'], { from: 'user' });
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy.mock.calls.map((c) => String(c[0])).join('\n')).toContain('Workshop item 99999999 was not found');
  });

  it('info on a directory reads publishedFileId from info.ini', async () => {
    const mod = join(root, 'MyMod');
    mkdirSync(mod);
    writeFileSync(join(mod, 'info.ini'), 'name=MyMod\nversion=1.0.0\npublishedFileId=555\n');
    setupApi({ items: new Map([[555n, raw(555n, 'Linked')]]) });
    await createSteamInfoCommand().parseAsync([mod], { from: 'user' });
    expect(exitSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.map((c) => String(c[0])).join('\n')).toContain('Linked');
  });

  it('info on a directory without publishedFileId fails and suggests push or link', async () => {
    const mod = join(root, 'Unpublished');
    mkdirSync(mod);
    writeFileSync(join(mod, 'info.ini'), 'name=Unpublished\nversion=1.0.0\n');
    setupApi({});
    await createSteamInfoCommand().parseAsync([mod], { from: 'user' });
    expect(exitSpy).toHaveBeenCalledWith(1);
    const printed = errSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(printed).toContain('ducky steam push');
    expect(printed).toContain('ducky steam link');
  });
});

describe('classifyInfoArgument', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ducky-classify-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('treats digits as an item ID', () => {
    expect(classifyInfoArgument('12345')).toEqual({ kind: 'id', id: 12345n });
  });

  it('treats an existing directory as a path, even when its name is digits', () => {
    const dir = join(root, '12345');
    mkdirSync(dir);
    expect(classifyInfoArgument(dir)).toEqual({ kind: 'directory', path: dir });
  });

  it('rejects anything else with a ValidationError', () => {
    expect(() => classifyInfoArgument('not-an-id-or-path')).toThrow(ValidationError);
    expect(() => classifyInfoArgument('not-an-id-or-path')).toThrow(/Workshop item ID or a mod directory/);
  });
});
