/**
 * Base error class for all ducky-cli errors
 */
export class DuckyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly suggestions?: string[],
  ) {
    super(message);
    this.name = 'DuckyError';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Format the error with suggestions for user-friendly display
   */
  format(): string {
    let output = `\x1b[31m✖ ${this.message}\x1b[0m`;
    if (this.suggestions && this.suggestions.length > 0) {
      output += '\n\nSuggestions:';
      for (const suggestion of this.suggestions) {
        output += `\n  • ${suggestion}`;
      }
    }
    return output;
  }
}

/**
 * Error raised when mod validation fails
 */
export class ValidationError extends DuckyError {
  constructor(message: string, suggestions?: string[]) {
    super(message, 'VALIDATION_ERROR', suggestions);
    this.name = 'ValidationError';
  }
}

/**
 * Error raised when configuration is missing or invalid
 */
export class ConfigError extends DuckyError {
  constructor(message: string, suggestions?: string[]) {
    super(message, 'CONFIG_ERROR', suggestions);
    this.name = 'ConfigError';
  }
}

/**
 * Error raised when network operations fail
 */
export class NetworkError extends DuckyError {
  constructor(message: string, suggestions?: string[]) {
    super(message, 'NETWORK_ERROR', suggestions);
    this.name = 'NetworkError';
  }
}

/**
 * Error raised when file system operations fail
 */
export class FileSystemError extends DuckyError {
  constructor(message: string, suggestions?: string[]) {
    super(message, 'FILESYSTEM_ERROR', suggestions);
    this.name = 'FileSystemError';
  }
}

/**
 * Error raised when NuGet CLI operations fail
 */
export class NuGetError extends DuckyError {
  constructor(message: string, suggestions?: string[]) {
    super(message, 'NUGET_ERROR', suggestions);
    this.name = 'NuGetError';
  }
}

/**
 * Error raised when Steam operations fail
 */
export class SteamError extends DuckyError {
  constructor(message: string, suggestions?: string[]) {
    super(message, 'STEAM_ERROR', suggestions);
    this.name = 'SteamError';
  }
}

/**
 * Error raised when Steam authentication fails
 */
export class SteamAuthError extends SteamError {
  constructor(message: string, suggestions?: string[]) {
    super(message, suggestions);
    Object.defineProperty(this, 'code', {
      value: 'STEAM_AUTH_ERROR',
      enumerable: true,
      writable: false,
    });
    this.name = 'SteamAuthError';
  }
}

/**
 * Error raised when Steam upload fails
 */
export class SteamUploadError extends SteamError {
  constructor(message: string, suggestions?: string[]) {
    super(message, suggestions);
    Object.defineProperty(this, 'code', {
      value: 'STEAM_UPLOAD_ERROR',
      enumerable: true,
      writable: false,
    });
    this.name = 'SteamUploadError';
  }
}

/**
 * Error raised when Steam configuration is invalid
 */
export class SteamConfigError extends SteamError {
  constructor(message: string, suggestions?: string[]) {
    super(message, suggestions);
    Object.defineProperty(this, 'code', {
      value: 'STEAM_CONFIG_ERROR',
      enumerable: true,
      writable: false,
    });
    this.name = 'SteamConfigError';
  }
}
