/**
 * @module @oppulence/desktop-client/utils/constants
 * @file Centralized constants for the desktop client package. Contains all
 *   magic numbers, configuration values, and static data used throughout the
 *   application.
 * @author Canvas Team
 * @since 1.0.0
 */

/**
 * Deep link protocol configuration.
 *
 * @namespace DeepLinkConstants
 */
export const DeepLinkConstants = {
  /** Default protocol scheme for deep links */
  PROTOCOL: "eigenn",
  /** Protocol separator */
  SEPARATOR: "://",
  /** Maximum URL length in characters */
  MAX_URL_LENGTH: 2048,
  /** Maximum path length in characters */
  MAX_PATH_LENGTH: 2048,
  /** Valid path characters regex pattern */
  VALID_PATH_PATTERN: /^[a-zA-Z0-9\-_/]*$/,
  /** Default navigation timeout in milliseconds */
  NAVIGATION_TIMEOUT: 5000,
} as const;

/**
 * Event system configuration.
 *
 * @namespace EventConstants
 */
export const EventConstants = {
  /** Event name for deep link navigation */
  DEEP_LINK_NAVIGATE: "deep-link-navigate",
  /** Event name for window state changes */
  WINDOW_STATE_CHANGE: "window-state-change",
  /** Event name for platform detection */
  PLATFORM_DETECTED: "platform-detected",
  /** Maximum number of event listeners per event */
  MAX_LISTENERS: 100,
  /** Event listener timeout in milliseconds */
  LISTENER_TIMEOUT: 30_000,
} as const;

/**
 * Platform-specific configuration.
 *
 * @namespace PlatformConstants
 */
export const PlatformConstants = {
  /** Supported platforms */
  SUPPORTED_PLATFORMS: ["darwin", "win32", "linux"] as const,
  /** Platform display names */
  DISPLAY_NAMES: {
    darwin: "mac",
    win32: "windows",
    linux: "linux",
  } as const,
  /** Platform-specific CSS class prefixes */
  CSS_PREFIXES: {
    DESKTOP: "desktop",
    PLATFORM: "desktop-platform",
  } as const,
} as const;

/**
 * Window management configuration.
 *
 * @namespace WindowConstants
 */
export const WindowConstants = {
  /** Minimum window width in pixels */
  MIN_WIDTH: 800,
  /** Minimum window height in pixels */
  MIN_HEIGHT: 600,
  /** Default window width in pixels */
  DEFAULT_WIDTH: 1200,
  /** Default window height in pixels */
  DEFAULT_HEIGHT: 800,
  /** Window resize debounce delay in milliseconds */
  RESIZE_DEBOUNCE: 100,
  /** Window state check interval in milliseconds */
  STATE_CHECK_INTERVAL: 1000,
} as const;

/**
 * Retry and timeout configuration.
 *
 * @namespace RetryConstants
 */
export const RetryConstants = {
  /** Default maximum retry attempts */
  DEFAULT_MAX_RETRIES: 3,
  /** Base retry delay in milliseconds */
  BASE_RETRY_DELAY: 1000,
  /** Maximum retry delay in milliseconds */
  MAX_RETRY_DELAY: 30_000,
  /** Exponential backoff multiplier */
  BACKOFF_MULTIPLIER: 2,
  /** Default operation timeout in milliseconds */
  DEFAULT_TIMEOUT: 5000,
} as const;

/**
 * Logging configuration.
 *
 * @namespace LogConstants
 */
export const LogConstants = {
  /** Default log level */
  DEFAULT_LOG_LEVEL: "info" as const,
  /** Maximum log message length */
  MAX_MESSAGE_LENGTH: 1000,
  /** Maximum metadata size in bytes */
  MAX_METADATA_SIZE: 10_240,
  /** Log rotation interval in milliseconds */
  ROTATION_INTERVAL: 86_400_000, // 24 hours
  /** Maximum log file size in bytes */
  MAX_FILE_SIZE: 10_485_760, // 10MB
} as const;

/**
 * Tailwind CSS plugin configuration.
 *
 * @namespace TailwindConstants
 */
export const TailwindConstants = {
  /** Default variant separator */
  DEFAULT_SEPARATOR: ":",
  /** Desktop variant name */
  DESKTOP_VARIANT: "desktop",
  /** Platform variant names */
  PLATFORM_VARIANTS: {
    MAC: "mac",
    WINDOWS: "windows",
    LINUX: "linux",
  } as const,
  /** HTML class attribute for desktop detection */
  HTML_DESKTOP_CLASS: "desktop",
  /** HTML class attribute prefix for platform detection */
  HTML_PLATFORM_PREFIX: "desktop-platform-",
} as const;

/**
 * Error codes used throughout the application.
 *
 * @namespace ErrorCodes
 */
