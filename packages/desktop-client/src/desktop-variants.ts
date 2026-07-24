/**
 * @module @oppulence/desktop-client/desktop-variants
 * @file Tailwind CSS plugin for desktop-specific styling variants. This plugin
 *   provides platform-specific CSS utilities that enable responsive design
 *   patterns for desktop applications across different operating systems.
 * @author Canvas Team
 * @since 1.0.0
 */

import plugin from "tailwindcss/plugin";
import {
  PLATFORM_DISPLAY_NAMES,
  type Platform,
  type PlatformDisplayName,
  type TailwindPluginConfig,
} from "./types";
import { CONSTANTS } from "./utils/constants";
import { logger } from "./utils/logger";

/**
 * Configuration for the desktop variants plugin.
 *
 * @extends {TailwindPluginConfig}
 * @interface DesktopVariantsConfig
 */
export interface DesktopVariantsConfig extends TailwindPluginConfig {
  /** Whether to log variant registration */
  debug?: boolean;
}

/**
 * Tailwind CSS plugin that adds desktop and platform-specific variants.
 *
 * This plugin enables conditional styling based on:
 *
 * - Desktop vs. web environment
 * - Specific operating systems (macOS, Windows, Linux)
 *
 * @example
 *   ```javascript
 *   // tailwind.config.js
 *   import desktopPlugin from '@oppulence/desktop-client/desktop-variants';
 *
 *   export default {
 *     plugins: [
 *       desktopPlugin({
 *         enableDesktopVariants: true,
 *         enablePlatformVariants: true,
 *         debug: process.env.NODE_ENV === 'development',
 *       })
 *     ]
 *   }
 *   ```;
 *
 * @example
 *   ```html
 *   <!-- Usage in components -->
 *   <div class="desktop:rounded-none">
 *     <!-- Rounded corners only in desktop app -->
 *   </div>
 *
 *   <div class="mac:font-sf-pro windows:font-segoe linux:font-ubuntu">
 *     <!-- Platform-specific fonts -->
 *   </div>
 *
 *   <button class="desktop:hover:scale-105">
 *     <!-- Different hover effects for desktop vs web -->
 *   </button>
 *   ```;
 */
const desktopPlugin = plugin.withOptions<Partial<DesktopVariantsConfig>>(
  (options: Partial<DesktopVariantsConfig> = {}) => {
    const config: DesktopVariantsConfig = {
      enableDesktopVariants: options.enableDesktopVariants ?? true,
      enablePlatformVariants: options.enablePlatformVariants ?? true,
      separator: options.separator ?? ":",
      debug: options.debug ?? false,
    };

    return ({
      addVariant,
      addUtilities,
    }: {
      addVariant: (name: string, selector: string) => void;
      addUtilities: (utilities: Record<string, Record<string, string>>) => void;
    }) => {
      const logContext = logger.withCategory("TailwindPlugin");

      try {
        // Add desktop variant
        if (config.enableDesktopVariants) {
          addVariant(
            "desktop",
            `html.${CONSTANTS.Tailwind.HTML_DESKTOP_CLASS} &`,
          );

          if (config.debug) {
            logContext.debug("Registered desktop variant");
          }
        }

        // Add platform-specific variants
        if (config.enablePlatformVariants) {
          const platformMap: Record<PlatformDisplayName, Platform> = {
            mac: "darwin",
            windows: "win32",
            linux: "linux",
          };

          Object.entries(platformMap).forEach(([displayName, platform]) => {
            addVariant(
              displayName,
              `html.${CONSTANTS.Tailwind.HTML_PLATFORM_PREFIX}${platform} &`,
            );

            if (config.debug) {
              logContext.debug("Registered platform variant", {
                displayName,
                platform,
              });
            }
          });
        }

        // Add utility classes for platform detection
        if (config.enableDesktopVariants || config.enablePlatformVariants) {
          addUtilities({
            ".platform-detector": {
              display: "none",
              content: '"web"',
            },
            [`html.${CONSTANTS.Tailwind.HTML_DESKTOP_CLASS} .platform-detector`]:
              {
                content: '"desktop"',
              },
            [`html.${CONSTANTS.Tailwind.HTML_PLATFORM_PREFIX}darwin .platform-detector`]:
              {
                content: '"mac"',
              },
            [`html.${CONSTANTS.Tailwind.HTML_PLATFORM_PREFIX}win32 .platform-detector`]:
              {
                content: '"windows"',
              },
            [`html.${CONSTANTS.Tailwind.HTML_PLATFORM_PREFIX}linux .platform-detector`]:
              {
                content: '"linux"',
              },
          });
        }

        logContext.info("Desktop variants plugin initialized", {
          enableDesktopVariants: config.enableDesktopVariants,
          enablePlatformVariants: config.enablePlatformVariants,
        });
      } catch (error) {
        logContext.error("Failed to initialize desktop variants plugin", {
          error,
        });
      }
    };
  },
);

