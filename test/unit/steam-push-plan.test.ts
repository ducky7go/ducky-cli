import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import {
  VISIBILITY_VALUES,
  visibilityToSteam,
  parseVisibility,
  normalizeTags,
  resolveTags,
  resolveVisibility,
  buildPushPlan,
  buildMainUpdateDetails,
  buildLanguageUpdateDetails,
  renderPushPlan,
} from '../../src/formats/steam/dry-run.js';
import { ConfigError } from '../../src/utils/errors.js';
import { createLogger } from '../../src/utils/logger.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');
const LEGACY_TAIL = '[hr]Submmited via ducky cli';

describe('visibility mapping and parsing', () => {
  it('maps each visibility name to its Steam value 0-3', () => {
    expect(visibilityToSteam('public')).toBe(0);
    expect(visibilityToSteam('friends')).toBe(1);
    expect(visibilityToSteam('private')).toBe(2);
    expect(visibilityToSteam('unlisted')).toBe(3);
    expect(VISIBILITY_VALUES).toEqual({ public: 0, friends: 1, private: 2, unlisted: 3 });
  });

  it('rejects an invalid value and lists the four valid ones', () => {
    expect(() => parseVisibility('hidden', '--visibility option')).toThrow(ConfigError);
    try {
      parseVisibility('hidden', '--visibility option');
    } catch (error) {
      const message = (error as Error).message;
      for (const name of ['public', 'friends', 'private', 'unlisted']) {
        expect(message).toContain(name);
      }
    }
  });

  it('resolves visibility: option > .duckyrc > public', () => {
    expect(resolveVisibility({ cli: 'private', rc: 'friends' })).toEqual({
      name: 'private',
      source: 'option',
    });
    expect(resolveVisibility({ rc: 'friends' })).toEqual({ name: 'friends', source: 'duckyrc' });
    expect(resolveVisibility({})).toEqual({ name: 'public', source: 'default' });
  });
});

