/**
 * Text tool (§7) — click inside an artboard to insert a text node, then it enters edit
 * mode (via the select flow). Falls back to a root-level text node if clicking empty
 * space is not over an artboard.
 */

import type { TextNode } from "../document/nodes";
import {
  type CanvasPointerEvent,
  type Tool,
  type ToolContext,
  TOOL_SELECT,
  TOOL_TEXT,
} from "./tool";

export function createTextTool(): Tool {
  return {
    id: TOOL_TEXT,
    cursor: "text",

    onPointerDown(e: CanvasPointerEvent, ctx: ToolContext) {
      if (ctx.readonly === true) return;
      // Parent to the artboard under the pointer, if any.
      let parentId = null as TextNode["parentId"];
      for (const hit of e.hits) {
        const node = ctx.getNode(hit);
        if (node?.type === "frame") {
          parentId = node.id;
          break;
        }
      }
      const id = ctx.createNodeId();
      const node: TextNode = {
        type: "text",
        id,
        parentId,
        sortKey: ctx.appendSortKey(parentId),
        name: "Text",
        visible: true,
        locked: false,
        rotation: 0,
        text: "Text",
        style:
          parentId === null
            ? {
                position: "absolute",
                left: e.canvas.x,
                top: e.canvas.y,
                fontSize: 16,
                color: "#111827",
              }
            : { fontSize: 16, color: "#111827" },
      };
      ctx.apply([{ type: "insert-node", node }]);
      ctx.setSelection([id]);
      ctx.setActiveTool(TOOL_SELECT);
    },
  };
}
