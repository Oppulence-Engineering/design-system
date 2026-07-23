/**
 * Linked-pair test harness (`./testing`). Two document stores wired through one
 * in-memory hub — a headless multiplayer setup for asserting convergence without a
 * server. (The Y.Doc-cross-wired convergence harness that needs yjs lives in
 * src/collab/yjs/__tests__/, NOT here, so `./testing` stays yjs-free.)
 */

import { asClientId, createSeededIdFactory } from "../document/ids";
import type { CanvasDocument } from "../document/document";
import {
  createDocumentStore,
  type DocumentStoreBundle,
} from "../store/document-store";
import { InMemoryCollabAdapter, InMemoryHub } from "./in-memory-adapter";

export interface LinkedClient {
  bundle: DocumentStoreBundle;
  adapter: InMemoryCollabAdapter;
  detach: () => void;
}

export interface LinkedPair {
  hub: InMemoryHub;
  a: LinkedClient;
  b: LinkedClient;
  /** Tear down both adapters. */
  dispose: () => void;
}

/** Create two document stores sharing an initial document, linked over an in-memory hub. */
export function createLinkedAdapterPair(initial: CanvasDocument): LinkedPair {
  const hub = new InMemoryHub();

  const makeClient = (clientKey: string): LinkedClient => {
    const bundle = createDocumentStore(structuredCloneDoc(initial), {
      clientId: asClientId(clientKey),
      idFactory: createSeededIdFactory(clientKey),
      now: () => 0,
    });
    const adapter = new InMemoryCollabAdapter(hub);
    const detach = adapter.attach(bundle.handle);
    return { bundle, adapter, detach };
  };

  const a = makeClient("A");
  const b = makeClient("B");

  return {
    hub,
    a,
    b,
    dispose: () => {
      a.detach();
      b.detach();
    },
  };
}

function structuredCloneDoc(doc: CanvasDocument): CanvasDocument {
  return JSON.parse(JSON.stringify(doc)) as CanvasDocument;
}
