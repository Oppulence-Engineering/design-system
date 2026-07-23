/**
 * Collaboration adapter interfaces (§10). This module is YJS-FREE — no file reachable
 * from `./collab` may import yjs (corinthian never installs it). The Yjs reference
 * implementation lives behind the isolated `./collab/yjs` subpath. Presence is a
 * SEPARATE adapter so a consumer can implement it over SSE/Redis without any CRDT.
 */

import type { CanvasDocument } from "../document/document";
import type { ClientId } from "../document/ids";
import type { JsonValue } from "../document/json";
import type { OperationBatch } from "../operations/operations";

export type CollabAccess = "read" | "comment" | "write";
export type CollabStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/**
 * The document-store surface an adapter binds to. `applyRemote` MUST run the sanitize
 * boundary on every materialized node before it enters the store (§3c). `onLocalBatch`
 * delivers EFFECTIVE (post-defensive-filter) ops plus `newUndoEntry`, which a CRDT
 * undo manager uses to drive `stopCapturing()` in lockstep with the store's coalescing.
 */
export interface CollabDocumentHandle {
  readonly clientId: ClientId;
  getSnapshot(): CanvasDocument;
  loadSnapshot(doc: CanvasDocument): void;
  /** Apply a remote (or local-undo) batch. Origin distinguishes your own undo from a peer edit. */
  applyRemote(batch: OperationBatch, origin: "local-undo" | "remote"): void;
  /** Subscribe to committed local batches. Returns an unsubscribe fn. */
  onLocalBatch(
    listener: (
      batch: OperationBatch,
      revision: number,
      meta: { newUndoEntry: boolean },
    ) => void,
  ): () => void;
  readonly revision: number;
  onRevision(listener: (revision: number) => void): () => void;
}

/**
 * Optional replacement undo surface. When an adapter provides one, the store's own
 * inverse stack is bypassed and Cmd+Z routes here (required for CRDT-backed docs).
 * `setMetaHooks` lets the session store capture/restore selection on undo.
 */
export interface CollabUndoManager {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  onStackChange(listener: () => void): () => void;
  setMetaHooks(
    capture: () => JsonValue,
    restore: (meta: JsonValue, kind: "undo" | "redo") => void,
  ): void;
}

export interface CollabAdapter {
  /** Bind to the store. Called once by CanvasProvider. Returns teardown. */
  attach(doc: CollabDocumentHandle): () => void;
  connect(): Promise<void>;
  disconnect(): void;
  readonly status: CollabStatus;
  onStatusChange(listener: (status: CollabStatus) => void): () => void;
  readonly access: CollabAccess;
  /** Present ⇒ the library routes undo/redo through this instead of the store stack. */
  readonly undoManager?: CollabUndoManager;
  /** Resolves once the initial remote state has been applied. */
  whenSynced(): Promise<void>;
}

// ---- Presence (separate adapter) ----

export interface PresencePeer {
  clientId: string;
  userId: string;
  name: string;
  color: string;
  /** Canvas-space cursor, or null when off-canvas / unsupported. */
  cursor: { x: number; y: number } | null;
  selectedNodeIds: readonly string[];
  access: CollabAccess;
  /** Client-locally stamped; departed peers are retained as ghosts for a grace window. */
  lastSeenAt: number;
}

export type LocalPresence = Omit<
  PresencePeer,
  "cursor" | "selectedNodeIds" | "lastSeenAt"
>;

export interface PresenceAdapter {
  join(self: LocalPresence): void;
  leave(): void;
  updateCursor(cursor: { x: number; y: number } | null): void;
  updateSelection(selectedNodeIds: readonly string[]): void;
  subscribe(listener: (peers: readonly PresencePeer[]) => void): () => void;
  /** SSE-only presence degrades to avatars + selection tints (no live cursors). */
  readonly capabilities: { cursors: boolean; liveSelection: boolean };
}

// ---- Default no-op implementations (used single-player and in Storybook) ----

/** A collab adapter that does nothing — single-player mode. */
export class NullCollabAdapter implements CollabAdapter {
  readonly status: CollabStatus = "disconnected";
  readonly access: CollabAccess;

  constructor(access: CollabAccess = "write") {
    this.access = access;
  }

  attach(): () => void {
    return () => {};
  }
  async connect(): Promise<void> {}
  disconnect(): void {}
  onStatusChange(): () => void {
    return () => {};
  }
  async whenSynced(): Promise<void> {}
}

/** A presence adapter that reports only the local user — no network. */
export class LocalPresenceAdapter implements PresenceAdapter {
  readonly capabilities = { cursors: true, liveSelection: true };
  private self: PresencePeer | null = null;
  private listeners = new Set<(peers: readonly PresencePeer[]) => void>();

  private emit(): void {
    const peers = this.self === null ? [] : [this.self];
    for (const l of this.listeners) l(peers);
  }
  join(self: LocalPresence): void {
    this.self = { ...self, cursor: null, selectedNodeIds: [], lastSeenAt: 0 };
    this.emit();
  }
  leave(): void {
    this.self = null;
    this.emit();
  }
  updateCursor(cursor: { x: number; y: number } | null): void {
    if (this.self !== null) {
      this.self = { ...this.self, cursor };
      this.emit();
    }
  }
  updateSelection(selectedNodeIds: readonly string[]): void {
    if (this.self !== null) {
      this.self = { ...this.self, selectedNodeIds };
      this.emit();
    }
  }
  subscribe(listener: (peers: readonly PresencePeer[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.self === null ? [] : [this.self]);
    return () => this.listeners.delete(listener);
  }
}
