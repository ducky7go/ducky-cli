import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { mkdir, rm, writeFile, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import {
  fileExists,
  directoryExists,
  fileExistsSync,
  validatePath,
  collectFiles,
  readTextFile,
  ensureDirectory,
  getFileSize,
  isDirectory,
  isFile,
} from '../../src/utils/fs.js';
import { FileSystemError } from '../../src/utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '..', 'fixtures');

describe('FS Utilities', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ducky-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'content', 'utf-8');
      expect(await fileExists(filePath)).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      expect(await fileExists(join(tempDir, 'nonexistent.txt'))).toBe(false);
    });

    it('should return true for directory (access check)', async () => {
      // fileExists uses access() which checks if path exists, not if it's a file
      expect(await fileExists(tempDir)).toBe(true);
    });
  });

  describe('directoryExists', () => {
    it('should return true for existing directory', async () => {
      expect(await directoryExists(tempDir)).toBe(true);
    });

    it('should return true for fixtures directory', async () => {
      expect(await directoryExists(fixturesDir)).toBe(true);
    });

    it('should return false for non-existing directory', async () => {
      expect(await directoryExists(join(tempDir, 'nonexistent'))).toBe(false);
    });

    it('should return false for file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'content', 'utf-8');
      expect(await directoryExists(filePath)).toBe(false);
    });
  });

  describe('fileExistsSync', () => {
    it('should return true for existing file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'content', 'utf-8');
      expect(fileExistsSync(filePath)).toBe(true);
    });

    it('should return false for non-existing file', () => {
      expect(fileExistsSync(join(tempDir, 'nonexistent.txt'))).toBe(false);
    });
  });

  describe('validatePath', () => {
    it('should return resolved path for valid path', () => {
      const result = validatePath(tempDir, 'subdir/file.txt');
      expect(result).toContain('subdir');
    });

    it('should throw error for directory traversal', () => {
      expect(() => validatePath(tempDir, '../etc/passwd')).toThrow(FileSystemError);
    });

    it('should throw error for absolute path outside base', () => {
      expect(() => validatePath(tempDir, '/etc/passwd')).toThrow(FileSystemError);
    });

    it('should allow nested paths within base', () => {
      const result = validatePath(tempDir, 'a/b/c/d/file.txt');
      expect(result).toContain('file.txt');
    });
  });

  describe('collectFiles', () => {
    beforeEach(async () => {
      // Create test file structure
      await mkdir(join(tempDir, 'subdir'), { recursive: true });
      await writeFile(join(tempDir, 'file1.txt'), 'content1', 'utf-8');
      await writeFile(join(tempDir, 'file2.md'), 'content2', 'utf-8');
      await writeFile(join(tempDir, 'subdir', 'file3.txt'), 'content3', 'utf-8');
      await writeFile(join(tempDir, 'subdir', 'file4.json'), 'content4', 'utf-8');
    });

    it('should collect all files by default', async () => {
      const files = await collectFiles(tempDir);
      expect(files.length).toBe(4);
    });

    it('should filter files by pattern', async () => {
      const txtFiles = await collectFiles(tempDir, /\.txt$/);
      expect(txtFiles.length).toBe(2);
      expect(txtFiles.every((f) => f.endsWith('.txt'))).toBe(true);
    });

    it('should filter markdown files', async () => {
      const mdFiles = await collectFiles(tempDir, /\.md$/);
      expect(mdFiles.length).toBe(1);
      expect(mdFiles[0]).toMatch(/\.md$/);
    });

    it('should filter json files', async () => {
      const jsonFiles = await collectFiles(tempDir, /\.json$/);
      expect(jsonFiles.length).toBe(1);
      expect(jsonFiles[0]).toMatch(/\.json$/);
    });

    it('should collect from valid-mod fixture', async () => {
      const files = await collectFiles(join(fixturesDir, 'valid-mod'));
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.endsWith('.dll'))).toBe(true);
    });
  });

  describe('readTextFile', () => {
    it('should read file content', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'Hello, World!', 'utf-8');
      const content = await readTextFile(filePath);
      expect(content).toBe('Hello, World!');
    });

    it('should throw FileSystemError for non-existing file', async () => {
      await expect(readTextFile(join(tempDir, 'nonexistent.txt'))).rejects.toThrow(
        FileSystemError,
    );
    await expect(readTextFile(join(tempDir, 'nonexistent.txt'))).rejects.toThrow(
      'Failed to read file',
    );
    });
  });

  describe('ensureDirectory', () => {
    it('should create new directory', async () => {
      const newDir = join(tempDir, 'new', 'nested', 'dir');
      await ensureDirectory(newDir);
      expect(await directoryExists(newDir)).toBe(true);
    });

    it('should not error if directory exists', async () => {
      await expect(ensureDirectory(tempDir)).resolves.not.toThrow();
    });

    // Note: The error path for ensureDirectory (lines 104-108) is difficult to test reliably
    // without mocking, and mocking fs.promises.mkdir is complex due to ESM imports
  });

  describe('getFileSize', () => {
    it('should return file size', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'Hello, World!', 'utf-8');
      const size = await getFileSize(filePath);
      expect(size).toBe(13); // "Hello, World!" is 13 bytes
    });

    it('should throw FileSystemError for non-existing file', async () => {
      await expect(getFileSize(join(tempDir, 'nonexistent.txt'))).rejects.toThrow(
        FileSystemError,
    );
    await expect(getFileSize(join(tempDir, 'nonexistent.txt'))).rejects.toThrow(
      'Failed to get file size',
    );
    });
  });

  describe('isDirectory', () => {
    it('should return true for directory', async () => {
      expect(await isDirectory(tempDir)).toBe(true);
    });

    it('should return false for file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'content', 'utf-8');
      expect(await isDirectory(filePath)).toBe(false);
    });

    it('should return false for non-existing path', async () => {
      expect(await isDirectory(join(tempDir, 'nonexistent'))).toBe(false);
    });
  });

  describe('isFile', () => {
    it('should return true for file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'content', 'utf-8');
      expect(await isFile(filePath)).toBe(true);
    });

    it('should return false for directory', async () => {
      expect(await isFile(tempDir)).toBe(false);
    });

    it('should return false for non-existing path', async () => {
      expect(await isFile(join(tempDir, 'nonexistent'))).toBe(false);
    });
  });
});
