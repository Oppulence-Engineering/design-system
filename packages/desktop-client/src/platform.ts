/**
 * @module @oppulence/desktop-client/platform
 * @file Platform detection and deep link management for the desktop client.
 *   Provides utilities for detecting the desktop environment, handling deep
 *   links, and managing platform-specific functionality.
 * @author Canvas Team
 * @since 1.0.0
 */

import { isTauri } from "@tauri-apps/api/core";
import type { Event as TauriEvent, UnlistenFn } from "@tauri-apps/api/event";
import { listen as tauriListen } from "@tauri-apps/api/event";

import {
  DEFAULT_CONFIG,
  type DeepLinkEvent,
  type DeepLinkHandler,
  DeepLinkPathSchema,
  type DeepLinkUrl,
  type DesktopClientConfig,
  type EventListenerOptions,
  type UnsubscribeFunction,
} from "./types";

import { CONSTANTS, ErrorHandler, logger, type Result } from "./utils";

/**
 * Internal state management for the platform module.
 *
 * @private
 */
class PlatformState {
  private static instance: PlatformState;
  private isDesktop: boolean | null = null;
  private readonly activeListeners: Map<string, UnlistenFn> = new Map();
  private config: DesktopClientConfig = DEFAULT_CONFIG;

  /**
   * Gets the singleton instance.
   *
   * @returns {PlatformState} The singleton instance
   */
  public static getInstance(): PlatformState {
    if (!PlatformState.instance) {
      PlatformState.instance = new PlatformState();
    }
    return PlatformState.instance;
  }

  /**
   * Checks and caches whether the app is running in desktop mode.
   *
   * @returns {boolean} True if running in desktop environment
   */
  public checkIsDesktop(): boolean {
    if (this.isDesktop === null) {
      this.isDesktop = isTauri();
      logger.debug("Desktop environment detected", {
        isDesktop: this.isDesktop,
      });
    }
    return this.isDesktop;
  }

  /**
   * Registers an event listener.
   *
   * @param {string} id - Unique identifier for the listener
   * @param {UnlistenFn} unlisten - The unlisten function
   */
  public registerListener(id: string, unlisten: UnlistenFn): void {
    // Clean up existing listener if present
    const existing = this.activeListeners.get(id);
    if (existing) {
      existing();
      logger.debug("Replaced existing listener", { id });
    }

    this.activeListeners.set(id, unlisten);
  }

  /**
   * Unregisters an event listener.
   *
   * @param {string} id - Unique identifier for the listener
   * @returns {boolean} True if listener was found and removed
   */
  public unregisterListener(id: string): boolean {
    const unlisten = this.activeListeners.get(id);
    if (unlisten) {
      unlisten();
      this.activeListeners.delete(id);
      return true;
    }
    return false;
  }

  /** Cleans up all active listeners. */
  public cleanup(): void {
    for (const [id, unlisten] of this.activeListeners.entries()) {
      unlisten();
      logger.debug("Cleaned up listener", { id });
    }
    this.activeListeners.clear();
  }

  /**
   * Updates the configuration.
   *
   * @param {Partial<DesktopClientConfig>} config - Configuration updates
   */
  public updateConfig(config: Partial<DesktopClientConfig>): void {
    this.config = { ...this.config, ...config };
    logger.configure({ minLevel: this.config.logLevel });
  }

  /**
   * Gets the current configuration.
   *
   * @returns {DesktopClientConfig} The current configuration
   */
  public getConfig(): DesktopClientConfig {
    return this.config;
  }
}

// Initialize platform state
const platformState = PlatformState.getInstance();

/**
 * Counter behind {@link nextListenerId}, so ids stay unique within a session.
 */
let listenerSequence = 0;

/**
 * Builds an id no other listener can share.
 *
 * Ids used to be `deep-link-${Date.now()}`, which two registrations in the same
 * millisecond both produce. `registerListener` tears down whatever already holds
 * an id, so the second registration silently unsubscribed the first, and the
 * first's unsubscribe function then removed the second's listener instead of its
 * own. Registering several handlers during start-up, or a double mount under
 * React strict mode, was enough to hit it.
 */
