/**
 * Edit commands (§7b) — duplicate, copy/cut/paste (internal buffer), group/ungroup,
 * z-order, select-all. All are op compositions over the existing primitives; exposed
 * publicly via `CanvasApi.commands` / `useCanvasCommands()` so consumer chrome (menus,
 * toolbars) drives them without re-implementing subtree serialization.
 */

import type { CanvasState } from "../operations/apply";
import { childrenOf } from "../operations/children-index";
import type { CanvasOperation } from "../operations/operations";
import { ROOT_PARENT, type IdFactory, type NodeId } from "../document/ids";
import { asNodeId } from "../document/ids";
import type { GroupNode, SceneNode } from "../document/nodes";
import type { Dimension } from "../document/styles";
import { generateKeyBetween } from "../document/fractional-index";
import {
  CLIPBOARD_MIME,
  CLIPBOARD_VERSION,
  type ClipboardPayload,
} from "./clipboard";

export interface CommandContext {
  getState(): CanvasState;
  apply(
    ops: readonly CanvasOperation[],
    opts?: { coalesceKey?: string; gestureId?: string },
  ): void;
  getSelection(): readonly NodeId[];
  setSelection(ids: readonly NodeId[]): void;
  idFactory: IdFactory;
  readBuffer(): ClipboardPayload | null;
  writeBuffer(payload: ClipboardPayload | null): void;
}

/** Collect a node id plus all descendants (pre-order). */
function collectSubtree(state: CanvasState, rootId: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const walk = (id: NodeId) => {
    out.push(id);
    for (const child of childrenOf(state.childrenIndex, id)) walk(child);
  };
  walk(rootId);
  return out;
}

/** The last sortKey among a parent's current children (for appending). */
function lastSortKey(state: CanvasState, parentKey: string): string | null {
  const kids = childrenOf(state.childrenIndex, parentKey);
  const lastId = kids[kids.length - 1];
  if (lastId === undefined) return null;
  return state.document.nodes[lastId]?.sortKey ?? null;
}

/** Build a clipboard payload from a selection (roots + descendants), normalizing root parents. */
export function buildPayload(
  state: CanvasState,
  selection: readonly NodeId[],
): ClipboardPayload {
  const selected = new Set(selection);
  // A selected node whose ancestor is also selected is not a root.
  const roots = selection.filter((id) => {
    const node = state.document.nodes[id];
    return (
      node !== undefined &&
      (node.parentId === null || !selected.has(node.parentId))
    );
  });
  const nodes: Record<string, SceneNode> = {};
  for (const root of roots) {
    for (const id of collectSubtree(state, root)) {
      const node = state.document.nodes[id];
      if (node !== undefined) nodes[id] = node;
    }
  }
  return { version: CLIPBOARD_VERSION, mime: CLIPBOARD_MIME, roots, nodes };
}

/** Remap a payload's ids to fresh ones and return insert ops under `targetParent`. */
export function insertOpsFromPayload(
  payload: ClipboardPayload,
  state: CanvasState,
  idFactory: IdFactory,
  targetParent: NodeId | null,
  offset: { x: number; y: number },
): { ops: CanvasOperation[]; newRootIds: NodeId[] } {
  const idMap = new Map<string, NodeId>();
  for (const oldId in payload.nodes)
    idMap.set(oldId, asNodeId(idFactory.nodeId()));

  const parentKey = targetParent ?? ROOT_PARENT;
  let prevKey = lastSortKey(state, parentKey);

  const ops: CanvasOperation[] = [];
  const newRootIds: NodeId[] = [];
  const rootSet = new Set(payload.roots);

  for (const oldId in payload.nodes) {
    const original = payload.nodes[oldId];
    if (original === undefined) continue;
    const newId = idMap.get(oldId)!;
    const isRoot = rootSet.has(oldId);
    const newParent = isRoot
      ? targetParent
      : original.parentId !== null
        ? (idMap.get(original.parentId) ?? targetParent)
        : targetParent;

    let sortKey = original.sortKey;
    if (isRoot) {
      sortKey = generateKeyBetween(prevKey, null);
      prevKey = sortKey;
      newRootIds.push(newId);
    }

    const cloned: SceneNode = {
      ...original,
      id: newId,
      parentId: newParent,
      sortKey,
    };
    // Offset root artboards so a paste is visible.
    if (isRoot && cloned.type === "frame" && cloned.parentId === null) {
      cloned.x += offset.x;
      cloned.y += offset.y;
    }
    ops.push({ type: "insert-node", node: cloned });
  }
  return { ops, newRootIds };
}

