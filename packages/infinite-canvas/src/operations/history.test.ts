import { describe, expect, it } from "vitest";
import { asNodeId } from "../document/ids";
import {
  canRedo,
  canUndo,
  createHistory,
  popRedo,
  popUndo,
  pushLocal,
  willCoalesce,
} from "./history";
import type { CanvasOperation } from "./operations";

const nodeId = asNodeId("n1");
const fwd: CanvasOperation[] = [{ type: "set-text", nodeId, text: "a" }];
const inv: CanvasOperation[] = [{ type: "set-text", nodeId, text: "b" }];

describe("history", () => {
  it("pushes entries and clears redo on a new local entry", () => {
    let h = createHistory();
    h = pushLocal(h, { undo: inv, redo: fwd, timestamp: 0 });
    expect(canUndo(h)).toBe(true);
    const popped = popUndo(h)!;
    expect(canRedo(popped.history)).toBe(true);
    // a fresh local entry after an undo clears redo
    const h2 = pushLocal(popped.history, {
      undo: inv,
      redo: fwd,
      timestamp: 10,
    });
    expect(canRedo(h2)).toBe(false);
  });

  it("coalesces within a gesture regardless of elapsed time", () => {
    let h = createHistory();
    h = pushLocal(h, { undo: inv, redo: fwd, gestureId: "g1", timestamp: 0 });
    h = pushLocal(h, {
      undo: inv,
      redo: fwd,
      gestureId: "g1",
      timestamp: 100_000,
    }); // long pause
    expect(h.undoStack).toHaveLength(1);
  });

  it("coalesces by key only within the window", () => {
    let h = createHistory();
    h = pushLocal(h, { undo: inv, redo: fwd, coalesceKey: "k", timestamp: 0 });
    h = pushLocal(h, {
      undo: inv,
      redo: fwd,
      coalesceKey: "k",
      timestamp: 100,
    }); // within 400ms
    expect(h.undoStack).toHaveLength(1);
    h = pushLocal(h, {
      undo: inv,
      redo: fwd,
      coalesceKey: "k",
      timestamp: 1000,
    }); // outside
    expect(h.undoStack).toHaveLength(2);
  });

  it("willCoalesce predicts the newUndoEntry signal", () => {
    let h = createHistory();
    h = pushLocal(h, { undo: inv, redo: fwd, gestureId: "g1", timestamp: 0 });
    expect(
      willCoalesce(h, { undo: inv, redo: fwd, gestureId: "g1", timestamp: 5 }),
    ).toBe(true);
    expect(
      willCoalesce(h, { undo: inv, redo: fwd, gestureId: "g2", timestamp: 5 }),
    ).toBe(false);
  });

  it("caps the undo stack", () => {
    let h = createHistory();
    for (let i = 0; i < 250; i++) {
      h = pushLocal(
        h,
        { undo: inv, redo: fwd, timestamp: i },
        { maxEntries: 100 },
      );
    }
    expect(h.undoStack).toHaveLength(100);
  });

  it("round-trips undo -> redo", () => {
    let h = createHistory();
    h = pushLocal(h, { undo: inv, redo: fwd, timestamp: 0 });
    const u = popUndo(h)!;
    expect(u.entry.undo).toBe(inv);
    const r = popRedo(u.history)!;
    expect(r.entry.redo).toBe(fwd);
    expect(canUndo(r.history)).toBe(true);
  });
});
