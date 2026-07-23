import { describe, expect, it } from "vitest";
import type { Rect } from "../viewport/geometry";
import { snapRect } from "./snapping";

describe("snapRect", () => {
  it("snaps a left edge to another rect's left within threshold", () => {
    const moving: Rect = { x: 103, y: 200, width: 100, height: 80 };
    const candidate: Rect = { x: 100, y: 0, width: 100, height: 80 };
    const result = snapRect(moving, [candidate], 6);
    expect(result.dx).toBe(-3); // move left edge 103 → 100
    expect(
      result.guides.some(
        (g) => g.orientation === "vertical" && g.position === 100,
      ),
    ).toBe(true);
  });

  it("does not snap outside the threshold", () => {
    const moving: Rect = { x: 140, y: 140, width: 100, height: 80 };
    const candidate: Rect = { x: 0, y: 0, width: 100, height: 80 };
    const result = snapRect(moving, [candidate], 6);
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
    expect(result.guides).toHaveLength(0);
  });

  it("snaps center-to-center", () => {
    const moving: Rect = { x: 48, y: 300, width: 100, height: 100 }; // center x = 98
    const candidate: Rect = { x: 50, y: 0, width: 100, height: 100 }; // center x = 100
    const result = snapRect(moving, [candidate], 6);
    expect(result.dx).toBe(2); // 98 → 100
  });
});
