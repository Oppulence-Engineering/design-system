/**
 * @module @oppulence/import/errors
 * @file Custom error classes for the import package.
 * @author Canvas Team
 * @copyright 2024 Canvas
 */

import type { ValidationError as ValidationErrorType } from "../schemas";

/**
 * Base error class for all import-related errors.
 *
 * @class ImportError
 * @extends {Error}
 * @public
 */
export class ImportError extends Error {
  /**
   * Error code for programmatic error handling.
   *
   * @type {string}
   * @readonly
   */
  public readonly code: string;

  /**
   * HTTP status code associated with the error.
   *
   * @type {number | undefined}
   * @readonly
   */
  public readonly statusCode?: number;

  /**
   * Additional context data for debugging.
   *
   * @type {Record<string, unknown> | undefined}
   * @readonly
   */
  public readonly context?: Record<string, unknown>;

  /**
   * Timestamp when the error occurred.
   *
   * @type {Date}
   * @readonly
   */
  public readonly timestamp: Date;

  /**
   * Creates a new ImportError instance.
   *
   * @param {string} message - Error message
   * @param {string} code - Error code for programmatic handling
   * @param {number} [statusCode] - HTTP status code
   * @param {Record<string, unknown>} [context] - Additional context data
   */
  constructor(
    message: string,
    code: string,
    statusCode?: number,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ImportError";
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ImportError);
    }
  }

  /**
   * Converts the error to a JSON-serializable object.
   *
   * @returns {object} JSON representation of the error
   */
  public toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when data validation fails.
 *
 * @class ValidationError
 * @extends {ImportError}
 * @public
 */
export class ValidationError extends ImportError {
  /**
   * Validation errors by field.
   *
   * @type {ValidationErrorType[] | undefined}
   * @readonly
   */
  public readonly validationErrors?: ValidationErrorType[];

  /**
   * Row number where the error occurred.
   *
   * @type {number | undefined}
   * @readonly
   */
  public readonly row?: number;

  /**
   * Creates a new ValidationError instance.
   *
   * @param {string} message - Error message
   * @param {ValidationErrorType[]} [validationErrors] - Field-specific
   *   validation errors
   * @param {number} [row] - Row number where error occurred
   * @param {Record<string, unknown>} [context] - Additional context data
   */
  constructor(
    message: string,
    validationErrors?: ValidationErrorType[],
    row?: number,
    context?: Record<string, unknown>,
  ) {
    super(message, "VALIDATION_ERROR", 400, context);
    this.name = "ValidationError";
    this.validationErrors = validationErrors;
    this.row = row;
  }
}

/**
 * Error thrown when parsing fails.
 *
 * @class ParseError
 * @extends {ImportError}
 * @public
 */
export class ParseError extends ImportError {
  /**
   * Line number where parsing failed.
   *
   * @type {number | undefined}
   * @readonly
   */
  public readonly line?: number;

  /**
   * Column number where parsing failed.
   *
   * @type {number | undefined}
   * @readonly
   */
  public readonly column?: number;

  /**
   * The value that failed to parse.
   *
   * @type {unknown}
   * @readonly
   */
  public readonly failedValue?: unknown;

  /**
   * Creates a new ParseError instance.
   *
   * @param {string} message - Error message
   * @param {number} [line] - Line number
   * @param {number} [column] - Column number
   * @param {unknown} [failedValue] - Value that failed to parse
   * @param {Record<string, unknown>} [context] - Additional context data
   */
  constructor(
    message: string,
    line?: number,
    column?: number,
    failedValue?: unknown,
    context?: Record<string, unknown>,
  ) {
    super(message, "PARSE_ERROR", 400, context);
    this.name = "ParseError";
    this.line = line;
    this.column = column;
    this.failedValue = failedValue;
  }
}

/**
 * Error thrown when transformation fails.
 *
 * @class TransformationError
 * @extends {ImportError}
 * @public
 */
export class TransformationError extends ImportError {
  /**
   * Field that failed transformation.
   *
   * @type {string | undefined}
   * @readonly
   */
  public readonly field?: string;

  /**
   * Original value before transformation.
   *
   * @type {unknown}
   * @readonly
   */
  public readonly originalValue?: unknown;

  /**
   * Creates a new TransformationError instance.
   *
   * @param {string} message - Error message
   * @param {string} [field] - Field that failed
   * @param {unknown} [originalValue] - Original value
   * @param {Record<string, unknown>} [context] - Additional context data
   */
  constructor(
    message: string,
    field?: string,
    originalValue?: unknown,
    context?: Record<string, unknown>,
  ) {
    super(message, "TRANSFORMATION_ERROR", 422, context);
    this.name = "TransformationError";
    this.field = field;
    this.originalValue = originalValue;
  }
}

/**
 * Error thrown when mapping configuration is invalid.
 *
 * @class MappingError
 * @extends {ImportError}
 * @public
 */
export class MappingError extends ImportError {
  /**
   * Missing required fields.
   *
   * @type {string[] | undefined}
   * @readonly
   */
  public readonly missingFields?: string[];

  /**
   * Invalid field mappings.
   *
   * @type {Record<string, string> | undefined}
   * @readonly
   */
  public readonly invalidMappings?: Record<string, string>;

  /**
   * Creates a new MappingError instance.
   *
   * @param {string} message - Error message
   * @param {string[]} [missingFields] - Missing required fields
   * @param {Record<string, string>} [invalidMappings] - Invalid mappings
   * @param {Record<string, unknown>} [context] - Additional context data
   */
  constructor(
    message: string,
    missingFields?: string[],
    invalidMappings?: Record<string, string>,
    context?: Record<string, unknown>,
  ) {
    super(message, "MAPPING_ERROR", 400, context);
    this.name = "MappingError";
    this.missingFields = missingFields;
    this.invalidMappings = invalidMappings;
  }
}

