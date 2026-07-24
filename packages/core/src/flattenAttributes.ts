/**
 * Sentinel value used to represent null values in flattened attributes.
 * This special string is used to distinguish between actual null values
 * and missing properties when flattening nested objects.
 */
export const NULL_SENTINEL = "$@null((";

/**
 * Sentinel value used to represent circular references in flattened attributes.
 * This special string is used to prevent infinite recursion when flattening
 * objects that contain circular references.
 */
export const CIRCULAR_REFERENCE_SENTINEL = "$@circular((";

/**
 * Type definition for flattened attributes.
 *
 * Represents a flat key-value structure where keys are dot-notation paths
 * and values are primitive types or arrays of primitives. This type is used
 * to store nested object structures in a flattened format suitable for
 * storage, serialization, or attribute-based systems.
 *
 * @example
 * ```typescript
 * const attributes: Attributes = {
 *   "user.name": "John Doe",
 *   "user.age": 30,
 *   "user.active": true,
 *   "user.tags": ["admin", "developer"],
 *   "settings.theme": "dark"
 * };
 * ```
 */
export type Attributes = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[]
>;

/**
 * Flattens a nested object structure into a flat key-value object using dot notation.
 *
 * This function recursively traverses nested objects, arrays, and primitive values,
 * converting them into a flat structure where keys represent the path to each value.
 * The function handles various data types including null, undefined, Date objects,
 * and circular references.
 *
 * Key features:
 * - Uses dot notation for object properties (e.g., "user.profile.name")
 * - Uses bracket notation for array indices (e.g., "users.[0].name")
 * - Handles circular references by using a sentinel value
 * - Converts Date objects to ISO strings
 * - Preserves null values using a sentinel
 * - Supports nested arrays and objects
 *
 * @param {Record<string, unknown> | Array<unknown> | string | boolean | number | null | undefined} obj - The object to flatten. Can be any type including nested objects, arrays, or primitives
 * @param {string} [prefix] - Optional prefix for the current nesting level. Used internally for recursion
 * @param {WeakSet<object>} [seen] - Internal parameter to track visited objects and prevent circular reference loops
 * @returns {Attributes} A flat object with dot-notation keys representing the original nested structure
 *
 * @example
 * ```typescript
 * const nested = {
 *   user: {
 *     name: "John",
 *     profile: {
 *       age: 30,
 *       active: true
 *     }
 *   },
 *   settings: {
 *     theme: "dark",
 *     notifications: ["email", "sms"]
 *   }
 * };
 *
 * const flattened = flattenAttributes(nested);
 * console.log(flattened);
 * // {
 * //   "user.name": "John",
 * //   "user.profile.age": 30,
 * //   "user.profile.active": true,
 * //   "settings.theme": "dark",
 * //   "settings.notifications.[0]": "email",
 * //   "settings.notifications.[1]": "sms"
 * // }
 *
 * // With circular reference
 * const circular = { name: "test" };
 * circular.self = circular;
 * const flattenedCircular = flattenAttributes(circular);
 * console.log(flattenedCircular);
 * // {
 * //   "name": "test",
 * //   "self": "$@circular(("
 * // }
 * ```
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Recursive object flattening with array handling, circular reference detection, and dot-notation key building
export function flattenAttributes(
  obj:
    | Record<string, unknown>
    | unknown[]
    | string
    | boolean
    | number
    | null
    | undefined,
  prefix?: string,
  seen: WeakSet<object> = new WeakSet(),
): Attributes {
  const result: Attributes = {};

  if (obj === undefined) {
    return result;
  }

  if (obj === null) {
    result[prefix || ""] = NULL_SENTINEL;
    return result;
  }

  if (typeof obj === "string") {
    result[prefix || ""] = obj;
    return result;
  }

  if (typeof obj === "number") {
    result[prefix || ""] = obj;
    return result;
  }

  if (typeof obj === "boolean") {
    result[prefix || ""] = obj;
    return result;
  }

  if (obj instanceof Date) {
    result[prefix || ""] = obj.toISOString();
    return result;
  }

  if (obj !== null && typeof obj === "object" && seen.has(obj)) {
    result[prefix || ""] = CIRCULAR_REFERENCE_SENTINEL;
    return result;
  }

  if (obj !== null && typeof obj === "object") {
    seen.add(obj);
  }

  for (const [key, value] of Object.entries(obj)) {
    const newPrefix = `${prefix ? `${prefix}.` : ""}${Array.isArray(obj) ? `[${key}]` : key}`;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === "object" && value[i] !== null) {
          Object.assign(
            result,
            flattenAttributes(value[i], `${newPrefix}.[${i}]`, seen),
          );
        } else if (value[i] === null) {
          result[`${newPrefix}.[${i}]`] = NULL_SENTINEL;
        } else {
          result[`${newPrefix}.[${i}]`] = value[i];
        }
      }
    } else if (isRecord(value)) {
      Object.assign(result, flattenAttributes(value, newPrefix, seen));
    } else if (
      typeof value === "number" ||
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      result[newPrefix] = value;
    } else if (value === null) {
      result[newPrefix] = NULL_SENTINEL;
    }
  }

  return result;
}

/**
 * Type guard function to check if a value is a plain object (not null, not an array).
 *
 * This utility function is used internally by flattenAttributes to determine
 * whether a value should be recursively flattened or treated as a primitive.
 *
 * @param {unknown} value - The value to check
 * @returns {value is Record<string, unknown>} True if the value is a plain object, false otherwise
 *
 * @example
 * ```typescript
 * isRecord({ name: "test" }); // true
 * isRecord([1, 2, 3]); // false
 * isRecord(null); // false
 * isRecord("string"); // false
 * isRecord(42); // false
 * ```
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Reconstructs a nested object structure from flattened attributes.
 *
 * This function is the inverse of flattenAttributes. It takes a flat object
 * with dot-notation keys and reconstructs the original nested structure.
 * The function handles arrays, objects, and primitive values, and properly
 * restores null values and circular reference markers.
 *
 * Key features:
 * - Converts dot notation back to nested objects
 * - Handles array indices in bracket notation
 * - Restores null values from sentinel
 * - Converts circular reference markers back to readable strings
 * - Supports mixed object/array structures
 *
 * @param {Attributes} obj - The flattened attributes object to reconstruct
 * @returns {Record<string, unknown> | string | number | boolean | null | undefined} The reconstructed nested object structure
 *
 * @example
 * ```typescript
 * const flattened = {
 *   "user.name": "John",
 *   "user.profile.age": 30,
 *   "user.profile.active": true,
 *   "settings.theme": "dark",
 *   "settings.notifications.[0]": "email",
 *   "settings.notifications.[1]": "sms"
 * };
 *
 * const reconstructed = unflattenAttributes(flattened);
 * console.log(reconstructed);
 * // {
 * //   user: {
 * //     name: "John",
 * //     profile: {
 * //       age: 30,
 * //       active: true
 * //     }
 * //   },
 * //   settings: {
 * //     theme: "dark",
 * //     notifications: ["email", "sms"]
 * //   }
 * // }
 *
 * // With null values
 * const withNulls = {
 *   "user.name": "John",
 *   "user.email": "$@null((",
 *   "user.active": true
 * };
 * const reconstructedWithNulls = unflattenAttributes(withNulls);
 * console.log(reconstructedWithNulls);
 * // {
 * //   user: {
 * //     name: "John",
 * //     email: null,
 * //     active: true
 * //   }
 * // }
 * ```
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Recursive attribute unflattening reconstructing nested objects from dot-notation keys
export function unflattenAttributes(
  obj: Attributes,
): Record<string, unknown> | string | number | boolean | null | undefined {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return obj;
  }

  if (
    typeof obj === "object" &&
    obj !== null &&
    Object.keys(obj).length === 1 &&
    Object.keys(obj)[0] === ""
  ) {
    return rehydrateNull(obj[""]) as
      | string
      | number
      | boolean
      | Record<string, unknown>
      | null
      | undefined;
  }

  if (Object.keys(obj).length === 0) {
    return;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const parts = key.split(".").reduce(
      (acc, part) => {
        if (part.startsWith("[") && part.endsWith("]")) {
          const match = part.match(/^\[(\d+)\]$/);
          if (match?.[1]) {
            acc.push(Number.parseInt(match[1], 10));
          } else {
            acc.push(part.slice(1, -1));
          }
        } else {
          acc.push(part);
        }
        return acc;
      },
      [] as (string | number)[],
    );

    // biome-ignore lint/suspicious/noExplicitAny: recursive object traversal requires dynamic property assignment
    let current: any = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const nextPart = parts[i + 1];

      if (!part && part !== 0) {
        continue;
      }

      if (typeof nextPart === "number") {
        current[part] = Array.isArray(current[part]) ? current[part] : [];
      } else if (current[part] === undefined) {
        current[part] = {};
      }

      current = current[part];
    }

    const lastPart = parts.at(-1);

    if (lastPart !== undefined) {
      current[lastPart] = rehydrateNull(rehydrateCircular(value));
    }
  }

  if (Object.keys(result).every((k) => /^\d+$/.test(k))) {
    const maxIndex = Math.max(
      ...Object.keys(result).map((k) => Number.parseInt(k, 10)),
    );
    const arrayResult = new Array(maxIndex + 1);
    for (const key in result) {
      arrayResult[Number.parseInt(key, 10)] = result[key];
    }
    return arrayResult as unknown as Record<string, unknown>;
  }

  return result;
}

/**
 * Converts circular reference sentinel values back to readable strings.
 *
 * This utility function is used internally by unflattenAttributes to
 * convert the circular reference sentinel back to a human-readable string
 * when reconstructing nested objects.
 *
 * @param {any} value - The value to check for circular reference sentinel
 * @returns {any} The original value or "[Circular Reference]" if it was a sentinel
 *
 * @example
 * ```typescript
 * rehydrateCircular("$@circular(("); // "[Circular Reference]"
 * rehydrateCircular("normal value"); // "normal value"
 * rehydrateCircular(42); // 42
 * ```
 */
