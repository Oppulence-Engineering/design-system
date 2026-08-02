import type { DeepPartial } from "../types/utils.ts";

/**
 * Checks if a value is a plain object (not null, not an array, not a special object).
 *
 * @param {unknown} value - The value to check
 * @returns {boolean} True if the value is a plain object
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  // Check for arrays
  if (Array.isArray(value)) {
    return false;
  }

  // Check for special objects
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/**
 * Keys that are never copied from a source.
 *
 * Assigning `__proto__` re-parents the object being built; with `clone: false`
 * the object being built is the caller's target, and a source shaped like
 * `JSON.parse('{"__proto__":{"polluted":1}}')` wrote straight onto
 * Object.prototype, changing every object in the process. Sources are usually
 * parsed configuration or request data, so they are attacker-shaped.
 */
const UNSAFE_MERGE_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/**
 * Options for deep merge behavior.
 */
export type DeepMergeOptions = {
  /**
   * How to handle arrays when merging.
   * - 'replace': Replace target array with source array (default)
   * - 'concat': Concatenate arrays together
   * - 'merge': Merge arrays by index (sparse merge)
   * @default 'replace'
   */
  arrayMerge?: "replace" | "concat" | "merge";

  /**
   * If true, clone objects instead of referencing them.
   * This prevents mutations to the original objects.
   * @default true
   */
  clone?: boolean;

  /**
   * Custom merge function for specific keys or values.
   * Return undefined to use default merge behavior.
   */
  customMerge?: (
    key: string,
    targetValue: unknown,
    sourceValue: unknown,
  ) => unknown | undefined;
};

