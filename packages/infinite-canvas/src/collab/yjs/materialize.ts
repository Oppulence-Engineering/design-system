/**
 * Y.Doc ↔ document materialization + op translation (§10).
 *
 * Local ops are applied fine-grained to the Y.Doc (`applyOpsToYDoc`) so concurrent
 * per-property edits merge. Remote changes take the materialize-and-diff path
 * (`materializeDocFromYDoc` + `diffToOps`): rebuild the document from the Y.Doc, diff it
 * against the store, and emit a minimal batch through `applyRemote`. This is the
 * reconciliation valve the plan describes — it guarantees `store == materialize(ydoc)`
 * and is simpler and more robust than hand-written per-event translation.
 */

import * as Y from "yjs";
import type { CanvasDocument } from "../../document/document";
import { CURRENT_SCHEMA_VERSION } from "../../document/document";
import { asDocumentId } from "../../document/ids";
import type { JsonValue } from "../../document/json";
import { nullRecord } from "../../document/keys";
import type { NodeMap, SceneNode } from "../../document/nodes";
import type { CanvasOperation } from "../../operations/operations";
import { flattenNode, unflattenNode } from "./flatten";

export const LOCAL_ORIGIN = Symbol("infinite-canvas-local");

export interface CanvasYDoc {
  doc: Y.Doc;
  nodes: Y.Map<Y.Map<JsonValue>>;
  meta: Y.Map<JsonValue>;
}

/** Bind (or create) the canvas maps on a Y.Doc. */
export function bindCanvasYDoc(doc: Y.Doc): CanvasYDoc {
  return {
    doc,
    nodes: doc.getMap<Y.Map<JsonValue>>("nodes"),
    meta: doc.getMap<JsonValue>("meta"),
  };
}

/** True when the Y.Doc has no seeded content yet. */
export function isEmpty(ydoc: CanvasYDoc): boolean {
  return ydoc.nodes.size === 0;
}

/** Seed an empty Y.Doc from a JSON document (write clients only; guard with a CAS at the call site). */
export function seedYDoc(ydoc: CanvasYDoc, doc: CanvasDocument): void {
  ydoc.doc.transact(() => {
    for (const id in doc.nodes) {
      const node = doc.nodes[id];
      if (node === undefined) continue;
      ydoc.nodes.set(id, flatToYMap(flattenNode(node)));
    }
    ydoc.meta.set("name", doc.meta.name);
    ydoc.meta.set("schemaVersion", doc.schemaVersion);
    ydoc.meta.set("id", doc.id);
    ydoc.meta.set("seededAt", 1);
  }, LOCAL_ORIGIN);
}

function flatToYMap(flat: Record<string, JsonValue>): Y.Map<JsonValue> {
  const map = new Y.Map<JsonValue>();
  for (const key in flat) map.set(key, flat[key]!);
  return map;
}

/** Materialize a JSON document from the Y.Doc. */
export function materializeDocFromYDoc(
  ydoc: CanvasYDoc,
  fallbackName = "Untitled",
): CanvasDocument {
  const nodes: NodeMap = nullRecord<SceneNode>();
  ydoc.nodes.forEach((yNode, id) => {
    const flat: Record<string, JsonValue> = {};
    yNode.forEach((value, key) => {
      flat[key] = value;
    });
    nodes[id] = unflattenNode(flat);
  });
  const name = (ydoc.meta.get("name") as string | undefined) ?? fallbackName;
  const id = (ydoc.meta.get("id") as string | undefined) ?? "doc";
  return {
    schemaVersion:
      (ydoc.meta.get("schemaVersion") as number | undefined) ??
      CURRENT_SCHEMA_VERSION,
    id: asDocumentId(id),
    meta: { name },
    nodes,
  };
}

/** Apply local ops to the Y.Doc (tagged LOCAL_ORIGIN so the observer skips the echo). */
export function applyOpsToYDoc(
  ydoc: CanvasYDoc,
  ops: readonly CanvasOperation[],
): void {
  ydoc.doc.transact(() => {
    for (const op of ops) applyOne(ydoc, op);
  }, LOCAL_ORIGIN);
}

function ensureNode(
  ydoc: CanvasYDoc,
  id: string,
): Y.Map<JsonValue> | undefined {
  return ydoc.nodes.get(id);
}

