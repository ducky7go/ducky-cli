import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { linkModToItem, parseWorkshopItemId } from '../../src/commands/steam/link.js';
import { preparePull, pullDescriptionFiles, composeDescriptionFile } from '../../src/commands/steam/pull.js';
import { readPublishedFileId } from '../../src/formats/steam/parser.js';
import { buildPushPlan, appendTail } from '../../src/formats/steam/dry-run.js';
import { markdownToBBCode } from '../../src/formats/steam/metadata.js';
import type { SteamWorkshopClient, RawWorkshopItem, ItemQueryConfig } from '../../src/formats/steam/query.js';
import { ValidationError, SteamError } from '../../src/utils/errors.js';
import { createLogger } from '../../src/utils/logger.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');
const TAIL = '[hr]Submmited via ducky cli';
const quiet = createLogger({});

/** Fake client returning items per language; unknown languages get the English item */
function fakeClient(items: Record<string, RawWorkshopItem>, missingItem = false): SteamWorkshopClient {
  return {
    getUserItems: async () => ({ items: [], totalResults: 0 }),
    getItem: async (_id: bigint, config?: ItemQueryConfig) => {
      if (missingItem) return null;
      return items[config?.language ?? 'english'] ?? items.english;
    },
    getItems: async () => ({ items: [] }),
    getSubscribedItems: () => [],
    installInfo: () => null,
    deleteItem: async () => {},
    getAccountId: () => 42,
    isConnected: () => true,
  };
}

const remoteEnglish = (bb: string): RawWorkshopItem => ({
  publishedFileId: 555n,
  title: 'Round Trip Mod',
  description: bb,
  timeCreated: 0,
  timeUpdated: 0,
  visibility: 0,
  statistics: {},
});

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ducky-link-pull-'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

/** Copy the steam-valid-mod fixture into the temp root */
function freshMod(name = 'mod', publishedFileId?: number): string {
  const dir = join(root, name);
  cpSync(join(fixtures, 'steam-valid-mod'), dir, { recursive: true });
  if (publishedFileId !== undefined) {
    appendFileSync(join(dir, 'info.ini'), `\npublishedFileId=${publishedFileId}\n`);
  }
  return dir;
}

describe('steam link', () => {
  it('writes publishedFileId and leaves the rest of info.ini unchanged', async () => {
    const mod = freshMod();
    const before = readFileSync(join(mod, 'info.ini'), 'utf8');
    expect(await linkModToItem(mod, 12345, false, quiet)).toBe('linked');
    const after = readFileSync(join(mod, 'info.ini'), 'utf8');
    expect(after).toContain('publishedFileId = 12345');
    const withoutLink = after.split('\n').filter((l) => !l.startsWith('publishedFileId')).join('\n');
    expect(withoutLink.trim()).toBe(before.trim());
  });

  it('same ID again is a no-op', async () => {
    const mod = freshMod('mod', 12345);
    const before = readFileSync(join(mod, 'info.ini'), 'utf8');
    expect(await linkModToItem(mod, 12345, false, quiet)).toBe('unchanged');
    expect(readFileSync(join(mod, 'info.ini'), 'utf8')).toBe(before);
  });

  it('a different existing ID is refused without --force and info.ini is unchanged', async () => {
    const mod = freshMod('mod', 111);
    const before = readFileSync(join(mod, 'info.ini'), 'utf8');
    const error = await linkModToItem(mod, 222, false, quiet).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as Error).message).toContain('111');
    expect((error as ValidationError).suggestions?.join(' ')).toContain('--force');
    expect(readFileSync(join(mod, 'info.ini'), 'utf8')).toBe(before);
  });

  it('--force replaces the existing ID', async () => {
    const mod = freshMod('mod', 111);
    expect(await linkModToItem(mod, 222, true, quiet)).toBe('linked');
    expect(await readPublishedFileId(mod)).toBe(222);
  });

  it('rejects zero, negative and non-numeric IDs', () => {
    for (const bad of ['abc', '0', '-5', '1.5', '']) {
      expect(() => parseWorkshopItemId(bad), bad).toThrow(ValidationError);
    }
    expect(parseWorkshopItemId('1234567890')).toBe(1234567890);
  });

  it('reports a missing info.ini with the validate guidance', async () => {
    const empty = join(root, 'Empty');
    mkdirSync(empty);
    const error = await linkModToItem(empty, 12345, false, quiet).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as Error).message).toBe('info.ini not found in mod directory');
  });

  it('a following push plan reports update mode for the linked item', async () => {
    const mod = freshMod();
    await linkModToItem(mod, 12345, false, quiet);
    const plan = await buildPushPlan(mod, { updateDescription: false, appId: 3167020 });
    expect(plan.isFirstTimeUpload).toBe(false);
    expect(plan.publishedFileId).toBe(12345);
  });
});

describe('steam pull: local preconditions', () => {
  it('an unlinked directory fails before any write and suggests link', async () => {
    const mod = freshMod();
    const error = await preparePull(mod, []).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).suggestions?.join(' ')).toContain('ducky steam link');
    expect(existsSync(join(mod, 'description'))).toBe(false);
  });

  it('an unsupported language fails before any write and lists supported values', async () => {
    const mod = freshMod('mod', 555);
    const error = await preparePull(mod, ['klingon']).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).suggestions?.join(' ')).toContain('schinese');
    expect(existsSync(join(mod, 'description'))).toBe(false);
  });

  it('defaults to English and deduplicates language aliases', async () => {
    const mod = freshMod('mod', 555);
    expect((await preparePull(mod, [])).languages).toEqual(['english']);
    expect((await preparePull(mod, ['zh', 'schinese', 'en'])).languages).toEqual(['schinese', 'english']);
  });
});

