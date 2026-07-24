/**
 * @module @oppulence/import/utils
 * @file Utility functions for date and amount formatting in transaction
 *   imports.
 * @author Canvas Team
 * @copyright 2024 Canvas
 */

import { isValid, parse, parseISO } from "date-fns";
import { ParseError, TransformationError } from "./errors";
import type { IAmountParser, IDateParser } from "./interfaces";
import {
  amountStringSchema,
  DATE_FORMATS,
  dateStringSchema,
  isoDateSchema,
  VALIDATION_LIMITS,
} from "./schemas";

/**
 * Regular expression for validating year format.
 *
 * @private
 */
const YEAR_REGEX = /^\d{4}$/;

/**
 * Regular expression for special minus sign character.
 *
 * @private
 */
const SPECIAL_MINUS_REGEX = /−/g;

/**
 * Regular expression for amount with comma as decimal separator.
 *
 * @private
 */
const COMMA_DECIMAL_REGEX = /^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$/;

/**
 * Regular expression for amount with period as decimal separator.
 *
 * @private
 */
const PERIOD_DECIMAL_REGEX = /^-?\d+(\.\d{2})?$/;

/**
 * Date parser implementation.
 *
 * @class DateParser
 * @implements {IDateParser}
 * @public
 */
export class DateParser implements IDateParser {
  /**
   * Supported date formats.
   *
   * @private
   */
  private readonly formats: readonly string[];

  /**
   * Creates a new DateParser instance.
   *
   * @param {string[]} [customFormats] - Additional custom date formats
   */
  constructor(customFormats?: string[]) {
    this.formats = customFormats
      ? [...DATE_FORMATS, ...customFormats]
      : DATE_FORMATS;
  }

  /**
   * Parses a date string into ISO format.
   *
   * @param {string} dateString - Date string to parse
   * @param {string} [formatHint] - Optional format hint for parsing
   * @returns {string | undefined} ISO date string or undefined if parsing fails
   * @throws {ParseError} If date string is invalid
   */
  public parse(dateString: string, formatHint?: string): string | undefined {
    try {
      // Validate input
      const validation = dateStringSchema.safeParse(dateString);
      if (!validation.success) {
        throw new ParseError(
          "Invalid date string format",
          undefined,
          undefined,
          dateString,
          { validation: validation.error },
        );
      }

      // Try format hint first if provided
      if (formatHint) {
        const parsedDate = this.tryParseWithFormat(dateString, formatHint);
        if (parsedDate) {
          return this.ensureValidYear(parsedDate);
        }
      }

      // Try all known formats
      for (const format of this.formats) {
        const parsedDate = this.tryParseWithFormat(dateString, format);
        if (parsedDate) {
          return this.ensureValidYear(parsedDate);
        }
      }

      // Try ISO parsing
      const isoDate = this.tryParseISO(dateString);
      if (isoDate) {
        return this.ensureValidYear(isoDate);
      }

      // Try cleaning and parsing again
      const cleanedDate = this.cleanDateString(dateString);
      const cleanedIsoDate = this.tryParseISO(cleanedDate);
      if (cleanedIsoDate) {
        return this.ensureValidYear(cleanedIsoDate);
      }

      return;
    } catch (error) {
      if (error instanceof ParseError) {
        throw error;
      }
      throw new ParseError(
        "Failed to parse date",
        undefined,
        undefined,
        dateString,
        { originalError: error },
      );
    }
  }

  /**
   * Validates if a date string is valid.
   *
   * @param {string} dateString - Date string to validate
   * @returns {boolean} True if valid date
   */
  public isValid(dateString: string): boolean {
    return this.parse(dateString) !== undefined;
  }

  /**
   * Gets supported date formats.
   *
   * @returns {string[]} Array of supported format patterns
   */
  public getSupportedFormats(): string[] {
    return [...this.formats];
  }

  /**
   * Tries to parse a date with a specific format.
   *
   * @private
   * @param {string} dateString - Date string to parse
   * @param {string} format - Format pattern
   * @returns {string | undefined} ISO date string or undefined
   */
  private tryParseWithFormat(
    dateString: string,
    format: string,
  ): string | undefined {
    try {
      const parsedDate = parse(dateString, format, new Date());
      if (isValid(parsedDate)) {
        return parsedDate.toISOString().split("T")[0];
      }
    } catch {
      // Continue if parsing fails
    }
    return;
  }

  /**
   * Tries to parse a date as ISO format.
   *
   * @private
   * @param {string} dateString - Date string to parse
   * @returns {string | undefined} ISO date string or undefined
   */
  private tryParseISO(dateString: string): string | undefined {
    try {
      const parsedDate = parseISO(dateString);
      if (isValid(parsedDate)) {
        return parsedDate.toISOString().split("T")[0];
      }
    } catch {
      // Continue if parsing fails
    }
    return;
  }

  /**
   * Cleans a date string by removing non-date characters.
   *
   * @private
   * @param {string} dateString - Date string to clean
   * @returns {string} Cleaned date string
   */
  private cleanDateString(dateString: string): string {
    // If the date includes a time component, keep it
    if (dateString.includes("T")) {
      return dateString;
    }
    // Remove non-date characters except separators
    return dateString.replace(/[^0-9\-./]/g, "");
  }

