/* biome-ignore-all lint/complexity/noStaticOnlyClass: Static class is part of the existing public API. */
/**
 * @module @oppulence/desktop-client/utils/error-handler
 * @file Centralized error handling utilities for the desktop client. Provides
 *   consistent error handling, formatting, and recovery strategies.
 * @author Canvas Team
 * @since 1.0.0
 */

import { z } from "zod";
import type { DesktopClientError } from "../types";
import { DesktopClientErrorSchema } from "../types";
import { logger } from "./logger";

/**
 * Options for error handling behavior.
 *
 * @interface ErrorHandlerOptions
 */
export type ErrorHandlerOptions = {
  /** Whether to log the error */
  logError?: boolean;
  /** Whether to rethrow the error after handling */
  rethrow?: boolean;
  /** Custom error transformer */
  transformer?: (error: DesktopClientError) => DesktopClientError;
  /** Fallback value to return on error */
  fallback?: unknown;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
};

/**
 * Result type for operations that may fail. Implements the Result pattern for
 * better error handling.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 */
export type Result<T, E = DesktopClientError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Centralized error handler for the desktop client. Provides utilities for
 * consistent error handling, transformation, and recovery strategies.
 *
 * @example
 *   ```typescript
 *   import { ErrorHandler } from '@oppulence/desktop-client/utils/error-handler';
 *
 *   // Wrap operations that may fail
 *   const result = await ErrorHandler.wrap(async () => {
 *     return await riskyOperation();
 *   });
 *
 *   if (result.success) {
 *     console.log('Success:', result.data);
 *   } else {
 *     console.error('Failed:', result.error);
 *   }
 *
 *   // With retry logic
 *   const data = await ErrorHandler.withRetry(
 *     () => fetchData(),
 *     { maxRetries: 3, retryDelay: 1000 }
 *   );
 *   ```;
 *
 * @class ErrorHandler
 */
export class ErrorHandler {
  /**
   * Transforms any error into a DesktopClientError.
   *
   * @param {unknown} error - The error to transform
   * @param {string} code - Error code to use if not already a
   *   DesktopClientError
   * @param {Record<string, unknown>} context - Additional context information
   * @returns {DesktopClientError} The transformed error
   * @static
   */
  public static toDesktopClientError(
    error: unknown,
    code: DesktopClientError["code"] = "UNKNOWN_ERROR",
    context?: Record<string, unknown>,
  ): DesktopClientError {
    // If already a valid DesktopClientError, return it
    const parseResult = DesktopClientErrorSchema.safeParse(error);
    if (parseResult.success) {
      return parseResult.data;
    }

    // Handle standard Error objects
    if (error instanceof Error) {
      return {
        code,
        message: error.message,
        originalError: error,
        stack: error.stack,
        context,
      };
    }

    // Handle string errors
    if (typeof error === "string") {
      return {
        code,
        message: error,
        context,
      };
    }

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return {
        code: "UNKNOWN_ERROR",
        message: "Validation error",
        originalError: error,
        context: {
          ...context,
          validationErrors: error.issues,
        },
      };
    }

