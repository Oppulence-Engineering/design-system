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
function insertOpsFromPayload(
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
