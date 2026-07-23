/**
 * Shared design styles (§ shared styles) — pure. A named style library lives in
 * `document.meta.styles`; a node's `styleRef` points at one. The referenced style is the
 * base and the node's own `style` overrides it, so "edit the style once → every node that
 * uses it updates". Enables brand consistency across many invoice/report templates.
 */

import type { DocumentMeta } from "../document/document";
import type { JsonValue } from "../document/json";
import type { SceneNode } from "../document/nodes";
import type { NodeStyle } from "../document/styles";

export interface NamedStyle {
  id: string;
  name: string;
  category?: string;
  style: NodeStyle;
}

export type StyleLibrary = Record<string, NamedStyle>;

/**
 * Stable empty library. MUST be a shared frozen constant, never a fresh `{}` — this is
 * returned from a zustand selector (`useDocumentStore(s => stylesFromMeta(s.document.meta))`),
 * and a new object each call makes the snapshot change on every render → infinite re-render.
 */
const EMPTY_STYLE_LIBRARY: StyleLibrary = Object.freeze({});

/** Read the style library out of document meta (untyped JSON) into a typed map. */
export function stylesFromMeta(meta: DocumentMeta): StyleLibrary {
  const raw = (meta as Record<string, JsonValue | undefined>).styles;
  if (
    raw === undefined ||
    raw === null ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  )
    return EMPTY_STYLE_LIBRARY;
  return raw as unknown as StyleLibrary;
}

/** The effective style for a node: referenced shared style as base, node.style overrides. */
export function resolveNodeStyle(
  node: SceneNode,
  styles: StyleLibrary,
): NodeStyle {
  if (node.styleRef === undefined) return node.style;
  // Guard the direct index (styleRef bypasses the binding path-walker's proto guard):
  // `styles["__proto__"]` would read Object.prototype rather than a real named style.
  if (
    node.styleRef === "__proto__" ||
    node.styleRef === "constructor" ||
    node.styleRef === "prototype"
  )
    return node.style;
  const named = styles[node.styleRef];
  if (named === undefined || typeof named.style !== "object") return node.style;
  return { ...named.style, ...node.style };
}
