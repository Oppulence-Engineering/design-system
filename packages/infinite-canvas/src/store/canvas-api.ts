/**
 * Imperative CanvasApi (§5b) — the sanctioned escape hatch consumer pages need
 * (zoom-to-fit on mount, center-on-node for focus requests, programmatic selection for
 * AI copilots, undo/redo + edit commands for toolbars). Viewport-dependent operations
 * go through a `ViewportBridge` the renderer populates; without a mounted renderer they
 * fall back to stored artboard geometry.
 */

import type { StoreApi } from "zustand/vanilla";
import type { NodeId } from "../document/ids";
import { type IdFactory } from "../document/ids";
import type { SceneNode } from "../document/nodes";
import type { CanvasOperation } from "../operations/operations";
import type { CanvasState } from "../operations/apply";
import {
  canvasToScreen as canvasToScreenMath,
  cameraToFit,
  screenToCanvas as screenToCanvasMath,
  zoomAtPoint,
  type Camera,
} from "../viewport/camera";
import {
  unionRects,
  type Point,
  type Rect,
  type Size,
} from "../viewport/geometry";
import type { ClipboardPayload } from "../commands/clipboard";
import * as commands from "../commands/edit-commands";
import type { CommandContext } from "../commands/edit-commands";
import type { DocumentStoreState } from "./document-store";
import type { SessionState } from "./session-store";

export type CanvasStatus =
  | "seeding"
  | "syncing"
  | "ready"
  | "outdated"
  | "connected"
  | "error";

export interface CanvasApi {
  camera: {
    get(): Camera;
    set(camera: Camera): void;
    zoomToFit(): void;
    zoomToSelection(): void;
    centerOnNode(id: NodeId, opts?: { zoom?: number }): void;
  };
  selection: {
    get(): readonly NodeId[];
    set(ids: readonly NodeId[]): void;
    clear(): void;
  };
  history: {
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    subscribe(fn: () => void): () => void;
  };
  commands: {
    duplicate(ids?: readonly NodeId[]): void;
    copy(ids?: readonly NodeId[]): void;
    cut(ids?: readonly NodeId[]): void;
    paste(at?: Point): void;
    group(ids?: readonly NodeId[]): void;
    ungroup(ids?: readonly NodeId[]): void;
    bringForward(ids?: readonly NodeId[]): void;
    sendBackward(ids?: readonly NodeId[]): void;
    bringToFront(ids?: readonly NodeId[]): void;
    sendToBack(ids?: readonly NodeId[]): void;
    selectAll(): void;
  };
  apply(ops: readonly CanvasOperation[]): void;
  getNode(id: NodeId): SceneNode | undefined;
  hitTest(canvasPoint: Point): readonly NodeId[];
  canvasToScreen(p: Point): Point;
  screenToCanvas(p: Point): Point;
  status(): CanvasStatus;
}

/** Populated by the renderer; falls back to stored geometry when absent. */
export interface ViewportBridge {
  getSize(): Size;
  hitTest(canvasPoint: Point): readonly NodeId[];
  /** Measured canvas-space rect for a node, if the renderer has it. */
  getNodeRect(id: NodeId): Rect | null;
}

export interface CanvasApiDeps {
  documentStore: StoreApi<DocumentStoreState>;
  sessionStore: StoreApi<SessionState>;
  idFactory: IdFactory;
  clipboardRef: { current: ClipboardPayload | null };
  viewportBridge: { current: ViewportBridge | null };
  getStatus: () => CanvasStatus;
}