  /**
   * Ensures a date has a valid 4-digit year.
   *
   * @private
   * @param {string} dateString - ISO date string
   * @returns {string | undefined} Date with corrected year or undefined
   */
  private ensureValidYear(dateString: string | undefined): string | undefined {
    if (!dateString) return;

    const [year, month, day] = dateString.split("-");

    if (!(year && month && day)) return;

    // Correct 2-digit years or years not starting with 20
    const correctedYear = this.correctYear(year);

    const correctedDate = `${correctedYear}-${month}-${day}`;

    // Validate the corrected date
    const validation = isoDateSchema.safeParse(correctedDate);
    return validation.success ? correctedDate : undefined;
  }

  /**
   * Corrects a year string to a plausible 4-digit year.
   *
   * Rules:
   *   - A 4-digit year between 1900 and 2100 is returned unchanged. Forcing
   *     "1999" to "2099" (as the previous implementation did) silently
   *     corrupts historical CSV data.
   *   - A 2-digit year is expanded: 00–69 → 2000–2069, 70–99 → 1970–1999
   *     (the same window used by POSIX/C, ISO 8601 §3.4.2, and Excel).
   *   - Anything else is returned unchanged so downstream parsing fails
   *     loudly rather than silently producing a wrong date.
   *
   * @private
   * @param {string} year - Year string to correct
   * @returns {string} Corrected year
   */
  private correctYear(year: string): string {
    if (YEAR_REGEX.test(year)) {
      const parsed = Number.parseInt(year, 10);
      if (!Number.isNaN(parsed) && parsed >= 1900 && parsed <= 2100) {
        return year;
      }
      // Outside the plausible range — leave it untouched so the caller
      // surfaces a date-parsing error instead of silent corruption.
      return year;
    }

    if (/^\d{2}$/.test(year)) {
      const twoDigit = Number.parseInt(year, 10);
      const century = twoDigit <= 69 ? "20" : "19";
      return `${century}${year}`;
    }

    // Unknown shape (e.g. 3-digit year, or garbage) — return as-is so
    // downstream logic can error rather than quietly invent a date.
    return year;
  }
}

/**
 * Amount parser implementation.
 *
 * @class AmountParser
 * @implements {IAmountParser}
 * @public
 */
export class AmountParser implements IAmountParser {
  /**
   * Parses an amount string into a number.
   *
   * @param {string} amountString - Amount string to parse
   * @param {boolean} [inverted=false] - Whether to invert the amount. Default
   *   is `false`
   * @returns {number} Parsed amount
   * @throws {TransformationError} If amount parsing fails
   */
  public parse(amountString: string, inverted = false): number {
    try {
      // Validate input
      const validation = amountStringSchema.safeParse(amountString);
      if (!validation.success) {
        throw new TransformationError(
          "Invalid amount format",
          "amount",
          amountString,
          { validation: validation.error },
        );
      }

      // Normalize special characters
      const normalizedAmount = this.normalizeAmount(amountString);

      // Parse based on format
      const value = this.parseAmountValue(normalizedAmount);

      // Apply inversion if needed
      const finalValue = inverted ? value * -1 : value;

      // Validate final value
      if (!this.isValidAmount(finalValue)) {
        throw new TransformationError(
          "Amount exceeds valid range",
          "amount",
          amountString,
          { parsedValue: finalValue, limits: VALIDATION_LIMITS },
        );
      }

      return finalValue;
    } catch (error) {
      if (error instanceof TransformationError) {
        throw error;
      }
      throw new TransformationError(
        "Failed to parse amount",
        "amount",
        amountString,
        { originalError: error },
      );
    }
  }

  /**
   * Formats a number as a currency string.
   *
   * @param {number} amount - Amount to format
   * @param {string} [currency='USD'] - Currency code. Default is `'USD'`
   * @returns {string} Formatted amount string
   */
  public format(amount: number, currency = "USD"): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Validates if an amount string is valid.
   *
   * @param {string} amountString - Amount string to validate
   * @returns {boolean} True if valid amount
   */
  public isValid(amountString: string): boolean {
    try {
      const validation = amountStringSchema.safeParse(amountString);
      if (!validation.success) return false;

      const parsed = this.parse(amountString);
      return this.isValidAmount(parsed);
    } catch {
      return false;
    }
  }

  /**
   * Normalizes an amount string by replacing special characters.
   *
   * @private
   * @param {string} amount - Amount string to normalize
   * @returns {string} Normalized amount
   */
  private normalizeAmount(amount: string): string {
    // Replace special minus sign with standard minus
    return amount.replace(SPECIAL_MINUS_REGEX, "-");
  }

