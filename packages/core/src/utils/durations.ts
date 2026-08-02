import humanizeDuration, { type Unit } from "humanize-duration";

/**
 * Calculates the absolute difference in milliseconds between two dates.
 *
 * This utility function computes the time difference between two Date objects
 * and returns the absolute value in milliseconds. It's used internally by
 * duration formatting functions to ensure consistent time calculations.
 *
 * @param {Date} date1 - The first date for comparison
 * @param {Date} date2 - The second date for comparison
 * @returns {number} The absolute difference in milliseconds between the two dates
 *
 * @example
 * ```typescript
 * const start = new Date('2023-01-01T10:00:00Z');
 * const end = new Date('2023-01-01T10:30:00Z');
 * const diff = dateDifference(start, end);
 * console.log(diff); // 1800000 (30 minutes in milliseconds)
 * ```
 */
function dateDifference(date1: Date, date2: Date) {
  return Math.abs(date1.getTime() - date2.getTime());
}

/**
 * Configuration options for duration formatting functions.
 *
 * @property {string} [style] - The output style for duration strings. 'long' for full text (e.g., "2 hours 30 minutes"), 'short' for abbreviated text (e.g., "2h 30m")
 * @property {number} [maxDecimalPoints] - Maximum number of decimal places to show in duration values
 * @property {Unit[]} [units] - Array of time units to include in the output (e.g., ['d', 'h', 'm', 's'])
 * @property {number} [maxUnits] - Maximum number of units to display in the formatted string
 */
type DurationOptions = {
  style?: "long" | "short";
  maxDecimalPoints?: number;
  units?: Unit[];
  maxUnits?: number;
};

/**
 * Formats the duration between two dates into a human-readable string.
 *
 * This function calculates the time difference between start and end dates
 * and formats it using the humanize-duration library. If either date is
 * null or undefined, it returns a dash ("–") to indicate no duration.
 *
 * The function automatically selects appropriate time units based on the
 * duration length - using milliseconds for durations under 1 second,
 * and days, hours, minutes, seconds for longer durations.
 *
 * @param {Date | null | undefined} start - The start date of the duration period
 * @param {Date | null | undefined} end - The end date of the duration period
 * @param {DurationOptions} [options] - Optional configuration for formatting behavior
 * @returns {string} A human-readable duration string or "–" if dates are invalid
 *
 * @example
 * ```typescript
 * const start = new Date('2023-01-01T10:00:00Z');
 * const end = new Date('2023-01-01T12:30:45Z');
 *
 * // Basic usage
 * formatDuration(start, end); // "2 hours 30 minutes"
 *
 * // With short style
 * formatDuration(start, end, { style: 'short' }); // "2h 30m"
 *
 * // With custom units
 * formatDuration(start, end, { units: ['h', 'm'] }); // "2 hours 30 minutes"
 *
 * // Invalid dates
 * formatDuration(null, end); // "–"
 * ```
 */
export function formatDuration(
  start?: Date | null,
  end?: Date | null,
  options?: DurationOptions,
): string {
  /*
   * An Invalid Date is an object, so it passed the truthiness check and its
   * NaN difference formatted as "0 seconds" — a plausible-looking duration
   * standing in for one that could not be computed. It is treated like a
   * missing date instead.
   */
  if (
    !start ||
    !end ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return "–";
  }

  return formatDurationMilliseconds(dateDifference(start, end), options);
}

/**
 * Converts nanoseconds to milliseconds.
 *
 * This utility function performs a simple conversion from nanoseconds to
 * milliseconds by dividing by 1,000,000 (1 million). Useful for converting
 * high-precision timing measurements to more standard millisecond units.
 *
 * @param {number} nanoseconds - The duration in nanoseconds
 * @returns {number} The equivalent duration in milliseconds
 *
 * @example
 * ```typescript
 * const ns = 1500000000; // 1.5 billion nanoseconds
 * const ms = nanosecondsToMilliseconds(ns);
 * console.log(ms); // 1500 (1.5 seconds)
 * ```
 */
export function nanosecondsToMilliseconds(nanoseconds: number): number {
  return nanoseconds / 1_000_000;
}

/**
 * Converts milliseconds to nanoseconds.
 *
 * This utility function performs a simple conversion from milliseconds to
 * nanoseconds by multiplying by 1,000,000 (1 million). Useful for converting
 * standard millisecond timing to high-precision nanosecond measurements.
 *
 * @param {number} milliseconds - The duration in milliseconds
 * @returns {number} The equivalent duration in nanoseconds
 *
 * @example
 * ```typescript
 * const ms = 1500; // 1.5 seconds
 * const ns = millisecondsToNanoseconds(ms);
 * console.log(ns); // 1500000000 (1.5 billion nanoseconds)
 * ```
 */
export function millisecondsToNanoseconds(milliseconds: number): number {
  return milliseconds * 1_000_000;
}

