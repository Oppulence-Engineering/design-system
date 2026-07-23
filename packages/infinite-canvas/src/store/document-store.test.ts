import { describe, expect, it } from "vitest";
import { asClientId } from "../document/ids";
import { makeDocument, makeElement, makeFrame } from "../testing/factories";
import { createLinkedAdapterPair } from "../testing/linked-pair";
import { createDocumentStore } from "./document-store";

function fixture() {
  const frame = makeFrame({ id: "f1" });
  const el = makeElement(frame.id, { id: "e1" });
  return makeDocument([frame, el]);
}

describe("document store — local editing", () => {
  it("applies, bumps revision, and undoes/redoes", () => {
    const { store } = createDocumentStore(fixture(), {
      clientId: asClientId("c1"),
      now: () => 0,
    });
    const s = store.getState();
    expect(s.revision).toBe(0);

    s.apply([
      {
        type: "set-node-style",
        nodeId: makeFrame({ id: "e1" }).id,
        set: { opacity: 0.5 },
        unset: [],
      },
    ]);
    expect(store.getState().revision).toBe(1);
    expect(store.getState().canUndo()).toBe(true);

    store.getState().undo();
    expect(store.getState().document.nodes.e1?.style.opacity).toBeUndefined();
    store.getState().redo();
    expect(store.getState().document.nodes.e1?.style.opacity).toBe(0.5);
  });

  it("sanitizes on applyRemote (drops unsafe css from a peer)", () => {
    const { store, handle } = createDocumentStore(fixture(), {
      clientId: asClientId("c1"),
      now: () => 0,
    });
    handle.applyRemote(
      {
        id: "b" as never,
        origin: "peer" as never,
        ops: [
          {
            type: "set-node-style",
            nodeId: "e1" as never,
            set: { custom: { position: "fixed", color: "red" } } as never,
            unset: [],
          },
        ],
        timestamp: 0,
      },
      "remote",
    );
    const style = store.getState().document.nodes.e1?.style;
    expect(style?.custom).toEqual({ color: "red" }); // position:fixed dropped
  });

  it("sanitizes the seed document on construction (unsafe css stripped)", () => {
    const frame = makeFrame({ id: "f1" });
    const el = {
      ...makeElement(frame.id, { id: "e1" }),
      style: { custom: { position: "fixed", color: "red" } },
    };
    const { store } = createDocumentStore(makeDocument([frame, el]) as never, {
      clientId: asClientId("c1"),
      now: () => 0,
    });
    expect(store.getState().document.nodes.e1?.style.custom).toEqual({
      color: "red",
    }); // position:fixed dropped at load, not just at apply/applyRemote
  });

  it("sanitizes on loadSnapshot / version restore", () => {
    const { store, handle } = createDocumentStore(fixture(), {
      clientId: asClientId("c1"),
      now: () => 0,
    });
    const frame = makeFrame({ id: "f1" });
    const bad = {
      ...makeElement(frame.id, { id: "e1" }),
      style: { custom: { position: "sticky", color: "blue" } },
    };
    // A tampered version snapshot restored through the store must be sanitized.
    handle.loadSnapshot(makeDocument([frame, bad]) as never);
    expect(store.getState().document.nodes.e1?.style.custom).toEqual({
      color: "blue",
    });
    expect(store.getState().revision).toBe(1);
  });

  it("does not push remote batches onto the local undo stack", () => {
    const { store, handle } = createDocumentStore(fixture(), {
      clientId: asClientId("c1"),
      now: () => 0,
    });
    handle.applyRemote(
      {
        id: "b" as never,
        origin: "peer" as never,
        ops: [
          { type: "set-node-flags", nodeId: "e1" as never, name: "remote" },
        ],
        timestamp: 0,
      },
      "remote",
    );
    expect(store.getState().canUndo()).toBe(false);
    expect(store.getState().document.nodes.e1?.name).toBe("remote");
  });
});

describe("linked pair — convergence", () => {
  it("propagates a local edit to the peer", () => {
    const pair = createLinkedAdapterPair(fixture());
    pair.a.bundle.store
      .getState()
      .apply([
        { type: "set-node-flags", nodeId: "e1" as never, name: "from-A" },
      ]);
    expect(pair.b.bundle.store.getState().document.nodes.e1?.name).toBe(
      "from-A",
    );
    pair.dispose();
  });

  it("A's local undo does not appear on B's undo stack (undo isolation)", () => {
    const pair = createLinkedAdapterPair(fixture());
    pair.a.bundle.store
      .getState()
      .apply([{ type: "set-node-flags", nodeId: "e1" as never, name: "x" }]);
    pair.a.bundle.store.getState().undo();
    // B received both the edit and the undo as remote batches; it holds no undo entries.
    expect(pair.b.bundle.store.getState().canUndo()).toBe(false);
    expect(pair.b.bundle.store.getState().document.nodes.e1?.name).not.toBe(
      "x",
    );
    pair.dispose();
  });
});
