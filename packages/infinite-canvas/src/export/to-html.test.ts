import { describe, expect, it } from "vitest";
import { asNodeId } from "../document/ids";
import {
  makeDocument,
  makeElement,
  makeFrame,
  makeText,
} from "../testing/factories";
import {
  cssToInline,
  escapeHtml,
  exportToHtml,
  renderTemplateToHtml,
} from "./to-html";
import { exportToReact } from "./to-react";

function invoiceDoc() {
  const frame = makeFrame({ id: "f", x: 0, y: 0, width: 400, height: 300 });
  const title = makeText(frame.id, {
    id: "t",
    text: "Total: {{invoice.total}}",
  });
  return { doc: makeDocument([frame, title]), frameId: frame.id };
}

describe("exportToHtml", () => {
  it("emits real HTML with inline styles", () => {
    const frame = makeFrame({ id: "f" });
    const el = makeElement(frame.id, {
      id: "e",
      tag: "a",
      attrs: { href: "https://x.example" },
    });
    const html = exportToHtml(makeDocument([frame, el]), frame.id);
    expect(html).toContain("<div");
    expect(html).toContain("<a");
    expect(html).toContain('href="https://x.example"');
  });

  it("resolves bindings when data is provided, else keeps the template", () => {
    const { doc, frameId } = invoiceDoc();
    const raw = exportToHtml(doc, frameId);
    expect(raw).toContain("{{invoice.total}}");
    const filled = exportToHtml(doc, frameId, {
      data: { invoice: { total: 500 } },
    });
    expect(filled).toContain("Total: 500");
    expect(filled).not.toContain("{{");
  });

  it("escapes HTML in text and attrs", () => {
    expect(escapeHtml('<script>"&')).toBe("&lt;script&gt;&quot;&amp;");
    const frame = makeFrame({ id: "f" });
    const t = makeText(frame.id, { id: "t", text: "<b>hi</b>" });
    const html = exportToHtml(makeDocument([frame, t]), frame.id);
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(html).not.toContain("<b>hi</b>");
  });

  it("emits a full standalone document when requested", () => {
    const { doc, frameId } = invoiceDoc();
    const html = exportToHtml(doc, frameId, {
      fullDocument: true,
      title: "Invoice",
    });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Invoice</title>");
  });

  it("cssToInline converts camelCase to kebab and adds px to numbers", () => {
    expect(cssToInline({ fontSize: "14px", marginTop: 8 })).toBe(
      "font-size: 14px; margin-top: 8px",
    );
  });

  it("paginates with @page, running header/footer, and no-break rows", () => {
    const { doc, frameId } = invoiceDoc();
    const html = exportToHtml(doc, frameId, {
      fullDocument: true,
      page: { size: "A4", margin: "18mm" },
      runningHeader: "<b>ACME</b>",
      runningFooter: "confidential",
    });
    expect(html).toContain("@page{size:A4;margin:18mm}");
    expect(html).toContain('class="ic-running-header"');
    expect(html).toContain("break-inside:avoid");
    expect(html).toContain("confidential");
  });

  it("running header/footer: literal HTML passes through, bound values are escaped", () => {
    const { doc, frameId } = invoiceDoc();
    const html = exportToHtml(doc, frameId, {
      fullDocument: true,
      page: { size: "A4" },
      data: { customer: { name: "<img src=x onerror=alert(1)>" } },
      runningHeader: "<div class='hdr'>Bill to: {{customer.name}}</div>", // literal HTML kept, binding escaped
      runningFooter: "Page footer",
    });
    // Literal structure survives.
    expect(html).toContain('<div class="ic-running-header">');
    expect(html).toContain("<div class='hdr'>Bill to:");
    // The bound (untrusted) value is HTML-escaped — no live <img> injected.
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    // Fixed positioning is scoped to @media print.
    expect(html).toContain("@media print{");
    expect(html).toContain(".ic-running-footer{position:fixed");
  });

  it("renderTemplateToHtml fills a template server-side (no browser)", () => {
    const { doc, frameId } = invoiceDoc();
    const html = renderTemplateToHtml(
      doc,
      { invoice: { total: 999 } },
      { artboardId: frameId },
    );
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Total: 999");
  });
});

describe("exportToReact", () => {
  it("keeps component instances as real components + collects imports", () => {
    const frame = makeFrame({ id: "f" });
    const cmp = { ...makeElement(frame.id, { id: "c" }) };
    // Build a component node manually.
    const doc = makeDocument([
      frame,
      {
        type: "component",
        id: asNodeId("c"),
        parentId: frame.id,
        sortKey: "a1",
        name: "Stat",
        visible: true,
        locked: false,
        rotation: 0,
        componentKey: "stat-card",
        props: { label: "MRR", value: "$1k" },
        style: {},
      },
    ]);
    const { code, componentImports } = exportToReact(doc, frame.id, {
      componentName: "Report",
    });
    expect(code).toContain("export function Report()");
    expect(code).toContain("<StatCard");
    expect(code).toContain('label={"MRR"}');
    expect(componentImports["stat-card"]).toBe("StatCard");
    void cmp;
  });
});
