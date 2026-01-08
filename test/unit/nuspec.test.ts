import { describe, it, expect } from 'vitest';
import { generateNuspec } from '../../src/formats/nuget/nuspec.js';
import type { ModMetadata } from '../../src/formats/nuget/parser.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '..', 'fixtures');

describe('Nuspec Generation', () => {
  describe('Version handling', () => {
    it('should preserve dev version format (0.1.2-dev.1) in nuspec', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '0.1.2-dev.1',
        description: 'Test mod',
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<version>0.1.2-dev.1</version>');
    });

    it('should preserve dev version format (1.0.0-dev.2) in nuspec', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0-dev.2',
        description: 'Test mod',
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<version>1.0.0-dev.2</version>');
    });

    it('should preserve pre-release version (2.1.0-beta) in nuspec', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '2.1.0-beta',
        description: 'Test mod',
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<version>2.1.0-beta</version>');
    });

    it('should preserve version with build metadata (3.0.0-rc.1+build.123) in nuspec', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '3.0.0-rc.1+build.123',
        description: 'Test mod',
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<version>3.0.0-rc.1+build.123</version>');
    });

    it('should preserve standard SemVer version (1.0.0) in nuspec', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        description: 'Test mod',
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<version>1.0.0</version>');
    });
  });

  describe('Optional metadata fields', () => {
    it('should include project URL block when projectUrl is provided', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        projectUrl: 'https://example.com',
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<projectUrl>https://example.com</projectUrl>');
    });

    it('should include license block when license is provided', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        license: 'MIT',
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<license type="expression">MIT</license>');
    });

    it('should include copyright block when copyright is provided', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        copyright: '2024 Test',
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<copyright>2024 Test</copyright>');
    });
  });

  describe('Title field', () => {
    it('should use displayName in title when available', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        displayName: 'Test Mod Display',
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<title>Test Mod Display</title>');
    });

    it('should fallback to name for title when displayName is not available', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<title>TestMod</title>');
    });
  });

  describe('CDATA handling', () => {
    it('should use CDATA for long description (>400 chars)', async () => {
      const longDesc = 'A'.repeat(500);
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        description: longDesc,
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<description><![CDATA[');
    });

    it('should use CDATA for multi-line description', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        description: 'Line 1\nLine 2\nLine 3',
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<description><![CDATA[');
    });

    it('should use CDATA for long release notes (>400 chars)', async () => {
      const longRn = 'B'.repeat(500);
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
      };
      const nuspec = await generateNuspec('/tmp/test', metadata, undefined, longRn);
      expect(nuspec).toContain('<releaseNotes><![CDATA[');
    });
  });

  describe('Tags formatting', () => {
    it('should replace spaces in tags with hyphens for NuGet compatibility', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        tags: ['Cities: Skylines', 'Update', 'Items & Things'],
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<tags>Cities:-Skylines Update Items-&amp;-Things duckymod game-mod</tags>');
    });

    it('should handle tags with multiple spaces', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        tags: ['Complex Tag With Spaces'],
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<tags>Complex-Tag-With-Spaces duckymod game-mod</tags>');
    });

    it('should use default tags when no tags provided', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<tags>duckymod game-mod</tags>');
    });

    it('should handle single word tags without modification', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        tags: ['update', 'economy', 'mod'],
      };
      const nuspec = await generateNuspec('/tmp/test', metadata);
      expect(nuspec).toContain('<tags>update economy mod duckymod game-mod</tags>');
    });
  });

  describe('Enhanced description loading', () => {
    it('should use loadDescription to get full description content', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        description: 'Short description',
      };
      // When no additional description files exist, should fall back to metadata.description
      const nuspec = await generateNuspec('/tmp/nonexistent', metadata);
      expect(nuspec).toContain('<description>Short description</description>');
    });

    it('should load description from description/zh.md when available (higher priority than en.md)', async () => {
      const modPath = join(fixturesDir, 'mod-with-description');
      const metadata: ModMetadata = {
        name: 'ModWithDescription',
        version: '1.0.0',
        description: 'Short description from info.ini',
      };
      const nuspec = await generateNuspec(modPath, metadata);
      // Should use description/zh.md content (higher priority than en.md)
      expect(nuspec).toContain('这是从 description/zh.md 加载的详细描述');
      expect(nuspec).toContain('<description><![CDATA[');
      expect(nuspec).toContain('## 功能');
    });

    it('should load description from description/en.md when zh.md does not exist', async () => {
      const modPath = join(fixturesDir, 'mod-with-en-only');
      const metadata: ModMetadata = {
        name: 'ModWithEnOnly',
        version: '1.0.0',
        description: 'Short description from info.ini',
      };
      const nuspec = await generateNuspec(modPath, metadata);
      // Should use description/en.md content when zh.md doesn't exist
      expect(nuspec).toContain('This is a detailed description from description/en.md (only en.md exists)');
      expect(nuspec).toContain('<description><![CDATA[');
      expect(nuspec).toContain('## Features');
    });

    it('should fallback to metadata.description when no description files exist', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        description: 'Fallback description',
      };
      const nuspec = await generateNuspec('/tmp/nonexistent-path-12345', metadata);
      expect(nuspec).toContain('<description>Fallback description</description>');
    });
  });
});
