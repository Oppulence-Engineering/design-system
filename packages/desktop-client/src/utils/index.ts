/**
 * @module @oppulence/desktop-client/utils
 * @file Utility module exports for the desktop client package. Provides
 *   centralized access to all utility functions and classes.
 * @author Canvas Team
 * @since 1.0.0
 */

export * from "./constants";
export { CONSTANTS } from "./constants";
export * from "./error-handler";
export { ErrorHandler } from "./error-handler";
export * from "./logger";
// Re-export commonly used utilities for convenience
export { logger } from "./logger";