function rehydrateCircular(value: unknown): unknown {
  if (value === CIRCULAR_REFERENCE_SENTINEL) {
    return "[Circular Reference]";
  }
  return value;
}

/**
 * Conditionally flattens an object or returns a primitive value.
 *
 * This function provides a flexible way to handle both primitive values
 * and complex objects. If the input is a primitive (string, number, boolean,
 * null, undefined), it returns the value as-is. If it's a complex object,
 * it flattens it using the flattenAttributes function.
 *
 * The function is useful in scenarios where you need to handle mixed data
 * types and want to flatten only when necessary, while preserving primitive
 * values for direct use.
 *
 * @param {Record<string, unknown> | Array<unknown> | string | boolean | number | undefined} obj - The object or primitive to process
 * @param {string | undefined} prefix - Optional prefix for the flattening operation
 * @returns {Attributes | string | number | boolean | undefined} Either the flattened attributes or the original primitive value
 *
 * @example
 * ```typescript
 * // With primitive value
 * primitiveValueOrflattenedAttributes("hello", "greeting"); // "hello"
 * primitiveValueOrflattenedAttributes(42, "count"); // 42
 *
 * // With complex object
 * const user = { name: "John", age: 30 };
 * primitiveValueOrflattenedAttributes(user, "user");
 * // {
 * //   "user.name": "John",
 * //   "user.age": 30
 * // }
 *
 * // With null/undefined
 * primitiveValueOrflattenedAttributes(null, "value"); // null
 * primitiveValueOrflattenedAttributes(undefined, "value"); // undefined
 * ```
 */
