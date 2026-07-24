/**
 * Configuration options for the IntervalService class.
 *
 * @property {() => Promise<void>} onInterval - The async function to execute at each interval
 * @property {(error: unknown) => Promise<void>} [onError] - Optional error handler for interval execution failures
 * @property {number} [intervalMs=45000] - The interval duration in milliseconds between executions
 * @property {boolean} [leadingEdge=false] - Whether to execute immediately on start (true) or wait for first interval (false)
 */
type IntervalServiceOptions = {
  onInterval: () => Promise<void>;
  onError?: (error: unknown) => Promise<void>;
  intervalMs?: number;
  leadingEdge?: boolean;
};

/**
 * A robust interval service that manages periodic execution of async functions with error handling.
 *
 * The IntervalService provides a reliable way to execute async functions at regular intervals
 * with built-in error handling, execution state management, and prevention of overlapping
 * executions. It supports both leading-edge (immediate) and trailing-edge (delayed) execution
 * patterns and provides methods to control the interval lifecycle.
 *
 * Key features:
 * - Prevents overlapping executions by tracking execution state
 * - Configurable error handling with optional error callback
 * - Support for leading-edge or trailing-edge execution timing
 * - Dynamic interval adjustment during runtime
 * - Safe start/stop operations with state tracking
 * - Automatic cleanup of scheduled timeouts
 *
 * @example
 * ```typescript
 * const service = new IntervalService({
 *   onInterval: async () => {
 *     console.log('Executing periodic task...');
 *     await performAsyncWork();
 *   },
 *   onError: async (error) => {
 *     console.error('Interval execution failed:', error);
 *   },
 *   intervalMs: 30000, // 30 seconds
 *   leadingEdge: true
 * });
 *
 * service.start();
 * // Later...
 * service.stop();
 * ```
 */
export class IntervalService {
  /** The async function to execute at each interval */
  private readonly _onInterval: () => Promise<void>;
  /** Optional error handler for interval execution failures */
  private readonly _onError?: (error: unknown) => Promise<void>;

  /** The interval duration in milliseconds between executions */
  private _intervalMs: number;
  /** Reference to the currently scheduled timeout for the next interval execution */
  private _nextInterval: NodeJS.Timeout | undefined;
  /** Whether to execute immediately on start (true) or wait for first interval (false) */
  private readonly _leadingEdge: boolean;
  /** Whether the interval service is currently enabled and running */
  private _isEnabled: boolean;
  /** Whether an interval execution is currently in progress */
  private _isExecuting: boolean;

  /**
   * Creates a new IntervalService instance with the specified configuration.
   *
   * @param {IntervalServiceOptions} opts - Configuration options for the interval service
   */
  constructor(opts: IntervalServiceOptions) {
    this._onInterval = opts.onInterval;
    this._onError = opts.onError;

    this._intervalMs = opts.intervalMs ?? 45_000;
    this._nextInterval = undefined;
    this._leadingEdge = opts.leadingEdge ?? false;
    this._isEnabled = false;
    this._isExecuting = false;
  }

  /**
   * Starts the interval service and begins periodic execution.
   *
   * If the service is already enabled, this method has no effect. When starting,
   * the service will either execute immediately (if leadingEdge is true) or
   * schedule the first execution after the configured interval.
   *
   * @example
   * ```typescript
   * const service = new IntervalService({ onInterval: myAsyncFunction });
   * service.start(); // Begins periodic execution
   * ```
   */
  start() {
    if (this._isEnabled) {
      return;
    }

    this._isEnabled = true;

    if (this._leadingEdge) {
      this.#doInterval();
    } else {
      this.#scheduleNextInterval();
    }
  }

  /**
   * Stops the interval service and cancels any scheduled executions.
   *
   * This method immediately disables the service and clears any pending timeouts.
   * If an execution is currently in progress, it will be allowed to complete,
   * but no further executions will be scheduled.
   *
   * @returns {{ isExecuting: boolean }} An object indicating whether an execution was in progress when stopped
   *
   * @example
   * ```typescript
   * const result = service.stop();
   * if (result.isExecuting) {
   *   console.log('Service stopped while execution was in progress');
   * }
   * ```
   */
  stop(): { isExecuting: boolean } {
    const returnValue = {
      isExecuting: this._isExecuting,
    };

    if (!this._isEnabled) {
      return returnValue;
    }

    this._isEnabled = false;
    this.#clearNextInterval();

    return returnValue;
  }

  /**
   * Resets the current interval timer without affecting the enabled state.
   *
   * This method cancels the currently scheduled execution and immediately
   * schedules a new one with the full interval delay. It has no effect if
   * the service is disabled or if an execution is currently in progress.
   *
   * Useful for implementing backoff strategies or responding to external events
   * that should reset the timing cycle.
   *
   * @example
   * ```typescript
   * // Reset the interval after receiving external data
   * service.resetCurrentInterval();
   * ```
   */
  resetCurrentInterval() {
    if (!this._isEnabled) {
      return;
    }

    if (this._isExecuting) {
      return;
    }

    this.#clearNextInterval();
    this.#scheduleNextInterval();
  }

  /**
   * Updates the interval duration and resets the current interval timer.
   *
   * This method changes the interval duration and immediately applies the new
   * timing by resetting the current interval. The change takes effect for the
   * next scheduled execution.
   *
   * @param {number} intervalMs - The new interval duration in milliseconds
   *
   * @example
   * ```typescript
   * // Change from 30 seconds to 60 seconds
   * service.updateInterval(60000);
   * ```
   */
  updateInterval(intervalMs: number) {
    this._intervalMs = intervalMs;
    this.resetCurrentInterval();
  }

  /**
   * Gets the current interval duration in milliseconds.
   *
   * @returns {number} The current interval duration in milliseconds
   */
  get intervalMs() {
    return this._intervalMs;
  }

  /**
   * Executes the interval function with comprehensive error handling and state management.
   *
   * This private method handles the actual execution of the interval function,
   * including:
   * - Clearing any existing scheduled timeouts
   * - Checking service enabled state and preventing overlapping executions
   * - Executing the configured interval function with error handling
   * - Calling the error handler if execution fails
   * - Scheduling the next interval execution
   * - Managing execution state flags
   *
   * The method uses arrow function syntax to maintain proper 'this' binding
   * when used as a timeout callback.
   *
   * @private
   */
  readonly #doInterval = async () => {
    this.#clearNextInterval();

    if (!this._isEnabled) {
      return;
    }

    if (this._isExecuting) {
      console.error("Interval handler already running, skipping");
      return;
    }

    this._isExecuting = true;

    try {
      await this._onInterval();
    } catch (error) {
      if (this._onError) {
        try {
          await this._onError(error);
        } catch (error) {
          console.error("Error during interval error handler", error);
        }
      }
    } finally {
      this._isExecuting = false;
      if (this._isEnabled) {
        this.#scheduleNextInterval();
      }
    }
  };

  /**
   * Clears the currently scheduled timeout for the next interval execution.
   *
   * This private method safely clears any existing timeout reference to prevent
   * memory leaks and ensure clean state management when stopping or rescheduling
   * intervals.
   *
   * @private
   */
  #clearNextInterval() {
    if (this._nextInterval) {
      clearTimeout(this._nextInterval);
    }
  }

  /**
   * Schedules the next interval execution using setTimeout.
   *
   * This private method creates a new timeout that will trigger the interval
   * execution after the configured interval duration. The timeout reference
   * is stored for potential cancellation.
   *
   * @private
   */
  #scheduleNextInterval() {
    this._nextInterval = setTimeout(this.#doInterval, this._intervalMs);
  }
}