/**
 * Error thrown when file processing fails.
 *
 * @class FileProcessingError
 * @extends {ImportError}
 * @public
 */
export class FileProcessingError extends ImportError {
  /**
   * File name that failed to process.
   *
   * @type {string | undefined}
   * @readonly
   */
  public readonly filename?: string;

  /**
   * File size in bytes.
   *
   * @type {number | undefined}
   * @readonly
   */
  public readonly fileSize?: number;

  /**
   * File MIME type.
   *
   * @type {string | undefined}
   * @readonly
   */
  public readonly mimeType?: string;

  /**
   * Creates a new FileProcessingError instance.
   *
   * @param {string} message - Error message
   * @param {string} [filename] - File name
   * @param {number} [fileSize] - File size
   * @param {string} [mimeType] - MIME type
   * @param {Record<string, unknown>} [context] - Additional context data
   */
  constructor(
    message: string,
    filename?: string,
    fileSize?: number,
    mimeType?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, "FILE_PROCESSING_ERROR", 422, context);
    this.name = "FileProcessingError";
    this.filename = filename;
    this.fileSize = fileSize;
    this.mimeType = mimeType;
  }
}

/**
 * Error thrown when duplicate transactions are detected.
 *
 * @class DuplicateError
 * @extends {ImportError}
 * @public
 */
export class DuplicateError extends ImportError {
  /**
   * IDs of duplicate transactions.
   *
   * @type {string[] | undefined}
   * @readonly
   */
  public readonly duplicateIds?: string[];

  /**
   * Number of duplicates found.
   *
   * @type {number}
   * @readonly
   */
  public readonly duplicateCount: number;

  /**
   * Creates a new DuplicateError instance.
   *
   * @param {string} message - Error message
   * @param {string[]} [duplicateIds] - Duplicate transaction IDs
   * @param {number} [duplicateCount=0] - Number of duplicates. Default is `0`
   * @param {Record<string, unknown>} [context] - Additional context data
   */
  constructor(
    message: string,
    duplicateIds?: string[],
    duplicateCount = 0,
    context?: Record<string, unknown>,
  ) {
    super(message, "DUPLICATE_ERROR", 409, context);
    this.name = "DuplicateError";
    this.duplicateIds = duplicateIds;
    this.duplicateCount = duplicateCount || duplicateIds?.length || 0;
  }
}

/**
 * Error thrown when batch processing fails.
 *
 * @class BatchProcessingError
 * @extends {ImportError}
 * @public
 */
export class BatchProcessingError extends ImportError {
  /**
   * Batch number that failed.
   *
   * @type {number | undefined}
   * @readonly
   */
  public readonly batchNumber?: number;

  /**
   * Total number of batches.
   *
   * @type {number | undefined}
   * @readonly
   */
  public readonly totalBatches?: number;

  /**
   * Number of items in the failed batch.
   *
   * @type {number | undefined}
   * @readonly
   */
  public readonly batchSize?: number;

  /**
   * Creates a new BatchProcessingError instance.
   *
   * @param {string} message - Error message
   * @param {number} [batchNumber] - Batch number
   * @param {number} [totalBatches] - Total batches
   * @param {number} [batchSize] - Batch size
   * @param {Record<string, unknown>} [context] - Additional context data
   */
  constructor(
    message: string,
    batchNumber?: number,
    totalBatches?: number,
    batchSize?: number,
    context?: Record<string, unknown>,
  ) {
    super(message, "BATCH_PROCESSING_ERROR", 500, context);
    this.name = "BatchProcessingError";
    this.batchNumber = batchNumber;
    this.totalBatches = totalBatches;
    this.batchSize = batchSize;
  }
}

/**
 * Helper function to determine if an error is retryable.
 *
 * @param {Error} error - Error to check
 * @returns {boolean} Whether the error is retryable
 * @public
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof BatchProcessingError) {
    return true;
  }

  if (error instanceof ImportError) {
    // 5xx errors are generally retryable
    return error.statusCode !== undefined && error.statusCode >= 500;
  }

  // Network errors are retryable
  if (error.message.toLowerCase().includes("network")) {
    return true;
  }

  return false;
}

/**
 * Helper function to wrap unknown errors in ImportError.
 *
 * @param {unknown} error - Error to wrap
 * @param {string} [defaultMessage] - Default message if error is not an Error
 *   instance
 * @returns {ImportError} Wrapped error
 * @public
 */
export function wrapError(
  error: unknown,
  defaultMessage = "An unknown error occurred",
): ImportError {
  if (error instanceof ImportError) {
    return error;
  }

  if (error instanceof Error) {
    return new ImportError(error.message, "WRAPPED_ERROR", undefined, {
      originalError: error.name,
      stack: error.stack,
    });
  }

  return new ImportError(defaultMessage, "UNKNOWN_ERROR", undefined, {
    originalValue: error,
  });
}

/**
 * Aggregates multiple errors into a single error with context.
 *
 * @param {Error[]} errors - Array of errors to aggregate
 * @param {string} [message] - Overall error message
 * @returns {ImportError} Aggregated error
 * @public
 */
export function aggregateErrors(
  errors: Error[],
  message = "Multiple errors occurred",
): ImportError {
  const errorDetails = errors.map((error) => ({
    name: error.name,
    message: error.message,
    ...(error instanceof ImportError && {
      code: error.code,
      context: error.context,
    }),
  }));

  return new ImportError(message, "AGGREGATE_ERROR", 500, {
    errorCount: errors.length,
    errors: errorDetails,
  });
}
