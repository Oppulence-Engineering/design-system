/**
 * Creates a new object with specified keys omitted from the original object.
 *
 * This utility function performs a shallow copy of the input object while excluding
 * the specified keys. It's useful for creating clean objects without unwanted properties,
 * such as removing sensitive data before serialization or creating objects that conform
 * to specific interfaces.
 *
 * The function uses TypeScript's built-in `Omit<T, K>` utility type to ensure type
 * safety at compile time, guaranteeing that the returned object type accurately
 * reflects the omitted keys.
 *
 * @template T - The type of the input object, must extend Record<string, unknown>
 * @template K - The union type of keys to omit, must be keys that exist in T
 *
 * @param {T} obj - The source object from which to omit keys. Must be a record-like object.
 * @param {...K[]} keys - The keys to omit from the source object. Can be multiple keys passed as rest parameters.
 *
 * @returns {Omit<T, K>} A new object with the specified keys removed, maintaining type safety
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
 * // Omit sensitive data before sending to client
 * const publicUser = omit(user, "password");
 * // Type: { id: string; name: string; email: string; }
 *
 * // Omit multiple keys
 * const minimalUser = omit(user, "password", "email");
 * // Type: { id: string; name: string; }
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
 * const cleanResponse = omit(apiResponse, "_internal");
 * // Type: { data: { message: string }; metadata: { timestamp: number }; }
 * ```
 *
 * @performance This function performs a shallow copy with O(n) time complexity where n
 * is the number of properties in the source object. For deep omission or complex nested
 * objects, consider specialized libraries.
 *
 * @note This function performs a shallow copy. If the object contains nested objects
 * or arrays, they will be copied by reference, not deeply cloned.
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Omit<T, K> {
  const result: Record<string, unknown> = {};

  for (const key in obj) {
    if (!keys.includes(key as unknown as K)) {
      result[key] = obj[key];
    }
  }

  return result as Omit<T, K>;
}
