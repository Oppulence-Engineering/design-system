/**
 * Canvas theming (§ theming). The chrome (selection, handles, marquee, snap guides,
 * grid, panels, comment pins) is driven by `--ic-*` CSS custom properties whose defaults
 * map to the design-system `--color-*` tokens — so an app that already ships the design
 * system themes the canvas automatically. `CanvasTheme` + `themeToCssVars` give an
 * explicit, programmatic override; consumers can equally set `--ic-*` in their own CSS.
 */

import type * as React from "react";

export interface CanvasTheme {
  /** Selection outlines, handles, marquee, active tool, drop indicator. */
  accent?: string;
  /** Translucent accent (marquee fill, selection tint). */
  accentFade?: string;
  /** The infinite-canvas background behind artboards. */
  canvasBackground?: string;
  /** Default artboard / panel surface color. */
  artboardBackground?: string;
  /** Borders and dividers. */
  border?: string;
  /** Muted / secondary text. */
  muted?: string;
  /** Error color (invalid nodes, lint errors). */
  error?: string;
  /** Snap-guide line color. */
  snap?: string;
  /** Dot-grid color. */
  gridColor?: string;
  /** Show the dot grid (default true). */
  showGrid?: boolean;
  /** Chrome font family. */
  fontFamily?: string;
  /** Selection handle size in px. */
  handleSize?: number;
}

/** Convert a theme to a `style` object of `--ic-*` custom properties. */
export function themeToCssVars(
  theme: CanvasTheme | undefined,
): React.CSSProperties {
  const vars: Record<string, string> = {};
  if (theme === undefined) return vars as React.CSSProperties;
  const set = (name: string, value: string | number | undefined) => {
    if (value !== undefined)
      vars[name] = typeof value === "number" ? String(value) : value;
  };
  set("--ic-accent", theme.accent);
  set("--ic-accent-fade", theme.accentFade);
  set("--ic-canvas-bg", theme.canvasBackground);
  set("--ic-artboard-bg", theme.artboardBackground);
  set("--ic-border", theme.border);
  set("--ic-muted", theme.muted);
  set("--ic-error", theme.error);
  set("--ic-snap", theme.snap);
  set("--ic-grid", theme.gridColor);
  set("--ic-font", theme.fontFamily);
  if (theme.handleSize !== undefined)
    vars["--ic-handle-size"] = `${theme.handleSize}px`;
  // Toggling the grid: switch the gradient's dot color to transparent.
  if (theme.showGrid === false) vars["--ic-grid"] = "transparent";
  return vars as React.CSSProperties;
}
