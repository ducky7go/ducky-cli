import { readTextFile, writeTextFile } from '../../utils/fs.js';
import { FileSystemError, ValidationError } from '../../utils/errors.js';
import { ModMetadata } from '../nuget/parser.js';

/**
 * Save publishedFileId to info.ini as a top-level property
 * @param directory - Path to the mod directory
 * @param publishedFileId - The publishedFileId to save
 */
export async function savePublishedFileId(
  directory: string,
  publishedFileId: number
): Promise<void> {
  const infoIniPath = `${directory}/info.ini`;

  try {
    // Read existing content
    const content = await readTextFile(infoIniPath);

    // Check if publishedFileId already exists
    const lines = content.split('\n');
    let found = false;

    // Update or add publishedFileId
    const updatedLines = lines.map((line) => {
      const trimmed = line.trim();
      // Check if this is the publishedFileId line (outside of any section)
      if (trimmed.startsWith('publishedFileId') && !trimmed.startsWith('[')) {
        found = true;
        return `publishedFileId = ${publishedFileId}`;
      }
      return line;
    });

    // If not found, add it after the version line (or at the end)
    if (!found) {
      let insertIndex = -1;
      for (let i = 0; i < updatedLines.length; i++) {
        const trimmed = updatedLines[i].trim();
        if (trimmed.startsWith('version') && !trimmed.startsWith('[')) {
          insertIndex = i + 1;
          break;
        }
      }

      if (insertIndex >= 0) {
        updatedLines.splice(insertIndex, 0, `publishedFileId = ${publishedFileId}`);
      } else {
        // Insert before the first section or at the end
        let firstSectionIndex = -1;
        for (let i = 0; i < updatedLines.length; i++) {
          if (updatedLines[i].trim().startsWith('[')) {
            firstSectionIndex = i;
            break;
          }
        }

        if (firstSectionIndex >= 0) {
          updatedLines.splice(firstSectionIndex, 0, `publishedFileId = ${publishedFileId}`);
        } else {
          updatedLines.push(`publishedFileId = ${publishedFileId}`);
        }
      }
    }

    // Write back
    await writeTextFile(infoIniPath, updatedLines.join('\n'));
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw new FileSystemError(
        `Failed to update info.ini: ${error.message}`,
        ['Ensure info.ini exists and is writable']
      );
    }
    throw error;
  }
}

/**
 * Get publishedFileId from mod metadata
 * @param metadata - Parsed mod metadata
 * @returns The publishedFileId or undefined if not set
 */
export function getPublishedFileId(metadata: ModMetadata): number | undefined {
  if (metadata.publishedFileId) {
    const id = parseInt(metadata.publishedFileId, 10);
    if (!isNaN(id)) {
      return id;
    }
  }
  return undefined;
}

/**
 * Check if the mod has a publishedFileId (already published)
 * @param metadata - Parsed mod metadata
 * @returns True if the mod has a publishedFileId
 */
export function hasPublishedFileId(metadata: ModMetadata): boolean {
  return getPublishedFileId(metadata) !== undefined;
}

/**
 * Read publishedFileId from info.ini without requiring the other mod fields.
 * Used by read-only and linking commands that must work on partially valid info.ini files.
 * @param directory - Path to the mod directory
 * @returns The published item ID, or undefined when the key is absent
 * @throws {FileSystemError} When info.ini cannot be read
 * @throws {ValidationError} When the value is not a positive integer
 */
export async function readPublishedFileId(directory: string): Promise<number | undefined> {
  const content = await readTextFile(`${directory}/info.ini`);
  for (const raw of content.split(/\r?\n/)) {
    const match = raw.trim().match(/^publishedFileId\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }
    const value = match[1].trim().replace(/^["']|["']$/g, '');
    if (!/^\d+$/.test(value) || Number(value) <= 0) {
      throw new ValidationError(`publishedFileId in ${directory}/info.ini is not a positive integer: "${value}"`, [
        'Set publishedFileId to the numeric Workshop item ID, or remove the line',
      ]);
    }
    return Number(value);
  }
  return undefined;
}
