/**
 * Inverse computation (§4). The store computes a batch's inverse against the LIVE
 * document at apply time and stores that inverse in the undo stack — call sites never
 * capture prev-values (a whole bug class removed). The inverse of a batch is the
 * reverse-ordered inverse of each op, each computed against the state immediately
 * before that op (ops within a batch can depend on each other), so we thread state.
 */

import type { JsonValue } from "../document/json";
import type { NodeStyle } from "../document/styles";
import { applyBatch, type CanvasState } from "./apply";
import type { CanvasOperation } from "./operations";

/** Inverse of a `{ set, unset }` patch over a plain record, given the record before the op. */
function invertRecordPatch(
  before: Record<string, JsonValue> | Record<string, string>,
  set: Record<string, unknown>,
  unset: readonly string[],
): { set: Record<string, JsonValue>; unset: string[] } {
  const invSet: Record<string, JsonValue> = {};
  const invUnset: string[] = [];
  const restore = (key: string) => {
    if (Object.prototype.hasOwnProperty.call(before, key)) {
      invSet[key] = (before as Record<string, JsonValue>)[key]!;
    } else {
      invUnset.push(key);
    }
  };
  for (const key in set) restore(key);
  for (const key of unset) {
    // Unsetting a key that existed → inverse restores it; unsetting an absent key is a no-op.
    if (Object.prototype.hasOwnProperty.call(before, key)) {
      invSet[key] = (before as Record<string, JsonValue>)[key]!;
    }
  }
  return { set: invSet, unset: invUnset };
}

/** Compute the inverse of a single operation against the pre-op state. */
function invertOne(
  state: CanvasState,
  op: CanvasOperation,
): CanvasOperation | null {
  const nodes = state.document.nodes;
  switch (op.type) {
    case "insert-node":
      return { type: "remove-node", nodeId: op.node.id };

    case "remove-node": {
      const prev = nodes[op.nodeId];
      if (prev === undefined) return null; // removing a missing node inverts to nothing
      return { type: "insert-node", node: prev };
    }

    case "move-node": {
      const prev = nodes[op.nodeId];
      if (prev === undefined) return null;
      return {
        type: "move-node",
        nodeId: op.nodeId,
        parentId: prev.parentId,
        sortKey: prev.sortKey,
      };
    }

    case "set-node-geometry": {
      const prev = nodes[op.nodeId];
      if (prev === undefined || prev.type !== "frame") return null;
      const inv: CanvasOperation = {
        type: "set-node-geometry",
        nodeId: op.nodeId,
      };
      if (op.x !== undefined) inv.x = prev.x;
      if (op.y !== undefined) inv.y = prev.y;
      if (op.width !== undefined) inv.width = prev.width;
      if (op.height !== undefined) inv.height = prev.height;
      return inv;
    }

    case "set-text": {
      const prev = nodes[op.nodeId];
      if (prev === undefined || prev.type !== "text") return null;
      return { type: "set-text", nodeId: op.nodeId, text: prev.text };
    }

    case "set-node-flags": {
      const prev = nodes[op.nodeId];
      if (prev === undefined) return null;
      const inv: CanvasOperation = {
        type: "set-node-flags",
        nodeId: op.nodeId,
      };
      if (op.name !== undefined) inv.name = prev.name;
      if (op.visible !== undefined) inv.visible = prev.visible;
      if (op.locked !== undefined) inv.locked = prev.locked;
      if (op.clipsContent !== undefined && prev.type === "frame")
        inv.clipsContent = prev.clipsContent;
      if (op.visibleWhen !== undefined)
        inv.visibleWhen = prev.visibleWhen ?? "";
      if (op.repeat !== undefined) inv.repeat = prev.repeat ?? "";
      if (op.repeatAs !== undefined) inv.repeatAs = prev.repeatAs ?? "";
      return inv;
    }

    case "set-node-attrs": {
      const prev = nodes[op.nodeId];
      if (prev === undefined || prev.type !== "element") return null;
      const { set, unset } = invertRecordPatch(prev.attrs, op.set, op.unset);
      return {
        type: "set-node-attrs",
        nodeId: op.nodeId,
        set: set as Record<string, string>,
        unset,
      };
    }

    case "set-component-props": {
      const prev = nodes[op.nodeId];
      if (prev === undefined || prev.type !== "component") return null;
      const { set, unset } = invertRecordPatch(prev.props, op.set, op.unset);
      return { type: "set-component-props", nodeId: op.nodeId, set, unset };
    }

    case "set-node-style": {
      const prev = nodes[op.nodeId];
      if (prev === undefined) return null;
      const beforeStyle = prev.style as Record<string, JsonValue>;
      const { set, unset } = invertRecordPatch(
        beforeStyle,
        op.set,
        op.unset as readonly string[],
      );
      return {
        type: "set-node-style",
        nodeId: op.nodeId,
        set: set as Partial<NodeStyle>,
        unset: unset as (keyof NodeStyle)[],
      };
    }

    case "set-document-meta": {
      const before = state.document.meta as Record<string, JsonValue>;
      const { set, unset } = invertRecordPatch(before, op.set, op.unset);
      return { type: "set-document-meta", set, unset };
    }

    case "rebalance-sort-keys": {
      const keys: Record<string, string> = {};
      for (const id in op.keys) {
        const node = nodes[id];
        if (node !== undefined) keys[id] = node.sortKey;
      }
      return { type: "rebalance-sort-keys", parentId: op.parentId, keys };
    }

    default:
      return exhaustive(op);
  }
}

function exhaustive(op: never): never {
  throw new Error(`Unknown operation: ${JSON.stringify(op)}`);
}

/**
 * Compute the inverse batch of `ops` applied to `state`. Threads state op-by-op so
 * inter-op dependencies invert correctly; returns inverses in reverse order. Fully
 * no-op ops contribute nothing.
 */
export function invertBatch(
  state: CanvasState,
  ops: readonly CanvasOperation[],
): CanvasOperation[] {
  const inverses: CanvasOperation[] = [];
  let cursor = state;
  for (const op of ops) {
    const inverse = invertOne(cursor, op);
    if (inverse !== null) inverses.push(inverse);
    cursor = applyBatch(cursor, [op]);
  }
  inverses.reverse();
  return inverses;
}
