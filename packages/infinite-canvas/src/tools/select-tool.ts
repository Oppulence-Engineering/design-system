/**
 * Select tool (§7). Machine: idle → maybe-drag → move-nodes | marquee. Move gestures
 * live-apply per pointermove under one gestureId (whole drag = one undo entry). Handles
 * three cases:
 *   - root artboard: translate geometry, snapping to other artboards (with guide lines);
 *   - absolute child: translate `left`/`top`;
 *   - flow child: REORDER within the parent (drop index from sibling midpoints), with a
 *     drop indicator — no free translation.
 */

import type { NodeId } from "../document/ids";
import type { CanvasOperation } from "../operations/operations";
import { generateKeyBetween } from "../document/fractional-index";
import type { Point, Rect } from "../viewport/geometry";
import {
  rectCenter,
  rectContainsPoint,
  rectsIntersect,
} from "../viewport/geometry";
import { snapRect } from "./snapping";
import {
  type CanvasPointerEvent,
  type Tool,
  type ToolContext,
  TOOL_SELECT,
} from "./tool";

let gestureCounter = 0;
const nextGestureId = (): string => `sel-${gestureCounter++}`;

function marqueeRectOf(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

type DragKind = "artboard" | "absolute" | "flow" | "none";

function dragKindFor(ctx: ToolContext, id: NodeId): DragKind {
  const node = ctx.getNode(id);
  if (node === undefined || node.locked) return "none";
  if (node.type === "frame" && node.parentId === null) return "artboard";
  if (node.style.position === "absolute") return "absolute";
  if (node.parentId !== null) return "flow";
  return "none";
}

export function createSelectTool(): Tool {
  let dragStart: Point | null = null;
  let dragNodes: NodeId[] = [];
  let gestureId: string | null = null;
  let lastCanvas: Point | null = null;
  let kind: DragKind = "none";
  let flowDrop: { parentId: NodeId; sortKey: string } | null = null;

  const endGesture = (ctx: ToolContext) => {
    ctx.setGesture({ type: "idle" });
    ctx.setSnapGuides([]);
    ctx.setDropIndicator(null);
    dragStart = null;
    dragNodes = [];
    gestureId = null;
    lastCanvas = null;
    kind = "none";
    flowDrop = null;
  };

  return {
    id: TOOL_SELECT,
    cursor: "default",

    onPointerDown(e: CanvasPointerEvent, ctx: ToolContext) {
      const top = e.hits[0];
      if (top === undefined) {
        ctx.setGesture({
          type: "marquee",
          rect: marqueeRectOf(e.canvas, e.canvas),
          additive: e.shiftKey,
        });
        dragStart = e.canvas;
        dragNodes = [];
        return;
      }
      const selection = ctx.getSelection();
      if (e.shiftKey) {
        ctx.setSelection(
          selection.includes(top)
            ? selection.filter((s) => s !== top)
            : [...selection, top],
        );
      } else if (!selection.includes(top)) {
        ctx.setSelection([top]);
      }
      if (ctx.readonly === true) return;
      dragStart = e.canvas;
      lastCanvas = e.canvas;
      dragNodes = [...ctx.getSelection()];
      gestureId = nextGestureId();
      kind = dragKindFor(ctx, top);
      ctx.setGesture({
        type: "move-nodes",
        nodeIds: dragNodes,
        startCanvas: e.canvas,
        gestureId,
      });
    },

    onPointerMove(e: CanvasPointerEvent, ctx: ToolContext) {
      const gesture = ctx.getGesture();
      if (gesture.type === "marquee" && dragStart !== null) {
        ctx.setGesture({
          type: "marquee",
          rect: marqueeRectOf(dragStart, e.canvas),
          additive: gesture.additive,
        });
        return;
      }
      if (
        gesture.type !== "move-nodes" ||
        lastCanvas === null ||
        gestureId === null ||
        ctx.readonly === true
      )
        return;

      if (kind === "flow") {
        // Reorder preview: find the drop slot among siblings from the pointer position.
        const drop = computeFlowDrop(ctx, dragNodes[0]!, e.canvas);
        flowDrop = drop;
        return;
      }

      let dx = e.canvas.x - lastCanvas.x;
      let dy = e.canvas.y - lastCanvas.y;

      // Snap a single dragged artboard against the others.
      if (
        kind === "artboard" &&
        dragNodes.length === 1 &&
        ctx.snappingEnabled()
      ) {
        const movingId = dragNodes[0]!;
        const rect = ctx.getNodeRect(movingId);
        if (rect !== null) {
          const proposed: Rect = { ...rect, x: rect.x + dx, y: rect.y + dy };
          const candidates = ctx
            .getArtboardRects()
            .filter((a) => a.id !== movingId)
            .map((a) => a.rect);
          const snap = snapRect(proposed, candidates, ctx.snapThreshold());
          dx += snap.dx;
          dy += snap.dy;
          ctx.setSnapGuides(snap.guides);
        }
      }

      lastCanvas = e.canvas;
      const ops = translateOps(ctx, dragNodes, dx, dy, kind);
      if (ops.length > 0) ctx.apply(ops, { gestureId });
    },

    onPointerUp(e: CanvasPointerEvent, ctx: ToolContext) {
      const gesture = ctx.getGesture();
      if (gesture.type === "marquee" && dragStart !== null) {
        const rect = marqueeRectOf(dragStart, e.canvas);
        const base = gesture.additive ? [...ctx.getSelection()] : [];
        const hits = ctx
          .getArtboardRects()
          .filter((a) => rectsIntersect(rect, a.rect))
          .map((a) => a.id);
        ctx.setSelection([...new Set([...base, ...hits])]);
      } else if (kind === "flow" && flowDrop !== null && gestureId !== null) {
        // Commit the reorder as a single move-node.
        ctx.apply(
          [
            {
              type: "move-node",
              nodeId: dragNodes[0]!,
              parentId: flowDrop.parentId,
              sortKey: flowDrop.sortKey,
            },
          ],
          { gestureId },
        );
      }
      endGesture(ctx);
    },
  };
}

function translateOps(
  ctx: ToolContext,
  nodeIds: readonly NodeId[],
  dx: number,
  dy: number,
  kind: DragKind,
): CanvasOperation[] {
  const ops: CanvasOperation[] = [];
  for (const id of nodeIds) {
    const node = ctx.getNode(id);
    if (node === undefined || node.locked) continue;
    if (node.type === "frame" && node.parentId === null) {
      ops.push({
        type: "set-node-geometry",
        nodeId: id,
        x: node.x + dx,
        y: node.y + dy,
      });
    } else if (node.style.position === "absolute") {
      ops.push({
        type: "set-node-style",
        nodeId: id,
        set: {
          left: dimNumber(node.style.left) + dx,
          top: dimNumber(node.style.top) + dy,
        },
        unset: [],
      });
    }
  }
  return ops;
}

/** Determine the drop parent + sortKey for a flow-reorder drag at `point`. */
function computeFlowDrop(
  ctx: ToolContext,
  draggedId: NodeId,
  point: Point,
): { parentId: NodeId; sortKey: string } | null {
  const dragged = ctx.getNode(draggedId);
  if (dragged === undefined || dragged.parentId === null) return null;
  const parentId = dragged.parentId;
  const siblings = ctx
    .getChildRects(parentId)
    .filter((s) => s.id !== draggedId);

  // Pick insertion index by comparing the pointer to sibling centers (row or column
  // inferred from whether centers vary more in x or y).
  const horizontal = isRowLayout(siblings);
  let beforeKey: string | null = null;
  let afterKey: string | null = null;
  let indicator: {
    x: number;
    y: number;
    length: number;
    horizontal: boolean;
  } | null = null;

  let index = siblings.length;
  for (let i = 0; i < siblings.length; i++) {
    const c = rectCenter(siblings[i]!.rect);
    if ((horizontal && point.x < c.x) || (!horizontal && point.y < c.y)) {
      index = i;
      break;
    }
  }

  const prev = siblings[index - 1];
  const next = siblings[index];
  beforeKey =
    prev !== undefined ? (ctx.getNode(prev.id)?.sortKey ?? null) : null;
  afterKey =
    next !== undefined ? (ctx.getNode(next.id)?.sortKey ?? null) : null;

  // Drop indicator line between prev and next.
  const anchor = next?.rect ?? prev?.rect ?? null;
  if (anchor !== null) {
    indicator = horizontal
      ? {
          x: next !== undefined ? anchor.x : anchor.x + anchor.width,
          y: anchor.y,
          length: anchor.height,
          horizontal: false,
        }
      : {
          x: anchor.x,
          y: next !== undefined ? anchor.y : anchor.y + anchor.height,
          length: anchor.width,
          horizontal: true,
        };
  }
  ctx.setDropIndicator(indicator);

  return { parentId, sortKey: generateKeyBetween(beforeKey, afterKey) };
}

function isRowLayout(siblings: { rect: Rect }[]): boolean {
  if (siblings.length < 2) return true;
  const xs = siblings.map((s) => rectCenter(s.rect).x);
  const ys = siblings.map((s) => rectCenter(s.rect).y);
  const spread = (arr: number[]) => Math.max(...arr) - Math.min(...arr);
  return spread(xs) >= spread(ys);
}

function dimNumber(dim: unknown): number {
  if (typeof dim === "number") return dim;
  if (typeof dim === "object" && dim !== null && "value" in dim) {
    const v = (dim as { value: unknown }).value;
    if (typeof v === "number") return v;
  }
  return 0;
}

export { rectContainsPoint };
