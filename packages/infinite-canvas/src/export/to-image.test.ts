import { afterEach, describe, expect, it, vi } from "vitest";
import { makeDocument, makeFrame, makeText } from "../testing/factories";
import { exportToSvg, inlineSvgAssets } from "./to-image";

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

describe("inlineSvgAssets", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("leaves an SVG with no external assets untouched (no fetch)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const svg =
      '<svg><foreignObject><img src="data:image/png;base64,AAA"/></foreignObject></svg>';
    expect(await inlineSvgAssets(svg)).toBe(svg);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("replaces external http(s) img src and CSS url() with data URIs", async () => {
    // Deterministic FileReader + fetch stubs so the test needs no real network.
    class FakeFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(_blob: Blob) {
        this.result = "data:image/png;base64,STUB";
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", FakeFileReader);
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob()) }),
      ),
    );
    const svg =
      '<svg><foreignObject><img src="https://cdn.example.com/logo.png"/>' +
      '<div style="background:url(https://cdn.example.com/bg.jpg)"></div>' +
      "</foreignObject></svg>";
    const out = await inlineSvgAssets(svg);
    expect(out).not.toContain("https://cdn.example.com");
    expect(out).toContain("data:image/png;base64,STUB");
  });

  it("keeps the original URL when a fetch fails (best-effort)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("CORS"))),
    );
    const svg =
      '<svg><foreignObject><img src="https://x.example/a.png"/></foreignObject></svg>';
    expect(await inlineSvgAssets(svg)).toBe(svg);
  });
});
