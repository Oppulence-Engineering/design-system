import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { CanvasProvider, CanvasRoot, type CanvasDocument } from "@oppulence/infinite-canvas";
import {
  CanvasInspectorPanel,
  CanvasLayersPanel,
  CanvasToolbar,
} from "@oppulence/infinite-canvas/panels";
import { registry, sampleDocument, selfIdentity } from "./fixture";

/**
 * The full editor shell: layers panel + toolbar + infinite canvas + inspector.
 * Pan with the trackpad, ⌘/ctrl-scroll to zoom, click to select, drag artboards,
 * and edit properties in the inspector.
 */
function EditorShell({ doc }: { doc: CanvasDocument }) {
  return (
    <CanvasProvider initialDocument={doc} registry={registry} self={selfIdentity}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr 260px",
          height: "100vh",
          font: "13px system-ui, sans-serif",
        }}
      >
        <CanvasLayersPanel />
        <div style={{ position: "relative", display: "grid", gridTemplateRows: "auto 1fr", minWidth: 0 }}>
          <CanvasToolbar />
          <CanvasRoot />
        </div>
        <CanvasInspectorPanel />
      </div>
    </CanvasProvider>
  );
}

const meta: Meta<typeof EditorShell> = {
  title: "Canvas/InfiniteCanvas",
  component: EditorShell,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof EditorShell>;

export const EditorShellStory: Story = {
  name: "Editor Shell",
  render: () => <EditorShell doc={sampleDocument()} />,
};

export const CanvasOnly: Story = {
  name: "Canvas Only",
  render: () => (
    <CanvasProvider initialDocument={sampleDocument()} registry={registry} self={selfIdentity}>
      <div style={{ height: "100vh" }}>
        <CanvasRoot />
      </div>
    </CanvasProvider>
  ),
  // Runtime proof: the canvas root and the sample artboards actually render.
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      const root = canvasElement.querySelector("[data-canvas-root]");
      expect(root).not.toBeNull();
    });
    await waitFor(() => {
      const heroTitle = canvasElement.querySelector('[data-canvas-node="hero-title"]');
      expect(heroTitle?.textContent).toContain("Design in real HTML");
    });
  },
};

export const EmptyDocument: Story = {
  name: "Empty Document",
  render: () => (
    <CanvasProvider
      initialDocument={{ schemaVersion: 1, id: "empty" as never, meta: { name: "Empty" }, nodes: {} }}
      registry={registry}
    >
      <div style={{ position: "relative", display: "grid", gridTemplateRows: "auto 1fr", height: "100vh" }}>
        <CanvasToolbar />
        <CanvasRoot />
      </div>
    </CanvasProvider>
  ),
};
