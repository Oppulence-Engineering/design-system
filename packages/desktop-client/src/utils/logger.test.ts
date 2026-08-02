import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Logger, logger } from "./logger";

const METHODS = ["log", "info", "warn", "error", "debug"] as const;

/** Any ANSI escape sequence, which a browser console prints verbatim. */
const ANSI = /\[\d+m/;

function captureConsole() {
  const written: string[] = [];
  const original = new Map<string, unknown>();

  for (const method of METHODS) {
    original.set(method, console[method]);
    (console as unknown as Record<string, unknown>)[method] = (
      line: string,
    ) => {
      written.push(line);
    };
  }

  return {
    written,
    restore: () => {
      for (const method of METHODS) {
        (console as unknown as Record<string, unknown>)[method] =
          original.get(method);
      }
    },
  };
}

describe("Logger", () => {
  let capture: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    capture = captureConsole();
  });

  afterEach(() => {
    capture.restore();
    logger.configure({
      minLevel: "info",
      showTimestamps: true,
      showCategory: true,
      jsonOutput: false,
      useColors: false,
    });
  });

  it("writes the message", () => {
    logger.configure({ minLevel: "info", useColors: false });
    logger.info("hello");

    expect(capture.written).toHaveLength(1);
    expect(capture.written[0]).toContain("hello");
    expect(capture.written[0]).toContain("[INFO]");
  });

  it("suppresses levels below the minimum", () => {
    logger.configure({ minLevel: "warn", useColors: false });
    logger.debug("no");
    logger.info("no");
    logger.warn("yes");

    expect(capture.written).toHaveLength(1);
    expect(capture.written[0]).toContain("yes");
  });

  it("emits JSON when asked", () => {
    logger.configure({ minLevel: "info", jsonOutput: true });
    logger.info("structured", { userId: "u1" });

    const entry = JSON.parse(capture.written[0] as string);
    expect(entry.message).toBe("structured");
    expect(entry.metadata).toEqual({ userId: "u1" });
  });

  it("tags entries from withCategory", () => {
    logger.configure({ minLevel: "info", useColors: false, jsonOutput: false });
    logger.withCategory("DeepLinks").info("scoped");

    expect(capture.written[0]).toContain("[DeepLinks]");
  });

  it("keeps the parent's level in a category logger", () => {
    logger.configure({ minLevel: "error", useColors: false });
    logger.withCategory("DeepLinks").info("suppressed");

    expect(capture.written).toHaveLength(0);
  });

  describe("colours", () => {
    /*
     * This package runs inside a Tauri webview, and none of the webviews it
     * targets — WKWebView, WebView2, WebKitGTK — interpret ANSI. The codes were
     * emitted unconditionally, so every line arrived wrapped in escape
     * sequences the console printed as text.
     */
    it("emits no escape codes when colours are off", () => {
      logger.configure({ minLevel: "info", useColors: false });
      logger.info("plain", { a: 1 });

      expect(capture.written[0]).not.toMatch(ANSI);
      expect(capture.written[0]).toContain("plain");
    });

    it("emits escape codes when colours are on", () => {
      logger.configure({ minLevel: "info", useColors: true });
      logger.info("coloured");

      expect(capture.written[0]).toMatch(ANSI);
    });

    it("defaults to off in a browser-like environment", () => {
      const scope = globalThis as unknown as Record<string, unknown>;
      const hadDocument = "document" in scope;
      scope["document"] = { documentElement: {} };

      try {
        // A fresh instance picks up the default; the exported singleton was
        // built before this test ran.
        const fresh = Reflect.construct(Logger, [{}]) as Logger;
        fresh.info("browser");

        expect(capture.written.at(-1)).not.toMatch(ANSI);
      } finally {
        if (!hadDocument) delete scope["document"];
      }
    });
  });

  it("times an operation", () => {
    logger.configure({ minLevel: "debug", useColors: false });
    const stop = logger.time("work");
    stop();

    expect(capture.written.at(-1)).toContain("work took");
  });
});
