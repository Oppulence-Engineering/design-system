import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  asDocumentId,
  asNodeId,
  CanvasProvider,
  CanvasRoot,
  useCanvasApi,
  type CanvasApi,
  type CanvasDocument,
  type RichText,
  type SceneNode,
} from "@oppulence/infinite-canvas";
import { useCanvasExport } from "@oppulence/infinite-canvas/export";
import { registry } from "./fixture";

const meta: Meta = {
  title: "Canvas/EditorFeatures",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

let seq = 0;
const key = () => `k${(seq++).toString(36).padStart(3, "0")}`;
function n(
  node: Partial<SceneNode> & Pick<SceneNode, "type" | "id">,
): SceneNode {
  const base = {
    parentId: null,
    sortKey: key(),
    name: node.type,
    visible: true,
    locked: false,
    rotation: 0,
  };
  return { ...base, ...(node as SceneNode) } as SceneNode;
}

const richInvoice: RichText = [
  { type: "h1", runs: [{ text: "INVOICE" }] },
  {
    type: "paragraph",
    runs: [
      { text: "Amount due: " },
      { text: "$4,200.00", marks: { bold: true, color: "#0f172a" } },
    ],
  },
  { type: "list-item", runs: [{ text: "Design system audit" }] },
  {
    type: "list-item",
    runs: [
      { text: "Terms — " },
      { text: "see policy", marks: { link: "https://example.com/terms" } },
    ],
  },
];

/** Three artboards at staggered positions, plus a rich-text artboard. */
function editorDoc(): CanvasDocument {
  seq = 0;
  const nodes: SceneNode[] = [
    n({
      type: "frame",
      id: asNodeId("a1"),
      name: "A1",
      x: 10,
      y: 20,
      width: 120,
      height: 100,
      clipsContent: true,
      style: { background: { type: "solid", color: "#3b82f6" } },
    } as never),
    n({
      type: "frame",
      id: asNodeId("a2"),
      name: "A2",
      x: 240,
      y: 120,
      width: 120,
      height: 100,
      clipsContent: true,
      style: { background: { type: "solid", color: "#10b981" } },
    } as never),
    n({
      type: "frame",
      id: asNodeId("a3"),
      name: "A3",
      x: 520,
      y: 60,
      width: 120,
      height: 100,
      clipsContent: true,
      style: { background: { type: "solid", color: "#f59e0b" } },
    } as never),
    n({
      type: "frame",
      id: asNodeId("inv"),
      name: "Invoice",
      x: 10,
      y: 260,
      width: 340,
      height: 260,
      clipsContent: true,
      style: {
        background: { type: "solid", color: "#ffffff" },
        padding: { top: 24, bottom: 24, left: 24, right: 24 },
      },
    } as never),
    n({
      type: "text",
      id: asNodeId("inv-body"),
      parentId: asNodeId("inv"),
      name: "Body",
      text: "INVOICE\nAmount due: $4,200.00",
      rich: richInvoice,
      style: { fontSize: 15, color: "#334155", lineHeight: 1.5 },
    } as never),
  ];
  const map: Record<string, SceneNode> = {};
  for (const node of nodes) map[node.id] = node;
  return {
    schemaVersion: 1,
    id: asDocumentId("editor-features"),
    meta: { name: "Editor Features" },
    nodes: map,
  };
}

const btn: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid #e4e4e7",
  cursor: "pointer",
  background: "#0f172a",
  color: "#fff",
  font: "12px system-ui",
};

function Toolbar({ apiRef }: { apiRef: React.RefObject<CanvasApi | null> }) {
  const api = useCanvasApi();
  const exporter = useCanvasExport();
  const [svgLen, setSvgLen] = React.useState(0);
  const boards = ["a1", "a2", "a3"].map((id) => asNodeId(id));
  React.useEffect(() => {
    apiRef.current = api;
  }, [api, apiRef]);
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        padding: 8,
        background: "#fff",
        borderBottom: "1px solid #e4e4e7",
        flexWrap: "wrap",
      }}
    >
      <button
        style={btn}
        data-testid="align-top"
        onClick={() => api.commands.align("top", boards)}
      >
        Align top
      </button>
      <button
        style={btn}
        data-testid="align-left"
        onClick={() => api.commands.align("left", boards)}
      >
        Align left
      </button>
      <button
        style={btn}
        data-testid="distribute-h"
        onClick={() => api.commands.distribute("horizontal", boards)}
      >
        Distribute H
      </button>
      <span style={{ width: 1, height: 20, background: "#e4e4e7" }} />
      <button
        style={btn}
        data-testid="to-svg"
        onClick={() => setSvgLen(exporter.toSvg(asNodeId("inv")).length)}
      >
        Export SVG
      </button>
      <span
        data-testid="svg-len"
        style={{ font: "12px system-ui", color: "#64748b" }}
      >
        svg:{svgLen}
      </span>
    </div>
  );
}

export const AlignDistributeExportRichText: Story = {
  name: "Align · Distribute · Image export · Rich text",
  render: () => {
    const apiRef = React.useRef<CanvasApi | null>(null);
    return (
      <CanvasProvider initialDocument={editorDoc()} registry={registry}>
        <div
          style={{
            display: "grid",
            gridTemplateRows: "auto 1fr",
            height: "100vh",
          }}
        >
          <Toolbar apiRef={apiRef} />
          <CanvasRoot />
        </div>
      </CanvasProvider>
    );
  },
  play: async ({ canvasElement }) => {
    const q = (sel: string) =>
      canvasElement.querySelector(sel) as HTMLElement | null;

    // Rich text renders as real block/inline HTML inside the invoice artboard.
    await waitFor(() => {
      const invoice = q('[data-canvas-node="inv-body"]');
      expect(invoice).not.toBeNull();
      expect(invoice?.querySelector("h1")?.textContent).toBe("INVOICE");
      expect(invoice?.querySelector("li")).not.toBeNull();
      const link = invoice?.querySelector("a") as HTMLAnchorElement | null;
      expect(link?.getAttribute("href")).toBe("https://example.com/terms");
    });

    // Align top → all three artboards share the minimum y (20).
    q('[data-testid="align-top"]')?.click();
    await waitFor(() => {
      const tops = ["a1", "a2", "a3"].map(
        (id) => q(`[data-canvas-node="${id}"]`)?.style.top ?? "",
      );
      expect(tops).toEqual(["20px", "20px", "20px"]);
    });

    // Image export produces a non-trivial SVG string.
    q('[data-testid="to-svg"]')?.click();
    await waitFor(() => {
      const len = Number(
        q('[data-testid="svg-len"]')?.textContent?.replace("svg:", "") ?? "0",
      );
      expect(len).toBeGreaterThan(100);
    });
  },
};
