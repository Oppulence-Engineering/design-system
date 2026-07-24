/**
 * Represents a successful result from a try-catch operation.
 *
 * This type is a tuple where the first element is always `null` (indicating no error)
 * and the second element contains the successful result data of type `T`.
 *
 * @template T - The type of the successful result data
 *
 * @example
 * ```typescript
 * const success: Success<string> = [null, "Hello World"];
 * const [error, data] = success;
 * // error is null, data is "Hello World"
 * ```
 */
export type Success<T> = [null, T];

/**
 * Represents a failed result from a try-catch operation.
 *
 * This type is a tuple where the first element contains the error of type `E`
 * and the second element is always `null` (indicating no successful data).
 *
 * @template E - The type of the error, defaults to Error
 *
 * @example
 * ```typescript
 * const failure: Failure<Error> = [new Error("Something went wrong"), null];
 * const [error, data] = failure;
 * // error is Error instance, data is null
 * ```
 */
export type Failure<E> = [E, null];

/**
 * Union type representing either a successful or failed result from a try-catch operation.
 *
 * This type follows the Go-style error handling pattern where functions return a tuple
 * containing either an error and null data, or null error and the actual data. This
 * approach makes error handling explicit and forces developers to handle both success
 * and failure cases.
 *
 * The Result type is discriminated by checking if the first element (error) is null:
 * - If first element is null, the second element contains the successful data
 * - If first element is not null, it contains the error and second element is null
 *
 * @template T - The type of the successful result data
 * @template E - The type of the error, defaults to Error
 *
 * @example
 * ```typescript
 * function processResult(result: Result<string, CustomError>) {
 *   const [error, data] = result;
 *   if (error) {
 *     console.error("Operation failed:", error.message);
 *     return;
 *   }
 *   console.log("Operation succeeded:", data);
 * }
 * ```
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

/**
 * Wraps a Promise in a try-catch block and returns a Result tuple instead of throwing.
 *
 * This function implements Go-style error handling for JavaScript/TypeScript Promises.
 * Instead of allowing promises to throw exceptions, it catches any errors and returns
 * them as part of a structured result tuple. This approach makes error handling explicit
 * and prevents unhandled promise rejections.
 *
 * The function always returns a Promise that resolves to a Result tuple:
 * - On success: `[null, data]` where data is the resolved value
 * - On failure: `[error, null]` where error is the caught exception
 *
 * This pattern is particularly useful for:
 * - Making error handling explicit and mandatory
 * - Avoiding try-catch blocks in calling code
 * - Preventing unhandled promise rejections
 * - Creating more predictable async code flow
 *
 * @template T - The type of the successful result data from the promise
 * @template E - The type of the error that might be thrown, defaults to Error
 *
 * @param {Promise<T>} promise - The promise to wrap in error handling
 *
 * @returns {Promise<Result<T, E>>} A promise that always resolves to a Result tuple,
 *   never rejects
 *
 * @example
 * ```typescript
 * // Basic usage with fetch
 * const [error, response] = await tryCatch(fetch('/api/data'));
 * if (error) {
 *   console.error('Fetch failed:', error);
 *   return;
 * }
 * console.log('Fetch succeeded:', response.status);
 * ```
 *
 * @example
 * ```typescript
 * // Usage with custom error types
 * class ApiError extends Error {
 *   constructor(public status: number, message: string) {
 *     super(message);
 *   }
 * }
 *
 * async function fetchUser(id: string) {
 *   const [error, user] = await tryCatch<User, ApiError>(
 *     api.getUser(id)
 *   );
 *
 *   if (error) {
 *     if (error.status === 404) {
 *       return null; // User not found
 *     }
 *     throw error; // Re-throw unexpected errors
 *   }
 *
 *   return user;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Chaining multiple async operations
 * async function processData() {
 *   const [fetchError, rawData] = await tryCatch(fetchRawData());
 *   if (fetchError) return [fetchError, null];
 *
 *   const [parseError, parsedData] = await tryCatch(parseData(rawData));
 *   if (parseError) return [parseError, null];
 *
 *   const [saveError, result] = await tryCatch(saveData(parsedData));
 *   if (saveError) return [saveError, null];
 *
 *   return [null, result];
 * }
 * ```
 */
export async function tryCatch<T, E = Error>(
  promise: Promise<T>,
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return [null, data];
  } catch (error) {
    return [error as E, null];
  }
}

