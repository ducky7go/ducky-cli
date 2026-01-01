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

    it('should parse list field with single item', () => {
      const content = `
name=TestMod
version=1.0.0
tags=single
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['single']);
    });

    it('should parse list field with trailing comma', () => {
      const content = `
name=TestMod
version=1.0.0
tags=item1,item2,
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['item1', 'item2']);
    });

    it('should parse list with spaces', () => {
      const content = `
name=TestMod
version=1.0.0
tags=item1 , item2 , item3
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['item1', 'item2', 'item3']);
    });

    it('should handle empty list values', () => {
      const content = `
name=TestMod
version=1.0.0
tags=
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toBeUndefined();
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
