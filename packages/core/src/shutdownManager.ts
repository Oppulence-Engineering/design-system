import { isTest } from "std-env";
import { singleton } from "./singleton.ts";
import { SimpleStructuredLogger } from "./utils/structuredLogger.ts";

type ShutdownHandler = NodeJS.SignalsListener;
// We intentionally keep these limited to avoid unexpected issues with signal handling
type ShutdownSignal = Extract<NodeJS.Signals, "SIGTERM" | "SIGINT">;

/**
 * Options for configuring a shutdown handler.
 */
export type ShutdownHandlerOptions = {
  /**
   * Priority order for handler execution. Lower numbers run first.
   * Handlers with the same priority run in registration order.
   * @default 100
   */
  priority?: number;

  /**
   * Maximum time in milliseconds to wait for this handler to complete.
   * If exceeded, the handler is considered failed and shutdown continues.
   * @default undefined (uses global timeout)
   */
  timeout?: number;

  /**
   * Which signals this handler should respond to.
   * @default ["SIGTERM", "SIGINT"]
   */
  signals?: ShutdownSignal[];
};

/**
 * Options for the shutdown process.
 */
export type ShutdownOptions = {
  /**
   * Maximum time in milliseconds to wait for all handlers to complete.
   * After this time, the process will exit forcefully.
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Exit code to use when shutdown completes normally.
   * The actual exit code will be 128 + signal number.
   */
  exitCode?: number;

  /**
   * If true, don't call process.exit() after shutdown.
   * Useful for testing or when you want to handle exit yourself.
   * @default false
   */
  skipExit?: boolean;
};

type HandlerEntry = {
  handler: ShutdownHandler;
  signals: ShutdownSignal[];
  priority: number;
  timeout?: number;
};

/**
 * Manages graceful shutdown of applications by coordinating cleanup handlers.
 *
 * The ShutdownManager:
 * - Listens for SIGTERM and SIGINT signals
 * - Runs registered handlers in priority order
 * - Supports per-handler and global timeouts
 * - Prevents duplicate shutdown execution
 * - Provides cleanup methods for testing
 *
 * @example
 * ```typescript
 * import { shutdownManager } from '@oppulence/core';
 *
 * // Register handlers with priority (lower runs first)
 * shutdownManager.register('connections', async () => {
 *   await closeConnections();
 * }, { priority: 10 });
 *
 * shutdownManager.register('database', async () => {
 *   await database.close();
 * }, { priority: 20 });
 *
 * shutdownManager.register('cleanup', async () => {
 *   await cleanupTempFiles();
 * }, { priority: 100 });
 * ```
 */
export class ShutdownManager {
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;
  private readonly signalNumbers: Record<ShutdownSignal, number> = {
    SIGINT: 2,
    SIGTERM: 15,
  };

  private readonly logger = new SimpleStructuredLogger("shutdownManager");
  private readonly handlers: Map<string, HandlerEntry> = new Map();

  /** Bound signal handlers for cleanup */
  private readonly signalHandlers: Map<ShutdownSignal, () => void> = new Map();

  /** Default global timeout for shutdown */
  private defaultTimeout = 30_000;

  /** Global shutdown timeout handle for cleanup */
  private shutdownTimeoutHandle: NodeJS.Timeout | null = null;

  constructor(private readonly disableForTesting = isTest) {
    if (disableForTesting) return;

    // Create bound handlers and store references for cleanup
    const sigtermHandler = () => this.shutdown("SIGTERM");
    const sigintHandler = () => this.shutdown("SIGINT");

    this.signalHandlers.set("SIGTERM", sigtermHandler);
    this.signalHandlers.set("SIGINT", sigintHandler);

    process.on("SIGTERM", sigtermHandler);
    process.on("SIGINT", sigintHandler);
  }

