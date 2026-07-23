/**
 * Frame tool (§7) — drag to draw a new artboard on the canvas. On release, inserts a
 * root FrameNode at the drawn rect and switches back to the select tool.
 */

import type { FrameNode } from "../document/nodes";
import type { Point, Rect } from "../viewport/geometry";
import {
  type CanvasPointerEvent,
  type Tool,
  type ToolContext,
  TOOL_FRAME,
  TOOL_SELECT,
} from "./tool";

function rectOf(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function createFrameTool(): Tool {
  let start: Point | null = null;

  return {
    id: TOOL_FRAME,
    cursor: "crosshair",

    onPointerDown(e: CanvasPointerEvent, ctx: ToolContext) {
      if (ctx.readonly === true) return;
      start = e.canvas;
      ctx.setGesture({ type: "draw-frame", rect: rectOf(e.canvas, e.canvas) });
    },
    onPointerMove(e: CanvasPointerEvent, ctx: ToolContext) {
      if (start === null) return;
      ctx.setGesture({ type: "draw-frame", rect: rectOf(start, e.canvas) });
    },
    onPointerUp(e: CanvasPointerEvent, ctx: ToolContext) {
      if (start === null || ctx.readonly === true) {
        ctx.setGesture({ type: "idle" });
        return;
      }
      const rect = rectOf(start, e.canvas);
      start = null;
      ctx.setGesture({ type: "idle" });
      // Default size if it was just a click.
      const width = rect.width < 8 ? 320 : rect.width;
      const height = rect.height < 8 ? 240 : rect.height;
      const id = ctx.createNodeId();
      const node: FrameNode = {
        type: "frame",
        id,
        parentId: null,
        sortKey: ctx.appendSortKey(null),
        name: "Frame",
        visible: true,
        locked: false,
        rotation: 0,
        x: rect.x,
        y: rect.y,
        width,
        height,
        clipsContent: true,
        style: { background: { type: "solid", color: "#ffffff" } },
      };
      ctx.apply([{ type: "insert-node", node }]);
      ctx.setSelection([id]);
      ctx.setActiveTool(TOOL_SELECT);
    },
  };
}
