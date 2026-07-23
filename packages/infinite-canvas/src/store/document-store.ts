/**
 * Document store (§5) — per-instance vanilla zustand store owning the document,
 * derived children index, monotonic revision, and undo/redo history. Mirrors the
 * proven workflow-studio pattern (inverse-at-apply, coalescing, revision counter),
 * generalized. Exposes a `CollabDocumentHandle` so an adapter can bind without the
 * store importing anything collab-specific.
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import type { CanvasDocument, ChildrenIndex } from "../document/document";
import type { ClientId, NodeId } from "../document/ids";
import { asBatchId, defaultIdFactory, type IdFactory } from "../document/ids";
import {
  sanitizeNode,
  type SanitizeLimits,
  DEFAULT_LIMITS,
} from "../document/sanitize";
import { withKey } from "../document/keys";
import type { CollabDocumentHandle, CollabUndoManager } from "../collab";
import { applyBatch, createState, type CanvasState } from "../operations/apply";
import { buildChildrenIndex } from "../operations/children-index";
import { invertBatch } from "../operations/invert";
import type { CanvasOperation, OperationBatch } from "../operations/operations";
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  createHistory,
  popRedo,
  popUndo,
  pushLocal,
  willCoalesce,
  type History,
} from "../operations/history";

export interface ApplyOptions {
  coalesceKey?: string;
  /** Gesture id — commits sharing it coalesce into one undo entry regardless of time. */
  gestureId?: string;
}

export interface DocumentStoreState {
  document: CanvasDocument;
  childrenIndex: ChildrenIndex;
  revision: number;
  history: History;
  /** Present when a collab adapter owns undo (store's own stack is bypassed). */
  delegatedUndo: CollabUndoManager | null;

  apply: (ops: readonly CanvasOperation[], opts?: ApplyOptions) => void;
  applyRemote: (batch: OperationBatch, origin: "local-undo" | "remote") => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getSnapshot: () => CanvasDocument;
  loadSnapshot: (doc: CanvasDocument) => void;
  setDelegatedUndo: (undoManager: CollabUndoManager | null) => void;
}

export interface DocumentStoreOptions {
  clientId: ClientId;
  idFactory?: IdFactory;
  now?: () => number;
  limits?: SanitizeLimits;
}

export interface DocumentStoreBundle {
  store: StoreApi<DocumentStoreState>;
  handle: CollabDocumentHandle;
}

type LocalBatchListener = (
  batch: OperationBatch,
  revision: number,
  meta: { newUndoEntry: boolean },
) => void;
type RevisionListener = (revision: number) => void;

/** Collect node ids a batch touches (for targeted sanitize). */
function touchedIds(ops: readonly CanvasOperation[]): NodeId[] {
  const ids: NodeId[] = [];
  for (const op of ops) {
    switch (op.type) {
      case "insert-node":
        ids.push(op.node.id);
        break;
      case "set-document-meta":
        break;
      case "rebalance-sort-keys":
        for (const id in op.keys) ids.push(id as NodeId);
        break;
      default:
        ids.push(op.nodeId);
    }
  }
  return ids;
}

