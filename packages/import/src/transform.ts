/**
 * @module @oppulence/import/transform
 * @file Transaction transformation utilities for converting import data.
 *
 *   This module provides functionality for transforming parsed transaction data
 *   into the format required for database storage, including categorization,
 *   normalization, and enrichment with metadata.
 * @author Canvas Team
 * @copyright 2024 Canvas
 */

import { createHash } from "node:crypto";
import { capitalCase } from "change-case";
import { TransformationError } from "./errors";
import type {
  ICategorizationService,
  ITransactionTransformer,
} from "./interfaces";
import {
  type ImportOptions,
  TRANSACTION_CATEGORY,
  TRANSACTION_METHOD,
  TRANSACTION_STATUS,
  type Transaction,
  type TransformedTransaction,
  transactionSchema,
  transformedTransactionSchema,
} from "./schemas";
import { AmountParser, DateParser } from "./utils";

/**
 * Default categorization thresholds.
 *
 * @private
 */
const CATEGORIZATION_THRESHOLDS = {
  /** Amount threshold for automatic income categorization */
  INCOME_THRESHOLD: 0,
  /** Confidence threshold for automatic categorization */
  CONFIDENCE_THRESHOLD: 0.8,
} as const;

/**
 * Transaction transformer implementation.
 *
 * Handles the transformation of raw transaction data into the format required
 * for database storage, including normalization, categorization, and metadata
 * enrichment.
 *
 * @example
 *   ```typescript
 *   const transformer = new TransactionTransformer(categorizationService);
 *   const transformed = transformer.transform(transaction, {
 *     inverted: false,
 *     skipCategorization: false
 *   });
 *   ```;
 *
 * @class TransactionTransformer
 * @implements {ITransactionTransformer}
 * @public
 */
export class TransactionTransformer implements ITransactionTransformer {
  /**
   * Date parser instance.
   *
   * @private
   */
  private readonly dateParser: DateParser;

  /**
   * Amount parser instance.
   *
   * @private
   */
  private readonly amountParser: AmountParser;

  /**
   * Categorization service.
   *
   * @private
   */
  private readonly categorizationService?: ICategorizationService;

  /**
   * Creates a new TransactionTransformer instance.
   *
   * @param {ICategorizationService} [categorizationService] - Optional
   *   categorization service
   */
  constructor(categorizationService?: ICategorizationService) {
    this.dateParser = new DateParser();
    this.amountParser = new AmountParser();
    this.categorizationService = categorizationService;
  }

  /**
   * Transforms a transaction for database storage.
   *
   * This method converts a parsed transaction into the format required for
   * database storage, including:
   *
   * - Generating a unique internal ID
   * - Normalizing date and amount formats
   * - Applying categorization logic
   * - Setting default metadata values
   *
   * @example
   *   ```typescript
   *   const transformed = transformer.transform(
   *     { date: '2024-01-15', amount: '1234.56', description: 'Payment' },
   *     { inverted: false }
   *   );
   *   ```;
   *
   * @param {Transaction} transaction - Transaction to transform
   * @param {ImportOptions} [options] - Transform options
   * @returns {TransformedTransaction} Transformed transaction
   * @throws {TransformationError} If transformation fails
   */
  public transform(
    transaction: Transaction,
    options?: ImportOptions,
  ): TransformedTransaction {
    try {
      // Validate input transaction
      const validatedTransaction = this.validateTransaction(transaction);

      // Parse and format the date
      const dateString = this.transformDate(validatedTransaction.date);
      if (!dateString) {
        throw new TransformationError(
          "Failed to parse transaction date",
          "date",
          validatedTransaction.date,
        );
      }
      const formattedDate = new Date(dateString);

      // Parse and format the amount
      const amount = this.transformAmount(
        validatedTransaction.amount.toString(),
        options?.inverted ?? false,
      );

      // Transform description
      const name = this.transformDescription(validatedTransaction.description);

      // Determine category
      const categorySlug = this.determineCategory(
        name,
        amount,
        !(options?.autoCategrize ?? true),
      );

      // Create transformed transaction
      const transformed: TransformedTransaction = {
        internal_id: this.generateInternalId({
          teamId: validatedTransaction.teamId,
          bankAccountId: validatedTransaction.bankAccountId,
          date: dateString,
          amount,
          description: validatedTransaction.description,
          currency: validatedTransaction.currency,
        }),
        team_id: validatedTransaction.teamId,
        bank_account_id: validatedTransaction.bankAccountId,
        status: TRANSACTION_STATUS.POSTED,
        method: TRANSACTION_METHOD.OTHER,
        date: formattedDate,
        amount,
        name,
        currency: validatedTransaction.currency.toUpperCase(),
        category_slug: categorySlug,
        manual: true,
        notified: true,
      };

      // Add optional fields to metadata if present
      if (
        validatedTransaction.reference ||
        validatedTransaction.notes ||
        validatedTransaction.tags?.length
      ) {
        transformed.metadata = {
          ...(validatedTransaction.reference && {
            reference: validatedTransaction.reference,
          }),
          ...(validatedTransaction.notes && {
            notes: validatedTransaction.notes,
          }),
          ...(validatedTransaction.tags?.length && {
            tags: validatedTransaction.tags,
          }),
        };
      }

      // Validate transformed transaction
      const validation = transformedTransactionSchema.safeParse(transformed);
      if (!validation.success) {
        throw new TransformationError(
          "Invalid transformed transaction",
          undefined,
          undefined,
          { validation: validation.error },
        );
      }

      return validation.data;
    } catch (error) {
      if (error instanceof TransformationError) {
        throw error;
      }
      throw new TransformationError(
        "Failed to transform transaction",
        undefined,
        undefined,
        { originalError: error, transaction },
      );
    }
  }