export function primitiveValueOrflattenedAttributes(
  obj:
    | Record<string, unknown>
    | unknown[]
    | string
    | boolean
    | number
    | undefined,
  prefix: string | undefined,
): Attributes | string | number | boolean | undefined {
  if (
    typeof obj === "string" ||
    typeof obj === "number" ||
    typeof obj === "boolean" ||
    obj === null ||
    obj === undefined
  ) {
    return obj;
  }

  const attributes = flattenAttributes(obj, prefix);

  if (
    prefix !== undefined &&
    typeof attributes[prefix] !== "undefined" &&
    attributes[prefix] !== null
  ) {
    return attributes[prefix] as unknown as Attributes;
  }

  return attributes;
}

/**
 * Converts null sentinel values back to actual null values.
 *
 * This utility function is used internally by unflattenAttributes to
 * convert the null sentinel back to actual null values when reconstructing
 * nested objects.
 *
 * @param {any} value - The value to check for null sentinel
 * @returns {any} The original value or null if it was a sentinel
 *
 * @example
 * ```typescript
 * rehydrateNull("$@null(("); // null
 * rehydrateNull("normal value"); // "normal value"
 * rehydrateNull(42); // 42
 * rehydrateNull(true); // true
 * ```
 */
function rehydrateNull(value: unknown): unknown {
  if (value === NULL_SENTINEL) {
    return null;
  }

  return value;
}
