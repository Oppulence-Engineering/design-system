/**
 * @module @oppulence/desktop-client/types
 * @file Central type definitions and Zod schemas for the desktop client
 *   package. This module provides strongly-typed schemas for all data
 *   structures used throughout the desktop client application, ensuring type
 *   safety and runtime validation.
 * @author Canvas Team
 * @since 1.0.0
 */

import { z } from "zod";

// ============================================================================
// Platform Detection Types & Schemas
// ============================================================================

/**
 * Supported desktop platforms.
 *
 * @enum {string}
 * @readonly
 */
export const PlatformEnum = z.enum(["darwin", "win32", "linux"]);

/** Type representing a supported desktop platform. */
export type Platform = z.infer<typeof PlatformEnum>;

/**
 * User-friendly platform names mapping.
 *
 * @enum {string}
 * @readonly
 */
export const PlatformDisplayNameEnum = z.enum(["mac", "windows", "linux"]);

/** Type representing user-friendly platform names. */
export type PlatformDisplayName = z.infer<typeof PlatformDisplayNameEnum>;

/**
 * Schema for platform information object. Contains comprehensive details about
 * the current platform.
 */
export const PlatformInfoSchema = z.object({
  /** Raw platform identifier from the operating system */
  platform: PlatformEnum,
  /** User-friendly platform display name */
  displayName: PlatformDisplayNameEnum,
  /** Whether the application is running in a desktop environment */
  isDesktop: z.boolean(),
  /** Timestamp when platform was detected */
  detectedAt: z.date().optional(),
});

/** Type representing platform information. */
export type PlatformInfo = z.infer<typeof PlatformInfoSchema>;

// ============================================================================
// Deep Link Types & Schemas
// ============================================================================

/**
 * Schema for deep link path validation. Ensures paths are properly formatted
 * and safe.
 */
export const DeepLinkPathSchema = z
  .string()
  .min(0)
  .max(2048)
  /*
   * The unreserved characters of RFC 3986 (A-Z a-z 0-9 - . _ ~), plus "/" as
   * the segment separator and "%" for percent-encoding.
   *
   * "." and "%" used to be excluded, which rejected the very shape this
   * package's own deep links carry: a redeem link such as
   * "api/auth/desktop/redeem/<token>" fails the moment the token is a JWT,
   * because JWTs are dot-separated. Those links were reported as invalid paths
   * and dropped. Everything with meaning in a URL — "?", "#", ":", spaces —
   * is still refused, and the check below refuses traversal.
   */
  .regex(/^[a-zA-Z0-9\-._~%/]*$/, "Path contains invalid characters")
  /*
   * Allowing "." makes ".." expressible, and these paths are used to navigate.
   * A segment that is exactly ".." is refused so a deep link cannot climb out
   * of the route it was given.
   */
  .refine(
    (path) => !path.split("/").includes(".."),
    "Path must not contain a parent-directory segment",
  )
  .transform((path) => path.replace(/^\/+|\/+$/g, "")); // Trim leading/trailing slashes

/** Type representing a validated deep link path. */
export type DeepLinkPath = z.infer<typeof DeepLinkPathSchema>;

/**
 * Schema for deep link URL validation. Ensures URLs follow the correct protocol
 * and format.
 */
export const DeepLinkUrlSchema = z
  .string()
  /*
   * Any scheme of valid syntax, not the literal "eigenn". The protocol is a
   * documented configuration option — `deepLinkProtocol` on
   * DesktopClientConfigSchema — so pinning the schema to one product's scheme
   * meant createDeepLink produced URLs that this very schema rejected as soon
   * as an application configured its own. Scheme syntax is RFC 3986's:
   * a letter, then letters, digits, "+", "-" or ".".
   */
  .regex(
    /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//,
    "Deep link must start with a scheme followed by ://",
  )
  .max(2048);

/** Type representing a validated deep link URL. */
export type DeepLinkUrl = z.infer<typeof DeepLinkUrlSchema>;

