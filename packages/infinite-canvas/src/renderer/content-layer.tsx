/**
 * Content layer (§6). The transformed div holding all artboards. Subscribes to the
 * camera OUTSIDE React for the transform (pan/zoom stay smooth). A separate rAF-throttled
 * camera subscription drives viewport CULLING: offscreen artboards UNMOUNT their children
 * and render a fixed-size placeholder (bounding both DOM and store-subscription counts);
 * `content-visibility` on visible artboards is the browser-level LOD assist.
 */

"use client";

import * as React from "react";
import { ROOT_PARENT, type NodeId } from "../document/ids";
import { visibleCanvasRect } from "../viewport/camera";
import { inflateRect, rectsIntersect, type Rect } from "../viewport/geometry";
import { useCanvas } from "../store/context";
import { useChildren } from "../store/hooks";
import { NodeRenderer } from "./node-renderer";

/** Extra margin (canvas units, scaled by zoom later) so artboards near the edge stay mounted. */
const CULL_MARGIN = 400;

export function ContentLayer(): React.JSX.Element {
  const { sessionStore, documentStore, viewportBridge } = useCanvas();
  const ref = React.useRef<HTMLDivElement>(null);
  const roots = useChildren(ROOT_PARENT);
  const [, bump] = React.useReducer((n: number) => n + 1, 0);

  // Imperative transform (no node re-render on pan).
  React.useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const applyTransform = (camera: { x: number; y: number; zoom: number }) => {
      el.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    };
    applyTransform(sessionStore.getState().camera);
    let raf = 0;
    return sessionStore.subscribe((state, prev) => {
      if (state.camera !== prev.camera) {
        applyTransform(state.camera);
        // rAF-throttle a culling recompute.
        if (raf === 0) {
          raf = requestAnimationFrame(() => {
            raf = 0;
            bump();
          });
        }
      }
    });
  }, [sessionStore]);

  // Compute the visible canvas rect (+ margin) for culling.
  const size = viewportBridge.current?.getSize() ?? { width: 0, height: 0 };
  const camera = sessionStore.getState().camera;
  const visible: Rect | null =
    size.width > 0 && size.height > 0
      ? inflateRect(visibleCanvasRect(camera, size), CULL_MARGIN)
      : null;

  return (
    <div
      ref={ref}
      data-canvas-content=""
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        transformOrigin: "0 0",
        willChange: "transform",
        pointerEvents: "none",
      }}
    >
      {roots.map((id) => (
        <Artboard
          key={id}
          id={id}
          visible={visible}
          documentStore={documentStore}
        />
      ))}
    </div>
  );
}

/** Renders a root artboard, or a fixed-size placeholder when fully offscreen. */
function Artboard({
  id,
  visible,
  documentStore,
}: {
  id: NodeId;
  visible: Rect | null;
  documentStore: ReturnType<typeof useCanvas>["documentStore"];
}): React.JSX.Element | null {
  const node = documentStore.getState().document.nodes[id];
  if (node === undefined || node.type !== "frame") return null;
  const bounds: Rect = {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };

  if (visible !== null && !rectsIntersect(visible, bounds)) {
    // Culled — placeholder at the frame's geometry; children unmounted.
    return (
      <div
        data-canvas-placeholder={id}
        style={{
          position: "absolute",
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
        }}
      />
    );
  }
  return <NodeRenderer id={id} />;
}
