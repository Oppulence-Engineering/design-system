/**
 * `@oppulence/infinite-canvas/collab/yjs` — the ONLY published entrypoint that imports
 * yjs / y-protocols / @hocuspocus/provider (all optional peers). Implements
 * `CollabAdapter` with Y.Doc as source of truth, Y.UndoManager delegation, and a
 * Hocuspocus factory whose config shape matches apps/web's existing collaboration
 * provider so it plugs into their socket-server with near-zero client change.
 */

import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import type {
  CollabAccess,
  CollabAdapter,
  CollabDocumentHandle,
  CollabStatus,
  CollabUndoManager,
  LocalPresence,
  PresenceAdapter,
  PresencePeer,
} from "../index";
import type { JsonValue } from "../../document/json";
import { asBatchId, asClientId } from "../../document/ids";
import type { OperationBatch } from "../../operations/operations";
import {
  applyOpsToYDoc,
  bindCanvasYDoc,
  diffToOps,
  isEmpty,
  LOCAL_ORIGIN,
  materializeDocFromYDoc,
  seedYDoc,
  type CanvasYDoc,
} from "./materialize";

/** Wrap a Y.UndoManager as the library's CollabUndoManager (selection meta included). */
class YjsUndoManager implements CollabUndoManager {
  constructor(private readonly um: Y.UndoManager) {}
  undo(): void {
    this.um.undo();
  }
  redo(): void {
    this.um.redo();
  }
  canUndo(): boolean {
    return this.um.undoStack.length > 0;
  }
  canRedo(): boolean {
    return this.um.redoStack.length > 0;
  }
  onStackChange(listener: () => void): () => void {
    this.um.on("stack-item-added", listener);
    this.um.on("stack-item-popped", listener);
    return () => {
      this.um.off("stack-item-added", listener);
      this.um.off("stack-item-popped", listener);
    };
  }
  setMetaHooks(
    capture: () => JsonValue,
    restore: (meta: JsonValue, kind: "undo" | "redo") => void,
  ): void {
    this.um.on(
      "stack-item-added",
      (event: { stackItem: { meta: Map<string, unknown> } }) => {
        event.stackItem.meta.set("selection", capture());
      },
    );
    this.um.on(
      "stack-item-popped",
      (event: {
        stackItem: { meta: Map<string, unknown> };
        type: "undo" | "redo";
      }) => {
        const meta = event.stackItem.meta.get("selection");
        if (meta !== undefined) restore(meta as JsonValue, event.type);
      },
    );
  }
}

export interface YjsCollabAdapterOptions {
  access?: CollabAccess;
  /** Resolves when the transport reports first sync (immediate for a bare Y.Doc). */
  whenSynced?: Promise<void>;
  onStatus?: (register: (fn: (s: CollabStatus) => void) => () => void) => void;
  initialStatus?: CollabStatus;
}

export class YjsCollabAdapter implements CollabAdapter {
  status: CollabStatus;
  readonly access: CollabAccess;
  readonly undoManager: CollabUndoManager;

  private readonly ydoc: CanvasYDoc;
  private readonly yUndo: Y.UndoManager;
  private readonly statusListeners = new Set<(s: CollabStatus) => void>();
  private readonly syncedPromise: Promise<void>;
  private handle: CollabDocumentHandle | null = null;
  private teardown: (() => void)[] = [];

  constructor(doc: Y.Doc, options: YjsCollabAdapterOptions = {}) {
    this.ydoc = bindCanvasYDoc(doc);
    this.access = options.access ?? "write";
    this.status = options.initialStatus ?? "connecting";
    this.syncedPromise = options.whenSynced ?? Promise.resolve();
    // captureTimeout: Infinity — the store's coalescing drives entry boundaries via
    // stopCapturing(); ignoreRemoteMapChanges: true — undo re-asserts your prior value.
    this.yUndo = new Y.UndoManager(this.ydoc.nodes, {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: Number.POSITIVE_INFINITY,
      ignoreRemoteMapChanges: true,
    });
    this.undoManager = new YjsUndoManager(this.yUndo);
  }

  attach(handle: CollabDocumentHandle): () => void {
    this.handle = handle;

    // Seed an empty doc from the store's initial snapshot (write clients only).
    if (isEmpty(this.ydoc) && this.access === "write") {
      seedYDoc(this.ydoc, handle.getSnapshot());
    } else if (!isEmpty(this.ydoc)) {
      // Remote already has content — load it, replacing the local seed candidate.
      handle.loadSnapshot(materializeDocFromYDoc(this.ydoc));
    }

    // Local commits → Y.Doc (LOCAL_ORIGIN so the observer skips the echo).
    const offLocal = handle.onLocalBatch((batch, _rev, meta) => {
      if (meta.newUndoEntry) this.yUndo.stopCapturing();
      applyOpsToYDoc(this.ydoc, batch.ops);
    });

    // Remote transactions → materialize + diff + applyRemote (reconciliation valve).
    const observer = (_events: unknown, transaction: Y.Transaction) => {
      if (transaction.origin === LOCAL_ORIGIN) return; // echo
      const isOwnUndo = transaction.origin === this.yUndo;
      this.reconcile(isOwnUndo ? "local-undo" : "remote");
    };
    this.ydoc.nodes.observeDeep(observer);
    this.ydoc.meta.observe(observer as never);

    this.teardown.push(offLocal, () => {
      this.ydoc.nodes.unobserveDeep(observer);
      this.ydoc.meta.unobserve(observer as never);
    });

    return () => {
      for (const fn of this.teardown) fn();
      this.teardown = [];
      this.handle = null;
    };
  }

