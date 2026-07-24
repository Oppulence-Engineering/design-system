/**
 * @module @oppulence/import
 * @file Main entry point for the @oppulence/import package.
 *
 *   This package provides functionality for importing and processing financial
 *   transaction data from various file formats (CSV, Excel, etc.) with support
 *   for field mapping, validation, and transformation.
 * @author Canvas Team
 * @copyright 2024 Canvas
 */

// ============================================================================
// Core Exports
// ============================================================================

/** Utility function exports. */
export * from "./utils";

// ============================================================================
// Schema and Type Exports
// ============================================================================

/** Type definitions and Zod schemas. */
export {
  amountSchema,
  amountStringSchema,
  type CsvRow,
  // Constants
  CURRENCY_CODES,
  type CurrencyCode,
  csvRowSchema,
  currencyCodeSchema,
  DATE_FORMATS,
  dateStringSchema,
  descriptionSchema,
  FIELD_MAPPINGS,
  type FieldMapping,
  fieldMappingSchema,
  type ImportConfiguration,
  type ImportFileMetadata,
  type ImportJob,
  type ImportOptions,
  type ImportResult,
  importConfigurationSchema,
  importFileMetadataSchema,
  importJobSchema,
  importOptionsSchema,
  importResultSchema,
  isoDateSchema,
  // Types
  type RawTransaction,
  rawTransactionSchema,
  TRANSACTION_CATEGORY,
  TRANSACTION_METHOD,
  TRANSACTION_STATUS,
  type Transaction,
  type TransactionCategory,
  type TransactionMethod,
  type TransactionStatus,
  type TransformedTransaction,
  transactionSchema,
  transformedTransactionSchema,
  // Schemas
  uuidSchema,
  VALIDATION_LIMITS,
  type ValidationError,
  type ValidationResult,
  validationErrorSchema,
  validationResultSchema,
} from "./schemas";

// ============================================================================
// Error Classes Exports
// ============================================================================

/** Custom error classes and error utilities. */
export {
  aggregateErrors,
  BatchProcessingError,
  DuplicateError,
  FileProcessingError,
  // Error classes
  ImportError,
  // Error utilities
  isRetryableError,
  MappingError,
  ParseError,
  TransformationError,
  ValidationError as ImportValidationError,
  wrapError,
} from "./errors";

// ============================================================================
// Interface Exports
// ============================================================================

/** Interface definitions. */
export type {
  IAmountParser,
  IBatchProcessor,
  ICategorizationService,
  ICsvParser,
  IDateParser,
  IDuplicateDetector,
  IImportProcessor,
  ILogger,
  IProgressReporter,
  ITransactionMapper,
  ITransactionTransformer,
  ITransactionValidator,
} from "./interfaces";

// ============================================================================
// Utility Class Exports
// ============================================================================

/** Date and amount parsing utilities. */
export {
  AmountParser,
  DateParser,
  formatAmountValue,
  formatCurrency,
  formatDate,
  getSupportedDateFormats,
  isValidAmount,
  isValidDate,
} from "./utils";

// ============================================================================
// Mapping Exports
// ============================================================================

/** Transaction mapping utilities. */
export {
  getOptionalFields,
  getRequiredFields,
  mapTransactions,
  TransactionMapper,
  validateMappings,
} from "./mappings";

// ============================================================================
// Transformation Exports
// ============================================================================

/** Transaction transformation utilities. */
export { TransactionTransformer, transform } from "./transform";

// ============================================================================
// Validation Exports
// ============================================================================

/** Transaction validation and duplicate detection utilities. */
export {
  createTransactionSchema,
  DuplicateDetector,
  TransactionValidator,
  validateTransactions,
} from "./validate";

// ============================================================================
// Package Information
// ============================================================================

/**
 * Package version information.
 *
 * @constant
 */
export const VERSION = "1.0.0";

/**
 * Package name.
 *
 * @constant
 */
export const PACKAGE_NAME = "@oppulence/import";
