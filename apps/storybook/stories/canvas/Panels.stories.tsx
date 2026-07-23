import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CanvasProvider, CanvasRoot } from "@oppulence/infinite-canvas";
import { CanvasInspectorPanel, CanvasLayersPanel } from "@oppulence/infinite-canvas/panels";
import { registry, sampleDocument } from "./fixture";

const meta: Meta = {
  title: "Canvas/Panels",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

/** The layers panel beside the canvas — expand/collapse, hide/lock, click to select. */
export const LayersPanel: Story = {
  render: () => (
    <CanvasProvider initialDocument={sampleDocument()} registry={registry}>
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", height: "100vh" }}>
        <CanvasLayersPanel />
        <CanvasRoot />
      </div>
    </CanvasProvider>
  ),
};

/** The inspector — select a node in the canvas to edit its typed properties. */
export const InspectorPanel: Story = {
  render: () => (
    <CanvasProvider initialDocument={sampleDocument()} registry={registry}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", height: "100vh" }}>
        <CanvasRoot />
        <CanvasInspectorPanel />
      </div>
    </CanvasProvider>
  ),
};
