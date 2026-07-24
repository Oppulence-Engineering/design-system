// ============================================================================
// Required Keys Utility
// ============================================================================

/**
 * Makes specified keys required while keeping other keys optional.
 *
 * @template T - The object type
 * @template K - The keys to make required
 *
 * @example
 * ```typescript
 * interface Config {
 *   name?: string;
 *   port?: number;
 *   host?: string;
 * }
 *
 * type RequiredConfig = RequireKeys<Config, 'name' | 'port'>;
 * // { name: string; port: number; host?: string; }
 * ```
 */
export type RequireKeys<T extends object, K extends keyof T> = Required<
  Pick<T, K>
> &
  Omit<T, K> extends infer O
  ? { [P in keyof O]: O[P] }
  : never;

/**
 * Expands a type to show its full structure in IDE tooltips.
 *
 * This is purely for developer experience - it doesn't change the type,
 * but makes complex intersection types easier to read.
 *
 * @template T - The type to prettify
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Creates a branded/nominal type that is structurally incompatible with its base type.
 *
 * Branded types prevent mixing up values that have the same underlying type
 * but represent different concepts (e.g., userId vs teamId).
 *
 * @template T - The base type
 * @template Brand - A unique string literal to identify the brand
 *
 * @example
 * ```typescript
 * type UserId = Brand<string, 'UserId'>;
 * type TeamId = Brand<string, 'TeamId'>;
 *
 * function getUser(id: UserId): User { ... }
 *
 * const userId = 'user_123' as UserId;
 * const teamId = 'team_456' as TeamId;
 *
 * getUser(userId); // OK
 * getUser(teamId); // Error: Argument of type 'TeamId' is not assignable to 'UserId'
 * ```
 */
export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

/**
 * Pre-defined branded type for User IDs.
 */
export type UserId = Brand<string, "UserId">;

/**
 * Pre-defined branded type for Team IDs.
 */
export type TeamId = Brand<string, "TeamId">;

/**
 * Pre-defined branded type for Email addresses.
 */
export type Email = Brand<string, "Email">;

/**
 * Pre-defined branded type for URLs.
 */
export type Url = Brand<string, "Url">;

/**
 * Pre-defined branded type for ISO date strings.
 */
export type ISODateString = Brand<string, "ISODateString">;

/**
 * Pre-defined branded type for Unix timestamps (milliseconds).
 */
export type UnixTimestamp = Brand<number, "UnixTimestamp">;

/**
 * Helper function to create a branded value.
 *
 * @template T - The branded type
 *
 * @param {T extends Brand<infer U, any> ? U : never} value - The raw value
 *
 * @returns {T} The branded value
 *
 * @example
 * ```typescript
 * const userId = brand<UserId>('user_123');
 * const email = brand<Email>('john@example.com');
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: required for branded type inference
export function brand<T extends Brand<any, any>>(
  // biome-ignore lint/suspicious/noExplicitAny: required for branded type inference
  value: T extends Brand<infer U, any> ? U : never,
): T {
  return value as T;
}

// ============================================================================
// Deep Utility Types
// ============================================================================

/**
 * Makes all properties in an object deeply partial (optional).
 *
 * @template T - The object type
 *
 * @example
 * ```typescript
 * interface Config {
 *   server: {
 *     host: string;
 *     port: number;
 *   };
 * }
 *
 * type PartialConfig = DeepPartial<Config>;
 * // { server?: { host?: string; port?: number; } }
 * ```
 */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

/**
 * Makes all properties in an object deeply readonly (immutable).
 *
 * @template T - The object type
 *
 * @example
 * ```typescript
 * interface Config {
 *   server: {
 *     host: string;
 *     port: number;
 *   };
 * }
 *
 * type ImmutableConfig = DeepReadonly<Config>;
 * // { readonly server: { readonly host: string; readonly port: number; } }
 * ```
 */
export type DeepReadonly<T> = T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

/**
 * Makes all properties in an object deeply required.
 *
 * @template T - The object type
 */
export type DeepRequired<T> = T extends object
  ? { [P in keyof T]-?: DeepRequired<T[P]> }
  : T;

/**
 * Removes readonly modifiers from all properties deeply.
 *
 * @template T - The object type
 */
export type DeepMutable<T> = T extends object
  ? { -readonly [P in keyof T]: DeepMutable<T[P]> }
  : T;

// ============================================================================
// Async Utility Types
// ============================================================================

/**
 * A value that can be either synchronous or a Promise.
 *
 * Useful for APIs that accept both sync and async functions.
 *
 * @template T - The value type
 *
 * @example
 * ```typescript
 * function process(fn: () => Awaitable<string>): Promise<string> {
 *   return Promise.resolve(fn());
 * }
 *
 * process(() => 'sync'); // OK
 * process(async () => 'async'); // OK
 * ```
 */
export type Awaitable<T> = T | Promise<T>;

/**
 * A value that can be either a single item or an array.
 *
 * @template T - The item type
 */
export type MaybeArray<T> = T | T[];

/**
 * Unwraps a Promise type to get its resolved value type.
 *
 * @template T - The Promise type
 *
 * @example
 * ```typescript
 * type Result = Awaited<Promise<string>>; // string
 * type Nested = Awaited<Promise<Promise<number>>>; // number
 * ```
 */
export type Unwrap<T> = T extends Promise<infer U> ? Unwrap<U> : T;

// ============================================================================
// Function Utility Types
// ============================================================================

/**
 * Extracts the return type of a function, even if it's async.
 *
 * @template T - The function type
 */
