/**
 * Canvas context + guard hook (§5). Mirrors the design-system compound-component
 * pattern (sidebar.tsx): a context populated by CanvasProvider and a `useCanvas` hook
 * that throws outside a provider.
 */

import * as React from "react";
import type { StoreApi } from "zustand/vanilla";
import type { ClientId, IdFactory } from "../document/ids";
import type { CollabAccess, CollabDocumentHandle } from "../collab";
import type { ComponentRegistry } from "../registry/component-registry";
import type { ToolRegistry } from "../tools/tool-registry";
import type { CanvasApi, ViewportBridge } from "./canvas-api";
import type { DocumentStoreState } from "./document-store";
import type { PresenceState } from "./presence-store";
import type { SessionState } from "./session-store";

export interface CanvasContextValue {
  documentStore: StoreApi<DocumentStoreState>;
  sessionStore: StoreApi<SessionState>;
  presenceStore: StoreApi<PresenceState>;
  handle: CollabDocumentHandle;
  registry: ComponentRegistry;
  toolRegistry: ToolRegistry;
  clientId: ClientId;
  idFactory: IdFactory;
  api: CanvasApi;
  /** Populated by CanvasRoot so the api's viewport-dependent ops work. */
  viewportBridge: { current: ViewportBridge | null };
  /** Effective access = min(prop, adapter.access). */
  access: CollabAccess;
  onError?: (e: {
    scope: "render" | "apply" | "collab" | "validation";
    nodeId?: import("../document/ids").NodeId;
    error: unknown;
  }) => void;
}

export const CanvasContext = React.createContext<CanvasContextValue | null>(
  null,
);

export function useCanvas(): CanvasContextValue {
  const ctx = React.useContext(CanvasContext);
  if (ctx === null) {
    throw new Error("useCanvas must be used within a <CanvasProvider>.");
  }
  return ctx;
}
