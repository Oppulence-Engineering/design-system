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
/*
 * The path is spelled out because `./utils` is ambiguous: a `utils.ts` file and
 * a `utils/` directory both sit here, and the resolver picks the file. This
 * line read as "re-export all utilities" while exporting only the three helpers
 * in utils.ts — memoize, deepMerge, omit, pick, sleep, retry, IntervalService,
 * formatDuration, hexToBuffer, getEnvVar and the rest of the directory never
 * reached the package entry point at all.
 */
export * from "./utils/index.ts";
export type { Deferred } from "./utils.ts";
export { assertExhaustive, promiseWithResolvers } from "./utils.ts";
// Re-export retry utilities
export { calculateNextRetryDelay } from "./utils/retries";
export type { StructuredLogger } from "./utils/structuredLogger";
export { SimpleStructuredLogger } from "./utils/structuredLogger";
// Socket helpers
export * from "./zodMessageHandler";
export * from "./zodNamespace";
export * from "./zodSocket";