export const ErrorCodes = {
  /** Platform detection failed */
  PLATFORM_DETECTION_FAILED: "PLATFORM_DETECTION_FAILED",
  /** Invalid deep link format */
  DEEP_LINK_INVALID: "DEEP_LINK_INVALID",
  /** Event listener registration failed */
  EVENT_LISTENER_FAILED: "EVENT_LISTENER_FAILED",
  /** Window operation failed */
  WINDOW_OPERATION_FAILED: "WINDOW_OPERATION_FAILED",
  /** Tauri API error */
  TAURI_API_ERROR: "TAURI_API_ERROR",
  /** Unknown or unexpected error */
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

/**
 * Circuit breaker configuration.
 *
 * @namespace CircuitBreakerConstants
 */
export const CircuitBreakerConstants = {
  /** Default failure threshold before opening circuit */
  DEFAULT_THRESHOLD: 5,
  /** Default timeout before attempting to close circuit (ms) */
  DEFAULT_TIMEOUT: 60_000,
  /** Half-open state test interval (ms) */
  HALF_OPEN_INTERVAL: 30_000,
  /** Maximum consecutive successes to close circuit */
  SUCCESS_THRESHOLD: 3,
} as const;

/**
 * Performance monitoring thresholds.
 *
 * @namespace PerformanceConstants
 */
export const PerformanceConstants = {
  /** Slow operation threshold in milliseconds */
  SLOW_OPERATION_THRESHOLD: 1000,
  /** Critical operation threshold in milliseconds */
  CRITICAL_OPERATION_THRESHOLD: 5000,
  /** Memory usage warning threshold in MB */
  MEMORY_WARNING_THRESHOLD: 500,
  /** Memory usage critical threshold in MB */
  MEMORY_CRITICAL_THRESHOLD: 1000,
} as const;

/**
 * Regular expression patterns used for validation.
 *
 * @namespace ValidationPatterns
 */
export const ValidationPatterns = {
  /**
   * Deep link URL pattern: a scheme, then "://".
   *
   * Matches DeepLinkUrlSchema rather than pinning the literal "eigenn", since
   * `deepLinkProtocol` is configurable and an app that sets its own would
   * otherwise fail a check written against this constant.
   */
  DEEP_LINK_URL: /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//,
  /** Valid path segment pattern */
  PATH_SEGMENT: /^[a-zA-Z0-9\-_]+$/,
  /** Semantic version pattern */
  SEMVER: /^\d+\.\d+\.\d+(-[a-zA-Z0-9\-.]+)?(\+[a-zA-Z0-9\-.]+)?$/,
  /** Email address pattern */
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  /** UUID v4 pattern */
  UUID_V4:
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const;

/**
 * The build mode, read defensively.
 *
 * This package is built for the browser and runs inside a Tauri webview, where
 * `process` does not exist. Destructuring `process.env` at module scope threw
 * `ReferenceError: process is not defined` on import — and because this module
 * is reached from every entry point, importing any part of the package failed
 * outright unless the host bundler happened to inject a `process` shim.
 */
const NODE_ENV =
  typeof process === "undefined" ? undefined : process.env?.["NODE_ENV"];

/**
 * Default configuration values.
 *
 * @namespace DefaultConfig
 */
export const DefaultConfig = {
  /** Enable debug mode by default */
  DEBUG: NODE_ENV === "development",
  /** Enable deep links by default */
  DEEP_LINKS_ENABLED: true,
  /** Enable platform detection by default */
  PLATFORM_DETECTION: true,
  /** Enable error reporting by default */
  ERROR_REPORTING: true,
  /** Enable performance monitoring by default */
  PERFORMANCE_MONITORING: NODE_ENV === "development",
} as const;

/**
 * Type alias for all constant namespaces. Provides type-safe access to all
 * constants.
 */
export type Constants = {
  DeepLink: typeof DeepLinkConstants;
  Event: typeof EventConstants;
  Platform: typeof PlatformConstants;
  Window: typeof WindowConstants;
  Retry: typeof RetryConstants;
  Log: typeof LogConstants;
  Tailwind: typeof TailwindConstants;
  Error: typeof ErrorCodes;
  CircuitBreaker: typeof CircuitBreakerConstants;
  Performance: typeof PerformanceConstants;
  Validation: typeof ValidationPatterns;
  Default: typeof DefaultConfig;
};

/**
 * Aggregated constants object for convenient import.
 *
 * @constant
 * @type {Constants}
 */
export const CONSTANTS: Constants = {
  DeepLink: DeepLinkConstants,
  Event: EventConstants,
  Platform: PlatformConstants,
  Window: WindowConstants,
  Retry: RetryConstants,
  Log: LogConstants,
  Tailwind: TailwindConstants,
  Error: ErrorCodes,
  CircuitBreaker: CircuitBreakerConstants,
  Performance: PerformanceConstants,
  Validation: ValidationPatterns,
  Default: DefaultConfig,
} as const;
