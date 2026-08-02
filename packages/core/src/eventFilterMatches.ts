import type { EventFilter } from "./schemas/eventFilter.js";

// EventFilter is a recursive type, where the keys are strings and the values are an array of strings, numbers, booleans, or objects.
// If the values of the array are strings, numbers, or booleans, than we are matching against the value of the payload.
// If the values of the array are objects, then we are doing content filtering
// An example would be [{ $endsWith: ".png" }, { $startsWith: "images/" } ]
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Recursive event filter matching with type-polymorphic array comparison and nested object traversal
export function eventFilterMatches(
  payload: Record<string, unknown> | null | undefined,
  filter: EventFilter,
): boolean {
  if (payload === undefined || payload === null) {
    if (Object.entries(filter).length === 0) {
      return true;
    }
    return false;
  }

  for (const [patternKey, patternValue] of Object.entries(filter)) {
    const payloadValue = payload[patternKey];

    if (Array.isArray(patternValue)) {
      if (patternValue.length === 0) {
        continue;
      }

      // Check to see if all the items in the array are a string
      if (
        (patternValue as unknown[]).every((item) => typeof item === "string")
      ) {
        if ((patternValue as string[]).includes(payloadValue as string)) {
          continue;
        }

        return false;
      }

      // Check to see if all the items in the array are a number
      if (
        (patternValue as unknown[]).every((item) => typeof item === "number")
      ) {
        if ((patternValue as number[]).includes(payloadValue as number)) {
          continue;
        }

        return false;
      }

      // Check to see if all the items in the array are a boolean
      if (
        (patternValue as unknown[]).every((item) => typeof item === "boolean")
      ) {
        if ((patternValue as boolean[]).includes(payloadValue as boolean)) {
          continue;
        }

        return false;
      }

      // Now we know that all the items in the array are objects
      const objectArray = patternValue as Exclude<
        typeof patternValue,
        number[] | string[] | boolean[]
      >;

      if (
        !contentFiltersMatches(
          payloadValue as Record<string, unknown> | null | undefined,
          objectArray,
        )
      ) {
        return false;
      }
    } else if (typeof patternValue === "object") {
      if (Array.isArray(payloadValue)) {
        if (
          !payloadValue.some((item) =>
            eventFilterMatches(
              item as Record<string, unknown> | null | undefined,
              patternValue,
            ),
          )
        ) {
          return false;
        }
      } else if (
        !eventFilterMatches(
          payloadValue as Record<string, unknown> | null | undefined,
          patternValue,
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

type ContentFilters = Exclude<
  EventFilter[string],
  EventFilter | string[] | number[] | boolean[]
>;

function contentFiltersMatches(
  actualValue: unknown,
  contentFilters: ContentFilters,
): boolean {
  for (const contentFilter of contentFilters) {
    if (
      typeof contentFilter === "object" &&
      !contentFilterMatches(actualValue, contentFilter)
    ) {
      return false;
    }
  }

  return true;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Content filter operator evaluation across 12+ filter types (range, string, null, negation, etc.)
function contentFilterMatches(
  actualValue: unknown,
  contentFilter: ContentFilters[number],
): boolean {
  if ("$endsWith" in contentFilter) {
    if (typeof actualValue !== "string") {
      return false;
    }

    return actualValue.endsWith(contentFilter.$endsWith);
  }

  if ("$startsWith" in contentFilter) {
    if (typeof actualValue !== "string") {
      return false;
    }

    return actualValue.startsWith(contentFilter.$startsWith);
  }

  if ("$anythingBut" in contentFilter) {
    if (
      Array.isArray(contentFilter.$anythingBut) &&
      (contentFilter.$anythingBut as unknown[]).includes(actualValue)
    ) {
      return false;
    }

    if (contentFilter.$anythingBut === actualValue) {
      return false;
    }

    return true;
  }

  if ("$exists" in contentFilter) {
    if (contentFilter.$exists) {
      return actualValue !== undefined;
    }

    return actualValue === undefined;
  }

  if ("$gt" in contentFilter) {
    if (typeof actualValue !== "number") {
      return false;
    }

    return actualValue > contentFilter.$gt;
  }

  if ("$lt" in contentFilter) {
    if (typeof actualValue !== "number") {
      return false;
    }

    return actualValue < contentFilter.$lt;
  }

  if ("$gte" in contentFilter) {
    if (typeof actualValue !== "number") {
      return false;
    }

    return actualValue >= contentFilter.$gte;
  }

  if ("$lte" in contentFilter) {
    if (typeof actualValue !== "number") {
      return false;
    }

    return actualValue <= contentFilter.$lte;
  }

  if ("$between" in contentFilter) {
    if (typeof actualValue !== "number") {
      return false;
    }

    return (
      actualValue >= contentFilter.$between[0] &&
      actualValue <= contentFilter.$between[1]
    );
  }

  if ("$includes" in contentFilter) {
    if (Array.isArray(actualValue)) {
      return actualValue.includes(contentFilter.$includes);
    }

    return false;
  }

  // Use localCompare
  if ("$ignoreCaseEquals" in contentFilter) {
    if (typeof actualValue !== "string") {
      return false;
    }

    return (
      actualValue.localeCompare(contentFilter.$ignoreCaseEquals, undefined, {
        sensitivity: "accent",
      }) === 0
    );
  }

  if ("$isNull" in contentFilter) {
    if (contentFilter.$isNull) {
      return actualValue === null;
    }

    return actualValue !== null;
  }

  if ("$not" in contentFilter) {
    if (Array.isArray(actualValue)) {
      return !actualValue.includes(contentFilter.$not);
    }

    /*
     * Anything that is not the excluded value passes, including a value that is
     * absent, null, or an object. This used to fall through to `false` for all
     * three, so a payload missing the key failed a "not equal to x" filter —
     * the opposite of what `$anythingBut`, the same predicate under another
     * name, answers for the same data.
     */
    return actualValue !== contentFilter.$not;
  }

  return true;
}
