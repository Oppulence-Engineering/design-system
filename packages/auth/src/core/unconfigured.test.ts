/**
 * @vitest-environment node
 *
 * How the package behaves when it is not configured at all.
 *
 * This lives in its own file on purpose. `validateEnv` caches the first
 * successful validation and never re-checks, so once any test in a file has
 * read configuration, the unconfigured path can no longer be reached — a test
 * placed after one would pass whether or not the bug was fixed. Vitest gives
 * each file its own module registry, so nothing here has warmed that cache.
 *
 * The required variables are removed before the modules under test are
 * imported, for the same reason.
 */
import { describe, expect, it } from "vitest";

const REQUIRED = [
  "WORKOS_API_KEY",
  "WORKOS_CLIENT_ID",
  "WORKOS_COOKIE_SECRET",
  "NEXT_PUBLIC_APP_URL",
] as const;

for (const key of REQUIRED) {
  delete process.env[key];
}

const { debugLog, isDebugMode, isConfigured } = await import("./env");
const { decodeSession } = await import("./session");

describe("with no configuration", () => {
  it("reports itself unconfigured instead of throwing", () => {
    expect(isConfigured()).toBe(false);
  });

  /*
   * `getEnvVar` validates the whole schema, so asking for this one optional
   * flag failed whenever any required variable was missing.
   */
  it("resolves debug mode to false rather than throwing", () => {
    expect(() => isDebugMode()).not.toThrow();
    expect(isDebugMode()).toBe(false);
  });

  /*
   * debugLog asks isDebugMode on every call, so logging itself threw — and
   * logging is most wanted precisely when configuration is broken.
   */
  it("logs without throwing", () => {
    expect(() => {
      debugLog("a message", { some: "data" });
    }).not.toThrow();
  });

  /*
   * decodeSession is documented to return null for an invalid token. Its catch
   * handler calls debugLog, so the configuration error was thrown out of the
   * error handler and callers that relied on the null contract — the Next.js
   * server helpers call resolveSession unguarded — got an exception instead.
   */
  it("returns null from decodeSession rather than throwing out of its error handler", async () => {
    await expect(decodeSession("garbage")).resolves.toBeNull();
  });
});
