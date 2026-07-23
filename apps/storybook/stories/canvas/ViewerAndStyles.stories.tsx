import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  CanvasProvider,
  CanvasRoot,
  CanvasViewer,
  useStyleLibrary,
  type CanvasDocument,
  type SceneNode,
} from "@oppulence/infinite-canvas";
import { registry } from "./fixture";

/** A simple report doc where headings share a named style. */
function styledDoc(): CanvasDocument {
  let k = 0;
  const key = () => `a${(k++).toString(36).padStart(3, "0")}`;
  const base = (
    n: Partial<SceneNode> & Pick<SceneNode, "type" | "id">,
  ): SceneNode =>
    ({
      parentId: null,
      sortKey: key(),
      name: n.type,
      visible: true,
      locked: false,
      rotation: 0,
      ...n,
    }) as SceneNode;
  const nodes: SceneNode[] = [
    base({
      type: "frame",
      id: "r" as never,
      name: "Report",
      x: 0,
      y: 0,
      width: 420,
      height: 360,
      clipsContent: true,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: { top: 32, right: 32, bottom: 32, left: 32 },
        background: { type: "solid", color: "#fff" },
      },
    } as never),
    base({
      type: "text",
      id: "h1" as never,
      parentId: "r" as never,
      styleRef: "heading",
      text: "Q1 Revenue",
      style: {},
    } as never),
    base({
      type: "text",
      id: "body1" as never,
      parentId: "r" as never,
      text: "Up 24% YoY.",
      style: { fontSize: 14, color: "#475569" },
    } as never),
    base({
      type: "text",
      id: "h2" as never,
      parentId: "r" as never,
      styleRef: "heading",
      text: "Q2 Outlook",
      style: {},
    } as never),
    base({
      type: "text",
      id: "body2" as never,
      parentId: "r" as never,
      text: "Steady growth expected.",
      style: { fontSize: 14, color: "#475569" },
    } as never),
  ];
  const map: Record<string, SceneNode> = {};
  for (const n of nodes) map[n.id] = n;
  return {
    schemaVersion: 1,
    id: "styled" as never,
    meta: {
      name: "Report",
      styles: {
        heading: {
          id: "heading",
          name: "Heading",
          style: { fontSize: 24, fontWeight: 800, color: "#3b82f6" },
        },
      },
    } as never,
    nodes: map,
  };
}

const meta: Meta = {
  title: "Canvas/ViewerAndStyles",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

/** Edit the shared "Heading" style → BOTH headings update at once. */
function StyleEditor() {
  const lib = useStyleLibrary();
  const heading = lib.styles.find((s) => s.id === "heading");
  return (
    <div
      style={{
        padding: 12,
        borderBottom: "1px solid #e4e4e7",
        background: "#fff",
        display: "flex",
        gap: 8,
        alignItems: "center",
        font: "13px system-ui",
      }}
    >
      <strong>Shared style “Heading”:</strong>
      {["#3b82f6", "#7c3aed", "#059669"].map((c) => (
        <button
          key={c}
          data-testid={`style-${c}`}
          onClick={() =>
            lib.updateStyle("heading", { ...heading?.style, color: c })
          }
          style={{
            width: 28,
            height: 24,
            borderRadius: 6,
            border: "2px solid #fff",
            outline: "1px solid #e4e4e7",
            background: c,
            cursor: "pointer",
          }}
        />
      ))}
      <span style={{ color: "#71717a" }}>
        ← changing it re-styles every heading that references it.
      </span>
    </div>
  );
}

export const SharedStyles: Story = {
  name: "Shared styles (edit once, everywhere)",
  render: () => (
    <CanvasProvider initialDocument={styledDoc()} registry={registry}>
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto 1fr",
          height: "100vh",
        }}
      >
        <StyleEditor />
        <CanvasRoot />
      </div>
    </CanvasProvider>
  ),
  play: async ({ canvasElement }) => {
    (
      canvasElement.querySelector(
        '[data-testid="style-#059669"]',
      ) as HTMLButtonElement
    )?.click();
    await waitFor(() => {
      const h = canvasElement.querySelector(
        '[data-canvas-node="h1"]',
      ) as HTMLElement;
      // Heading color updated from the shared style.
      expect(h?.style.color.replace(/\s/g, "")).toMatch(
        /rgb\(5,150,105\)|#059669/,
      );
    });
  },
};

/** The read-only viewer — a customer-facing / embeddable render (no editing chrome). */
export const Embed: Story = {
  name: "Read-only viewer (embed / share)",
  render: () => (
    <div style={{ height: "100vh", overflow: "auto", background: "#f1f5f9" }}>
      <CanvasViewer
        document={styledDoc()}
        registry={registry}
        artboardId={"r" as never}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(
        canvasElement.querySelector("[data-canvas-viewer]"),
      ).not.toBeNull();
      expect(canvasElement.textContent).toContain("Q1 Revenue");
      // No editing chrome (no canvas root event surface).
      expect(canvasElement.querySelector("[data-canvas-root]")).toBeNull();
    });
  },
};
