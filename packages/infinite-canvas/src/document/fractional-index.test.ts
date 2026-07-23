import { describe, expect, it } from "vitest";
import {
  generateKeyBetween,
  generateNKeysBetween,
  generateJitteredKeyBetween,
} from "./fractional-index";

describe("generateKeyBetween", () => {
  it("produces a key between two open bounds", () => {
    const k = generateKeyBetween(null, null);
    expect(k.length).toBeGreaterThan(0);
  });

  it("orders before < between < after", () => {
    const a = generateKeyBetween(null, null);
    const before = generateKeyBetween(null, a);
    const after = generateKeyBetween(a, null);
    expect(before < a).toBe(true);
    expect(a < after).toBe(true);
  });

  it("inserts strictly between two adjacent keys repeatedly", () => {
    let lo = generateKeyBetween(null, null);
    let hi = generateKeyBetween(lo, null);
    for (let i = 0; i < 200; i++) {
      const mid = generateKeyBetween(lo, hi);
      expect(lo < mid).toBe(true);
      expect(mid < hi).toBe(true);
      // alternate which side we subdivide to stress both branches
      if (i % 2 === 0) hi = mid;
      else lo = mid;
    }
  });

  it("throws when bounds are out of order", () => {
    const a = generateKeyBetween(null, null);
    const b = generateKeyBetween(a, null);
    expect(() => generateKeyBetween(b, a)).toThrow();
  });

  it("never emits a trailing '0' digit (canonical form)", () => {
    for (let i = 0; i < 50; i++) {
      const a = generateKeyBetween(null, null);
      const k = generateKeyBetween(null, a);
      expect(k.endsWith("0")).toBe(false);
    }
  });
});

describe("generateNKeysBetween", () => {
  it("returns strictly increasing keys within bounds", () => {
    const keys = generateNKeysBetween(null, null, 25);
    expect(keys).toHaveLength(25);
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i - 1]! < keys[i]!).toBe(true);
    }
  });

  it("returns empty for count 0", () => {
    expect(generateNKeysBetween(null, null, 0)).toEqual([]);
  });
});

describe("generateJitteredKeyBetween", () => {
  it("stays strictly between bounds with a deterministic rng", () => {
    const rng = () => 0.42;
    const a = generateKeyBetween(null, null);
    const hi = generateKeyBetween(a, null);
    const k = generateJitteredKeyBetween(a, hi, rng);
    expect(a < k).toBe(true);
    expect(k < hi).toBe(true);
  });
});