  /**
   * Registers a shutdown handler with optional priority and timeout.
   *
   * @param {string} name - Unique identifier for the handler
   * @param {ShutdownHandler} handler - Async function to run during shutdown
   * @param {ShutdownHandlerOptions} [options] - Configuration options
   *
   * @throws {Error} If a handler with the same name is already registered
   *
   * @example
   * ```typescript
   * // High priority handler (runs first)
   * shutdownManager.register('stopAcceptingRequests', async () => {
   *   server.close();
   * }, { priority: 1 });
   *
   * // Handler with timeout
   * shutdownManager.register('flushLogs', async () => {
   *   await logger.flush();
   * }, { timeout: 5000, priority: 50 });
   *
   * // Handler only for SIGTERM
   * shutdownManager.register('saveState', async () => {
   *   await saveApplicationState();
   * }, { signals: ['SIGTERM'] });
   * ```
   */
  register(
    name: string,
    handler: ShutdownHandler,
    options?: ShutdownHandlerOptions,
  ) {
    if (!this.isEnabled()) return;

    if (this.handlers.has(name)) {
      throw new Error(`Shutdown handler "${name}" already registered`);
    }

    this.handlers.set(name, {
      handler,
      signals: options?.signals ?? ["SIGTERM", "SIGINT"],
      priority: options?.priority ?? 100,
      timeout: options?.timeout,
    });
  }

  /**
   * Unregisters a previously registered shutdown handler.
   *
   * @param {string} name - The name of the handler to unregister
   *
   * @throws {Error} If no handler with the given name exists
   */
  unregister(name: string) {
    if (!this.isEnabled()) return;

    if (!this.handlers.has(name)) {
      throw new Error(`Shutdown handler "${name}" not registered`);
    }

    this.handlers.delete(name);
  }

