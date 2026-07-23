import { describe, expect, it } from "vitest";
import { asNodeId } from "../document/ids";
import { makeDocument, makeElement, makeFrame } from "../testing/factories";
import { applyBatch, createState } from "./apply";
import { buildChildrenIndex, childrenOf } from "./children-index";
import { invertBatch } from "./invert";
import type { CanvasOperation } from "./operations";
import { ROOT_PARENT } from "../document/ids";

function roundTripJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("applyBatch + invertBatch round-trip", () => {
  it("apply then apply(inverse) restores the exact prior document", () => {
    const frame = makeFrame({ id: "f1" });
    const el = makeElement(frame.id, { id: "e1" });
    const state = createState(makeDocument([frame, el]));

    const batches: CanvasOperation[][] = [
      [
        {
          type: "set-node-style",
          nodeId: el.id,
          set: { opacity: 0.5, color: "#f00" },
          unset: [],
        },
      ],
      [
        {
          type: "set-node-geometry",
          nodeId: frame.id,
          x: 100,
          y: 50,
          width: 800,
        },
      ],
      [
        {
          type: "set-node-flags",
          nodeId: el.id,
          name: "renamed",
          visible: false,
        },
      ],
      [{ type: "remove-node", nodeId: el.id }],
      [{ type: "move-node", nodeId: frame.id, parentId: null, sortKey: "z9" }],
    ];

    for (const ops of batches) {
      const inverse = invertBatch(state, ops);
      const after = applyBatch(state, ops);
      const restored = applyBatch(after, inverse);
      expect(restored.document.nodes).toEqual(state.document.nodes);
    }
  });

  it("inverse survives a JSON round-trip (set/unset carry deletion faithfully)", () => {
    const frame = makeFrame({ id: "f1" });
    const el = makeElement(frame.id, { id: "e1" });
    const state = createState(makeDocument([frame, el]));

    // Add a style key that did not exist — its inverse must UNSET it, and that must
    // survive JSON (an "undefined clears" design would be dropped by JSON.stringify).
    const ops: CanvasOperation[] = [
      {
        type: "set-node-style",
        nodeId: el.id,
        set: { color: "#abc" },
        unset: [],
      },
    ];
    const inverse = roundTripJson(invertBatch(state, ops));
    const after = applyBatch(state, roundTripJson(ops));
    expect(after.document.nodes[el.id]).toMatchObject({
      style: { color: "#abc" },
    });
    const restored = applyBatch(after, inverse);
    expect(restored.document.nodes[el.id]).toEqual(state.document.nodes[el.id]);
    expect(
      "color" in (restored.document.nodes[el.id] as { style: object }).style,
    ).toBe(false);
  });

  it("uses structural sharing: untouched nodes keep their reference", () => {
    const frame = makeFrame({ id: "f1" });
    const a = makeElement(frame.id, { id: "a" });
    const b = makeElement(frame.id, { id: "b" });
    const state = createState(makeDocument([frame, a, b]));

    const after = applyBatch(state, [
      {
        type: "set-node-style",
        nodeId: a.id,
        set: { opacity: 0.2 },
        unset: [],
      },
    ]);
    expect(after.document.nodes.a).not.toBe(state.document.nodes.a);
    expect(after.document.nodes.b).toBe(state.document.nodes.b); // untouched
    // Non-structural batch keeps the same childrenIndex reference.
    expect(after.childrenIndex).toBe(state.childrenIndex);
  });

  it("is transactional: a no-op-only batch returns the same state reference", () => {
    const frame = makeFrame({ id: "f1" });
    const state = createState(makeDocument([frame]));
    const after = applyBatch(state, [
      { type: "set-text", nodeId: asNodeId("missing"), text: "x" }, // node missing → no-op
    ]);
    expect(after).toBe(state);
  });
});

describe("children index", () => {
  it("orders siblings by (sortKey, id)", () => {
    const frame = makeFrame({ id: "f1" });
    const a = makeElement(frame.id, { id: "a", sortKey: "m" });
    const b = makeElement(frame.id, { id: "b", sortKey: "k" });
    const index = buildChildrenIndex(makeDocument([frame, a, b]).nodes);
    expect(childrenOf(index, frame.id)).toEqual(["b", "a"]); // k < m
  });

  it("breaks ties deterministically by id", () => {
    const frame = makeFrame({ id: "f1" });
    const a = makeElement(frame.id, { id: "y", sortKey: "same" });
    const b = makeElement(frame.id, { id: "x", sortKey: "same" });
    const index = buildChildrenIndex(makeDocument([frame, a, b]).nodes);
    expect(childrenOf(index, frame.id)).toEqual(["x", "y"]);
  });

  it("repairs orphans to root (parent missing)", () => {
    const frame = makeFrame({ id: "f1" });
    const orphan = makeElement(asNodeId("ghost"), { id: "o" }); // parent 'ghost' not in map
    const index = buildChildrenIndex(makeDocument([frame, orphan]).nodes);
    expect(childrenOf(index, ROOT_PARENT)).toContain("o");
  });

  it("breaks a parent cycle deterministically (largest id detaches to root)", () => {
    // a -> b -> a  (both frames, mutual parenting)
    const a = makeFrame({ id: "a" });
    const b = makeFrame({ id: "b" });
    const cyclicA = { ...a, parentId: b.id };
    const cyclicB = { ...b, parentId: a.id };
    const index = buildChildrenIndex(makeDocument([cyclicA, cyclicB]).nodes);
    // 'b' > 'a' → b detaches to root; a stays under b.
    expect(childrenOf(index, ROOT_PARENT)).toContain("b");
    expect(childrenOf(index, b.id)).toContain("a");
  });
});