export function duplicate(ctx: CommandContext, ids?: readonly NodeId[]): void {
  const state = ctx.getState();
  const selection = ids ?? ctx.getSelection();
  if (selection.length === 0) return;
  const payload = buildPayload(state, selection);
  const { ops, newRootIds } = insertOpsFromPayload(
    payload,
    state,
    ctx.idFactory,
    null,
    {
      x: 24,
      y: 24,
    },
  );
  if (ops.length === 0) return;
  ctx.apply(ops);
  ctx.setSelection(newRootIds);
}

export function copy(ctx: CommandContext, ids?: readonly NodeId[]): void {
  const state = ctx.getState();
  const selection = ids ?? ctx.getSelection();
  if (selection.length === 0) return;
  ctx.writeBuffer(buildPayload(state, selection));
}

export function cut(ctx: CommandContext, ids?: readonly NodeId[]): void {
  const selection = ids ?? ctx.getSelection();
  if (selection.length === 0) return;
  copy(ctx, selection);
  // Remove full subtrees, parents-first (inverse re-inserts parents before children).
  const state = ctx.getState();
  const removeIds: NodeId[] = [];
  const roots = ctx.readBuffer()?.roots ?? [];
  for (const root of roots)
    removeIds.push(...collectSubtree(state, asNodeId(root)));
  ctx.apply(removeIds.map((nodeId) => ({ type: "remove-node", nodeId })));
  ctx.setSelection([]);
}

export function paste(
  ctx: CommandContext,
  at?: { x: number; y: number },
): void {
  const payload = ctx.readBuffer();
  if (payload === null) return;
  const state = ctx.getState();
  const { ops, newRootIds } = insertOpsFromPayload(
    payload,
    state,
    ctx.idFactory,
    null,
    at ?? { x: 24, y: 24 },
  );
  if (ops.length === 0) return;
  ctx.apply(ops);
  ctx.setSelection(newRootIds);
}

export function group(ctx: CommandContext, ids?: readonly NodeId[]): void {
  const state = ctx.getState();
  const selection = ids ?? ctx.getSelection();
  if (selection.length < 2) return;
  // v1: require a single common parent.
  const first = state.document.nodes[selection[0]!];
  if (first === undefined) return;
  const commonParent = first.parentId;
  for (const id of selection) {
    if (state.document.nodes[id]?.parentId !== commonParent) return;
  }
  const parentKey = commonParent ?? ROOT_PARENT;
  const groupId = asNodeId(ctx.idFactory.nodeId());
  const groupSortKey = generateKeyBetween(lastSortKey(state, parentKey), null);
  const groupNode: GroupNode = {
    type: "group",
    id: groupId,
    parentId: commonParent,
    sortKey: groupSortKey,
    name: "Group",
    visible: true,
    locked: false,
    rotation: 0,
    style: {},
  };
  const ops: CanvasOperation[] = [{ type: "insert-node", node: groupNode }];
  // Reparent selected nodes into the group, preserving order via fresh keys.
  let prevKey: string | null = null;
  for (const id of selection) {
    const key = generateKeyBetween(prevKey, null);
    prevKey = key;
    ops.push({
      type: "move-node",
      nodeId: id,
      parentId: groupId,
      sortKey: key,
    });
  }
  ctx.apply(ops);
  ctx.setSelection([groupId]);
}