/** The canvas-space bounds of the given nodes (measured rects if available, else artboard geometry). */
function nodeBounds(deps: CanvasApiDeps, ids: readonly NodeId[]): Rect | null {
  const bridge = deps.viewportBridge.current;
  const doc = deps.documentStore.getState().document;
  const rects: Rect[] = [];
  for (const id of ids) {
    const measured = bridge?.getNodeRect(id) ?? null;
    if (measured !== null) {
      rects.push(measured);
      continue;
    }
    const node = doc.nodes[id];
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

function allArtboardBounds(deps: CanvasApiDeps): Rect | null {
  const doc = deps.documentStore.getState().document;
  const rects: Rect[] = [];
  for (const id in doc.nodes) {
    const node = doc.nodes[id];
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

export function createCanvasApi(deps: CanvasApiDeps): CanvasApi {
  const { documentStore, sessionStore } = deps;
  const camera = () => sessionStore.getState().camera;
  const size = () =>
    deps.viewportBridge.current?.getSize() ?? { width: 0, height: 0 };

  const commandContext: CommandContext = {
    getState: (): CanvasState => {
      const s = documentStore.getState();
      return { document: s.document, childrenIndex: s.childrenIndex };
    },
    apply: (ops, opts) => documentStore.getState().apply(ops, opts),
    getSelection: () => sessionStore.getState().selection,
    setSelection: (ids) => sessionStore.getState().setSelection(ids),
    idFactory: deps.idFactory,
    readBuffer: () => deps.clipboardRef.current,
    writeBuffer: (payload) => {
      deps.clipboardRef.current = payload;
    },
  };

  return {
    camera: {
      get: camera,
      set: (c) => sessionStore.getState().setCamera(c),
      zoomToFit: () => {
        const bounds = allArtboardBounds(deps);
        sessionStore.getState().setCamera(cameraToFit(bounds, size()));
      },
      zoomToSelection: () => {
        const bounds = nodeBounds(deps, sessionStore.getState().selection);
        if (bounds !== null)
          sessionStore.getState().setCamera(cameraToFit(bounds, size()));
      },
      centerOnNode: (id, opts) => {
        const bounds = nodeBounds(deps, [id]);
        if (bounds === null) return;
        const vp = size();
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const zoom = opts?.zoom ?? camera().zoom;
        sessionStore.getState().setCamera({
          zoom,
          x: vp.width / 2 - cx * zoom,
          y: vp.height / 2 - cy * zoom,
        });
      },
    },

    selection: {
      get: () => sessionStore.getState().selection,
      set: (ids) => sessionStore.getState().setSelection(ids),
      clear: () => sessionStore.getState().clearSelection(),
    },

    history: {
      undo: () => documentStore.getState().undo(),
      redo: () => documentStore.getState().redo(),
      canUndo: () => documentStore.getState().canUndo(),
      canRedo: () => documentStore.getState().canRedo(),
      subscribe: (fn) => documentStore.subscribe(fn),
    },

    commands: {
      duplicate: (ids) => commands.duplicate(commandContext, ids),
      copy: (ids) => commands.copy(commandContext, ids),
      cut: (ids) => commands.cut(commandContext, ids),
      paste: (at) => commands.paste(commandContext, at),
      group: (ids) => commands.group(commandContext, ids),
      ungroup: (ids) => commands.ungroup(commandContext, ids),
      bringForward: (ids) => commands.bringForward(commandContext, ids),
      sendBackward: (ids) => commands.sendBackward(commandContext, ids),
      bringToFront: (ids) => commands.bringToFront(commandContext, ids),
      sendToBack: (ids) => commands.sendToBack(commandContext, ids),
      selectAll: () => commands.selectAll(commandContext),
    },

    apply: (ops) => documentStore.getState().apply(ops),
    getNode: (id) => documentStore.getState().document.nodes[id],
    hitTest: (canvasPoint) =>
      deps.viewportBridge.current?.hitTest(canvasPoint) ?? [],
    canvasToScreen: (p) => canvasToScreenMath(p, camera()),
    screenToCanvas: (p) => screenToCanvasMath(p, camera()),
    status: deps.getStatus,
  };
}

/** Standalone helper for wheel-zoom handlers. */
export function zoomCameraAtScreenPoint(
  current: Camera,
  screenPoint: Point,
  factor: number,
): Camera {
  return zoomAtPoint(current, screenPoint, current.zoom * factor);
}
