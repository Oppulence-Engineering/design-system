/* biome-ignore-all lint/suspicious/useIterableCallbackReturn: Legacy callback side effects are preserved without behavioral refactor. */
/**
 * @module @oppulence/desktop-client/core
 * @file Core Tauri API re-exports and utilities for the desktop client. This
 *   module provides a centralized interface to all Tauri APIs used throughout
 *   the application, with enhanced type safety and error handling.
 * @author Canvas Team
 * @since 1.0.0
 */

// Re-export Tauri APIs with enhanced documentation
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import {
  emit as tauriEmit,
  listen as tauriListen,
} from "@tauri-apps/api/event";
import { getCurrentWindow as tauriGetCurrentWindow } from "@tauri-apps/api/window";

// Re-export with proper handling
export { invoke } from "@tauri-apps/api/core";
export { emit, listen } from "@tauri-apps/api/event";
export { getCurrentWindow, Window } from "@tauri-apps/api/window";

// Fallback for openUrl when plugin is not available
export const openUrl = (url: string): Promise<void> => {
  // Fallback to browser behavior since plugin may not be available
  if (typeof window !== "undefined") {
    window.open(url, "_blank");
    return Promise.resolve();
  }

  throw new Error("Unable to open URL: not in browser environment");
};

import type { InvokeArgs } from "@tauri-apps/api/core";
import type {
  EventCallback,
  Event as TauriEvent,
  UnlistenFn,
} from "@tauri-apps/api/event";
// Import types for enhanced type safety
import type {
  Window as TauriWindow,
  Theme,
  WindowOptions,
} from "@tauri-apps/api/window";
import {
  type WindowDimensions,
  WindowDimensionsSchema,
  type WindowState,
  WindowStateSchema,
} from "./types";
import { ErrorHandler, logger } from "./utils";
import type { Result } from "./utils/error-handler";

/**
 * Enhanced window manager class providing additional functionality on top of
 * the Tauri Window API.
 *
 * @example
 *   ```typescript
 *   import { WindowManager } from '@oppulence/desktop-client/core';
 *
 *   const manager = WindowManager.getInstance();
 *
 *   // Get current window state
 *   const state = await manager.getWindowState();
 *   if (state.success) {
 *     console.log('Window is focused:', state.data.isFocused);
 *   }
 *
 *   // Monitor window state changes
 *   const unsubscribe = await manager.onWindowStateChange((state) => {
 *     console.log('Window state changed:', state);
 *   });
 *   ```;
 *
 * @class WindowManager
 */
export class WindowManager {
  private static instance: WindowManager;
  /** Makes each onWindowStateChange registration's listener keys unique. */
  private static stateListenerSequence = 0;
  private currentWindow: TauriWindow | null = null;
  private readonly stateListeners: Map<string, UnlistenFn> = new Map();
  private readonly logContext = logger.withCategory("WindowManager");

  /**
   * Gets the singleton WindowManager instance.
   *
   * @returns {WindowManager} The singleton instance
   * @static
   */
  public static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  /**
   * Gets the current Tauri window instance.
   *
   * @returns {TauriWindow} The current window
   */
  public getWindow(): TauriWindow {
    if (!this.currentWindow) {
      try {
        this.currentWindow = tauriGetCurrentWindow();
      } catch (_error) {
        throw new Error(
          "Failed to get current window: not in Tauri environment",
        );
      }
    }
    // biome-ignore lint/style/noNonNullAssertion: currentWindow is assigned in the if-block above or an error is thrown
    return this.currentWindow!;
  }

  /**
   * Gets the current window state.
   *
   * @async
   * @returns {Promise<Result<WindowState>>} The window state or error
   */
  public async getWindowState(): Promise<Result<WindowState>> {
    try {
      const window = this.getWindow();

      const [isFocused, isMinimized, isMaximized, isFullscreen, isVisible] =
        await Promise.all([
          window.isFocused(),
          window.isMinimized(),
          window.isMaximized(),
          window.isFullscreen(),
          window.isVisible(),
        ]);

      const state = WindowStateSchema.parse({
        isFocused,
        isMinimized,
        isMaximized,
        isFullscreen,
        isVisible,
      });

      return { success: true, data: state };
    } catch (error) {
      return {
        success: false,
        error: ErrorHandler.toDesktopClientError(
          error,
          "WINDOW_OPERATION_FAILED",
          { operation: "getWindowState" },
        ),
      };
    }
  }

