import { AsyncLocalStorage } from "node:async_hooks";

/**
 * A wrapper around Node.js AsyncLocalStorage that provides a safer and more
 * ergonomic API for managing context across async operations.
 *
 * AsyncLocalStorage allows you to store context data that is automatically
 * propagated through async operations, making it ideal for:
 * - Request-scoped data in web servers
 * - Distributed tracing context
 * - Transaction management
 * - User session data
 *
 * @template T - The type of context data to store
 *
 * @example
 * ```typescript
 * interface RequestContext {
 *   requestId: string;
 *   userId?: string;
 *   startTime: number;
 * }
 *
 * const requestContext = new SafeAsyncLocalStorage<RequestContext>();
 *
 * // In middleware
 * app.use((req, res, next) => {
 *   const context: RequestContext = {
 *     requestId: generateId(),
 *     startTime: Date.now()
 *   };
 *
 *   requestContext.runWith(context, () => {
 *     next();
 *   });
 * });
 *
 * // In any async handler
 * async function handleRequest() {
 *   const ctx = requestContext.getStoreOrThrow();
 *   console.log(`Request ${ctx.requestId} processing...`);
 * }
 * ```
 */
export class SafeAsyncLocalStorage<T> {
  private readonly storage: AsyncLocalStorage<T>;

  constructor() {
    this.storage = new AsyncLocalStorage<T>();
  }

  /**
   * Sets the context for all subsequent synchronous and asynchronous operations.
   *
   * Unlike `runWith`, this does not require wrapping code in a callback.
   * The context persists until explicitly changed or the async execution exits.
   *
   * **Warning**: Use with caution in environments where multiple requests
   * might share the same synchronous context (e.g., some edge runtimes).
   *
   * @param {T} context - The context to set
   *
   * @example
   * ```typescript
   * storage.enterWith({ userId: '123' });
   * // All subsequent code has access to this context
   * await someAsyncOperation(); // Context is available here
   * ```
   */
  enterWith(context: T): void {
    this.storage.enterWith(context);
  }

  /**
   * Runs a function with the given context, automatically propagating it
   * through all synchronous and asynchronous operations within.
   *
   * This is the preferred way to establish context as it clearly defines
   * the scope where the context is available.
   *
   * @template R - The return type of the function
   *
   * @param {T} context - The context to use for the function execution
   * @param {(...args: any[]) => R} fn - The function to run with the context
   *
   * @returns {R} The return value of the function
   *
   * @example
   * ```typescript
   * const result = storage.runWith({ requestId: 'abc' }, async () => {
   *   // Context is available here and in all async calls
   *   await processRequest();
   *   return 'done';
   * });
   * ```
   */
  // biome-ignore lint/suspicious/noExplicitAny: required for generic function type constraint matching AsyncLocalStorage.run
  runWith<R extends (...args: any[]) => any>(context: T, fn: R): ReturnType<R> {
    return this.storage.run(context, fn);
  }

  /**
   * Alias for runWith that matches the native AsyncLocalStorage.run signature.
   *
   * @template R - The return type of the function
   *
   * @param {T} context - The context to use
   * @param {(...args: any[]) => R} fn - The function to run
   *
   * @returns {R} The return value of the function
   */
  // biome-ignore lint/suspicious/noExplicitAny: required for generic function type constraint matching AsyncLocalStorage.run
  run<R extends (...args: any[]) => any>(context: T, fn: R): ReturnType<R> {
    return this.storage.run(context, fn);
  }

  /**
   * Runs a function outside of the current async context.
   *
   * This is useful when you need to escape the current context for a specific
   * operation, such as when accessing a shared resource that shouldn't be
   * affected by the current request context.
   *
   * @template R - The return type of the function
   *
   * @param {() => R} fn - The function to run outside the context
   *
   * @returns {R} The return value of the function
   *
   * @example
   * ```typescript
   * storage.runWith({ requestId: '123' }, () => {
   *   // Context is available here
   *   console.log(storage.getStore()); // { requestId: '123' }
   *
   *   storage.exit(() => {
   *     // No context here
   *     console.log(storage.getStore()); // undefined
   *   });
   *
   *   // Context is restored
   *   console.log(storage.getStore()); // { requestId: '123' }
   * });
   * ```
   */
  exit<R>(fn: () => R): R {
    return this.storage.exit(fn);
  }

  /**
   * Gets the current context, or undefined if none is set.
   *
   * @returns {T | undefined} The current context or undefined
   */
  getStore(): T | undefined {
    return this.storage.getStore();
  }

