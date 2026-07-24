/**
 * Transform (resize) handles (§6). Rendered for a single selection in the overlay; the
 * only pointer-interactive overlay elements. Dragging a handle live-applies geometry
 * (artboards) or width/height style (children) under one gestureId — a single undo
 * entry. Rotation is out of scope for v1 (handles are resize-only).
 */

"use client";

import * as React from "react";
import type { NodeId } from "../document/ids";
import type { ResizeHandle } from "../store/session-store";
import { useCanvas } from "../store/context";
import { useCamera, useSelection } from "../store/hooks";
import { canvasRectToScreen } from "../viewport/camera";
import type { Rect } from "../viewport/geometry";
import { elementScreenScale } from "../viewport/rect-cache";
import { useRectCache } from "./renderer-context";

const HANDLES: { key: ResizeHandle; cx: number; cy: number; cursor: string }[] =
  [
    { key: "nw", cx: 0, cy: 0, cursor: "nwse-resize" },
    { key: "n", cx: 0.5, cy: 0, cursor: "ns-resize" },
    { key: "ne", cx: 1, cy: 0, cursor: "nesw-resize" },
    { key: "e", cx: 1, cy: 0.5, cursor: "ew-resize" },
    { key: "se", cx: 1, cy: 1, cursor: "nwse-resize" },
    { key: "s", cx: 0.5, cy: 1, cursor: "ns-resize" },
    { key: "sw", cx: 0, cy: 1, cursor: "nesw-resize" },
    { key: "w", cx: 0, cy: 0.5, cursor: "ew-resize" },
  ];

export function TransformHandles(): React.JSX.Element | null {
  const { documentStore, sessionStore, access } = useCanvas();
  const camera = useCamera();
  const selection = useSelection();
  const cache = useRectCache();

  const id = selection.length === 1 ? selection[0]! : null;
  if (id === null || access !== "write") return null;

  const node = documentStore.getState().document.nodes[id];
  if (node === undefined || node.locked) return null;

  const canvasRect: Rect | null =
    node.type === "frame" && node.parentId === null
      ? { x: node.x, y: node.y, width: node.width, height: node.height }
      : (cache?.getRect(id, camera) ?? null);
  if (canvasRect === null) return null;

  const screen = canvasRectToScreen(canvasRect, camera);
  const isArtboard = node.type === "frame" && node.parentId === null;

  const onHandleDown =
    (handle: ResizeHandle) => (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const startZoom = camera.zoom;
      const start = { x: e.clientX, y: e.clientY };
      const startRect = { ...canvasRect };
      const screenScale = elementScreenScale(e.currentTarget);
      const gestureId = `resize-${id}-${e.pointerId}`;

      const move = (ev: PointerEvent) => {
        const ddx = (ev.clientX - start.x) / screenScale.x / startZoom;
        const ddy = (ev.clientY - start.y) / screenScale.y / startZoom;
        const next = resizeRect(startRect, handle, ddx, ddy);
        if (isArtboard) {
          documentStore.getState().apply(
            [
              {
                type: "set-node-geometry",
                nodeId: id,
                x: next.x,
                y: next.y,
                width: next.width,
                height: next.height,
              },
            ],
            { gestureId },
          );
        } else {
          documentStore.getState().apply(
            [
              {
                type: "set-node-style",
                nodeId: id,
                set: { width: next.width, height: next.height },
                unset: [],
              },
            ],
            { gestureId },
          );
        }
      };
      const up = (ev: PointerEvent) => {
        (e.target as HTMLElement).releasePointerCapture(ev.pointerId);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        sessionStore.getState().setGesture({ type: "idle" });
      };
      sessionStore
        .getState()
        .setGesture({ type: "resize", nodeId: id, handle, gestureId });
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };

  return (
    <div
      style={{
        position: "absolute",
        left: screen.x,
        top: screen.y,
        width: screen.width,
        height: screen.height,
        pointerEvents: "none",
      }}
    >
      {HANDLES.map((h) => (
        <div
          key={h.key}
          data-canvas-handle=""
          onPointerDown={onHandleDown(h.key)}
          style={{
            position: "absolute",
            left: `calc(${h.cx * 100}% - 4px)`,
            top: `calc(${h.cy * 100}% - 4px)`,
            width: 8,
            height: 8,
            background: "var(--ic-artboard-bg, #fff)",
            border: "1px solid var(--ic-accent, #3b82f6)",
            borderRadius: 2,
            cursor: h.cursor,
            pointerEvents: "auto",
            boxSizing: "border-box",
          }}
        />
      ))}
    </div>
  );
}

/** Apply a handle drag to a rect, keeping width/height >= 1. */
function resizeRect(
  rect: Rect,
  handle: ResizeHandle,
  ddx: number,
  ddy: number,
): Rect {
  let { x, y, width, height } = rect;
  if (handle.includes("e")) width += ddx;
  if (handle.includes("s")) height += ddy;
  if (handle.includes("w")) {
    x += ddx;
    width -= ddx;
  }
  if (handle.includes("n")) {
    y += ddy;
    height -= ddy;
  }
  if (width < 1) width = 1;
  if (height < 1) height = 1;
  return { x, y, width, height };
}

export type { NodeId };
