import { fileExists, directoryExists } from '../../utils/fs.js';
import { join } from 'path';
import { ValidationError, FileSystemError } from '../../utils/errors.js';
import { getSteamAppId } from './config.js';
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
