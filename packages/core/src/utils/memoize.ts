/**
 * Options for configuring memoization behavior.
 */
export type MemoizeOptions<Args extends unknown[]> = {
  /**
   * Maximum number of cached results to store.
   * When exceeded, the oldest entries are removed (LRU-like behavior).
   * @default Infinity
   */
  maxSize?: number;

  /**
   * Time-to-live for cached entries in milliseconds.
   * After this time, the cached value is considered stale and will be recomputed.
   * @default Infinity (no expiration)
   */
  ttl?: number;

  /**
   * Custom function to generate a cache key from the function arguments.
   * By default, uses JSON.stringify of all arguments.
   *
   * @param args - The arguments passed to the memoized function
   * @returns A string key for the cache
   */
  resolver?: (...args: Args) => string;
};

/**
 * A memoized function with cache management methods.
 */
// biome-ignore lint/suspicious/noExplicitAny: required for generic function type constraint
export type MemoizedFunction<T extends (...args: any[]) => any> = {
  /**
   * Call the memoized function. Returns cached result if available.
   */
  (...args: Parameters<T>): ReturnType<T>;

  /**
   * The internal cache map. Keys are cache keys, values are cached results.
   */
  cache: Map<string, { value: ReturnType<T>; timestamp: number }>;

  /**
   * Clears all cached values.
   */
  clear(): void;

  /**
   * Deletes a specific cached value by its cache key.
   * @param key - The cache key to delete
   * @returns True if the key existed and was deleted
   */
  delete(key: string): boolean;

  /**
   * Checks if a value is cached for the given arguments.
   * @param args - The arguments to check
   * @returns True if a cached value exists (and is not expired)
   */
  has(...args: Parameters<T>): boolean;

  /**
   * Gets the cache key for the given arguments without calling the function.
   * @param args - The arguments to get the key for
   * @returns The cache key string
   */
  key(...args: Parameters<T>): string;
};

