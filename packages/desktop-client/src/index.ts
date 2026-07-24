/**
 * @module @oppulence/desktop-client
 * @file Main entry point for the @oppulence/desktop-client package. This module
 *   provides a comprehensive API for building desktop applications with Tauri,
 *   including platform detection, window management, deep linking, and
 *   platform-specific styling utilities.
 * @author Canvas Team
 * @since 1.0.0
 * @example
 *   ```typescript
 *   // Platform detection and configuration
 *   import { isDesktopApp, configureDesktopClient } from '@oppulence/desktop-client';
 *
 *   if (isDesktopApp()) {
 *     configureDesktopClient({
 *       debug: true,
 *       logLevel: 'debug',
 *       deepLinksEnabled: true,
 *     });
 *   }
 *
 *   // Deep link handling
 *   import { listenForDeepLinks, createDeepLink } from '@oppulence/desktop-client';
 *
 *   const unsubscribe = await listenForDeepLinks((event) => {
 *     console.log('Deep link received:', event.path);
 *   });
 *
 *   // Window management
 *   import { WindowManager } from '@oppulence/desktop-client';
 *
 *   const windowManager = WindowManager.getInstance();
 *   await windowManager.centerWindow();
 *
 *   // Platform-specific styling (Tailwind)
 *   import desktopPlugin from '@oppulence/desktop-client/desktop-variants';
 *
 *   // In tailwind.config.js
 *   plugins: [desktopPlugin()]
 *   ```;
 */

// ============================================================================
// Core Exports
// ============================================================================

/** Core Tauri API wrappers and utilities */
export {
  type EventCallback,
  emit,
  emitTypedEvent,
  getCurrentWindow,
  type InvokeArgs,
  // Tauri API re-exports
  invoke,
  invokeCommand,
  listen,
  listenTypedEvent,
  openExternalUrl,
  openUrl,
  type TauriEvent,
  // Types
  type TauriWindow,
  type Theme,
  type UnlistenFn,
  Window,
  // Enhanced utilities
  WindowManager,
  type WindowOptions,
} from "./core";

// ============================================================================
// Platform Exports
// ============================================================================

/** Platform detection and deep link management */
export {
  // Cleanup
  cleanupPlatform,
  configureDesktopClient,
  createDeepLink,
  type DeepLinkEvent,
  // Types
  type DeepLinkHandler,
  // Platform detection
  isDesktopApp,
  // Deep links
  listenForDeepLinks,
  openDeepLink,
  type UnsubscribeFunction,
} from "./platform";

// ============================================================================
// Desktop Variants Exports
// ============================================================================

/** Tailwind CSS plugin and platform styling utilities */
export {
  applyPlatformClasses,
  // Types
  type DesktopVariantsConfig,
  // Default export (the plugin)
  default as desktopPlugin,
  // Utility functions
  detectPlatform,
  getPlatformDisplayName,
  type Platform,
  type PlatformDisplayName,
} from "./desktop-variants";

// ============================================================================
// Type Exports
// ============================================================================

/** Comprehensive type definitions and schemas */
export {
  DEFAULT_CONFIG,
  DeepLinkEventSchema,
  type DeepLinkPath,
  DeepLinkPathSchema,
  type DeepLinkUrl,
  DeepLinkUrlSchema,
  type DesktopClientConfig,
  DesktopClientConfigSchema,
  type DesktopClientError,
  DesktopClientErrorSchema,
  type EventListenerOptions,
  EventListenerOptionsSchema,
  isDeepLinkPath,
  isDesktopClientError,
  // Type guards
  isPlatform,
  type LogEntry,
  LogEntrySchema,
  type LogLevel,
  LogLevelEnum,
  // Constants
  PLATFORM_DISPLAY_NAMES,
  PlatformDisplayNameEnum,
  // Enums and schemas
  PlatformEnum,
  // Types
  type PlatformInfo,
  PlatformInfoSchema,
  type TailwindPluginConfig,
  TailwindPluginConfigSchema,
  TailwindVariantMetadataSchema,
  UnsubscribeFunctionSchema,
  type WindowDimensions,
  WindowDimensionsSchema,
  type WindowState,
  WindowStateSchema,
} from "./types";

// ============================================================================
// Utility Exports
// ============================================================================

/** Utility functions and classes */
export {
  CircuitBreakerConstants,
  // Constants
  CONSTANTS,
  type Constants,
  DeepLinkConstants,
  DefaultConfig,
  ErrorCodes,
  // Error handling
  ErrorHandler,
  type ErrorHandlerOptions,
  EventConstants,
  handleGlobalError,
  LogConstants,
  // Logger
  Logger,
  type LoggerConfig,
  logger,
  PerformanceConstants,
  PlatformConstants,
  type Result,
  RetryConstants,
  TailwindConstants,
  ValidationPatterns,
  WindowConstants,
} from "./utils";

// ============================================================================
// Namespace Export
// ============================================================================

/** Namespace containing all exports for convenient access */
export * as DesktopClient from "./index";

// ============================================================================
// Version Information
// ============================================================================

/** Package version information */
export const VERSION = "1.0.0";

/** Package metadata */
export const METADATA = {
  name: "@oppulence/desktop-client",
  version: VERSION,
  description: "Desktop client utilities for Canvas applications",
  author: "Canvas Team",
  license: "MIT",
} as const;
