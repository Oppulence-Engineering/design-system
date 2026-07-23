/**
 * CanvasRoot (§6) — the single pointer-capture surface. Routes pointer/keyboard/wheel
 * input to the active tool, owns the rect cache + viewport bridge, applies the initial
 * fit, and composes the content + overlay layers. First render is viewport-independent
 * (the full tree, unculled) so SSR/hydration match.
 */

"use client";

import * as React from "react";
import { asNodeId, type NodeId } from "../document/ids";
import type { NodeMap } from "../document/nodes";
import { childrenOf } from "../operations/children-index";
import { RectCache } from "../viewport/rect-cache";
import { generateKeyBetween } from "../document/fractional-index";
import { ROOT_PARENT } from "../document/ids";
import { screenToCanvas, zoomAtPoint } from "../viewport/camera";
import type { Point } from "../viewport/geometry";
import { cameraToFit } from "../viewport/camera";
import { unionRects, type Rect } from "../viewport/geometry";
import { useCanvas } from "../store/context";
import type { CanvasPointerEvent, Tool, ToolContext } from "../tools/tool";
import { TOOL_HAND } from "../tools/tool";
import type { ViewportBridge } from "../store/canvas-api";
import { ContentLayer } from "./content-layer";
import { Overlay } from "./overlay";
import { RectCacheContext } from "./renderer-context";

export interface CanvasRootProps {
  /** Fit all artboards on mount (default true). */
  fitOnMount?: boolean;
}

