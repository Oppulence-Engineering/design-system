import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LogLevel, SimpleStructuredLogger } from "./structuredLogger";

const METHODS = ["log", "info", "warn", "error", "debug"] as const;

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
    entries: () => written.map((line) => JSON.parse(line)),
    restore: () => {
      for (const method of METHODS) {
        (console as unknown as Record<string, unknown>)[method] =
          original.get(method);
      }
    },
  };
}

describe("SimpleStructuredLogger", () => {
  let capture: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    capture = captureConsole();
  });

  afterEach(() => {
    capture.restore();
  });

  it("writes name, level and message", () => {
    new SimpleStructuredLogger("svc", LogLevel.info).info("hello");

    const [entry] = capture.entries();
    expect(entry.$name).toBe("svc");
    expect(entry.$level).toBe("info");
    expect(entry.message).toBe("hello");
  });

  it("suppresses anything below the level", () => {
    const logger = new SimpleStructuredLogger("svc", LogLevel.warn);
    logger.debug("no");
    logger.info("no");
    logger.warn("yes");
    logger.error("yes");

    expect(capture.entries().map((entry) => entry.message)).toEqual([
      "yes",
      "yes",
    ]);
  });

  it("includes constructor fields", () => {
    new SimpleStructuredLogger("svc", LogLevel.info, { app: "x" }).info("hi");

    expect(capture.entries()[0].app).toBe("x");
  });

  it("merges added fields", () => {
    const logger = new SimpleStructuredLogger("svc", LogLevel.info, {
      app: "x",
    });
    logger.addFields({ region: "eu" });
    logger.info("hi");

    const [entry] = capture.entries();
    expect(entry.app).toBe("x");
    expect(entry.region).toBe("eu");
  });

  describe("child", () => {
    it("carries the parent's fields alongside its own", () => {
      const parent = new SimpleStructuredLogger("svc", LogLevel.info, {
        app: "x",
      });
      parent.child({ req: "1" }).info("hi");

      const [entry] = capture.entries();
      expect(entry.app).toBe("x");
      expect(entry.req).toBe("1");
    });

    /*
     * `level` was passed straight through, so an omitted argument — the usual
     * call — landed on the constructor's default parameter, which re-derives
     * the level from DEBUG and VERBOSE. A logger built at LogLevel.error handed
     * out children that logged at info.
     */
    it("inherits the parent's level", () => {
      const parent = new SimpleStructuredLogger("svc", LogLevel.error);

      parent.child({ req: "1" }).info("should be suppressed");

      expect(capture.written).toHaveLength(0);
    });

    it("still allows the level to be overridden", () => {
      const parent = new SimpleStructuredLogger("svc", LogLevel.error);

      parent.child({ req: "1" }, LogLevel.debug).debug("written");

      expect(capture.entries().map((entry) => entry.message)).toEqual([
        "written",
      ]);
    });
  });
});
