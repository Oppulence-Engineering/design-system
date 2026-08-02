import { describe, expect, it } from "vitest";

import { memoize, memoizeAsync } from "./memoize";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("memoize", () => {
  it("computes once per distinct argument", () => {
    let runs = 0;
    const memoized = memoize((n: number) => {
      runs += 1;
      return n * 2;
    });

    expect(memoized(5)).toBe(10);
    expect(memoized(5)).toBe(10);
    expect(memoized(3)).toBe(6);

    expect(runs).toBe(2);
  });

  /*
   * JSON.stringify renders an undefined array element as null, so these two
   * calls shared a key and the second returned the first one's result.
   */
  it("keeps null and undefined arguments apart", () => {
    let runs = 0;
    const memoized = memoize((value: unknown) => {
      runs += 1;
      return value;
    });

    expect(memoized(null)).toBeNull();
    expect(memoized(undefined)).toBeUndefined();
    expect(runs).toBe(2);
  });

  it("keeps an absent property apart from an undefined one", () => {
    let runs = 0;
    const memoized = memoize((value: { a?: number }) => {
      runs += 1;
      return value;
    });

    memoized({});
    memoized({ a: undefined });

    expect(runs).toBe(2);
  });

  it("uses a custom resolver when given one", () => {
    let runs = 0;
    const memoized = memoize(
      (opts: { id: string; verbose: boolean }) => {
        runs += 1;
        return opts.id;
      },
      { resolver: (opts) => opts.id },
    );

    memoized({ id: "a", verbose: true });
    memoized({ id: "a", verbose: false });

    expect(runs).toBe(1);
  });

  describe("maxSize", () => {
    it("evicts the oldest entry past the limit", () => {
      let runs = 0;
      const memoized = memoize(
        (n: number) => {
          runs += 1;
          return n;
        },
        { maxSize: 2 },
      );

      memoized(1);
      memoized(2);
      memoized(3);

      expect(memoized.cache.size).toBe(2);
      expect(memoized.has(1)).toBe(false);
      expect(memoized.has(3)).toBe(true);
      expect(runs).toBe(3);
    });

    // Eviction ran before insertion, so a zero-size cache dropped its one
    // entry and immediately added another, sitting at one entry forever.
    it("caches nothing at all when the size is zero", () => {
      let runs = 0;
      const memoized = memoize(
        (n: number) => {
          runs += 1;
          return n;
        },
        { maxSize: 0 },
      );

      memoized(1);
      memoized(1);

      expect(memoized.cache.size).toBe(0);
      expect(runs).toBe(2);
    });
  });

  describe("ttl", () => {
    it("recomputes after the entry goes stale", async () => {
      let runs = 0;
      const memoized = memoize(
        (n: number) => {
          runs += 1;
          return n;
        },
        { ttl: 30 },
      );

      memoized(1);
      memoized(1);
      expect(runs).toBe(1);

      await wait(60);
      memoized(1);
      expect(runs).toBe(2);
    });

    it("reports a stale entry as absent", async () => {
      const memoized = memoize((n: number) => n, { ttl: 30 });

      memoized(1);
      expect(memoized.has(1)).toBe(true);

      await wait(60);
      expect(memoized.has(1)).toBe(false);
    });
  });

  it("exposes cache management", () => {
    const memoized = memoize((n: number) => n);

    memoized(1);
    memoized(2);
    expect(memoized.cache.size).toBe(2);

    expect(memoized.delete(memoized.key(1))).toBe(true);
    expect(memoized.has(1)).toBe(false);

    memoized.clear();
    expect(memoized.cache.size).toBe(0);
  });
});

describe("memoizeAsync", () => {
  it("computes once per distinct argument", async () => {
    let runs = 0;
    const memoized = memoizeAsync(async (n: number) => {
      runs += 1;
      return n * 2;
    });

    expect(await memoized(5)).toBe(10);
    expect(await memoized(5)).toBe(10);

    expect(runs).toBe(1);
  });

  it("shares one call between concurrent callers", async () => {
    let runs = 0;
    const memoized = memoizeAsync(async (n: number) => {
      runs += 1;
      await wait(20);
      return n;
    });

    const results = await Promise.all([memoized(1), memoized(1), memoized(1)]);

    expect(results).toEqual([1, 1, 1]);
    expect(runs).toBe(1);
  });

  /*
   * The cache holds the resolved value, and a hit returned it bare — so a
   * function typed to return a Promise handed back a plain value, and only
   * from the second call onwards. Awaiting hid it; chaining did not.
   */
  it("returns a promise on a cache hit, not the bare value", async () => {
    const memoized = memoizeAsync(async (n: number) => n * 2);

    await memoized(1);
    const hit = memoized(1);

    expect(hit).toBeInstanceOf(Promise);
    expect(typeof (hit as { then?: unknown }).then).toBe("function");
    expect(await hit).toBe(2);
  });

  it("supports then() on a cache hit", async () => {
    const memoized = memoizeAsync(async (n: number) => n * 2);

    await memoized(1);

    await expect(
      new Promise((resolve) => {
        memoized(1).then(resolve);
      }),
    ).resolves.toBe(2);
  });

  it("propagates rejection and does not cache it", async () => {
    let runs = 0;
    const memoized = memoizeAsync(async (n: number) => {
      runs += 1;
      throw new Error(`boom ${n}`);
    });

    await expect(memoized(1)).rejects.toThrow("boom 1");
    await expect(memoized(1)).rejects.toThrow("boom 1");

    expect(runs).toBe(2);
  });

  it("caches nothing at all when the size is zero", async () => {
    let runs = 0;
    const memoized = memoizeAsync(
      async (n: number) => {
        runs += 1;
        return n;
      },
      { maxSize: 0 },
    );

    await memoized(1);
    await memoized(1);

    expect(memoized.cache.size).toBe(0);
    expect(runs).toBe(2);
  });
});
