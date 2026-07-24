import type { Attributes } from "@opentelemetry/api";

export const NULL_SENTINEL = "$@null((";
export const CIRCULAR_REFERENCE_SENTINEL = "$@circular((";

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

  // Check if obj is null or undefined
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

  // Check for circular reference
  if (obj !== null && typeof obj === "object" && seen.has(obj)) {
    result[prefix || ""] = CIRCULAR_REFERENCE_SENTINEL;
    return result;
  }

  // Add object to seen set
  if (obj !== null && typeof obj === "object") {
    seen.add(obj);
  }

  for (const [key, value] of Object.entries(obj)) {
    const newPrefix = `${prefix ? `${prefix}.` : ""}${Array.isArray(obj) ? `[${key}]` : key}`;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === "object" && value[i] !== null) {
          // update null check here as well
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
      // update null check here
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

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
          // Handle array indices more precisely
          const match = part.match(/^\[(\d+)\]$/);
          if (match?.[1]) {
            acc.push(Number.parseInt(match[1], 10));
          } else {
            // Remove brackets for non-numeric array keys
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
        // Ensure we create an array for numeric indices
        current[part] = Array.isArray(current[part]) ? current[part] : [];
      } else if (current[part] === undefined) {
        // Create an object for non-numeric paths
        current[part] = {};
      }

      current = current[part];
    }

    const lastPart = parts.at(-1);

    if (lastPart !== undefined) {
      current[lastPart] = rehydrateNull(rehydrateCircular(value));
    }
  }

  // Convert the result to an array if all top-level keys are numeric indices
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

function rehydrateCircular(value: unknown): unknown {
  if (value === CIRCULAR_REFERENCE_SENTINEL) {
    return "[Circular Reference]";
  }
  return value;
}

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

function rehydrateNull(value: unknown): unknown {
  if (value === NULL_SENTINEL) {
    return null;
  }

  return value;
}
