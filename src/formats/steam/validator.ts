import { fileExists, directoryExists, collectFiles } from '../../utils/fs.js';
import { join } from 'path';
import { ValidationError, FileSystemError } from '../../utils/errors.js';
import { getSteamAppId } from './config.js';
import { parseInfoIni } from '../nuget/parser.js';
import type { Logger } from '../../utils/logger.js';

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ message: string; suggestions?: string[] }>;
}

/**
 * Steam Workshop validator
 */
export class SteamValidator {
  constructor(private logger: Logger) {}

  /**
   * Validate all aspects of a mod for Steam Workshop publishing
   */
  async validate(directory: string): Promise<ValidationResult> {
    const errors: Array<{ message: string; suggestions?: string[] }> = [];

    // Validate App ID
    const appIdError = this.validateAppId(getSteamAppId());
    if (appIdError) {
      errors.push(appIdError);
    }

    // Validate mod directory exists
    const dirError = await this.validateDirectoryExists(directory);
    if (dirError) {
      errors.push(dirError);
      return { isValid: false, errors };
    }

    // Validate info.ini exists
    const infoIniError = await this.validateInfoIniExists(directory);
    if (infoIniError) {
      errors.push(infoIniError);
    }

    // Validate DLL names (only if info.ini exists)
    if (!infoIniError) {
      const dllError = await this.validateDllNames(directory);
      if (dllError) {
        errors.push(dllError);
      }
    }

    // Validate preview.png exists
    const previewError = await this.validatePreviewImage(directory);
    if (previewError) {
      errors.push(previewError);
    }

    // Validate mod structure
    const structureErrors = await this.validateModStructure(directory);
    errors.push(...structureErrors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate Steam App ID
   */
  validateAppId(appId: number): { message: string; suggestions?: string[] } | null {
    if (!appId || appId <= 0) {
      return {
        message: `Invalid Steam App ID: ${appId}`,
        suggestions: [
          'Set the STEAM_APP_ID environment variable to a valid App ID',
          'Default App ID is 3167020',
        ],
      };
    }
    return null;
  }

  /**
   * Validate directory exists
   */
  async validateDirectoryExists(
    directory: string
  ): Promise<{ message: string; suggestions?: string[] } | null> {
    if (!(await directoryExists(directory))) {
      return {
        message: `Directory does not exist: ${directory}`,
        suggestions: [
          'Ensure the mod directory path is correct',
          'Create the directory if it does not exist',
        ],
      };
    }
    return null;
  }

  /**
   * Validate info.ini exists
   */
  async validateInfoIniExists(
    directory: string
  ): Promise<{ message: string; suggestions?: string[] } | null> {
    const infoIniPath = join(directory, 'info.ini');
    if (!(await fileExists(infoIniPath))) {
      return {
        message: 'info.ini not found in mod directory',
        suggestions: [
          'Create an info.ini file in the mod directory',
          'Include required fields: name, version',
        ],
      };
    }
    return null;
  }

  /**
   * Validate preview.png exists
   */
  async validatePreviewImage(
    directory: string
  ): Promise<{ message: string; suggestions?: string[] } | null> {
    const previewPath = join(directory, 'preview.png');
    if (!(await fileExists(previewPath))) {
      return {
        message: 'preview.png not found in mod directory',
        suggestions: [
          'Add a preview.png image to the mod directory',
          'Recommended size: 512x512 pixels or larger',
          'Supported formats: PNG, JPG',
        ],
      };
    }
    return null;
  }

  /**
   * Validate that at least one DLL matches the mod name
   */
  async validateDllNames(
    directory: string
  ): Promise<{ message: string; suggestions?: string[] } | null> {
    try {
      // Parse info.ini to get mod name
      const metadata = await parseInfoIni(directory);
      const expectedDllName = metadata.name;

      // Collect all DLL files
      const dllFiles = await collectFiles(directory, /\.dll$/i);

      if (dllFiles.length === 0) {
        return {
          message: 'No DLL files found in mod directory',
          suggestions: [
            'Add at least one DLL file to the mod',
            'DLL files are required for game mods',
          ],
        };
      }

      // Check if any DLL name matches the mod name
      const hasMatchingDll = dllFiles.some((dllPath) => {
        const fileName = dllPath.split('/').pop() || dllPath.split('\\').pop() || '';
        const baseName = fileName.replace(/\.dll$/i, '');
        return baseName === expectedDllName;
      });

      if (!hasMatchingDll) {
        const dllNames = dllFiles
          .map((p) => p.split('/').pop() || p.split('\\').pop() || '')
          .join(', ');
        const dllCount = dllFiles.length;
        const dllPhrase = dllCount === 1 ? 'DLL' : 'DLLs';
        return {
          message: `No DLL file matches mod name "${expectedDllName}" (found ${dllCount} ${dllPhrase})`,
          suggestions: [
            `Ensure at least one DLL is named "${expectedDllName}.dll"`,
            `Current DLLs: ${dllNames}`,
          ],
        };
      }
    } catch (error) {
      // If parsing fails, skip DLL validation (error will be reported elsewhere)
      return null;
    }
    return null;
  }

  /**
   * Validate mod structure
   */
  async validateModStructure(
    directory: string
  ): Promise<Array<{ message: string; suggestions?: string[] }>> {
    const errors: Array<{ message: string; suggestions?: string[] }> = [];

    // Check for common mod structure files
    // This is a basic check - can be extended based on specific requirements

    // Check if directory is empty
    const fs = await import('fs/promises');
    try {
      const files = await fs.readdir(directory);
      if (files.length === 0) {
        errors.push({
          message: 'Mod directory is empty',
          suggestions: [
            'Add mod files to the directory',
            'Include at least info.ini and some content',
          ],
        });
      }
    } catch (error) {
      // Already handled by validateDirectoryExists
    }

    return errors;
  }
}
