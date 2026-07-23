/**
 * Hand tool (§7) — pan the camera by dragging. Also the temporary override while Space
 * is held (the renderer pushes/pops it on the tool stack).
 */

import type { Point } from "../viewport/geometry";
import {
  type CanvasPointerEvent,
  type Tool,
  type ToolContext,
  TOOL_HAND,
} from "./tool";

export function createHandTool(): Tool {
  let last: Point | null = null;
  return {
    id: TOOL_HAND,
    cursor: "grab",
    onPointerDown(e: CanvasPointerEvent, ctx: ToolContext) {
      last = e.screen;
      ctx.setGesture({ type: "pan", origin: e.screen });
    },
    onPointerMove(e: CanvasPointerEvent, ctx: ToolContext) {
      if (last === null) return;
      ctx.panBy(e.screen.x - last.x, e.screen.y - last.y);
      last = e.screen;
    },
    onPointerUp(_e: CanvasPointerEvent, ctx: ToolContext) {
      last = null;
      ctx.setGesture({ type: "idle" });
    },
  };
}