/**
 * Schema for deep link event payload. Represents data received from deep link
 * navigation events.
 */
export const DeepLinkEventSchema = z.object({
  /** The full deep link URL */
  url: DeepLinkUrlSchema,
  /** The extracted path from the URL */
  path: DeepLinkPathSchema,
  /** Query parameters if present */
  params: z.record(z.string(), z.string()).optional(),
  /** Timestamp when the event was received */
  timestamp: z.date(),
});

/** Type representing a deep link event. */
export type DeepLinkEvent = z.infer<typeof DeepLinkEventSchema>;

/**
 * Deep link handler function signature.
 *
 * @callback DeepLinkHandler
 * @param {DeepLinkEvent} event - The deep link event data
 * @returns {void | Promise<void>}
 */
export type DeepLinkHandler = (event: DeepLinkEvent) => void | Promise<void>;

// ============================================================================
// Event Types & Schemas
// ============================================================================

/** Schema for generic event listener unsubscribe function. */
export const UnsubscribeFunctionSchema = z.union([
  z.function({ input: [], output: z.void() }),
  z.function({ input: [], output: z.promise(z.void()) }),
]);

/** Type representing an event unsubscribe function. */
export type UnsubscribeFunction = z.infer<typeof UnsubscribeFunctionSchema>;

/** Schema for event listener options. */
export const EventListenerOptionsSchema = z.object({
  /** Whether to prevent duplicate listeners */
  once: z.boolean().optional(),
  /** Custom error handler for the listener */
  onError: z.function({ input: [z.unknown()], output: z.void() }).optional(),
  /** Enable debug logging for this listener */
  debug: z.boolean().optional(),
});

/** Type representing event listener options. */
export type EventListenerOptions = z.infer<typeof EventListenerOptionsSchema>;

// ============================================================================
// Window Management Types & Schemas
// ============================================================================

/** Schema for window state. */
export const WindowStateSchema = z.object({
  /** Whether the window is currently focused */
  isFocused: z.boolean(),
  /** Whether the window is minimized */
  isMinimized: z.boolean(),
  /** Whether the window is maximized */
  isMaximized: z.boolean(),
  /** Whether the window is in fullscreen mode */
  isFullscreen: z.boolean(),
  /** Whether the window is visible */
  isVisible: z.boolean(),
});

/** Type representing window state. */
export type WindowState = z.infer<typeof WindowStateSchema>;

/** Schema for window dimensions. */
export const WindowDimensionsSchema = z.object({
  /** Window width in pixels */
  width: z.number().min(0),
  /** Window height in pixels */
  height: z.number().min(0),
  /** Window x position */
  x: z.number(),
  /** Window y position */
  y: z.number(),
});

/** Type representing window dimensions. */
export type WindowDimensions = z.infer<typeof WindowDimensionsSchema>;

// ============================================================================
// Tailwind Variant Types & Schemas
// ============================================================================

/** Schema for Tailwind plugin configuration. */
export const TailwindPluginConfigSchema = z.object({
  /** Whether to enable desktop variants */
  enableDesktopVariants: z.boolean().default(true),
  /** Whether to enable platform-specific variants */
  enablePlatformVariants: z.boolean().default(true),
  /** Custom prefix for generated classes */
  prefix: z.string().optional(),
  /** Custom separator for variant classes */
  separator: z.string().default(":"),
});

/** Type representing Tailwind plugin configuration. */
export type TailwindPluginConfig = z.infer<typeof TailwindPluginConfigSchema>;

/** Schema for Tailwind variant metadata. */
export const TailwindVariantMetadataSchema = z.object({
  /** The variant name */
  name: z.string(),
  /** CSS selector pattern */
  selector: z.string(),
  /** Description of the variant */
  description: z.string().optional(),
  /** Example usage */
  example: z.string().optional(),
});

/** Type representing Tailwind variant metadata. */
export type TailwindVariantMetadata = z.infer<
  typeof TailwindVariantMetadataSchema
>;

// ============================================================================
// Error Types & Schemas
// ============================================================================