  /**
   * Gets the current window dimensions and position.
   *
   * @async
   * @returns {Promise<Result<WindowDimensions>>} The window dimensions or error
   */
  public async getWindowDimensions(): Promise<Result<WindowDimensions>> {
    try {
      const window = this.getWindow();

      const [size, position] = await Promise.all([
        window.innerSize(),
        window.innerPosition(),
      ]);

      const dimensions = WindowDimensionsSchema.parse({
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
      });

      return { success: true, data: dimensions };
    } catch (error) {
      return {
        success: false,
        error: ErrorHandler.toDesktopClientError(
          error,
          "WINDOW_OPERATION_FAILED",
          { operation: "getWindowDimensions" },
        ),
      };
    }
  }

  /**
   * Centers the window on the screen.
   *
   * @async
   * @returns {Promise<Result<void>>} Success or error result
   */
  public async centerWindow(): Promise<Result<void>> {
    try {
      const window = this.getWindow();
      await window.center();

      this.logContext.debug("Window centered");
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: ErrorHandler.toDesktopClientError(
          error,
          "WINDOW_OPERATION_FAILED",
          { operation: "centerWindow" },
        ),
      };
    }
  }

  /**
   * Sets the window to fullscreen mode.
   *
   * @async
   * @param {boolean} fullscreen - Whether to enter or exit fullscreen
   * @returns {Promise<Result<void>>} Success or error result
   */
  public async setFullscreen(fullscreen: boolean): Promise<Result<void>> {
    try {
      const window = this.getWindow();
      await window.setFullscreen(fullscreen);

      this.logContext.debug("Fullscreen mode changed", { fullscreen });
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: ErrorHandler.toDesktopClientError(
          error,
          "WINDOW_OPERATION_FAILED",
          { operation: "setFullscreen", fullscreen },
        ),
      };
    }
  }

  /**
   * Minimizes the window.
   *
   * @async
   * @returns {Promise<Result<void>>} Success or error result
   */
  public async minimize(): Promise<Result<void>> {
    try {
      const window = this.getWindow();
      await window.minimize();

      this.logContext.debug("Window minimized");
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: ErrorHandler.toDesktopClientError(
          error,
          "WINDOW_OPERATION_FAILED",
          { operation: "minimize" },
        ),
      };
    }
  }

  /**
   * Maximizes the window.
   *
   * @async
   * @returns {Promise<Result<void>>} Success or error result
   */
  public async maximize(): Promise<Result<void>> {
    try {
      const window = this.getWindow();
      await window.maximize();

      this.logContext.debug("Window maximized");
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: ErrorHandler.toDesktopClientError(
          error,
          "WINDOW_OPERATION_FAILED",
          { operation: "maximize" },
        ),
      };
    }
  }

  /**
   * Toggles between maximize and restore.
   *
   * @async
   * @returns {Promise<Result<void>>} Success or error result
   */
  public async toggleMaximize(): Promise<Result<void>> {
    try {
      const window = this.getWindow();
      await window.toggleMaximize();

      this.logContext.debug("Window maximize toggled");
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: ErrorHandler.toDesktopClientError(
          error,
          "WINDOW_OPERATION_FAILED",
          { operation: "toggleMaximize" },
        ),
      };
    }
  }

  /**
   * Shows the window.
   *
   * @async
   * @returns {Promise<Result<void>>} Success or error result
   */
  public async show(): Promise<Result<void>> {
    try {
      const window = this.getWindow();
      await window.show();

      this.logContext.debug("Window shown");
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: ErrorHandler.toDesktopClientError(
          error,
          "WINDOW_OPERATION_FAILED",
          { operation: "show" },
        ),
      };
    }
  }

  /**
   * Hides the window.
   *
   * @async
   * @returns {Promise<Result<void>>} Success or error result
   */
  public async hide(): Promise<Result<void>> {
    try {
      const window = this.getWindow();
      await window.hide();

      this.logContext.debug("Window hidden");
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: ErrorHandler.toDesktopClientError(
          error,
          "WINDOW_OPERATION_FAILED",
          { operation: "hide" },
        ),
      };
    }
  }

  /**
   * Closes the window.
   *
   * @async
   * @returns {Promise<Result<void>>} Success or error result
   */
  public async close(): Promise<Result<void>> {
    try {
      const window = this.getWindow();
      await window.close();

      this.logContext.info("Window closed");
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: ErrorHandler.toDesktopClientError(
          error,
          "WINDOW_OPERATION_FAILED",
          { operation: "close" },
        ),
      };
    }
  }

  /**
   * Sets the window title.
   *
   * @async
   * @param {string} title - The new window title
   * @returns {Promise<Result<void>>} Success or error result
   */
  public async setTitle(title: string): Promise<Result<void>> {
    try {
      const window = this.getWindow();
      await window.setTitle(title);

      this.logContext.debug("Window title updated", { title });
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: ErrorHandler.toDesktopClientError(
          error,
          "WINDOW_OPERATION_FAILED",
          { operation: "setTitle", title },
        ),
      };
    }
  }

  /**
   * Registers a listener for window state changes.
   *
   * @async
   * @param {(state: WindowState) => void} callback - Callback for state changes
   * @returns {Promise<() => void>} Unsubscribe function
   */
  public async onWindowStateChange(
    callback: (state: WindowState) => void,
  ): Promise<() => void> {
    /*
     * The counter keeps this unique. `state-${Date.now()}` is shared by two
     * registrations in the same millisecond, and both write their unlisten
     * functions to `stateListeners` under the same keys — so the second
     * overwrote the first's entries and `cleanup()` could no longer reach them.
     * The first caller's own unsubscribe still worked, but a manager-wide
     * cleanup left five Tauri listeners attached.
     */
    WindowManager.stateListenerSequence += 1;
    const listenerId = `state-${Date.now()}-${WindowManager.stateListenerSequence}`;
    const listeners: UnlistenFn[] = [];

    try {
      const window = this.getWindow();

      // Listen to various window events
      const events = [
        "tauri://focus",
        "tauri://blur",
        "tauri://resize",
        "tauri://move",
        "tauri://close-requested",
      ];

      for (const event of events) {
        const unlisten = await window.listen(event, async () => {
          const stateResult = await this.getWindowState();
          if (stateResult.success) {
            callback(stateResult.data);
          }
        });
        listeners.push(unlisten);
      }

      // Store all listeners for cleanup
      listeners.forEach((unlisten, index) => {
        this.stateListeners.set(`${listenerId}-${index}`, unlisten);
      });

      this.logContext.debug("Window state listeners registered", {
        listenerId,
      });

      // Return cleanup function
      return () => {
        listeners.forEach((unlisten, index) => {
          unlisten();
          this.stateListeners.delete(`${listenerId}-${index}`);
        });
        this.logContext.debug("Window state listeners removed", { listenerId });
      };
    } catch (error) {
      // Clean up any registered listeners on error
      listeners.forEach((unlisten) => unlisten());

      this.logContext.error("Failed to register window state listeners", {
        error: ErrorHandler.toDesktopClientError(
          error,
          "EVENT_LISTENER_FAILED",
          { listenerId },
        ),
      });

      return () => {}; // No-op cleanup
    }
  }

  /** Cleans up all window resources. */
  public cleanup(): void {
    // Clean up all state listeners
    for (const [id, unlisten] of this.stateListeners.entries()) {
      unlisten();
      this.logContext.debug("Cleaned up listener", { id });
    }
    this.stateListeners.clear();

    this.currentWindow = null;
    this.logContext.info("Window manager cleaned up");
  }
}