  /** Rebuild the document from the Y.Doc and push the diff into the store. */
  private reconcile(origin: "local-undo" | "remote"): void {
    if (this.handle === null) return;
    const current = this.handle.getSnapshot();
    const materialized = materializeDocFromYDoc(this.ydoc, current.meta.name);
    const ops = diffToOps(current, materialized);
    if (ops.length === 0) return;
    const batch: OperationBatch = {
      id: asBatchId("yjs-remote"),
      origin: asClientId("remote"),
      ops,
      timestamp: 0,
    };
    this.handle.applyRemote(batch, origin);
  }

  async connect(): Promise<void> {
    this.setStatus("connecting");
    await this.syncedPromise;
    this.setStatus("connected");
  }
  disconnect(): void {
    this.yUndo.destroy();
    this.setStatus("disconnected");
  }
  onStatusChange(listener: (s: CollabStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }
  whenSynced(): Promise<void> {
    return this.syncedPromise;
  }
  setStatus(status: CollabStatus): void {
    this.status = status;
    for (const l of this.statusListeners) l(status);
  }
}

// ---- Presence over Yjs awareness ----

interface Awareness {
  setLocalStateField(field: string, value: unknown): void;
  getStates(): Map<number, Record<string, unknown>>;
  on(event: "change", cb: () => void): void;
  off(event: "change", cb: () => void): void;
  clientID: number;
}

export class YjsPresenceAdapter implements PresenceAdapter {
  readonly capabilities = { cursors: true, liveSelection: true };
  private ghosts = new Map<string, PresencePeer>();

  constructor(
    private readonly awareness: Awareness,
    private readonly access: CollabAccess = "write",
    private readonly now: () => number = () => Date.now(),
  ) {}

  join(self: LocalPresence): void {
    this.awareness.setLocalStateField("user", { ...self, access: this.access });
  }
  leave(): void {
    this.awareness.setLocalStateField("user", null);
  }
  updateCursor(cursor: { x: number; y: number } | null): void {
    this.awareness.setLocalStateField("cursor", cursor);
  }
  updateSelection(selectedNodeIds: readonly string[]): void {
    // Cap the encoded selection — awareness re-serializes the whole state per update.
    this.awareness.setLocalStateField(
      "selection",
      selectedNodeIds.slice(0, 50),
    );
  }
  subscribe(listener: (peers: readonly PresencePeer[]) => void): () => void {
    const onChange = () => listener(this.collect());
    this.awareness.on("change", onChange);
    onChange();
    return () => this.awareness.off("change", onChange);
  }

  private collect(): PresencePeer[] {
    const peers: PresencePeer[] = [];
    const seen = new Set<string>();
    for (const [clientId, state] of this.awareness.getStates()) {
      if (clientId === this.awareness.clientID) continue;
      const user = state.user as
        | (LocalPresence & { access: CollabAccess })
        | null
        | undefined;
      if (user == null) continue;
      const cursor =
        (state.cursor as { x: number; y: number } | null | undefined) ?? null;
      const selection = (state.selection as string[] | undefined) ?? [];
      const peer: PresencePeer = {
        clientId: user.clientId,
        userId: user.userId,
        name: user.name,
        color: user.color,
        cursor,
        selectedNodeIds: selection,
        access: user.access,
        lastSeenAt: this.now(),
      };
      peers.push(peer);
      seen.add(user.clientId);
      this.ghosts.set(user.clientId, peer);
    }
    // Retain recently-departed peers as ghosts for a grace window so avatars don't flap.
    for (const [id, ghost] of this.ghosts) {
      if (!seen.has(id) && this.now() - ghost.lastSeenAt < 60_000) {
        peers.push({ ...ghost, cursor: null });
      } else if (!seen.has(id)) {
        this.ghosts.delete(id);
      }
    }
    return peers;
  }
}

// ---- Hocuspocus factory (config shape matches apps/web's CollaborationProviderConfig) ----

export interface CanvasCollabConfig {
  access: CollabAccess;
  documentName: string;
  getToken: () => Promise<string>;
  hocuspocusUrl: string;
  webrtc: {
    iceServers: { urls: string[] }[];
    password: string;
    roomName: string;
    signaling: string[];
  } | null;
}

export function createYjsCanvasCollab(config: CanvasCollabConfig): {
  collab: CollabAdapter;
  presence: PresenceAdapter;
  doc: Y.Doc;
} {
  const doc = new Y.Doc();
  const provider = new HocuspocusProvider({
    url: config.hocuspocusUrl,
    name: config.documentName,
    document: doc,
    token: config.getToken,
  });

  const synced = new Promise<void>((resolve) => {
    provider.on("synced", () => resolve());
  });

  const collab = new YjsCollabAdapter(doc, {
    access: config.access,
    whenSynced: synced,
    initialStatus: "connecting",
  });

  // Bridge provider status into the adapter.
  provider.on("status", (event: { status: string }) => {
    collab.setStatus(event.status === "connected" ? "connected" : "connecting");
  });
  const originalDisconnect = collab.disconnect.bind(collab);
  collab.disconnect = () => {
    provider.disconnect();
    originalDisconnect();
  };

  const presence = new YjsPresenceAdapter(
    provider.awareness as unknown as Awareness,
    config.access,
  );

  return { collab, presence, doc };
}

export {
  bindCanvasYDoc,
  materializeDocFromYDoc,
  applyOpsToYDoc,
  diffToOps,
  LOCAL_ORIGIN,
};
export type { CanvasYDoc };
