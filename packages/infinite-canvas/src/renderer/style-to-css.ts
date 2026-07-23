/**
 * Pure `NodeStyle` → `React.CSSProperties` compiler (§3/§6). Also the CSS security gate
 * for `style.custom` — this is NOT a throwaway; it is where the sanitized custom CSS is
 * emitted. Kept pure so it is unit-testable without the DOM.
 */

import type * as React from "react";
import { isSafeCustomCss } from "../document/sanitize";
import type {
  BoxEdges,
  Dimension,
  Fill,
  NodeStyle,
  ShadowStyle,
} from "../document/styles";

function dim(value: Dimension | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return `${value}px`;
  if (value.unit === "auto") return "auto";
  return `${value.value}${value.unit}`;
}

function boxEdges(edges: BoxEdges | undefined): string | undefined {
  if (edges === undefined) return undefined;
  const t = dim(edges.top) ?? "0";
  const r = dim(edges.right) ?? "0";
  const b = dim(edges.bottom) ?? "0";
  const l = dim(edges.left) ?? "0";
  return `${t} ${r} ${b} ${l}`;
}

function fillToCss(fill: Fill | undefined): string | undefined {
  if (fill === undefined) return undefined;
  switch (fill.type) {
    case "solid":
      return fill.color;
    case "gradient":
      return fill.css;
    case "none":
      return "transparent";
    default:
      return undefined;
  }
}

function shadowToCss(
  shadows: readonly ShadowStyle[] | undefined,
): string | undefined {
  if (shadows === undefined || shadows.length === 0) return undefined;
  return shadows
    .map(
      (s) =>
        `${s.inset === true ? "inset " : ""}${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.spread}px ${s.color}`,
    )
    .join(", ");
}

/** Compile a NodeStyle to inline CSS. Unsafe custom entries are dropped defensively. */
export function styleToCss(style: NodeStyle): React.CSSProperties {
  const css: Record<string, string | number> = {};
  const set = (key: string, value: string | number | undefined) => {
    if (value !== undefined) css[key] = value;
  };

  set("display", style.display);
  set("position", style.position);
  set("top", dim(style.top));
  set("left", dim(style.left));
  set("right", dim(style.right));
  set("bottom", dim(style.bottom));
  set("width", dim(style.width));
  set("height", dim(style.height));
  set("minWidth", dim(style.minWidth));
  set("maxWidth", dim(style.maxWidth));
  set("minHeight", dim(style.minHeight));
  set("maxHeight", dim(style.maxHeight));
  set("flexDirection", style.flexDirection);
  set("flexWrap", style.flexWrap);
  set("alignItems", style.alignItems);
  set("justifyContent", style.justifyContent);
  set("gap", dim(style.gap));
  set("padding", boxEdges(style.padding));
  set("margin", boxEdges(style.margin));
  set("overflow", style.overflow);
  set("background", fillToCss(style.background));
  set("opacity", style.opacity);
  set("boxShadow", shadowToCss(style.boxShadow));
  set("fontFamily", style.fontFamily);
  set(
    "fontSize",
    style.fontSize !== undefined ? `${style.fontSize}px` : undefined,
  );
  set("fontWeight", style.fontWeight);
  set("lineHeight", style.lineHeight);
  set(
    "letterSpacing",
    style.letterSpacing !== undefined ? `${style.letterSpacing}px` : undefined,
  );
  set("color", style.color);
  set("textAlign", style.textAlign);

  if (style.border !== undefined) {
    const {
      width = 0,
      style: bs = "solid",
      color = "currentColor",
    } = style.border;
    set("border", `${width}px ${bs} ${color}`);
  }
  if (style.borderRadius !== undefined) {
    const r = style.borderRadius;
    set(
      "borderRadius",
      `${r.topLeft ?? 0}px ${r.topRight ?? 0}px ${r.bottomRight ?? 0}px ${r.bottomLeft ?? 0}px`,
    );
  }

  // Custom escape hatch — re-validated here (defense in depth).
  if (style.custom !== undefined) {
    for (const prop in style.custom) {
      const value = style.custom[prop];
      if (value !== undefined && isSafeCustomCss(prop, value))
        css[prop] = value;
    }
  }

  return css as React.CSSProperties;
}
