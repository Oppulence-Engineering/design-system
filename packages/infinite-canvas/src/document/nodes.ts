/**
 * Scene-graph node types (§3). Discriminated union over `type`; every node lives in
 * a FLAT map keyed by id (CRDT-friendly — no nested children arrays) and carries its
 * `parentId` + fractional `sortKey`. Everything downstream types against this.
 */

import type { NodeId } from "./ids";
import type { JsonValue } from "./json";
import type { NodeStyle } from "./styles";

/** Curated safe HTML tag subset. Interactive/dangerous tags (input/iframe/script/base/meta/object/embed) are excluded from v1. */
export const HTML_TAGS = [
  "div",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "nav",
  "aside",
  "span",
  "p",
  "a",
  "img",
  "button",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
] as const;
export type HtmlTag = (typeof HTML_TAGS)[number];

/** Fields shared by every node. `name`/`visible`/`locked` are v1 schema (the layers panel needs them). */
export interface SceneNodeBase {
  id: NodeId;
  /** null = top-level artboard (a root FrameNode). */
  parentId: NodeId | null;
  /** Fractional index; sibling order is `(sortKey, id)` lexicographic. */
  sortKey: string;
  name: string;
  visible: boolean;
  locked: boolean;
  /** Reserved for a future version; always 0 in v1 (hit-testing is AABB-only). */
  rotation: number;
  /**
   * Data-binding directives (§ templates). Resolved only when a data context is present:
   * - `visibleWhen`: a binding path; the node (and subtree) is hidden if it resolves falsy.
   * - `repeat`: an array binding path; the node's subtree is cloned once per item, each
   *   scoped so `{{item.*}}` / `{{index}}` (or `{{repeatAs.*}}`) resolve to that element.
   * Empty/undefined = a normal, static node.
   */
  visibleWhen?: string;
  repeat?: string;
  repeatAs?: string;
}

/** A frame. At the root (`parentId === null`) it is an artboard with canvas-space geometry. */
export interface FrameNode extends SceneNodeBase {
  type: "frame";
  x: number;
  y: number;
  width: number;
  height: number;
  clipsContent: boolean;
  style: NodeStyle;
}

/** A raw HTML element (tag + sanitized attrs + style). */
export interface ElementNode extends SceneNodeBase {
  type: "element";
  tag: HtmlTag;
  /** Sanitized allowlist (no event handlers, scheme-checked url attrs). */
  attrs: Record<string, string>;
  style: NodeStyle;
}

/** A plain-text node (rich text is a future schema version). */
export interface TextNode extends SceneNodeBase {
  type: "text";
  text: string;
  style: NodeStyle;
}

/** An instance of a consumer-registered component. Leaf-only in v1 (no children/slots). */
export interface ComponentNode extends SceneNodeBase {
  type: "component";
  componentKey: string;
  props: Record<string, JsonValue>;
  style: NodeStyle;
}

/** A logical group (renders `display: contents`; no own geometry). */
export interface GroupNode extends SceneNodeBase {
  type: "group";
  style: NodeStyle;
}

export type SceneNode =
  | FrameNode
  | ElementNode
  | TextNode
  | ComponentNode
  | GroupNode;
export type SceneNodeType = SceneNode["type"];

export type NodeMap = Record<string, SceneNode>;

/** True when a node is a root artboard (a frame with no parent). */
export function isArtboard(node: SceneNode): node is FrameNode {
  return node.type === "frame" && node.parentId === null;
}

/** Exhaustiveness helper — a call to this in a `default` branch fails to compile if a node type is unhandled. */
export function assertNever(value: never, context = "value"): never {
  throw new Error(`Unexpected ${context}: ${JSON.stringify(value)}`);
}
