/**
 * In-memory collab adapter (yjs-free, part of `./testing`). Broadcasts local batches to
 * peers through an in-process hub and applies incoming ones via `applyRemote` — op-echo
 * last-write-wins. Enough to power the Storybook CollabSimulation story and consumers'
 * own tests without a server or CRDT. (Per-property merge is the Yjs adapter's job.)
 */

import type {
  CollabAccess,
  CollabAdapter,
  CollabDocumentHandle,
  CollabStatus,
  LocalPresence,
  PresenceAdapter,
  PresencePeer,
} from "../collab";
import type { OperationBatch } from "../operations/operations";

/** Shared in-process transport between linked adapters. */
export class InMemoryHub {
  private handles = new Set<{
    clientId: string;
    deliver: (batch: OperationBatch) => void;
  }>();

  register(
    clientId: string,
    deliver: (batch: OperationBatch) => void,
  ): () => void {
    const entry = { clientId, deliver };
    this.handles.add(entry);
    return () => this.handles.delete(entry);
  }

  broadcast(fromClientId: string, batch: OperationBatch): void {
    for (const entry of this.handles) {
      if (entry.clientId !== fromClientId) entry.deliver(batch);
    }
  }
}

export class InMemoryCollabAdapter implements CollabAdapter {
  status: CollabStatus = "disconnected";
  readonly access: CollabAccess;

  private hub: InMemoryHub;
  private statusListeners = new Set<(s: CollabStatus) => void>();
  private teardown: (() => void)[] = [];

  constructor(hub: InMemoryHub, access: CollabAccess = "write") {
    this.hub = hub;
    this.access = access;
  }

  attach(doc: CollabDocumentHandle): () => void {
    // Local commits → hub (skip local-undo? no: peers should see undo as an edit).
    const offLocal = doc.onLocalBatch((batch) => {
      this.hub.broadcast(doc.clientId, batch);
    });
    // Incoming peer batches → applyRemote.
    const offHub = this.hub.register(doc.clientId, (batch) => {
      doc.applyRemote(batch, "remote");
    });
    this.teardown.push(offLocal, offHub);
    return () => {
      offLocal();
      offHub();
    };
  }

  async connect(): Promise<void> {
    this.setStatus("connected");
  }
  disconnect(): void {
    for (const fn of this.teardown) fn();
    this.teardown = [];
    this.setStatus("disconnected");
  }
  onStatusChange(listener: (s: CollabStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }
  async whenSynced(): Promise<void> {}

  private setStatus(status: CollabStatus): void {
    this.status = status;
    for (const l of this.statusListeners) l(status);
  }
}

/**
 * Shared in-memory presence (yjs-free) — a hub multiple providers attach to so they see
 * each other's cursors/selection/camera. Powers the follow-mode Storybook demo without a
 * server.
 */
export class InMemoryPresenceHub {
  private peers = new Map<string, PresencePeer>();
  private listeners = new Set<(peers: readonly PresencePeer[]) => void>();

  private emit(): void {
    const all = [...this.peers.values()];
    for (const l of this.listeners) l(all);
  }
  private set(clientId: string, patch: Partial<PresencePeer>): void {
    const existing = this.peers.get(clientId);
    if (existing === undefined) return;
    this.peers.set(clientId, { ...existing, ...patch });
    this.emit();
  }

  /** Create a presence adapter for one client bound to this hub. */
  adapter(): PresenceAdapter {
    const hub = this;
    let selfId: string | null = null;
    return {
      capabilities: { cursors: true, liveSelection: true },
      join(self: LocalPresence) {
        selfId = self.clientId;
        hub.peers.set(self.clientId, {
          ...self,
          cursor: null,
          selectedNodeIds: [],
          lastSeenAt: 0,
        });
        hub.emit();
      },
      leave() {
        if (selfId !== null) {
          hub.peers.delete(selfId);
          hub.emit();
        }
      },
      updateCursor(cursor) {
        if (selfId !== null) hub.set(selfId, { cursor });
      },
      updateSelection(selectedNodeIds) {
        if (selfId !== null) hub.set(selfId, { selectedNodeIds });
      },
      updateViewport(camera) {
        if (selfId !== null) hub.set(selfId, { camera });
      },
      subscribe(listener) {
        const wrapped = (peers: readonly PresencePeer[]) =>
          listener(peers.filter((p) => p.clientId !== selfId));
        hub.listeners.add(wrapped);
        wrapped([...hub.peers.values()]);
        return () => hub.listeners.delete(wrapped);
      },
    };
  }
}
