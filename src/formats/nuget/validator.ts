import { join, basename } from 'path';
import { collectFiles } from '../../utils/fs.js';
import type { ModMetadata } from './parser.js';
import { ValidationError } from '../../utils/errors.js';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Validate a mod directory according to NuGet Mod Packaging Specification v1.0
 *
 * @param modPath - Path to mod directory
 * @param metadata - Parsed metadata
 * @returns Validation result
 */
export async function validateMod(
  modPath: string,
  metadata: ModMetadata,
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // 1. Validate DLL name matches mod name
  await validateDllName(modPath, metadata, errors);

  // 2. Validate version format (already done in parser, but double-check)
  validateSemVer(metadata.version, errors);

  // 3. Validate NuGet ID (already done in parser, but double-check)
  validateNuGetId(metadata.name, errors);

  // 4. Validate required fields
  validateRequiredFields(metadata, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate that at least one DLL exists and its name matches the mod name
 */
async function validateDllName(
  modPath: string,
  metadata: ModMetadata,
  errors: ValidationError[],
): Promise<void> {
  const dllFiles = await collectFiles(modPath, /\.dll$/i);

  if (dllFiles.length === 0) {
    errors.push(
      new ValidationError(
        'No DLL files found in mod directory',
        [
          'Add at least one DLL file to the mod',
          'DLL files are required for game mods',
        ],
      ),
    );
    return;
  }

  // Check if any DLL name matches the mod name
  const expectedDllName = metadata.name;
  const hasMatchingDll = dllFiles.some((dllPath) => {
    const fileName = basename(dllPath);
    const baseName = fileName.replace(/\.dll$/i, '');
    return baseName === expectedDllName;
  });

  if (!hasMatchingDll) {
    const dllNames = dllFiles.map((p) => basename(p)).join(', ');
    const dllCount = dllFiles.length;
    const dllPhrase = dllCount === 1 ? 'DLL' : 'DLLs';
    errors.push(
      new ValidationError(
        `No DLL file matches mod name "${metadata.name}" (found ${dllCount} ${dllPhrase})`,
        [
          `Ensure at least one DLL is named "${metadata.name}.dll"`,
          `Current DLLs: ${dllNames}`,
        ],
      ),
    );
  }
}

/**
 * Validate SemVer 2.0 version format
 */
function validateSemVer(version: string, errors: ValidationError[]): void {
  const semverPattern =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

  if (!semverPattern.test(version)) {
    errors.push(
      new ValidationError(
        `Invalid version format: ${version}`,
        [
          'Version must follow SemVer 2.0 format',
          'Examples: 1.0.0, 2.1.0-beta, 3.0.0-rc.1+build.123',
        ],
      ),
    );
  }
}

/**
 * Validate NuGet ID format
 */
function validateNuGetId(id: string, errors: ValidationError[]): void {
  if (!id || id.length > 100) {
    errors.push(
      new ValidationError(
        `Invalid NuGet ID length: ${id ? id.length : 0} characters (max 100)`,
        ['Use a shorter name for your mod'],
      ),
    );
    return;
  }

  if (!/^[A-Za-z_][A-Za-z0-9._-]*$/.test(id)) {
    errors.push(
      new ValidationError(
        `Invalid NuGet ID format: ${id}`,
        [
          'NuGet IDs must start with a letter or underscore',
          'Allowed characters: letters, digits, dots, hyphens, underscores',
          'Example: MyMod.Example',
        ],
      ),
    );
  }
}

/**
 * Validate required fields are present
 */
function validateRequiredFields(
  metadata: ModMetadata,
  errors: ValidationError[],
): void {
  if (!metadata.name) {
    errors.push(
      new ValidationError('Missing required field: name', [
        'Add "name" field to info.ini',
      ]),
    );
  }

  if (!metadata.version) {
    errors.push(
      new ValidationError('Missing required field: version', [
        'Add "version" field to info.ini',
      ]),
    );
  }

  if (!metadata.description) {
    errors.push(
      new ValidationError('Missing recommended field: description', [
        'Add "description" field to info.ini',
      ]),
    );
  }
}