/**
 * Helper function to detect the current platform in the browser. This can be
 * used to set the appropriate HTML classes dynamically.
 *
 * @example
 *   ```typescript
 *   import { detectPlatform } from '@oppulence/desktop-client/desktop-variants';
 *
 *   const platform = detectPlatform();
 *   if (platform) {
 *   document.documentElement.classList.add('desktop');
 *   document.documentElement.classList.add(`desktop-platform-${platform}`);
 *   }
 *   ```
 *
 * @function detectPlatform
 * @returns {Platform | null} The detected platform or null if not desktop
 */
export function detectPlatform(): Platform | null {
  // Check if running in Tauri desktop environment
  if (typeof window !== "undefined" && "__TAURI__" in window) {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes("mac") || userAgent.includes("darwin")) {
      return "darwin";
    }
    if (userAgent.includes("win")) {
      return "win32";
    }
    if (userAgent.includes("linux")) {
      return "linux";
    }
  }

  return null;
}

/**
 * Applies platform classes to the HTML element. Should be called early in the
 * application lifecycle.
 *
 * @example
 *   ```typescript
 *   import { applyPlatformClasses } from '@oppulence/desktop-client/desktop-variants';
 *
 *   // Apply platform classes on app initialization
 *   applyPlatformClasses();
 *
 *   // Or force reapplication
 *   applyPlatformClasses(true);
 *   ```;
 *
 * @function applyPlatformClasses
 * @param {boolean} force - Force detection even if classes already exist
 */
export function applyPlatformClasses(force = false): void {
  if (typeof document === "undefined") {
    logger.warn("applyPlatformClasses called outside browser environment");
    return;
  }

  const htmlElement = document.documentElement;

  // Check if classes are already applied
  if (
    !force &&
    htmlElement.classList.contains(CONSTANTS.Tailwind.HTML_DESKTOP_CLASS)
  ) {
    logger.debug("Platform classes already applied");
    return;
  }

  // Detect platform
  const platform = detectPlatform();

  if (platform) {
    // Add desktop class
    htmlElement.classList.add(CONSTANTS.Tailwind.HTML_DESKTOP_CLASS);

    // Add platform-specific class
    htmlElement.classList.add(
      `${CONSTANTS.Tailwind.HTML_PLATFORM_PREFIX}${platform}`,
    );

    logger.info("Platform classes applied", {
      desktop: true,
      platform,
      classes: [
        CONSTANTS.Tailwind.HTML_DESKTOP_CLASS,
        `${CONSTANTS.Tailwind.HTML_PLATFORM_PREFIX}${platform}`,
      ],
    });
  } else {
    // Remove desktop classes if not in desktop environment
    htmlElement.classList.remove(CONSTANTS.Tailwind.HTML_DESKTOP_CLASS);

    for (const platform of CONSTANTS.Platform.SUPPORTED_PLATFORMS) {
      htmlElement.classList.remove(
        `${CONSTANTS.Tailwind.HTML_PLATFORM_PREFIX}${platform}`,
      );
    }

    logger.info("Platform classes removed (web environment)");
  }
}

/**
 * Gets the current platform display name.
 *
 * @example
 *   ```typescript
 *   import { getPlatformDisplayName } from '@oppulence/desktop-client/desktop-variants';
 *
 *   const displayName = getPlatformDisplayName();
 *   console.log(`Running on: ${displayName}`); // "mac", "windows", "linux", or "web"
 *   ```
 *
 * @function getPlatformDisplayName
 * @returns {PlatformDisplayName | 'web'} The platform display name
 */
export function getPlatformDisplayName(): PlatformDisplayName | "web" {
  const platform = detectPlatform();
  return platform ? PLATFORM_DISPLAY_NAMES[platform] : "web";
}

// Export the plugin as default. Annotate via the public `plugin.withOptions`
// return type so declaration emit doesn't inline tailwindcss's internal
// (hashed, non-portable) types, which trips TS2742 under `tsc --declaration`.
export default desktopPlugin as ReturnType<typeof plugin.withOptions>;

// Export types for external use
export type { Platform, PlatformDisplayName } from "./types";
