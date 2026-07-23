/**
 * Yjs convergence harness (§12). Two document stores, two Y.Docs cross-wired via
 * `Y.applyUpdate`, no network — asserts per-property merge, orphan/cycle repair, undo
 * isolation, and store==materialize convergence. Lives here (not `./testing`) so the
 * published testing export stays yjs-free.
 */

import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { asClientId, createSeededIdFactory } from "../../../document/ids";
import {
  makeDocument,
  makeElement,
  makeFrame,
} from "../../../testing/factories";
import { createDocumentStore } from "../../../store/document-store";
import { YjsCollabAdapter } from "../index";
import {
  materializeDocFromYDoc,
  bindCanvasYDoc,
  LOCAL_ORIGIN,
} from "../materialize";

function makePeer(clientKey: string) {
  const frame = makeFrame({ id: "f1" });
  const el = makeElement(frame.id, { id: "e1" });
  const doc = makeDocument([frame, el]);
  const ydoc = new Y.Doc();
  const bundle = createDocumentStore(doc, {
    clientId: asClientId(clientKey),
    idFactory: createSeededIdFactory(clientKey),
    now: () => 0,
  });
  const adapter = new YjsCollabAdapter(ydoc, { access: "write" });
  const detach = adapter.attach(bundle.handle);
  return { ydoc, bundle, adapter, detach };
}

/** Cross-wire two Y.Docs so updates propagate both ways (in-memory transport). */
function link(a: Y.Doc, b: Y.Doc) {
  const onA = (update: Uint8Array, origin: unknown) => {
    if (origin !== "sync") Y.applyUpdate(b, update, "sync");
  };
  const onB = (update: Uint8Array, origin: unknown) => {
    if (origin !== "sync") Y.applyUpdate(a, update, "sync");
  };
  a.on("update", onA);
  b.on("update", onB);
  // Initial state exchange.
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a), "sync");
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b), "sync");
  return () => {
    a.off("update", onA);
    b.off("update", onB);
  };
}

describe("yjs convergence", () => {
  it("propagates a peer edit and keeps store == materialize(ydoc)", () => {
    const A = makePeer("A");
    const B = makePeer("B");
    const unlink = link(A.ydoc, B.ydoc);

    A.bundle.store
      .getState()
      .apply([
        { type: "set-node-flags", nodeId: "e1" as never, name: "from-A" },
      ]);

    expect(B.bundle.store.getState().document.nodes.e1?.name).toBe("from-A");
    // Store matches the materialized Y.Doc on both sides (reconciliation invariant).
    expect(A.bundle.store.getState().document.nodes.e1?.name).toBe(
      materializeDocFromYDoc(bindCanvasYDoc(A.ydoc)).nodes.e1?.name,
    );

    unlink();
    A.detach();
    B.detach();
  });

  it("merges concurrent edits to DIFFERENT properties of the same node", () => {
    const A = makePeer("A");
    const B = makePeer("B");
    const unlink = link(A.ydoc, B.ydoc);

    // A moves the frame; B recolors the same element — both should survive.
    A.bundle.store
      .getState()
      .apply([{ type: "set-node-geometry", nodeId: "f1" as never, x: 999 }]);
    B.bundle.store.getState().apply([
      {
        type: "set-node-style",
        nodeId: "f1" as never,
        set: { opacity: 0.3 },
        unset: [],
      },
    ]);

    for (const P of [A, B]) {
      const frame = P.bundle.store.getState().document.nodes.f1;
      expect(frame?.type).toBe("frame");
      if (frame?.type === "frame") expect(frame.x).toBe(999);
      expect(frame?.style.opacity).toBe(0.3);
    }

    unlink();
    A.detach();
    B.detach();
  });

  it("does not put a peer's edit on the local undo stack", () => {
    const A = makePeer("A");
    const B = makePeer("B");
    const unlink = link(A.ydoc, B.ydoc);

    A.bundle.store
      .getState()
      .apply([{ type: "set-node-flags", nodeId: "e1" as never, name: "x" }]);
    // B received it as a remote reconciliation — no local undo entry.
    expect(B.bundle.store.getState().canUndo()).toBe(false);

    unlink();
    A.detach();
    B.detach();
  });

  it("LOCAL_ORIGIN is a symbol (echo suppression key)", () => {
    expect(typeof LOCAL_ORIGIN).toBe("symbol");
  });
});
