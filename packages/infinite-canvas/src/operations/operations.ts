/**
 * Operation layer (§4). Operations are INTENT-ONLY and 100% JSON-serializable — this
 * is the wire/op-log format. Prev-values are NOT embedded; the store computes the
 * inverse against the live document at apply time (see `invert.ts`). Deletion of a
 * key is expressed with an explicit `unset` array, never `undefined` (which
 * `JSON.stringify` would silently drop, breaking undo across any JSON boundary).
 */

import type { BatchId, ClientId, NodeId } from "../document/ids";
import type { JsonValue } from "../document/json";
import type { SceneNode } from "../document/nodes";
import type { RichText } from "../document/rich-text";
import type { NodeStyle } from "../document/styles";

export interface InsertNodeOp {
  type: "insert-node";
  node: SceneNode;
}

export interface RemoveNodeOp {
  type: "remove-node";
  nodeId: NodeId;
}

export interface MoveNodeOp {
  type: "move-node";
  nodeId: NodeId;
  parentId: NodeId | null;
  sortKey: string;
}

export interface SetNodeGeometryOp {
  type: "set-node-geometry";
  nodeId: NodeId;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface SetTextOp {
  type: "set-text";
  nodeId: NodeId;
  text: string;
}

/** Set (or clear, with `null`) a text node's rich representation. Independent of `set-text`. */
export interface SetRichTextOp {
  type: "set-rich-text";
  nodeId: NodeId;
  rich: RichText | null;
}

export interface SetNodeFlagsOp {
  type: "set-node-flags";
  nodeId: NodeId;
  name?: string;
  visible?: boolean;
  locked?: boolean;
  clipsContent?: boolean;
  visibleWhen?: string;
  repeat?: string;
  repeatAs?: string;
  styleRef?: string;
}

export interface SetNodeAttrsOp {
  type: "set-node-attrs";
  nodeId: NodeId;
  set: Record<string, string>;
  unset: readonly string[];
}

export interface SetComponentPropsOp {
  type: "set-component-props";
  nodeId: NodeId;
  set: Record<string, JsonValue>;
  unset: readonly string[];
}

export interface SetNodeStyleOp {
  type: "set-node-style";
  nodeId: NodeId;
  set: Partial<NodeStyle>;
  unset: readonly (keyof NodeStyle)[];
}

export interface SetDocumentMetaOp {
  type: "set-document-meta";
  set: Record<string, JsonValue>;
  unset: readonly string[];
}

export interface RebalanceSortKeysOp {
  type: "rebalance-sort-keys";
  parentId: NodeId | null;
  keys: Record<string, string>; // nodeId -> new sortKey
}

export type CanvasOperation =
  | InsertNodeOp
  | RemoveNodeOp
  | MoveNodeOp
  | SetNodeGeometryOp
  | SetTextOp
  | SetRichTextOp
  | SetNodeFlagsOp
  | SetNodeAttrsOp
  | SetComponentPropsOp
  | SetNodeStyleOp
  | SetDocumentMetaOp
  | RebalanceSortKeysOp;

export type CanvasOperationType = CanvasOperation["type"];

/** Where a committed batch came from — the key to collab-safe undo. */
export type BatchOrigin = "local" | "local-undo" | "remote";

export interface OperationBatch {
  id: BatchId;
  origin: ClientId;
  ops: readonly CanvasOperation[];
  /** Batches with the same coalesceKey within one gesture/window merge into one undo entry. */
  coalesceKey?: string;
  timestamp: number;
}
