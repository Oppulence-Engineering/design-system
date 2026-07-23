/**
 * Tool system (§7) — Strategy pattern. Each tool owns pointer/keyboard behavior and
 * expresses its state machine through the session store's `gesture` union. Consumers
 * extend by passing custom tools; ids are plain strings branded at registration.
 */

import type { NodeId } from "../document/ids";
import type { SceneNode } from "../document/nodes";
import type { CanvasOperation } from "../operations/operations";
import type { Point } from "../viewport/geometry";

declare const ToolIdBrand: unique symbol;
export type ToolId = string & { readonly [ToolIdBrand]: "ToolId" };

/** Consumers author with plain strings; the registry brands them. */
export const toolId = (raw: string): ToolId => raw as ToolId;

export interface CanvasPointerEvent {
  /** Screen-space pointer position (relative to the canvas root). */
  screen: Point;
  /** Canvas-space pointer position. */
  canvas: Point;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  button: number;
  /** Node ids under the pointer, front-most first (from the rect cache). */
  hits: readonly NodeId[];
}

/** Everything a tool needs; injected by the renderer so tools stay framework-light. */
export interface ToolContext {
  apply: (
    ops: readonly CanvasOperation[],
    opts?: { coalesceKey?: string; gestureId?: string },
  ) => void;
  getNode: (id: NodeId) => SceneNode | undefined;
  screenToCanvas: (p: Point) => Point;
  hitTest: (p: Point) => readonly NodeId[];
  getSelection: () => readonly NodeId[];
  setSelection: (ids: readonly NodeId[]) => void;
  setGesture: (gesture: import("../store/session-store").Gesture) => void;
  getGesture: () => import("../store/session-store").Gesture;
  panBy: (dx: number, dy: number) => void;
  /** Canvas-space rect of a node (stored geometry for artboards, measured for children). */
  getNodeRect: (id: NodeId) => import("../viewport/geometry").Rect | null;
  /** Canvas rects of all top-level artboards (snap candidates). */
  getArtboardRects: () => {
    id: NodeId;
    rect: import("../viewport/geometry").Rect;
  }[];
  /** Ordered children of a node with their measured rects (for flow-reorder). */
  getChildRects: (
    parentId: NodeId,
  ) => { id: NodeId; rect: import("../viewport/geometry").Rect }[];
  setSnapGuides: (
    guides: readonly import("../store/session-store").SnapGuide[],
  ) => void;
  setDropIndicator: (
    indicator: import("../store/session-store").SessionState["dropIndicator"],
  ) => void;
  snappingEnabled: () => boolean;
  snapThreshold: () => number;
  /** Mint a fresh node id (from the provider's id factory). */
  createNodeId: () => NodeId;
  /** A sortKey that appends after the last child of a parent (null = root). */
  appendSortKey: (parentId: NodeId | null) => string;
  /** Switch the active tool (e.g. back to select after inserting). */
  setActiveTool: (id: ToolId) => void;
  /** True when the editor is not in write access — tools must not mutate. */
  readonly?: boolean;
}

export interface Tool {
  id: ToolId;
  /** CSS cursor for this tool (string or a function of context). */
  cursor: string | ((ctx: ToolContext) => string);
  onActivate?(ctx: ToolContext): void;
  onDeactivate?(ctx: ToolContext): void;
  onPointerDown?(e: CanvasPointerEvent, ctx: ToolContext): void;
  onPointerMove?(e: CanvasPointerEvent, ctx: ToolContext): void;
  onPointerUp?(e: CanvasPointerEvent, ctx: ToolContext): void;
  /** Return true if the key was handled. */
  onKeyDown?(e: KeyboardEvent, ctx: ToolContext): boolean;
}

/** Built-in tool ids. */
export const TOOL_SELECT = toolId("select");
export const TOOL_HAND = toolId("hand");
export const TOOL_FRAME = toolId("frame");
export const TOOL_TEXT = toolId("text");
export const TOOL_ELEMENT = toolId("element");
export const TOOL_COMPONENT = toolId("component");
