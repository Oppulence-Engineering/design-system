/**
 * Headless layers hook (§8). Flattens the visible tree into rows (flat, not nested, so
 * shipped UI can virtualize later) derived from the children index + expansion state.
 * Store-only deps — importable without the design-system peer.
 */

"use client";

import * as React from "react";
import { ROOT_PARENT, type NodeId } from "../document/ids";
import type { SceneNodeType } from "../document/nodes";
import { childrenOf } from "../operations/children-index";
import { useCanvas } from "../store/context";
import { useDocumentStore, useSessionStore } from "../store/hooks";

export interface LayerRow {
  id: NodeId;
  depth: number;
  type: SceneNodeType;
  name: string;
  visible: boolean;
  locked: boolean;
  hasChildren: boolean;
  expanded: boolean;
  selected: boolean;
}

export interface LayerTree {
  rows: LayerRow[];
  toggleExpanded: (id: NodeId) => void;
  select: (id: NodeId, additive?: boolean) => void;
  setVisible: (id: NodeId, visible: boolean) => void;
  setLocked: (id: NodeId, locked: boolean) => void;
  rename: (id: NodeId, name: string) => void;
}

export function useLayerTree(): LayerTree {
  const { documentStore, sessionStore } = useCanvas();
  const nodes = useDocumentStore((s) => s.document.nodes);
  const childrenIndex = useDocumentStore((s) => s.childrenIndex);
  const expanded = useSessionStore((s) => s.expandedLayerIds);
  const selection = useSessionStore((s) => s.selection);

  const rows = React.useMemo<LayerRow[]>(() => {
    const expandedSet = new Set(expanded);
    const selectedSet = new Set(selection);
    const out: LayerRow[] = [];
    const walk = (parentKey: string, depth: number) => {
      for (const id of childrenOf(childrenIndex, parentKey)) {
        const node = nodes[id];
        if (node === undefined) continue;
        const kids = childrenOf(childrenIndex, id);
        const isExpanded = expandedSet.has(id);
        out.push({
          id,
          depth,
          type: node.type,
          name: node.name,
          visible: node.visible,
          locked: node.locked,
          hasChildren: kids.length > 0,
          expanded: isExpanded,
          selected: selectedSet.has(id),
        });
        if (isExpanded) walk(id, depth + 1);
      }
    };
    walk(ROOT_PARENT, 0);
    return out;
  }, [nodes, childrenIndex, expanded, selection]);

  return {
    rows,
    toggleExpanded: (id) => sessionStore.getState().toggleExpanded(id),
    select: (id, additive) => {
      const session = sessionStore.getState();
      if (additive === true) session.toggleSelected(id);
      else session.setSelection([id]);
    },
    setVisible: (id, visible) =>
      documentStore
        .getState()
        .apply([{ type: "set-node-flags", nodeId: id, visible }]),
    setLocked: (id, locked) =>
      documentStore
        .getState()
        .apply([{ type: "set-node-flags", nodeId: id, locked }]),
    rename: (id, name) =>
      documentStore
        .getState()
        .apply([{ type: "set-node-flags", nodeId: id, name }], {
          coalesceKey: `rename:${id}`,
        }),
  };
}