// biome-ignore lint/suspicious/noExplicitAny: required for generic function type constraint
export type AsyncReturnType<T extends (...args: any) => any> =
  ReturnType<T> extends Promise<infer U> ? U : ReturnType<T>;

/**
 * Makes a function type that accepts the same arguments but returns a Promise.
 *
 * @template T - The function type
 */
// biome-ignore lint/suspicious/noExplicitAny: required for generic function type constraint
export type Asyncify<T extends (...args: any) => any> = (
  ...args: Parameters<T>
) => Promise<Unwrap<ReturnType<T>>>;

/**
 * A function that takes no arguments and returns void.
 */
export type VoidFunction = () => void;

/**
 * A function that takes no arguments and returns a Promise<void>.
 */
export type AsyncVoidFunction = () => Promise<void>;

// ============================================================================
// Object Utility Types
// ============================================================================

/**
 * Gets the keys of an object that have values of a specific type.
 *
 * @template T - The object type
 * @template V - The value type to filter for
 *
 * @example
 * ```typescript
 * interface User {
 *   id: string;
 *   name: string;
 *   age: number;
 *   active: boolean;
 * }
 *
 * type StringKeys = KeysOfType<User, string>; // 'id' | 'name'
 * type NumberKeys = KeysOfType<User, number>; // 'age'
 * ```
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Creates a type with only the properties of type V.
 *
 * @template T - The object type
 * @template V - The value type to filter for
 */
export type PickByType<T, V> = Pick<T, KeysOfType<T, V>>;

/**
 * Creates a type excluding properties of type V.
 *
 * @template T - The object type
 * @template V - The value type to exclude
 */
export type OmitByType<T, V> = Omit<T, KeysOfType<T, V>>;

/**
 * Makes specified keys optional.
 *
 * @template T - The object type
 * @template K - The keys to make optional
 */
export type PartialKeys<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

/**
 * Gets keys that are optional in T.
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * Gets keys that are required in T.
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

// ============================================================================
// String Utility Types
// ============================================================================

/**
 * Converts a string literal type to lowercase.
 */
export type Lowercase<S extends string> = S extends `${infer F}${infer R}`
  ? `${F extends Uppercase<F> ? Lowercase<F> : F}${Lowercase<R>}`
  : S;

/**
 * Joins an array of string literal types with a separator.
 *
 * @example
 * ```typescript
 * type Path = Join<['users', 'profile', 'settings'], '/'>; // 'users/profile/settings'
 * ```
 */
export type Join<
  T extends readonly string[],
  Separator extends string = "",
> = T extends readonly [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? Rest["length"] extends 0
    ? First
    : `${First}${Separator}${Join<Rest, Separator>}`
  : "";

// ============================================================================
// Tuple Utility Types
// ============================================================================

/**
 * Gets the first element of a tuple.
 */
// biome-ignore lint/suspicious/noExplicitAny: required for tuple type inference
export type Head<T extends readonly any[]> = T extends readonly [
  infer H,
  // biome-ignore lint/suspicious/noExplicitAny: required for tuple type inference
  ...any[],
]
  ? H
  : never;

/**
 * Gets all elements except the first.
 */
// biome-ignore lint/suspicious/noExplicitAny: required for tuple type inference
export type Tail<T extends readonly any[]> = T extends readonly [
  // biome-ignore lint/suspicious/noExplicitAny: required for tuple type inference
  any,
  ...infer R,
]
  ? R
  : never;

/**
 * Gets the last element of a tuple.
 */
// biome-ignore lint/suspicious/noExplicitAny: required for tuple type inference
export type Last<T extends readonly any[]> = T extends readonly [
  // biome-ignore lint/suspicious/noExplicitAny: required for tuple type inference
  ...any[],
  infer L,
]
  ? L
  : never;

/**
 * Gets the length of a tuple.
 */
// biome-ignore lint/suspicious/noExplicitAny: required for tuple type inference
export type Length<T extends readonly any[]> = T["length"];

// ============================================================================
// Conditional Types
// ============================================================================

/**
 * Returns the type if it's not never, otherwise returns the fallback.
 */
export type IfNever<T, Fallback> = [T] extends [never] ? Fallback : T;

/**
 * Returns true if T is exactly any.
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Returns true if T is unknown.
 */
export type IsUnknown<T> = unknown extends T
  ? IsAny<T> extends true
    ? false
    : true
  : false;

/**
 * Returns true if T is never.
 */
export type IsNever<T> = [T] extends [never] ? true : false;

// ============================================================================
// JSON Types
// ============================================================================

/**
 * Valid JSON primitive types.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Valid JSON array type.
 */
export type JsonArray = JsonValue[];

/**
 * Valid JSON object type.
 */
export type JsonObject = { [key: string]: JsonValue };

/**
 * Any valid JSON value.
 */
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

/**
 * Converts a type to its JSON-serializable equivalent.
 *
 * This is useful for typing API responses or stored data.
 *
 * @template T - The type to convert
 */
export type Jsonify<T> = T extends JsonPrimitive
  ? T
  : T extends Date
    ? string
    : // biome-ignore lint/suspicious/noExplicitAny: required for function type matching in conditional type
      T extends undefined | ((...args: any[]) => any)
      ? never
      : T extends readonly (infer U)[]
        ? Jsonify<U>[]
        : T extends object
          ? {
              [K in keyof T as Jsonify<T[K]> extends never
                ? never
                : K]: Jsonify<T[K]>;
            }
          : never;
