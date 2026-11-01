import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { loadDuckyRc } from '../../src/utils/config.js';
import {
  resolveSteamAppId,
  resolveSteamPushDefaults,
  getSteamAppId,
} from '../../src/formats/steam/config.js';
import { ConfigError } from '../../src/utils/errors.js';

describe('loadDuckyRc', () => {
  let root: string;
  let home: string;
  let project: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ducky-rc-'));
    home = join(root, 'home');
    project = join(root, 'work', 'project', 'mods');
    mkdirSync(home, { recursive: true });
    mkdirSync(project, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const write = (dir: string, content: string) => {
    writeFileSync(join(dir, '.duckyrc'), content, 'utf8');
  };

  it('returns undefined when no file exists anywhere (missing file is not an error)', () => {
    expect(loadDuckyRc(project, home)).toBeUndefined();
  });

  it('finds the nearest file walking up from the start directory', () => {
    write(join(root, 'work'), '{"steam":{"visibility":"private"}}');
    write(join(root, 'work', 'project'), '{"steam":{"visibility":"friends"}}');
    const rc = loadDuckyRc(project, home);
    expect(rc?.path).toBe(join(root, 'work', 'project', '.duckyrc'));
    expect(rc?.steam.visibility).toBe('friends');
  });

  it('uses the home file only when no ancestor file exists', () => {
    write(home, '{"steam":{"visibility":"private"}}');
    const rc = loadDuckyRc(project, home);
    expect(rc?.path).toBe(join(home, '.duckyrc'));
    expect(rc?.steam.visibility).toBe('private');
  });

  it('prefers an ancestor file over the home file (nearest wins as a whole file)', () => {
    write(home, '{"steam":{"visibility":"private","tags":["home"]}}');
    write(join(root, 'work'), '{"steam":{"visibility":"friends"}}');
    const rc = loadDuckyRc(project, home);
    expect(rc?.steam).toEqual({ visibility: 'friends' });
  });

  it('reads appId, visibility and tags', () => {
    write(project, '{"steam":{"appId":123,"visibility":"unlisted","tags":["a","b"]}}');
    const rc = loadDuckyRc(project, home);
    expect(rc?.steam).toEqual({ appId: 123, visibility: 'unlisted', tags: ['a', 'b'] });
  });

  it('ignores unrelated top-level keys', () => {
    write(project, '{"nuget":{"apiKey":"x"},"other":[1,2],"steam":{"tags":["t"]}}');
    const rc = loadDuckyRc(project, home);
    expect(rc?.steam).toEqual({ tags: ['t'] });
  });

  it('treats a file without a steam section as empty steam settings', () => {
    write(project, '{"nuget":{}}');
    expect(loadDuckyRc(project, home)?.steam).toEqual({});
  });

  it('rejects malformed JSON and names the file', () => {
    write(project, '{"steam": ');
    expect(() => loadDuckyRc(project, home)).toThrow(ConfigError);
    expect(() => loadDuckyRc(project, home)).toThrow(/Failed to parse .*\.duckyrc/);
  });

  it('rejects an unknown visibility and names the key', () => {
    write(project, '{"steam":{"visibility":"hidden"}}');
    expect(() => loadDuckyRc(project, home)).toThrow(/steam\.visibility/);
  });

  it('rejects non-array tags and names the key', () => {
    write(project, '{"steam":{"tags":"a,b"}}');
    expect(() => loadDuckyRc(project, home)).toThrow(/steam\.tags/);
  });

  it('rejects an invalid appId and names the key', () => {
    write(project, '{"steam":{"appId":"3167020"}}');
    expect(() => loadDuckyRc(project, home)).toThrow(/steam\.appId/);
    write(project, '{"steam":{"appId":0}}');
    expect(() => loadDuckyRc(project, home)).toThrow(/steam\.appId/);
  });

  it('rejects a top-level value that is not an object', () => {
    write(project, '[1,2]');
    expect(() => loadDuckyRc(project, home)).toThrow(ConfigError);
  });

  it('does not modify the file', () => {
    const content = '{"steam":{"tags":["x"]}}';
    write(project, content);
    loadDuckyRc(project, home);
    expect(readFileSync(join(project, '.duckyrc'), 'utf8')).toBe(content);
    expect(existsSync(join(project, 'info.ini'))).toBe(false);
  });
});

describe('resolveSteamAppId precedence', () => {
  it('option wins over env and .duckyrc', () => {
    expect(resolveSteamAppId({ cli: '111', env: '222', rc: 333 })).toEqual({
      appId: 111,
      source: 'option',
    });
  });

  it('environment variable wins over .duckyrc', () => {
    expect(resolveSteamAppId({ env: '222', rc: 333 })).toEqual({ appId: 222, source: 'env' });
  });

  it('.duckyrc wins over the default', () => {
    expect(resolveSteamAppId({ rc: 333 })).toEqual({ appId: 333, source: 'duckyrc' });
  });

  it('falls back to the default 3167020', () => {
    expect(resolveSteamAppId({})).toEqual({ appId: 3167020, source: 'default' });
    expect(resolveSteamAppId({ env: '', cli: '' })).toEqual({ appId: 3167020, source: 'default' });
  });

  it('rejects an invalid option value and names the option', () => {
    expect(() => resolveSteamAppId({ cli: 'abc' })).toThrow(/Invalid Steam App ID from --app-id option/);
    expect(() => resolveSteamAppId({ cli: '0' })).toThrow(/positive integer/);
    expect(() => resolveSteamAppId({ cli: '-5' })).toThrow(/positive integer/);
  });

  it('rejects an invalid environment value and names the variable', () => {
    expect(() => resolveSteamAppId({ env: 'nope' })).toThrow(/STEAM_APP_ID environment variable/);
  });

  it('getSteamAppId honors STEAM_APP_ID and then the default', () => {
    const original = process.env.STEAM_APP_ID;
    try {
      process.env.STEAM_APP_ID = '424242';
      expect(getSteamAppId()).toBe(424242);
      delete process.env.STEAM_APP_ID;
      expect(getSteamAppId()).toBe(3167020);
    } finally {
      if (original === undefined) {
        delete process.env.STEAM_APP_ID;
      } else {
        process.env.STEAM_APP_ID = original;
      }
    }
  });
});

describe('resolveSteamPushDefaults', () => {
  it('returns visibility and tags from the .duckyrc steam section', () => {
    expect(resolveSteamPushDefaults({ visibility: 'friends', tags: ['a', 'b'] })).toEqual({
      visibility: 'friends',
      tags: ['a', 'b'],
    });
  });

  it('returns nothing when no defaults are configured', () => {
    expect(resolveSteamPushDefaults({})).toEqual({});
  });
});

describe('documented .duckyrc example', () => {
  it('docs/steam.md example under ".duckyrc" parses with loadDuckyRc', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const doc = readFileSync(join(here, '..', '..', 'docs', 'steam.md'), 'utf8');
    const section = doc.split('### .duckyrc')[1];
    expect(section, 'docs must contain a ### .duckyrc section').toBeDefined();
    const match = section.match(/```json\n([\s\S]*?)```/);
    expect(match, 'the .duckyrc section must contain a json example').not.toBeNull();

    const root = mkdtempSync(join(tmpdir(), 'ducky-doc-'));
    try {
      writeFileSync(join(root, '.duckyrc'), match![1], 'utf8');
      const rc = loadDuckyRc(root, join(root, 'nohome'));
      expect(rc?.steam).toEqual({
        appId: 3167020,
        visibility: 'friends',
        tags: ['Weapons', 'Balance'],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
