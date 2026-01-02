import { describe, it, expect } from 'vitest';
import { generateNuspec } from '../../src/formats/nuget/nuspec.js';
import type { ModMetadata } from '../../src/formats/nuget/parser.js';

describe('Nuspec Generation', () => {
  describe('Optional metadata fields', () => {
    it('should include project URL block when projectUrl is provided', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        projectUrl: 'https://example.com',
      };
      const nuspec = await generateNuspec(metadata);
      expect(nuspec).toContain('<projectUrl>https://example.com</projectUrl>');
    });

    it('should include license block when license is provided', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        license: 'MIT',
      };
      const nuspec = await generateNuspec(metadata);
      expect(nuspec).toContain('<license type="expression">MIT</license>');
    });

    it('should include copyright block when copyright is provided', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        copyright: '2024 Test',
      };
      const nuspec = await generateNuspec(metadata);
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
      const nuspec = await generateNuspec(metadata);
      expect(nuspec).toContain('<title>Test Mod Display</title>');
    });

    it('should fallback to name for title when displayName is not available', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
      };
      const nuspec = await generateNuspec(metadata);
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
      const nuspec = await generateNuspec(metadata);
      expect(nuspec).toContain('<description><![CDATA[');
    });

    it('should use CDATA for multi-line description', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        description: 'Line 1\nLine 2\nLine 3',
      };
      const nuspec = await generateNuspec(metadata);
      expect(nuspec).toContain('<description><![CDATA[');
    });

    it('should use CDATA for long release notes (>400 chars)', async () => {
      const longRn = 'B'.repeat(500);
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
      };
      const nuspec = await generateNuspec(metadata, undefined, longRn);
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
      const nuspec = await generateNuspec(metadata);
      expect(nuspec).toContain('<tags>Cities:-Skylines Update Items-&amp;-Things duckymod game-mod</tags>');
    });

    it('should handle tags with multiple spaces', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        tags: ['Complex Tag With Spaces'],
      };
      const nuspec = await generateNuspec(metadata);
      expect(nuspec).toContain('<tags>Complex-Tag-With-Spaces duckymod game-mod</tags>');
    });

    it('should use default tags when no tags provided', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
      };
      const nuspec = await generateNuspec(metadata);
      expect(nuspec).toContain('<tags>duckymod game-mod</tags>');
    });

    it('should handle single word tags without modification', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        tags: ['update', 'economy', 'mod'],
      };
      const nuspec = await generateNuspec(metadata);
      expect(nuspec).toContain('<tags>update economy mod duckymod game-mod</tags>');
    });
  });
});
