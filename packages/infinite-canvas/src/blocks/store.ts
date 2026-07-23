/**
 * Template & block library (§ blocks). A block is a named, reusable subtree — literally
 * a named clipboard payload (the serialized, ID-remappable subtree from §7b). Held in a
 * per-instance store the consumer seeds + persists, so teams build a shared library of
 * invoice sections, dashboard cards, email blocks, etc.
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import type { ClipboardPayload } from "../commands/clipboard";

export interface Block {
  id: string;
  name: string;
  /** Optional grouping (e.g. "Invoice", "Email"). */
  category?: string;
  payload: ClipboardPayload;
}

export interface BlockStoreState {
  blocks: Record<string, Block>;
  add: (block: Block) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  load: (blocks: readonly Block[]) => void;
}

export interface BlockStoreBundle {
  store: StoreApi<BlockStoreState>;
  onChange: (fn: (blocks: Block[]) => void) => () => void;
}

export function createBlockStore(
  initial: readonly Block[] = [],
): BlockStoreBundle {
  const listeners = new Set<(blocks: Block[]) => void>();
  const notify = (map: Record<string, Block>) => {
    const list = Object.values(map);
    for (const l of listeners) l(list);
  };

  const store = createStore<BlockStoreState>((set, get) => ({
    blocks: Object.fromEntries(initial.map((b) => [b.id, b])),
    add: (block) => {
      const blocks = { ...get().blocks, [block.id]: block };
      set({ blocks });
      notify(blocks);
    },
    remove: (id) => {
      const blocks = { ...get().blocks };
      delete blocks[id];
      set({ blocks });
      notify(blocks);
    },
    rename: (id, name) => {
      const existing = get().blocks[id];
      if (existing === undefined) return;
      const blocks = { ...get().blocks, [id]: { ...existing, name } };
      set({ blocks });
      notify(blocks);
    },
    load: (list) =>
      set({ blocks: Object.fromEntries(list.map((b) => [b.id, b])) }),
  }));

  return {
    store,
    onChange: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
