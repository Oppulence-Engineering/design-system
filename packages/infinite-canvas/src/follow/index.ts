/**
 * Follow-mode (§ follow). Jump to a teammate's viewport, or continuously track it. Builds
 * on presence (peers now carry their `camera`). While following, the local camera mirrors
 * the followed peer's camera; any local pan/zoom stops following.
 */

"use client";

import * as React from "react";
import { useCanvas } from "../store/context";
import { usePeers } from "../store/hooks";
import type { PresencePeer } from "../collab";

export interface FollowApi {
  peers: PresencePeer[];
  followingId: string | null;
  /** Jump to a peer's viewport once (no tracking). */
  jumpTo: (clientId: string) => void;
  /** Continuously track a peer's viewport. */
  follow: (clientId: string) => void;
  stop: () => void;
}

export function useFollow(): FollowApi {
  const { sessionStore, presenceStore } = useCanvas();
  const peers = usePeers();
  const [followingId, setFollowingId] = React.useState<string | null>(null);

  const applyPeerCamera = React.useCallback(
    (clientId: string) => {
      const peer = presenceStore.getState().peers[clientId];
      if (peer?.camera !== undefined)
        sessionStore.getState().setCamera(peer.camera);
    },
    [presenceStore, sessionStore],
  );

  // While following: mirror the peer's camera; a LOCAL camera change stops following.
  React.useEffect(() => {
    if (followingId === null) return;
    applyPeerCamera(followingId);
    let mirroring = false;
    const offPresence = presenceStore.subscribe(() => {
      const peer = presenceStore.getState().peers[followingId];
      if (peer?.camera !== undefined) {
        mirroring = true;
        sessionStore.getState().setCamera(peer.camera);
        mirroring = false;
      }
    });
    const offSession = sessionStore.subscribe((state, prev) => {
      // A user-initiated camera change (not our mirror write) breaks follow.
      if (state.camera !== prev.camera && !mirroring) setFollowingId(null);
    });
    return () => {
      offPresence();
      offSession();
    };
  }, [followingId, presenceStore, sessionStore, applyPeerCamera]);

  return {
    peers,
    followingId,
    jumpTo: applyPeerCamera,
    follow: setFollowingId,
    stop: () => setFollowingId(null),
  };
}
