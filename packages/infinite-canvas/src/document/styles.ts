/**
 * Typed CSS-subset style object (§3). Document content uses a typed, diffable,
 * mergeable style object rendered via `styleToCss` — NOT Tailwind classes (Tailwind
 * v4 cannot generate CSS for runtime-stored class strings) and NOT arbitrary inline
 * CSS (the inspector and the CRDT per-property merge both need typed values). An
 * escape hatch (`custom`) exists but is security-filtered at the sanitize boundary.
 */

export type Dimension =
  | number // interpreted as px
  | {
      unit: "px" | "%" | "rem" | "em" | "vw" | "vh" | "fr" | "auto";
      value: number;
    };

export interface BoxEdges {
  top?: Dimension;
  right?: Dimension;
  bottom?: Dimension;
  left?: Dimension;
}

export interface CornerRadii {
  topLeft?: number;
  topRight?: number;
  bottomRight?: number;
  bottomLeft?: number;
}

export type Fill =
  | { type: "solid"; color: string }
  | { type: "gradient"; css: string } // pre-validated gradient string (no url())
  | { type: "none" };

export interface BorderStyle {
  width?: number;
  style?: "solid" | "dashed" | "dotted" | "none";
  color?: string;
}

export interface ShadowStyle {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset?: boolean;
}

/**
 * `position` deliberately EXCLUDES `fixed`/`sticky` for document nodes — those let a
 * malicious collaborator paint over the host app chrome (overlay phishing). Root
 * artboards are positioned by the canvas itself; children are `static` (flow) or
 * `absolute` (freeform) only.
 */
export type NodePosition = "static" | "relative" | "absolute";

export interface NodeStyle {
  // layout
  display?:
    | "block"
    | "flex"
    | "grid"
    | "inline"
    | "inline-block"
    | "none"
    | "contents";
  position?: NodePosition;
  top?: Dimension;
  left?: Dimension;
  right?: Dimension;
  bottom?: Dimension;
  width?: Dimension;
  height?: Dimension;
  minWidth?: Dimension;
  maxWidth?: Dimension;
  minHeight?: Dimension;
  maxHeight?: Dimension;
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  flexWrap?: "nowrap" | "wrap" | "wrap-reverse";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly";
  gap?: Dimension;
  padding?: BoxEdges;
  margin?: BoxEdges;
  overflow?: "visible" | "hidden" | "scroll" | "auto";

  // appearance
  background?: Fill;
  borderRadius?: CornerRadii;
  border?: BorderStyle;
  opacity?: number;
  boxShadow?: readonly ShadowStyle[];

  // typography
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number | "normal";
  letterSpacing?: number;
  color?: string;
  textAlign?: "left" | "center" | "right" | "justify";

  /**
   * Escape hatch for CSS properties not modeled above. SECURITY-CRITICAL: raw
   * attacker-authored CSS. The sanitize boundary allow/deny-lists these (rejects
   * `position:fixed/sticky`, any `url()`-bearing value, `content`, `-*-binding`,
   * `@import`-shaped values) BEFORE they reach the DOM. Keys are plain CSS property
   * names; the un-flattener also rejects keys containing `.`.
   */
  custom?: Record<string, string>;
}

/** The style keys that hold compound objects (flattened one level deeper for CRDT merge). */
export const COMPOUND_STYLE_KEYS = [
  "padding",
  "margin",
  "borderRadius",
  "border",
] as const;
export type CompoundStyleKey = (typeof COMPOUND_STYLE_KEYS)[number];
