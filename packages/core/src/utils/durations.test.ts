import { describe, expect, it } from "vitest";

import {
  formatDuration,
  formatDurationInDays,
  formatDurationMilliseconds,
  formatDurationNanoseconds,
  millisecondsToNanoseconds,
  nanosecondsToMilliseconds,
} from "./durations";

const NO_DURATION = "–";

describe("formatDuration", () => {
  it("formats the span between two dates", () => {
    expect(
      formatDuration(
        new Date("2026-01-01T10:00:00Z"),
        new Date("2026-01-01T12:30:00Z"),
      ),
    ).toBe("2 hours, 30 minutes");
  });

  it("is order-independent", () => {
    const early = new Date("2026-01-01T10:00:00Z");
    const late = new Date("2026-01-01T12:30:00Z");

    expect(formatDuration(late, early)).toBe(formatDuration(early, late));
  });

  it("reports no duration for a missing date", () => {
    const date = new Date("2026-01-01T10:00:00Z");

    expect(formatDuration(null, date)).toBe(NO_DURATION);
    expect(formatDuration(date, null)).toBe(NO_DURATION);
    expect(formatDuration(undefined, undefined)).toBe(NO_DURATION);
  });

  /*
   * An Invalid Date is still an object, so it passed the truthiness check and
   * its NaN difference formatted as "0 seconds" — a plausible-looking duration
   * standing in for one that could not be computed at all.
   */
  it("reports no duration for an invalid date", () => {
    const valid = new Date("2026-01-01T10:00:00Z");

    expect(formatDuration(new Date("nonsense"), valid)).toBe(NO_DURATION);
    expect(formatDuration(valid, new Date("nonsense"))).toBe(NO_DURATION);
  });
});

describe("formatDurationMilliseconds", () => {
  it("uses milliseconds below one second", () => {
    expect(formatDurationMilliseconds(500)).toBe("500 milliseconds");
  });

  it("uses larger units above one second", () => {
    expect(formatDurationMilliseconds(90_000)).toBe("1 minute, 30 seconds");
  });

  it("abbreviates in the short style", () => {
    expect(formatDurationMilliseconds(500, { style: "short" })).toBe("500ms");
    expect(formatDurationMilliseconds(90_000, { style: "short" })).toBe(
      "1m, 30s",
    );
  });

  it("honours a unit limit", () => {
    expect(formatDurationMilliseconds(90_061_000, { maxUnits: 1 })).toBe(
      "1 day",
    );
  });
});

describe("formatDurationNanoseconds", () => {
  it("converts before formatting", () => {
    expect(formatDurationNanoseconds(1_500_000_000)).toBe("1.5 seconds");
  });
});

describe("formatDurationInDays", () => {
  it("rounds to whole days", () => {
    expect(formatDurationInDays(86_400_000)).toBe("1 day");
    expect(formatDurationInDays(259_200_000)).toBe("3 days");
    expect(formatDurationInDays(43_200_000)).toBe("0 days");
  });
});

describe("unit conversion", () => {
  it("round-trips", () => {
    expect(nanosecondsToMilliseconds(1_500_000_000)).toBe(1500);
    expect(millisecondsToNanoseconds(1500)).toBe(1_500_000_000);
    expect(nanosecondsToMilliseconds(millisecondsToNanoseconds(42))).toBe(42);
  });
});
