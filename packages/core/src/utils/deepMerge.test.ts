import { afterEach, describe, expect, it } from "vitest";

import { deepMerge, deepMergeWithOptions } from "./deepMerge";

type Loose = Record<string, unknown>;

describe("deepMerge", () => {
  it("merges nested objects, preferring later sources", () => {
    expect(
      deepMerge({ a: 1, b: { c: 2 } } as Loose, { b: { d: 3 } }, { a: 10 }),
    ).toEqual({ a: 10, b: { c: 2, d: 3 } });
  });

  it("leaves the inputs untouched", () => {
    const target = { a: 1, nested: { b: 2 } } as Loose;
    const source = { nested: { c: 3 } };

    deepMerge(target, source);

    expect(target).toEqual({ a: 1, nested: { b: 2 } });
    expect(source).toEqual({ nested: { c: 3 } });
  });

  it("skips undefined source values but honours null", () => {
    expect(
      deepMerge({ a: 1, b: 2 } as Loose, { a: undefined, b: null }),
    ).toEqual({ a: 1, b: null });
  });

  it("replaces arrays by default", () => {
    expect(deepMerge({ tags: ["a", "b"] } as Loose, { tags: ["c"] })).toEqual({
      tags: ["c"],
    });
  });

  it("clones nested structures rather than sharing them", () => {
    const source = { nested: { deep: { value: 1 } } };
    const merged = deepMerge({} as Loose, source);

    (source.nested.deep as { value: number }).value = 99;

    expect((merged.nested as { deep: { value: number } }).deep.value).toBe(1);
  });

  describe("cycles", () => {
    /*
     * deepMerge clones its target by default, and the clone recursed through a
     * self-reference until the stack ran out — despite the function carrying a
     * comment claiming circular-reference detection.
     */
    it("clones a self-referential target", () => {
      const target: Loose = { a: 1 };
      target.self = target;

      const merged = deepMerge(target, { a: 2 });

      expect(merged.a).toBe(2);
      expect(merged.self).toBe(merged);
    });

    it("clones a structure that shares a nested reference twice", () => {
      const shared = { value: 1 };
      const target = { x: shared, y: shared } as Loose;

      const merged = deepMerge(target, {});

      expect(merged.x).toEqual({ value: 1 });
      expect(merged.y).toEqual({ value: 1 });
      expect(merged.x).toBe(merged.y);
    });

    it("clones a cycle inside an array", () => {
      const target: Loose = { items: [] as unknown[] };
      (target.items as unknown[]).push(target);

      const merged = deepMerge(target, {});

      expect((merged.items as unknown[])[0]).toBe(merged);
    });
  });

  describe("hostile keys", () => {
    afterEach(() => {
      delete (Object.prototype as Loose).polluted;
    });

    /*
     * Sources are usually parsed configuration or request data. With
     * `clone: false` the object being filled is the caller's target, and
     * assigning `__proto__` wrote straight onto Object.prototype — changing
     * every object in the process.
     */
    it("does not write through __proto__ when cloning is off", () => {
      const hostile = JSON.parse('{"__proto__":{"polluted":"yes"}}');

      deepMergeWithOptions({} as Loose, { clone: false }, hostile);

      expect(({} as Loose).polluted).toBeUndefined();
    });

    it("does not re-parent the result when cloning is on", () => {
      const hostile = JSON.parse('{"__proto__":{"polluted":"yes"}}');

      const merged = deepMerge({} as Loose, hostile);

      expect(({} as Loose).polluted).toBeUndefined();
      expect(merged.polluted).toBeUndefined();
      expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    });

    it("does not carry __proto__ through a clone of the target", () => {
      const target = JSON.parse('{"__proto__":{"polluted":"yes"},"a":1}');

      const merged = deepMerge(target as Loose, { b: 2 });

      expect(merged).toEqual({ a: 1, b: 2 });
      expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    });
  });
});

describe("deepMergeWithOptions", () => {
  it("concatenates arrays when asked", () => {
    expect(
      deepMergeWithOptions(
        { tags: ["a", "b"] } as Loose,
        {
          arrayMerge: "concat",
        },
        { tags: ["c", "d"] },
      ),
    ).toEqual({ tags: ["a", "b", "c", "d"] });
  });

  it("merges arrays by index when asked", () => {
    expect(
      deepMergeWithOptions(
        { list: [1, 2, 3] } as Loose,
        {
          arrayMerge: "merge",
        },
        { list: [9] },
      ),
    ).toEqual({ list: [9, 2, 3] });
  });

  it("uses a custom merge function where it returns a value", () => {
    expect(
      deepMergeWithOptions(
        { count: 5, other: "a" } as Loose,
        {
          customMerge: (key, target, source) =>
            key === "count" &&
            typeof target === "number" &&
            typeof source === "number"
              ? target + source
              : undefined,
        },
        { count: 3, other: "b" },
      ),
    ).toEqual({ count: 8, other: "b" });
  });

  it("writes into the target itself when cloning is off", () => {
    const target = { a: 1 } as Loose;

    const merged = deepMergeWithOptions(target, { clone: false }, { b: 2 });

    expect(merged).toBe(target);
    expect(target).toEqual({ a: 1, b: 2 });
  });
});
