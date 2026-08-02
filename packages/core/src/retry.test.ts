import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { calculateResetAt } from "./retry";

/**
 * Covers the two defects this module shipped with: durations added through the
 * local-time setters, which lose an hour across a daylight-saving boundary, and
 * `Number.parseInt`, which reads "12abc" as 12 and turns a malformed header
 * into a plausible date.
 */
describe("calculateResetAt", () => {
  const now = new Date("2026-05-01T12:00:00.000Z");

  describe("unix_timestamp", () => {
    it("reads whole seconds", () => {
      expect(
        calculateResetAt("1767225600", "unix_timestamp", now)?.toISOString(),
      ).toBe("2026-01-01T00:00:00.000Z");
    });

    it("tolerates surrounding whitespace, which headers often carry", () => {
      expect(
        calculateResetAt(" 1767225600 ", "unix_timestamp", now)?.toISOString(),
      ).toBe("2026-01-01T00:00:00.000Z");
    });

    it("refuses a value with trailing characters", () => {
      // parseInt answered 12 here, putting the reset in 1970.
      expect(calculateResetAt("12abc", "unix_timestamp", now)).toBeUndefined();
    });

    const malformed = [
      "",
      "  ",
      "abc",
      "1.5",
      "1e3",
      "0x10",
      "NaN",
      "Infinity",
    ];
    for (const value of malformed) {
      it(`refuses ${JSON.stringify(value)}`, () => {
        expect(calculateResetAt(value, "unix_timestamp", now)).toBeUndefined();
      });
    }

    it("refuses a value too large to be a real date", () => {
      expect(
        calculateResetAt("99999999999999999", "unix_timestamp", now),
      ).toBeUndefined();
    });
  });

  describe("unix_timestamp_in_ms", () => {
    it("reads milliseconds", () => {
      expect(
        calculateResetAt(
          "1767225600000",
          "unix_timestamp_in_ms",
          now,
        )?.toISOString(),
      ).toBe("2026-01-01T00:00:00.000Z");
    });

    it("refuses a value with trailing characters", () => {
      expect(
        calculateResetAt("500ms", "unix_timestamp_in_ms", now),
      ).toBeUndefined();
    });
  });

  describe("iso_8601", () => {
    it("reads an absolute timestamp", () => {
      expect(
        calculateResetAt(
          "2026-01-01T00:00:00.000Z",
          "iso_8601",
          now,
        )?.toISOString(),
      ).toBe("2026-01-01T00:00:00.000Z");
    });

    it("refuses an unparseable timestamp", () => {
      expect(calculateResetAt("not-a-date", "iso_8601", now)).toBeUndefined();
    });
  });

  describe("iso_8601_duration_openai_variant", () => {
    const duration = (value: string, from = now) =>
      calculateResetAt(value, "iso_8601_duration_openai_variant", from);

    const cases: ReadonlyArray<readonly [string, number]> = [
      ["1s", 1_000],
      ["1m", 60_000],
      ["1h", 3_600_000],
      ["1d", 86_400_000],
      ["500ms", 500],
      ["1.5s", 1_500],
      ["1d2h3m4s5ms", 93_784_005],
    ];
    for (const [value, expectedMs] of cases) {
      it(`advances ${value} by ${expectedMs}ms`, () => {
        expect(duration(value)!.getTime() - now.getTime()).toBe(expectedMs);
      });
    }

    for (const value of ["1x", "d1", "1 d", "abc", "1dd"]) {
      it(`refuses ${JSON.stringify(value)}`, () => {
        expect(duration(value)).toBeUndefined();
      });
    }

    it("does not mutate the date it is given", () => {
      const before = now.getTime();
      duration("1d");
      expect(now.getTime()).toBe(before);
    });

    /*
     * Pinned to a zone that observes daylight saving, because the bug was
     * invisible in UTC: setDate/setHours move the wall clock, so on a
     * spring-forward morning "1d" advanced the calendar a day but only 23 hours
     * of real time and the caller retried while still rate limited.
     */
    describe("across a daylight-saving boundary", () => {
      const originalTz = process.env.TZ;

      beforeAll(() => {
        process.env.TZ = "America/New_York";
      });

      afterAll(() => {
        if (originalTz === undefined) delete process.env.TZ;
        else process.env.TZ = originalTz;
      });

      it("adds 24 real hours over spring forward", () => {
        // 01:30 EST, half an hour before clocks jump to 03:00.
        const from = new Date("2026-03-08T06:30:00.000Z");
        expect(
          (duration("1d", from)!.getTime() - from.getTime()) / 3_600_000,
        ).toBe(24);
      });

      it("adds 24 real hours over fall back", () => {
        // 00:30 EDT on the morning clocks repeat the 01:00 hour.
        const from = new Date("2026-11-01T04:30:00.000Z");
        expect(
          (duration("1d", from)!.getTime() - from.getTime()) / 3_600_000,
        ).toBe(24);
      });

      it("adds 3 real hours over the skipped hour", () => {
        const from = new Date("2026-03-08T06:30:00.000Z");
        expect(
          (duration("3h", from)!.getTime() - from.getTime()) / 3_600_000,
        ).toBe(3);
      });
    });
  });

  it("returns nothing for an absent header", () => {
    expect(calculateResetAt(undefined, "unix_timestamp", now)).toBeUndefined();
    expect(calculateResetAt(null, "unix_timestamp", now)).toBeUndefined();
  });
});