/**
 * Deeply merges multiple source objects into a target object.
 *
 * This function recursively merges nested objects, with later sources
 * overwriting earlier ones. It handles arrays, null values, and special
 * objects appropriately.
 *
 * @template T - The type of the target object
 *
 * @param {T} target - The target object to merge into
 * @param {...DeepPartial<T>[]} sources - Source objects to merge from
 *
 * @returns {T} The merged object (same reference as target if clone is false)
 *
 * @example
 * ```typescript
 * const defaults = {
 *   server: {
 *     host: 'localhost',
 *     port: 3000,
 *     ssl: {
 *       enabled: false,
 *       cert: null
 *     }
 *   },
 *   logging: {
 *     level: 'info',
 *     format: 'json'
 *   }
 * };
 *
 * const userConfig = {
 *   server: {
 *     port: 8080,
 *     ssl: {
 *       enabled: true,
 *       cert: '/path/to/cert.pem'
 *     }
 *   }
 * };
 *
 * const config = deepMerge(defaults, userConfig);
 * // Result:
 * // {
 * //   server: {
 * //     host: 'localhost',      // preserved from defaults
 * //     port: 8080,             // overwritten by userConfig
 * //     ssl: {
 * //       enabled: true,        // overwritten
 * //       cert: '/path/to/cert' // overwritten
 * //     }
 * //   },
 * //   logging: {
 * //     level: 'info',          // preserved
 * //     format: 'json'          // preserved
 * //   }
 * // }
 * ```
 *
 * @example
 * ```typescript
 * // Merging multiple sources
 * const base = { a: 1, b: { c: 2 } };
 * const override1 = { b: { d: 3 } };
 * const override2 = { a: 10 };
 *
 * const result = deepMerge(base, override1, override2);
 * // { a: 10, b: { c: 2, d: 3 } }
 * ```
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: DeepPartial<T>[]
): T {
  return deepMergeWithOptions(target, { clone: true }, ...sources);
}

/**
 * Deeply merges objects with custom options.
 *
 * @template T - The type of the target object
 *
 * @param {T} target - The target object to merge into
 * @param {DeepMergeOptions} options - Merge configuration
 * @param {...DeepPartial<T>[]} sources - Source objects to merge from
 *
 * @returns {T} The merged object
 *
 * @example
 * ```typescript
 * // Concatenate arrays instead of replacing
 * const a = { tags: ['a', 'b'] };
 * const b = { tags: ['c', 'd'] };
 *
 * const result = deepMergeWithOptions(a, { arrayMerge: 'concat' }, b);
 * // { tags: ['a', 'b', 'c', 'd'] }
 * ```
 *
 * @example
 * ```typescript
 * // Custom merge function
 * const result = deepMergeWithOptions(
 *   { count: 5 },
 *   {
 *     customMerge: (key, target, source) => {
 *       if (key === 'count' && typeof target === 'number' && typeof source === 'number') {
 *         return target + source; // Add instead of replace
 *       }
 *       return undefined; // Use default behavior
 *     }
 *   },
 *   { count: 3 }
 * );
 * // { count: 8 }
 * ```
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Recursive deep merge with configurable array strategy, circular reference detection, and prototype handling
export function deepMergeWithOptions<T extends Record<string, unknown>>(
  target: T,
  options: DeepMergeOptions,
  ...sources: DeepPartial<T>[]
): T {
  const { arrayMerge = "replace", clone = true, customMerge } = options;

  // Clone target if needed
  const result: Record<string, unknown> = clone ? deepClone(target) : target;

  for (const source of sources) {
    if (source === null || source === undefined) {
      continue;
    }

    for (const [key, sourceValue] of Object.entries(source)) {
      if (UNSAFE_MERGE_KEYS.has(key)) {
        continue;
      }

      const targetValue = result[key];

      // Check for custom merge
      if (customMerge) {
        const customResult = customMerge(key, targetValue, sourceValue);
        if (customResult !== undefined) {
          result[key] = customResult;
          continue;
        }
      }

      // Handle undefined source values
      if (sourceValue === undefined) {
        continue;
      }

      // Handle null source values
      if (sourceValue === null) {
        result[key] = null;
        continue;
      }

      // Handle arrays
      if (Array.isArray(sourceValue)) {
        if (Array.isArray(targetValue)) {
          switch (arrayMerge) {
            case "concat":
              result[key] = [...targetValue, ...sourceValue];
              break;
            case "merge": {
              const merged = [...targetValue];
              for (let i = 0; i < sourceValue.length; i++) {
                if (sourceValue[i] !== undefined) {
                  merged[i] = clone
                    ? deepClone(sourceValue[i])
                    : sourceValue[i];
                }
              }
              result[key] = merged;
              break;
            }
            default:
              result[key] = clone ? deepClone(sourceValue) : sourceValue;
              break;
          }
        } else {
          result[key] = clone ? deepClone(sourceValue) : sourceValue;
        }
        continue;
      }

      // Handle objects
      if (isPlainObject(sourceValue)) {
        if (isPlainObject(targetValue)) {
          result[key] = deepMergeWithOptions(
            targetValue as Record<string, unknown>,
            options,
            sourceValue as DeepPartial<Record<string, unknown>>,
          );
        } else {
          result[key] = clone ? deepClone(sourceValue) : sourceValue;
        }
        continue;
      }

      // Handle primitives
      result[key] = sourceValue;
    }
  }

  return result as T;
}

/**
 * Creates a deep clone of a value.
 *
 * Objects already met during this clone are returned as the clone made for
 * them, so a structure that refers to itself is reproduced with its shape
 * intact. Without that, cloning a self-referential object recursed until the
 * stack ran out — including through `deepMerge`, whose target it clones by
 * default.
 *
 * @param {T} value - The value to clone
 * @param {WeakMap<object, unknown>} [seen] - Internal map of originals to their clones
 * @returns {T} A deep clone of the value
 */