describe('tag normalization and precedence', () => {
  it('trims, drops empty entries and duplicates', () => {
    expect(normalizeTags(' a, ,b,a')).toEqual(['a', 'b']);
    expect(normalizeTags(['  x ', '', 'x', 'y'])).toEqual(['x', 'y']);
  });

  it('returns undefined when nothing usable remains', () => {
    expect(normalizeTags(undefined)).toBeUndefined();
    expect(normalizeTags(' , ')).toBeUndefined();
  });

  it('--tags replaces info.ini and .duckyrc tags (no merge)', () => {
    expect(resolveTags({ cli: 'd,e', infoIni: ['c'], rc: ['a', 'b'] })).toEqual(['d', 'e']);
  });

  it('info.ini tags replace .duckyrc tags', () => {
    expect(resolveTags({ infoIni: ['c'], rc: ['a', 'b'] })).toEqual(['c']);
  });

  it('falls back to .duckyrc tags, and to nothing when none are configured', () => {
    expect(resolveTags({ rc: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(resolveTags({})).toBeUndefined();
  });
});

describe('buildPushPlan', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ducky-plan-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Copy a fixture into the temp root; optionally mark it as already published */
  function copyFixture(name: string, publishedFileId?: number): string {
    const target = join(root, name);
    cpSync(join(fixtures, name), target, { recursive: true });
    if (publishedFileId !== undefined) {
      appendFileSync(join(target, 'info.ini'), `\npublishedFileId=${publishedFileId}\n`);
    }
    return target;
  }

  const base = { updateDescription: false, skipTail: false, appId: 3167020 };

  it('create mode: first upload sets the primary title and description', async () => {
    const mod = copyFixture('steam-described-mod');
    const plan = await buildPushPlan(mod, base);
    expect(plan.isFirstTimeUpload).toBe(true);
    expect(plan.publishedFileId).toBeUndefined();
    expect(plan.sendPrimary).toBe(true);
    expect(plan.primaryTitle).toBe('Described Mod');
    expect(plan.primaryDescription).toContain(LEGACY_TAIL);
    expect(plan.visibility).toBe('public');
    expect(plan.tags).toEqual(['Weapons', 'Balance']);
    expect(plan.descriptionNotice).toBeUndefined();
    expect(plan.otherLanguages).toEqual([]);
  });

  it('update mode without --update-description skips descriptions and says so', async () => {
    const mod = copyFixture('steam-described-mod', 12345);
    const plan = await buildPushPlan(mod, base);
    expect(plan.isFirstTimeUpload).toBe(false);
    expect(plan.publishedFileId).toBe(12345);
    expect(plan.sendPrimary).toBe(false);
    expect(plan.primaryTitle).toBeUndefined();
    expect(plan.descriptionNotice).toContain('Descriptions will not be updated');
  });

  it('update mode with --update-description sends primary and other languages', async () => {
    const mod = copyFixture('steam-described-mod', 12345);
    const plan = await buildPushPlan(mod, { ...base, updateDescription: true });
    expect(plan.sendPrimary).toBe(true);
    expect(plan.primaryTitle).toBe('Described Mod');
    expect(plan.otherLanguages.map((l) => l.language)).toEqual(['schinese']);
    expect(plan.otherLanguages[0].title).toBe('描述模组');
    expect(plan.otherLanguages[0].description).toContain(LEGACY_TAIL);
  });

  it('lists every file with its size and reports the total', async () => {
    const mod = copyFixture('steam-described-mod');
    const plan = await buildPushPlan(mod, base);
    const paths = plan.files.map((f) => f.path);
    expect(paths).toContain('info.ini');
    expect(paths).toContain('description/english.md');
    expect(plan.files.every((f) => f.size >= 0)).toBe(true);
    expect(plan.totalBytes).toBe(plan.files.reduce((sum, f) => sum + f.size, 0));
  });

  it('applies CLI visibility and tags over configuration', async () => {
    const mod = copyFixture('steam-described-mod');
    const plan = await buildPushPlan(mod, {
      ...base,
      cliVisibility: 'private',
      cliTags: ' d, e, d ',
      defaults: { visibility: 'friends', tags: ['z'] },
    });
    expect(plan.visibility).toBe('private');
    expect(plan.visibilityValue).toBe(2);
    expect(plan.tags).toEqual(['d', 'e']);
  });

  it('uses .duckyrc defaults when no CLI value is given', async () => {
    const mod = copyFixture('steam-valid-mod');
    const plan = await buildPushPlan(mod, { ...base, defaults: { visibility: 'friends', tags: ['z'] } });
    expect(plan.visibility).toBe('friends');
    expect(plan.tags).toEqual(['z']);
  });

  it('changelog is combined with the footer unless --skip-tail', async () => {
    const mod = copyFixture('steam-valid-mod');
    expect((await buildPushPlan(mod, { ...base, changelog: 'Fix' })).changeNote).toBe(
      `Fix\n\n${LEGACY_TAIL}`,
    );
    expect(
      (await buildPushPlan(mod, { ...base, changelog: 'Fix', skipTail: true })).changeNote,
    ).toBe('Fix');
  });

  it('dry-run rendering states it is a dry run and does not claim a remote comparison', async () => {
    const mod = copyFixture('steam-described-mod', 12345);
    const plan = await buildPushPlan(mod, { ...base, cliVisibility: 'friends', cliTags: 'a,b', changelog: 'Fix' });
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    renderPushPlan(plan, createLogger({}));
    vi.restoreAllMocks();
    const output = lines.join('\n');
    expect(output).toContain('DRY RUN');
    expect(output).toContain('Mode: update Workshop item 12345');
    expect(output).toContain('Visibility: friends');
    expect(output).toContain('Tags: a, b');
    expect(output).toContain('Descriptions will not be updated');
    expect(output.toLowerCase()).not.toContain('differs');
    expect(output.toLowerCase()).not.toContain('remote value');
  });
});

describe('legacy UgcUpdate regression', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ducky-legacy-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const base = { appId: 3167020 };

  it('update with no options: public, footer only, no title, description or tags', async () => {
    const mod = join(root, 'mod');
    cpSync(join(fixtures, 'steam-valid-mod'), mod, { recursive: true });
    appendFileSync(join(mod, 'info.ini'), '\npublishedFileId=777\n');

    const details = buildMainUpdateDetails(
      await buildPushPlan(mod, { ...base, updateDescription: false, skipTail: false }),
    );
    expect(details).toEqual({
      contentPath: mod,
      previewPath: join(mod, 'preview.png'),
      visibility: 0,
      changeNote: LEGACY_TAIL,
    });
    expect('tags' in details).toBe(false);
    expect('title' in details).toBe(false);
    expect('description' in details).toBe(false);
  });

  it('--changelog with the footer keeps the legacy changeNote', async () => {
    const mod = join(root, 'mod');
    cpSync(join(fixtures, 'steam-valid-mod'), mod, { recursive: true });
    appendFileSync(join(mod, 'info.ini'), '\npublishedFileId=777\n');

    const details = buildMainUpdateDetails(
      await buildPushPlan(mod, { ...base, updateDescription: false, skipTail: false, changelog: 'Fix bugs' }),
    );
    expect(details.changeNote).toBe(`Fix bugs\n\n${LEGACY_TAIL}`);
    expect(details.visibility).toBe(0);
  });

  it('--changelog with --skip-tail sends the changelog unchanged', async () => {
    const mod = join(root, 'mod');
    cpSync(join(fixtures, 'steam-valid-mod'), mod, { recursive: true });
    appendFileSync(join(mod, 'info.ini'), '\npublishedFileId=777\n');

    const details = buildMainUpdateDetails(
      await buildPushPlan(mod, { ...base, updateDescription: false, skipTail: true, changelog: 'Fix bugs' }),
    );
    expect(details.changeNote).toBe('Fix bugs');
  });

  it('--update-description sends primary title and description, other languages separately', async () => {
    const mod = join(root, 'mod');
    cpSync(join(fixtures, 'steam-described-mod'), mod, { recursive: true });
    appendFileSync(join(mod, 'info.ini'), '\npublishedFileId=777\n');
    // Remove tags so this matches the legacy option set exactly
    writeFileSync(
      join(mod, 'info.ini'),
      readFileSync(join(mod, 'info.ini'), 'utf8').replace(/^tags=.*$/m, ''),
    );

    const plan = await buildPushPlan(mod, { ...base, updateDescription: true, skipTail: false });
    const main = buildMainUpdateDetails(plan);
    expect(main.visibility).toBe(0);
    expect(main.title).toBe('Described Mod');
    expect(main.description?.startsWith('[h1]Described Mod[/h1]')).toBe(true);
    expect(main.description?.endsWith(LEGACY_TAIL)).toBe(true);
    expect('tags' in main).toBe(false);

    const other = buildLanguageUpdateDetails(plan.otherLanguages[0]);
    expect(other).toEqual({
      title: '描述模组',
      description: expect.stringContaining(LEGACY_TAIL),
      language: 'schinese',
    });
  });
});
