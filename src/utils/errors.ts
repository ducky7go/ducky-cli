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

/**
 * Workshop legal agreement page the user must accept before items become visible
 */
export const WORKSHOP_AGREEMENT_URL = 'https://steamcommunity.com/sharedfiles/workshoplegalagreement';

/**
 * True when the CI environment variable is set to a truthy value ("true" or "1")
 */
export function isCiEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.CI;
  return value === 'true' || value === '1';
}

/**
 * Explains that Workshop publishing needs a local Steam client, and points to the Steam-free checks
 */
export const CI_STEAM_HINT =
  'Headless Steam publishing is not supported by this tool: Workshop commands need a locally running, logged-in Steam client. In CI, use `ducky steam validate` or `ducky steam push --dry-run` instead.';

/**
 * Prepend the CI hint to suggestions when running under CI
 */
export function withCiHint(suggestions: string[], env: NodeJS.ProcessEnv = process.env): string[] {
  return isCiEnvironment(env) ? [CI_STEAM_HINT, ...suggestions] : suggestions;
}

/**
 * Error raised when the Steam client cannot be reached (not running or not logged in)
 */
export class SteamNotRunningError extends SteamError {
  constructor(
    message: string = 'Steam is not running or you are not logged in',
    suggestions?: string[],
  ) {
    super(
      message,
      withCiHint(
        suggestions ?? [
          'Start the Steam client and log in',
          'Make sure Steam and this terminal run as the same user at the same privilege level',
          'Retry the command once Steam is running',
        ],
      ),
    );
    Object.defineProperty(this, 'code', {
      value: 'STEAM_NOT_RUNNING',
      enumerable: true,
      writable: false,
    });
    this.name = 'SteamNotRunningError';
  }
}

/**
 * Error raised when the Steamworks native library cannot be loaded
 */
export class SteamLibraryError extends SteamError {
  constructor(reason: string, suggestions?: string[]) {
    super(
      `The Steamworks library failed to load: ${reason}`,
      suggestions ?? [
        'Check that the platform is supported by @ducky7go/steamworks.js',
        'Reinstall dependencies with pnpm install',
      ],
    );
    Object.defineProperty(this, 'code', {
      value: 'STEAM_LIBRARY_ERROR',
      enumerable: true,
      writable: false,
    });
    this.name = 'SteamLibraryError';
  }
}

/**
 * Error/guidance raised when the Steam Workshop legal agreement has not been accepted
 */
export class SteamAgreementError extends SteamError {
  constructor(message: string = 'The Steam Workshop legal agreement has not been accepted', suggestions?: string[]) {
    super(
      message,
      suggestions ?? [
        `Accept the agreement at ${WORKSHOP_AGREEMENT_URL} while logged in with the same account`,
        'Run the push command again after accepting; the item stays hidden until then',
      ],
    );
    Object.defineProperty(this, 'code', {
      value: 'STEAM_AGREEMENT_ERROR',
      enumerable: true,
      writable: false,
    });
    this.name = 'SteamAgreementError';
  }
}
