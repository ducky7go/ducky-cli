import { join, relative, basename } from 'path';
import { collectFiles, fileExists, directoryExists } from '../../utils/fs.js';
import { ValidationError } from '../../utils/errors.js';

/**
 * File collection options
 */
export interface CollectOptions {
  /** Include all files recursively (default: true) */
  recursive?: boolean;
  /** Pattern to match file names (default: all files) */
  pattern?: RegExp;
  /** Path to mod directory */
  modPath: string;
  /** Path to output directory */
  outputPath: string;
}

/**
 * Collected file information
 */
export interface CollectedFile {
  /** Source path (absolute) */
  source: string;
  /** Target path (relative to package root) */
  target: string;
}

/**
 * Collect files for packaging
 * Collects DLL files, preview.png (as icon.png), and all other mod files
 *
 * @param options - Collection options
 * @returns Array of collected files
 * @throws {ValidationError} If mod directory is invalid
 */
export async function collectFilesForPackage(
  options: CollectOptions,
): Promise<CollectedFile[]> {
  const { modPath, outputPath } = options;

  // Validate mod directory exists
  if (!(await directoryExists(modPath))) {
    throw new ValidationError(
      `Mod directory does not exist: ${modPath}`,
      ['Check that the path is correct', 'Ensure the directory exists'],
    );
  }

  const files: CollectedFile[] = [];

  // Collect DLL files
  const dllFiles = await collectFiles(modPath, /\.dll$/i);
  for (const file of dllFiles) {
    const target = relative(modPath, file);
    files.push({ source: file, target });
  }

  // Check for preview.png to copy as icon.png
  const previewPath = join(modPath, 'preview.png');
  if (await fileExists(previewPath)) {
    const iconPath = join(modPath, 'icon.png');
    // The icon will be copied to the package, not renamed in source
    files.push({ source: previewPath, target: 'icon.png' });
  }

  // Collect all other files (excluding info.ini and already collected files)
  const allFiles = await collectFiles(modPath);
  const excludedPatterns = [
    /^info\.ini$/i,
    /\.nupkg$/i,
    /\.nuspec$/i,
    /^preview\.png$/i,
    /^icon\.png$/i,
  ];

  for (const file of allFiles) {
    const target = relative(modPath, file);

    // Skip if already collected (DLLs)
    if (target.endsWith('.dll')) {
      continue;
    }

    // Skip if excluded
    const fileName = basename(target);
    if (excludedPatterns.some((pattern) => pattern.test(fileName))) {
      continue;
    }

    // Check if already added
    if (!files.some((f) => f.target === target)) {
      files.push({ source: file, target });
    }
  }

  return files;
}

/**
 * Calculate relative file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
