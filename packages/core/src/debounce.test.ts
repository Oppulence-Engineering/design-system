import { describe, expect, it } from "vitest";

import { debounce, throttle } from "./debounce";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * These use real timers with generous margins rather than exact instants, so
 * they assert what the contract promises — how many times, in what order —
 * rather than scheduler precision.
 */
const DELAY = 40;
const QUIET = DELAY * 4;

function recorder() {
  const calls: unknown[] = [];
  return { calls, fn: (value: unknown) => calls.push(value) };
}

describe("debounce", () => {
  it("coalesces a burst into one trailing call with the last arguments", async () => {
    const { calls, fn } = recorder();
    const debounced = debounce(fn, DELAY);

    debounced(1);
    debounced(2);
    debounced(3);
    await wait(QUIET);

    expect(calls).toEqual([3]);
  });

  it("waits for the burst to finish before invoking", async () => {
    const { calls, fn } = recorder();
    const debounced = debounce(fn, DELAY);

    debounced("a");
    await wait(DELAY / 2);
    expect(calls).toEqual([]);

    debounced("b");
    await wait(QUIET);
    expect(calls).toEqual(["b"]);
  });

  it("invokes immediately on the leading edge", async () => {
    const { calls, fn } = recorder();
    const debounced = debounce(fn, DELAY, { leading: true, trailing: false });

    debounced("now");
    expect(calls).toEqual(["now"]);

    debounced.cancel();
    await wait(QUIET);
  });

  /*
   * The module documents exactly this: "After 300ms of no calls, next call will
   * execute immediately again". It did not. The burst-end timer was armed only
   * when `trailing` was set, so the second call cancelled it and nothing ever
   * re-armed it — the function invoked once and never again.
   */
  it("fires on the leading edge again after a quiet period", async () => {
    const { calls, fn } = recorder();
    const debounced = debounce(fn, DELAY, { leading: true, trailing: false });

    debounced("first");
    await wait(DELAY / 4);
    debounced("ignored");
    await wait(QUIET);
    debounced("third");

    expect(calls).toEqual(["first", "third"]);
    debounced.cancel();
  });

  it("does not invoke twice for a lone leading-and-trailing call", async () => {
    const { calls, fn } = recorder();
    const debounced = debounce(fn, DELAY, { leading: true, trailing: true });

    debounced("only");
    await wait(QUIET);

    expect(calls).toEqual(["only"]);
  });

  it("invokes on both edges of a burst", async () => {
    const { calls, fn } = recorder();
    const debounced = debounce(fn, DELAY, { leading: true, trailing: true });

    debounced("a");
    await wait(DELAY / 4);
    debounced("b");
    await wait(DELAY / 4);
    debounced("c");
    await wait(QUIET);

    expect(calls).toEqual(["a", "c"]);
  });

  describe("maxWait", () => {
    /*
     * `lastInvokeTime` started at 0, which read as an invocation at the epoch.
     * The first burst computed a time-since-invoke of decades, `maxWait` minus
     * that clamped to 0, and the timer fired on the next tick — so a debounce
     * carrying `maxWait` invoked almost immediately instead of debouncing.
     */
    it("does not invoke before the delay on the first burst", async () => {
      const { calls, fn } = recorder();
      const debounced = debounce(fn, DELAY, { maxWait: DELAY * 10 });

      debounced("x");
      await wait(DELAY / 2);
      expect(calls).toEqual([]);

      await wait(QUIET);
      expect(calls).toEqual(["x"]);
    });

    it("forces an invocation while calls keep arriving", async () => {
      const { calls, fn } = recorder();
      const debounced = debounce(fn, DELAY, { maxWait: DELAY * 2 });

      const interval = setInterval(() => debounced("x"), DELAY / 4);
      await wait(DELAY * 3);
      clearInterval(interval);
      debounced.cancel();

      // Without maxWait the continuous calls would have deferred it forever.
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("pending", () => {
    it("is true while a trailing call is owed", async () => {
      const { fn } = recorder();
      const debounced = debounce(fn, DELAY);

      debounced("x");
      expect(debounced.pending()).toBe(true);

      await wait(QUIET);
      expect(debounced.pending()).toBe(false);
    });

    // A leading-edge call has already run; nothing is scheduled behind it.
    it("is false right after a leading-edge invocation", async () => {
      const { fn } = recorder();
      const debounced = debounce(fn, DELAY, { leading: true, trailing: false });

      debounced("x");
      expect(debounced.pending()).toBe(false);

      debounced.cancel();
      await wait(QUIET);
    });

    // The burst timer used to be cleared without being nulled, so this stayed
    // true for the life of the function.
    it("is false once a non-trailing burst has settled", async () => {
      const { fn } = recorder();
      const debounced = debounce(fn, DELAY, { leading: true, trailing: false });

      debounced("x");
      await wait(DELAY / 4);
      debounced("y");
      await wait(QUIET);

      expect(debounced.pending()).toBe(false);
    });
  });

  describe("cancel and flush", () => {
    it("cancel drops the pending call", async () => {
      const { calls, fn } = recorder();
      const debounced = debounce(fn, DELAY);

      debounced("x");
      debounced.cancel();
      await wait(QUIET);

      expect(calls).toEqual([]);
      expect(debounced.pending()).toBe(false);
    });

    it("flush invokes the pending call immediately", async () => {
      const { calls, fn } = recorder();
      const debounced = debounce(fn, DELAY);

      debounced("x");
      debounced.flush();

      expect(calls).toEqual(["x"]);
      expect(debounced.pending()).toBe(false);

      await wait(QUIET);
      expect(calls).toEqual(["x"]);
    });

    it("flush does nothing when no call is scheduled", () => {
      const { calls, fn } = recorder();
      const debounced = debounce(fn, DELAY);

      debounced.flush();

      expect(calls).toEqual([]);
    });
  });
});

describe("throttle", () => {
  it("invokes on the leading edge", () => {
    const { calls, fn } = recorder();
    const throttled = throttle(fn, DELAY);

    throttled("x");
    expect(calls).toEqual(["x"]);

    throttled.cancel();
  });

  /*
   * throttle promises "at most once per every specified number of
   * milliseconds". The maxWait handler used to clear `lastCallTime`, so the
   * next call — usually in the same millisecond, since maxWait fires mid-burst
   * — looked like a new burst and fired the leading edge straight after the
   * invocation it had just made. Every window produced two calls.
   */
  it("invokes at most once per window under continuous calls", async () => {
    const { calls, fn } = recorder();
    const limit = 50;
    const windows = 4;
    const throttled = throttle(fn, limit);

    const interval = setInterval(() => throttled("x"), limit / 5);
    await wait(limit * windows);
    clearInterval(interval);
    throttled.cancel();

    // One per window, plus at most one for a partly elapsed final window.
    expect(calls.length).toBeGreaterThanOrEqual(windows - 1);
    expect(calls.length).toBeLessThanOrEqual(windows + 1);
  });
});
