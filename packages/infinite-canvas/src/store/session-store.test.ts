import { describe, expect, it } from "vitest";
import { TOOL_SELECT } from "../tools/tool";
import { createSessionStore } from "./session-store";

function store() {
  return createSessionStore({ activeToolId: TOOL_SELECT });
}

describe("session store — setCamera", () => {
  it("preserves the reference on a value-equal set (no thrash / follow ping-pong)", () => {
    const s = store();
    s.getState().setCamera({ x: 10, y: 20, zoom: 2 });
    const ref = s.getState().camera;

    let notified = 0;
    const off = s.subscribe((state, prev) => {
      if (state.camera !== prev.camera) notified++;
    });
    // Same values → must be a no-op (same reference, no notification).
    s.getState().setCamera({ x: 10, y: 20, zoom: 2 });
    expect(s.getState().camera).toBe(ref);
    expect(notified).toBe(0);

    // A real change still updates + notifies.
    s.getState().setCamera({ x: 10, y: 20, zoom: 3 });
    expect(s.getState().camera).not.toBe(ref);
    expect(notified).toBe(1);
    off();
  });

  it("dedupes after zoom clamping (clamped-equal is still a no-op)", () => {
    const s = store();
    s.getState().setCamera({ x: 0, y: 0, zoom: 999 });
    const clamped = s.getState().camera;
    expect(clamped.zoom).toBeLessThan(999); // clamped
    // Another set to a different raw zoom that clamps to the same value → no-op.
    s.getState().setCamera({ x: 0, y: 0, zoom: 1000 });
    expect(s.getState().camera).toBe(clamped);
  });
});
