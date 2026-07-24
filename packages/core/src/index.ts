// Logger

export * from "./collaboration";

export type { DebouncedFunction, DebounceOptions } from "./debounce";
// Debounce and throttle
export { debounce, throttle } from "./debounce";
export type { Attributes } from "./flattenAttributes";
// Attribute flattening
export {
  CIRCULAR_REFERENCE_SENTINEL,
  flattenAttributes,
  NULL_SENTINEL,
  primitiveValueOrflattenedAttributes,
  unflattenAttributes,
} from "./flattenAttributes";
export type { BatchingOptions, LogLevel } from "./logger";
export { createLogger, Logger } from "./logger";
// Re-export all schemas
export * from "./schemas";
export type { RetryOptions } from "./schemas/schemas";
export type {
  ShutdownHandlerOptions,
  ShutdownOptions,
} from "./shutdownManager";
// Shutdown management
export { ShutdownManager, shutdownManager } from "./shutdownManager";
// Singleton pattern
export { singleton } from "./singleton";
export type { Failure, Result, Success } from "./tryCatch";
// Error handling (Go-style Result types)
export {
  combineResults,
  flatMapResult,
  isFailure,
  isSuccess,
  mapResult,
  tryCatch,
  tryCatchSync,
  tryCatchWithAbort,
  tryCatchWithTimeout,
  unwrapResult,
  unwrapResultOr,
} from "./tryCatch";
// Re-export all utilities
export * from "./utils";
// Re-export retry utilities
export { calculateNextRetryDelay } from "./utils/retries";
export type { StructuredLogger } from "./utils/structuredLogger";
export { SimpleStructuredLogger } from "./utils/structuredLogger";
// Socket helpers
export * from "./zodMessageHandler";
export * from "./zodNamespace";
export * from "./zodSocket";