  /**
   * Checks if a handler is registered.
   *
   * @param {string} name - The name of the handler to check
   * @returns {boolean} True if the handler is registered
   */
  has(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * Gets the number of registered handlers.
   *
   * @returns {number} The count of registered handlers
   */
  get size(): number {
    return this.handlers.size;
  }

  /**
   * Initiates graceful shutdown.
   *
   * Handlers are executed in priority order (lowest first). If a handler
   * exceeds its timeout, it's marked as failed and shutdown continues.
   * After all handlers complete (or timeout), the process exits.
   *
   * @param {ShutdownSignal} signal - The signal that triggered shutdown
   * @param {ShutdownOptions} [options] - Configuration for the shutdown process
   *
   * @returns {Promise<void>} Resolves when shutdown is complete
   *
   * @example
   * ```typescript
   * // Manual shutdown with custom timeout
   * await shutdownManager.shutdown('SIGTERM', {
   *   timeout: 60000, // 1 minute
   *   skipExit: true  // Don't exit, handle it ourselves
   * });
   * ```
   */
  shutdown(signal: ShutdownSignal, options?: ShutdownOptions): Promise<void> {
    if (!this.isEnabled()) return Promise.resolve();

    // Prevent concurrent shutdown executions by returning existing promise
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    const timeout = options?.timeout ?? this.defaultTimeout;

    // Create shutdown promise with global timeout
    const { promise: timeoutPromise, timer } = this._createTimeoutPromise(
      timeout,
      signal,
      options?.skipExit,
    );
    this.shutdownTimeoutHandle = timer;

    this.shutdownPromise = Promise.race([
      this._doShutdown(signal, options),
      timeoutPromise,
    ])
      .catch((err) => {
        this.logger.error("Shutdown error or timeout", { error: err });
      })
      .finally(() => {
        // Clear the timeout to prevent leaks when shutdown completes early
        if (this.shutdownTimeoutHandle) {
          clearTimeout(this.shutdownTimeoutHandle);
          this.shutdownTimeoutHandle = null;
        }
      });

    return this.shutdownPromise;
  }

  /**
   * Creates a timeout promise that rejects after the specified time.
   * Returns both the promise and the timeout handle for cleanup.
   */
  private _createTimeoutPromise(
    timeoutMs: number,
    signal: ShutdownSignal,
    skipExit?: boolean,
  ): { promise: Promise<never>; timer: NodeJS.Timeout } {
    let timer: NodeJS.Timeout;
    const promise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        this.logger.error(
          `Shutdown timeout exceeded (${timeoutMs}ms), forcing exit`,
        );
        if (!skipExit && this.isEnabled()) {
          process.exit(128 + this.signalNumbers[signal]);
        }
        reject(new Error("Shutdown timeout exceeded"));
      }, timeoutMs);
    });
    // TypeScript doesn't know timer is assigned in the Promise executor
    // but it runs synchronously, so timer is guaranteed to be set
    // biome-ignore lint/style/noNonNullAssertion: timer is assigned synchronously in the Promise executor above
    return { promise, timer: timer! };
  }

  /**
   * Internal shutdown implementation that executes handlers and exits.
   */
  private async _doShutdown(
    signal: ShutdownSignal,
    options?: ShutdownOptions,
  ): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    this.logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Get handlers that are registered for this signal, sorted by priority
    const handlersToRun = Array.from(this.handlers.entries())
      .filter(([_, entry]) => entry.signals.includes(signal))
      .sort((a, b) => a[1].priority - b[1].priority);

    this.logger.info(`Running ${handlersToRun.length} shutdown handlers`, {
      handlers: handlersToRun.map(([name, entry]) => ({
        name,
        priority: entry.priority,
      })),
    });

    const results: Array<{ name: string; success: boolean; error?: unknown }> =
      [];

    // Execute handlers sequentially in priority order
    for (const [name, entry] of handlersToRun) {
      try {
        this.logger.info(`Running shutdown handler: ${name}`, {
          priority: entry.priority,
        });

        const handlerPromise = Promise.resolve(entry.handler(signal));

        if (entry.timeout) {
          // Per-handler timeout with cleanup to prevent leaks
          let handlerTimer: NodeJS.Timeout;
          const timeoutPromise = new Promise<never>((_, reject) => {
            handlerTimer = setTimeout(() => {
              reject(
                new Error(
                  `Handler "${name}" timed out after ${entry.timeout}ms`,
                ),
              );
            }, entry.timeout);
          });

          try {
            await Promise.race([handlerPromise, timeoutPromise]);
          } finally {
            // biome-ignore lint/style/noNonNullAssertion: handlerTimer is assigned synchronously in the Promise executor above
            clearTimeout(handlerTimer!);
          }
        } else {
          await handlerPromise;
        }

        this.logger.info(`Shutdown handler completed: ${name}`);
        results.push({ name, success: true });
      } catch (error) {
        this.logger.error(`Shutdown handler failed: ${name}`, { error });
        results.push({ name, success: false, error });
        // Continue with other handlers even if one fails
      }
    }

    // Log summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    this.logger.info("Shutdown complete", {
      successful,
      failed,
      total: results.length,
    });

    if (!options?.skipExit && this.isEnabled()) {
      // Exit with the correct signal number
      process.exit(128 + this.signalNumbers[signal]);
    }
  }

  private isEnabled() {
    if (!this.disableForTesting) {
      return true;
    }

    return !isTest;
  }

  /**
   * Sets the default global timeout for shutdown.
   *
   * @param {number} timeoutMs - Timeout in milliseconds
   */
  setDefaultTimeout(timeoutMs: number) {
    this.defaultTimeout = timeoutMs;
  }

  /**
   * Removes signal handlers from the process.
   * Should be called when the ShutdownManager instance is no longer needed
   * to prevent memory leaks and duplicate handlers.
   */
  public cleanup() {
    for (const [signal, handler] of this.signalHandlers.entries()) {
      process.removeListener(signal, handler);
    }
    this.signalHandlers.clear();
    this.handlers.clear();
    this.isShuttingDown = false;
    this.shutdownPromise = null;
    if (this.shutdownTimeoutHandle) {
      clearTimeout(this.shutdownTimeoutHandle);
      this.shutdownTimeoutHandle = null;
    }
  }

  /**
   * Resets the shutdown state, allowing shutdown to be triggered again.
   * Primarily useful for testing.
   */
  public reset() {
    this.isShuttingDown = false;
    this.shutdownPromise = null;
    if (this.shutdownTimeoutHandle) {
      clearTimeout(this.shutdownTimeoutHandle);
      this.shutdownTimeoutHandle = null;
    }
  }

  /**
   * Checks if shutdown is currently in progress.
   *
   * @returns {boolean} True if shutdown has been initiated
   */
  public isInProgress(): boolean {
    return this.isShuttingDown;
  }

  // Only for testing
  public _getHandlersForTesting(): ReadonlyMap<string, HandlerEntry> {
    return new Map(this.handlers);
  }
}

export const shutdownManager = singleton(
  "shutdownManager",
  () => new ShutdownManager(),
);
