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
}

/**
 * Logger class for formatted console output
 */
export class Logger {
  protected level: LogLevel;
  private quiet: boolean;

  constructor(config: LoggerConfig = {}) {
    this.level = config.verbose ? LogLevel.DEBUG : LogLevel.INFO;
    this.quiet = config.quiet ?? false;
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
      console.log(chalk.gray(`[DEBUG] ${message}`));
    }
  }

  /**
   * Log info message
   */
  info(message: string): void {
    if (this.level <= LogLevel.INFO && !this.quiet) {
      console.log(chalk.blue(`ℹ ${message}`));
    }
  }

  /**
   * Log success message
   */
  success(message: string): void {
    if (this.level <= LogLevel.SUCCESS && !this.quiet) {
      console.log(chalk.green(`✔ ${message}`));
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
      console.log();
    }
  }

  /**
   * Log a header/section title
   */
  header(title: string): void {
    if (!this.quiet) {
      console.log();
      console.log(chalk.bold.cyan(`╔═ ${title}`));
      console.log(chalk.bold.cyan('╚' + '═'.repeat(title.length + 2)));
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
          console.log(chalk.cyan(`◐ ${text}`));
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
