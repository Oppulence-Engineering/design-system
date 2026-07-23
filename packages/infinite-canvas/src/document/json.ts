/**
 * JSON value types. Documents must be JSON-serializable end to end (they are the
 * interop format between the library and every consumer's storage layer), so
 * every persisted field bottoms out in `JsonValue`.
 */
export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

/** Narrow an unknown to a plain JSON object (own enumerable keys, not an array). */
export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * True only for finite numbers. JSON cannot carry `NaN`/`Infinity`, but a
 * malicious CRDT peer can encode them into a Y.Map — the sanitize boundary uses
 * this to reject them (a `NaN` geometry value would silently defeat culling and
 * hit-testing, wedging every collaborator's canvas).
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
