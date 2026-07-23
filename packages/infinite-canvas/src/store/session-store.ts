/**
 * Session store (§5) — per-user, NEVER serialized. Camera, selection, active tool,
 * hover, text-edit target, gesture state machine, and layer expansion. Pan/zoom write
 * `camera` here; the renderer subscribes outside React and writes the transform
 * imperatively (camera changes never re-render the tree).
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import type { NodeId } from "../document/ids";
import type { Point, Rect } from "../viewport/geometry";
import { type Camera, clampZoom } from "../viewport/camera";
import type { ToolId } from "../tools/tool";

export type EditorMode = "edit" | "preview";

/** Discriminated gesture state — overlays render feedback from this without touching tool internals. */
export type Gesture =
  | { type: "idle" }
  | { type: "pan"; origin: Point }
  | { type: "marquee"; rect: Rect; additive: boolean }
  | {
      type: "move-nodes";
      nodeIds: readonly NodeId[];
      startCanvas: Point;
      gestureId: string;
    }
  | { type: "resize"; nodeId: NodeId; handle: ResizeHandle; gestureId: string }
  | { type: "draw-frame"; rect: Rect };

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface SessionState {
  camera: Camera;
  mode: EditorMode;
  activeToolId: ToolId;
  /** Ordered selection (ready to feed presence). */
  selection: readonly NodeId[];
  hoveredId: NodeId | null;
  editingTextId: NodeId | null;
  gesture: Gesture;
  expandedLayerIds: readonly NodeId[];
  snapping: { enabled: boolean; threshold: number };
  /** Active snap guide lines (canvas space), shown during a drag. */
  snapGuides: readonly SnapGuide[];
  /** Insertion indicator for flow-reorder drags (canvas space). */
  dropIndicator: {
    x: number;
    y: number;
    length: number;
    horizontal: boolean;
  } | null;
  /** When true, a click on the canvas drops a review comment pin instead of selecting. */
  commentMode: boolean;
  commentAuthor: { name: string; color: string } | null;

  setCamera: (camera: Camera) => void;
  panBy: (dx: number, dy: number) => void;
  setMode: (mode: EditorMode) => void;
  setTool: (toolId: ToolId) => void;
  setSelection: (ids: readonly NodeId[]) => void;
  toggleSelected: (id: NodeId) => void;
  clearSelection: () => void;
  setHovered: (id: NodeId | null) => void;
  setEditingText: (id: NodeId | null) => void;
  setGesture: (gesture: Gesture) => void;
  setExpanded: (ids: readonly NodeId[]) => void;
  toggleExpanded: (id: NodeId) => void;
  setSnapping: (snapping: Partial<SessionState["snapping"]>) => void;
  setSnapGuides: (guides: readonly SnapGuide[]) => void;
  setDropIndicator: (indicator: SessionState["dropIndicator"]) => void;
  setCommentMode: (
    on: boolean,
    author?: { name: string; color: string },
  ) => void;
}

/** A snap guide line in canvas space (either fully vertical or fully horizontal). */
export interface SnapGuide {
  orientation: "vertical" | "horizontal";
  /** For vertical: the x coordinate; for horizontal: the y coordinate. */
  position: number;
  /** The extent along the other axis (start/end) so the line is bounded, not infinite. */
  start: number;
  end: number;
}

export interface SessionStoreOptions {
  camera?: Camera;
  activeToolId: ToolId;
}

export function createSessionStore(
  options: SessionStoreOptions,
): StoreApi<SessionState> {
  return createStore<SessionState>((set, get) => ({
    camera: options.camera ?? { x: 0, y: 0, zoom: 1 },
    mode: "edit",
    activeToolId: options.activeToolId,
    selection: [],
    hoveredId: null,
    editingTextId: null,
    gesture: { type: "idle" },
    expandedLayerIds: [],
    snapping: { enabled: true, threshold: 6 },
    snapGuides: [],
    dropIndicator: null,
    commentMode: false,
    commentAuthor: null,

    setCamera: (camera) =>
      set({ camera: { ...camera, zoom: clampZoom(camera.zoom) } }),
    panBy: (dx, dy) => {
      const { camera } = get();
      set({ camera: { ...camera, x: camera.x + dx, y: camera.y + dy } });
    },
    setMode: (mode) => set({ mode }),
    setTool: (activeToolId) => set({ activeToolId }),
    setSelection: (selection) => set({ selection: [...selection] }),
    toggleSelected: (id) => {
      const { selection } = get();
      set({
        selection: selection.includes(id)
          ? selection.filter((s) => s !== id)
          : [...selection, id],
      });
    },
    clearSelection: () => set({ selection: [] }),
    setHovered: (hoveredId) => set({ hoveredId }),
    setEditingText: (editingTextId) => set({ editingTextId }),
    setGesture: (gesture) => set({ gesture }),
    setExpanded: (ids) => set({ expandedLayerIds: [...ids] }),
    toggleExpanded: (id) => {
      const { expandedLayerIds } = get();
      set({
        expandedLayerIds: expandedLayerIds.includes(id)
          ? expandedLayerIds.filter((s) => s !== id)
          : [...expandedLayerIds, id],
      });
    },
    setSnapping: (snapping) =>
      set({ snapping: { ...get().snapping, ...snapping } }),
    setSnapGuides: (snapGuides) => set({ snapGuides: [...snapGuides] }),
    setDropIndicator: (dropIndicator) => set({ dropIndicator }),
    setCommentMode: (commentMode, author) =>
      set({ commentMode, commentAuthor: author ?? get().commentAuthor }),
  }));
}