  /**
   * Parses the numeric value from an amount string.
   *
   * @private
   * @param {string} amount - Normalized amount string
   * @returns {number} Parsed numeric value
   */
  private parseAmountValue(amount: string): number {
    // Check for comma as decimal separator (European format)
    if (COMMA_DECIMAL_REGEX.test(amount)) {
      // Remove thousands separators (periods) and replace comma with period
      return Number.parseFloat(amount.replace(/\./g, "").replace(",", "."));
    }

    // Check for period as decimal separator with exactly 2 decimal places
    if (PERIOD_DECIMAL_REGEX.test(amount)) {
      // Remove internal periods (thousands separators) if present
      if (amount.match(/\.\d{3}/)) {
        return Number.parseFloat(amount.replace(/\.(?=\d{3})/g, ""));
      }
      return Number.parseFloat(amount);
    }

    // Handle multiple periods (e.g., "1.234.56" where periods are used inconsistently)
    // In this case, treat all periods except the last one as thousands separators
    const periodCount = (amount.match(/\./g) || []).length;
    if (periodCount > 1) {
      // Find the last period position
      const lastPeriodIndex = amount.lastIndexOf(".");
      // Remove all periods before the last one
      const beforeLastPeriod = amount
        .slice(0, lastPeriodIndex)
        .replace(/\./g, "");
      const afterLastPeriod = amount.slice(lastPeriodIndex);
      return Number.parseFloat(beforeLastPeriod + afterLastPeriod);
    }

    // Check if amount contains comma (might be thousands separator)
    if (amount.includes(",")) {
      // Remove all commas and periods except the last period
      const cleanAmount = amount.replace(/,/g, "");
      return Number.parseFloat(cleanAmount);
    }

    // Direct conversion for simple numbers
    return Number.parseFloat(amount);
  }

  /**
   * Validates if an amount is within acceptable range.
   *
   * @private
   * @param {number} amount - Amount to validate
   * @returns {boolean} True if valid
   */
  private isValidAmount(amount: number): boolean {
    return (
      !Number.isNaN(amount) &&
      Number.isFinite(amount) &&
      amount >= VALIDATION_LIMITS.MIN_AMOUNT &&
      amount <= VALIDATION_LIMITS.MAX_AMOUNT
    );
  }
}

// ============================================================================
// Exported Functions (for backward compatibility)
// ============================================================================

/**
 * Global date parser instance.
 *
 * @private
 */
const globalDateParser = new DateParser();

/**
 * Global amount parser instance.
 *
 * @private
 */
const globalAmountParser = new AmountParser();

/**
 * Formats a date string into ISO format.
 *
 * This function attempts to parse various date formats and convert them to a
 * standard ISO format (YYYY-MM-DD). It handles multiple date formats including
 * European, American, and ISO formats.
 *
 * @example
 *   ```typescript
 *   formatDate('05/15/2023'); // '2023-05-15'
 *   formatDate('15.05.2023'); // '2023-05-15'
 *   formatDate('May 15, 2023'); // '2023-05-15'
 *   formatDate('invalid'); // undefined
 *   ```;
 *
 * @param {string} date - Date string to format
 * @returns {string | undefined} ISO formatted date or undefined if parsing
 *   fails
 * @public
 */
export function formatDate(date: string): string | undefined {
  return globalDateParser.parse(date);
}

/**
 * Formats an amount string value into a number.
 *
 * This function handles various number formats including:
 *
 * - Numbers with comma as decimal separator (European format)
 * - Numbers with period as decimal separator (US format)
 * - Numbers with thousands separators
 * - Negative numbers
 * - Special minus sign characters
 *
 * @example
 *   ```typescript
 *   formatAmountValue({ amount: '1,234.56' }); // 1234.56
 *   formatAmountValue({ amount: '1.234,56' }); // 1234.56
 *   formatAmountValue({ amount: '-100', inverted: true }); // 100
 *   ```;
 *
 * @param {object} options - Formatting options
 * @param {string} options.amount - Amount string to format
 * @param {boolean} [options.inverted=false] - Whether to invert the sign.
 *   Default is `false`
 * @returns {number} Formatted amount as a number
 * @public
 */
export function formatAmountValue({
  amount,
  inverted,
}: {
  amount: string;
  inverted?: boolean;
}): number {
  return globalAmountParser.parse(amount, inverted);
}

/**
 * Validates if a date string can be parsed.
 *
 * @param {string} date - Date string to validate
 * @returns {boolean} True if date can be parsed
 * @public
 */
export function isValidDate(date: string): boolean {
  return globalDateParser.isValid(date);
}

/**
 * Validates if an amount string can be parsed.
 *
 * @param {string} amount - Amount string to validate
 * @returns {boolean} True if amount can be parsed
 * @public
 */
export function isValidAmount(amount: string): boolean {
  return globalAmountParser.isValid(amount);
}

/**
 * Gets the list of supported date formats.
 *
 * @returns {string[]} Array of date format patterns
 * @public
 */
export function getSupportedDateFormats(): string[] {
  return globalDateParser.getSupportedFormats();
}

/**
 * Formats a number as a currency string.
 *
 * @param {number} amount - Amount to format
 * @param {string} [currency='USD'] - Currency code. Default is `'USD'`
 * @returns {string} Formatted currency string
 * @public
 */
export function formatCurrency(amount: number, currency = "USD"): string {
  return globalAmountParser.format(amount, currency);
}
