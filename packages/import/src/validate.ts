/**
 * @module @oppulence/import/validate
 * @file Transaction validation utilities for import processing.
 *
 *   This module provides comprehensive validation functionality for transaction
 *   data, including schema validation, duplicate detection, and batch
 *   validation with detailed error reporting.
 * @author Canvas Team
 * @copyright 2024 Canvas
 */

import { createHash } from "node:crypto";
import type { IDuplicateDetector } from "./interfaces";
import {
  type Transaction,
  type TransformedTransaction,
  transactionSchema,
  transformedTransactionSchema,
  type ValidationError as ValidationErrorType,
  type ValidationResult,
} from "./schemas";

/**
 * Extended validation result for internal use.
 *
 * @private
 */
type ExtendedValidationResult = ValidationResult & {
  data?: unknown;
};

/**
 * Duplicate detection configuration.
 *
 * @private
 */
const DUPLICATE_CONFIG = {
  /** Time window for duplicate detection (in milliseconds) */
  TIME_WINDOW: 24 * 60 * 60 * 1000, // 24 hours
  /** Amount tolerance for duplicate detection */
  AMOUNT_TOLERANCE: 0.01,
  /** Similarity threshold for description matching */
  SIMILARITY_THRESHOLD: 0.85,
} as const;

/**
 * Transaction validator implementation.
 *
 * Provides comprehensive validation for transaction data including schema
 * validation, business rule validation, and duplicate detection.
 *
 * @example
 *   ```typescript
 *   const validator = new TransactionValidator(duplicateDetector);
 *   const result = validator.validate(transaction);
 *   if (result.isValid) {
 *     // Process valid transaction
 *   }
 *   ```;
 *
 * @class TransactionValidator
 * @implements {ITransactionValidator}
 * @public
 */
export class TransactionValidator {
  /**
   * Duplicate detector service.
   *
   * @private
   */
  private readonly duplicateDetector?: IDuplicateDetector;

  /**
   * Creates a new TransactionValidator instance.
   *
   * @param {IDuplicateDetector} [duplicateDetector] - Optional duplicate
   *   detector
   */
  constructor(duplicateDetector?: IDuplicateDetector) {
    this.duplicateDetector = duplicateDetector;
  }

