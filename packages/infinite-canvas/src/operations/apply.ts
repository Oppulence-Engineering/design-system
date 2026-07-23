/**
 * Pure operation application (§4). `applyBatch` returns `{ document, childrenIndex }`
 * as ONE immutable value built without mutating inputs — the batch-transactionality
 * contract: a throw mid-batch propagates before the caller commits, leaving prior
 * state intact. Structural sharing means only touched nodes get new references (cheap
 * per-node selectors); the childrenIndex is rebuilt once per batch only if the batch
 * was structural (insert/remove/move/rebalance), so property drags stay O(changed).
 */

import type { CanvasDocument, ChildrenIndex } from "../document/document";
import type { NodeId } from "../document/ids";
import type { JsonValue } from "../document/json";
import { withKey, withoutKey } from "../document/keys";
import type { NodeMap, SceneNode } from "../document/nodes";
import type { NodeStyle } from "../document/styles";
import { buildChildrenIndex } from "./children-index";
import type { CanvasOperation } from "./operations";

export interface CanvasState {
  document: CanvasDocument;
  childrenIndex: ChildrenIndex;
}

/** Build the initial derived state for a freshly-loaded document. */
export function createState(document: CanvasDocument): CanvasState {
  return { document, childrenIndex: buildChildrenIndex(document.nodes) };
}

const STRUCTURAL: ReadonlySet<CanvasOperation["type"]> = new Set([
  "insert-node",
  "remove-node",
  "move-node",
  "rebalance-sort-keys",
]);

/** Operations that mutate the node map (everything except document-meta). */
type NodeOp = Exclude<CanvasOperation, { type: "set-document-meta" }>;

/** Apply one operation to a node map, returning a new map (or the same ref if a no-op). */
function applyToNodes(nodes: NodeMap, op: NodeOp): NodeMap {
  switch (op.type) {
    case "insert-node":
      return withKey<SceneNode>(nodes, op.node.id, op.node);

    case "remove-node":
      if (nodes[op.nodeId] === undefined) return nodes; // defensive no-op
      return withoutKey(nodes, op.nodeId);

    case "move-node": {
      const node = nodes[op.nodeId];
      if (node === undefined) return nodes;
      return withKey<SceneNode>(nodes, op.nodeId, {
        ...node,
        parentId: op.parentId,
        sortKey: op.sortKey,
      });
    }

    case "set-node-geometry": {
      const node = nodes[op.nodeId];
      if (node === undefined || node.type !== "frame") return nodes;
      const next = { ...node };
      if (op.x !== undefined) next.x = op.x;
      if (op.y !== undefined) next.y = op.y;
      if (op.width !== undefined) next.width = op.width;
      if (op.height !== undefined) next.height = op.height;
      return withKey<SceneNode>(nodes, op.nodeId, next);
    }

    case "set-text": {
      const node = nodes[op.nodeId];
      if (node === undefined || node.type !== "text") return nodes;
      return withKey<SceneNode>(nodes, op.nodeId, { ...node, text: op.text });
    }

    case "set-node-flags": {
      const node = nodes[op.nodeId];
      if (node === undefined) return nodes;
      const next: SceneNode = { ...node };
      if (op.name !== undefined) next.name = op.name;
      if (op.visible !== undefined) next.visible = op.visible;
      if (op.locked !== undefined) next.locked = op.locked;
      if (op.clipsContent !== undefined && next.type === "frame")
        next.clipsContent = op.clipsContent;
      // Binding directives — "" clears the directive back to a static node.
      if (op.visibleWhen !== undefined)
        next.visibleWhen = op.visibleWhen === "" ? undefined : op.visibleWhen;
      if (op.repeat !== undefined)
        next.repeat = op.repeat === "" ? undefined : op.repeat;
      if (op.repeatAs !== undefined)
        next.repeatAs = op.repeatAs === "" ? undefined : op.repeatAs;
      if (op.styleRef !== undefined)
        next.styleRef = op.styleRef === "" ? undefined : op.styleRef;
      return withKey<SceneNode>(nodes, op.nodeId, next);
    }

    case "set-node-attrs": {
      const node = nodes[op.nodeId];
      if (node === undefined || node.type !== "element") return nodes;
      const attrs: Record<string, string> = { ...node.attrs };
      for (const key of op.unset) delete attrs[key];
      for (const key in op.set) {
        const value = op.set[key];
        if (value !== undefined) attrs[key] = value;
      }
      return withKey<SceneNode>(nodes, op.nodeId, { ...node, attrs });
    }

    case "set-component-props": {
      const node = nodes[op.nodeId];
      if (node === undefined || node.type !== "component") return nodes;
      const props: Record<string, JsonValue> = { ...node.props };
      for (const key of op.unset) delete props[key];
      for (const key in op.set) {
        const value = op.set[key];
        if (value !== undefined) props[key] = value;
      }
      return withKey<SceneNode>(nodes, op.nodeId, { ...node, props });
    }

    case "set-node-style": {
      const node = nodes[op.nodeId];
      if (node === undefined) return nodes;
      const style: NodeStyle = { ...node.style };
      for (const key of op.unset) delete style[key];
      Object.assign(style, op.set);
      return withKey<SceneNode>(nodes, op.nodeId, { ...node, style });
    }

    case "rebalance-sort-keys": {
      let next = nodes;
      for (const id in op.keys) {
        const node = next[id];
        const key = op.keys[id];
        if (node === undefined || key === undefined) continue;
        next = withKey<SceneNode>(next, id, { ...node, sortKey: key });
      }
      return next;
    }

    default:
      return exhaustive(op);
  }
}

function exhaustive(op: never): never {
  throw new Error(`Unknown operation: ${JSON.stringify(op)}`);
}

/**
 * Apply a batch of operations to state. Rebuilds the childrenIndex once at the end
 * only if any op was structural (else the previous index reference is preserved). The
 * new document/childrenIndex are produced without mutating the inputs.
 */
export function applyBatch(
  state: CanvasState,
  ops: readonly CanvasOperation[],
): CanvasState {
  if (ops.length === 0) return state;

  let nodes = state.document.nodes;
  let structural = false;
  let metaChanged = false;
  let meta = state.document.meta;

  for (const op of ops) {
    if (op.type === "set-document-meta") {
      const nextMeta = { ...meta };
      for (const key of op.unset) delete nextMeta[key];
      for (const key in op.set) {
        const value = op.set[key];
        if (value !== undefined) nextMeta[key] = value;
      }
      meta = nextMeta;
      metaChanged = true;
      continue;
    }
    const nextNodes = applyToNodes(nodes, op);
    if (nextNodes !== nodes) {
      nodes = nextNodes;
      if (STRUCTURAL.has(op.type)) structural = true;
    }
  }

  const nodesChanged = nodes !== state.document.nodes;
  if (!nodesChanged && !metaChanged) return state; // fully no-op batch

  const document: CanvasDocument = { ...state.document, nodes, meta };
  const childrenIndex = structural
    ? buildChildrenIndex(nodes)
    : state.childrenIndex;
  return { document, childrenIndex };
}

/** Convenience: read a node from state. */
export function stateNode(
  state: CanvasState,
  id: NodeId,
): SceneNode | undefined {
  return state.document.nodes[id];
}
