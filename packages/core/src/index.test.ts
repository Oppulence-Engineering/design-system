import { describe, expect, it } from "vitest";

import * as entry from "./index";

/*
 * `src/index.ts` carried `export * from "./utils"`, which is ambiguous: a
 * `utils.ts` file and a `utils/` directory both exist, and the resolver picks
 * the file. The line read as "re-export all utilities" while exporting only the
 * three helpers in utils.ts — the whole directory was missing from the package
 * entry point, and nothing failed to build or typecheck.
 *
 * This list is what a consumer installing the package can reach.
 */
const EXPECTED_EXPORTS = [
  // utils.ts
  "assertExhaustive",
  "promiseWithResolvers",
  // utils/crypto.ts
  "base64Decode",
  "base64Encode",
  "bufferToHex",
  "constantTimeCompare",
  "digestSHA256",
  "hexToBuffer",
  "randomUUID",
  // utils/deepMerge.ts
  "deepMerge",
  "deepMergeWithOptions",
  // utils/durations.ts
  "formatDuration",
  "formatDurationMilliseconds",
  "millisecondsToNanoseconds",
  // utils/getEnv.ts
  "getEnvVar",
  "getNumberEnvVar",
  // utils/imageRef.ts
  "parseDockerImageReference",
  "rebuildDockerImageReference",
  // utils/interval.ts
  "IntervalService",
  // utils/memoize.ts
  "memoize",
  "memoizeAsync",
  // utils/omit.ts and utils/pick.ts
  "omit",
  "pick",
  "pickBy",
  // utils/retries.ts
  "calculateNextRetryDelay",
  "defaultRetryOptions",
  // utils/safeAsyncLocalStorage.ts
  "createAsyncLocalStorage",
  // utils/sleep.ts
  "delay",
  "retry",
  "sleep",
  "sleepWithSignal",
  // utils/structuredLogger.ts
  "SimpleStructuredLogger",
  // top-level modules
  "debounce",
  "throttle",
  "flattenAttributes",
  "unflattenAttributes",
  "singleton",
  "tryCatch",
  "tryCatchSync",
  "ShutdownManager",
  "createLogger",
] as const;

describe("package entry point", () => {
  for (const name of EXPECTED_EXPORTS) {
    it(`exports ${name}`, () => {
      expect(entry).toHaveProperty(name);
      expect((entry as unknown as Record<string, unknown>)[name]).toBeDefined();
    });
  }

  it("exports the tryCatch that rejects rather than the one that tolerates undefined", async () => {
    // Two tryCatch implementations exist; the explicit re-export from
    // ./tryCatch must win over the star export.
    expect(await entry.tryCatch(Promise.resolve(1))).toEqual([null, 1]);
  });
});