  /**
   * Batch transforms multiple transactions.
   *
   * Processes multiple transactions in a single operation, collecting errors
   * for failed transformations while continuing with valid ones.
   *
   * @example
   *   ```typescript
   *   const transformed = transformer.transformBatch(
   *     transactions,
   *     { inverted: false, skipCategorization: true }
   *   );
   *   ```;
   *
   * @param {Transaction[]} transactions - Transactions to transform
   * @param {ImportOptions} [options] - Transform options
   * @returns {TransformedTransaction[]} Successfully transformed transactions
   * @throws {TransformationError} If all transformations fail
   */
  public transformBatch(
    transactions: Transaction[],
    options?: ImportOptions,
  ): TransformedTransaction[] {
    const results: TransformedTransaction[] = [];
    const errors: Array<{ index: number; error: Error }> = [];

    transactions.forEach((transaction, index) => {
      try {
        const transformed = this.transform(transaction, options);
        results.push(transformed);
      } catch (error) {
        errors.push({
          index,
          error: error instanceof Error ? error : new Error("Unknown error"),
        });
      }
    });

    // If all transformations failed, throw an error
    if (results.length === 0 && errors.length > 0) {
      throw new TransformationError(
        `All ${errors.length} transactions failed to transform`,
        undefined,
        undefined,
        { errors, totalTransactions: transactions.length },
      );
    }

    // Log errors if any occurred but some succeeded
    if (errors.length > 0) {
      console.warn(
        `Failed to transform ${errors.length} of ${transactions.length} transactions`,
        errors,
      );
    }

    return results;
  }

  /**
   * Applies categorization to a transaction.
   *
   * Uses the categorization service if available to determine the appropriate
   * category for a transaction based on its description and amount.
   *
   * @example
   *   ```typescript
   *   const categorized = transformer.categorize(transaction);
   *   ```;
   *
   * @param {TransformedTransaction} transaction - Transaction to categorize
   * @returns {TransformedTransaction} Categorized transaction
   */
  public categorize(
    transaction: TransformedTransaction,
  ): TransformedTransaction {
    if (!this.categorizationService) {
      return transaction;
    }

    try {
      const category = this.categorizationService.categorize(
        transaction.name,
        transaction.amount,
      );

      if (category) {
        return {
          ...transaction,
          category_slug: category,
        };
      }
    } catch (error) {
      console.warn("Failed to categorize transaction:", error);
    }

    return transaction;
  }

  /**
   * Validates a transaction before transformation.
   *
   * @private
   * @param {unknown} transaction - Transaction to validate
   * @returns {Transaction} Validated transaction
   * @throws {TransformationError} If validation fails
   */
  private validateTransaction(transaction: unknown): Transaction {
    const validation = transactionSchema.safeParse(transaction);
    if (!validation.success) {
      throw new TransformationError(
        "Invalid transaction data",
        undefined,
        undefined,
        { validation: validation.error, transaction },
      );
    }
    return validation.data;
  }