/**
 * Enhanced URL opener with validation and error handling.
 *
 * @async
 * @example
 *   ```typescript
 *   import { openExternalUrl } from '@oppulence/desktop-client/core';
 *
 *   const result = await openExternalUrl('https://example.com');
 *   if (!result.success) {
 *     console.error('Failed to open URL:', result.error);
 *   }
 *   ```;
 *
 * @function openExternalUrl
 * @param {string} url - The URL to open
 * @returns {Promise<Result<void>>} Success or error result
 */
export async function openExternalUrl(url: string): Promise<Result<void>> {
  try {
    // Validate URL
    const urlObj = new URL(url);

    // Only allow safe protocols
    const allowedProtocols = ["http:", "https:", "mailto:", "tel:"];
    if (!allowedProtocols.includes(urlObj.protocol)) {
      return {
        success: false,
        error: {
          code: "UNKNOWN_ERROR",
          // The message used to name only HTTP and HTTPS, so a caller reading
          // it would not know mailto: and tel: were already permitted, and
          // could not tell which of its links this rule would reject.
          message: `Invalid URL protocol. Allowed protocols are ${allowedProtocols.join(", ")}.`,
          context: { url, protocol: urlObj.protocol, allowedProtocols },
        },
      };
    }

    await openUrl(url);

    logger.info("External URL opened", { url });
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: ErrorHandler.toDesktopClientError(error, "UNKNOWN_ERROR", { url }),
    };
  }
}

