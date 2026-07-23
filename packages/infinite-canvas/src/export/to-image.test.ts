import { describe, expect, it } from "vitest";
import { makeDocument, makeFrame, makeText } from "../testing/factories";
import { exportToSvg } from "./to-image";

function doc() {
  const frame = makeFrame({ id: "f", x: 40, y: 60, width: 320, height: 200 });
  const title = makeText(frame.id, { id: "t", text: "Total: {{total}}" });
  return { doc: makeDocument([frame, title]), frameId: frame.id };
}

describe("exportToSvg", () => {
  it("wraps an artboard in a correctly-sized SVG foreignObject", () => {
    const { doc: d, frameId } = doc();
    const svg = exportToSvg(d, frameId);
    expect(svg.startsWith("<svg")).toBe(true);
    // Uses the frame's stored geometry (not its canvas x/y offset).
    expect(svg).toContain('width="320" height="200"');
    expect(svg).toContain('viewBox="0 0 320 200"');
    expect(svg).toContain("<foreignObject");
    expect(svg).toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });

  it("resolves bindings when data is provided", () => {
    const { doc: d, frameId } = doc();
    expect(exportToSvg(d, frameId)).toContain("{{total}}"); // template kept
    const filled = exportToSvg(d, frameId, { data: { total: 42 } });
    expect(filled).toContain("Total: 42");
    expect(filled).not.toContain("{{");
  });

  it("escapes the background and defaults to the first artboard", () => {
    const { doc: d } = doc();
    const svg = exportToSvg(d, undefined, { background: '"><script>' });
    expect(svg).toContain("&quot;&gt;&lt;script&gt;");
    expect(svg).not.toContain('background:"><script>');
  });

  it("returns empty string when there is no artboard", () => {
    expect(exportToSvg(makeDocument([]))).toBe("");
  });
});
