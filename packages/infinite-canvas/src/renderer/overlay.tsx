/**
 * Overlay layer (§6) — selection outlines, marquee, and presence cursors, drawn in
 * screen space so handles stay constant-size at any zoom. Only the overlay re-renders
 * on camera change (not the content tree). Handles/outlines are non-interactive in v1
 * except the marquee, which the tool drives.
 */

"use client";

import * as React from "react";
import { useCanvas } from "../store/context";
import {
  useCamera,
  usePeers,
  useSelection,
  useSessionStore,
} from "../store/hooks";
import { canvasRectToScreen, canvasToScreen } from "../viewport/camera";
import type { Rect } from "../viewport/geometry";
import { useRectCache } from "./renderer-context";
import { TransformHandles } from "./transform-handles";
import { CommentPins } from "../comments/pins";

export function Overlay(): React.JSX.Element {
  const { documentStore } = useCanvas();
  const camera = useCamera();
  const selection = useSelection();
  const gesture = useSessionStore((s) => s.gesture);
  const snapGuides = useSessionStore((s) => s.snapGuides);
  const dropIndicator = useSessionStore((s) => s.dropIndicator);
  const cache = useRectCache();
  const peers = usePeers();

  const selectionRects: Rect[] = [];
  for (const id of selection) {
    const node = documentStore.getState().document.nodes[id];
    if (node === undefined) continue;
    let canvasRect: Rect | null = null;
    if (node.type === "frame" && node.parentId === null) {
      canvasRect = {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      };
    } else if (cache !== null) {
      canvasRect = cache.getRect(id, camera);
    }
    if (canvasRect !== null)
      selectionRects.push(canvasRectToScreen(canvasRect, camera));
  }

  return (
    <div
      data-canvas-overlay=""
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {selectionRects.map((rect, i) => (
        <div
          key={i}
          data-canvas-selection=""
          style={{
            position: "absolute",
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            border: "1px solid var(--ic-accent, #3b82f6)",
            boxSizing: "border-box",
          }}
        />
      ))}

      {gesture.type === "marquee" &&
        (() => {
          const r = canvasRectToScreen(gesture.rect, camera);
          return (
            <div
              data-canvas-marquee=""
              style={{
                position: "absolute",
                left: r.x,
                top: r.y,
                width: r.width,
                height: r.height,
                border: "1px solid var(--ic-accent, #3b82f6)",
                background: "var(--ic-accent-fade, rgba(59,130,246,0.08))",
              }}
            />
          );
        })()}

      {/* Snap guides (canvas-space lines, drawn in screen space). */}
      {snapGuides.map((g, i) => {
        const a = canvasToScreen(
          g.orientation === "vertical"
            ? { x: g.position, y: g.start }
            : { x: g.start, y: g.position },
          camera,
        );
        const b = canvasToScreen(
          g.orientation === "vertical"
            ? { x: g.position, y: g.end }
            : { x: g.end, y: g.position },
          camera,
        );
        return (
          <div
            key={`guide-${i}`}
            style={{
              position: "absolute",
              left: a.x,
              top: a.y,
              width: g.orientation === "vertical" ? 1 : b.x - a.x,
              height: g.orientation === "vertical" ? b.y - a.y : 1,
              background: "var(--ic-snap, #f43f5e)",
            }}
          />
        );
      })}

      {/* Flow-reorder drop indicator. */}
      {dropIndicator !== null &&
        (() => {
          const p = canvasToScreen(
            { x: dropIndicator.x, y: dropIndicator.y },
            camera,
          );
          return (
            <div
              style={{
                position: "absolute",
                left: p.x,
                top: p.y,
                width: dropIndicator.horizontal
                  ? dropIndicator.length * camera.zoom
                  : 2,
                height: dropIndicator.horizontal
                  ? 2
                  : dropIndicator.length * camera.zoom,
                background: "var(--ic-accent, #3b82f6)",
                borderRadius: 1,
              }}
            />
          );
        })()}

      {/* New-frame draw preview. */}
      {gesture.type === "draw-frame" &&
        (() => {
          const r = canvasRectToScreen(gesture.rect, camera);
          return (
            <div
              style={{
                position: "absolute",
                left: r.x,
                top: r.y,
                width: r.width,
                height: r.height,
                border: "1px dashed var(--ic-accent, #3b82f6)",
                background: "var(--ic-accent-fade, rgba(59,130,246,0.08))",
              }}
            />
          );
        })()}

      <TransformHandles />
      <CommentPins />

      {peers.map((peer) =>
        peer.cursor === null ? null : (
          <PresenceCursor
            key={peer.clientId}
            x={
              canvasRectToScreen(
                { x: peer.cursor.x, y: peer.cursor.y, width: 0, height: 0 },
                camera,
              ).x
            }
            y={
              canvasRectToScreen(
                { x: peer.cursor.x, y: peer.cursor.y, width: 0, height: 0 },
                camera,
              ).y
            }
            color={peer.color}
            name={peer.name}
          />
        ),
      )}
    </div>
  );
}

function PresenceCursor({
  x,
  y,
  color,
  name,
}: {
  x: number;
  y: number;
  color: string;
  name: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        pointerEvents: "none",
        transform: "translate(-2px, -2px)",
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50% 50% 50% 0",
          background: color,
          transform: "rotate(-45deg)",
        }}
      />
      <div
        style={{
          marginTop: 2,
          padding: "1px 6px",
          borderRadius: 4,
          background: color,
          color: "#fff",
          font: "11px/1.4 system-ui, sans-serif",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </div>
    </div>
  );
}