  /**
   * Validates a single transaction.
   *
   * Performs comprehensive validation including:
   *
   * - Schema validation against Zod schemas
   * - Business rule validation
   * - Data consistency checks
   *
   * @example
   *   ```typescript
   *   const result = validator.validate({
   *     date: '2024-01-15',
   *     amount: '1234.56',
   *     description: 'Payment'
   *   });
   *   ```;
   *
   * @param {unknown} transaction - Transaction to validate
   * @returns {ExtendedValidationResult} Validation result with errors if any
   */
  public validate(transaction: unknown): ExtendedValidationResult {
    const errors: ValidationErrorType[] = [];

    // Schema validation
    const schemaValidation = transactionSchema.safeParse(transaction);
    if (!schemaValidation.success) {
      schemaValidation.error.issues.forEach((error) => {
        errors.push({
          field: error.path.join("."),
          message: error.message,
          value: this.getValueAtPath(
            transaction,
            error.path.filter(
              (p): p is string | number => typeof p !== "symbol",
            ),
          ),
        });
      });
    }

    // If schema validation passed, perform business rule validation
    if (schemaValidation.success) {
      const businessErrors = this.validateBusinessRules(schemaValidation.data);
      errors.push(...businessErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      processedCount: 1,
      validCount: errors.length === 0 ? 1 : 0,
      invalidCount: errors.length === 0 ? 0 : 1,
      data: schemaValidation.success ? schemaValidation.data : undefined,
    };
  }

  /**
   * Validates multiple transactions in batch.
   *
   * Processes multiple transactions and aggregates validation results,
   * continuing validation even if some transactions fail.
   *
   * @example
   *   ```typescript
   *   const result = validator.validateBatch(transactions);
   *   console.log(`Valid: ${result.validCount}, Invalid: ${result.invalidCount}`);
   *   ```
   *
   * @param {unknown[]} transactions - Array of transactions to validate
   * @returns {ExtendedValidationResult} Aggregated validation result
   */
  public validateBatch(transactions: unknown[]): ExtendedValidationResult {
    const allErrors: ValidationErrorType[] = [];
    const validTransactions: Transaction[] = [];
    let validCount = 0;
    let invalidCount = 0;

    transactions.forEach((transaction, index) => {
      const result = this.validate(transaction);

      if (result.valid && result.data) {
        validTransactions.push(result.data as Transaction);
        validCount++;
      } else {
        invalidCount++;
        if (result.errors.length > 0) {
          // Add row index to errors for batch context
          const indexedErrors = result.errors.map((error) => ({
            ...error,
            row: index + 1,
          }));
          allErrors.push(...indexedErrors);
        }
      }
    });

    return {
      valid: invalidCount === 0,
      errors: allErrors,
      processedCount: transactions.length,
      validCount,
      invalidCount,
      data: validTransactions.length > 0 ? validTransactions : undefined,
    };
  }

  /**
   * Checks for duplicate transactions.
   *
   * Identifies potential duplicate transactions based on:
   *
   * - Date proximity
   * - Amount similarity
   * - Description matching
   *
   * @example
   *   ```typescript
   *   const duplicates = validator.findDuplicates(
   *     newTransactions,
   *     existingTransactions
   *   );
   *   ```;
   *
   * @param {Transaction[]} transactions - Transactions to check
   * @param {Transaction[]} existingTransactions - Existing transactions to
   *   compare against
   * @returns {string[]} Array of duplicate transaction IDs
   */
  public findDuplicates(
    transactions: Transaction[],
    existingTransactions: Transaction[],
  ): string[] {
    if (this.duplicateDetector) {
      const duplicateIds: string[] = [];

      transactions.forEach((transaction) => {
        if (
          this.duplicateDetector?.isDuplicate(transaction, existingTransactions)
        ) {
          // Generate a temporary ID for the duplicate
          const id = this.generateTransactionId(transaction);
          duplicateIds.push(id);
        }
      });

      return duplicateIds;
    }

    // Fallback to simple duplicate detection
    return this.simpleDuplicateDetection(transactions, existingTransactions);
  }

  /**
   * Validates business rules for a transaction.
   *
   * @private
   * @param {Transaction} transaction - Transaction to validate
   * @returns {ValidationErrorType[]} Array of validation errors
   */
  private validateBusinessRules(
    transaction: Transaction,
  ): ValidationErrorType[] {
    const errors: ValidationErrorType[] = [];

    // Validate date is not in the future
    const transactionDate = new Date(transaction.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    if (transactionDate > today) {
      errors.push({
        field: "date",
        message: "Transaction date cannot be in the future",
        value: transaction.date,
      });
    }

    // Validate date is not too old (e.g., more than 5 years)
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    if (transactionDate < fiveYearsAgo) {
      errors.push({
        field: "date",
        message: "Transaction date is too old (more than 5 years)",
        value: transaction.date,
      });
    }

    // Validate amount is reasonable
    if (Math.abs(transaction.amount) > 1_000_000) {
      errors.push({
        field: "amount",
        message: "Transaction amount exceeds maximum allowed value",
        value: transaction.amount,
      });
    }

    // Validate description is meaningful
    if (transaction.description.length < 3) {
      errors.push({
        field: "description",
        message: "Transaction description is too short",
        value: transaction.description,
      });
    }

    // Check for suspicious patterns in description
    const suspiciousPatterns = /^(test|dummy|xxx|temp)/i;
    if (suspiciousPatterns.test(transaction.description)) {
      errors.push({
        field: "description",
        message: "Transaction description contains suspicious patterns",
        value: transaction.description,
      });
    }

    return errors;
  }

  /**
   * Simple duplicate detection without external service.
   *
   * @private
   * @param {Transaction[]} transactions - New transactions
   * @param {Transaction[]} existingTransactions - Existing transactions
   * @returns {string[]} Array of duplicate transaction IDs
   */
  private simpleDuplicateDetection(
    transactions: Transaction[],
    existingTransactions: Transaction[],
  ): string[] {
    const duplicates: string[] = [];
    const existingHashes = new Set(
      existingTransactions.map((t) => this.generateTransactionHash(t)),
    );

    transactions.forEach((transaction) => {
      const hash = this.generateTransactionHash(transaction);
      if (existingHashes.has(hash)) {
        duplicates.push(this.generateTransactionId(transaction));
      }
    });

    // Also check for duplicates within the new transactions
    const seenHashes = new Set<string>();
    transactions.forEach((transaction) => {
      const hash = this.generateTransactionHash(transaction);
      if (seenHashes.has(hash)) {
        duplicates.push(this.generateTransactionId(transaction));
      }
      seenHashes.add(hash);
    });

    return duplicates;
  }

  /**
   * Generates a hash for duplicate detection.
   *
   * @private
   * @param {Transaction} transaction - Transaction to hash
   * @returns {string} Transaction hash
   */
  private generateTransactionHash(transaction: Transaction): string {
    const key = `${transaction.date}_${transaction.amount}_${transaction.description.toLowerCase()}`;
    return createHash("sha256").update(key).digest("hex");
  }

  /**
   * Generates a temporary ID for a transaction.
   *
   * @private
   * @param {Transaction} transaction - Transaction
   * @returns {string} Temporary ID
   */
  private generateTransactionId(transaction: Transaction): string {
    const timestamp = new Date(transaction.date).getTime();
    const hash = this.generateTransactionHash(transaction).slice(0, 8);
    return `temp_${timestamp}_${hash}`;
  }

  /**
   * Gets value at a specific path in an object.
   *
   * @private
   * @param {unknown} obj - Object to traverse
   * @param {(string | number)[]} path - Path to value
   * @returns {unknown} Value at path or undefined
   */
  private getValueAtPath(obj: unknown, path: (string | number)[]): unknown {
    // biome-ignore lint/suspicious/noExplicitAny: complex type
    let current: any = obj;
    for (const key of path) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return;
      }
    }
    return current;
  }
}