/**
 * Synchronous version of tryCatch for non-async operations.
 *
 * Wraps a synchronous function call in a try-catch block and returns a Result tuple
 * instead of throwing. This is useful for operations that might throw synchronously,
 * such as JSON parsing or type validations.
 *
 * @template T - The type of the successful result data
 * @template E - The type of the error that might be thrown, defaults to Error
 *
 * @param {() => T} fn - The synchronous function to execute
 *
 * @returns {Result<T, E>} A Result tuple containing either the result or the error
 *
 * @example
 * ```typescript
 * // JSON parsing
 * const [error, data] = tryCatchSync(() => JSON.parse(jsonString));
 * if (error) {
 *   console.error('Invalid JSON:', error.message);
 *   return;
 * }
 * console.log('Parsed data:', data);
 * ```
 *
 * @example
 * ```typescript
 * // Zod validation
 * const [error, user] = tryCatchSync(() => userSchema.parse(input));
 * if (error) {
 *   return { error: 'Validation failed' };
 * }
 * return { user };
 * ```
 */
export function tryCatchSync<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    const data = fn();
    return [null, data];
  } catch (error) {
    return [error as E, null];
  }
}

/**
 * Wraps a Promise with a timeout, returning a Result tuple.
 *
 * This function combines the error handling of tryCatch with timeout functionality.
 * If the promise doesn't resolve within the specified time, it returns a timeout error.
 * This is useful for network requests, database queries, or any async operation
 * that should have a maximum execution time.
 *
 * @template T - The type of the successful result data
 * @template E - The type of the error, defaults to Error
 *
 * @param {Promise<T>} promise - The promise to wrap with timeout
 * @param {number} timeoutMs - Maximum time in milliseconds to wait for the promise
 * @param {E} [timeoutError] - Optional custom error to return on timeout
 *
 * @returns {Promise<Result<T, E>>} A promise that resolves to a Result tuple
 *
 * @example
 * ```typescript
 * // Basic timeout
 * const [error, response] = await tryCatchWithTimeout(
 *   fetch('/api/slow-endpoint'),
 *   5000 // 5 second timeout
 * );
 * if (error) {
 *   if (error.message === 'Operation timed out') {
 *     console.error('Request took too long');
 *   }
 *   return;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Custom timeout error
 * class TimeoutError extends Error {
 *   constructor(public operation: string) {
 *     super(`${operation} timed out`);
 *   }
 * }
 *
 * const [error, data] = await tryCatchWithTimeout(
 *   databaseQuery(),
 *   3000,
 *   new TimeoutError('Database query')
 * );
 * ```
 */
export async function tryCatchWithTimeout<T, E = Error>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError?: E,
): Promise<Result<T, E>> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(timeoutError ?? new Error("Operation timed out"));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    // biome-ignore lint/style/noNonNullAssertion: timeoutId is assigned synchronously in the Promise executor above
    clearTimeout(timeoutId!);
    return [null, result];
  } catch (error) {
    // biome-ignore lint/style/noNonNullAssertion: timeoutId is assigned synchronously in the Promise executor above
    clearTimeout(timeoutId!);
    return [error as E, null];
  }
}

/**
 * Wraps a Promise with an AbortSignal, returning a Result tuple.
 *
 * This function allows cancellation of async operations via AbortController.
 * Useful for implementing cancellable requests or user-initiated cancellations.
 *
 * @template T - The type of the successful result data
 * @template E - The type of the error, defaults to Error
 *
 * @param {Promise<T>} promise - The promise to wrap with abort capability
 * @param {AbortSignal} signal - The AbortSignal to monitor for cancellation
 *
 * @returns {Promise<Result<T, E>>} A promise that resolves to a Result tuple
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 *
 * // Cancel after 5 seconds
 * setTimeout(() => controller.abort(), 5000);
 *
 * const [error, data] = await tryCatchWithAbort(
 *   longRunningOperation(),
 *   controller.signal
 * );
 *
 * if (error?.name === 'AbortError') {
 *   console.log('Operation was cancelled');
 * }
 * ```
 */
export async function tryCatchWithAbort<T, E = Error>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<Result<T, E>> {
  if (signal.aborted) {
    return [new DOMException("Operation aborted", "AbortError") as E, null];
  }

  const abortPromise = new Promise<never>((_, reject) => {
    signal.addEventListener(
      "abort",
      () => {
        reject(new DOMException("Operation aborted", "AbortError"));
      },
      { once: true },
    );
  });

  try {
    const result = await Promise.race([promise, abortPromise]);
    return [null, result];
  } catch (error) {
    return [error as E, null];
  }
}

