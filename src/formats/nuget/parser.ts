import { readTextFile, fileExists } from '../../utils/fs.js';
import { FileSystemError, ValidationError } from '../../utils/errors.js';
import { join } from 'path';

/**
 * Metadata structure parsed from info.ini
 */
export interface ModMetadata {
  name: string;
  displayName?: string;
  version: string;
  description?: string;
  readme?: string;
  releaseNotes?: string;
  author?: string;
  icon?: string;
  tags?: string[];
  dependencies?: string[];
  projectUrl?: string;
  license?: string;
  copyright?: string;
  publishedFileId?: string;
}

/**
 * Parse info.ini file from a mod directory
 * @param modPath - Path to the mod directory
 * @returns Parsed metadata
 * @throws {FileSystemError} If info.ini is not found
 * @throws {ValidationError} If required fields are missing
 */
export async function parseInfoIni(modPath: string): Promise<ModMetadata> {
  const infoIniPath = `${modPath}/info.ini`;

  try {
    const content = await readTextFile(infoIniPath);
    return parseInfoIniContent(content);
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw new FileSystemError(
        `info.ini not found in ${modPath}`,
        [
          'Ensure info.ini exists in the mod directory',
          'The info.ini file should contain mod metadata',
        ],
      );
    }
    throw error;
  }
}

/**
 * Parse info.ini content
 * @param content - Raw INI content
 * @returns Parsed metadata
 * @throws {ValidationError} If required fields are missing or invalid
 */
export function parseInfoIniContent(content: string): ModMetadata {
  const ini = parseIni(content);
  const metadata = ini[''];

  if (!metadata) {
    throw new ValidationError(
      'info.ini is empty or invalid',
      ['Ensure info.ini contains metadata fields'],
    );
  }

  // Validate required fields
  const requiredFields = ['name', 'version'];
  const missingFields = requiredFields.filter((field) => !metadata[field]);

  if (missingFields.length > 0) {
    throw new ValidationError(
      `Missing required fields in info.ini: ${missingFields.join(', ')}`,
      [
        'Add the missing fields to info.ini',
        'Required fields: name, version',
      ],
    );
  }

  // Validate name (NuGet ID format)
  const name = metadata.name.trim();
  if (!isValidNuGetId(name)) {
    throw new ValidationError(
      `Invalid NuGet ID: ${name}`,
      [
        'NuGet IDs must start with a letter or underscore',
        'Allowed characters: letters, digits, dots, hyphens, underscores',
        'Example: MyMod.Example',
      ],
    );
  }

  // Validate version (SemVer 2.0)
  const version = metadata.version.trim();
  if (!isValidSemVer(version)) {
    throw new ValidationError(
      `Invalid version format: ${version}`,
      [
        'Version must follow SemVer 2.0 format',
        'Example: 1.0.0, 2.1.0-beta, 3.0.0-rc.1',
      ],
    );
  }

  return {
    name,
    displayName: metadata.displayName?.trim(),
    version,
    description: metadata.description?.trim(),
    readme: metadata.readme?.trim(),
    releaseNotes: metadata.releaseNotes?.trim(),
    author: metadata.author?.trim(),
    icon: metadata.icon?.trim(),
    tags: parseList(metadata.tags),
    dependencies: parseList(metadata.dependencies),
    projectUrl: metadata.projectUrl?.trim() || metadata.homepage?.trim(),
    license: metadata.license?.trim(),
    copyright: metadata.copyright?.trim(),
    publishedFileId: metadata.publishedFileId?.trim(),
  };
}

/**
 * Simple INI parser
 * @param content - Raw INI content
 * @returns Parsed INI object
 */
function parseIni(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = { '': {} };
  let currentSection = '';

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    const commentIndex = trimmed.indexOf('#');
    const activeLine =
      commentIndex >= 0 ? trimmed.slice(0, commentIndex).trim() : trimmed;

    if (!activeLine) {
      continue;
    }

    // Section header
    const sectionMatch = activeLine.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      result[currentSection] = {};
      continue;
    }

    // Key-value pair
    const keyValueMatch = activeLine.match(/^([^=]+)=(.*)$/);
    if (keyValueMatch) {
      const key = keyValueMatch[1].trim();
      const value = keyValueMatch[2].trim();
      result[currentSection][key] = value;
    }
  }

  return result;
}

