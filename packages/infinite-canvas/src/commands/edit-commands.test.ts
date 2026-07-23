import { describe, expect, it } from "vitest";
import {
  createSeededIdFactory,
  ROOT_PARENT,
  type NodeId,
} from "../document/ids";
import { makeDocument, makeElement, makeFrame } from "../testing/factories";
import { applyBatch, createState, type CanvasState } from "../operations/apply";
import { childrenOf } from "../operations/children-index";
import type { CanvasOperation } from "../operations/operations";
import type { ClipboardPayload } from "./clipboard";
import * as commands from "./edit-commands";
import type { CommandContext } from "./edit-commands";

function harness(state0: CanvasState) {
  let state = state0;
  let selection: readonly NodeId[] = [];
  let buffer: ClipboardPayload | null = null;
  const ctx: CommandContext = {
    getState: () => state,
    apply: (ops: readonly CanvasOperation[]) => {
      state = applyBatch(state, ops);
    },
    getSelection: () => selection,
    setSelection: (ids) => {
      selection = ids;
    },
    idFactory: createSeededIdFactory("cmd"),
    readBuffer: () => buffer,
    writeBuffer: (p) => {
      buffer = p;
    },
  };
  return {
    ctx,
    get state() {
      return state;
    },
    get selection() {
      return selection;
    },
  };
}

describe("edit commands", () => {
  it("duplicate adds an offset copy and selects it", () => {
    const frame = makeFrame({ id: "f1", x: 0, y: 0 });
    const h = harness(createState(makeDocument([frame])));
    h.ctx.setSelection(["f1" as NodeId]);
    commands.duplicate(h.ctx);
    const rootIds = childrenOf(h.state.childrenIndex, ROOT_PARENT);
    expect(rootIds).toHaveLength(2);
    expect(h.selection).toHaveLength(1);
    const dupId = h.selection[0]!;
    const dup = h.state.document.nodes[dupId];
    expect(dup?.type).toBe("frame");
    if (dup?.type === "frame") expect(dup.x).toBe(24); // offset
  });

  it("copy then paste inserts a fresh subtree", () => {
    const frame = makeFrame({ id: "f1" });
    const el = makeElement(frame.id, { id: "e1" });
    const h = harness(createState(makeDocument([frame, el])));
    h.ctx.setSelection(["f1" as NodeId]);
    commands.copy(h.ctx);
    commands.paste(h.ctx, { x: 10, y: 10 });
    // original 2 nodes + pasted frame + pasted child = 4
    expect(Object.keys(h.state.document.nodes)).toHaveLength(4);
  });

  it("group wraps a common-parent selection in a group, ungroup reverses", () => {
    const frame = makeFrame({ id: "f1" });
    const a = makeElement(frame.id, { id: "a" });
    const b = makeElement(frame.id, { id: "b" });
    const h = harness(createState(makeDocument([frame, a, b])));
    h.ctx.setSelection(["a" as NodeId, "b" as NodeId]);
    commands.group(h.ctx);
    const groupId = h.selection[0]!;
    expect(h.state.document.nodes[groupId]?.type).toBe("group");
    expect([...childrenOf(h.state.childrenIndex, groupId)].sort()).toEqual([
      "a",
      "b",
    ]);

    commands.ungroup(h.ctx, [groupId]);
    expect(h.state.document.nodes[groupId]).toBeUndefined();
    expect([...childrenOf(h.state.childrenIndex, frame.id)].sort()).toEqual([
      "a",
      "b",
    ]);
  });

  it("z-order: bringToFront moves a node after its siblings", () => {
    const frame = makeFrame({ id: "f1" });
    const a = makeElement(frame.id, { id: "a", sortKey: "a" });
    const b = makeElement(frame.id, { id: "b", sortKey: "b" });
    const c = makeElement(frame.id, { id: "c", sortKey: "c" });
    const h = harness(createState(makeDocument([frame, a, b, c])));
    commands.bringToFront(h.ctx, ["a" as NodeId]);
    const order = childrenOf(h.state.childrenIndex, frame.id);
    expect(order[order.length - 1]).toBe("a");
  });

  it("align left snaps artboards to the leftmost x", () => {
    const f1 = makeFrame({ id: "f1", x: 10, y: 0, width: 100, height: 100 });
    const f2 = makeFrame({ id: "f2", x: 50, y: 200, width: 100, height: 100 });
    const f3 = makeFrame({ id: "f3", x: 30, y: 400, width: 100, height: 100 });
    const h = harness(createState(makeDocument([f1, f2, f3])));
    commands.align(h.ctx, "left", ["f1", "f2", "f3"] as NodeId[]);
    const xs = ["f1", "f2", "f3"].map((id) => {
      const n = h.state.document.nodes[id];
      return n?.type === "frame" ? n.x : null;
    });
    expect(xs).toEqual([10, 10, 10]);
  });

  it("align hcenter centers artboards on the union center", () => {
    const f1 = makeFrame({ id: "f1", x: 0, y: 0, width: 100, height: 100 });
    const f2 = makeFrame({ id: "f2", x: 0, y: 200, width: 200, height: 100 });
    const h = harness(createState(makeDocument([f1, f2])));
    // union x-span 0..200, center 100 → f1 (w100)→50, f2 (w200)→0
    commands.align(h.ctx, "hcenter", ["f1", "f2"] as NodeId[]);
    const n1 = h.state.document.nodes.f1;
    const n2 = h.state.document.nodes.f2;
    expect(n1?.type === "frame" && n1.x).toBe(50);
    expect(n2?.type === "frame" && n2.x).toBe(0);
  });

  it("distribute horizontally equalizes gaps (ends fixed)", () => {
    // widths 100 each; first at 0, last at 500 (end 600). total 300, gap=(600-0-300)/2=150.
    const f1 = makeFrame({ id: "f1", x: 0, y: 0, width: 100, height: 100 });
    const f2 = makeFrame({ id: "f2", x: 220, y: 0, width: 100, height: 100 });
    const f3 = makeFrame({ id: "f3", x: 500, y: 0, width: 100, height: 100 });
    const h = harness(createState(makeDocument([f1, f2, f3])));
    commands.distribute(h.ctx, "horizontal", ["f1", "f2", "f3"] as NodeId[]);
    const x2 = h.state.document.nodes.f2;
    expect(x2?.type === "frame" && x2.x).toBe(250); // 0 + 100 + 150
    const x1 = h.state.document.nodes.f1;
    const x3 = h.state.document.nodes.f3;
    expect(x1?.type === "frame" && x1.x).toBe(0); // unchanged
    expect(x3?.type === "frame" && x3.x).toBe(500); // unchanged
  });

  it("align is a no-op below 2 positioned nodes / skips flow children", () => {
    const frame = makeFrame({ id: "f1", x: 0, y: 0 });
    const flow = makeElement(frame.id, { id: "e1" }); // no absolute position
    const h = harness(createState(makeDocument([frame, flow])));
    const before = JSON.stringify(h.state.document.nodes);
    commands.align(h.ctx, "left", ["f1", "e1"] as NodeId[]); // only f1 qualifies → <2
    expect(JSON.stringify(h.state.document.nodes)).toBe(before);
  });
});
