/**
 * Parses a rate-limit header value that must be a whole number.
 *
 * `Number.parseInt` stops at the first character it cannot read, so "12abc"
 * becomes 12 and a malformed header turns into a plausible date rather than
 * nothing. A header is either a number or it is not.
 */
function parseIntegerHeader(value: string): number | undefined {
  const trimmed = value.trim();
  if (!/^[+-]?\d+$/u.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

/** A Date built from an out-of-range epoch is Invalid, which helps no caller. */
function validDate(epochMs: number): Date | undefined {
  const date = new Date(epochMs);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function calculateResetAt(
  resets: string | undefined | null,
  format:
    | "unix_timestamp"
    | "iso_8601"
    | "iso_8601_duration_openai_variant"
    | "unix_timestamp_in_ms",
  now: Date = new Date(),
): Date | undefined {
  if (!resets) return;

  switch (format) {
    case "iso_8601_duration_openai_variant": {
      return calculateISO8601DurationOpenAIVariantResetAt(resets, now);
    }
    case "iso_8601": {
      return calculateISO8601ResetAt(resets, now);
    }
    case "unix_timestamp": {
      return calculateUnixTimestampResetAt(resets, now);
    }
    case "unix_timestamp_in_ms": {
      return calculateUnixTimestampInMsResetAt(resets, now);
    }
  }
}

function calculateUnixTimestampResetAt(
  resets: string,
  _now: Date = new Date(),
): Date | undefined {
  // Check if the input is null or undefined
  if (!resets) return;

  const resetAt = parseIntegerHeader(resets);
  if (resetAt === undefined) return;

  return validDate(resetAt * 1000);
}

function calculateUnixTimestampInMsResetAt(
  resets: string,
  _now: Date = new Date(),
): Date | undefined {
  // Check if the input is null or undefined
  if (!resets) return;

  const resetAt = parseIntegerHeader(resets);
  if (resetAt === undefined) return;

  return validDate(resetAt);
}

function calculateISO8601ResetAt(
  resets: string,
  _now: Date = new Date(),
): Date | undefined {
  // Check if the input is null or undefined
  if (!resets) return;

  // Parse the date
  const resetAt = new Date(resets);

  // If the string doesn't match the expected format, return undefined
  if (Number.isNaN(resetAt.getTime())) return;

  return resetAt;
}

function calculateISO8601DurationOpenAIVariantResetAt(
  resets: string,
  now: Date = new Date(),
): Date | undefined {
  // Check if the input is null or undefined
  if (!resets) return;

  // Regular expression to match the duration string pattern
  const pattern =
    /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?(?:(\d+)ms)?$/;
  const match = resets.match(pattern);

  // If the string doesn't match the expected format, return undefined
  if (!match) return;

  // Extract days, hours, minutes, seconds, and milliseconds from the string
  const days = Number.parseInt(match[1] ?? "0", 10) || 0;
  const hours = Number.parseInt(match[2] ?? "0", 10) || 0;
  const minutes = Number.parseInt(match[3] ?? "0", 10) || 0;
  const seconds = Number.parseFloat(match[4] ?? "0") || 0;
  const milliseconds = Number.parseInt(match[5] ?? "0", 10) || 0;

  /*
   * Added as elapsed milliseconds rather than through the local-time setters.
   * A rate limit resets after a duration, and setDate/setHours move the wall
   * clock instead: across a spring-forward boundary "1d" advanced the clock a
   * day but only 23 hours, so a caller retried an hour early.
   */
  const totalMs =
    days * 86_400_000 +
    hours * 3_600_000 +
    minutes * 60_000 +
    seconds * 1_000 +
    milliseconds;

  return validDate(now.getTime() + totalMs);
}