/**
 * Parse a comma-separated list with support for quoted strings containing spaces.
 * Comma (,) is the only valid delimiter. Space-only separation is not supported.
 *
 * Examples:
 * - tags = tag1, tag2, tag3
 * - tags = "tag with spaces", another-tag
 * - tags = "quoted tag", normal-tag, "another quoted tag"
 *
 * @param value - Raw comma-separated value
 * @returns Array of parsed items, or undefined if input is empty/undefined
 */
function parseList(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];

    if (char === '"' && (i === 0 || value[i - 1] !== '\\')) {
      // Toggle quote state
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      // Comma delimiter outside quotes - end of current item
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        result.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last item
  const trimmed = current.trim();
  if (trimmed.length > 0) {
    result.push(trimmed);
  }

  return result;
}

/**
 * Validate NuGet ID format
 * Based on: https://learn.microsoft.com/en-us/nuget/reference/id-prefixes
 */
function isValidNuGetId(id: string): boolean {
  if (!id || id.length > 100) {
    return false;
  }
  return /^[A-Za-z_][A-Za-z0-9._-]*$/.test(id);
}

/**
 * Validate SemVer 2.0 version format
 * Based on: https://semver.org/spec/v2.0.0.html
 */
function isValidSemVer(version: string): boolean {
  // SemVer regex pattern
  const semverPattern =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semverPattern.test(version);
}

/**
 * Load description with precedence order:
 * 1. readme file (if info.ini readme is a file path that exists)
 * 2. readme content (if info.ini readme is not a file but has content)
 * 3. description/zh.md
 * 4. description/en.md
 * 5. info.ini description field
 *
 * @param modPath - Path to the mod directory
 * @param metadata - Parsed mod metadata
 * @returns Description content
 */
export async function loadDescription(
  modPath: string,
  metadata: ModMetadata
): Promise<string> {
  // 1. Try readme file if specified (highest priority)
  if (metadata.readme) {
    const readmePath = join(modPath, metadata.readme);

    if (await fileExists(readmePath)) {
      return await readTextFile(readmePath);
    }

    // 2. If readme is not a file but has content, use it directly
    if (metadata.readme.trim().length > 0) {
      return metadata.readme;
    }
  }

  // 3. Try description/zh.md
  const zhMdPath = join(modPath, 'description', 'zh.md');
  if (await fileExists(zhMdPath)) {
    return await readTextFile(zhMdPath);
  }

  // 4. Try description/en.md
  const enMdPath = join(modPath, 'description', 'en.md');
  if (await fileExists(enMdPath)) {
    return await readTextFile(enMdPath);
  }

  // 5. Use info.ini description field (fallback)
  if (metadata.description) {
    return metadata.description;
  }

  // Final fallback: return empty string
  return '';
}

/**
 * Load release notes with precedence order:
 * 1. releaseNotes file (if info.ini releaseNotes is a file path that exists)
 * 2. releaseNotes content (if info.ini releaseNotes is not a file but has content)
 * 3. releaseNotes.md file in mod directory
 *
 * @param modPath - Path to the mod directory
 * @param metadata - Parsed mod metadata
 * @returns Release notes content
 */
export async function loadReleaseNotes(
  modPath: string,
  metadata: ModMetadata
): Promise<string> {
  // 1. Try releaseNotes file if specified (highest priority)
  if (metadata.releaseNotes) {
    const releaseNotesPath = join(modPath, metadata.releaseNotes);

    if (await fileExists(releaseNotesPath)) {
      return await readTextFile(releaseNotesPath);
    }

    // 2. If releaseNotes is not a file but has content, use it directly
    if (metadata.releaseNotes.trim().length > 0) {
      return metadata.releaseNotes;
    }
  }

  // 3. Try releaseNotes.md file
  const releaseNotesMdPath = join(modPath, 'releaseNotes.md');
  if (await fileExists(releaseNotesMdPath)) {
    return await readTextFile(releaseNotesMdPath);
  }

  // Final fallback: return empty string
  return '';
}
