/**
 * @module @oppulence/import/schemas
 * @file Central type definitions and Zod schemas for the import package.
 * @author Canvas Team
 * @copyright 2024 Canvas
 */

import { z } from "zod";

// ============================================================================
// Constants
// ============================================================================

/**
 * Supported currency codes (ISO 4217).
 *
 * @public
 */
export const CURRENCY_CODES = {
  USD: "USD",
  EUR: "EUR",
  GBP: "GBP",
  JPY: "JPY",
  CAD: "CAD",
  AUD: "AUD",
  CHF: "CHF",
  CNY: "CNY",
  SEK: "SEK",
  NZD: "NZD",
} as const;

/**
 * Transaction status types.
 *
 * @public
 */
export const TRANSACTION_STATUS = {
  POSTED: "posted",
  PENDING: "pending",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

/**
 * Transaction method types.
 *
 * @public
 */
export const TRANSACTION_METHOD = {
  CARD: "card",
  BANK: "bank",
  CASH: "cash",
  CHECK: "check",
  WIRE: "wire",
  OTHER: "other",
} as const;

/**
 * Category types for transactions.
 *
 * @public
 */
export const TRANSACTION_CATEGORY = {
  INCOME: "income",
  EXPENSE: "expense",
  TRANSFER: "transfer",
  INVESTMENT: "investment",
  SAVINGS: "savings",
} as const;

/**
 * Date format patterns supported for parsing.
 *
 * @public
 */
export const DATE_FORMATS = [
  "dd/MMM/yyyy",
  "d/M/yy",
  "dd/MM/yyyy",
  "yyyy-MM-dd",
  "MM/dd/yyyy",
  "dd.MM.yyyy",
  "dd-MM-yyyy",
  "yyyy/MM/dd",
  "MM-dd-yyyy",
  "yyyy.MM.dd",
  "dd MMM yyyy",
  "MMM dd, yyyy",
  "MMMM dd, yyyy",
  "yyyy-MM-dd'T'HH:mm:ss",
  "yyyy-MM-dd HH:mm:ss",
  "dd/MM/yyyy HH:mm:ss",
  "MM/dd/yyyy HH:mm:ss",
  "yyyy/MM/dd HH:mm:ss",
  "dd.MM.yyyy HH:mm:ss",
  "dd-MM-yyyy HH:mm:ss",
  "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
  "yyyy-MM-dd'T'HH:mm:ss",
] as const;

/**
 * Maximum and minimum values for validation.
 *
 * @public
 */
export const VALIDATION_LIMITS = {
  MIN_AMOUNT: -999_999_999.99,
  MAX_AMOUNT: 999_999_999.99,
  MAX_DESCRIPTION_LENGTH: 500,
  MIN_DESCRIPTION_LENGTH: 1,
  MAX_CURRENCY_LENGTH: 3,
  MIN_CURRENCY_LENGTH: 3,
  MAX_BATCH_SIZE: 10_000,
  MIN_BATCH_SIZE: 1,
} as const;

/**
 * Field mapping types for import configuration.
 *
 * @public
 */
export const FIELD_MAPPINGS = {
  DATE: "date",
  DESCRIPTION: "description",
  AMOUNT: "amount",
  CATEGORY: "category",
  TAGS: "tags",
  NOTES: "notes",
  REFERENCE: "reference",
  BALANCE: "balance",
} as const;

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Schema for UUID validation.
 *
 * @public
 */
export const uuidSchema = z
  .string()
  .uuid("Invalid UUID format")
  .describe("Universally unique identifier");

/**
 * Schema for currency code validation.
 *
 * @public
 */
export const currencyCodeSchema = z
  .string()
  .length(3, "Currency code must be exactly 3 characters")
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency code must contain only uppercase letters")
  .describe("ISO 4217 currency code");

/**
 * Schema for transaction amount validation.
 *
 * @public
 */
export const amountSchema = z
  .number()
  .min(
    VALIDATION_LIMITS.MIN_AMOUNT,
    `Amount cannot be less than ${VALIDATION_LIMITS.MIN_AMOUNT}`,
  )
  .max(
    VALIDATION_LIMITS.MAX_AMOUNT,
    `Amount cannot exceed ${VALIDATION_LIMITS.MAX_AMOUNT}`,
  )
  .finite("Amount must be a finite number")
  .describe("Transaction amount");

/**
 * Schema for transaction amount string (before parsing).
 * Supports various formats including:
 * - Simple numbers: "1234", "-1234"
 * - Decimal with period: "1234.56"
 * - Decimal with comma (European): "1234,56"
 * - Thousands separators: "1.234,56" (European), "1,234.56" (US)
 * - Multiple thousands separators: "1.234.567,89"
 *
 * @public
 */
export const amountStringSchema = z
  .string()
  .min(1, "Amount is required")
  .regex(/^-?\d+([.,]\d+)*$/, "Invalid amount format")
  .describe("Transaction amount as string");

/**
 * Schema for transaction description.
 *
 * @public
 */
export const descriptionSchema = z
  .string()
  .min(VALIDATION_LIMITS.MIN_DESCRIPTION_LENGTH, "Description cannot be empty")
  .max(
    VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH,
    `Description cannot exceed ${VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH} characters`,
  )
  .trim()
  .describe("Transaction description");

/**
 * Schema for date string validation.
 *
 * @public
 */
export const dateStringSchema = z
  .string()
  .min(1, "Date is required")
  .describe("Date string in various formats");

/**
 * Schema for ISO date validation.
 *
 * @public
 */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in ISO format (YYYY-MM-DD)")
  .refine((date) => {
    const parsed = new Date(date);
    return !Number.isNaN(parsed.getTime());
  }, "Invalid date")
  .describe("ISO 8601 date format");

// ============================================================================
// Transaction Schemas
// ============================================================================

/**
 * Schema for raw transaction data (before transformation).
 *
 * @public
 */
export const rawTransactionSchema = z.object({
  date: dateStringSchema,
  description: descriptionSchema,
  amount: amountStringSchema,
  teamId: uuidSchema,
  bankAccountId: uuidSchema,
  currency: currencyCodeSchema,
});

/**
 * Schema for transaction after initial processing.
 *
 * @public
 */
export const transactionSchema = z.object({
  date: isoDateSchema,
  description: descriptionSchema,
  amount: amountSchema,
  teamId: uuidSchema,
  bankAccountId: uuidSchema,
  currency: currencyCodeSchema,
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  reference: z.string().optional(),
});

/**
 * Schema for transformed transaction (ready for database).
 *
 * @public
 */
export const transformedTransactionSchema = z.object({
  internal_id: z.string().min(1, "Internal ID is required"),
  team_id: uuidSchema,
  status: z.enum(["posted", "pending", "failed", "cancelled"]),
  method: z.enum(["card", "bank", "cash", "check", "wire", "other"]),
  date: z.coerce.date(),
  amount: amountSchema,
  name: descriptionSchema,
  manual: z.boolean(),
  category_slug: z.string().nullable(),
  bank_account_id: uuidSchema,
  currency: currencyCodeSchema,
  notified: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// Import Configuration Schemas
// ============================================================================

/**
 * Schema for field mapping configuration.
 *
 * @public
 */
export const fieldMappingSchema = z.object({
  date: z.string().optional(),
  description: z.string().optional(),
  amount: z.string().optional(),
  category: z.string().optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
  reference: z.string().optional(),
  balance: z.string().optional(),
});

/**
 * Schema for import options.
 *
 * @public
 */
export const importOptionsSchema = z.object({
  inverted: z.boolean().default(false).describe("Invert transaction amounts"),
  skipDuplicates: z
    .boolean()
    .default(true)
    .describe("Skip duplicate transactions"),
  autoCategrize: z
    .boolean()
    .default(true)
    .describe("Automatically categorize transactions"),
  dateFormat: z.string().optional().describe("Custom date format pattern"),
  timezone: z.string().default("UTC").describe("Timezone for date parsing"),
  batchSize: z
    .number()
    .min(VALIDATION_LIMITS.MIN_BATCH_SIZE)
    .max(VALIDATION_LIMITS.MAX_BATCH_SIZE)
    .default(1000)
    .describe("Batch size for processing"),
});

/**
 * Schema for import configuration.
 *
 * @public
 */
export const importConfigurationSchema = z.object({
  teamId: uuidSchema,
  bankAccountId: uuidSchema,
  currency: currencyCodeSchema,
  mappings: fieldMappingSchema,
  options: importOptionsSchema.optional(),
});

// ============================================================================
// Validation Result Schemas
// ============================================================================

/**
 * Schema for validation error details.
 *
 * @public
 */
export const validationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  value: z.unknown(),
  row: z.number().optional(),
});

/**
 * Schema for validation result.
 *
 * @public
 */
export const validationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(validationErrorSchema),
  warnings: z.array(z.string()).optional(),
  processedCount: z.number(),
  validCount: z.number(),
  invalidCount: z.number(),
});

