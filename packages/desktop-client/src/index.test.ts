import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import packageJson from "../package.json" with { type: "json" };
import * as entry from "./index";

describe("package metadata", () => {
  /*
   * VERSION read "1.0.0" against a published 0.1.0, so anything reporting the
   * version — a crash report, a compatibility check — was told the wrong
   * number. Nothing tied the two together.
   */
  it("reports the same version as package.json", () => {
    expect(entry.VERSION).toBe(packageJson.version);
    expect(entry.METADATA.version).toBe(packageJson.version);
  });

  it("reports the same name and description as package.json", () => {
    expect(entry.METADATA.name).toBe(packageJson.name);
    expect(entry.METADATA.description).toBe(packageJson.description);
  });
});

describe("package entry point", () => {
  const EXPECTED_EXPORTS = [
    // core
    "WindowManager",
    "invoke",
    "invokeCommand",
    "listen",
    "emit",
    "openExternalUrl",
    "openUrl",
    // platform
    "isDesktopApp",
    "configureDesktopClient",
    "listenForDeepLinks",
    "createDeepLink",
    "openDeepLink",
    "cleanupPlatform",
    // desktop-variants
    "desktopPlugin",
    "detectPlatform",
    "applyPlatformClasses",
    "getPlatformDisplayName",
    // types
    "DEFAULT_CONFIG",
    "PLATFORM_DISPLAY_NAMES",
    "isPlatform",
    "isDeepLinkPath",
    "isDesktopClientError",
    // utils
    "CONSTANTS",
    "ErrorHandler",
    "Logger",
    "logger",
    "ErrorCodes",
    "handleGlobalError",
  ] as const;

  for (const name of EXPECTED_EXPORTS) {
    it(`exports ${name}`, () => {
      expect(entry).toHaveProperty(name);
      expect((entry as unknown as Record<string, unknown>)[name]).toBeDefined();
    });
  }
});

describe("browser safety", () => {
  /*
   * This package is built for the browser and runs inside a Tauri webview,
   * where `process` does not exist. `constants.ts` destructured `process.env`
   * at module scope, and since every entry point reaches it, importing any part
   * of the package threw ReferenceError unless the host bundler happened to
   * inject a shim.
   */
  /*
   * Run in a fresh process. Deleting `globalThis.process` in this one and
   * re-importing proves nothing: the modules are already in the module cache
   * from the import at the top of this file, so nothing re-evaluates.
   */
  it("does not read process at module scope", () => {
    const modules = [
      "./utils/constants.ts",
      "./utils/logger.ts",
      "./utils/error-handler.ts",
      "./types/index.ts",
      "./desktop-variants.ts",
    ].map((specifier) => fileURLToPath(new URL(specifier, import.meta.url)));

    const script = [
      "delete globalThis.process;",
      ...modules.map((path) => `await import(${JSON.stringify(path)});`),
    ].join("\n");

    expect(() =>
      execFileSync("bun", ["-e", script], { stdio: "pipe" }),
    ).not.toThrow();
  });

  it("still resolves a default config without process", () => {
    expect(entry.CONSTANTS.Default.DEEP_LINKS_ENABLED).toBe(true);
    expect(typeof entry.CONSTANTS.Default.DEBUG).toBe("boolean");
  });
});
