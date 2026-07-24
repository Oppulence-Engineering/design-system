/**
 * @module @oppulence/import/mappings
 * @file Transaction mapping functions for CSV import processing.
 * @author Canvas Team
 * @copyright 2024 Canvas
 */

import {
  ValidationError as ImportValidationError,
  MappingError,
} from "./errors";
import type { ITransactionMapper } from "./interfaces";
import {
  type CsvRow,
  csvRowSchema,
  type FieldMapping,
  fieldMappingSchema,
  type ImportConfiguration,
  type RawTransaction,
  rawTransactionSchema,
} from "./schemas";

/**
 * Required fields for transaction mapping.
 *
 * @private
 */
const REQUIRED_FIELDS = ["date", "description", "amount"] as const;

/**
 * Optional fields for transaction mapping.
 *
 * @private
 */
const OPTIONAL_FIELDS = [
  "category",
  "tags",
  "notes",
  "reference",
  "balance",
] as const;

/**
 * Transaction mapper implementation.
 *
 * @class TransactionMapper
 * @implements {ITransactionMapper}
 * @public
 */
export class TransactionMapper implements ITransactionMapper {
  /**
   * Maps raw CSV data to transaction objects.
   *
   * @example
   *   ```typescript
   *   const mapper = new TransactionMapper();
   *   const transactions = mapper.mapTransactions(
   *     csvData,
   *     { date: 'Date', amount: 'Amount', description: 'Description' },
   *     { teamId: 'team-123', bankAccountId: 'acc-456', currency: 'USD' }
   *   );
   *   ```;
   *
   * @param {CsvRow[]} data - Raw CSV data rows
   * @param {FieldMapping} mappings - Field mapping configuration
   * @param {ImportConfiguration} config - Import configuration
   * @returns {RawTransaction[]} Array of mapped transactions
   * @throws {MappingError} If required fields are missing or mapping fails
   */
  public mapTransactions(
    data: CsvRow[],
    mappings: FieldMapping,
    config: ImportConfiguration,
  ): RawTransaction[] {
    // Validate inputs
    this.validateInputs(data, mappings, config);

    // Map each row to a transaction
    const transactions: RawTransaction[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    data.forEach((row, index) => {
      try {
        const transaction = this.mapRow(row, mappings, config);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        errors.push({
          row: index + 1,
          error:
            error instanceof Error ? error.message : "Unknown mapping error",
        });
      }
    });

    // If there were errors, throw an aggregated error
    if (errors.length > 0) {
      throw new MappingError(
        `Failed to map ${errors.length} transactions`,
        undefined,
        undefined,
        { errors, totalRows: data.length },
      );
    }

    return transactions;
  }

  /**
   * Validates field mappings against available fields.
   *
   * @example
   *   ```typescript
   *   const isValid = mapper.validateMappings(
   *     { date: 'Date', amount: 'Amount' },
   *     ['Date', 'Amount', 'Description']
   *   );
   *   ```;
   *
   * @param {FieldMapping} mappings - Field mappings to validate
   * @param {string[]} availableFields - Available fields in the data
   * @returns {boolean} True if mappings are valid
   * @throws {MappingError} If validation fails
   */
  public validateMappings(
    mappings: FieldMapping,
    availableFields: string[],
  ): boolean {
    // Validate mapping schema
    const validation = fieldMappingSchema.safeParse(mappings);
    if (!validation.success) {
      throw new MappingError(
        "Invalid mapping configuration",
        undefined,
        undefined,
        { validation: validation.error },
      );
    }

    // Check required fields
    const missingRequired = this.findMissingRequiredFields(mappings);
    if (missingRequired.length > 0) {
      throw new MappingError(
        "Missing required field mappings",
        missingRequired,
        undefined,
      );
    }

    // Check if mapped fields exist in available fields
    const invalidMappings = this.findInvalidMappings(mappings, availableFields);
    if (Object.keys(invalidMappings).length > 0) {
      throw new MappingError(
        "Invalid field mappings - fields not found in data",
        undefined,
        invalidMappings,
      );
    }

    return true;
  }

  /**
   * Gets the list of required fields for mapping.
   *
   * @example
   *   ```typescript
   *   const required = mapper.getRequiredFields();
   *   // ['date', 'description', 'amount']
   *   ```;
   *
   * @returns {string[]} Array of required field names
   */
  public getRequiredFields(): string[] {
    return [...REQUIRED_FIELDS];
  }

  /**
   * Gets the list of optional fields for mapping.
   *
   * @returns {string[]} Array of optional field names
   * @public
   */
  public getOptionalFields(): string[] {
    return [...OPTIONAL_FIELDS];
  }

  /**
   * Maps a single CSV row to a transaction.
   *
   * @private
   * @param {CsvRow} row - CSV row to map
   * @param {FieldMapping} mappings - Field mappings
   * @param {ImportConfiguration} config - Import configuration
   * @returns {RawTransaction | null} Mapped transaction or null if row is empty
   */
  private mapRow(
    row: CsvRow,
    mappings: FieldMapping,
    config: ImportConfiguration,
  ): RawTransaction | null {
    // Skip empty rows
    if (this.isEmptyRow(row)) {
      return null;
    }

    // Extract mapped values
    const mappedData = this.extractMappedValues(row, mappings);

    // Create transaction object
    const transaction: RawTransaction = {
      date: mappedData.date || "",
      description: mappedData.description || "",
      amount: mappedData.amount || "0",
      teamId: config.teamId,
      bankAccountId: config.bankAccountId,
      currency: config.currency,
    };

    // Validate the transaction
    const validation = rawTransactionSchema.safeParse(transaction);
    if (!validation.success) {
      throw new ImportValidationError(
        "Invalid transaction data",
        validation.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
          value: mappedData[e.path[0] as keyof typeof mappedData],
        })),
      );
    }

    return validation.data;
  }

  /**
   * Validates inputs for mapping.
   *
   * @private
   * @param {CsvRow[]} data - CSV data
   * @param {FieldMapping} mappings - Field mappings
   * @param {ImportConfiguration} config - Import configuration
   * @throws {MappingError} If validation fails
   */
  private validateInputs(
    data: CsvRow[],
    mappings: FieldMapping,
    config: ImportConfiguration,
  ): void {
    // Check for empty data
    if (!data || data.length === 0) {
      throw new MappingError("No data to map");
    }

    // Get available fields from first row
    const availableFields = Object.keys(data[0] || {});
    if (availableFields.length === 0) {
      throw new MappingError("No fields found in data");
    }

    // Validate mappings
    this.validateMappings(mappings, availableFields);

    // Validate configuration
    if (!(config.teamId && config.bankAccountId && config.currency)) {
      throw new MappingError(
        "Invalid configuration - missing required fields",
        ["teamId", "bankAccountId", "currency"].filter(
          (field) => !config[field as keyof ImportConfiguration],
        ),
      );
    }
  }

  /**
   * Finds missing required fields in mappings.
   *
   * @private
   * @param {FieldMapping} mappings - Field mappings
   * @returns {string[]} Array of missing field names
   */
  private findMissingRequiredFields(mappings: FieldMapping): string[] {
    return REQUIRED_FIELDS.filter((field) => !mappings[field]);
  }

  /**
   * Finds invalid field mappings.
   *
   * @private
   * @param {FieldMapping} mappings - Field mappings
   * @param {string[]} availableFields - Available fields
   * @returns {Record<string, string>} Invalid mappings
   */
  private findInvalidMappings(
    mappings: FieldMapping,
    availableFields: string[],
  ): Record<string, string> {
    const invalid: Record<string, string> = {};

    Object.entries(mappings).forEach(([key, value]) => {
      if (value && !availableFields.includes(value)) {
        invalid[key] = value;
      }
    });

    return invalid;
  }

  /**
   * Checks if a CSV row is empty.
   *
   * @private
   * @param {CsvRow} row - CSV row to check
   * @returns {boolean} True if row is empty
   */
  private isEmptyRow(row: CsvRow): boolean {
    return Object.values(row).every((value) => !value || value.trim() === "");
  }

  /**
   * Extracts mapped values from a CSV row.
   *
   * @private
   * @param {CsvRow} row - CSV row
   * @param {FieldMapping} mappings - Field mappings
   * @returns {Partial<Record<string, string>>} Extracted values
   */
  private extractMappedValues(
    row: CsvRow,
    mappings: FieldMapping,
  ): Partial<Record<string, string>> {
    const extracted: Partial<Record<string, string>> = {};

    Object.entries(mappings).forEach(([field, column]) => {
      if (column && row[column] !== undefined) {
        extracted[field] = row[column];
      }
    });

    return extracted;
  }
}