/**
 * Maps the success value of a Result to a new value.
 *
 * This utility function applies a transformation to the success value of a Result,
 * leaving error values unchanged. Useful for chaining transformations on Result types.
 *
 * @template T - The original success type
 * @template U - The transformed success type
 * @template E - The error type
 *
 * @param {Result<T, E>} result - The Result to transform
 * @param {(value: T) => U} fn - The transformation function
 *
 * @returns {Result<U, E>} A new Result with the transformed value or original error
 *
 * @example
 * ```typescript
 * const [error, user] = await tryCatch(fetchUser(id));
 * const [err, name] = mapResult([error, user], (u) => u.name);
 * ```
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  const [error, data] = result;
  if (error !== null) {
    return [error, null];
  }
  return [null, fn(data as T)];
}

/**
 * Chains Result-returning operations together.
 *
 * This utility function applies a Result-returning transformation to the success
 * value of a Result, flattening the nested Result. Useful for composing multiple
 * fallible operations.
 *
 * @template T - The original success type
 * @template U - The transformed success type
 * @template E - The error type
 *
 * @param {Result<T, E>} result - The Result to transform
 * @param {(value: T) => Result<U, E>} fn - The transformation function returning a Result
 *
 * @returns {Result<U, E>} The flattened Result
 *
 * @example
 * ```typescript
 * const parseJson = (str: string): Result<unknown, Error> =>
 *   tryCatchSync(() => JSON.parse(str));
 *
 * const validateUser = (data: unknown): Result<User, Error> =>
 *   tryCatchSync(() => userSchema.parse(data));
 *
 * const result = flatMapResult(parseJson(jsonStr), validateUser);
 * ```
 */
export function flatMapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  const [error, data] = result;
  if (error !== null) {
    return [error, null];
  }
  return fn(data as T);
}

/**
 * Checks if a Result is a success (no error).
 *
 * Type guard function that narrows the Result type to Success<T>.
 *
 * @template T - The success type
 * @template E - The error type
 *
 * @param {Result<T, E>} result - The Result to check
 *
 * @returns {boolean} True if the Result is a success
 *
 * @example
 * ```typescript
 * const result = await tryCatch(fetchData());
 * if (isSuccess(result)) {
 *   // result is narrowed to Success<T>
 *   console.log(result[1]); // Access data safely
 * }
 * ```
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result[0] === null;
}

/**
 * Checks if a Result is a failure (has error).
 *
 * Type guard function that narrows the Result type to Failure<E>.
 *
 * @template T - The success type
 * @template E - The error type
 *
 * @param {Result<T, E>} result - The Result to check
 *
 * @returns {boolean} True if the Result is a failure
 *
 * @example
 * ```typescript
 * const result = await tryCatch(fetchData());
 * if (isFailure(result)) {
 *   // result is narrowed to Failure<E>
 *   console.error(result[0].message); // Access error safely
 * }
 * ```
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result[0] !== null;
}

/**
 * Unwraps a Result, returning the success value or throwing the error.
 *
 * Use this when you want to convert back to exception-based error handling,
 * such as at the boundary of a function that should throw.
 *
 * @template T - The success type
 * @template E - The error type (must extend Error)
 *
 * @param {Result<T, E>} result - The Result to unwrap
 *
 * @returns {T} The success value
 * @throws {E} The error if the Result is a failure
 *
 * @example
 * ```typescript
 * async function getUserOrThrow(id: string): Promise<User> {
 *   const result = await tryCatch(fetchUser(id));
 *   return unwrapResult(result); // Throws if fetch failed
 * }
 * ```
 */
export function unwrapResult<T, E extends Error>(result: Result<T, E>): T {
  const [error, data] = result;
  if (error !== null) {
    throw error;
  }
  return data as T;
}

/**
 * Unwraps a Result, returning the success value or a default value.
 *
 * This is a safe way to extract the value from a Result when you have
 * a sensible fallback value for the error case.
 *
 * @template T - The success type
 * @template E - The error type
 *
 * @param {Result<T, E>} result - The Result to unwrap
 * @param {T} defaultValue - The value to return if the Result is a failure
 *
 * @returns {T} The success value or the default value
 *
 * @example
 * ```typescript
 * const [error, config] = await tryCatch(loadConfig());
 * const finalConfig = unwrapResultOr([error, config], defaultConfig);
 * ```
 */
export function unwrapResultOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  const [error, data] = result;
  if (error !== null) {
    return defaultValue;
  }
  return data as T;
}

/**
 * Combines multiple Results into a single Result containing an array.
 *
 * If all Results are successful, returns a Success with an array of all values.
 * If any Result is a failure, returns the first failure encountered.
 *
 * @template T - The success type (array of result values)
 * @template E - The error type
 *
 * @param {Result<T, E>[]} results - Array of Results to combine
 *
 * @returns {Result<T[], E>} A Result containing either all values or the first error
 *
 * @example
 * ```typescript
 * const results = await Promise.all([
 *   tryCatch(fetchUser(1)),
 *   tryCatch(fetchUser(2)),
 *   tryCatch(fetchUser(3)),
 * ]);
 *
 * const [error, users] = combineResults(results);
 * if (error) {
 *   console.error('At least one fetch failed');
 *   return;
 * }
 * console.log('All users:', users);
 * ```
 */
export function combineResults<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    const [error, data] = result;
    if (error !== null) {
      return [error, null];
    }
    values.push(data as T);
  }

  return [null, values];
}
