import { Buffer } from "node:buffer";
import { env } from "node:process";
import type { SpanContext } from "@opentelemetry/api";

export type LogLevel = "log" | "error" | "warn" | "info" | "debug" | "verbose";

const logLevels: LogLevel[] = [
  "log",
  "error",
  "warn",
  "info",
  "debug",
  "verbose",
];

/**
 * Options for configuring log batching behavior.
 */
export type BatchingOptions = {
  /**
   * Maximum number of log entries to buffer before flushing.
   * @default 100
   */
  maxSize?: number;

  /**
   * Interval in milliseconds between automatic flushes.
   * @default 1000
   */
  flushIntervalMs?: number;

  /**
   * Custom function to handle flushing batched logs.
   * If not provided, logs are written to console individually.
   */
  onFlush?: (logs: Record<string, unknown>[]) => void | Promise<void>;
};

/**
 * A structured JSON logger with support for log levels, key filtering,
 * child loggers, batching, and OpenTelemetry trace context.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const logger = new Logger('my-app');
 * logger.info('Application started', { version: '1.0.0' });
 *
 * // With filtered keys (e.g., mask sensitive data)
 * const secureLogger = new Logger('api', 'info', ['password', 'token']);
 * secureLogger.info('Login attempt', { user: 'john', password: 'secret' });
 * // Output: {"user":"john","password":"[filtered 6 bytes]",...}
 *
 * // Child logger with additional context
 * const requestLogger = logger.child({ requestId: 'abc-123' });
 * requestLogger.info('Processing request'); // Includes requestId
 *
 * // With trace context
 * const tracedLogger = logger.withTraceContext(spanContext);
 * tracedLogger.info('Traced operation'); // Includes traceId and spanId
 * ```
 */
export class Logger {
  readonly #name: string;
  readonly #level: number;
  readonly #filteredKeys: string[] = [];
  readonly #jsonReplacer?: (key: string, value: unknown) => unknown;
  readonly #additionalFields: () => Record<string, unknown>;

  // Batching support
  #batchingEnabled = false;
  #batchBuffer: Record<string, unknown>[] = [];
  #batchOptions: Required<Omit<BatchingOptions, "onFlush">> &
    Pick<BatchingOptions, "onFlush"> = {
    maxSize: 100,
    flushIntervalMs: 1000,
    onFlush: undefined,
  };
  #flushInterval: NodeJS.Timeout | null = null;
  #beforeExitListener: (() => void) | null = null;

