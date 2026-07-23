/**
 * CanvasProvider (§5b) — the facade that mounts the three per-instance stores, tool +
 * component registries, the imperative CanvasApi, and wires optional collab/presence
 * adapters and the storage seam. Loading is consumer-owned: `initialDocument` is
 * synchronous (the consumer loads/parses and mounts keyed by document id).
 */

"use client";

import * as React from "react";
import type { CanvasDocument } from "../document/document";
import {
  asClientId,
  defaultIdFactory,
  type ClientId,
  type IdFactory,
  type NodeId,
} from "../document/ids";
import type {
  CollabAccess,
  CollabAdapter,
  PresenceAdapter,
  LocalPresence,
} from "../collab";
import { LocalPresenceAdapter, NullCollabAdapter } from "../collab";
import type { ComponentRegistry } from "../registry/component-registry";
import { emptyRegistry } from "../registry/component-registry";
import { ToolRegistry } from "../tools/tool-registry";
import type { Tool } from "../tools/tool";
import type { Camera } from "../viewport/camera";
import type { ClipboardPayload } from "../commands/clipboard";
import { BindingProvider } from "../binding/context";
import type { BindingData, FilterMap } from "../binding/resolve";
import { themeToCssVars, type CanvasTheme } from "../theme/theme";
import { createCommentsStore, type Comment } from "../comments/store";
import { createBlockStore, type Block } from "../blocks/store";
import { createVersionStore, type DocumentVersion } from "../versioning/store";
import { CanvasContext, type CanvasContextValue } from "./context";
import { createDocumentStore } from "./document-store";
import { createSessionStore } from "./session-store";
import { createPresenceStore } from "./presence-store";
import {
  createCanvasApi,
  type CanvasApi,
  type CanvasStatus,
  type ViewportBridge,
} from "./canvas-api";

export interface CanvasStorageBinding {
  onDocumentChange?: (e: {
    getSnapshot: () => CanvasDocument;
    revision: number;
    origin: "local" | "local-undo" | "remote";
  }) => void;
}

export interface CanvasProviderProps {
  /** Synchronous — the consumer loads/parses and mounts keyed by document id (§5b). */
  initialDocument: CanvasDocument;
  registry?: ComponentRegistry;
  access?: CollabAccess;
  collab?: CollabAdapter;
  presence?: PresenceAdapter;
  storage?: CanvasStorageBinding;
  tools?: readonly Tool[];
  idFactory?: IdFactory;
  /** Presence identity for the local user. */
  self?: LocalPresence;
  initialCamera?: Camera | "fit";
  onCameraChange?: (camera: Camera) => void;
  onSelectionChange?: (ids: readonly NodeId[]) => void;
  onError?: (e: {
    scope: "render" | "apply" | "collab" | "validation";
    nodeId?: NodeId;
    error: unknown;
  }) => void;
  /** Data context for `{{…}}` bindings — makes the design render as a live template. */
  data?: BindingData;
  /** Extra binding filters (merged with the built-in currency/number/date/…). */
  filters?: FilterMap;
  /** Seed review comments (consumer-persisted). */
  initialComments?: readonly Comment[];
  onCommentsChange?: (comments: Comment[]) => void;
  /** Seed the block/template library (consumer-persisted). */
  initialBlocks?: readonly Block[];
  onBlocksChange?: (blocks: Block[]) => void;
  /** Seed version history (consumer-persisted). */
  initialVersions?: readonly DocumentVersion[];
  onVersionsChange?: (versions: DocumentVersion[]) => void;
  /** Brand the canvas chrome. Sets `--ic-*` tokens; falls back to design-system `--color-*`. */
  theme?: CanvasTheme;
  apiRef?: React.Ref<CanvasApi>;
  children?: React.ReactNode;
}

