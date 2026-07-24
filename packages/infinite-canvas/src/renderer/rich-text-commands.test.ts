import { describe, expect, it } from "vitest";
import { domToRich } from "./rich-text";
import {
  applyLink,
  setBlockTag,
  toggleInlineMark,
  toggleUnorderedList,
} from "./rich-text-commands";

/** Build an editor whose innerHTML is a test-only fixture (never product code). */
function editor(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
}

function rangeOver(node: Text, start: number, end: number): Range {
  const r = document.createRange();
  r.setStart(node, start);
  r.setEnd(node, end);
  return r;
}

describe("rich-text-commands", () => {
  it("wraps a selection in a bold mark that domToRich recognizes", () => {
    const el = editor("<p>hello world</p>");
    const text = el.firstChild?.firstChild as Text;
    toggleInlineMark(el, rangeOver(text, 0, 5), "STRONG");
    expect(el.querySelector("strong")?.textContent).toBe("hello");
    const rich = domToRich(el);
    expect(rich[0]?.runs.find((r) => r.marks?.bold)?.text).toBe("hello");
  });

  it("toggles a mark off when the selection is fully inside it", () => {
    const el = editor("<p><strong>hello</strong> world</p>");
    const strongText = el.querySelector("strong")?.firstChild as Text;
    toggleInlineMark(el, rangeOver(strongText, 0, strongText.length), "STRONG");
    expect(el.querySelector("strong")).toBeNull();
    expect(el.textContent).toBe("hello world");
  });

  it("does not double-wrap when the range spans an existing same mark", () => {
    const el = editor("<p>a <em>b</em> c</p>");
    const p = el.firstChild as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(p);
    toggleInlineMark(el, range, "EM");
    // Exactly one <em> — the pre-existing nested one was flattened before re-wrapping.
    expect(el.querySelectorAll("em").length).toBe(1);
    expect(el.querySelector("em")?.textContent).toBe("a b c");
  });

  it("wraps a selection in a safe anchor", () => {
    const el = editor("<p>click here</p>");
    const text = el.firstChild?.firstChild as Text;
    applyLink(el, rangeOver(text, 0, 5), "https://x.example");
    const a = el.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://x.example");
    expect(a?.textContent).toBe("click");
    expect(domToRich(el)[0]?.runs.find((r) => r.marks?.link)?.marks?.link).toBe(
      "https://x.example",
    );
  });

  it("changes the block type of the touched block", () => {
    const el = editor("<p>title</p>");
    const range = document.createRange();
    range.selectNodeContents(el.firstChild as HTMLElement);
    setBlockTag(el, range, "H1");
    expect(el.querySelector("h1")?.textContent).toBe("title");
    expect(el.querySelector("p")).toBeNull();
    expect(domToRich(el)[0]?.type).toBe("h1");
  });

  it("toggles an unordered list on and back off", () => {
    const el = editor("<p>one</p><p>two</p>");
    const range = document.createRange();
    range.setStartBefore(el.firstChild as Node);
    range.setEndAfter(el.lastChild as Node);
    toggleUnorderedList(el, range);
    expect(el.querySelectorAll("ul > li").length).toBe(2);
    expect(domToRich(el).map((b) => b.type)).toEqual([
      "list-item",
      "list-item",
    ]);

    const list = el.querySelector("ul") as HTMLElement;
    const back = document.createRange();
    back.selectNode(list);
    toggleUnorderedList(el, back);
    expect(el.querySelector("ul")).toBeNull();
    expect(el.querySelectorAll("p").length).toBe(2);
  });
});