  /**
   * Transforms a date string to ISO format.
   *
   * @private
   * @param {string} dateString - Date string to transform
   * @returns {string | undefined} ISO date string or undefined
   */
  private transformDate(dateString: string): string | undefined {
    return this.dateParser.parse(dateString);
  }

  /**
   * Transforms an amount string to a number.
   *
   * @private
   * @param {string} amountString - Amount string to transform
   * @param {boolean} inverted - Whether to invert the amount
   * @returns {number} Transformed amount
   */
  private transformAmount(amountString: string, inverted: boolean): number {
    return this.amountParser.parse(amountString, inverted);
  }

  /**
   * Transforms a description string.
   *
   * @private
   * @param {string} description - Description to transform
   * @returns {string} Transformed description
   */
  private transformDescription(description: string): string {
    // Normalize whitespace
    const normalized = description.trim().replace(/\s+/g, " ");

    // Apply title case for better readability
    return capitalCase(normalized);
  }

  /**
   * Determines the category for a transaction.
   *
   * @private
   * @param {string} description - Transaction description
   * @param {number} amount - Transaction amount
   * @param {boolean} skipCategorization - Whether to skip categorization
   * @returns {string | null} Category slug or null
   */
  private determineCategory(
    description: string,
    amount: number,
    skipCategorization: boolean,
  ): string | null {
    // Skip if requested
    if (skipCategorization) {
      return null;
    }

    // Use categorization service if available
    if (this.categorizationService) {
      const category = this.categorizationService.categorize(
        description,
        amount,
      );
      if (category) {
        return category;
      }
    }

    // Default categorization based on amount
    if (amount > CATEGORIZATION_THRESHOLDS.INCOME_THRESHOLD) {
      return TRANSACTION_CATEGORY.INCOME;
    }

    return null;
  }

  /**
   * Generates a DETERMINISTIC internal ID for an imported transaction.
   *
   * Re-importing the same statement row must produce the same id so the
   * (team_id, internal_id) unique constraint deduplicates it instead of
   * inserting a second copy. The id is therefore a hash of the stable,
   * content-defining fields rather than a random UUID (which made every
   * re-import a fresh, duplicate row).
   *
   * @private
   * @param fingerprint - Stable, content-defining fields of the transaction
   * @returns Deterministic internal ID scoped to the team
   */
  private generateInternalId(fingerprint: {
    teamId: string;
    bankAccountId: string;
    date: string;
    amount: number;
    description: string;
    currency: string;
  }): string {
    const key = [
      fingerprint.teamId,
      fingerprint.bankAccountId,
      fingerprint.date,
      fingerprint.amount,
      fingerprint.description,
      fingerprint.currency,
    ].join("|");
    const hash = createHash("sha256").update(key).digest("hex");
    return `${fingerprint.teamId}_${hash}`;
  }
}

// ============================================================================
// Exported Functions (for backward compatibility)
// ============================================================================

/**
 * Global transformer instance.
 *
 * @private
 */
const globalTransformer = new TransactionTransformer();

/**
 * Transforms a transaction for database storage.
 *
 * This function is a convenience wrapper around the TransactionTransformer
 * class for backward compatibility. It transforms a parsed transaction into the
 * format required for database storage.
 *
 * @deprecated Use TransactionTransformer class directly for new code
 * @example
 *   ```typescript
 *   const transformed = transform({
 *     transaction: {
 *       date: '2024-01-15',
 *       description: 'Payment from client',
 *       amount: '1234.56',
 *       teamId: 'team-123',
 *       bankAccountId: 'acc-456',
 *       currency: 'USD'
 *     },
 *     inverted: false
 *   });
 *   ```;
 *
 * @param {object} params - Transform parameters
 * @param {Transaction} params.transaction - Transaction to transform
 * @param {boolean} params.inverted - Whether to invert the amount
 * @returns {TransformedTransaction} Transformed transaction
 * @public
 */
export function transform({
  transaction,
  inverted,
}: {
  transaction: Transaction;
  inverted: boolean;
}): TransformedTransaction {
  return globalTransformer.transform(transaction, {
    inverted,
    skipDuplicates: false,
    autoCategrize: true,
    timezone: "UTC",
    batchSize: 1000,
  });
}
