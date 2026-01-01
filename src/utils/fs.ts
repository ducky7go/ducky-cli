import { promises as fsPromises, constants, existsSync } from 'fs';
import { resolve, dirname, basename, relative, join } from 'path';
import { FileSystemError } from './errors.js';

const { access, readdir, stat, readFile } = fsPromises;

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Synchronously check if a file exists (for convenience)
 */
export function fileExistsSync(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Validate a file path to prevent directory traversal attacks
 * @throws {FileSystemError} If path contains directory traversal patterns
 */
export function validatePath(basePath: string, targetPath: string): string {
  const resolved = resolve(basePath, targetPath);
  const relativePath = relative(basePath, resolved);

  if (relativePath.startsWith('..')) {
    throw new FileSystemError(
      `Invalid path: ${targetPath} is outside the allowed directory`,
      ['Ensure all paths are within the mod directory'],
    );
  }

  return resolved;
}

/**
 * Recursively collect files matching a pattern
 */
export async function collectFiles(
  dirPath: string,
  pattern: RegExp = /.*/,
): Promise<string[]> {
  const results: string[] = [];

  async function traverse(currentPath: string) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  await traverse(dirPath);
  return results;
}

/**
 * Read a file as text
 */
export async function readTextFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (error) {
    throw new FileSystemError(
      `Failed to read file: ${filePath}`,
      [`Ensure the file exists and you have permission to read it`],
    );
  }
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new FileSystemError(
      `Failed to create directory: ${dirPath}`,
      [`Check that you have permission to create directories`],
    );
  }
}

/**
 * Get the size of a file in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await stat(filePath);
    return stats.size;
  } catch (error) {
    throw new FileSystemError(
      `Failed to get file size: ${filePath}`,
      [`Ensure the file exists`],
    );
  }
}

/**
 * Check if a path is a directory
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a path is a file
 */
export async function isFile(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}
