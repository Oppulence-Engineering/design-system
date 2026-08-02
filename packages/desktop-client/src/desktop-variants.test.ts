import { afterEach, describe, expect, it } from "vitest";

import {
  applyPlatformClasses,
  detectPlatform,
  getPlatformDisplayName,
} from "./desktop-variants";

type Globals = Record<string, unknown>;

const scope = globalThis as unknown as Globals;

const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const WINDOWS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const LINUX_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** Stands in for the webview globals, then puts everything back. */
function useEnvironment(options: {
  tauriGlobal?: "isTauri" | "__TAURI_INTERNALS__" | "__TAURI__" | null;
  userAgent?: string;
}) {
  // Always overridden: the runner supplies its own navigator, whose user agent
  // names no platform.
  const originalNavigator = scope["navigator"];
  scope["navigator"] = { userAgent: options.userAgent ?? MAC_UA };

  const touched: string[] = [];
  if (options.tauriGlobal) {
    scope[options.tauriGlobal] = true;
    touched.push(options.tauriGlobal);
  }

  return () => {
    scope["navigator"] = originalNavigator;
    for (const key of touched) {
      delete scope[key];
    }
  };
}

describe("detectPlatform", () => {
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    restore = undefined;
    for (const key of ["isTauri", "__TAURI_INTERNALS__", "__TAURI__"]) {
      delete scope[key];
    }
  });

  it("reports no platform outside a Tauri webview", () => {
    restore = useEnvironment({ tauriGlobal: null });

    expect(detectPlatform()).toBeNull();
    expect(getPlatformDisplayName()).toBe("web");
  });

  /*
   * `__TAURI__` is the Tauri v1 global. v2 defines it only when
   * `app.withGlobalTauri` is turned on, which is off by default, so on a stock
   * v2 app this reported "not desktop" while isDesktopApp() reported the
   * opposite — and applyPlatformClasses stripped the classes every variant in
   * this plugin depends on.
   */
  it("detects a Tauri v2 webview, which sets globalThis.isTauri", () => {
    restore = useEnvironment({ tauriGlobal: "isTauri", userAgent: MAC_UA });

    expect(detectPlatform()).toBe("darwin");
    expect(getPlatformDisplayName()).toBe("mac");
  });

  it("detects a webview exposing __TAURI_INTERNALS__", () => {
    restore = useEnvironment({ tauriGlobal: "__TAURI_INTERNALS__" });

    expect(detectPlatform()).toBe("darwin");
  });

  it("still detects the legacy __TAURI__ global", () => {
    restore = useEnvironment({ tauriGlobal: "__TAURI__" });

    expect(detectPlatform()).toBe("darwin");
  });

  describe("per platform", () => {
    const cases: ReadonlyArray<readonly [string, string, string, string]> = [
      ["macOS", MAC_UA, "darwin", "mac"],
      ["Windows", WINDOWS_UA, "win32", "windows"],
      ["Linux", LINUX_UA, "linux", "linux"],
    ];

    for (const [label, userAgent, platform, displayName] of cases) {
      it(`recognises ${label}`, () => {
        scope["navigator"] = { userAgent };
        scope["isTauri"] = true;

        expect(detectPlatform()).toBe(platform);
        expect(getPlatformDisplayName()).toBe(displayName);

        delete scope["navigator"];
        delete scope["isTauri"];
      });
    }
  });
});

describe("applyPlatformClasses", () => {
  const DESKTOP_CLASS = "desktop";

  afterEach(() => {
    delete scope["isTauri"];
    delete scope["navigator"];
    delete scope["document"];
  });

  /** The smallest classList the function actually uses. */
  function fakeDocument() {
    const classes = new Set<string>();
    return {
      element: {
        classList: {
          add: (name: string) => classes.add(name),
          remove: (name: string) => classes.delete(name),
          contains: (name: string) => classes.has(name),
        },
      },
      classes,
    };
  }

  it("adds the desktop and platform classes inside a Tauri v2 webview", () => {
    const { element, classes } = fakeDocument();
    scope["document"] = { documentElement: element };
    scope["navigator"] = { userAgent: WINDOWS_UA };
    scope["isTauri"] = true;

    applyPlatformClasses();

    expect(classes.has(DESKTOP_CLASS)).toBe(true);
    expect(classes.has("desktop-platform-win32")).toBe(true);
  });

  it("removes them outside a webview", () => {
    const { element, classes } = fakeDocument();
    classes.add(DESKTOP_CLASS);
    classes.add("desktop-platform-darwin");
    scope["document"] = { documentElement: element };
    scope["navigator"] = { userAgent: MAC_UA };

    applyPlatformClasses(true);

    expect(classes.has(DESKTOP_CLASS)).toBe(false);
    expect(classes.has("desktop-platform-darwin")).toBe(false);
  });
});
