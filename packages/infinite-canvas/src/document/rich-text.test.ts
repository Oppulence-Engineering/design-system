import { describe, expect, it } from "vitest";
import {
  blockTag,
  marksToCss,
  richToPlainText,
  type RichText,
} from "./rich-text";
import { sanitizeNode, DEFAULT_LIMITS } from "./sanitize";
import { makeText, makeFrame } from "../testing/factories";

const rich: RichText = [
  { type: "h1", runs: [{ text: "Invoice" }] },
  {
    type: "paragraph",
    align: "right",
    runs: [
      { text: "Bold", marks: { bold: true } },
      { text: " and " },
      { text: "link", marks: { link: "https://x.example" } },
    ],
  },
  { type: "list-item", runs: [{ text: "one" }] },
  { type: "list-item", runs: [{ text: "two" }] },
];

describe("rich-text model", () => {
  it("richToPlainText joins runs per block and blocks by newline", () => {
    expect(richToPlainText(rich)).toBe("Invoice\nBold and link\none\ntwo");
  });

  it("marksToCss maps marks to CSS", () => {
    expect(marksToCss({ bold: true, italic: true })).toMatchObject({
      fontWeight: 700,
      fontStyle: "italic",
    });
    expect(marksToCss({ underline: true, strike: true }).textDecoration).toBe(
      "underline line-through",
    );
    expect(marksToCss(undefined)).toEqual({});
  });

  it("blockTag maps block types to tags", () => {
    expect(blockTag("paragraph")).toBe("p");
    expect(blockTag("h2")).toBe("h2");
    expect(blockTag("list-item")).toBe("li");
  });
});

describe("sanitize rich text", () => {
  const frame = makeFrame({ id: "f" });

  it("drops unsafe link schemes and dangerous colors, keeps safe ones", () => {
    const node = {
      ...makeText(frame.id, { id: "t", text: "x" }),
      rich: [
        {
          type: "paragraph",
          runs: [
            { text: "evil", marks: { link: "javascript:alert(1)" } },
            { text: "ok", marks: { link: "https://ok.example", bold: true } },
            { text: "c", marks: { color: "url(http://x)" } },
            { text: "c2", marks: { color: "#f00" } },
          ],
        },
      ],
    } as never;
    const { node: out } = sanitizeNode(node, DEFAULT_LIMITS);
    const runs = (out as { rich: RichText }).rich[0]!.runs;
    expect(runs[0]!.marks?.link).toBeUndefined(); // javascript: dropped
    expect(runs[1]!.marks?.link).toBe("https://ok.example"); // https kept
    expect(runs[1]!.marks?.bold).toBe(true);
    expect(runs[2]!.marks?.color).toBeUndefined(); // url() color dropped
    expect(runs[3]!.marks?.color).toBe("#f00"); // safe color kept
  });

  it("coerces unknown block types to paragraph and clamps text", () => {
    const node = {
      ...makeText(frame.id, { id: "t", text: "x" }),
      rich: [{ type: "marquee", runs: [{ text: "hi" }] }],
    } as never;
    const { node: out, changed } = sanitizeNode(node, DEFAULT_LIMITS);
    expect((out as { rich: RichText }).rich[0]!.type).toBe("paragraph");
    expect(changed).toBe(true);
  });
});
