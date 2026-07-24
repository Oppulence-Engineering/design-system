/**
 * Creates a new object with only the specified keys from the original object.
 *
 * This utility function performs a shallow copy of the input object, including
 * only the specified keys. It's the inverse of the `omit` function and is useful
 * for extracting a subset of properties from an object.
 *
 * The function uses TypeScript's built-in `Pick<T, K>` utility type to ensure type
 * safety at compile time, guaranteeing that the returned object type accurately
 * reflects the picked keys.
 *
 * @template T - The type of the input object, must extend Record<string, unknown>
 * @template K - The union type of keys to pick, must be keys that exist in T
 *
 * @param {T} obj - The source object from which to pick keys. Must be a record-like object.
 * @param {...K[]} keys - The keys to include in the new object. Can be multiple keys passed as rest parameters.
 *
 * @returns {Pick<T, K>} A new object containing only the specified keys, maintaining type safety
 *
 * @example
 * ```typescript
 * interface User {
 *   id: string;
 *   name: string;
 *   email: string;
 *   password: string;
 * }
 *
 * const user: User = {
 *   id: "123",
 *   name: "John Doe",
 *   email: "john@example.com",
 *   password: "secret123"
 * };
 *
 * // Pick only public fields
 * const publicUser = pick(user, "id", "name");
 * // Type: { id: string; name: string; }
 *
 * // Pick for a specific use case
 * const credentials = pick(user, "email", "password");
 * // Type: { email: string; password: string; }
 * ```
 *
 * @example
 * ```typescript
 * // Working with API responses
 * const apiResponse = {
 *   data: { message: "Hello" },
 *   metadata: { timestamp: Date.now() },
 *   _internal: { debug: true }
 * };
 *
 * const publicResponse = pick(apiResponse, "data", "metadata");
 * // Type: { data: { message: string }; metadata: { timestamp: number }; }
 * ```
 *
 * @performance This function performs a shallow copy with O(k) time complexity where k
 * is the number of keys to pick. For deep picking or complex nested objects, consider
 * specialized libraries.
 *
 * @note This function performs a shallow copy. If the object contains nested objects
 * or arrays, they will be copied by reference, not deeply cloned.
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;

  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Creates a new object with only the keys that satisfy the predicate function.
 *
 * This is a more flexible version of pick that allows filtering keys based on
 * custom logic rather than a fixed list of keys.
 *
 * @template T - The type of the input object
 *
 * @param {T} obj - The source object from which to pick keys
 * @param {(key: string, value: unknown) => boolean} predicate - Function that returns true for keys to include
 *
 * @returns {Partial<T>} A new object containing only the keys that satisfy the predicate
 *
 * @example
 * ```typescript
 * const data = {
 *   name: "John",
 *   age: 30,
 *   email: null,
 *   phone: undefined,
 *   active: true
 * };
 *
 * // Pick only non-null values
 * const nonNull = pickBy(data, (key, value) => value != null);
 * // { name: "John", age: 30, active: true }
 *
 * // Pick only string values
 * const strings = pickBy(data, (key, value) => typeof value === "string");
 * // { name: "John" }
 *
 * // Pick keys that start with a specific prefix
 * const config = { db_host: "localhost", db_port: 5432, api_key: "secret" };
 * const dbConfig = pickBy(config, (key) => key.startsWith("db_"));
 * // { db_host: "localhost", db_port: 5432 }
 * ```
 */
export function pickBy<T extends Record<string, unknown>>(
  obj: T,
  predicate: (key: string, value: unknown) => boolean,
): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (predicate(key, value)) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}
