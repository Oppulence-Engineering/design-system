import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONFIG,
  DeepLinkPathSchema,
  DeepLinkUrlSchema,
  DesktopClientConfigSchema,
  isDeepLinkPath,
  isDesktopClientError,
  isPlatform,
  PLATFORM_DISPLAY_NAMES,
} from "./index";
import { ValidationPatterns } from "../utils/constants";

describe("DeepLinkPathSchema", () => {
  it("accepts plain paths", () => {
    expect(DeepLinkPathSchema.parse("dashboard")).toBe("dashboard");
    expect(DeepLinkPathSchema.parse("transactions/123")).toBe(
      "transactions/123",
    );
    expect(DeepLinkPathSchema.parse("")).toBe("");
  });

  it("trims surrounding slashes", () => {
    expect(DeepLinkPathSchema.parse("/dashboard/")).toBe("dashboard");
  });

  /*
   * "." and "%" were excluded, which rejected the very shape this package's
   * own deep links carry: a redeem link whose token is a JWT is dot-separated,
   * so it was reported as an invalid path and the link was dropped.
   */
  it("accepts a dot-separated token, as in a JWT redeem link", () => {
    const path =
      "api/auth/desktop/redeem/eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.dBjftJeZ4CVP";

    expect(isDeepLinkPath(path)).toBe(true);
    expect(DeepLinkPathSchema.parse(path)).toBe(path);
  });

  it("accepts other unreserved characters and percent-encoding", () => {
    for (const path of [
      "settings/profile.json",
      "docs/v1.2/intro",
      "search/hello%20world",
      "a~b/c-d/e_f",
    ]) {
      expect(isDeepLinkPath(path)).toBe(true);
    }
  });

  it("still refuses characters that mean something in a URL", () => {
    for (const path of [
      "a?b=1",
      "a#frag",
      "a b",
      "http://evil.test",
      "users/user@example.com",
      "a\\b",
    ]) {
      expect(isDeepLinkPath(path)).toBe(false);
    }
  });

  /*
   * Allowing "." makes ".." expressible, and these paths are used to navigate.
   */
  it("refuses a parent-directory segment", () => {
    expect(isDeepLinkPath("api/../admin")).toBe(false);
    expect(isDeepLinkPath("..")).toBe(false);
    expect(isDeepLinkPath("../secrets")).toBe(false);
  });

  it("allows a dot inside a segment that is not traversal", () => {
    expect(isDeepLinkPath("a..b")).toBe(true);
    expect(isDeepLinkPath("v1.2.3/notes")).toBe(true);
  });
});

describe("DeepLinkUrlSchema", () => {
  it("accepts the default scheme", () => {
    expect(DeepLinkUrlSchema.safeParse("eigenn://dashboard").success).toBe(
      true,
    );
  });

  /*
   * deepLinkProtocol is a documented configuration option, so pinning this
   * schema to one product's scheme meant createDeepLink produced URLs that
   * this very schema rejected as soon as an application configured its own.
   */
  it("accepts a configured custom scheme", () => {
    expect(DeepLinkUrlSchema.safeParse("myapp://dashboard").success).toBe(true);
    expect(DeepLinkUrlSchema.safeParse("my-app.v2://x").success).toBe(true);
  });

  it("still refuses a value with no scheme", () => {
    for (const url of ["dashboard", "://dashboard", "1app://x", "myapp:/x"]) {
      expect(DeepLinkUrlSchema.safeParse(url).success).toBe(false);
    }
  });
});

describe("configuration", () => {
  it("fills every default", () => {
    expect(DEFAULT_CONFIG).toEqual({
      debug: false,
      deepLinksEnabled: true,
      deepLinkProtocol: "eigenn",
      logLevel: "info",
      maxRetries: 3,
      timeout: 5000,
    });
  });

  it("rejects out-of-range values", () => {
    expect(
      DesktopClientConfigSchema.safeParse({ maxRetries: 99 }).success,
    ).toBe(false);
    expect(DesktopClientConfigSchema.safeParse({ timeout: -1 }).success).toBe(
      false,
    );
  });
});

describe("type guards", () => {
  it("recognises platforms", () => {
    expect(isPlatform("darwin")).toBe(true);
    expect(isPlatform("win32")).toBe(true);
    expect(isPlatform("beos")).toBe(false);
  });

  it("recognises desktop client errors", () => {
    expect(isDesktopClientError({ code: "UNKNOWN_ERROR", message: "x" })).toBe(
      true,
    );
    expect(isDesktopClientError({ message: "no code" })).toBe(false);
  });

  it("maps every platform to a display name", () => {
    expect(PLATFORM_DISPLAY_NAMES).toEqual({
      darwin: "mac",
      win32: "windows",
      linux: "linux",
    });
  });
});

describe("ValidationPatterns.DEEP_LINK_URL", () => {
  it("agrees with DeepLinkUrlSchema", () => {
    const urls = [
      "eigenn://dashboard",
      "myapp://dashboard",
      "my-app.v2://x",
      "dashboard",
      "://dashboard",
      "1app://x",
    ];

    for (const url of urls) {
      expect(ValidationPatterns.DEEP_LINK_URL.test(url)).toBe(
        DeepLinkUrlSchema.safeParse(url).success,
      );
    }
  });
});
