/**
 * Block-library hooks (§ blocks). Save the current selection as a named reusable block,
 * and insert a block onto the canvas (id-remapped, like paste).
 */

"use client";

import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { asNodeId, type NodeId } from "../document/ids";
import type { CanvasState } from "../operations/apply";
import { buildPayload, insertOpsFromPayload } from "../commands/edit-commands";
import { useCanvas } from "../store/context";
import type { Block } from "./store";

export interface BlockLibrary {
  blocks: Block[];
  /** Save the current selection (or given ids) as a named block. */
  saveBlock: (
    name: string,
    opts?: { ids?: readonly NodeId[]; category?: string },
  ) => Block | null;
  /** Insert a block onto the canvas at an offset; returns the new root ids. */
  insertBlock: (blockId: string, at?: { x: number; y: number }) => NodeId[];
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
}

export function useBlockLibrary(): BlockLibrary {
  const { blockStore, documentStore, sessionStore, idFactory } = useCanvas();
  const blocks = useStore(
    blockStore,
    useShallow((s) => Object.values(s.blocks)),
  );

  const state = (): CanvasState => {
    const s = documentStore.getState();
    return { document: s.document, childrenIndex: s.childrenIndex };
  };

  return {
    blocks,
    saveBlock: (name, opts) => {
      const ids = opts?.ids ?? sessionStore.getState().selection;
      if (ids.length === 0) return null;
      const payload = buildPayload(state(), ids);
      const block: Block = {
        id: idFactory.nodeId(),
        name,
        category: opts?.category,
        payload,
      };
      blockStore.getState().add(block);
      return block;
    },
    insertBlock: (blockId, at) => {
      const block = blockStore.getState().blocks[blockId];
      if (block === undefined) return [];
      const { ops, newRootIds } = insertOpsFromPayload(
        block.payload,
        state(),
        idFactory,
        null,
        at ?? { x: 32, y: 32 },
      );
      if (ops.length > 0) {
        documentStore.getState().apply(ops);
        sessionStore.getState().setSelection(newRootIds);
      }
      return newRootIds.map((id) => asNodeId(id));
    },
    remove: (id) => blockStore.getState().remove(id),
    rename: (id, name) => blockStore.getState().rename(id, name),
  };
}
