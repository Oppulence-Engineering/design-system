import { describe, expect, it } from "vitest";
import { makeDocument, makeFrame, makeText } from "../testing/factories";
import { diffCount, diffDocuments } from "./diff";

describe("diffDocuments", () => {
  it("detects added / removed / changed nodes", () => {
    const frame = makeFrame({ id: "f" });
    const a = makeDocument([
      frame,
      makeText(frame.id, { id: "keep", text: "same" }),
      makeText(frame.id, { id: "gone", text: "x" }),
    ]);
    const b = makeDocument([
      frame,
      { ...a.nodes.keep!, name: "keep" }, // unchanged
      makeText(frame.id, { id: "new", text: "hi" }),
    ]);
    // Change the 'keep' node in b.
    (b.nodes.keep as { text: string }).text = "changed";

    const diff = diffDocuments(a, b);
    expect(diff.added).toContain("new");
    expect(diff.removed).toContain("gone");
    expect(diff.changed).toContain("keep");
    expect(diffCount(diff)).toBeGreaterThanOrEqual(3);
  });

  it("reports no differences for identical documents", () => {
    const doc = makeDocument([makeFrame({ id: "f" })]);
    const clone = JSON.parse(JSON.stringify(doc));
    expect(diffCount(diffDocuments(doc, clone))).toBe(0);
  });

  it("detects meta changes (e.g. shared styles edited)", () => {
    const a = makeDocument([]);
    const b = makeDocument([]);
    (b.meta as Record<string, unknown>).styles = {
      s: { id: "s", name: "S", style: {} },
    };
    const diff = diffDocuments(a, b);
    expect(diff.metaChanged).toContain("styles");
  });
});
