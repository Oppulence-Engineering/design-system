/**
 * Pauses execution for the specified number of milliseconds.
 *
 * This is a simple utility for introducing delays in async code.
 * It returns a Promise that resolves after the specified time.
 *
 * @param {number} ms - The number of milliseconds to sleep
 *
 * @returns {Promise<void>} A promise that resolves after the delay
 *
 * @example
 * ```typescript
 * // Simple delay
 * await sleep(1000); // Wait 1 second
 *
 * // Rate limiting between API calls
 * for (const item of items) {
 *   await processItem(item);
 *   await sleep(100); // 100ms between each call
 * }
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pauses execution for the specified time, but can be cancelled via AbortSignal.
 *
 * This is useful when you need to wait but also want the ability to cancel
 * the wait early, such as during shutdown or when user interaction occurs.
 *
 * @param {number} ms - The number of milliseconds to sleep
 * @param {AbortSignal} signal - The AbortSignal to monitor for cancellation
 *
 * @returns {Promise<void>} A promise that resolves after the delay or rejects if aborted
 *
 * @throws {DOMException} AbortError if the signal is aborted before the delay completes
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 *
 * // Cancel after 5 seconds if still sleeping
 * setTimeout(() => controller.abort(), 5000);
 *
 * try {
 *   await sleepWithSignal(10000, controller.signal);
 *   console.log('Slept for 10 seconds');
 * } catch (error) {
 *   if (error.name === 'AbortError') {
 *     console.log('Sleep was cancelled');
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Use with shutdown handling
 * async function longRunningTask(signal: AbortSignal) {
 *   while (!signal.aborted) {
 *     await doWork();
 *     await sleepWithSignal(1000, signal); // Cancellable wait
 *   }
 * }
 * ```
 */
export function sleepWithSignal(
  ms: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Sleep aborted", "AbortError"));
      return;
    }

    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(new DOMException("Sleep aborted", "AbortError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Retries a function with exponential backoff.
 *
 * Repeatedly calls the provided function until it succeeds or the maximum
 * number of attempts is reached. Uses exponential backoff with optional
 * jitter to spread out retry attempts.
 *
 * @template T - The return type of the function
 *
 * @param {() => Promise<T>} fn - The async function to retry
 * @param {object} [options] - Retry configuration
 * @param {number} [options.maxAttempts=3] - Maximum number of attempts
 * @param {number} [options.initialDelayMs=1000] - Initial delay before first retry
 * @param {number} [options.maxDelayMs=30000] - Maximum delay between retries
 * @param {number} [options.factor=2] - Exponential backoff factor
 * @param {boolean} [options.jitter=true] - Add random jitter to delays
 * @param {(attempt: number, error: Error) => void} [options.onRetry] - Callback on each retry
 * @param {(error: Error) => boolean} [options.shouldRetry] - Function to determine if should retry
 * @param {AbortSignal} [options.signal] - AbortSignal to cancel retries
 *
 * @returns {Promise<T>} The result of the successful function call
 *
 * @throws {Error} The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * // Basic retry
 * const result = await retry(() => fetch('/api/data').then(r => r.json()));
 *
 * // With custom options
 * const result = await retry(
 *   () => unstableApiCall(),
 *   {
 *     maxAttempts: 5,
 *     initialDelayMs: 500,
 *     onRetry: (attempt, error) => {
 *       console.log(`Attempt ${attempt} failed: ${error.message}`);
 *     },
 *     shouldRetry: (error) => {
 *       // Only retry on specific errors
 *       return error.message.includes('timeout');
 *     }
 *   }
 * );
 * ```
 *
 * @example
 * ```typescript
 * // With cancellation
 * const controller = new AbortController();
 *
 * try {
 *   const result = await retry(
 *     () => fetchWithRetry(),
 *     { signal: controller.signal }
 *   );
 * } catch (error) {
 *   if (error.name === 'AbortError') {
 *     console.log('Retry was cancelled');
 *   }
 * }
 * ```
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Retry utility with exponential backoff, jitter, abort signal support, and configurable error filtering
export async function retry<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    factor?: number;
    jitter?: boolean;
    onRetry?: (attempt: number, error: Error) => void;
    shouldRetry?: (error: Error) => boolean;
    signal?: AbortSignal;
  },
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30_000,
    factor = 2,
    jitter = true,
    onRetry,
    shouldRetry = () => true,
    signal,
  } = options ?? {};

  let lastError = new Error("Retry failed");
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Check if aborted
    if (signal?.aborted) {
      throw new DOMException("Retry aborted", "AbortError");
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError;
      }

      // Call onRetry callback
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Calculate delay with optional jitter
      let currentDelay = Math.min(delay, maxDelayMs);
      if (jitter) {
        currentDelay *= 0.5 + Math.random();
      }

      // Wait before next attempt
      if (signal) {
        await sleepWithSignal(currentDelay, signal);
      } else {
        await sleep(currentDelay);
      }

      // Increase delay for next attempt
      delay *= factor;
    }
  }

  throw lastError ?? new Error("Retry failed");
}

/**
 * Delays calling a function by the specified amount of time.
 *
 * Similar to setTimeout but returns a Promise, making it easier to use
 * with async/await. Also returns a cancel function.
 *
 * @template T - The return type of the function
 *
 * @param {() => T} fn - The function to call after the delay
 * @param {number} ms - The delay in milliseconds
 *
 * @returns {{ promise: Promise<T>; cancel: () => void }} An object with the promise and cancel function
 *
 * @example
 * ```typescript
 * // Basic delayed execution
 * const { promise } = delay(() => console.log('Hello!'), 1000);
 * await promise; // Logs "Hello!" after 1 second
 *
 * // With cancellation
 * const { promise, cancel } = delay(() => sendNotification(), 5000);
 *
 * // User dismisses the notification prompt
 * cancel();
 *
 * try {
 *   await promise;
 * } catch (error) {
 *   if (error.message === 'Cancelled') {
 *     console.log('Notification was cancelled');
 *   }
 * }
 * ```
 */
export function delay<T>(
  fn: () => T,
  ms: number,
): { promise: Promise<T>; cancel: () => void } {
  let timeoutId: NodeJS.Timeout;
  let rejectFn: (reason?: unknown) => void;

  const promise = new Promise<T>((resolve, reject) => {
    rejectFn = reject;
    timeoutId = setTimeout(() => {
      try {
        resolve(fn());
      } catch (error) {
        reject(error);
      }
    }, ms);
  });

  const cancel = () => {
    clearTimeout(timeoutId);
    rejectFn(new Error("Cancelled"));
  };

  return { promise, cancel };
}