/**
 * Duplicate detector implementation.
 *
 * Provides sophisticated duplicate detection using multiple matching strategies
 * including fuzzy matching and time windows.
 *
 * @class DuplicateDetector
 * @implements {IDuplicateDetector}
 * @public
 */
export class DuplicateDetector implements IDuplicateDetector {
  /**
   * Detects if a transaction is a duplicate.
   *
   * Uses multiple strategies to identify duplicates:
   *
   * - Exact match on date, amount, and description
   * - Fuzzy match within time window
   * - Similar amount and description
   *
   * @example
   *   ```typescript
   *   const isDuplicate = detector.isDuplicate(
   *     newTransaction,
   *     existingTransactions
   *   );
   *   ```;
   *
   * @param {Transaction} transaction - Transaction to check
   * @param {Transaction[]} existingTransactions - Existing transactions
   * @returns {boolean} True if duplicate found
   */
  public isDuplicate(
    transaction: Transaction,
    existingTransactions: Transaction[],
  ): boolean {
    const transactionDate = new Date(transaction.date);
    const transactionAmount = transaction.amount;

    return existingTransactions.some((existing) => {
      const existingDate = new Date(existing.date);
      const existingAmount = existing.amount;

      // Check date proximity
      const timeDiff = Math.abs(
        transactionDate.getTime() - existingDate.getTime(),
      );
      if (timeDiff > DUPLICATE_CONFIG.TIME_WINDOW) {
        return false;
      }

      // Check amount similarity
      const amountDiff = Math.abs(transactionAmount - existingAmount);
      if (amountDiff > DUPLICATE_CONFIG.AMOUNT_TOLERANCE) {
        return false;
      }

      // Check description similarity
      const similarity = this.calculateSimilarity(
        transaction.description,
        existing.description,
      );

      return similarity >= DUPLICATE_CONFIG.SIMILARITY_THRESHOLD;
    });
  }

  /**
   * Finds all duplicate groups in a set of transactions.
   *
   * Groups transactions that are potential duplicates of each other based on
   * similarity criteria.
   *
   * @example
   *   ```typescript
   *   const groups = detector.findDuplicateGroups(transactions);
   *   groups.forEach((group, key) => {
   *   console.log(`Duplicate group ${key}: ${group.length} transactions`);
   *   });
   *   ```
   *
   * @param {Transaction[]} transactions - Transactions to analyze
   * @returns {Map<string, Transaction[]>} Map of duplicate groups
   */
  public findDuplicateGroups(
    transactions: Transaction[],
  ): Map<string, Transaction[]> {
    const groups = new Map<string, Transaction[]>();
    const processed = new Set<number>();

    transactions.forEach((transaction, i) => {
      if (processed.has(i)) return;

      const group: Transaction[] = [transaction];
      processed.add(i);

      // Find all similar transactions
      transactions.forEach((other, j) => {
        if (i === j || processed.has(j)) return;

        if (this.isDuplicate(transaction, [other])) {
          group.push(other);
          processed.add(j);
        }
      });

      // Only add groups with duplicates
      if (group.length > 1) {
        const key = this.generateKey(transaction);
        groups.set(key, group);
      }
    });

    return groups;
  }

