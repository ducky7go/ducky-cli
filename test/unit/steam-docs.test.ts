import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const steamDoc = readFileSync(join(root, 'docs', 'steam.md'), 'utf8');
const readme = readFileSync(join(root, 'README.md'), 'utf8');

describe('Steam documentation', () => {
  const requiredHeadings = [
    '## CI 使用说明',
    '## 额外预览图/视频不支持',
    '### `ducky steam delete`',
    '### `ducky steam list`',
    '### `ducky steam info`',
    '### `ducky steam subscribed`',
    '### `ducky steam link`',
    '### `ducky steam pull`',
    '## 批量发布',
    '### 依赖验证',
    '### .duckyrc',
    '### App ID 优先级',
    '## 可见性与标签',
  ];

  for (const heading of requiredHeadings) {
    it(`contains the heading ${heading}`, () => {
      expect(steamDoc).toContain(heading);
    });
  }

  it('documents the Steam-not-running error and the Workshop agreement guidance with its URL', () => {
    expect(steamDoc).toContain('Steam is not running or you are not logged in');
    expect(steamDoc).toContain('https://steamcommunity.com/sharedfiles/workshoplegalagreement');
  });

  it('documents the PowerShell explicit-path example for batch push', () => {
    expect(steamDoc).toContain('PowerShell');
    expect(steamDoc).toMatch(/ducky steam push \.\\mods\\A \.\\mods\\B/);
  });

  it('documents the CI constraint, validate and dry-run as CI checks, and the action scope', () => {
    expect(steamDoc).toContain('ducky steam validate');
    expect(steamDoc).toContain('--dry-run');
    expect(steamDoc).toContain('ducky7go/action-ducky-nuget');
    expect(steamDoc).toContain('ducky nuget push');
  });

  it('README links to docs/steam.md', () => {
    expect(readme).toContain('./docs/steam.md');
  });

  it('README lists every steam subcommand', () => {
    for (const cmd of ['steam validate', 'steam push', 'steam list', 'steam info', 'steam subscribed', 'steam link', 'steam pull', 'steam delete']) {
      expect(readme).toContain(`ducky ${cmd}`);
    }
  });
});