function nextListenerId(prefix: string): string {
  listenerSequence += 1;
  return `${prefix}-${Date.now()}-${listenerSequence}`;
}

/**
 * Checks if the application is running in a desktop environment. This function
 * caches the result for performance.
 *
 * @example
 *   ```typescript
 *   import { isDesktopApp } from '@oppulence/desktop-client/platform';
 *
 *   if (isDesktopApp()) {
 *     // Enable desktop-specific features
 *     console.log('Running in desktop mode');
 *   } else {
 *     // Fallback for web environment
 *     console.log('Running in web mode');
 *   }
 *   ```;
 *
 * @function isDesktopApp
 * @returns {boolean} True if running in a Tauri desktop environment, false
 *   otherwise
 */
export function isDesktopApp(): boolean {
  return platformState.checkIsDesktop();
}

/**
 * Configures the desktop client with custom settings.
 *
 * @example
 *   ```typescript
 *   import { configureDesktopClient } from '@oppulence/desktop-client/platform';
 *
 *   configureDesktopClient({
 *     debug: true,
 *     logLevel: 'debug',
 *     deepLinksEnabled: true,
 *     deepLinkProtocol: 'myapp',
 *   });
 *   ```;
 *
 * @function configureDesktopClient
 * @param {Partial<DesktopClientConfig>} config - Configuration options
 */
export function configureDesktopClient(
  config: Partial<DesktopClientConfig>,
): void {
  platformState.updateConfig(config);
  logger.info("Desktop client configured", { config });
}

/**
 * Parses a deep link URL into its components.
 *
 * @private
 * @param {string} url - The deep link URL to parse
 * @returns {Result<DeepLinkEvent>} The parsed deep link event or error
 */
function parseDeepLinkUrl(url: string): Result<DeepLinkEvent> {
  try {
    const config = platformState.getConfig();
    const protocol = `${config.deepLinkProtocol}://`;

    // The Rust shell emits the scheme-stripped path (e.g.
    // "api/auth/desktop/redeem/<token>"), while an external caller may pass a
    // full "<scheme>://..." URL. Accept both — strip the protocol only if it is
    // present. Rejecting bare paths silently dropped every shell-emitted deep
    // link, since the shell never includes the scheme.
    const withoutProtocol = url.startsWith(protocol)
      ? url.slice(protocol.length)
      : url;
    const [pathPart, queryPart] = withoutProtocol.split("?");

    // Validate and clean the path
    const pathResult = DeepLinkPathSchema.safeParse(pathPart);
    if (!pathResult.success) {
      return {
        success: false,
        error: {
          code: "DEEP_LINK_INVALID",
          message: "Invalid deep link path",
          context: { url, errors: pathResult.error.issues },
        },
      };
    }

    // Parse query parameters
    const params: Record<string, string> = {};
    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);
      searchParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    const event: DeepLinkEvent = {
      url: url as DeepLinkUrl,
      path: pathResult.data,
      params: Object.keys(params).length > 0 ? params : undefined,
      timestamp: new Date(),
    };

    return { success: true, data: event };
  } catch (error) {
    return {
      success: false,
      error: ErrorHandler.toDesktopClientError(error, "DEEP_LINK_INVALID", {
        url,
      }),
    };
  }
}

