import { describe, expect, it } from "vitest";

import { eventFilterMatches } from "./eventFilterMatches";
import type { EventFilter } from "./schemas/eventFilter";

const matches = (
  payload: Record<string, unknown> | null,
  filter: EventFilter,
) => eventFilterMatches(payload, filter);

describe("eventFilterMatches", () => {
  it("matches a value in a string list", () => {
    expect(matches({ status: "active" }, { status: ["active", "idle"] })).toBe(
      true,
    );
    expect(matches({ status: "gone" }, { status: ["active"] })).toBe(false);
  });

  it("matches numbers and booleans", () => {
    expect(matches({ n: 2 }, { n: [1, 2] })).toBe(true);
    expect(matches({ ok: true }, { ok: [true] })).toBe(true);
    expect(matches({ ok: true }, { ok: [false] })).toBe(false);
  });

  it("treats an empty matcher as no constraint", () => {
    expect(matches({ anything: 1 }, { anything: [] })).toBe(true);
  });

  it("matches nested filters", () => {
    expect(matches({ user: { name: "jo" } }, { user: { name: ["jo"] } })).toBe(
      true,
    );
    expect(matches({ user: { name: "sam" } }, { user: { name: ["jo"] } })).toBe(
      false,
    );
  });

  it("matches when any array element satisfies a nested filter", () => {
    expect(
      matches({ items: [{ id: 1 }, { id: 2 }] }, { items: { id: [2] } }),
    ).toBe(true);
    expect(matches({ items: [{ id: 1 }] }, { items: { id: [2] } })).toBe(false);
  });

  it("accepts a null payload only against an empty filter", () => {
    expect(matches(null, {})).toBe(true);
    expect(matches(null, { a: ["x"] })).toBe(false);
  });

  describe("content filters", () => {
    it("matches string shapes", () => {
      expect(matches({ f: "a.png" }, { f: [{ $endsWith: ".png" }] })).toBe(
        true,
      );
      expect(matches({ f: "a.jpg" }, { f: [{ $endsWith: ".png" }] })).toBe(
        false,
      );
      expect(matches({ f: "img/a" }, { f: [{ $startsWith: "img/" }] })).toBe(
        true,
      );
      expect(matches({ f: "ABC" }, { f: [{ $ignoreCaseEquals: "abc" }] })).toBe(
        true,
      );
    });

    it("compares numbers", () => {
      expect(matches({ n: 5 }, { n: [{ $gt: 4 }] })).toBe(true);
      expect(matches({ n: 5 }, { n: [{ $lt: 4 }] })).toBe(false);
      expect(matches({ n: 5 }, { n: [{ $gte: 5 }] })).toBe(true);
      expect(matches({ n: 5 }, { n: [{ $lte: 5 }] })).toBe(true);
      expect(matches({ n: 5 }, { n: [{ $between: [1, 10] }] })).toBe(true);
      expect(matches({ n: 50 }, { n: [{ $between: [1, 10] }] })).toBe(false);
    });

    it("tests presence and null", () => {
      expect(matches({ a: 1 }, { a: [{ $exists: true }] })).toBe(true);
      expect(matches({}, { a: [{ $exists: true }] })).toBe(false);
      expect(matches({}, { a: [{ $exists: false }] })).toBe(true);
      expect(matches({ a: null }, { a: [{ $isNull: true }] })).toBe(true);
      expect(matches({ a: 1 }, { a: [{ $isNull: true }] })).toBe(false);
    });

    it("tests array membership", () => {
      expect(
        matches({ tags: ["a", "b"] }, { tags: [{ $includes: "a" }] }),
      ).toBe(true);
      expect(matches({ tags: ["a"] }, { tags: [{ $includes: "z" }] })).toBe(
        false,
      );
    });

    it("applies every filter in the list", () => {
      expect(
        matches(
          { f: "img/a.png" },
          {
            f: [{ $startsWith: "img/" }, { $endsWith: ".png" }],
          },
        ),
      ).toBe(true);
      expect(
        matches(
          { f: "img/a.jpg" },
          {
            f: [{ $startsWith: "img/" }, { $endsWith: ".png" }],
          },
        ),
      ).toBe(false);
    });

    /*
     * $not and $anythingBut are the same predicate under two names, and they
     * disagreed on every value that was not a primitive: $not fell through to
     * false, so a payload missing the key failed a "not equal to x" filter.
     */
    describe("$not agrees with $anythingBut", () => {
      const cases: ReadonlyArray<
        readonly [string, Record<string, unknown>, boolean]
      > = [
        ["an absent key", {}, true],
        ["a null value", { s: null }, true],
        ["an object value", { s: { a: 1 } }, true],
        ["the excluded value", { s: "x" }, false],
        ["some other value", { s: "y" }, true],
      ];

      for (const [description, payload, expected] of cases) {
        it(`answers ${expected} for ${description}`, () => {
          expect(matches(payload, { s: [{ $not: "x" }] })).toBe(expected);
          expect(matches(payload, { s: [{ $anythingBut: "x" }] })).toBe(
            expected,
          );
        });
      }
    });

    it("still excludes a matching element of an array", () => {
      expect(matches({ s: ["x", "y"] }, { s: [{ $not: "x" }] })).toBe(false);
      expect(matches({ s: ["y"] }, { s: [{ $not: "x" }] })).toBe(true);
    });

    it("excludes any value in an $anythingBut list", () => {
      expect(matches({ s: "x" }, { s: [{ $anythingBut: ["x", "y"] }] })).toBe(
        false,
      );
      expect(matches({ s: "z" }, { s: [{ $anythingBut: ["x", "y"] }] })).toBe(
        true,
      );
    });
  });
});