// ============================================================================
// Exported Functions (for backward compatibility)
// ============================================================================

/**
 * Global transaction mapper instance.
 *
 * @private
 */
const globalMapper = new TransactionMapper();

/**
 * Maps transaction data from CSV rows using field mappings.
 *
 * This function takes raw CSV data and maps it to transaction objects based on
 * the provided field mappings and configuration.
 *
 * @deprecated Use TransactionMapper class instead
 * @example
 *   ```typescript
 *   const transactions = mapTransactions(
 *     csvData,
 *     { date: 'Date', amount: 'Amount', description: 'Desc' },
 *     'USD',
 *     'team-123',
 *     'account-456'
 *   );
 *   ```;
 *
 * @param {Record<string, string>[]} data - Array of CSV row objects
 * @param {Record<string, string>} mappings - Field mapping configuration
 * @param {string} currency - Currency code for transactions
 * @param {string} teamId - Team identifier
 * @param {string} bankAccountId - Bank account identifier
 * @returns {RawTransaction[]} Array of mapped transactions
 * @public
 */
export const mapTransactions = (
  data: Record<string, string>[],
  mappings: Record<string, string>,
  currency: string,
  teamId: string,
  bankAccountId: string,
): RawTransaction[] => {
  try {
    // Validate CSV rows
    const validatedData = data.map((row) => csvRowSchema.parse(row));

    // Validate mappings
    const validatedMappings = fieldMappingSchema.parse(mappings);

    // Create configuration
    const config: ImportConfiguration = {
      teamId,
      bankAccountId,
      currency,
      mappings: validatedMappings,
    };

    // Use the mapper to process transactions
    return globalMapper.mapTransactions(
      validatedData,
      validatedMappings,
      config,
    );
  } catch (error) {
    if (error instanceof MappingError) {
      throw error;
    }

    throw new MappingError("Failed to map transactions", undefined, undefined, {
      originalError: error,
    });
  }
};