/**
 * Registers a handler for deep link navigation events. Deep links allow
 * external applications or URLs to navigate to specific sections within the
 * desktop application.
 *
 * @async
 * @example
 *   ```typescript
 *   import { listenForDeepLinks } from '@oppulence/desktop-client/platform';
 *
 *   // Register a deep link handler
 *   const unsubscribe = await listenForDeepLinks(
 *     async (event) => {
 *       console.log('Deep link received:', event.path);
 *
 *       // Navigate based on the path
 *       switch (event.path) {
 *         case 'dashboard':
 *           await navigateToDashboard();
 *           break;
 *         case 'settings':
 *           await navigateToSettings();
 *           break;
 *         default:
 *           console.warn('Unknown deep link path:', event.path);
 *       }
 *     },
 *     {
 *       debug: true,
 *       onError: (error) => console.error('Deep link error:', error)
 *     }
 *   );
 *
 *   // Later, clean up the listener
 *   unsubscribe();
 *   ```;
 *
 * @function listenForDeepLinks
 * @param {DeepLinkHandler} handler - Callback function to handle deep link
 *   events
 * @param {EventListenerOptions} options - Optional listener configuration
 * @returns {Promise<UnsubscribeFunction>} Function to unsubscribe from deep
 *   link events
 */
export async function listenForDeepLinks(
  handler: DeepLinkHandler,
  options: EventListenerOptions = {},
): Promise<UnsubscribeFunction> {
  const config = platformState.getConfig();
  const logContext = logger.withCategory("DeepLinks");

  // Check if running in desktop environment
  if (!isDesktopApp()) {
    logContext.info("Deep links are only available in desktop app");
    return () => {}; // No-op cleanup for non-desktop environments
  }

  // Check if deep links are enabled
  if (!config.deepLinksEnabled) {
    logContext.warn("Deep links are disabled in configuration");
    return () => {};
  }

  const listenerId = nextListenerId("deep-link");

  try {
    // Set up the event listener with error handling
    const unlisten = await tauriListen<string>(
      CONSTANTS.Event.DEEP_LINK_NAVIGATE,
      async (event: TauriEvent<string>) => {
        const stopTimer = options.debug
          ? logContext.time("Deep link processing")
          : undefined;

        try {
          if (options.debug) {
            logContext.debug("Deep link event received", {
              payload: event.payload,
            });
          }

          // Parse the deep link URL
          const parseResult = parseDeepLinkUrl(event.payload);

          if (!ErrorHandler.isSuccess(parseResult)) {
            throw parseResult.error;
          }

          // Call the handler with parsed event
          await handler(parseResult.data);

          if (options.debug) {
            logContext.debug("Deep link handled successfully", {
              path: parseResult.data.path,
            });
          }
        } catch (error) {
          const desktopError = ErrorHandler.toDesktopClientError(
            error,
            "EVENT_LISTENER_FAILED",
            { event: event.payload },
          );

          logContext.error("Failed to handle deep link", {
            error: desktopError,
          });

          // Call custom error handler if provided
          if (options.onError) {
            options.onError(desktopError);
          }
        } finally {
          stopTimer?.();
        }
      },
    );

    // Register the listener for cleanup
    platformState.registerListener(listenerId, unlisten);

    logContext.info("Deep link listener registered", { listenerId });

    // Return unsubscribe function
    return () => {
      const removed = platformState.unregisterListener(listenerId);
      if (removed) {
        logContext.debug("Deep link listener unregistered", { listenerId });
      }
    };
  } catch (error) {
    const desktopError = ErrorHandler.toDesktopClientError(
      error,
      "EVENT_LISTENER_FAILED",
      { listenerId },
    );

    logContext.error("Failed to register deep link listener", {
      error: desktopError,
    });

    // Call error handler if provided
    if (options.onError) {
      options.onError(desktopError);
    }

    return () => {}; // No-op cleanup on failure
  }
}