export function ungroup(ctx: CommandContext, ids?: readonly NodeId[]): void {
  const state = ctx.getState();
  const selection = ids ?? ctx.getSelection();
  const ops: CanvasOperation[] = [];
  const freed: NodeId[] = [];
  for (const id of selection) {
    const node = state.document.nodes[id];
    if (node === undefined || node.type !== "group") continue;
    const parentKey = node.parentId ?? ROOT_PARENT;
    let prevKey = node.sortKey;
    for (const childId of childrenOf(state.childrenIndex, id)) {
      const key = generateKeyBetween(prevKey, null);
      prevKey = key;
      ops.push({
        type: "move-node",
        nodeId: childId,
        parentId: node.parentId,
        sortKey: key,
      });
      freed.push(childId);
    }
    ops.push({ type: "remove-node", nodeId: id });
  }
  if (ops.length === 0) return;
  ctx.apply(ops);
  ctx.setSelection(freed);
}

type ZDirection = "forward" | "backward" | "front" | "back";

function reorder(
  ctx: CommandContext,
  direction: ZDirection,
  ids?: readonly NodeId[],
): void {
  const state = ctx.getState();
  const selection = ids ?? ctx.getSelection();
  const ops: CanvasOperation[] = [];
  for (const id of selection) {
    const node = state.document.nodes[id];
    if (node === undefined) continue;
    const parentKey = node.parentId ?? ROOT_PARENT;
    const siblings = childrenOf(state.childrenIndex, parentKey);
    const index = siblings.indexOf(id);
    if (index < 0) continue;
    let before: string | null = null;
    let after: string | null = null;
    if (direction === "front") {
      before = keyOf(state, siblings[siblings.length - 1]);
    } else if (direction === "back") {
      after = keyOf(state, siblings[0]);
    } else if (direction === "forward" && index < siblings.length - 1) {
      before = keyOf(state, siblings[index + 1]);
      after = keyOf(state, siblings[index + 2]);
    } else if (direction === "backward" && index > 0) {
      after = keyOf(state, siblings[index - 1]);
      before = keyOf(state, siblings[index - 2]);
    } else {
      continue;
    }
    ops.push({
      type: "move-node",
      nodeId: id,
      parentId: node.parentId,
      sortKey: generateKeyBetween(before, after),
    });
  }
  if (ops.length > 0) ctx.apply(ops);
}

function keyOf(state: CanvasState, id: NodeId | undefined): string | null {
  if (id === undefined) return null;
  return state.document.nodes[id]?.sortKey ?? null;
}

export const bringForward = (ctx: CommandContext, ids?: readonly NodeId[]) =>
  reorder(ctx, "forward", ids);
export const sendBackward = (ctx: CommandContext, ids?: readonly NodeId[]) =>
  reorder(ctx, "backward", ids);
export const bringToFront = (ctx: CommandContext, ids?: readonly NodeId[]) =>
  reorder(ctx, "front", ids);
export const sendToBack = (ctx: CommandContext, ids?: readonly NodeId[]) =>
  reorder(ctx, "back", ids);

/* ---------- Align & distribute (§14b) ---------- */

export type AlignEdge =
  | "left"
  | "hcenter"
  | "right"
  | "top"
  | "vcenter"
  | "bottom";
export type DistributeAxis = "horizontal" | "vertical";

interface PositionedNode {
  id: NodeId;
  kind: "frame" | "absolute";
  x: number;
  y: number;
  width: number;
  height: number;
}

/** px value of a Dimension, or null for %/auto/rem/etc. (align works in canvas px). */
function pxOf(dim: Dimension | undefined): number | null {
  if (dim === undefined) return null;
  if (typeof dim === "number") return dim;
  return dim.unit === "px" ? dim.value : null;
}

/**
 * Nodes align/distribute can move: root artboards (stored geometry) and absolute children
 * with fully-resolvable px geometry. Flow children (no stored position) and %/auto sizes
 * are skipped — CSS layout already positions those.
 */
