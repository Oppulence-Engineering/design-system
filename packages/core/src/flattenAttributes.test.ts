import { afterEach, describe, expect, it } from "vitest";

import {
  CIRCULAR_REFERENCE_SENTINEL,
  DEPTH_LIMIT_SENTINEL,
  flattenAttributes,
  MAX_FLATTEN_DEPTH,
  MAX_UNFLATTEN_ARRAY_LENGTH,
  NULL_SENTINEL,
  unflattenAttributes,
} from "./flattenAttributes";

/** Builds `{n: {n: ... {end: 1}}}` nested `levels` deep. */
function nest(levels: number): Record<string, unknown> {
  let deep: Record<string, unknown> = { end: 1 };
  for (let level = 0; level < levels; level += 1) deep = { n: deep };
  return deep;
}

describe("flattenAttributes", () => {
  it("flattens nested objects with dot notation", () => {
    expect(flattenAttributes({ user: { name: "John", age: 30 } })).toEqual({
      "user.name": "John",
      "user.age": 30,
    });
  });

  it("flattens arrays with bracket notation", () => {
    expect(flattenAttributes({ tags: ["a", "b"] })).toEqual({
      "tags.[0]": "a",
      "tags.[1]": "b",
    });
  });

  it("flattens arrays of objects", () => {
    expect(flattenAttributes({ rows: [{ id: 1 }, { id: 2 }] })).toEqual({
      "rows.[0].id": 1,
      "rows.[1].id": 2,
    });
  });

  it("flattens nested arrays", () => {
    expect(flattenAttributes({ grid: [[1, 2]] })).toEqual({
      "grid.[0].[0]": 1,
      "grid.[0].[1]": 2,
    });
  });

  it("records nulls with the sentinel, in objects and arrays alike", () => {
    expect(flattenAttributes({ a: null, b: [null] })).toEqual({
      a: NULL_SENTINEL,
      "b.[0]": NULL_SENTINEL,
    });
  });

  it("converts dates to ISO strings", () => {
    expect(
      flattenAttributes({ at: new Date("2026-01-01T00:00:00.000Z") }),
    ).toEqual({ at: "2026-01-01T00:00:00.000Z" });
  });

  describe("repeated references", () => {
    /*
     * `seen` used to hold everything visited rather than the current ancestor
     * chain, so the second appearance of any shared object was reported as a
     * cycle and its contents were dropped.
     */
    it("keeps the contents of an object referenced twice", () => {
      const shared = { a: 1 };
      expect(flattenAttributes({ x: shared, y: shared })).toEqual({
        "x.a": 1,
        "y.a": 1,
      });
    });

    it("keeps the contents of an object repeated in an array", () => {
      const shared = { a: 1 };
      expect(flattenAttributes({ list: [shared, shared] })).toEqual({
        "list.[0].a": 1,
        "list.[1].a": 1,
      });
    });

    it("still detects a genuine cycle", () => {
      const cyclic: Record<string, unknown> = { name: "test" };
      cyclic.self = cyclic;
      expect(flattenAttributes(cyclic)).toEqual({
        name: "test",
        self: CIRCULAR_REFERENCE_SENTINEL,
      });
    });

    it("detects a cycle through an array", () => {
      const cyclic: Record<string, unknown> = { name: "test" };
      cyclic.items = [cyclic];
      expect(flattenAttributes(cyclic)).toEqual({
        name: "test",
        "items.[0]": CIRCULAR_REFERENCE_SENTINEL,
      });
    });
  });

  describe("values with no attribute representation", () => {
    it("drops undefined from objects and arrays alike", () => {
      const flat = flattenAttributes({ a: undefined, b: [1, undefined, 3] });
      expect(Object.keys(flat).sort()).toEqual(["b.[0]", "b.[2]"]);
    });

    it("drops functions, symbols and bigints from arrays", () => {
      // These reached the result verbatim, despite Attributes forbidding them.
      expect(flattenAttributes({ a: [() => 1, Symbol("s"), 10n] })).toEqual({});
    });
  });

  describe("depth", () => {
    it("flattens structures just under the limit", () => {
      const flat = flattenAttributes(nest(MAX_FLATTEN_DEPTH - 2));
      expect(Object.values(flat)).toEqual([1]);
    });

    it("marks the truncation instead of overflowing the stack", () => {
      const flat = flattenAttributes(nest(60_000));
      expect(Object.values(flat)).toEqual([DEPTH_LIMIT_SENTINEL]);
    });
  });
});

describe("unflattenAttributes", () => {
  it("reconstructs nested objects", () => {
    expect(
      unflattenAttributes({ "user.name": "John", "user.age": 30 }),
    ).toEqual({ user: { name: "John", age: 30 } });
  });

  it("reconstructs arrays", () => {
    expect(unflattenAttributes({ "tags.[0]": "a", "tags.[1]": "b" })).toEqual({
      tags: ["a", "b"],
    });
  });

  it("restores nulls from the sentinel", () => {
    expect(unflattenAttributes({ "a.b": NULL_SENTINEL })).toEqual({
      a: { b: null },
    });
  });

  it("round-trips a nested structure", () => {
    const original = {
      user: { name: "John", tags: ["a", "b"], profile: { active: true } },
    };
    expect(unflattenAttributes(flattenAttributes(original))).toEqual(original);
  });

  it("returns a top-level array when the keys are all indices", () => {
    expect(unflattenAttributes({ "0": "a", "1": "b" })).toEqual(["a", "b"]);
  });

  describe("hostile keys", () => {
    const pollutionProbe = () =>
      (Object.prototype as Record<string, unknown>).polluted;

    afterEach(() => {
      delete (Object.prototype as Record<string, unknown>).polluted;
    });

    /*
     * These keys walked into Object.prototype and the assignment landed on
     * every object in the process. The input is flattened payload data, so it
     * is attacker-shaped.
     */
    it("does not write through __proto__", () => {
      unflattenAttributes({ "__proto__.polluted": "yes" });
      expect(pollutionProbe()).toBeUndefined();
    });

    it("does not write through constructor.prototype", () => {
      unflattenAttributes({ "constructor.prototype.polluted": "yes" });
      expect(pollutionProbe()).toBeUndefined();
    });

    it("does not write through bracketed __proto__", () => {
      unflattenAttributes({ "[__proto__].polluted": "yes" });
      expect(pollutionProbe()).toBeUndefined();
    });

    it("returns a plain object when every key is refused", () => {
      // Refusing them left `result` empty, and [].every() is true, so
      // Math.max() of nothing reached new Array(-Infinity).
      expect(unflattenAttributes({ "__proto__.polluted": "yes" })).toEqual({});
    });

    it("keeps ordinary keys that merely contain a reserved word", () => {
      expect(unflattenAttributes({ "a.constructorName": "x" })).toEqual({
        a: { constructorName: "x" },
      });
    });
  });

  describe("array length", () => {
    it("reconstructs an array at the limit", () => {
      const index = MAX_UNFLATTEN_ARRAY_LENGTH - 1;
      const result = unflattenAttributes({ [String(index)]: "x" });
      expect(Array.isArray(result)).toBe(true);
      expect((result as unknown as unknown[]).length).toBe(
        MAX_UNFLATTEN_ARRAY_LENGTH,
      );
    });

    it("refuses to allocate past the limit", () => {
      // One short key asked for 900 million slots.
      const result = unflattenAttributes({ "900000000": "x" });
      expect(Array.isArray(result)).toBe(false);
      expect(result).toEqual({ "900000000": "x" });
    });
  });
});
