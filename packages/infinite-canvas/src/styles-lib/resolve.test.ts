import { describe, expect, it } from "vitest";
import { makeDocument, makeText } from "../testing/factories";
import { exportToHtml } from "../export/to-html";
import { resolveNodeStyle, stylesFromMeta } from "./resolve";

describe("shared styles", () => {
  it("resolves a styleRef as base with node.style overriding", () => {
    const node = makeText("p" as never, { id: "t" });
    node.styleRef = "heading";
    node.style = { color: "#f00" }; // node override
    const styles = {
      heading: {
        id: "heading",
        name: "Heading",
        style: { fontSize: 28, color: "#111" },
      },
    };
    const resolved = resolveNodeStyle(node, styles);
    expect(resolved.fontSize).toBe(28); // from shared style
    expect(resolved.color).toBe("#f00"); // node override wins
  });

  it("returns node.style when no styleRef / missing style", () => {
    const node = makeText("p" as never, { id: "t" });
    node.style = { fontSize: 12 };
    expect(resolveNodeStyle(node, {})).toEqual({ fontSize: 12 });
  });

  it("reads styles out of document meta", () => {
    const doc = makeDocument([]);
    (doc.meta as Record<string, unknown>).styles = {
      a: { id: "a", name: "A", style: { color: "#0f0" } },
    };
    expect(Object.keys(stylesFromMeta(doc.meta))).toEqual(["a"]);
  });

  it("export applies shared styles (edit once, everywhere)", () => {
    const t1 = makeText("f" as never, { id: "t1" });
    t1.styleRef = "brand";
    const t2 = makeText("f" as never, { id: "t2" });
    t2.styleRef = "brand";
    const frame = { ...makeText("root" as never, { id: "x" }) };
    void frame;
    const doc = makeDocument([
      { ...t1, parentId: null },
      { ...t2, parentId: null },
    ]);
    (doc.meta as Record<string, unknown>).styles = {
      brand: {
        id: "brand",
        name: "Brand",
        style: { color: "#7c3aed", fontWeight: 700 },
      },
    };
    const html = exportToHtml(doc);
    // Both nodes get the brand color from the shared style.
    expect((html.match(/color: #7c3aed/g) ?? []).length).toBe(2);
  });
});
