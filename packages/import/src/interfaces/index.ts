/**
 * @module @oppulence/import/interfaces
 * @file Interface definitions for the import package.
 * @author Canvas Team
 * @copyright 2024 Canvas
 */

import type {
  CsvRow,
  FieldMapping,
  ImportConfiguration,
  ImportOptions,
  ImportResult,
  RawTransaction,
  Transaction,
  TransformedTransaction,
  ValidationResult,
} from "../schemas";

/**
 * Interface for date parsing service.
 *
 * @interface IDateParser
 * @public
 */
export interface IDateParser {
  /**
   * Parses a date string into ISO format.
   *
   * @param {string} dateString - Date string to parse
   * @param {string} [format] - Optional format hint
   * @returns {string | undefined} ISO date string or undefined if parsing fails
   */
  parse(dateString: string, format?: string): string | undefined;

  /**
   * Validates if a date string is valid.
   *
   * @param {string} dateString - Date string to validate
   * @returns {boolean} True if valid date
   */
  isValid(dateString: string): boolean;

  /**
   * Gets supported date formats.
   *
   * @returns {string[]} Array of supported format patterns
   */
  getSupportedFormats(): string[];
}

/**
 * Interface for amount parsing service.
 *
 * @interface IAmountParser
 * @public
 */
export interface IAmountParser {
  /**
   * Parses an amount string into a number.
   *
   * @param {string} amountString - Amount string to parse
   * @param {boolean} [inverted] - Whether to invert the amount
   * @returns {number} Parsed amount
   */
  parse(amountString: string, inverted?: boolean): number;

  /**
   * Formats a number as a currency string.
   *
   * @param {number} amount - Amount to format
   * @param {string} [currency] - Currency code
   * @returns {string} Formatted amount string
   */
  format(amount: number, currency?: string): string;

  /**
   * Validates if an amount string is valid.
   *
   * @param {string} amountString - Amount string to validate
   * @returns {boolean} True if valid amount
   */
  isValid(amountString: string): boolean;
}

/**
 * Interface for transaction mapper service.
 *
 * @interface ITransactionMapper
 * @public
 */
export interface ITransactionMapper {
  /**
   * Maps raw data to transactions.
   *
   * @param {CsvRow[]} data - Raw CSV data
   * @param {FieldMapping} mappings - Field mappings
   * @param {ImportConfiguration} config - Import configuration
   * @returns {RawTransaction[]} Mapped transactions
   */
  mapTransactions(
    data: CsvRow[],
    mappings: FieldMapping,
    config: ImportConfiguration,
  ): RawTransaction[];

  /**
   * Validates field mappings.
   *
   * @param {FieldMapping} mappings - Field mappings to validate
   * @param {string[]} availableFields - Available fields in data
   * @returns {boolean} True if mappings are valid
   */
  validateMappings(mappings: FieldMapping, availableFields: string[]): boolean;

  /**
   * Gets required fields for mapping.
   *
   * @returns {string[]} Array of required field names
   */
  getRequiredFields(): string[];
}

/**
 * Interface for transaction transformer service.
 *
 * @interface ITransactionTransformer
 * @public
 */
export interface ITransactionTransformer {
  /**
   * Transforms a transaction for database storage.
   *
   * @param {Transaction} transaction - Transaction to transform
   * @param {ImportOptions} [options] - Transform options
   * @returns {TransformedTransaction} Transformed transaction
   */
  transform(
    transaction: Transaction,
    options?: ImportOptions,
  ): TransformedTransaction;

  /**
   * Batch transforms multiple transactions.
   *
   * @param {Transaction[]} transactions - Transactions to transform
   * @param {ImportOptions} [options] - Transform options
   * @returns {TransformedTransaction[]} Transformed transactions
   */
  transformBatch(
    transactions: Transaction[],
    options?: ImportOptions,
  ): TransformedTransaction[];

  /**
   * Applies categorization to a transaction.
   *
   * @param {TransformedTransaction} transaction - Transaction to categorize
   * @returns {TransformedTransaction} Categorized transaction
   */
  categorize(transaction: TransformedTransaction): TransformedTransaction;
}

/**
 * Interface for transaction validator service.
 *
 * @interface ITransactionValidator
 * @public
 */
export interface ITransactionValidator {
  /**
   * Validates a single transaction.
   *
   * @param {unknown} transaction - Transaction to validate
   * @returns {ValidationResult} Validation result
   */
  validate(transaction: unknown): ValidationResult;

  /**
   * Validates multiple transactions.
   *
   * @param {unknown[]} transactions - Transactions to validate
   * @returns {ValidationResult} Aggregated validation result
   */
  validateBatch(transactions: unknown[]): ValidationResult;

  /**
   * Checks for duplicate transactions.
   *
   * @param {Transaction[]} transactions - Transactions to check
   * @param {Transaction[]} existingTransactions - Existing transactions
   * @returns {string[]} Array of duplicate transaction IDs
   */
  findDuplicates(
    transactions: Transaction[],
    existingTransactions: Transaction[],
  ): string[];
}

/**
 * Interface for CSV parser service.
 *
 * @interface ICsvParser
 * @public
 */