  /**
   * Generates a unique key for a transaction.
   *
   * Creates a deterministic key based on transaction properties that can be
   * used for grouping and identification.
   *
   * @example
   *   ```typescript
   *   const key = detector.generateKey(transaction);
   *   ```;
   *
   * @param {Transaction} transaction - Transaction
   * @returns {string} Unique key
   */
  public generateKey(transaction: Transaction): string {
    const date = new Date(transaction.date).toISOString().split("T")[0];
    const amount = Math.abs(transaction.amount).toFixed(2);
    const desc = transaction.description.slice(0, 20).toLowerCase();

    return `${date}_${amount}_${desc}`;
  }

  /**
   * Calculates similarity between two strings.
   *
   * @private
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    const maxLength = Math.max(s1.length, s2.length);
    const distance = this.levenshteinDistance(s1, s2);

    return 1 - distance / maxLength;
  }

  /**
   * Calculates Levenshtein distance between two strings.
   *
   * @private
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const columnCount = str1.length + 1;
    let previousRow = new Uint32Array(columnCount);
    let currentRow = new Uint32Array(columnCount);
    const getDistanceAt = (row: Uint32Array, index: number): number =>
      row[index] ?? 0;

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      previousRow[columnIndex] = columnIndex;
    }

    for (let rowIndex = 1; rowIndex <= str2.length; rowIndex++) {
      currentRow[0] = rowIndex;

      for (let columnIndex = 1; columnIndex <= str1.length; columnIndex++) {
        const substitutionBase = getDistanceAt(previousRow, columnIndex - 1);

        if (str2.charAt(rowIndex - 1) === str1.charAt(columnIndex - 1)) {
          currentRow[columnIndex] = substitutionBase;
        } else {
          currentRow[columnIndex] = Math.min(
            substitutionBase + 1,
            getDistanceAt(currentRow, columnIndex - 1) + 1,
            getDistanceAt(previousRow, columnIndex) + 1,
          );
        }
      }

      const completedRow = previousRow;
      previousRow = currentRow;
      currentRow = completedRow;
    }

    return getDistanceAt(previousRow, str1.length);
  }
}

// ============================================================================
// Exported Functions (for backward compatibility)
// ============================================================================

/**
 * Global validator instance.
 *
 * @private
 */
const _globalValidator = new TransactionValidator(new DuplicateDetector());

/**
 * Schema for creating a transaction in the database.
 *
 * This schema validates the final transaction format that will be stored in the
 * database after transformation.
 *
 * @deprecated Use transformedTransactionSchema from schemas module
 * @public
 */
export const createTransactionSchema = transformedTransactionSchema;

/**
 * Validates a batch of transactions.
 *
 * This function validates multiple transactions and separates them into valid
 * and invalid groups with detailed error information.
 *
 * @deprecated Use TransactionValidator class for new code
 * @example
 *   ```typescript
 *   const { validTransactions, invalidTransactions } = validateTransactions(
 *   transactions
 *   );
 *
 *   console.log(`Valid: ${validTransactions.length}`);
 *   console.log(`Invalid: ${invalidTransactions.length}`);
 *   ```
 *
 * @param {TransformedTransaction[]} transactions - Transformed transactions to
 *   validate
 * @returns Validation results containing valid transformed transactions and
 *   invalid parse results
 * @public
 */
export const validateTransactions = (
  transactions: TransformedTransaction[],
) => {
  const processedTransactions = transactions.map((transaction) =>
    createTransactionSchema.safeParse(transaction),
  );

  const validTransactions = processedTransactions.filter(
    (transaction) => transaction.success,
  );

  const invalidTransactions = processedTransactions.filter(
    (transaction) => !transaction.success,
  );

  return {
    validTransactions: validTransactions.map((transaction) => transaction.data),
    invalidTransactions: invalidTransactions.map(
      (transaction) => transaction.error,
    ),
  };
};