/**
 * Creates a memoized version of a function that caches results.
 *
 * Memoization is a performance optimization technique that caches the results
 * of expensive function calls and returns the cached result when the same
 * inputs occur again. This is particularly useful for:
 * - Expensive computations
 * - API calls that return the same data for the same inputs
 * - Recursive algorithms (like Fibonacci)
 *
 * @template T - The function type to memoize
 *
 * @param {T} fn - The function to memoize
 * @param {MemoizeOptions<Parameters<T>>} [options] - Configuration options
 *
 * @returns {MemoizedFunction<T>} The memoized function with cache management methods
 *
 * @example
 * ```typescript
 * // Basic memoization
 * const expensiveCalc = (n: number) => {
 *   console.log('Computing...');
 *   return n * 2;
 * };
 *
 * const memoized = memoize(expensiveCalc);
 * memoized(5); // Logs "Computing...", returns 10
 * memoized(5); // Returns 10 immediately (cached)
 * memoized(3); // Logs "Computing...", returns 6
 * ```
 *
 * @example
 * ```typescript
 * // With TTL (time-to-live)
 * const fetchUser = async (id: string) => {
 *   const response = await fetch(`/api/users/${id}`);
 *   return response.json();
 * };
 *
 * const cachedFetch = memoize(fetchUser, {
 *   ttl: 60000, // Cache for 1 minute
 *   maxSize: 100 // Keep at most 100 users cached
 * });
 *
 * await cachedFetch('123'); // Fetches from API
 * await cachedFetch('123'); // Returns cached result
 * // After 1 minute, cachedFetch('123') will fetch again
 * ```
 *
 * @example
 * ```typescript
 * // With custom cache key resolver
 * interface Options {
 *   id: string;
 *   includeDetails: boolean;
 * }
 *
 * const fetchData = (opts: Options) => { ... };
 *
 * const memoized = memoize(fetchData, {
 *   resolver: (opts) => `${opts.id}:${opts.includeDetails}`
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Cache management
 * const memoized = memoize(expensiveFn);
 *
 * memoized(1);
 * memoized(2);
 *
 * console.log(memoized.cache.size); // 2
 * memoized.delete(memoized.key(1)); // Remove specific entry
 * memoized.clear(); // Clear all entries
 * console.log(memoized.has(1)); // false
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: required for generic function type constraint
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options?: MemoizeOptions<Parameters<T>>,
): MemoizedFunction<T> {
  const {
    maxSize = Number.POSITIVE_INFINITY,
    ttl = Number.POSITIVE_INFINITY,
    resolver = (...args: Parameters<T>) => JSON.stringify(args),
  } = options ?? {};

  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();

  const memoized = (...args: Parameters<T>): ReturnType<T> => {
    const key = resolver(...args);
    const cached = cache.get(key);

    // Check if cached and not expired
    if (cached !== undefined) {
      const isExpired =
        ttl !== Number.POSITIVE_INFINITY && Date.now() - cached.timestamp > ttl;

      if (!isExpired) {
        // Move to end for LRU behavior (delete and re-add)
        cache.delete(key);
        cache.set(key, cached);
        return cached.value;
      }

      // Expired, remove it
      cache.delete(key);
    }

    // Compute new value
    const result = fn(...args);

    // Enforce max size (remove oldest entries)
    if (maxSize !== Number.POSITIVE_INFINITY && cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    // Cache the result
    cache.set(key, { value: result, timestamp: Date.now() });

    return result;
  };

  memoized.cache = cache;

  memoized.clear = () => {
    cache.clear();
  };

  memoized.delete = (key: string) => cache.delete(key);

  memoized.has = (...args: Parameters<T>) => {
    const key = resolver(...args);
    const cached = cache.get(key);

    if (cached === undefined) return false;

    // Check if expired
    if (
      ttl !== Number.POSITIVE_INFINITY &&
      Date.now() - cached.timestamp > ttl
    ) {
      cache.delete(key);
      return false;
    }

    return true;
  };

  memoized.key = (...args: Parameters<T>) => resolver(...args);

  return memoized as MemoizedFunction<T>;
}

/**
 * Creates a memoized version of an async function.
 *
 * This is similar to `memoize` but handles Promise-returning functions
 * correctly, ensuring that concurrent calls with the same arguments
 * share the same Promise instead of making multiple async calls.
 *
 * @template T - The async function type to memoize
 *
 * @param {T} fn - The async function to memoize
 * @param {MemoizeOptions<Parameters<T>>} [options] - Configuration options
 *
 * @returns {MemoizedFunction<T>} The memoized async function
 *
 * @example
 * ```typescript
 * const fetchUser = async (id: string) => {
 *   const response = await fetch(`/api/users/${id}`);
 *   return response.json();
 * };
 *
 * const cachedFetch = memoizeAsync(fetchUser, { ttl: 30000 });
 *
 * // These concurrent calls share the same Promise
 * const [user1, user2] = await Promise.all([
 *   cachedFetch('123'),
 *   cachedFetch('123')
 * ]);
 * // Only one API call was made
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: required for generic async function type constraint
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: MemoizeOptions<Parameters<T>>,
): MemoizedFunction<T> {
  const {
    maxSize = Number.POSITIVE_INFINITY,
    ttl = Number.POSITIVE_INFINITY,
    resolver = (...args: Parameters<T>) => JSON.stringify(args),
  } = options ?? {};

  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();
  const pending = new Map<string, Promise<unknown>>();

  const memoized = (...args: Parameters<T>): ReturnType<T> => {
    const key = resolver(...args);

    // Check if already pending
    const pendingPromise = pending.get(key);
    if (pendingPromise) {
      return pendingPromise as ReturnType<T>;
    }

    // Check cache
    const cached = cache.get(key);
    if (cached !== undefined) {
      const isExpired =
        ttl !== Number.POSITIVE_INFINITY && Date.now() - cached.timestamp > ttl;

      if (!isExpired) {
        cache.delete(key);
        cache.set(key, cached);
        return cached.value;
      }

      cache.delete(key);
    }

    // Start new async operation
    const promise = fn(...args)
      .then((result: Awaited<ReturnType<T>>) => {
        pending.delete(key);

        // Enforce max size
        if (maxSize !== Number.POSITIVE_INFINITY && cache.size >= maxSize) {
          const firstKey = cache.keys().next().value;
          if (firstKey !== undefined) {
            cache.delete(firstKey);
          }
        }

        cache.set(key, { value: result, timestamp: Date.now() });
        return result as ReturnType<T>;
      })
      .catch((error: unknown) => {
        pending.delete(key);
        throw error;
      });

    pending.set(key, promise);
    return promise as ReturnType<T>;
  };

  memoized.cache = cache;

  memoized.clear = () => {
    cache.clear();
    pending.clear();
  };

  memoized.delete = (key: string) => {
    pending.delete(key);
    return cache.delete(key);
  };

  memoized.has = (...args: Parameters<T>) => {
    const key = resolver(...args);
    const cached = cache.get(key);

    if (cached === undefined) return false;

    if (
      ttl !== Number.POSITIVE_INFINITY &&
      Date.now() - cached.timestamp > ttl
    ) {
      cache.delete(key);
      return false;
    }

    return true;
  };

  memoized.key = (...args: Parameters<T>) => resolver(...args);

  return memoized as MemoizedFunction<T>;
}
