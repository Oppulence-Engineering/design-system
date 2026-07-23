import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CanvasProvider, CanvasRoot } from "@oppulence/infinite-canvas";
import {
  CanvasInspectorPanel,
  CanvasLayersPanel,
} from "@oppulence/infinite-canvas/panels";
import {
  InMemoryCollabAdapter,
  InMemoryHub,
} from "@oppulence/infinite-canvas/testing";
import { registry, sampleDocument } from "./fixture";

/**
 * Two independent editors sharing one in-memory hub — live multiplayer with no server.
 * Edit in one pane (drag an artboard, change a property) and watch it appear in the
 * other. Demonstrates the collab-ready document model + adapter contract.
 */
function CollabSimulation() {
  const hub = React.useMemo(() => new InMemoryHub(), []);
  const doc = React.useMemo(() => sampleDocument(), []);
  const collabA = React.useMemo(() => new InMemoryCollabAdapter(hub), [hub]);
  const collabB = React.useMemo(() => new InMemoryCollabAdapter(hub), [hub]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "1fr 1fr",
        height: "100vh",
        gap: 2,
        background: "#e4e4e7",
      }}
    >
      <Editor label="Client A" collab={collabA} doc={doc} accent="#3b82f6" />
      <Editor label="Client B" collab={collabB} doc={doc} accent="#10b981" />
    </div>
  );
}

function Editor({
  label,
  collab,
  doc,
  accent,
}: {
  label: string;
  collab: InMemoryCollabAdapter;
  doc: ReturnType<typeof sampleDocument>;
  accent: string;
}) {
  return (
    <CanvasProvider
      initialDocument={structuredClone(doc)}
      registry={registry}
      collab={collab}
      self={{
        clientId: label,
        userId: label,
        name: label,
        color: accent,
        access: "write",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "180px 1fr 220px",
          minHeight: 0,
        }}
      >
        <CanvasLayersPanel />
        <div style={{ position: "relative", minWidth: 0 }}>
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              zIndex: 5,
              padding: "2px 10px",
              borderRadius: 999,
              background: accent,
              color: "#fff",
              font: "600 12px system-ui",
            }}
          >
            {label}
          </div>
          <CanvasRoot />
        </div>
        <CanvasInspectorPanel />
      </div>
    </CanvasProvider>
  );
}

const meta: Meta<typeof CollabSimulation> = {
  title: "Canvas/CollabSimulation",
  component: CollabSimulation,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof CollabSimulation>;

export const TwoClients: Story = {
  name: "Two Clients (no server)",
  render: () => <CollabSimulation />,
};