describe('steam pull: writing files', () => {
  it('default pull writes en.md with an H1 title followed by the description', async () => {
    const mod = freshMod('mod', 555);
    const plan = await preparePull(mod, []);
    const outcomes = await pullDescriptionFiles(
      fakeClient({ english: remoteEnglish('[h2]Intro[/h2]\n\nHello [b]world[/b]') }),
      mod,
      plan,
      { force: false },
      quiet,
    );
    expect(outcomes.map((o) => o.status)).toEqual(['written']);
    const text = readFileSync(join(mod, 'description', 'en.md'), 'utf8');
    expect(text.startsWith('# Round Trip Mod\n\n')).toBe(true);
    expect(text).toContain('## Intro');
    expect(text).toContain('Hello **world**');
  });

  it('selected languages use the push filename mapping (zh.md, japanese.md)', async () => {
    const mod = freshMod('mod', 555);
    const plan = await preparePull(mod, ['schinese', 'japanese']);
    const items = {
      english: remoteEnglish('English body'),
      schinese: { ...remoteEnglish('中文内容'), title: '中文标题' },
      japanese: { ...remoteEnglish('日本語'), title: '日本語タイトル' },
    };
    await pullDescriptionFiles(fakeClient(items), mod, plan, { force: false }, quiet);
    expect(existsSync(join(mod, 'description', 'zh.md'))).toBe(true);
    expect(existsSync(join(mod, 'description', 'japanese.md'))).toBe(true);
    expect(readFileSync(join(mod, 'description', 'zh.md'), 'utf8')).toContain('# 中文标题');
  });

  it('an existing file is not overwritten without --force, and the others still run', async () => {
    const mod = freshMod('mod', 555);
    mkdirSync(join(mod, 'description'));
    writeFileSync(join(mod, 'description', 'en.md'), 'KEEP ME');
    const plan = await preparePull(mod, ['english', 'schinese']);
    const items = { english: remoteEnglish('x'), schinese: { ...remoteEnglish('y'), title: 'Y' } };
    const outcomes = await pullDescriptionFiles(fakeClient(items), mod, plan, { force: false }, quiet);
    expect(outcomes.find((o) => o.language === 'english')?.status).toBe('failed');
    expect(outcomes.find((o) => o.language === 'schinese')?.status).toBe('written');
    expect(readFileSync(join(mod, 'description', 'en.md'), 'utf8')).toBe('KEEP ME');

    const forced = await pullDescriptionFiles(fakeClient(items), mod, plan, { force: true }, quiet);
    expect(forced.every((o) => o.status === 'written')).toBe(true);
    expect(readFileSync(join(mod, 'description', 'en.md'), 'utf8')).toContain('# Round Trip Mod');
  });

  it('removes the submission footer from the written file', async () => {
    const mod = freshMod('mod', 555);
    const plan = await preparePull(mod, []);
    await pullDescriptionFiles(
      fakeClient({ english: remoteEnglish(`Body text\n\n${TAIL}`) }),
      mod,
      plan,
      { force: false },
      quiet,
    );
    const text = readFileSync(join(mod, 'description', 'en.md'), 'utf8');
    expect(text).toContain('Body text');
    expect(text).not.toContain('Submmited');
    expect(text).not.toContain('ducky cli');
  });

  it('skips with a warning when a translation equals the default text, and still succeeds', async () => {
    const mod = freshMod('mod', 555);
    const plan = await preparePull(mod, ['english', 'japanese']);
    const outcomes = await pullDescriptionFiles(
      fakeClient({ english: remoteEnglish('Same text'), japanese: remoteEnglish('Same text') }),
      mod,
      plan,
      { force: false },
      quiet,
    );
    expect(outcomes.find((o) => o.language === 'japanese')).toMatchObject({ status: 'skipped' });
    expect(existsSync(join(mod, 'description', 'japanese.md'))).toBe(false);
    expect(outcomes.some((o) => o.status === 'failed')).toBe(false);
  });

  it('a missing item is a Steam error', async () => {
    const mod = freshMod('mod', 555);
    const plan = await preparePull(mod, []);
    await expect(pullDescriptionFiles(fakeClient({}, true), mod, plan, { force: false }, quiet)).rejects.toBeInstanceOf(
      SteamError,
    );
  });

  it('pushing a pulled file produces the same description as the remote BBCode', async () => {
    // Remote text as produced by an earlier push of a file with an H1 title
    const sourceMd = readFileSync(join(fixtures, 'steam-bbcode', 'roundtrip.md'), 'utf8');
    const remoteBBCode = `${markdownToBBCode(sourceMd)}\n\n${TAIL}`;

    const mod = freshMod('mod', 555);
    const plan = await preparePull(mod, []);
    await pullDescriptionFiles(
      fakeClient({ english: { ...remoteEnglish(remoteBBCode), title: 'Round Trip Mod' } }),
      mod,
      plan,
      { force: false },
      quiet,
    );

    const pushPlan = await buildPushPlan(mod, { updateDescription: true, appId: 3167020 });
    expect(pushPlan.primaryDescription).toBe(remoteBBCode);
    expect(appendTail(markdownToBBCode(readFileSync(join(mod, 'description', 'en.md'), 'utf8')), false)).toBe(
      remoteBBCode,
    );
  });
});

describe('composeDescriptionFile', () => {
  it('does not duplicate an H1 that already matches the title', () => {
    expect(composeDescriptionFile('T', '# T\n\nbody')).toBe('# T\n\nbody');
  });

  it('adds the H1 when the body does not start with it', () => {
    expect(composeDescriptionFile('T', 'body')).toBe('# T\n\nbody');
  });
});
