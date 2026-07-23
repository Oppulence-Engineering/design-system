/**
 * React hooks (§5). Selector subscriptions over the vanilla stores, plus semantic
 * wrappers. Per-node subscriptions stay cheap because `applyBatch` uses structural
 * sharing (a node keeps its reference unless it was touched).
 */

"use client";

import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import type { NodeId } from "../document/ids";
import { ROOT_PARENT } from "../document/ids";
import type { SceneNode } from "../document/nodes";
import { childrenOf } from "../operations/children-index";
import type { Camera } from "../viewport/camera";
import type { CanvasApi } from "./canvas-api";
import { useCanvas } from "./context";
import type { DocumentStoreState } from "./document-store";
import type { PresenceState } from "./presence-store";
import type { SessionState } from "./session-store";

export function useDocumentStore<T>(selector: (s: DocumentStoreState) => T): T {
  return useStore(useCanvas().documentStore, selector);
}

export function useSessionStore<T>(selector: (s: SessionState) => T): T {
  return useStore(useCanvas().sessionStore, selector);
}

export function usePresenceStore<T>(selector: (s: PresenceState) => T): T {
  return useStore(useCanvas().presenceStore, selector);
}

/** The imperative API (also available via `apiRef`). */
export function useCanvasApi(): CanvasApi {
  return useCanvas().api;
}

/** A single node — re-renders only when THAT node's reference changes. */
export function useNode(id: NodeId): SceneNode | undefined {
  return useDocumentStore((s) => s.document.nodes[id]);
}

/** Ordered child ids of a parent (reference-stable unless that parent's order changed). */
export function useChildren(
  parentKey: NodeId | typeof ROOT_PARENT,
): readonly NodeId[] {
  return useDocumentStore((s) => childrenOf(s.childrenIndex, parentKey));
}

export function useSelection(): readonly NodeId[] {
  return useSessionStore((s) => s.selection);
}

export function useCamera(): Camera {
  return useSessionStore((s) => s.camera);
}

export function useMode(): SessionState["mode"] {
  return useSessionStore((s) => s.mode);
}

export function useActiveTool() {
  return useSessionStore((s) => s.activeToolId);
}

/** Undo/redo state for a toolbar — re-renders on any document commit. */
export function useCanvasHistory(): {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
} {
  const store = useCanvas().documentStore;
  // Depend on revision + history so buttons re-enable/disable.
  const { canUndo, canRedo } = useStore(
    store,
    useShallow((s) => ({ canUndo: s.canUndo(), canRedo: s.canRedo() })),
  );
  return {
    undo: () => store.getState().undo(),
    redo: () => store.getState().redo(),
    canUndo,
    canRedo,
  };
}

/** The edit-command surface as a hook (headless equivalent of `api.commands`). */
export function useCanvasCommands(): CanvasApi["commands"] {
  return useCanvas().api.commands;
}

/** Presence peers as an array. */
export function usePeers() {
  return usePresenceStore(useShallow((s) => Object.values(s.peers)));
}
