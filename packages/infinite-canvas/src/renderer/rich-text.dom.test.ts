import { describe, expect, it } from "vitest";
import type { RichText } from "../document/rich-text";
import { domToRich } from "./rich-text";

function editable(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html; // test-only fixture (not product code)
  return el;
}

describe("domToRich", () => {
  it("serializes block + inline formatting the browser produces", () => {
    const el = editable(
      "<h1>Title</h1><p>hi <b>bold</b> <i>it</i> <a href='https://x.example'>link</a></p>",
    );
    const rich = domToRich(el);
    expect(rich[0]).toMatchObject({ type: "h1" });
    expect(rich[0]!.runs[0]!.text).toBe("Title");
    const p = rich[1]!;
    expect(p.type).toBe("paragraph");
    expect(p.runs.find((r) => r.marks?.bold)?.text).toBe("bold");
    expect(p.runs.find((r) => r.marks?.italic)?.text).toBe("it");
    expect(p.runs.find((r) => r.marks?.link)?.marks?.link).toBe(
      "https://x.example",
    );
  });

  it("drops an unsafe link href during serialization", () => {
    const el = editable("<p><a href='javascript:alert(1)'>x</a></p>");
    const rich = domToRich(el);
    expect(rich[0]!.runs[0]!.marks?.link).toBeUndefined();
  });

  it("groups <ul><li> into list-item blocks", () => {
    const el = editable("<ul><li>one</li><li>two</li></ul>");
    const rich = domToRich(el);
    expect(rich.map((b) => b.type)).toEqual(["list-item", "list-item"]);
  });

  it("treats bare inline content as a single paragraph", () => {
    const el = editable("just text");
    const rich: RichText = domToRich(el);
    expect(rich).toHaveLength(1);
    expect(rich[0]).toMatchObject({ type: "paragraph" });
    expect(rich[0]!.runs[0]!.text).toBe("just text");
  });
});
