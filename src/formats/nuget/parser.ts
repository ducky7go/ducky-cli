import { readTextFile } from '../../utils/fs.js';
import { FileSystemError, ValidationError } from '../../utils/errors.js';

/**
 * Metadata structure parsed from info.ini
 */
export interface ModMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  tags?: string[];
  dependencies?: string[];
  projectUrl?: string;
  license?: string;
  copyright?: string;
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
    version,
    description: metadata.description?.trim(),
    author: metadata.author?.trim(),
    icon: metadata.icon?.trim(),
    tags: parseList(metadata.tags),
    dependencies: parseList(metadata.dependencies),
    projectUrl: metadata.projectUrl?.trim(),
    license: metadata.license?.trim(),
    copyright: metadata.copyright?.trim(),
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
 * Parse a comma-separated list
 */
function parseList(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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
