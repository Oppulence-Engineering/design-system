import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createLogger } from "./logger";

type Console = typeof globalThis.console;

/** Captures whatever the logger writes, whichever console method it picks. */
function captureConsole() {
  const written: string[] = [];
  const original: Partial<Console> = {};
  const methods = ["log", "info", "warn", "error", "debug"] as const;

  for (const method of methods) {
    original[method] = console[method];
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
      for (const method of methods) {
        (console as unknown as Record<string, unknown>)[method] =
          original[method];
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
  });

  it("writes a structured line with the message and level", () => {
    createLogger("test", "info").info("hello");

    const [entry] = capture.entries();
    expect(entry.message).toBe("hello");
    expect(entry.level).toBe("info");
    expect(entry.name).toBe("test");
    expect(typeof entry.timestamp).toBe("string");
  });

  it("respects the level threshold", () => {
    const log = createLogger("test", "warn");
    log.debug("not written");
    log.info("not written");
    log.warn("written");

    expect(capture.entries().map((entry) => entry.message)).toEqual([
      "written",
    ]);
  });

  it("merges a structured argument into the line", () => {
    createLogger("test", "info").info("with fields", { userId: "u1" });

    expect(capture.entries()[0].userId).toBe("u1");
  });

  it("extracts an error argument", () => {
    createLogger("test", "info").info("failed", {
      error: new Error("boom"),
    });

    const [entry] = capture.entries();
    expect(entry.error.message).toBe("boom");
    expect(entry.error.name).toBe("Error");
  });

  describe("cloning of logged values", () => {
    /*
     * The clone's `seen` set held everything it had ever touched rather than
     * the ancestors of the current value, so the second appearance of a shared
     * object was written as "[Circular]" — a logger dropping the data being
     * logged.
     */
    it("keeps both copies of an object referenced twice", () => {
      const shared = { id: 7 };
      createLogger("test", "info").info("shared", {
        first: shared,
        second: shared,
      });

      const [entry] = capture.entries();
      expect(entry.first).toEqual({ id: 7 });
      expect(entry.second).toEqual({ id: 7 });
    });

    it("keeps both copies inside an array", () => {
      const shared = { id: 7 };
      createLogger("test", "info").info("shared", { rows: [shared, shared] });

      expect(capture.entries()[0].rows).toEqual([{ id: 7 }, { id: 7 }]);
    });

    it("still marks a genuine cycle", () => {
      const cyclic: Record<string, unknown> = { name: "c" };
      cyclic.self = cyclic;

      createLogger("test", "info").info("cyclic", { cyclic });

      expect(capture.entries()[0].cyclic).toEqual({
        name: "c",
        self: "[Circular]",
      });
    });

    it("does not treat a caller's own __circular__ field as a cycle", () => {
      createLogger("test", "info").info("marker", {
        payload: { __circular__: true, keep: "me" },
      });

      expect(capture.entries()[0].payload).toEqual({
        __circular__: true,
        keep: "me",
      });
    });
  });

  describe("batching", () => {
    it("buffers until flushed", async () => {
      const flushed: unknown[][] = [];
      const log = createLogger("test", "info");
      log.enableBatching({
        maxSize: 100,
        flushIntervalMs: 10_000,
        onFlush: async (logs) => {
          flushed.push(logs);
        },
      });

      log.info("buffered");
      expect(capture.written).toHaveLength(0);

      await log.flush();
      log.disableBatching();

      expect(flushed).toHaveLength(1);
      expect(flushed[0]).toHaveLength(1);
    });

    /*
     * The interval handle was assigned over, leaving the previous timer running
     * with nothing holding it: enabling batching twice kept flushing on the old
     * cadence and held the event loop open, and disableBatching could only
     * clear the most recent one.
     */
    it("replaces the flush interval rather than leaving both running", async () => {
      const flushes: number[] = [];
      const log = createLogger("test", "info");
      const onFlush = async (logs: unknown[]) => {
        flushes.push(logs.length);
      };

      log.enableBatching({ maxSize: 1_000, flushIntervalMs: 20, onFlush });
      log.enableBatching({ maxSize: 1_000, flushIntervalMs: 5_000, onFlush });

      log.info("buffered");
      await new Promise((resolve) => setTimeout(resolve, 120));

      // Only the 5s interval should remain, so nothing fires inside 120ms.
      // The orphaned 20ms interval flushed the entry at about 20ms.
      expect(flushes).toEqual([]);

      log.disableBatching();
      expect(flushes).toEqual([1]);
    });
  });
});
