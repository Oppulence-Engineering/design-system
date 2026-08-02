/**
 * Options for configuring debounce behavior.
 */
export type DebounceOptions = {
  /**
   * If true, the function will be called on the leading edge of the timeout.
   * @default false
   */
  leading?: boolean;

  /**
   * If true, the function will be called on the trailing edge of the timeout.
   * @default true
   */
  trailing?: boolean;

  /**
   * Maximum time the function can be delayed before it's forced to execute.
   * Useful for ensuring the function eventually runs even with continuous calls.
   */
  maxWait?: number;
};

/**
 * A debounced function with additional control methods.
 */
export type DebouncedFunction<T extends (...args: unknown[]) => unknown> = {
  /**
   * Call the debounced function. Arguments are passed to the underlying function.
   */
  (...args: Parameters<T>): void;

  /**
   * Cancel any pending invocation of the debounced function.
   */
  cancel(): void;

  /**
   * Immediately invoke any pending debounced function call.
   * If there is no pending call, this does nothing.
   */
  flush(): void;

  /**
   * Check if there is a pending invocation.
   * @returns True if the function is scheduled to be called.
   */
  pending(): boolean;
};

/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified delay has elapsed since the last invocation.
 *
 * The debounced function includes methods to cancel pending invocations,
 * flush (immediately invoke) pending calls, and check if a call is pending.
 *
 * @template T - The function type to debounce
 *
 * @param {T} func - The function to debounce
 * @param {number} delayMs - The number of milliseconds to delay
 * @param {DebounceOptions} [options] - Optional configuration
 *
 * @returns {DebouncedFunction<T>} The debounced function with control methods
 *
 * @example
 * ```typescript
 * // Basic usage
 * const debouncedSave = debounce(saveDocument, 1000);
 *
 * // Call multiple times - only the last call executes after 1 second
 * debouncedSave(doc1);
 * debouncedSave(doc2);
 * debouncedSave(doc3); // Only this executes
 *
 * // Cancel pending call
 * debouncedSave(doc);
 * debouncedSave.cancel(); // doc won't be saved
 *
 * // Immediately execute pending call
 * debouncedSave(doc);
 * debouncedSave.flush(); // doc is saved immediately
 *
 * // Check if call is pending
 * debouncedSave(doc);
 * console.log(debouncedSave.pending()); // true
 * ```
 *
 * @example
 * ```typescript
 * // Leading edge execution (execute immediately, then debounce)
 * const debouncedSearch = debounce(search, 300, { leading: true, trailing: false });
 *
 * debouncedSearch('a'); // Executes immediately
 * debouncedSearch('ab'); // Ignored
 * debouncedSearch('abc'); // Ignored
 * // After 300ms of no calls, next call will execute immediately again
 * ```
 *
 * @example
 * ```typescript
 * // Maximum wait time (ensure function runs at least every maxWait ms)
 * const debouncedUpdate = debounce(updateUI, 100, { maxWait: 1000 });
 *
 * // Even with continuous calls, updateUI will run at least once per second
 * setInterval(() => debouncedUpdate(data), 50);
 * ```
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delayMs: number,
  options?: DebounceOptions,
): DebouncedFunction<T> {
  const { leading = false, trailing = true, maxWait } = options ?? {};

  let timeoutId: NodeJS.Timeout | null = null;
  let maxWaitTimeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime: number | null = null;
  /*
   * `null` until the first invocation, rather than 0. As 0 it read as an
   * invocation at the epoch, so the first burst computed a time-since-invoke of
   * decades, `maxWait` minus that clamped to 0, and the maxWait timer fired on
   * the next tick — a debounce with `maxWait` invoked almost immediately.
   */
  let lastInvokeTime: number | null = null;

  const invoke = () => {
    lastInvokeTime = Date.now();
    if (lastArgs !== null) {
      const args = lastArgs;
      lastArgs = null;
      func(...args);
    }
  };

  const clearTimers = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (maxWaitTimeoutId) {
      clearTimeout(maxWaitTimeoutId);
      maxWaitTimeoutId = null;
    }
  };

  /*
   * Ends the current burst `delayMs` from now, running the trailing call if one
   * is owed. Armed on every call and again after a maxWait invocation, whether
   * or not `trailing` is set: clearing `lastCallTime` is what lets a later call
   * count as the start of a new burst.
   *
   * It used to be armed only when `trailing` was set, so with
   * `{ leading: true, trailing: false }` the second call cancelled the timer and
   * nothing re-armed it. `lastCallTime` then stayed set forever and the leading
   * edge — which only fires on the first call of a burst — never fired again for
   * the life of the function.
   */
  const armBurstTimer = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      lastCallTime = null;

      if (maxWaitTimeoutId) {
        clearTimeout(maxWaitTimeoutId);
        maxWaitTimeoutId = null;
      }

      // Guarded on lastArgs so a lone leading-edge call, whose arguments
      // `invoke` already consumed, is not invoked a second time.
      if (trailing && lastArgs !== null) {
        invoke();
      }
    }, delayMs);
  };

  const debounced = (...args: Parameters<T>) => {
    const now = Date.now();
    const isFirstCall = lastCallTime === null;
    lastCallTime = now;
    lastArgs = args;

    // Leading edge execution
    if (leading && isFirstCall) {
      invoke();
    }

    armBurstTimer();

    // Set up max wait timeout
    if (maxWait !== undefined && !maxWaitTimeoutId && lastArgs !== null) {
      const timeSinceLastInvoke =
        lastInvokeTime === null ? 0 : now - lastInvokeTime;
      const remainingMaxWait = Math.max(0, maxWait - timeSinceLastInvoke);

      maxWaitTimeoutId = setTimeout(() => {
        maxWaitTimeoutId = null;

        if (lastArgs !== null) {
          invoke();
          /*
           * The burst continues rather than being declared over. Clearing
           * `lastCallTime` here instead made the next call — often in the same
           * millisecond, since maxWait fires mid-burst — look like the start of
           * a fresh burst and fire the leading edge immediately after this
           * invocation. `throttle` passes maxWait and leads by default, so it
           * fired twice per window instead of the once it promises.
           */
          armBurstTimer();
        }
      }, remainingMaxWait);
    }
  };

  debounced.cancel = () => {
    clearTimers();
    lastArgs = null;
    lastCallTime = null;
  };

  /*
   * Both of these ask the same question — is an invocation actually scheduled?
   * `pending` used to report any live timer, so it stayed true through the
   * quiet period after a leading-edge call that had nothing left to run, and
   * true forever once a non-trailing call left a cleared-but-not-nulled id
   * behind. Captured arguments alone are not a pending call: with `trailing`
   * off and no `maxWait`, nothing will ever consume them.
   */
  const hasScheduledInvocation = () =>
    lastArgs !== null &&
    (maxWaitTimeoutId !== null || (trailing && timeoutId !== null));

  debounced.flush = () => {
    if (hasScheduledInvocation()) {
      clearTimers();
      invoke();
      lastCallTime = null;
    }
  };

  debounced.pending = hasScheduledInvocation;

  return debounced;
}

/**
 * Creates a throttled function that only invokes the provided function
 * at most once per every specified number of milliseconds.
 *
 * Unlike debounce, throttle guarantees the function runs at a regular interval
 * during continuous calls, rather than waiting for calls to stop.
 *
 * @template T - The function type to throttle
 *
 * @param {T} func - The function to throttle
 * @param {number} limitMs - The minimum number of milliseconds between invocations
 * @param {object} [options] - Optional configuration
 * @param {boolean} [options.leading=true] - Invoke on the leading edge
 * @param {boolean} [options.trailing=true] - Invoke on the trailing edge
 *
 * @returns {DebouncedFunction<T>} The throttled function with control methods
 *
 * @example
 * ```typescript
 * // Basic throttle - runs at most once per 100ms
 * const throttledScroll = throttle(handleScroll, 100);
 * window.addEventListener('scroll', throttledScroll);
 *
 * // Disable trailing call
 * const throttledResize = throttle(handleResize, 200, { trailing: false });
 * ```
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limitMs: number,
  options?: { leading?: boolean; trailing?: boolean },
): DebouncedFunction<T> {
  return debounce(func, limitMs, {
    leading: options?.leading ?? true,
    trailing: options?.trailing ?? true,
    maxWait: limitMs,
  });
}