export function CanvasProvider(props: CanvasProviderProps): React.JSX.Element {
  const {
    initialDocument,
    registry = emptyRegistry(),
    access = "write",
    collab,
    presence,
    storage,
    tools,
    idFactory = defaultIdFactory,
    self,
    initialCamera,
    onCameraChange,
    onSelectionChange,
    apiRef,
    children,
  } = props;

  // Stable per-instance identity + registries.
  const clientIdRef = React.useRef<ClientId>(asClientId(idFactory.clientId()));
  const clipboardRef = React.useRef<ClipboardPayload | null>(null);
  const viewportBridge = React.useRef<ViewportBridge | null>(null);
  const commentsBundleRef = React.useRef<ReturnType<
    typeof createCommentsStore
  > | null>(null);
  const blockBundleRef = React.useRef<ReturnType<
    typeof createBlockStore
  > | null>(null);
  const versionBundleRef = React.useRef<ReturnType<
    typeof createVersionStore
  > | null>(null);
  const statusRef = React.useRef<CanvasStatus>(
    collab === undefined ? "ready" : "syncing",
  );

  // Effective access = min(prop, adapter access).
  const effectiveAccess = minAccess(access, collab?.access ?? "write");

  const ctx = React.useMemo<CanvasContextValue>(() => {
    const { store: documentStore, handle } = createDocumentStore(
      initialDocument,
      {
        clientId: clientIdRef.current,
        idFactory,
      },
    );
    const sessionStore = createSessionStore({
      activeToolId: new ToolRegistry(tools).defaultToolId,
      camera:
        initialCamera !== undefined && initialCamera !== "fit"
          ? initialCamera
          : { x: 0, y: 0, zoom: 1 },
    });
    const presenceStore = createPresenceStore();
    const commentsBundle = createCommentsStore(props.initialComments);
    commentsBundleRef.current = commentsBundle;
    const blockBundle = createBlockStore(props.initialBlocks);
    blockBundleRef.current = blockBundle;
    const versionBundle = createVersionStore(props.initialVersions);
    versionBundleRef.current = versionBundle;
    const toolRegistry = new ToolRegistry(tools);
    const api = createCanvasApi({
      documentStore,
      sessionStore,
      idFactory,
      clipboardRef,
      viewportBridge,
      getStatus: () => statusRef.current,
    });
    return {
      documentStore,
      sessionStore,
      presenceStore,
      commentsStore: commentsBundle.store,
      blockStore: blockBundle.store,
      versionStore: versionBundle.store,
      handle,
      registry,
      toolRegistry,
      clientId: clientIdRef.current,
      idFactory,
      api,
      viewportBridge,
      access: effectiveAccess,
      onError: props.onError,
    };
    // Intentionally construct once per provider instance; consumers reset via `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useImperativeHandle(apiRef, () => ctx.api, [ctx.api]);

  // --- collab adapter lifecycle ---
  React.useEffect(() => {
    const adapter: CollabAdapter = collab ?? new NullCollabAdapter(access);
    const detach = adapter.attach(ctx.handle);
    if (adapter.undoManager !== undefined) {
      ctx.documentStore.getState().setDelegatedUndo(adapter.undoManager);
    }
    const offStatus = adapter.onStatusChange((s) => {
      statusRef.current =
        s === "connected" ? "ready" : s === "error" ? "error" : "syncing";
    });
    let cancelled = false;
    void adapter.connect().then(() => {
      if (!cancelled) statusRef.current = "ready";
    });
    return () => {
      cancelled = true;
      offStatus();
      ctx.documentStore.getState().setDelegatedUndo(null);
      detach();
      adapter.disconnect();
    };
  }, [collab, access, ctx]);

  // --- presence adapter lifecycle ---
  React.useEffect(() => {
    const adapter = presence ?? new LocalPresenceAdapter();
    const off = adapter.subscribe((peers) =>
      ctx.presenceStore.getState().setPeers(peers),
    );
    if (self !== undefined) adapter.join(self);
    // Push local selection + camera (for follow-mode) to presence.
    const offSel = ctx.sessionStore.subscribe((state, prev) => {
      if (state.selection !== prev.selection)
        adapter.updateSelection(state.selection);
      if (state.camera !== prev.camera && adapter.updateViewport !== undefined)
        adapter.updateViewport(state.camera);
    });
    if (adapter.updateViewport !== undefined)
      adapter.updateViewport(ctx.sessionStore.getState().camera);
    return () => {
      offSel();
      off();
      adapter.leave();
    };
  }, [presence, self, ctx]);

  // --- storage: notify on revision change ---
  React.useEffect(() => {
    if (storage?.onDocumentChange === undefined) return;
    return ctx.handle.onRevision((revision) => {
      storage.onDocumentChange?.({
        getSnapshot: () => ctx.handle.getSnapshot(),
        revision,
        origin: "local",
      });
    });
  }, [storage, ctx]);

  // --- selection change callback ---
  React.useEffect(() => {
    if (onSelectionChange === undefined) return;
    return ctx.sessionStore.subscribe((state, prev) => {
      if (state.selection !== prev.selection)
        onSelectionChange(state.selection);
    });
  }, [onSelectionChange, ctx]);

  // --- camera change callback (trailing) ---
  React.useEffect(() => {
    if (onCameraChange === undefined) return;
    return ctx.sessionStore.subscribe((state, prev) => {
      if (state.camera !== prev.camera) onCameraChange(state.camera);
    });
  }, [onCameraChange, ctx]);

  // --- comments: persist changes + default author from `self` ---
  React.useEffect(() => {
    if (self !== undefined) {
      ctx.sessionStore
        .getState()
        .setCommentMode(false, { name: self.name, color: self.color });
    }
  }, [self, ctx]);
  React.useEffect(() => {
    if (
      props.onCommentsChange === undefined ||
      commentsBundleRef.current === null
    )
      return;
    return commentsBundleRef.current.onChange(props.onCommentsChange);
  }, [props.onCommentsChange, ctx]);
  React.useEffect(() => {
    if (props.onBlocksChange === undefined || blockBundleRef.current === null)
      return;
    return blockBundleRef.current.onChange(props.onBlocksChange);
  }, [props.onBlocksChange, ctx]);
  React.useEffect(() => {
    if (
      props.onVersionsChange === undefined ||
      versionBundleRef.current === null
    )
      return;
    return versionBundleRef.current.onChange(props.onVersionsChange);
  }, [props.onVersionsChange, ctx]);

  // Theme tokens cascade to the canvas AND panels via a display:contents wrapper (custom
  // properties inherit through it without affecting the consumer's layout).
  const themeVars = React.useMemo(
    () => themeToCssVars(props.theme),
    [props.theme],
  );

  return (
    <CanvasContext.Provider value={ctx}>
      <BindingProvider data={props.data} filters={props.filters}>
        <div data-canvas-theme="" style={{ display: "contents", ...themeVars }}>
          {children}
        </div>
      </BindingProvider>
    </CanvasContext.Provider>
  );
}

const ACCESS_RANK: Record<CollabAccess, number> = {
  read: 0,
  comment: 1,
  write: 2,
};
function minAccess(a: CollabAccess, b: CollabAccess): CollabAccess {
  return ACCESS_RANK[a] <= ACCESS_RANK[b] ? a : b;
}