    // Handle unknown errors
    return {
      code,
      message: "An unknown error occurred",
      originalError: error,
      context,
    };
  }

  /**
   * Wraps an operation in error handling logic. Returns a Result type for
   * explicit error handling.
   *
   * @template T
   * @param {() => T | Promise<T>} operation - The operation to wrap
   * @param {ErrorHandlerOptions} options - Error handling options
   * @returns {Promise<Result<T>>} The result of the operation
   * @static
   */
  public static async wrap<T>(
    operation: () => T | Promise<T>,
    options: ErrorHandlerOptions = {},
  ): Promise<Result<T>> {
    const { logError = true, transformer } = options;

    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      let desktopError = ErrorHandler.toDesktopClientError(error);

      if (transformer) {
        desktopError = transformer(desktopError);
      }

      if (logError) {
        logger.error("Operation failed", {
          error: desktopError,
        });
      }

      return { success: false, error: desktopError };
    }
  }

  /**
   * Wraps an operation with retry logic.
   *
   * @template T
   * @param {() => T | Promise<T>} operation - The operation to retry
   * @param {ErrorHandlerOptions} options - Error handling options
   * @returns {Promise<T>} The result of the operation
   * @throws {DesktopClientError} If all retry attempts fail
   * @static
   */
  public static async withRetry<T>(
    operation: () => T | Promise<T>,
    options: ErrorHandlerOptions = {},
  ): Promise<T> {
    const { maxRetries = 3, retryDelay = 1000, logError = true } = options;

    let lastError: DesktopClientError | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();

        if (attempt > 1 && logError) {
          logger.info("Operation succeeded after retry", {
            attempt,
            maxRetries,
          });
        }

        return result;
      } catch (error) {
        lastError = ErrorHandler.toDesktopClientError(error);

        if (logError) {
          logger.warn(`Operation failed (attempt ${attempt}/${maxRetries})`, {
            error: lastError,
            attempt,
            maxRetries,
          });
        }

        if (attempt < maxRetries) {
          // Linear backoff: the delay grows by one step per attempt. Previously
          // labelled exponential, which is what RetryConstants.BACKOFF_MULTIPLIER
          // describes and not what this computes.
          await ErrorHandler.delay(retryDelay * attempt);
        }
      }
    }

    if (logError) {
      logger.error("All retry attempts failed", {
        error: lastError,
        maxRetries,
      });
    }

    /*
     * `lastError` is only set by a failed attempt, so a maxRetries of 0 or less
     * ran no attempts and threw `undefined` — a rejection a caller cannot
     * inspect, log, or match on.
     */
    throw (
      lastError ??
      ErrorHandler.toDesktopClientError(
        `withRetry ran no attempts: maxRetries was ${maxRetries}`,
        "UNKNOWN_ERROR",
        { maxRetries },
      )
    );
  }

  /**
   * Handles an error with a fallback value.
   *
   * @template T
   * @param {() => T | Promise<T>} operation - The operation that may fail
   * @param {T} fallback - The fallback value to use on error
   * @param {ErrorHandlerOptions} options - Error handling options
   * @returns {Promise<T>} The operation result or fallback value
   * @static
   */
  public static async withFallback<T>(
    operation: () => T | Promise<T>,
    fallback: T,
    options: ErrorHandlerOptions = {},
  ): Promise<T> {
    const result = await ErrorHandler.wrap(operation, options);

    if (result.success) {
      return result.data;
    }

    if (options.logError !== false) {
      logger.warn("Using fallback value due to error", {
        error: result.error,
        fallback,
      });
    }

    return fallback;
  }

  /**
   * Creates a circuit breaker for an operation. Prevents repeated calls to a
   * failing operation.
   *
   * @template T
   * @param {() => T | Promise<T>} operation - The operation to protect
   * @param {number} threshold - Number of failures before opening circuit
   * @param {number} timeout - Time in ms before attempting to close circuit
   * @returns {() => Promise<T>} The protected operation
   * @static
   */
  public static createCircuitBreaker<T>(
    operation: () => T | Promise<T>,
    threshold = 5,
    timeout = 60_000,
  ): () => Promise<T> {
    let failureCount = 0;
    let lastFailureTime = 0;
    let isOpen = false;

    return async () => {
      // Check if circuit should be reset
      if (isOpen && Date.now() - lastFailureTime > timeout) {
        isOpen = false;
        failureCount = 0;
        logger.info("Circuit breaker reset");
      }

      // If circuit is open, fail fast
      if (isOpen) {
        throw ErrorHandler.toDesktopClientError(
          "Circuit breaker is open",
          "UNKNOWN_ERROR",
          { failureCount, threshold },
        );
      }

      try {
        const result = await operation();

        // Reset on success
        if (failureCount > 0) {
          failureCount = 0;
          logger.info("Circuit breaker: operation recovered");
        }

        return result;
      } catch (error) {
        failureCount++;
        lastFailureTime = Date.now();

        if (failureCount >= threshold) {
          isOpen = true;
          logger.error("Circuit breaker opened", {
            failureCount,
            threshold,
            timeout,
          });
        }

        throw error;
      }
    };
  }

  /**
   * Utility function to delay execution.
   *
   * @private
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   * @static
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Checks if a Result is successful. Type guard for Result type.
   *
   * @template T
   * @param {Result<T>} result - The result to check
   * @returns {result is { success: true; data: T }} True if successful
   * @static
   */
  public static isSuccess<T>(
    result: Result<T>,
  ): result is { success: true; data: T } {
    return result.success === true;
  }

  /**
   * Checks if a Result is an error. Type guard for Result type.
   *
   * @template T
   * @param {Result<T>} result - The result to check
   * @returns {result is { success: false; error: DesktopClientError }} True if
   *   error
   * @static
   */
  public static isError<T>(
    result: Result<T>,
  ): result is { success: false; error: DesktopClientError } {
    return result.success === false;
  }

  /**
   * Maps a successful Result value.
   *
   * @template T
   * @template U
   * @param {Result<T>} result - The result to map
   * @param {(value: T) => U} fn - The mapping function
   * @returns {Result<U>} The mapped result
   * @static
   */
  public static map<T, U>(result: Result<T>, fn: (value: T) => U): Result<U> {
    if (ErrorHandler.isSuccess(result)) {
      return { success: true, data: fn(result.data) };
    }
    return result;
  }

  /**
   * Chains Result operations.
   *
   * @template T
   * @template U
   * @param {Result<T>} result - The result to chain
   * @param {(value: T) => Result<U>} fn - The chaining function
   * @returns {Result<U>} The chained result
   * @static
   */
  public static chain<T, U>(
    result: Result<T>,
    fn: (value: T) => Result<U>,
  ): Result<U> {
    if (ErrorHandler.isSuccess(result)) {
      return fn(result.data);
    }
    return result;
  }
}

/**
 * Global error handler for unhandled errors. Logs errors and provides a
 * consistent error response.
 *
 * @param {unknown} error - The unhandled error
 * @param {string} context - Context where the error occurred
 */
export function handleGlobalError(error: unknown, context: string): void {
  const desktopError = ErrorHandler.toDesktopClientError(
    error,
    "UNKNOWN_ERROR",
    { context },
  );

  logger.fatal("Unhandled error occurred", {
    error: desktopError,
    context,
  });

  // In a desktop app, you might want to show a user-friendly error dialog
  // or send error reports to a monitoring service
}
