import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  CanvasProvider,
  CanvasRoot,
  useSelection,
} from "@oppulence/infinite-canvas";
import { useCanvasExport } from "@oppulence/infinite-canvas/export";
import { registry, sampleDocument } from "./fixture";

function ExportPanel() {
  const exporter = useCanvasExport();
  const selection = useSelection();
  const artboard = selection[0];
  const [mode, setMode] = React.useState<"html" | "react">("html");
  const [code, setCode] = React.useState("");

  const generate = (m: "html" | "react") => {
    setMode(m);
    setCode(
      m === "html"
        ? exporter.toHtml(artboard)
        : exporter.toReact(artboard).code,
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        height: "100%",
        boxSizing: "border-box",
        background: "#fff",
        borderLeft: "1px solid #e4e4e7",
        font: "13px system-ui",
        overflow: "hidden",
      }}
    >
      <strong>
        Export {artboard ? `(${artboard})` : "(select an artboard)"}
      </strong>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          data-testid="export-html"
          onClick={() => generate("html")}
          style={btn(mode === "html")}
        >
          HTML
        </button>
        <button
          data-testid="export-react"
          onClick={() => generate("react")}
          style={btn(mode === "react")}
        >
          React
        </button>
        <button onClick={() => exporter.printPdf(artboard)} style={btn(false)}>
          Print / PDF
        </button>
        <button
          onClick={() => exporter.downloadHtml(artboard)}
          style={btn(false)}
        >
          Download .html
        </button>
      </div>
      <pre
        data-testid="export-code"
        style={{
          flex: 1,
          overflow: "auto",
          margin: 0,
          padding: 10,
          background: "#0f172a",
          color: "#e2e8f0",
          borderRadius: 8,
          font: "11px/1.5 monospace",
          whiteSpace: "pre-wrap",
        }}
      >
        {code || "Select an artboard on the canvas, then click HTML or React."}
      </pre>
    </div>
  );
}

const btn = (active: boolean): React.CSSProperties => ({
  padding: "4px 12px",
  borderRadius: 6,
  border: "1px solid #e4e4e7",
  cursor: "pointer",
  background: active ? "#3b82f6" : "#fff",
  color: active ? "#fff" : "#111",
});

function ExportDemo() {
  return (
    <CanvasProvider initialDocument={sampleDocument()} registry={registry}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          height: "100vh",
        }}
      >
        <CanvasRoot />
        <ExportPanel />
      </div>
    </CanvasProvider>
  );
}

const meta: Meta<typeof ExportDemo> = {
  title: "Canvas/Export",
  component: ExportDemo,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof ExportDemo>;

export const DesignToCode: Story = {
  name: "Design → HTML / React / PDF",
  render: () => <ExportDemo />,
  play: async ({ canvasElement }) => {
    // Select the hero artboard, then export to HTML.
    (
      canvasElement.querySelector('[data-canvas-node="hero"]') as HTMLElement
    )?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    // Fall back: click the export button (works even without selection → whole doc).
    (
      canvasElement.querySelector(
        '[data-testid="export-html"]',
      ) as HTMLButtonElement
    )?.click();
    await waitFor(() => {
      const code = canvasElement.querySelector('[data-testid="export-code"]');
      expect(code?.textContent).toContain("<div");
    });
    (
      canvasElement.querySelector(
        '[data-testid="export-react"]',
      ) as HTMLButtonElement
    )?.click();
    await waitFor(() => {
      const code = canvasElement.querySelector('[data-testid="export-code"]');
      expect(code?.textContent).toContain("export function Design");
    });
  },
};
