/**
 * Version-history hook (§ versioning). Snapshot the current document, restore an older
 * version, and diff two versions for an audit view.
 */

"use client";

import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useCanvas } from "../store/context";
import { diffDocuments, type DocumentDiff } from "./diff";
import type { DocumentVersion } from "./store";

export interface VersionHistory {
  versions: DocumentVersion[];
  /** Snapshot the current document as a new version. */
  saveVersion: (label?: string) => DocumentVersion;
  /** Replace the live document with a version's snapshot (clears undo history). */
  restore: (id: string) => void;
  remove: (id: string) => void;
  /** Structural diff between two versions (or a version vs the live document). */
  diff: (fromId: string, toId?: string) => DocumentDiff | null;
}

export function useVersionHistory(): VersionHistory {
  const { versionStore, documentStore, sessionStore, idFactory } = useCanvas();
  const versions = useStore(
    versionStore,
    useShallow((s) => s.versions),
  );

  return {
    versions,
    saveVersion: (label) => {
      const author = sessionStore.getState().commentAuthor ?? undefined;
      const version: DocumentVersion = {
        id: idFactory.nodeId(),
        label,
        author: author ?? undefined,
        createdAt: typeof Date !== "undefined" ? Date.now() : 0,
        snapshot: JSON.parse(
          JSON.stringify(documentStore.getState().getSnapshot()),
        ),
      };
      versionStore.getState().add(version);
      return version;
    },
    restore: (id) => {
      const version = versionStore.getState().versions.find((v) => v.id === id);
      if (version !== undefined)
        documentStore.getState().loadSnapshot(version.snapshot);
    },
    remove: (id) => versionStore.getState().remove(id),
    diff: (fromId, toId) => {
      const from = versionStore
        .getState()
        .versions.find((v) => v.id === fromId);
      if (from === undefined) return null;
      const to =
        toId === undefined
          ? documentStore.getState().document
          : versionStore.getState().versions.find((v) => v.id === toId)
              ?.snapshot;
      if (to === undefined) return null;
      return diffDocuments(from.snapshot, to);
    },
  };
}