/**
 * Generates a properly formatted deep link URL. This function ensures the URL
 * follows the correct protocol and format, with proper path sanitization and
 * validation.
 *
 * @example
 *   ```typescript
 *   import { createDeepLink } from '@oppulence/desktop-client/platform';
 *
 *   // Simple deep links
 *   const dashboardLink = createDeepLink('dashboard');
 *   if (dashboardLink.success) {
 *     console.log(dashboardLink.data); // "eigenn://dashboard"
 *   }
 *
 *   // Deep links with nested paths
 *   const transactionLink = createDeepLink('transactions/123');
 *   if (transactionLink.success) {
 *     console.log(transactionLink.data); // "eigenn://transactions/123"
 *   }
 *
 *   // Deep links with query parameters
 *   const filteredLink = createDeepLink('transactions', {
 *     status: 'pending',
 *     limit: '10'
 *   });
 *   if (filteredLink.success) {
 *     console.log(filteredLink.data); // "eigenn://transactions?status=pending&limit=10"
 *   }
 *   ```;
 *
 * @function createDeepLink
 * @param {string} path - The navigation path (without leading slash)
 * @param {Record<string, string>} params - Optional query parameters
 * @returns {Result<DeepLinkUrl>} The formatted deep link URL or error
 */
export function createDeepLink(
  path: string,
  params?: Record<string, string>,
): Result<DeepLinkUrl> {
  try {
    const config = platformState.getConfig();

    // Validate and clean the path
    const pathResult = DeepLinkPathSchema.safeParse(path);
    if (!pathResult.success) {
      return {
        success: false,
        error: {
          code: "DEEP_LINK_INVALID",
          message: "Invalid deep link path",
          context: { path, errors: pathResult.error.issues },
        },
      };
    }

    // Build the URL
    let url = `${config.deepLinkProtocol}://${pathResult.data}`;

    // Add query parameters if provided
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    // Validate URL length
    if (url.length > CONSTANTS.DeepLink.MAX_URL_LENGTH) {
      return {
        success: false,
        error: {
          code: "DEEP_LINK_INVALID",
          message: `Deep link URL exceeds maximum length of ${CONSTANTS.DeepLink.MAX_URL_LENGTH} characters`,
          context: { url, length: url.length },
        },
      };
    }

    return { success: true, data: url as DeepLinkUrl };
  } catch (error) {
    return {
      success: false,
      error: ErrorHandler.toDesktopClientError(error, "DEEP_LINK_INVALID", {
        path,
        params,
      }),
    };
  }
}

/**
 * Opens a deep link URL in the desktop application. This triggers navigation to
 * the specified path.
 *
 * @async
 * @example
 *   ```typescript
 *   import { openDeepLink } from '@oppulence/desktop-client/platform';
 *
 *   // Navigate to a specific page
 *   const result = await openDeepLink('settings/profile');
 *   if (!result.success) {
 *     console.error('Navigation failed:', result.error);
 *   }
 *   ```;
 *
 * @function openDeepLink
 * @param {string} path - The navigation path
 * @param {Record<string, string>} params - Optional query parameters
 * @returns {Promise<Result<void>>} Success or error result
 */
export async function openDeepLink(
  path: string,
  params?: Record<string, string>,
): Promise<Result<void>> {
  const linkResult = createDeepLink(path, params);

  if (!ErrorHandler.isSuccess(linkResult)) {
    return linkResult;
  }

  try {
    // In a real implementation, this would trigger the navigation
    // For now, we'll emit an event that the app can listen to
    const { emit } = await import("@tauri-apps/api/event");
    await emit(CONSTANTS.Event.DEEP_LINK_NAVIGATE, linkResult.data);

    logger.info("Deep link opened", {
      url: linkResult.data,
      path,
      params,
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: ErrorHandler.toDesktopClientError(error, "DEEP_LINK_INVALID", {
        path,
        params,
      }),
    };
  }
}

/**
 * Cleans up all platform resources. Should be called when the application is
 * shutting down.
 *
 * @example
 *   ```typescript
 *   import { cleanupPlatform } from '@oppulence/desktop-client/platform';
 *
 *   // On application shutdown
 *   window.addEventListener('beforeunload', () => {
 *     cleanupPlatform();
 *   });
 *   ```;
 *
 * @function cleanupPlatform
 */
export function cleanupPlatform(): void {
  platformState.cleanup();
  logger.info("Platform resources cleaned up");
}

// Export types for external use
export type {
  DeepLinkEvent,
  DeepLinkHandler,
  UnsubscribeFunction,
} from "./types";