  /**
   * Gets the current context with a fallback default value.
   *
   * Use this when you have a sensible default for when no context is set.
   *
   * @param {T} defaultValue - The value to return if no context is set
   *
   * @returns {T} The current context or the default value
   *
   * @example
   * ```typescript
   * const context = storage.getStoreOrDefault({ requestId: 'unknown' });
   * // Always returns a valid context object
   * ```
   */
  getStoreOrDefault(defaultValue: T): T {
    return this.storage.getStore() ?? defaultValue;
  }

  /**
   * Gets the current context or throws an error if none is set.
   *
   * Use this when context is required and its absence indicates a programming
   * error (e.g., accessing request context outside of a request handler).
   *
   * @param {string} [errorMessage] - Custom error message
   *
   * @returns {T} The current context
   *
   * @throws {Error} If no context is set
   *
   * @example
   * ```typescript
   * function getCurrentUserId(): string {
   *   const context = authContext.getStoreOrThrow(
   *     'getCurrentUserId called outside of authenticated context'
   *   );
   *   return context.userId;
   * }
   * ```
   */
  getStoreOrThrow(errorMessage?: string): T {
    const store = this.storage.getStore();
    if (store === undefined) {
      throw new Error(errorMessage ?? "AsyncLocalStorage context not found");
    }
    return store;
  }

  /**
   * Checks if a context is currently set.
   *
   * @returns {boolean} True if a context is set
   *
   * @example
   * ```typescript
   * if (storage.hasStore()) {
   *   // Safe to access context
   *   const ctx = storage.getStore()!;
   * }
   * ```
   */
  hasStore(): boolean {
    return this.storage.getStore() !== undefined;
  }

  /**
   * Creates a middleware-style helper for Express/Koa-like frameworks.
   *
   * @template Args - The arguments passed to the context factory
   *
   * @param {(...args: Args) => T} getContext - Function to create context from arguments
   *
   * @returns A function that wraps handlers with context
   *
   * @example
   * ```typescript
   * const withContext = storage.middleware((req: Request) => ({
   *   requestId: req.headers['x-request-id'],
   *   startTime: Date.now()
   * }));
   *
   * app.get('/api/users', withContext((req, res) => {
   *   // Context is automatically set based on the request
   *   const ctx = storage.getStore();
   * }));
   * ```
   */
  middleware<Args extends unknown[]>(
    getContext: (...args: Args) => T,
  ): <R>(fn: (...args: Args) => R) => (...args: Args) => R {
    return <R>(fn: (...args: Args) => R) =>
      (...args: Args): R => {
        const context = getContext(...args);
        return this.runWith(context, () => fn(...args));
      };
  }

  /**
   * Updates the current context by merging with new values.
   *
   * This is useful for adding data to the context as it becomes available
   * during request processing.
   *
   * **Note**: This creates a new context object; it doesn't mutate the existing one.
   *
   * @param {Partial<T>} updates - The values to merge into the current context
   *
   * @throws {Error} If no context is currently set
   *
   * @example
   * ```typescript
   * // Initial context
   * storage.enterWith({ requestId: '123' });
   *
   * // Later, after authentication
   * storage.update({ userId: 'user-456' });
   *
   * // Context now has both requestId and userId
   * console.log(storage.getStore());
   * // { requestId: '123', userId: 'user-456' }
   * ```
   */
  update(updates: Partial<T>): void {
    const current = this.getStoreOrThrow("Cannot update: no context is set");
    const updated = { ...current, ...updates } as T;
    this.enterWith(updated);
  }

  /**
   * Gets the underlying AsyncLocalStorage instance.
   *
   * Useful for advanced use cases or when you need to pass the storage
   * to other libraries.
   *
   * @returns {AsyncLocalStorage<T>} The underlying AsyncLocalStorage
   */
  getUnderlying(): AsyncLocalStorage<T> {
    return this.storage;
  }

  /**
   * Disables the storage, causing getStore() to always return undefined.
   *
   * This can be useful for testing or when you want to temporarily
   * disable context propagation.
   *
   * @returns {this} The storage instance for chaining
   */
  disable(): this {
    this.storage.disable();
    return this;
  }
}

/**
 * Creates a typed async local storage instance.
 *
 * This is a convenience function that creates a new SafeAsyncLocalStorage
 * with the specified type.
 *
 * @template T - The type of context to store
 *
 * @returns {SafeAsyncLocalStorage<T>} A new SafeAsyncLocalStorage instance
 *
 * @example
 * ```typescript
 * interface TraceContext {
 *   traceId: string;
 *   spanId: string;
 * }
 *
 * const traceStorage = createAsyncLocalStorage<TraceContext>();
 * ```
 */
export function createAsyncLocalStorage<T>(): SafeAsyncLocalStorage<T> {
  return new SafeAsyncLocalStorage<T>();
}
