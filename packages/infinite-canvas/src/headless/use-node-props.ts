/**
 * Headless property-editing hooks (§8). Read a node's editable values and emit the
 * right op per control target, with per-field coalescing (slider scrubs coalesce;
 * discrete edits do not). Multi-select editing (`useSelectionProps`) emits ONE batch of
 * per-node ops and reports a MIXED sentinel for fields that differ.
 */

"use client";

import * as React from "react";
import type { NodeId } from "../document/ids";
import type { JsonValue } from "../document/json";
import type { SceneNode } from "../document/nodes";
import type { CanvasOperation } from "../operations/operations";
import { useCanvas } from "../store/context";
import { useDocumentStore, useSelection } from "../store/hooks";
import {
  MIXED,
  type ControlTarget,
  type Mixed,
} from "../registry/inspector-controls";

/** Read a single value addressed by a control target from a node. */
export function readTarget(
  node: SceneNode,
  target: ControlTarget,
): JsonValue | undefined {
  switch (target.kind) {
    case "text":
      return node.type === "text" ? node.text : undefined;
    case "flag":
      if (target.key === "clipsContent")
        return node.type === "frame" ? node.clipsContent : undefined;
      return node[target.key];
    case "geometry":
      return node.type === "frame" ? node[target.key] : undefined;
    case "attr":
      return node.type === "element" ? node.attrs[target.key] : undefined;
    case "component-prop":
      return node.type === "component" ? node.props[target.key] : undefined;
    case "style":
      return readStyleKey(node, target.key);
    default:
      return undefined;
  }
}

function readStyleKey(
  node: SceneNode,
  dottedKey: string,
): JsonValue | undefined {
  const parts = dottedKey.split(".");
  let current: unknown = node.style;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current as JsonValue | undefined;
}

/** Build the op that writes `value` to `target` on `nodeId`. */
export function writeTargetOp(
  nodeId: NodeId,
  target: ControlTarget,
  value: JsonValue,
): CanvasOperation {
  switch (target.kind) {
    case "text":
      return { type: "set-text", nodeId, text: String(value) };
    case "flag":
      return {
        type: "set-node-flags",
        nodeId,
        [target.key]: value,
      } as CanvasOperation;
    case "geometry":
      return {
        type: "set-node-geometry",
        nodeId,
        [target.key]: Number(value),
      } as CanvasOperation;
    case "attr":
      return {
        type: "set-node-attrs",
        nodeId,
        set: { [target.key]: String(value) },
        unset: [],
      };
    case "component-prop":
      return {
        type: "set-component-props",
        nodeId,
        set: { [target.key]: value },
        unset: [],
      };
    case "style":
      return {
        type: "set-node-style",
        nodeId,
        set: styleSetFor(target.key, value),
        unset: [],
      };
    default:
      throw new Error("unknown control target");
  }
}

function styleSetFor(
  dottedKey: string,
  value: JsonValue,
): Record<string, JsonValue> {
  const parts = dottedKey.split(".");
  if (parts.length === 1) return { [parts[0]!]: value };
  // Compound style (e.g. padding.top) — merge one level.
  const [head, tail] = parts;
  return { [head!]: { [tail!]: value } as JsonValue };
}

export interface NodeProps {
  node: SceneNode | undefined;
  get: (target: ControlTarget) => JsonValue | undefined;
  set: (
    target: ControlTarget,
    value: JsonValue,
    opts?: { coalesceKey?: string },
  ) => void;
}

export function useNodeProps(id: NodeId): NodeProps {
  const { documentStore } = useCanvas();
  const node = useDocumentStore((s) => s.document.nodes[id]);
  return {
    node,
    get: (target) =>
      node === undefined ? undefined : readTarget(node, target),
    set: (target, value, opts) =>
      documentStore.getState().apply([writeTargetOp(id, target, value)], opts),
  };
}

export interface SelectionFieldValue {
  value: JsonValue | Mixed | undefined;
  setAll: (value: JsonValue) => void;
}

/** Multi-select property editing — shared field value (or MIXED) + write-through-to-all. */
export function useSelectionProps(): {
  ids: readonly NodeId[];
  field: (target: ControlTarget) => SelectionFieldValue;
} {
  const { documentStore } = useCanvas();
  const ids = useSelection();
  const nodes = useDocumentStore((s) => s.document.nodes);

  const field = React.useCallback(
    (target: ControlTarget): SelectionFieldValue => {
      let value: JsonValue | Mixed | undefined;
      let first = true;
      for (const id of ids) {
        const node = nodes[id];
        if (node === undefined) continue;
        const v = readTarget(node, target);
        if (first) {
          value = v;
          first = false;
        } else if (JSON.stringify(v) !== JSON.stringify(value)) {
          value = MIXED;
        }
      }
      return {
        value,
        setAll: (next) =>
          documentStore
            .getState()
            .apply(ids.map((id) => writeTargetOp(id, target, next))),
      };
    },
    [ids, nodes, documentStore],
  );

  return { ids, field };
}
