/**
 * Shared-styles hook (§ shared styles). Define named styles, apply them to nodes, and
 * update a style once to re-style every node that references it.
 */

"use client";

import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import type { JsonValue } from "../document/json";
import type { NodeId } from "../document/ids";
import type { NodeStyle } from "../document/styles";
import { useCanvas } from "../store/context";
import { stylesFromMeta, type NamedStyle, type StyleLibrary } from "./resolve";

export interface StyleLibraryApi {
  styles: NamedStyle[];
  defineStyle: (name: string, style: NodeStyle, category?: string) => string;
  updateStyle: (id: string, style: NodeStyle) => void;
  removeStyle: (id: string) => void;
  applyStyle: (styleId: string, nodeIds?: readonly NodeId[]) => void;
  clearStyleRef: (nodeIds?: readonly NodeId[]) => void;
}

export function useStyleLibrary(): StyleLibraryApi {
  const { documentStore, sessionStore, idFactory } = useCanvas();
  const styles = useStore(
    documentStore,
    useShallow((s) => Object.values(stylesFromMeta(s.document.meta))),
  );

  const setLibrary = (lib: StyleLibrary) => {
    documentStore
      .getState()
      .apply([
        {
          type: "set-document-meta",
          set: { styles: lib as unknown as JsonValue },
          unset: [],
        },
      ]);
  };
  const currentLib = (): StyleLibrary =>
    stylesFromMeta(documentStore.getState().document.meta);
  const targetIds = (ids?: readonly NodeId[]) =>
    ids ?? sessionStore.getState().selection;

  return {
    styles,
    defineStyle: (name, style, category) => {
      const id = idFactory.nodeId();
      setLibrary({ ...currentLib(), [id]: { id, name, category, style } });
      return id;
    },
    updateStyle: (id, style) => {
      const lib = currentLib();
      const existing = lib[id];
      if (existing === undefined) return;
      setLibrary({ ...lib, [id]: { ...existing, style } });
    },
    removeStyle: (id) => {
      const lib = { ...currentLib() };
      delete lib[id];
      setLibrary(lib);
    },
    applyStyle: (styleId, nodeIds) => {
      const ops = targetIds(nodeIds).map((nodeId) => ({
        type: "set-node-flags" as const,
        nodeId,
        styleRef: styleId,
      }));
      if (ops.length > 0) documentStore.getState().apply(ops);
    },
    clearStyleRef: (nodeIds) => {
      const ops = targetIds(nodeIds).map((nodeId) => ({
        type: "set-node-flags" as const,
        nodeId,
        styleRef: "",
      }));
      if (ops.length > 0) documentStore.getState().apply(ops);
    },
  };
}
