/**
 * Version history store (§ versioning). Named document snapshots with author + timestamp
 * for a compliance audit trail + rollback. Consumer-persisted (like comments/blocks) —
 * the library never stores versions itself; snapshots are full CanvasDocuments.
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import type { CanvasDocument } from "../document/document";

export interface DocumentVersion {
  id: string;
  label?: string;
  author?: { name: string; color: string };
  createdAt: number;
  snapshot: CanvasDocument;
}

export interface VersionState {
  versions: DocumentVersion[];
  add: (version: DocumentVersion) => void;
  remove: (id: string) => void;
  load: (versions: readonly DocumentVersion[]) => void;
}

export interface VersionStoreBundle {
  store: StoreApi<VersionState>;
  onChange: (fn: (versions: DocumentVersion[]) => void) => () => void;
}

export function createVersionStore(
  initial: readonly DocumentVersion[] = [],
): VersionStoreBundle {
  const listeners = new Set<(versions: DocumentVersion[]) => void>();
  const notify = (versions: DocumentVersion[]) => {
    for (const l of listeners) l(versions);
  };

  const store = createStore<VersionState>((set, get) => ({
    versions: [...initial],
    add: (version) => {
      // Newest first.
      const versions = [version, ...get().versions];
      set({ versions });
      notify(versions);
    },
    remove: (id) => {
      const versions = get().versions.filter((v) => v.id !== id);
      set({ versions });
      notify(versions);
    },
    load: (versions) => set({ versions: [...versions] }),
  }));

  return {
    store,
    onChange: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