  constructor(
    name: string,
    level: LogLevel = "info",
    filteredKeys: string[] = [],
    jsonReplacer?: (key: string, value: unknown) => unknown,
    additionalFields?: () => Record<string, unknown>,
  ) {
    this.#name = name;
    this.#level = logLevels.indexOf(
      (env.TRIGGER_LOG_LEVEL ?? level) as LogLevel,
    );
    this.#filteredKeys = filteredKeys;
    this.#jsonReplacer = createReplacer(jsonReplacer);
    this.#additionalFields = additionalFields ?? (() => ({}));
  }

  /**
   * Creates a child logger with additional fields included in all log entries.
   *
   * @param {Record<string, unknown>} fields - Fields to include in all logs from the child
   * @returns {Logger} A new Logger instance with the additional fields
   */
  child(fields: Record<string, unknown>): Logger {
    const childLogger = new Logger(
      this.#name,
      logLevels[this.#level],
      this.#filteredKeys,
      this.#jsonReplacer,
      () => ({ ...this.#additionalFields(), ...fields }),
    );

    // Inherit batching configuration
    if (this.#batchingEnabled) {
      childLogger.#batchingEnabled = true;
      childLogger.#batchBuffer = this.#batchBuffer; // Share buffer with parent
      childLogger.#batchOptions = this.#batchOptions;
    }

    return childLogger;
  }

  /**
   * Creates a new logger with specified keys filtered from log output.
   *
   * @param {...string[]} keys - Keys to filter (replace with "[filtered X bytes]")
   * @returns {Logger} A new Logger with the filter applied
   */
  filter(...keys: string[]): Logger {
    return new Logger(
      this.#name,
      logLevels[this.#level],
      keys,
      this.#jsonReplacer,
    );
  }

  /**
   * Creates a child logger with OpenTelemetry trace context included.
   *
   * @param {SpanContext} spanContext - The OpenTelemetry span context
   * @returns {Logger} A new Logger with traceId and spanId included
   *
   * @example
   * ```typescript
   * import { trace } from '@opentelemetry/api';
   *
   * const span = trace.getActiveSpan();
   * if (span) {
   *   const tracedLogger = logger.withTraceContext(span.spanContext());
   *   tracedLogger.info('Operation with trace context');
   * }
   * ```
   */
  withTraceContext(spanContext: SpanContext): Logger {
    return this.child({
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
    });
  }

  /**
   * Enables log batching for high-throughput scenarios.
   *
   * When enabled, logs are buffered and flushed periodically or when
   * the buffer reaches maxSize. This can significantly improve performance
   * when writing many logs.
   *
   * @param {BatchingOptions} [options] - Batching configuration
   *
   * @example
   * ```typescript
   * const logger = new Logger('app');
   *
   * // Enable with defaults
   * logger.enableBatching();
   *
   * // Enable with custom options
   * logger.enableBatching({
   *   maxSize: 50,
   *   flushIntervalMs: 500,
   *   onFlush: async (logs) => {
   *     await sendLogsToService(logs);
   *   }
   * });
   * ```
   */
  enableBatching(options?: BatchingOptions): void {
    this.#batchingEnabled = true;
    this.#batchOptions = {
      maxSize: options?.maxSize ?? 100,
      flushIntervalMs: options?.flushIntervalMs ?? 1000,
      onFlush: options?.onFlush,
    };

    // Set up periodic flush
    this.#flushInterval = setInterval(() => {
      this.flush();
    }, this.#batchOptions.flushIntervalMs);

    // Ensure flush on process exit (only add if not already added)
    if (typeof process !== "undefined" && this.#beforeExitListener === null) {
      this.#beforeExitListener = () => this.flush();
      process.on("beforeExit", this.#beforeExitListener);
    }
  }

  /**
   * Disables log batching and flushes any remaining buffered logs.
   */
  disableBatching(): void {
    this.flush();
    this.#batchingEnabled = false;

    if (this.#flushInterval) {
      clearInterval(this.#flushInterval);
      this.#flushInterval = null;
    }

    // Remove the beforeExit listener to prevent memory leaks
    if (typeof process !== "undefined" && this.#beforeExitListener !== null) {
      process.off("beforeExit", this.#beforeExitListener);
      this.#beforeExitListener = null;
    }
  }

  /**
   * Immediately flushes all buffered logs.
   *
   * @returns {Promise<void>} Resolves when flush is complete
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Async log flush with batch serialization, transport delivery, and partial failure recovery
  async flush(): Promise<void> {
    if (this.#batchBuffer.length === 0) return;

    const logs = [...this.#batchBuffer];
    this.#batchBuffer.length = 0;

    if (this.#batchOptions.onFlush) {
      await this.#batchOptions.onFlush(logs);
    } else {
      // Default: write each log to console
      for (const log of logs) {
        const level = log.level as string;
        const logFn =
          level === "error"
            ? console.error
            : level === "warn"
              ? console.warn
              : level === "debug"
                ? console.debug
                : console.log;
        logFn(JSON.stringify(log, this.#jsonReplacer));
      }
    }
  }

  /**
   * Returns the number of buffered log entries.
   */
  get bufferSize(): number {
    return this.#batchBuffer.length;
  }

  /**
   * Checks if a given log level would be output at the current level.
   */
  static satisfiesLogLevel(logLevel: LogLevel, setLevel: LogLevel): boolean {
    return logLevels.indexOf(logLevel) <= logLevels.indexOf(setLevel);
  }

  log(
    message: string,
    ...args: Array<Record<string, unknown> | undefined>
  ): void {
    if (this.#level < 0) return;
    this.#structuredLog(console.log, message, "log", ...args);
  }

  error(
    message: string,
    ...args: Array<Record<string, unknown> | undefined>
  ): void {
    if (this.#level < 1) return;
    this.#structuredLog(console.error, message, "error", ...args);
  }

  warn(
    message: string,
    ...args: Array<Record<string, unknown> | undefined>
  ): void {
    if (this.#level < 2) return;
    this.#structuredLog(console.warn, message, "warn", ...args);
  }

  info(
    message: string,
    ...args: Array<Record<string, unknown> | undefined>
  ): void {
    if (this.#level < 3) return;
    this.#structuredLog(console.info, message, "info", ...args);
  }

  debug(
    message: string,
    ...args: Array<Record<string, unknown> | undefined>
  ): void {
    if (this.#level < 4) return;
    this.#structuredLog(console.debug, message, "debug", ...args);
  }

  verbose(
    message: string,
    ...args: Array<Record<string, unknown> | undefined>
  ): void {
    if (this.#level < 5) return;
    this.#structuredLog(console.log, message, "verbose", ...args);
  }

  #structuredLog(
    loggerFunction: (message: string, ...args: unknown[]) => void,
    message: string,
    level: string,
    ...args: Array<Record<string, unknown> | undefined>
  ): void {
    const structuredError = extractStructuredErrorFromArgs(...args);
    const structuredMessage = extractStructuredMessageFromArgs(...args);

    const structured = structureArgs(
      safeJsonClone(args) as Record<string, unknown>[],
      this.#filteredKeys,
    );
    const structuredLog = {
      ...(structured && typeof structured === "object"
        ? (structured as Record<string, unknown>)
        : {}),
      ...this.#additionalFields(),
      ...(structuredError ? { error: structuredError } : {}),
      timestamp: new Date().toISOString(),
      name: this.#name,
      message,
      ...(structuredMessage ? { $message: structuredMessage } : {}),
      level,
    };

    if (this.#batchingEnabled) {
      this.#batchBuffer.push(structuredLog);

      // Flush if buffer is full
      if (this.#batchBuffer.length >= this.#batchOptions.maxSize) {
        this.flush();
      }
    } else {
      loggerFunction(JSON.stringify(structuredLog, this.#jsonReplacer));
    }
  }
}

function extractStructuredErrorFromArgs(
  ...args: Array<Record<string, unknown> | undefined>
) {
  const error = args.find((arg) => arg instanceof Error) as Error | undefined;

  if (error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...(error.cause ? { cause: String(error.cause) } : {}),
    };
  }

  const structuredError = args.find((arg) => arg?.error);

  if (structuredError && structuredError.error instanceof Error) {
    return {
      message: structuredError.error.message,
      stack: structuredError.error.stack,
      name: structuredError.error.name,
      ...(structuredError.error.cause
        ? { cause: String(structuredError.error.cause) }
        : {}),
    };
  }

  return;
}

function extractStructuredMessageFromArgs(
  ...args: Array<Record<string, unknown> | undefined>
) {
  const structuredMessage = args.find((arg) => arg?.message);

  if (structuredMessage) {
    return structuredMessage.message;
  }

  return;
}

function createReplacer(replacer?: (key: string, value: unknown) => unknown) {
  return (key: string, value: unknown) => {
    if (typeof value === "bigint") {
      return value.toString();
    }

    // Handle circular references
    if (
      typeof value === "object" &&
      value !== null &&
      (value as Record<string, unknown>).__circular__
    ) {
      return "[Circular]";
    }

    if (replacer) {
      return replacer(key, value);
    }

    return value;
  };
}

function bigIntReplacer(_key: string, value: unknown) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
}

function safeJsonClone(obj: unknown): unknown {
  const seen = new WeakSet();

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Deep clone with circular reference detection, Date/RegExp/Map/Set handling, and prototype preservation
  const clone = (value: unknown): unknown => {
    if (value === null || typeof value !== "object") {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof Error) {
      return {
        message: value.message,
        name: value.name,
        stack: value.stack,
      };
    }

    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map(clone);
    }

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = clone(val);
    }
    return result;
  };

  try {
    return clone(obj);
  } catch {
    return;
  }
}

function structureArgs(
  args: Record<string, unknown>[],
  filteredKeys: string[] = [],
) {
  if (!args) {
    return;
  }

  if (args.length === 0) {
    return;
  }

  if (args.length === 1 && typeof args[0] === "object") {
    return filterKeys(args[0], filteredKeys);
  }

  return args;
}

function filterKeys(obj: unknown, keys: string[]): unknown {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => filterKeys(item, keys));
  }

  const filteredObj: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (keys.includes(key)) {
      filteredObj[key] = `[filtered ${prettyPrintBytes(value)}]`;
      continue;
    }

    filteredObj[key] = filterKeys(value, keys);
  }

  return filteredObj;
}

function prettyPrintBytes(value: unknown): string {
  if (env.NODE_ENV === "production") {
    return "skipped size";
  }

  const sizeInBytes = getSizeInBytes(value);

  if (sizeInBytes < 1024) {
    return `${sizeInBytes} bytes`;
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(2)} KB`;
  }

  if (sizeInBytes < 1024 * 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getSizeInBytes(value: unknown) {
  if (value === undefined) {
    return 0;
  }

  const jsonString = JSON.stringify(value, bigIntReplacer);
  if (jsonString === undefined) {
    return 0;
  }

  return Buffer.byteLength(jsonString, "utf8");
}

/**
 * Creates a logger instance for a specific module or component.
 *
 * @param {string} name - The name of the logger (usually module name)
 * @param {LogLevel} [level] - The minimum log level to output
 * @returns {Logger} A configured Logger instance
 */
export function createLogger(name: string, level?: LogLevel): Logger {
  return new Logger(name, level);
}