/** Schema for desktop client errors. */
export const DesktopClientErrorSchema = z.object({
  /** Error code for categorization */
  code: z.enum([
    "PLATFORM_DETECTION_FAILED",
    "DEEP_LINK_INVALID",
    "EVENT_LISTENER_FAILED",
    "WINDOW_OPERATION_FAILED",
    "TAURI_API_ERROR",
    "UNKNOWN_ERROR",
  ]),
  /** Human-readable error message */
  message: z.string(),
  /** Original error if available */
  originalError: z.unknown().optional(),
  /** Stack trace for debugging */
  stack: z.string().optional(),
  /** Additional context data */
  context: z.record(z.string(), z.unknown()).optional(),
});

/** Type representing a desktop client error. */
export type DesktopClientError = z.infer<typeof DesktopClientErrorSchema>;

// ============================================================================
// Logger Types & Schemas
// ============================================================================

/**
 * Log levels for the application logger.
 *
 * @enum {string}
 * @readonly
 */
export const LogLevelEnum = z.enum(["debug", "info", "warn", "error", "fatal"]);

/** Type representing a log level. */
export type LogLevel = z.infer<typeof LogLevelEnum>;

/** Schema for log entry. */
export const LogEntrySchema = z.object({
  /** Log level */
  level: LogLevelEnum,
  /** Log message */
  message: z.string(),
  /** Timestamp of the log entry */
  timestamp: z.date(),
  /** Optional category/module name */
  category: z.string().optional(),
  /** Additional metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Type representing a log entry. */
export type LogEntry = z.infer<typeof LogEntrySchema>;

// ============================================================================
// Configuration Types & Schemas
// ============================================================================

/** Schema for desktop client configuration. */
export const DesktopClientConfigSchema = z.object({
  /** Enable debug mode */
  debug: z.boolean().default(false),
  /** Enable deep link support */
  deepLinksEnabled: z.boolean().default(true),
  /** Custom deep link protocol */
  deepLinkProtocol: z.string().default("eigenn"),
  /** Log level for the application */
  logLevel: LogLevelEnum.default("info"),
  /** Maximum number of retries for failed operations */
  maxRetries: z.number().min(0).max(10).default(3),
  /** Timeout for operations in milliseconds */
  timeout: z.number().min(0).default(5000),
});

/** Type representing desktop client configuration. */
export type DesktopClientConfig = z.infer<typeof DesktopClientConfigSchema>;

// ============================================================================
// Type Guards & Validation Utilities
// ============================================================================

/**
 * Type guard to check if a value is a valid Platform.
 *
 * @param {unknown} value - The value to check
 * @returns {value is Platform} True if the value is a valid Platform
 */
export function isPlatform(value: unknown): value is Platform {
  return PlatformEnum.safeParse(value).success;
}

/**
 * Type guard to check if a value is a valid DeepLinkPath.
 *
 * @param {unknown} value - The value to check
 * @returns {value is DeepLinkPath} True if the value is a valid DeepLinkPath
 */
export function isDeepLinkPath(value: unknown): value is DeepLinkPath {
  return DeepLinkPathSchema.safeParse(value).success;
}

/**
 * Type guard to check if a value is a valid DesktopClientError.
 *
 * @param {unknown} value - The value to check
 * @returns {value is DesktopClientError} True if the value is a valid
 *   DesktopClientError
 */
export function isDesktopClientError(
  value: unknown,
): value is DesktopClientError {
  return DesktopClientErrorSchema.safeParse(value).success;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Mapping of platform identifiers to display names.
 *
 * @constant
 * @readonly
 */
export const PLATFORM_DISPLAY_NAMES: Record<Platform, PlatformDisplayName> = {
  darwin: "mac",
  win32: "windows",
  linux: "linux",
} as const;

/**
 * Default desktop client configuration.
 *
 * @constant
 * @readonly
 */
export const DEFAULT_CONFIG: DesktopClientConfig =
  DesktopClientConfigSchema.parse({});
