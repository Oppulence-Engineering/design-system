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
});
