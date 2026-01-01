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
