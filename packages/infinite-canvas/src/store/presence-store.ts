/**
 * Presence store (§5) — peers keyed by clientId, written ONLY by the presence adapter.
 * Isolated from the document store so presence churn (cursor at ~30ms) never re-renders
 * document subscribers.
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import type { PresencePeer } from "../collab";

export interface PresenceState {
  peers: Readonly<Record<string, PresencePeer>>;
  setPeers: (peers: readonly PresencePeer[]) => void;
}

export function createPresenceStore(): StoreApi<PresenceState> {
  return createStore<PresenceState>((set) => ({
    peers: {},
    setPeers: (peers) => {
      const next: Record<string, PresencePeer> = {};
      for (const peer of peers) next[peer.clientId] = peer;
      set({ peers: next });
    },
  }));
}