export interface ICsvParser {
  /**
   * Parses CSV content into rows.
   *
   * @param {string} content - CSV content
   * @param {object} [options] - Parser options
   * @returns {CsvRow[]} Parsed CSV rows
   */
  parse(content: string, options?: object): CsvRow[];

  /**
   * Gets headers from CSV content.
   *
   * @param {string} content - CSV content
   * @returns {string[]} Array of header names
   */
  getHeaders(content: string): string[];

  /**
   * Validates CSV structure.
   *
   * @param {string} content - CSV content
   * @returns {boolean} True if valid CSV
   */
  isValid(content: string): boolean;
}

/**
 * Interface for import processor service.
 *
 * @interface IImportProcessor
 * @public
 */
export interface IImportProcessor {
  /**
   * Processes an import job.
   *
   * @param {CsvRow[]} data - Data to import
   * @param {ImportConfiguration} config - Import configuration
   * @returns {Promise<ImportResult>} Import result
   */
  process(data: CsvRow[], config: ImportConfiguration): Promise<ImportResult>;

  /**
   * Validates import data before processing.
   *
   * @param {CsvRow[]} data - Data to validate
   * @param {ImportConfiguration} config - Import configuration
   * @returns {ValidationResult} Validation result
   */
  preValidate(data: CsvRow[], config: ImportConfiguration): ValidationResult;

  /**
   * Rolls back an import.
   *
   * @param {string} importId - Import ID to roll back
   * @returns {Promise<boolean>} True if rollback successful
   */
  rollback(importId: string): Promise<boolean>;
}

/**
 * Interface for duplicate detection service.
 *
 * @interface IDuplicateDetector
 * @public
 */
export interface IDuplicateDetector {
  /**
   * Detects duplicate transactions.
   *
   * @param {Transaction} transaction - Transaction to check
   * @param {Transaction[]} existingTransactions - Existing transactions
   * @returns {boolean} True if duplicate found
   */
  isDuplicate(
    transaction: Transaction,
    existingTransactions: Transaction[],
  ): boolean;

  /**
   * Finds all duplicates in a batch.
   *
   * @param {Transaction[]} transactions - Transactions to check
   * @returns {Map<string, Transaction[]>} Map of duplicate groups
   */
  findDuplicateGroups(transactions: Transaction[]): Map<string, Transaction[]>;

  /**
   * Generates a unique key for a transaction.
   *
   * @param {Transaction} transaction - Transaction
   * @returns {string} Unique key
   */
  generateKey(transaction: Transaction): string;
}

/**
 * Interface for categorization service.
 *
 * @interface ICategorizationService
 * @public
 */
export interface ICategorizationService {
  /**
   * Categorizes a transaction based on description.
   *
   * @param {string} description - Transaction description
   * @param {number} amount - Transaction amount
   * @returns {string | null} Category slug or null
   */
  categorize(description: string, amount: number): string | null;

  /**
   * Learns from user categorization.
   *
   * @param {string} description - Transaction description
   * @param {string} category - Assigned category
   * @returns {void}
   */
  learn(description: string, category: string): void;

  /**
   * Gets available categories.
   *
   * @returns {string[]} Array of category slugs
   */
  getCategories(): string[];
}

/**
 * Interface for batch processor.
 *
 * @interface IBatchProcessor
 * @public
 */
export interface IBatchProcessor<T, R> {
  /**
   * Processes items in batches.
   *
   * @param {T[]} items - Items to process
   * @param {number} batchSize - Size of each batch
   * @param {Function} processor - Processing function
   * @returns {Promise<R[]>} Processed results
   */
  processBatches(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<R[]>,
  ): Promise<R[]>;

  /**
   * Gets optimal batch size based on data.
   *
   * @param {T[]} items - Items to process
   * @returns {number} Optimal batch size
   */
  getOptimalBatchSize(items: T[]): number;
}

/**
 * Interface for progress reporter.
 *
 * @interface IProgressReporter
 * @public
 */
export interface IProgressReporter {
  /**
   * Reports progress of an operation.
   *
   * @param {number} current - Current progress
   * @param {number} total - Total items
   * @param {string} [message] - Progress message
   */
  report(current: number, total: number, message?: string): void;

  /**
   * Marks operation as completed.
   *
   * @param {string} [message] - Completion message
   */
  complete(message?: string): void;

  /**
   * Reports an error.
   *
   * @param {Error} error - Error that occurred
   */
  error(error: Error): void;
}

/**
 * Interface for logger service.
 *
 * @interface ILogger
 * @public
 */
export interface ILogger {
  /**
   * Logs debug information.
   *
   * @param {string} message - Debug message
   * @param {Record<string, unknown>} [context] - Additional context
   */
  debug(message: string, context?: Record<string, unknown>): void;

  /**
   * Logs informational messages.
   *
   * @param {string} message - Info message
   * @param {Record<string, unknown>} [context] - Additional context
   */
  info(message: string, context?: Record<string, unknown>): void;

  /**
   * Logs warning messages.
   *
   * @param {string} message - Warning message
   * @param {Record<string, unknown>} [context] - Additional context
   */
  warn(message: string, context?: Record<string, unknown>): void;

  /**
   * Logs error messages.
   *
   * @param {string} message - Error message
   * @param {Error} [error] - Error object
   * @param {Record<string, unknown>} [context] - Additional context
   */
  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void;
}