function applyOne(ydoc: CanvasYDoc, op: CanvasOperation): void {
  switch (op.type) {
    case "insert-node":
      ydoc.nodes.set(op.node.id, flatToYMap(flattenNode(op.node)));
      return;
    case "remove-node":
      ydoc.nodes.delete(op.nodeId);
      return;
    case "move-node": {
      const n = ensureNode(ydoc, op.nodeId);
      if (n === undefined) return; // never upsert except insert-node
      n.set("parentId", op.parentId);
      n.set("sortKey", op.sortKey);
      return;
    }
    case "set-node-geometry": {
      const n = ensureNode(ydoc, op.nodeId);
      if (n === undefined) return;
      if (op.x !== undefined) n.set("x", op.x);
      if (op.y !== undefined) n.set("y", op.y);
      if (op.width !== undefined) n.set("width", op.width);
      if (op.height !== undefined) n.set("height", op.height);
      return;
    }
    case "set-text": {
      const n = ensureNode(ydoc, op.nodeId);
      n?.set("text", op.text);
      return;
    }
    case "set-node-flags": {
      const n = ensureNode(ydoc, op.nodeId);
      if (n === undefined) return;
      if (op.name !== undefined) n.set("name", op.name);
      if (op.visible !== undefined) n.set("visible", op.visible);
      if (op.locked !== undefined) n.set("locked", op.locked);
      if (op.clipsContent !== undefined) n.set("clipsContent", op.clipsContent);
      return;
    }
    case "set-node-attrs": {
      const n = ensureNode(ydoc, op.nodeId);
      if (n === undefined) return;
      for (const k of op.unset) n.delete(`attrs.${k}`);
      for (const k in op.set) n.set(`attrs.${k}`, op.set[k]!);
      return;
    }
    case "set-component-props": {
      const n = ensureNode(ydoc, op.nodeId);
      if (n === undefined) return;
      for (const k of op.unset) n.delete(`componentProps.${k}`);
      for (const k in op.set) n.set(`componentProps.${k}`, op.set[k]!);
      return;
    }
    case "set-node-style": {
      const n = ensureNode(ydoc, op.nodeId);
      if (n === undefined) return;
      for (const k of op.unset) {
        // Delete the key and any compound sub-keys.
        n.delete(`style.${String(k)}`);
        for (const existing of [...n.keys()]) {
          if (existing.startsWith(`style.${String(k)}.`)) n.delete(existing);
        }
      }
      const flat = flattenStylePatch(op.set as Record<string, JsonValue>);
      for (const k in flat) n.set(k, flat[k]!);
      return;
    }
    case "set-document-meta": {
      for (const k of op.unset) ydoc.meta.delete(k);
      for (const k in op.set) ydoc.meta.set(k, op.set[k]!);
      return;
    }
    case "rebalance-sort-keys": {
      for (const id in op.keys) {
        const n = ensureNode(ydoc, id);
        n?.set("sortKey", op.keys[id]!);
      }
      return;
    }
  }
}

function flattenStylePatch(
  patch: Record<string, JsonValue>,
): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const k in patch) {
    const value = patch[k];
    if (value === undefined) continue;
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      ["padding", "margin", "border", "borderRadius"].includes(k)
    ) {
      for (const subk in value as Record<string, JsonValue>) {
        out[`style.${k}.${subk}`] = (value as Record<string, JsonValue>)[subk]!;
      }
    } else {
      out[`style.${k}`] = value;
    }
  }
  return out;
}

/**
 * Diff a materialized document against the current store document, producing a minimal
 * op batch. Changed nodes are re-inserted (insert-node overwrites by id), which is
 * correct and keeps the translator trivial.
 */
export function diffToOps(
  current: CanvasDocument,
  next: CanvasDocument,
): CanvasOperation[] {
  const ops: CanvasOperation[] = [];
  for (const id in next.nodes) {
    const nextNode = next.nodes[id]!;
    const curNode = current.nodes[id];
    if (
      curNode === undefined ||
      JSON.stringify(curNode) !== JSON.stringify(nextNode)
    ) {
      ops.push({ type: "insert-node", node: nextNode });
    }
  }
  for (const id in current.nodes) {
    if (next.nodes[id] === undefined)
      ops.push({ type: "remove-node", nodeId: id as never });
  }
  return ops;
}
