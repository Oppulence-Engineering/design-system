import { describe, expect, it } from "vitest";
import {
  makeDocument,
  makeElement,
  makeFrame,
  makeText,
} from "../testing/factories";
import { contrastRatio, meetsAA, parseColor } from "./contrast";
import { lintDocument } from "./lint";

describe("contrast math", () => {
  it("parses hex, short hex, and rgb", () => {
    expect(parseColor("#000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseColor("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor("rgb(255, 0, 0)")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("computes the black/white contrast ratio as 21", () => {
    const ratio = contrastRatio(
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    );
    expect(Math.round(ratio)).toBe(21);
    expect(meetsAA(ratio, false)).toBe(true);
  });
});

describe("lintDocument", () => {
  it("flags low-contrast text on its background", () => {
    const frame = makeFrame({ id: "f" });
    frame.style.background = { type: "solid", color: "#ffffff" };
    const text = makeText(frame.id, { id: "t", text: "hi" });
    text.style.color = "#eeeeee"; // light grey on white → fails AA
    const issues = lintDocument(makeDocument([frame, text]));
    expect(issues.some((i) => i.rule === "contrast")).toBe(true);
  });

  it("passes good contrast", () => {
    const frame = makeFrame({ id: "f" });
    frame.style.background = { type: "solid", color: "#ffffff" };
    const text = makeText(frame.id, { id: "t", text: "hi" });
    text.style.color = "#111111";
    const issues = lintDocument(makeDocument([frame, text]));
    expect(issues.some((i) => i.rule === "contrast")).toBe(false);
  });

  it("flags images without alt text", () => {
    const frame = makeFrame({ id: "f" });
    const img = makeElement(frame.id, {
      id: "i",
      tag: "img",
      attrs: { src: "x.png" },
    });
    const issues = lintDocument(makeDocument([frame, img]));
    expect(issues.some((i) => i.rule === "img-alt")).toBe(true);
  });
});