/**
 * Formats a duration given in nanoseconds into a human-readable string.
 *
 * This function first converts nanoseconds to milliseconds, then formats
 * the duration using the same logic as formatDurationMilliseconds.
 * Useful for working with high-precision timing data from performance
 * measurements or system timers.
 *
 * @param {number} nanoseconds - The duration in nanoseconds
 * @param {DurationOptions} [options] - Optional configuration for formatting behavior
 * @returns {string} A human-readable duration string
 *
 * @example
 * ```typescript
 * const ns = 1500000000; // 1.5 seconds in nanoseconds
 * formatDurationNanoseconds(ns); // "1.5 seconds"
 *
 * // With short style
 * formatDurationNanoseconds(ns, { style: 'short' }); // "1.5s"
 *
 * // For very short durations
 * const shortNs = 50000000; // 50 milliseconds
 * formatDurationNanoseconds(shortNs); // "50 milliseconds"
 * ```
 */
export function formatDurationNanoseconds(
  nanoseconds: number,
  options?: DurationOptions,
): string {
  return formatDurationMilliseconds(
    nanosecondsToMilliseconds(nanoseconds),
    options,
  );
}

/**
 * Predefined unit arrays for different duration ranges.
 * Used internally to select appropriate time units based on duration length.
 */
const aboveOneSecondUnits = ["d", "h", "m", "s"] as Unit[];
const belowOneSecondUnits = ["ms"] as Unit[];

/**
 * Formats a duration given in milliseconds into a human-readable string.
 *
 * This is the core duration formatting function that uses the humanize-duration
 * library to convert millisecond values into natural language descriptions.
 * The function automatically selects appropriate time units based on the
 * duration length and applies formatting options.
 *
 * For durations under 1 second, it uses milliseconds. For longer durations,
 * it uses days, hours, minutes, and seconds. The function supports both
 * long and short output styles, with short style using abbreviated unit names.
 *
 * @param {number} milliseconds - The duration in milliseconds
 * @param {DurationOptions} [options] - Optional configuration for formatting behavior
 * @returns {string} A human-readable duration string
 *
 * @example
 * ```typescript
 * // Basic usage
 * formatDurationMilliseconds(1500); // "1.5 seconds"
 * formatDurationMilliseconds(90000); // "1 minute 30 seconds"
 *
 * // Short style
 * formatDurationMilliseconds(90000, { style: 'short' }); // "1m 30s"
 *
 * // Custom units and precision
 * formatDurationMilliseconds(90000, {
 *   units: ['h', 'm'],
 *   maxDecimalPoints: 0
 * }); // "1 hour 30 minutes"
 *
 * // Very short durations
 * formatDurationMilliseconds(500); // "500 milliseconds"
 * formatDurationMilliseconds(500, { style: 'short' }); // "500ms"
 *
 * // Long durations
 * formatDurationMilliseconds(2592000000); // "30 days" (30 days in milliseconds)
 * ```
 */
export function formatDurationMilliseconds(
  milliseconds: number,
  options?: DurationOptions,
): string {
  let duration = humanizeDuration(milliseconds, {
    units: options?.units
      ? options.units
      : milliseconds < 1000
        ? belowOneSecondUnits
        : aboveOneSecondUnits,
    maxDecimalPoints: options?.maxDecimalPoints ?? 1,
    largest: options?.maxUnits ?? 2,
  });

  if (!options) {
    return duration;
  }

  switch (options.style) {
    case "short":
      duration = duration.replace(" milliseconds", "ms");
      duration = duration.replace(" millisecond", "ms");
      duration = duration.replace(" seconds", "s");
      duration = duration.replace(" second", "s");
      duration = duration.replace(" minutes", "m");
      duration = duration.replace(" minute", "m");
      duration = duration.replace(" hours", "h");
      duration = duration.replace(" hour", "h");
      duration = duration.replace(" days", "d");
      duration = duration.replace(" day", "d");
      duration = duration.replace(" weeks", "w");
      duration = duration.replace(" week", "w");
      duration = duration.replace(" months", "mo");
      duration = duration.replace(" month", "mo");
      duration = duration.replace(" years", "y");
      duration = duration.replace(" year", "y");
  }

  return duration;
}

/**
 * Formats a duration in milliseconds to show only days.
 *
 * This specialized function formats durations to display only the number of days,
 * ignoring hours, minutes, and seconds. Useful for long-term duration displays
 * where day-level precision is sufficient.
 *
 * The function rounds to the nearest day and shows no decimal places,
 * making it suitable for displaying project timelines, vacation periods,
 * or other long-term durations.
 *
 * @param {number} milliseconds - The duration in milliseconds
 * @returns {string} A duration string showing only days
 *
 * @example
 * ```typescript
 * const oneDayMs = 86400000; // 24 hours in milliseconds
 * formatDurationInDays(oneDayMs); // "1 day"
 *
 * const threeDaysMs = 259200000; // 3 days in milliseconds
 * formatDurationInDays(threeDaysMs); // "3 days"
 *
 * const partialDayMs = 43200000; // 12 hours in milliseconds
 * formatDurationInDays(partialDayMs); // "0 days"
 * ```
 */
export function formatDurationInDays(milliseconds: number): string {
  const duration = humanizeDuration(milliseconds, {
    maxDecimalPoints: 0,
    largest: 2,
    units: ["d"],
  });

  return duration;
}
