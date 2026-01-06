import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'os';
import { parseInfoIni, parseInfoIniContent, loadDescription, loadReleaseNotes } from '../../src/formats/nuget/parser.js';
import { FileSystemError, ValidationError } from '../../src/utils/errors.js';
import type { ModMetadata } from '../../src/formats/nuget/parser.js';

describe('Parser', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ducky-parser-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('parseInfoIniContent - tag parsing', () => {
    it('should parse comma-separated tags', () => {
      const content = `
name=TestMod
version=1.0.0
tags=tag1,tag2,tag3
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should parse quoted tags with spaces (comma-separated)', () => {
      const content = `
name=TestMod
version=1.0.0
tags="tag with spaces",another-tag
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['tag with spaces', 'another-tag']);
    });

    it('should parse mixed quoted and unquoted tags (comma-separated)', () => {
      const content = `
name=TestMod
version=1.0.0
tags="quoted tag",normal-tag,"another quoted tag"
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['quoted tag', 'normal-tag', 'another quoted tag']);
    });

    it('should handle empty tag values', () => {
      const content = `
name=TestMod
version=1.0.0
tags=
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toBeUndefined();
    });

    it('should parse single quoted tag with spaces', () => {
      const content = `
name=TestMod
version=1.0.0
tags="single tag with spaces"
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['single tag with spaces']);
    });

    it('should parse comma-separated tags with spaces around commas', () => {
      const content = `
name=TestMod
version=1.0.0
tags=tag1 , tag2 , tag3
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should parse quoted tags with spaces and normal tags', () => {
      const content = `
name=TestMod
version=1.0.0
tags=Cities: Skylines,Update,Economy, "Items & Things"
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['Cities: Skylines', 'Update', 'Economy', 'Items & Things']);
    });

    it('should handle trailing comma in tags', () => {
      const content = `
name=TestMod
version=1.0.0
tags=tag1,tag2,tag3,
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle empty tags between commas', () => {
      const content = `
name=TestMod
version=1.0.0
tags=tag1,,tag2
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['tag1', 'tag2']);
    });

    it('should handle tags with special characters', () => {
      const content = `
name=TestMod
version=1.0.0
tags=Cities: Skylines,Items & Things,"Test@Home"
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['Cities: Skylines', 'Items & Things', 'Test@Home']);
    });

    it('should handle tags with only spaces (trim them)', () => {
      const content = `
name=TestMod
version=1.0.0
tags=tag1,   ,tag2
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['tag1', 'tag2']);
    });

    it('should handle quoted tag with leading/trailing spaces', () => {
      const content = `
name=TestMod
version=1.0.0
tags= "quoted tag" , normal
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['quoted tag', 'normal']);
    });

    it('should not support escaped quotes (backslash is literal)', () => {
      const content = `
name=TestMod
version=1.0.0
tags="tag with \\"quotes\\"", another-tag
`;
      const metadata = parseInfoIniContent(content);
      // Backslash-escaped quotes are not supported - they are treated as literal
      expect(metadata.tags).toEqual(['tag with \\"quotes\\"', 'another-tag']);
    });

    it('should handle dependencies field same as tags (comma-separated)', () => {
      const content = `
name=TestMod
version=1.0.0
dependencies=dep1,dep2,dep3
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.dependencies).toEqual(['dep1', 'dep2', 'dep3']);
    });

    it('should handle quoted dependencies with spaces', () => {
      const content = `
name=TestMod
version=1.0.0
dependencies="Some Dependency:1.0.0","Another One"
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.dependencies).toEqual(['Some Dependency:1.0.0', 'Another One']);
    });

    it('should handle unclosed quotes (treat remaining as literal)', () => {
      const content = `
name=TestMod
version=1.0.0
tags=tag1,"unclosed,tag2
`;
      const metadata = parseInfoIniContent(content);
      // When quotes are unclosed, the quote char is treated as literal
      expect(metadata.tags).toEqual(['tag1', 'unclosed,tag2']);
    });

    it('should handle multiple consecutive commas in tags', () => {
      const content = `
name=TestMod
version=1.0.0
tags=tag1,,,tag2
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['tag1', 'tag2']);
    });

    it('should handle tags with unicode characters', () => {
      const content = `
name=TestMod
version=1.0.0
tags="中文标签",日本語,한국어
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['中文标签', '日本語', '한국어']);
    });

    it('should handle tags with numbers', () => {
      const content = `
name=TestMod
version=1.0.0
tags=tag1,tag2,tag3,1234
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['tag1', 'tag2', 'tag3', '1234']);
    });

    it('should handle hyphenated tags', () => {
      const content = `
name=TestMod
version=1.0.0
tags=well-formed-tag,another-tag
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['well-formed-tag', 'another-tag']);
    });
  });

  describe('parseInfoIniContent - version parsing', () => {
    it('should parse dev version format (0.1.2-dev.1)', () => {
      const content = `
name=TestMod
version=0.1.2-dev.1
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.version).toBe('0.1.2-dev.1');
    });

    it('should parse dev version format (1.0.0-dev.2)', () => {
      const content = `
name=TestMod
version=1.0.0-dev.2
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.version).toBe('1.0.0-dev.2');
    });

    it('should parse dev version format with multi-digit (2.0.0-dev.10)', () => {
      const content = `
name=TestMod
version=2.0.0-dev.10
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.version).toBe('2.0.0-dev.10');
    });

    it('should parse mixed pre-release format (1.0.0-beta.dev.1)', () => {
      const content = `
name=TestMod
version=1.0.0-beta.dev.1
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.version).toBe('1.0.0-beta.dev.1');
    });

    it('should parse version with build metadata (3.0.0-rc.1+build.123)', () => {
      const content = `
name=TestMod
version=3.0.0-rc.1+build.123
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.version).toBe('3.0.0-rc.1+build.123');
    });

    it('should parse standard SemVer versions', () => {
      const content = `
name=TestMod
version=1.0.0
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.version).toBe('1.0.0');
    });

    it('should parse pre-release version (2.1.0-beta)', () => {
      const content = `
name=TestMod
version=2.1.0-beta
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.version).toBe('2.1.0-beta');
    });
  });

  describe('parseInfoIniContent - INI parsing', () => {
    it('should handle ini with sections', () => {
      const content = `
name=TestMod
version=1.0.0

[Metadata]
author=TestAuthor
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.name).toBe('TestMod');
      expect(metadata.version).toBe('1.0.0');
      // author should not be parsed from non-default section
      expect(metadata.author).toBeUndefined();
    });

    it('should trim whitespace from field values', () => {
      const content = `
name=  TestMod
version= 1.0.0
description = A test mod
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.name).toBe('TestMod');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBe('A test mod');
    });
  });

  describe('parseInfoIniContent - validation', () => {
    it('should handle empty ini content', () => {
      const content = `
# Just comments
# name=TestMod
`;
      expect(() => parseInfoIniContent(content)).toThrow();
    });

    it('should validate NuGet ID length limit', () => {
      const longName = 'a'.repeat(101);
      const content = `
name=${longName}
version=1.0.0
`;
      expect(() => parseInfoIniContent(content)).toThrow();
    });

    it('should validate NuGet ID starts with letter or underscore', () => {
      const content = `
name=123Invalid
version=1.0.0
`;
      expect(() => parseInfoIniContent(content)).toThrow();
    });

    it('should validate NuGet ID allowed characters', () => {
      const content = `
name=Invalid@Name
version=1.0.0
`;
      expect(() => parseInfoIniContent(content)).toThrow();
    });

    it('should throw ValidationError when ini has only sections and no default metadata', () => {
      const content = `
[SomeSection]
key=value
`;
      expect(() => parseInfoIniContent(content)).toThrow(ValidationError);
    });

    it('should handle ini with only comments', () => {
      const content = `# Just comments
# name=TestMod
`;
      expect(() => parseInfoIniContent(content)).toThrow(ValidationError);
    });
  });

  describe('parseInfoIni - file handling', () => {
    it('should throw FileSystemError when info.ini does not exist', async () => {
      await expect(parseInfoIni(tempDir)).rejects.toThrow(FileSystemError);
    });

    it('should throw FileSystemError with helpful message when file not found', async () => {
      try {
        await parseInfoIni(tempDir);
        expect.fail('Should have thrown FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        if (error instanceof FileSystemError) {
          expect(error.message).toContain('info.ini not found');
        }
      }
    });

    it('should wrap FileSystemError with additional context', async () => {
      try {
        await parseInfoIni('/nonexistent/path/that/does/not/exist');
        expect.fail('Should have thrown FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
      }
    });
  });

  describe('loadDescription', () => {
    it('should handle empty readme value', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        readme: '   ',
      };
      const description = await loadDescription(tempDir, metadata);
      expect(description).toBe('');
    });

    it('should use readme content over description files when file does not exist', async () => {
      const descDir = join(tempDir, 'description');
      await mkdir(descDir, { recursive: true });
      await writeFile(join(descDir, 'zh.md'), 'Chinese content', 'utf-8');

      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        readme: 'Direct readme content',
      };
      const description = await loadDescription(tempDir, metadata);
      expect(description).toBe('Direct readme content');
    });

    it('should prefer description/zh.md over description/en.md', async () => {
      const descDir = join(tempDir, 'description');
      await mkdir(descDir, { recursive: true });
      await writeFile(join(descDir, 'zh.md'), 'Chinese content', 'utf-8');
      await writeFile(join(descDir, 'en.md'), 'English content', 'utf-8');

      const metadata: ModMetadata = { name: 'TestMod', version: '1.0.0' };
      const description = await loadDescription(tempDir, metadata);
      expect(description).toBe('Chinese content');
    });
  });

  describe('loadReleaseNotes', () => {
    it('should handle empty releaseNotes value', async () => {
      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        releaseNotes: '   ',
      };
      const releaseNotes = await loadReleaseNotes(tempDir, metadata);
      expect(releaseNotes).toBe('');
    });

    it('should use releaseNotes content over releaseNotes.md when file does not exist', async () => {
      await writeFile(join(tempDir, 'releaseNotes.md'), 'File content', 'utf-8');

      const metadata: ModMetadata = {
        name: 'TestMod',
        version: '1.0.0',
        releaseNotes: 'Direct release notes',
      };
      const releaseNotes = await loadReleaseNotes(tempDir, metadata);
      expect(releaseNotes).toBe('Direct release notes');
    });
  });
});