export function CanvasRoot({
  fitOnMount = true,
}: CanvasRootProps): React.JSX.Element {
  const ctx = useCanvas();
  const {
    documentStore,
    sessionStore,
    toolRegistry,
    viewportBridge,
    access,
    idFactory,
  } = ctx;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const rectCache = React.useMemo(() => new RectCache(), []);
  const spaceHeld = React.useRef(false);

  // Wire the rect cache + viewport bridge; invalidate on document revision.
  React.useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    rectCache.setRoot(root);

    const bridge: ViewportBridge = {
      getSize: () => ({ width: root.clientWidth, height: root.clientHeight }),
      hitTest: (canvasPoint) =>
        rectCache.hitTest(canvasPoint, sessionStore.getState().camera),
      getNodeRect: (id) => {
        const node = documentStore.getState().document.nodes[id];
        if (
          node !== undefined &&
          node.type === "frame" &&
          node.parentId === null
        ) {
          return {
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
          };
        }
        return rectCache.getRect(id, sessionStore.getState().camera);
      },
    };
    viewportBridge.current = bridge;

    // Invalidate cached rects when the document changes (op-driven layout shifts).
    const offRevision = documentStore.subscribe((s, prev) => {
      if (s.revision !== prev.revision) rectCache.invalidateAll();
    });

    const ro = new ResizeObserver(() => {
      /* size read on demand via getSize; nothing to store */
    });
    ro.observe(root);

    return () => {
      offRevision();
      ro.disconnect();
      viewportBridge.current = null;
      rectCache.dispose();
    };
  }, [rectCache, documentStore, sessionStore, viewportBridge]);

  // Initial fit (after mount, once we can measure).
  React.useEffect(() => {
    if (!fitOnMount) return;
    const root = rootRef.current;
    if (root === null) return;
    const bounds = allArtboardBounds(documentStore.getState().document.nodes);
    sessionStore.getState().setCamera(
      cameraToFit(bounds, {
        width: root.clientWidth,
        height: root.clientHeight,
      }),
    );
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTool = React.useCallback((): Tool | undefined => {
    const id = spaceHeld.current
      ? TOOL_HAND
      : sessionStore.getState().activeToolId;
    return toolRegistry.get(id);
  }, [sessionStore, toolRegistry]);

  const toolContext = React.useMemo<ToolContext>(
    () => ({
      apply: (ops, opts) => documentStore.getState().apply(ops, opts),
      getNode: (id) => documentStore.getState().document.nodes[id],
      screenToCanvas: (p) => screenToCanvas(p, sessionStore.getState().camera),
      hitTest: (p) => rectCache.hitTest(p, sessionStore.getState().camera),
      getSelection: () => sessionStore.getState().selection,
      setSelection: (ids) => sessionStore.getState().setSelection(ids),
      setGesture: (g) => sessionStore.getState().setGesture(g),
      getGesture: () => sessionStore.getState().gesture,
      panBy: (dx, dy) => sessionStore.getState().panBy(dx, dy),
      getNodeRect: (id) => {
        const node = documentStore.getState().document.nodes[id];
        if (
          node !== undefined &&
          node.type === "frame" &&
          node.parentId === null
        ) {
          return {
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
          };
        }
        return rectCache.getRect(id, sessionStore.getState().camera);
      },
      getArtboardRects: () => {
        const nodes = documentStore.getState().document.nodes;
        const out: { id: NodeId; rect: Rect }[] = [];
        for (const id in nodes) {
          const node = nodes[id];
          if (
            node !== undefined &&
            node.type === "frame" &&
            node.parentId === null
          ) {
            out.push({
              id: node.id,
              rect: {
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height,
              },
            });
          }
        }
        return out;
      },
      getChildRects: (parentId) => {
        const camera = sessionStore.getState().camera;
        const children = childrenOf(
          documentStore.getState().childrenIndex,
          parentId,
        );
        const out: { id: NodeId; rect: Rect }[] = [];
        for (const id of children) {
          const rect = rectCache.getRect(id, camera);
          if (rect !== null) out.push({ id, rect });
        }
        return out;
      },
      setSnapGuides: (guides) => sessionStore.getState().setSnapGuides(guides),
      setDropIndicator: (indicator) =>
        sessionStore.getState().setDropIndicator(indicator),
      snappingEnabled: () => sessionStore.getState().snapping.enabled,
      snapThreshold: () =>
        sessionStore.getState().snapping.threshold /
        sessionStore.getState().camera.zoom,
      createNodeId: () => asNodeId(idFactory.nodeId()),
      appendSortKey: (parentId) => {
        const parentKey = parentId ?? ROOT_PARENT;
        const children = childrenOf(
          documentStore.getState().childrenIndex,
          parentKey,
        );
        const lastId = children[children.length - 1];
        const lastKey =
          lastId !== undefined
            ? (documentStore.getState().document.nodes[lastId]?.sortKey ?? null)
            : null;
        return generateKeyBetween(lastKey, null);
      },
      setActiveTool: (id) => sessionStore.getState().setTool(id),
      readonly: access !== "write",
    }),
    [documentStore, sessionStore, rectCache, access, idFactory],
  );

  const toPointerEvent = React.useCallback(
    (e: React.PointerEvent): CanvasPointerEvent => {
      const root = rootRef.current!;
      const box = root.getBoundingClientRect();
      const screen: Point = { x: e.clientX - box.left, y: e.clientY - box.top };
      const canvas = screenToCanvas(screen, sessionStore.getState().camera);
      return {
        screen,
        canvas,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        button: e.button,
        hits: rectCache.hitTest(canvas, sessionStore.getState().camera),
      };
    },
    [sessionStore, rectCache],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    activeTool()?.onPointerDown?.(toPointerEvent(e), toolContext);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    activeTool()?.onPointerMove?.(toPointerEvent(e), toolContext);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activeTool()?.onPointerUp?.(toPointerEvent(e), toolContext);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Double-click a text node to edit it inline.
  const onDoubleClick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (access !== "write") return;
    const pe = toPointerEvent(e);
    for (const id of pe.hits) {
      const node = documentStore.getState().document.nodes[id];
      if (node?.type === "text") {
        sessionStore.getState().setEditingText(id);
        sessionStore.getState().setSelection([id]);
        return;
      }
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const root = rootRef.current!;
    const box = root.getBoundingClientRect();
    const camera = sessionStore.getState().camera;
    if (e.ctrlKey || e.metaKey) {
      const screenPoint = { x: e.clientX - box.left, y: e.clientY - box.top };
      const factor = Math.exp(-e.deltaY * 0.01);
      sessionStore
        .getState()
        .setCamera(zoomAtPoint(camera, screenPoint, camera.zoom * factor));
    } else {
      sessionStore.getState().panBy(-e.deltaX, -e.deltaY);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (sessionStore.getState().editingTextId !== null) return; // text editor owns keys
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) documentStore.getState().redo();
      else documentStore.getState().undo();
      return;
    }
    if (e.key === " ") {
      spaceHeld.current = true;
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && access === "write") {
      const selection = sessionStore.getState().selection;
      if (selection.length > 0) {
        e.preventDefault();
        documentStore.getState().apply(
          selection.map((nodeId: NodeId) => ({
            type: "remove-node",
            nodeId,
          })),
        );
        sessionStore.getState().clearSelection();
      }
    }
  };

  const onKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " ") spaceHeld.current = false;
  };

  return (
    <RectCacheContext.Provider value={rectCache}>
      <div
        ref={rootRef}
        data-canvas-root=""
        tabIndex={0}
        role="application"
        aria-label="Design canvas"
        aria-roledescription="design canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          touchAction: "none",
          outline: "none",
          background: "var(--ic-canvas-bg, #f4f4f5)",
          userSelect: "none",
        }}
      >
        <ContentLayer />
        <Overlay />
      </div>
    </RectCacheContext.Provider>
  );
}

function allArtboardBounds(nodes: NodeMap): Rect | null {
  const rects: Rect[] = [];
  for (const id in nodes) {
    const node = nodes[id];
    if (node !== undefined && node.type === "frame" && node.parentId === null) {
      rects.push({
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      });
    }
  }
  return unionRects(rects);
}

/** Re-export a stable node-id helper for consumers building tools. */
export { asNodeId };