export function createDocumentStore(
  initialDocument: CanvasDocument,
  options: DocumentStoreOptions,
): DocumentStoreBundle {
  const idFactory = options.idFactory ?? defaultIdFactory;
  const now = options.now ?? (() => Date.now());
  const limits = options.limits ?? DEFAULT_LIMITS;

  const localBatchListeners = new Set<LocalBatchListener>();
  const revisionListeners = new Set<RevisionListener>();

  /** Sanitize the given node ids in a state, returning a possibly-new state. */
  function sanitizeState(
    state: CanvasState,
    ids: readonly NodeId[],
  ): CanvasState {
    let nodes = state.document.nodes;
    let changed = false;
    for (const id of ids) {
      const node = nodes[id];
      if (node === undefined) continue;
      const result = sanitizeNode(node, limits);
      if (result.changed || result.invalid) {
        nodes = withKey(nodes, id, result.node);
        changed = true;
      }
    }
    if (!changed) return state;
    return {
      document: { ...state.document, nodes },
      childrenIndex: state.childrenIndex,
    };
  }

  const store = createStore<DocumentStoreState>((set, get) => ({
    ...createState(initialDocument),
    revision: 0,
    history: createHistory(),
    delegatedUndo: null,

    apply(ops, opts) {
      if (ops.length === 0) return;
      const s = get();
      const current: CanvasState = {
        document: s.document,
        childrenIndex: s.childrenIndex,
      };
      const inverse = invertBatch(current, ops);
      let next = applyBatch(current, ops);
      if (next === current) return; // fully no-op
      next = sanitizeState(next, touchedIds(ops));

      const timestamp = now();
      const commit = {
        undo: inverse,
        redo: ops,
        coalesceKey: opts?.coalesceKey,
        gestureId: opts?.gestureId,
        timestamp,
      };
      const newUndoEntry = !willCoalesce(s.history, commit);
      // With a delegated (CRDT) undo manager the store's own stack is bypassed.
      const history =
        s.delegatedUndo === null ? pushLocal(s.history, commit) : s.history;
      const revision = s.revision + 1;

      set({
        document: next.document,
        childrenIndex: next.childrenIndex,
        revision,
        history,
      });

      const batch: OperationBatch = {
        id: asBatchId(idFactory.batchId()),
        origin: options.clientId,
        ops,
        coalesceKey: opts?.coalesceKey,
        timestamp,
      };
      for (const l of localBatchListeners) l(batch, revision, { newUndoEntry });
      for (const l of revisionListeners) l(revision);
    },

    applyRemote(batch, _origin) {
      const s = get();
      const current: CanvasState = {
        document: s.document,
        childrenIndex: s.childrenIndex,
      };
      let next = applyBatch(current, batch.ops);
      if (next === current) return;
      // SECURITY: sanitize every touched node before it enters the store (§3c).
      next = sanitizeState(next, touchedIds(batch.ops));
      const revision = s.revision + 1;
      set({
        document: next.document,
        childrenIndex: next.childrenIndex,
        revision,
      });
      for (const l of revisionListeners) l(revision);
    },

    undo() {
      const s = get();
      if (s.delegatedUndo !== null) {
        s.delegatedUndo.undo();
        return;
      }
      const popped = popUndo(s.history);
      if (popped === null) return;
      const current: CanvasState = {
        document: s.document,
        childrenIndex: s.childrenIndex,
      };
      const next = applyBatch(current, popped.entry.undo);
      const revision = s.revision + 1;
      set({
        document: next.document,
        childrenIndex: next.childrenIndex,
        revision,
        history: popped.history,
      });
      const batch: OperationBatch = {
        id: asBatchId(idFactory.batchId()),
        origin: options.clientId,
        ops: popped.entry.undo,
        timestamp: now(),
      };
      for (const l of localBatchListeners)
        l(batch, revision, { newUndoEntry: true });
      for (const l of revisionListeners) l(revision);
    },

    redo() {
      const s = get();
      if (s.delegatedUndo !== null) {
        s.delegatedUndo.redo();
        return;
      }
      const popped = popRedo(s.history);
      if (popped === null) return;
      const current: CanvasState = {
        document: s.document,
        childrenIndex: s.childrenIndex,
      };
      const next = applyBatch(current, popped.entry.redo);
      const revision = s.revision + 1;
      set({
        document: next.document,
        childrenIndex: next.childrenIndex,
        revision,
        history: popped.history,
      });
      const batch: OperationBatch = {
        id: asBatchId(idFactory.batchId()),
        origin: options.clientId,
        ops: popped.entry.redo,
        timestamp: now(),
      };
      for (const l of localBatchListeners)
        l(batch, revision, { newUndoEntry: true });
      for (const l of revisionListeners) l(revision);
    },

    canUndo() {
      const s = get();
      return s.delegatedUndo !== null
        ? s.delegatedUndo.canUndo()
        : historyCanUndo(s.history);
    },
    canRedo() {
      const s = get();
      return s.delegatedUndo !== null
        ? s.delegatedUndo.canRedo()
        : historyCanRedo(s.history);
    },

    getSnapshot() {
      return get().document;
    },

    loadSnapshot(doc) {
      const state = createState(doc);
      const revision = get().revision + 1;
      set({
        document: state.document,
        childrenIndex: state.childrenIndex,
        revision,
        history: createHistory(),
      });
      for (const l of revisionListeners) l(revision);
    },

    setDelegatedUndo(undoManager) {
      set({ delegatedUndo: undoManager });
    },
  }));

  // Rebuild the children index defensively on construction (repairs any orphan/cycle in
  // the loaded document).
  store.setState({
    childrenIndex: buildChildrenIndex(store.getState().document.nodes),
  });

  const handle: CollabDocumentHandle = {
    clientId: options.clientId,
    getSnapshot: () => store.getState().getSnapshot(),
    loadSnapshot: (doc) => store.getState().loadSnapshot(doc),
    applyRemote: (batch, origin) => store.getState().applyRemote(batch, origin),
    onLocalBatch: (listener) => {
      localBatchListeners.add(listener);
      return () => localBatchListeners.delete(listener);
    },
    get revision() {
      return store.getState().revision;
    },
    onRevision: (listener) => {
      revisionListeners.add(listener);
      return () => revisionListeners.delete(listener);
    },
  };

  return { store, handle };
}