/**
 * Enhanced invoke function with type safety and error handling.
 *
 * @async
 * @example
 *   ```typescript
 *   import { invokeCommand } from '@oppulence/desktop-client/core';
 *
 *   interface UserData {
 *     id: string;
 *     name: string;
 *   }
 *
 *   const result = await invokeCommand<UserData>('get_user', { id: '123' });
 *   if (result.success) {
 *     console.log('User:', result.data.name);
 *   } else {
 *     console.error('Command failed:', result.error);
 *   }
 *   ```;
 *
 * @template T - The expected return type
 * @function invokeCommand
 * @param {string} cmd - The command to invoke
 * @param {InvokeArgs} args - The command arguments
 * @returns {Promise<Result<T>>} The command result or error
 */
export async function invokeCommand<T = unknown>(
  cmd: string,
  args?: InvokeArgs,
): Promise<Result<T>> {
  const stopTimer = logger.time(`Invoke command: ${cmd}`);

  try {
    const result = await tauriInvoke<T>(cmd, args || {});

    logger.debug("Command invoked successfully", { cmd, args });
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: ErrorHandler.toDesktopClientError(error, "TAURI_API_ERROR", {
        cmd,
        args,
      }),
    };
  } finally {
    stopTimer();
  }
}

/**
 * Creates an event emitter with type safety.
 *
 * @async
 * @example
 *   ```typescript
 *   import { emitTypedEvent } from '@oppulence/desktop-client/core';
 *
 *   interface UserEvent {
 *     userId: string;
 *     action: string;
 *   }
 *
 *   await emitTypedEvent<UserEvent>('user-action', {
 *     userId: '123',
 *     action: 'login'
 *   });
 *   ```;
 *
 * @template T - The event payload type
 * @function emitTypedEvent
 * @param {string} event - The event name
 * @param {T} payload - The event payload
 * @returns {Promise<Result<void>>} Success or error result
 */
export async function emitTypedEvent<T = unknown>(
  event: string,
  payload?: T,
): Promise<Result<void>> {
  try {
    await tauriEmit(event, payload ?? null);

    logger.debug("Event emitted", { event, payload });
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: ErrorHandler.toDesktopClientError(error, "TAURI_API_ERROR", {
        event,
        payload,
      }),
    };
  }
}

/**
 * Creates a typed event listener with error handling.
 *
 * @async
 * @example
 *   ```typescript
 *   import { listenTypedEvent } from '@oppulence/desktop-client/core';
 *
 *   interface UserEvent {
 *   userId: string;
 *   action: string;
 *   }
 *
 *   const unsubscribe = await listenTypedEvent<UserEvent>(
 *   'user-action',
 *   (event) => {
 *   console.log(`User ${event.userId} performed ${event.action}`);
 *   }
 *   );
 *
 *   // Later, clean up
 *   unsubscribe();
 *   ```
 *
 * @template T - The event payload type
 * @function listenTypedEvent
 * @param {string} event - The event name
 * @param {(payload: T) => void | Promise<void>} handler - The event handler
 * @returns {Promise<() => void>} Unsubscribe function
 */
export async function listenTypedEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void | Promise<void>,
): Promise<() => void> {
  try {
    const unlisten = await tauriListen<T>(event, async (e: TauriEvent<T>) => {
      try {
        await handler(e.payload);
      } catch (error) {
        logger.error("Event handler error", {
          event,
          error: ErrorHandler.toDesktopClientError(
            error,
            "EVENT_LISTENER_FAILED",
            { event },
          ),
        });
      }
    });

    logger.debug("Event listener registered", { event });
    return unlisten;
  } catch (error) {
    logger.error("Failed to register event listener", {
      event,
      error: ErrorHandler.toDesktopClientError(error, "EVENT_LISTENER_FAILED", {
        event,
      }),
    });

    return () => {}; // No-op cleanup
  }
}

// Export types for external use
export type {
  TauriWindow,
  WindowOptions,
  Theme,
  TauriEvent,
  EventCallback,
  UnlistenFn,
  InvokeArgs,
};