function deepClone<T>(
  value: T,
  seen: WeakMap<object, unknown> = new WeakMap(),
): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  const alreadyCloned = seen.get(value);
  if (alreadyCloned !== undefined) {
    return alreadyCloned as T;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags) as T;
  }

  /*
   * Each clone is registered before its contents are walked. Registering after
   * would leave a cycle unresolved at the moment it is followed.
   */
  if (value instanceof Map) {
    const cloned = new Map();
    seen.set(value, cloned);
    for (const [k, v] of value) {
      cloned.set(deepClone(k, seen), deepClone(v, seen));
    }
    return cloned as T;
  }

  if (value instanceof Set) {
    const cloned = new Set();
    seen.set(value, cloned);
    for (const v of value) {
      cloned.add(deepClone(v, seen));
    }
    return cloned as T;
  }

  if (Array.isArray(value)) {
    const cloned: unknown[] = [];
    seen.set(value, cloned);
    for (const item of value) {
      cloned.push(deepClone(item, seen));
    }
    return cloned as T;
  }

  if (isPlainObject(value)) {
    const cloned: Record<string, unknown> = {};
    seen.set(value, cloned);
    for (const [k, v] of Object.entries(value)) {
      // Copying `__proto__` would re-parent the clone rather than fill it.
      if (UNSAFE_MERGE_KEYS.has(k)) {
        continue;
      }
      cloned[k] = deepClone(v, seen);
    }
    return cloned as T;
  }

  // For other objects (class instances, etc.), return as-is
  return value;
}

/**
 * Deeply freezes an object, making it and all nested objects immutable.
 *
 * @template T - The type of the object to freeze
 *
 * @param {T} obj - The object to freeze
 *
 * @returns {Readonly<T>} The frozen object
 *
 * @example
 * ```typescript
 * const config = deepFreeze({
 *   server: {
 *     port: 3000
 *   }
 * });
 *
 * config.server.port = 8080; // Throws TypeError in strict mode
 * ```
 */
export function deepFreeze<T extends Record<string, unknown>>(
  obj: T,
): Readonly<T> {
  Object.freeze(obj);

  for (const value of Object.values(obj)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value as Record<string, unknown>);
    }
  }

  return obj;
}

/**
 * Gets a deeply nested value from an object using a dot-notation path.
 *
 * @template T - The expected return type
 *
 * @param {object} obj - The object to get the value from
 * @param {string} path - Dot-notation path (e.g., 'user.profile.name')
 * @param {T} [defaultValue] - Default value if path doesn't exist
 *
 * @returns {T | undefined} The value at the path or the default value
 *
 * @example
 * ```typescript
 * const user = {
 *   profile: {
 *     name: 'John',
 *     settings: {
 *       theme: 'dark'
 *     }
 *   }
 * };
 *
 * getDeep(user, 'profile.name'); // 'John'
 * getDeep(user, 'profile.settings.theme'); // 'dark'
 * getDeep(user, 'profile.settings.language', 'en'); // 'en'
 * getDeep(user, 'profile.missing'); // undefined
 * ```
 */
export function getDeep<T = unknown>(
  obj: object,
  path: string,
  defaultValue?: T,
): T | undefined {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }

    if (typeof current !== "object") {
      return defaultValue;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return (current as T) ?? defaultValue;
}

/**
 * Sets a deeply nested value in an object using a dot-notation path.
 *
 * Creates intermediate objects as needed.
 *
 * @param {object} obj - The object to set the value in
 * @param {string} path - Dot-notation path (e.g., 'user.profile.name')
 * @param {unknown} value - The value to set
 *
 * @returns {object} The modified object
 *
 * @example
 * ```typescript
 * const obj = {};
 * setDeep(obj, 'user.profile.name', 'John');
 * // { user: { profile: { name: 'John' } } }
 *
 * setDeep(obj, 'user.profile.age', 30);
 * // { user: { profile: { name: 'John', age: 30 } } }
 * ```
 */
export function setDeep(obj: object, path: string, value: unknown): object {
  const keys = path.split(".");
  let current: Record<string, unknown> = obj as Record<string, unknown>;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (
      !(key in current) ||
      typeof current[key] !== "object" ||
      current[key] === null
    ) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys.at(-1);
  if (lastKey !== undefined) {
    current[lastKey] = value;
  }

  return obj;
}