function collectPositioned(
  state: CanvasState,
  selection: readonly NodeId[],
): PositionedNode[] {
  const out: PositionedNode[] = [];
  for (const id of selection) {
    const node = state.document.nodes[id];
    if (node === undefined || node.locked) continue;
    if (node.type === "frame" && node.parentId === null) {
      out.push({
        id,
        kind: "frame",
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      });
    } else if (node.style.position === "absolute") {
      const x = pxOf(node.style.left);
      const y = pxOf(node.style.top);
      const width = pxOf(node.style.width);
      const height = pxOf(node.style.height);
      if (x !== null && y !== null && width !== null && height !== null)
        out.push({ id, kind: "absolute", x, y, width, height });
    }
  }
  return out;
}

function moveOp(p: PositionedNode, x: number, y: number): CanvasOperation {
  const rx = Math.round(x);
  const ry = Math.round(y);
  return p.kind === "frame"
    ? { type: "set-node-geometry", nodeId: p.id, x: rx, y: ry }
    : {
        type: "set-node-style",
        nodeId: p.id,
        set: { left: rx, top: ry },
        unset: [],
      };
}

/** Align the selection's positioned nodes to a shared edge/center of their union bbox. */
export function align(
  ctx: CommandContext,
  edge: AlignEdge,
  ids?: readonly NodeId[],
): void {
  const state = ctx.getState();
  const nodes = collectPositioned(state, ids ?? ctx.getSelection());
  if (nodes.length < 2) return;
  const minX = Math.min(...nodes.map((n) => n.x));
  const maxX = Math.max(...nodes.map((n) => n.x + n.width));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxY = Math.max(...nodes.map((n) => n.y + n.height));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const ops: CanvasOperation[] = [];
  for (const n of nodes) {
    let { x, y } = n;
    if (edge === "left") x = minX;
    else if (edge === "right") x = maxX - n.width;
    else if (edge === "hcenter") x = cx - n.width / 2;
    else if (edge === "top") y = minY;
    else if (edge === "bottom") y = maxY - n.height;
    else if (edge === "vcenter") y = cy - n.height / 2;
    if (Math.round(x) !== Math.round(n.x) || Math.round(y) !== Math.round(n.y))
      ops.push(moveOp(n, x, y));
  }
  if (ops.length > 0) ctx.apply(ops);
}

/** Distribute positioned nodes with equal gaps along an axis (ends fixed). */
export function distribute(
  ctx: CommandContext,
  axis: DistributeAxis,
  ids?: readonly NodeId[],
): void {
  const state = ctx.getState();
  const nodes = collectPositioned(state, ids ?? ctx.getSelection());
  if (nodes.length < 3) return;
  const horizontal = axis === "horizontal";
  const size = (n: PositionedNode) => (horizontal ? n.width : n.height);
  const pos = (n: PositionedNode) => (horizontal ? n.x : n.y);
  const sorted = [...nodes].sort((a, b) => pos(a) - pos(b));
  const start = pos(sorted[0]!);
  const lastNode = sorted[sorted.length - 1]!;
  const end = pos(lastNode) + size(lastNode);
  const totalSize = sorted.reduce((s, n) => s + size(n), 0);
  const gap = (end - start - totalSize) / (sorted.length - 1);
  const ops: CanvasOperation[] = [];
  let cursor = start;
  for (const n of sorted) {
    const target = cursor;
    if (Math.round(target) !== Math.round(pos(n)))
      ops.push(horizontal ? moveOp(n, target, n.y) : moveOp(n, n.x, target));
    cursor += size(n) + gap;
  }
  if (ops.length > 0) ctx.apply(ops);
}

/** Select all nodes in the current artboard scope (or all top-level artboards). */
export function selectAll(ctx: CommandContext): void {
  const state = ctx.getState();
  const selection = ctx.getSelection();
  // Scope to the parent of the current selection, else the root artboards.
  let scope: string = ROOT_PARENT;
  const first = selection[0];
  if (first !== undefined) {
    const node = state.document.nodes[first];
    if (node?.parentId != null) scope = node.parentId;
  }
  ctx.setSelection(childrenOf(state.childrenIndex, scope));
}