/**
 * Validates if the provided mappings are valid.
 *
 * @example
 *   ```typescript
 *   const isValid = validateMappings(
 *     { date: 'Date', amount: 'Amount' },
 *     ['Date', 'Amount', 'Description']
 *   );
 *   ```;
 *
 * @param {Record<string, string>} mappings - Field mappings to validate
 * @param {string[]} availableFields - Available fields in the data
 * @returns {boolean} True if mappings are valid
 * @public
 */
export function validateMappings(
  mappings: Record<string, string>,
  availableFields: string[],
): boolean {
  const validatedMappings = fieldMappingSchema.parse(mappings);
  return globalMapper.validateMappings(validatedMappings, availableFields);
}

/**
 * Gets the list of required fields for transaction mapping.
 *
 * @example
 *   ```typescript
 *   const required = getRequiredFields();
 *   // ['date', 'description', 'amount']
 *   ```;
 *
 * @returns {string[]} Array of required field names
 * @public
 */
export function getRequiredFields(): string[] {
  return globalMapper.getRequiredFields();
}

/**
 * Gets the list of optional fields for transaction mapping.
 *
 * @example
 *   ```typescript
 *   const optional = getOptionalFields();
 *   // ['category', 'tags', 'notes', 'reference', 'balance']
 *   ```;
 *
 * @returns {string[]} Array of optional field names
 * @public
 */
export function getOptionalFields(): string[] {
  return globalMapper.getOptionalFields();
}
