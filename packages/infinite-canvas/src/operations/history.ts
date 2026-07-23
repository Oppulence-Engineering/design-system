/**
 * Undo/redo history (§4). Stores computed inverse + forward op lists per entry.
 * Coalescing is INVERSE CONCATENATION, never value-merge:
 *   - gesture-scoped: commits sharing a `gestureId` merge regardless of elapsed time
 *     (a mid-drag pause must not split the drag into two undo entries);
 *   - windowed: non-gesture edits sharing a `coalesceKey` merge within `windowMs`.
 * Only this client's entries ever live here; remote batches never touch it, and a
 * new local entry clears the redo stack.
 */

import type { CanvasOperation } from "./operations";

export interface HistoryEntry {
  /** Ops that undo the forward batch (apply to redo→undo). */
  undo: readonly CanvasOperation[];
  /** Ops that redo the batch. */
  redo: readonly CanvasOperation[];
  coalesceKey?: string;
  gestureId?: string;
  timestamp: number;
}

export interface History {
  undoStack: readonly HistoryEntry[];
  redoStack: readonly HistoryEntry[];
}

export const DEFAULT_COALESCE_WINDOW_MS = 400;
export const DEFAULT_MAX_ENTRIES = 100;

export function createHistory(): History {
  return { undoStack: [], redoStack: [] };
}

export interface CommitInput {
  undo: readonly CanvasOperation[];
  redo: readonly CanvasOperation[];
  coalesceKey?: string;
  gestureId?: string;
  timestamp: number;
}

export interface PushOptions {
  windowMs?: number;
  maxEntries?: number;
}

function shouldCoalesce(
  top: HistoryEntry,
  next: CommitInput,
  windowMs: number,
): boolean {
  if (next.gestureId !== undefined && top.gestureId === next.gestureId)
    return true;
  if (
    next.coalesceKey !== undefined &&
    top.coalesceKey === next.coalesceKey &&
    next.timestamp - top.timestamp < windowMs
  ) {
    return true;
  }
  return false;
}

/** Push a local commit, coalescing into the top entry when eligible. Clears redo. */
export function pushLocal(
  history: History,
  input: CommitInput,
  opts: PushOptions = {},
): History {
  if (input.undo.length === 0 && input.redo.length === 0) return history;
  const windowMs = opts.windowMs ?? DEFAULT_COALESCE_WINDOW_MS;
  const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;

  const top = history.undoStack[history.undoStack.length - 1];
  if (top !== undefined && shouldCoalesce(top, input, windowMs)) {
    // Merge: to undo both, undo the newer first (prepend); to redo both, redo older first (append).
    const merged: HistoryEntry = {
      undo: [...input.undo, ...top.undo],
      redo: [...top.redo, ...input.redo],
      coalesceKey: input.coalesceKey ?? top.coalesceKey,
      gestureId: input.gestureId ?? top.gestureId,
      timestamp: input.timestamp,
    };
    return {
      undoStack: [...history.undoStack.slice(0, -1), merged],
      redoStack: [],
    };
  }

  const entry: HistoryEntry = {
    undo: input.undo,
    redo: input.redo,
    coalesceKey: input.coalesceKey,
    gestureId: input.gestureId,
    timestamp: input.timestamp,
  };
  const undoStack = [...history.undoStack, entry];
  const trimmed =
    undoStack.length > maxEntries
      ? undoStack.slice(undoStack.length - maxEntries)
      : undoStack;
  return { undoStack: trimmed, redoStack: [] };
}

/**
 * Whether coalescing WOULD occur for the next commit — the store exposes this as
 * `newUndoEntry = !willCoalesce` so a Yjs UndoManager can `stopCapturing()` in sync.
 */
export function willCoalesce(
  history: History,
  input: CommitInput,
  opts: PushOptions = {},
): boolean {
  const windowMs = opts.windowMs ?? DEFAULT_COALESCE_WINDOW_MS;
  const top = history.undoStack[history.undoStack.length - 1];
  return top !== undefined && shouldCoalesce(top, input, windowMs);
}

export interface PopResult {
  entry: HistoryEntry;
  history: History;
}

/** Pop the top undo entry (moving it to redo). Returns null if empty. */
export function popUndo(history: History): PopResult | null {
  const entry = history.undoStack[history.undoStack.length - 1];
  if (entry === undefined) return null;
  return {
    entry,
    history: {
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, entry],
    },
  };
}

/** Pop the top redo entry (moving it back to undo). Returns null if empty. */
export function popRedo(history: History): PopResult | null {
  const entry = history.redoStack[history.redoStack.length - 1];
  if (entry === undefined) return null;
  return {
    entry,
    history: {
      undoStack: [...history.undoStack, entry],
      redoStack: history.redoStack.slice(0, -1),
    },
  };
}

export const canUndo = (h: History): boolean => h.undoStack.length > 0;
export const canRedo = (h: History): boolean => h.redoStack.length > 0;
