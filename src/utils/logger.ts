import chalk from 'chalk';
import { DuckyError } from './errors.js';

/**
 * Log level enum
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  SUCCESS = 2,
  WARNING = 3,
  ERROR = 4,
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  verbose?: boolean;
  quiet?: boolean;
  /** Send every non-error message to stderr so stdout stays free for machine output */
  stderr?: boolean;
}

/**
 * Logger class for formatted console output
 */
export class Logger {
  protected level: LogLevel;
  private quiet: boolean;
  private stderr: boolean;

  constructor(config: LoggerConfig = {}) {
    this.level = config.verbose ? LogLevel.DEBUG : LogLevel.INFO;
    this.quiet = config.quiet ?? false;
    this.stderr = config.stderr ?? false;
  }

  /**
   * Write a regular (non-warning) line to stdout, or stderr in stderr mode
   */
  private out(line: string): void {
    if (this.stderr) {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Log debug message (only shown in verbose mode)
   */
  debug(message: string): void {
    if (this.level <= LogLevel.DEBUG && !this.quiet) {
      this.out(chalk.gray(`[DEBUG] ${message}`));
    }
  }

  /**
   * Log info message
   */
  info(message: string): void {
    if (this.level <= LogLevel.INFO && !this.quiet) {
      this.out(chalk.blue(`ℹ ${message}`));
    }
  }

  /**
   * Log success message
   */
  success(message: string): void {
    if (this.level <= LogLevel.SUCCESS && !this.quiet) {
      this.out(chalk.green(`✔ ${message}`));
    }
  }

  /**
   * Log warning message
   */
  warn(message: string): void {
    if (this.level <= LogLevel.WARNING && !this.quiet) {
      console.warn(chalk.yellow(`⚠ ${message}`));
    }
  }

  /**
   * Log error message
   */
  error(message: string | Error | DuckyError): void {
    if (message instanceof DuckyError) {
      console.error(message.format());
    } else if (message instanceof Error) {
      console.error(chalk.red(`✖ ${message.message}`));
    } else {
      console.error(chalk.red(`✖ ${message}`));
    }
  }

  /**
   * Log a blank line
   */
  blank(): void {
    if (!this.quiet) {
      this.out('');
    }
  }

  /**
   * Log a header/section title
   */
  header(title: string): void {
    if (!this.quiet) {
      this.out('');
      this.out(chalk.bold.cyan(`╔═ ${title}`));
      this.out(chalk.bold.cyan('╚' + '═'.repeat(title.length + 2)));
    }
  }

  /**
   * Create a progress spinner
   * Note: This is a placeholder. For actual spinners, use the 'ora' package
   */
  spinner(text: string): { start: () => void; stop: () => void } {
    let started = false;
    return {
      start: () => {
        if (!started && !this.quiet) {
          started = true;
          this.out(chalk.cyan(`◐ ${text}`));
        }
      },
      stop: () => {
        started = false;
      },
    };
  }
}

/**
 * Create a logger instance with the given configuration
 */
export function createLogger(config?: LoggerConfig): Logger {
  return new Logger(config);
}
