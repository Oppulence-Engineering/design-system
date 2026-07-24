/**
 * @module @oppulence/desktop-client/utils/logger
 * @file Centralized logging utility for the desktop client. Provides a
 *   consistent, configurable logging interface with support for different log
 *   levels, categories, and output formats.
 * @author Canvas Team
 * @since 1.0.0
 */

import type { LogEntry, LogLevel } from "../types";
import { LogEntrySchema } from "../types";

/**
 * Configuration options for the Logger class.
 *
 * @interface LoggerConfig
 */
export type LoggerConfig = {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to include timestamps in console output */
  showTimestamps: boolean;
  /** Whether to include category in console output */
  showCategory: boolean;
  /** Whether to output logs in JSON format */
  jsonOutput: boolean;
  /** Custom log handler for external integrations */
  customHandler?: ((entry: LogEntry) => void) | undefined;
};

/**
 * Singleton logger instance for the desktop client. Provides structured logging
 * with multiple severity levels and configurable output formats.
 *
 * @example
 *   ```typescript
 *   import { logger } from '@oppulence/desktop-client/utils/logger';
 *
 *   // Basic logging
 *   logger.info('Application started');
 *   logger.error('Failed to connect', { error: err });
 *
 *   // With category
 *   logger.withCategory('DeepLinks').info('Link received', { url });
 *
 *   // Conditional logging
 *   logger.debug('Detailed debug info'); // Only shown if minLevel is 'debug'
 *   ```;
 *
 * @class Logger
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private readonly category?: string;

  /**
   * Log level priorities for comparison. Lower numbers = higher priority.
   *
   * @private
   * @readonly
   */
  private static readonly LEVEL_PRIORITIES: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };

  /**
   * ANSI color codes for terminal output.
   *
   * @private
   * @readonly
   */
  private static readonly COLORS = {
    reset: "\x1b[0m",
    debug: "\x1b[36m", // Cyan
    info: "\x1b[32m", // Green
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
    fatal: "\x1b[35m", // Magenta
    dim: "\x1b[2m", // Dim
  } as const;

  /**
   * Creates a new Logger instance.
   *
   * @private
   * @class
   * @param {Partial<LoggerConfig>} config - Logger configuration options
   */
  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      minLevel: config.minLevel ?? "info",
      showTimestamps: config.showTimestamps ?? true,
      showCategory: config.showCategory ?? true,
      jsonOutput: config.jsonOutput ?? false,
      customHandler: config.customHandler ?? undefined,
    };
  }

  /**
   * Gets the singleton Logger instance.
   *
   * @returns {Logger} The Logger instance
   * @static
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Configures the logger with new settings.
   *
   * @param {Partial<LoggerConfig>} config - Configuration options to update
   * @returns {Logger} The Logger instance for chaining
   */
  public configure(config: Partial<LoggerConfig>): Logger {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Creates a new logger instance with a specific category.
   *
   * @param {string} category - The category name for log entries
   * @returns {Logger} A new Logger instance with the specified category
   */
  public withCategory(category: string): Logger {
    const categoryLogger = Object.create(this);
    categoryLogger.category = category;
    return categoryLogger;
  }

  /**
   * Checks if a log level should be output based on configuration.
   *
   * @private
   * @param {LogLevel} level - The log level to check
   * @returns {boolean} True if the level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return (
      Logger.LEVEL_PRIORITIES[level] >=
      Logger.LEVEL_PRIORITIES[this.config.minLevel]
    );
  }

  /**
   * Formats a log entry for console output.
   *
   * @private
   * @param {LogEntry} entry - The log entry to format
   * @returns {string} Formatted log message
   */
  private formatConsoleOutput(entry: LogEntry): string {
    if (this.config.jsonOutput) {
      return JSON.stringify(entry);
    }

    const parts: string[] = [];
    const color = Logger.COLORS[entry.level];

    // Add timestamp
    if (this.config.showTimestamps) {
      const timestamp = entry.timestamp.toISOString();
      parts.push(`${Logger.COLORS.dim}[${timestamp}]${Logger.COLORS.reset}`);
    }

    // Add level
    parts.push(`${color}[${entry.level.toUpperCase()}]${Logger.COLORS.reset}`);

    // Add category
    if (this.config.showCategory && entry.category) {
      parts.push(
        `${Logger.COLORS.dim}[${entry.category}]${Logger.COLORS.reset}`,
      );
    }

    // Add message
    parts.push(entry.message);

    // Add metadata if present
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      parts.push(
        Logger.COLORS.dim +
          JSON.stringify(entry.metadata) +
          Logger.COLORS.reset,
      );
    }

    return parts.join(" ");
  }

  /**
   * Logs a message at the specified level.
   *
   * @private
   * @param {LogLevel} level - The log level
   * @param {string} message - The log message
   * @param {Record<string, unknown>} metadata - Additional metadata
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = LogEntrySchema.parse({
      level,
      message,
      timestamp: new Date(),
      category: this.category,
      metadata,
    });

    // Call custom handler if provided
    if (this.config.customHandler) {
      try {
        this.config.customHandler(entry);
      } catch (error) {
        console.error("Error in custom log handler:", error);
      }
    }

    // Output to console
    const formattedMessage = this.formatConsoleOutput(entry);

    switch (level) {
      case "debug":
        console.debug(formattedMessage);
        break;
      case "info":
        console.info(formattedMessage);
        break;
      case "warn":
        console.warn(formattedMessage);
        break;
      case "error":
        console.error(formattedMessage);
        break;
      case "fatal":
        console.error(formattedMessage);
        // In a real application, you might want to trigger additional
        // actions for fatal errors (e.g., crash reporting)
        break;
    }
  }

  /**
   * Logs a debug message. Typically used for detailed diagnostic information.
   *
   * @param {string} message - The debug message
   * @param {Record<string, unknown>} metadata - Additional metadata
   */
  public debug(message: string, metadata?: Record<string, unknown>): void {
    this.log("debug", message, metadata);
  }

  /**
   * Logs an info message. Used for general informational messages.
   *
   * @param {string} message - The info message
   * @param {Record<string, unknown>} metadata - Additional metadata
   */
  public info(message: string, metadata?: Record<string, unknown>): void {
    this.log("info", message, metadata);
  }

  /**
   * Logs a warning message. Used for potentially harmful situations.
   *
   * @param {string} message - The warning message
   * @param {Record<string, unknown>} metadata - Additional metadata
   */
  public warn(message: string, metadata?: Record<string, unknown>): void {
    this.log("warn", message, metadata);
  }

  /**
   * Logs an error message. Used for error events that might still allow the
   * application to continue.
   *
   * @param {string} message - The error message
   * @param {Record<string, unknown>} metadata - Additional metadata
   */
  public error(message: string, metadata?: Record<string, unknown>): void {
    this.log("error", message, metadata);
  }

  /**
   * Logs a fatal error message. Used for severe errors that will likely cause
   * the application to abort.
   *
   * @param {string} message - The fatal error message
   * @param {Record<string, unknown>} metadata - Additional metadata
   */
  public fatal(message: string, metadata?: Record<string, unknown>): void {
    this.log("fatal", message, metadata);
  }

  /**
   * Creates a timer for measuring operation duration.
   *
   * @example
   *   ```typescript
   *   const stopTimer = logger.time('Database query');
   *   // ... perform operation ...
   *   stopTimer(); // Logs: "Database query took 123ms"
   *   ```;
   *
   * @param {string} label - Label for the timer
   * @returns {() => void} Function to stop the timer and log the duration
   */
  public time(label: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.debug(`${label} took ${duration.toFixed(2)}ms`, { duration });
    };
  }

  /**
   * Groups related log messages together.
   *
   * @example
   *   ```typescript
   *   await logger.group('Processing items', async () => {
   *     logger.info('Starting processing');
   *     // ... more logs ...
   *     logger.info('Processing complete');
   *   });
   *   ```;
   *
   * @param {string} label - Group label
   * @param {() => void | Promise<void>} fn - Function containing grouped logs
   * @returns {Promise<void>}
   */
  public async group(
    label: string,
    fn: () => void | Promise<void>,
  ): Promise<void> {
    if (this.config.jsonOutput) {
      this.info(`--- Start: ${label} ---`);
    } else {
      console.group(label);
    }

    try {
      await fn();
    } finally {
      if (this.config.jsonOutput) {
        this.info(`--- End: ${label} ---`);
      } else {
        console.groupEnd();
      }
    }
  }
}

/**
 * Default logger instance for the desktop client.
 *
 * @constant
 * @type {Logger}
 */
export const logger = Logger.getInstance();
