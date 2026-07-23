import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  CanvasProvider,
  CanvasRoot,
  ResponsivePreview,
  useBlockLibrary,
  useDesignLint,
  type CanvasDocument,
} from "@oppulence/infinite-canvas";
import {
  CanvasPalette,
  CanvasInspectorPanel,
} from "@oppulence/infinite-canvas/panels";
import { registry, sampleDocument } from "./fixture";

const meta: Meta = {
  title: "Canvas/AdvancedFeatures",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

/* ---------- Palette + a11y lint + block library ---------- */

function LintPanel() {
  const { issues, select } = useDesignLint();
  const { blocks, saveBlock, insertBlock } = useBlockLibrary();
  return (
    <div
      style={{
        padding: 12,
        font: "13px system-ui",
        overflowY: "auto",
        borderLeft: "1px solid #e4e4e7",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div>
        <strong>Blocks</strong>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button
            data-testid="save-block"
            onClick={() => saveBlock("Saved block")}
            style={miniBtn}
          >
            Save selection
          </button>
        </div>
        {blocks.map((b) => (
          <button
            key={b.id}
            onClick={() => insertBlock(b.id)}
            style={{
              ...miniBtn,
              display: "block",
              width: "100%",
              marginTop: 4,
              textAlign: "left",
            }}
          >
            Insert “{b.name}”
          </button>
        ))}
      </div>
      <div>
        <strong>A11y lint ({issues.length})</strong>
        {issues.length === 0 ? (
          <div style={{ color: "#10b981", marginTop: 4 }}>No issues 🎉</div>
        ) : null}
        {issues.map((issue, i) => (
          <button
            key={i}
            data-testid="lint-issue"
            onClick={() => select(issue.nodeId)}
            style={{
              ...miniBtn,
              display: "block",
              width: "100%",
              marginTop: 4,
              textAlign: "left",
              borderColor: issue.severity === "error" ? "#e5484d" : "#f59e0b",
            }}
          >
            <strong>{issue.rule}</strong>: {issue.message}
          </button>
        ))}
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid #e4e4e7",
  cursor: "pointer",
  background: "#fff",
  font: "12px system-ui",
};

/** A doc with a deliberate contrast problem so the linter has something to report. */
function lintableDoc(): CanvasDocument {
  const doc = sampleDocument();
  // Hero subtitle is light grey on dark → fine; add a bad one by tweaking the CTA text color.
  const bad = doc.nodes["hero-sub"];
  if (bad?.type === "text") bad.style.color = "#334155"; // low contrast on the dark hero
  return doc;
}

export const PaletteBlocksAndLint: Story = {
  name: "Palette + blocks + a11y lint",
  render: () => (
    <CanvasProvider initialDocument={lintableDoc()} registry={registry}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr 300px",
          height: "100vh",
        }}
      >
        <CanvasPalette />
        <CanvasRoot />
        <LintPanel />
      </div>
    </CanvasProvider>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      // The linter surfaces the low-contrast subtitle.
      expect(
        canvasElement.querySelector('[data-testid="lint-issue"]'),
      ).not.toBeNull();
    });
  },
};

/* ---------- Responsive preview ---------- */

export const Responsive: Story = {
  name: "Responsive breakpoints",
  render: () => {
    const doc = sampleDocument();
    return (
      <div style={{ padding: 16, font: "13px system-ui" }}>
        <h3>Same design, three breakpoints (real flex reflow)</h3>
        <ResponsivePreview
          document={doc}
          artboardId={"dash" as never}
          widths={[375, 768, 1100]}
          height={260}
        />
      </div>
    );
  },
};

export const WithInspector: Story = {
  name: "Palette + inspector",
  render: () => (
    <CanvasProvider initialDocument={sampleDocument()} registry={registry}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr 280px",
          height: "100vh",
        }}
      >
        <CanvasPalette />
        <CanvasRoot />
        <CanvasInspectorPanel />
      </div>
    </CanvasProvider>
  ),
};