/**
 * Schema for import result.
 *
 * @public
 */
export const importResultSchema = z.object({
  success: z.boolean(),
  imported: z.number(),
  failed: z.number(),
  skipped: z.number(),
  duplicates: z.number(),
  transactions: z.array(transformedTransactionSchema),
  errors: z.array(validationErrorSchema),
  duration: z.number().describe("Processing duration in milliseconds"),
});

// ============================================================================
// CSV/File Import Schemas
// ============================================================================

/**
 * Schema for CSV row data.
 *
 * @public
 */
export const csvRowSchema = z.record(z.string(), z.string());

/**
 * Schema for import file metadata.
 *
 * @public
 */
export const importFileMetadataSchema = z.object({
  filename: z.string(),
  size: z.number().positive("File size must be positive"),
  mimeType: z.string(),
  encoding: z.string().default("utf-8"),
  uploadedAt: z.date(),
  uploadedBy: uuidSchema,
});

/**
 * Schema for import job.
 *
 * @public
 */
export const importJobSchema = z.object({
  id: uuidSchema,
  teamId: uuidSchema,
  status: z.enum(["pending", "processing", "completed", "failed"]),
  configuration: importConfigurationSchema,
  fileMetadata: importFileMetadataSchema,
  result: importResultSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Type for raw transaction data.
 *
 * @public
 */
export type RawTransaction = z.infer<typeof rawTransactionSchema>;

/**
 * Type for processed transaction.
 *
 * @public
 */
export type Transaction = z.infer<typeof transactionSchema>;

/**
 * Type for transformed transaction.
 *
 * @public
 */
export type TransformedTransaction = z.infer<
  typeof transformedTransactionSchema
>;

/**
 * Type for field mapping configuration.
 *
 * @public
 */
export type FieldMapping = z.infer<typeof fieldMappingSchema>;

/**
 * Type for import options.
 *
 * @public
 */
export type ImportOptions = z.infer<typeof importOptionsSchema>;

/**
 * Type for import configuration.
 *
 * @public
 */
export type ImportConfiguration = z.infer<typeof importConfigurationSchema>;

/**
 * Type for validation error.
 *
 * @public
 */
export type ValidationError = z.infer<typeof validationErrorSchema>;

/**
 * Type for validation result.
 *
 * @public
 */
export type ValidationResult = z.infer<typeof validationResultSchema>;

/**
 * Type for import result.
 *
 * @public
 */
export type ImportResult = z.infer<typeof importResultSchema>;

/**
 * Type for CSV row data.
 *
 * @public
 */
export type CsvRow = z.infer<typeof csvRowSchema>;

/**
 * Type for import file metadata.
 *
 * @public
 */
export type ImportFileMetadata = z.infer<typeof importFileMetadataSchema>;

/**
 * Type for import job.
 *
 * @public
 */
export type ImportJob = z.infer<typeof importJobSchema>;

/**
 * Type for currency code.
 *
 * @public
 */
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;

/**
 * Type for transaction status.
 *
 * @public
 */
export type TransactionStatus =
  (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];

/**
 * Type for transaction method.
 *
 * @public
 */
export type TransactionMethod =
  (typeof TRANSACTION_METHOD)[keyof typeof TRANSACTION_METHOD];

/**
 * Type for transaction category.
 *
 * @public
 */
export type TransactionCategory =
  (typeof TRANSACTION_CATEGORY)[keyof typeof TRANSACTION_CATEGORY];
