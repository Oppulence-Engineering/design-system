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
