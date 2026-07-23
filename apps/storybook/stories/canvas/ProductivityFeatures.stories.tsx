import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  CanvasCommandPalette,
  CanvasProvider,
  CanvasRoot,
  useFollow,
  useVersionHistory,
} from "@oppulence/infinite-canvas";
import {
  InMemoryCollabAdapter,
  InMemoryHub,
  InMemoryPresenceHub,
} from "@oppulence/infinite-canvas/testing";
import { registry, sampleDocument } from "./fixture";

const meta: Meta = {
  title: "Canvas/ProductivityFeatures",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

/* ---------- ⌘K command palette + version history ---------- */

function Toolbar() {
  const versions = useVersionHistory();
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: 8,
        borderBottom: "1px solid #e4e4e7",
        background: "#fff",
        font: "13px system-ui",
      }}
    >
      <span style={{ color: "#71717a" }}>
        Press{" "}
        <kbd
          style={{
            padding: "1px 6px",
            border: "1px solid #e4e4e7",
            borderRadius: 4,
          }}
        >
          ⌘K
        </kbd>{" "}
        for commands.
      </span>
      <span style={{ flex: 1 }} />
      <button
        data-testid="save-version"
        onClick={() => versions.saveVersion(`v${versions.versions.length + 1}`)}
        style={btn}
      >
        Save version
      </button>
      {versions.versions.map((v) => (
        <button
          key={v.id}
          data-testid={`restore-${v.label}`}
          onClick={() => versions.restore(v.id)}
          style={{ ...btn, background: "#fff", color: "#111" }}
        >
          Restore {v.label} ({versions.diff(v.id)?.changed.length ?? 0} changed)
        </button>
      ))}
    </div>
  );
}
const btn: React.CSSProperties = {
  padding: "4px 12px",
  borderRadius: 6,
  border: "1px solid #e4e4e7",
  cursor: "pointer",
  background: "#0f172a",
  color: "#fff",
};

export const CommandPaletteAndVersions: Story = {
  name: "⌘K palette + version history",
  render: () => (
    <CanvasProvider initialDocument={sampleDocument()} registry={registry}>
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto 1fr",
          height: "100vh",
        }}
      >
        <Toolbar />
        <CanvasRoot />
      </div>
      <CanvasCommandPalette />
    </CanvasProvider>
  ),
  play: async ({ canvasElement }) => {
    // Open the palette with ⌘K and assert a command is listed.
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
    await waitFor(() => {
      const palette = document.querySelector("[data-canvas-command-palette]");
      expect(palette).not.toBeNull();
      expect(palette?.textContent).toContain("Zoom to fit");
    });
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    // Save a version.
    (
      canvasElement.querySelector(
        '[data-testid="save-version"]',
      ) as HTMLButtonElement
    )?.click();
    await waitFor(() => {
      expect(
        canvasElement.querySelector('[data-testid="restore-v1"]'),
      ).not.toBeNull();
    });
  },
};

/* ---------- Follow-mode (two clients share presence) ---------- */

function FollowBar() {
  const { peers, followingId, follow, stop } = useFollow();
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: 8,
        background: "#fff",
        borderBottom: "1px solid #e4e4e7",
        font: "13px system-ui",
        alignItems: "center",
      }}
    >
      <span style={{ color: "#71717a" }}>Teammates:</span>
      {peers.length === 0 ? (
        <span style={{ color: "#a1a1aa" }}>none</span>
      ) : null}
      {peers.map((p) => (
        <button
          key={p.clientId}
          data-testid={`follow-${p.name}`}
          onClick={() =>
            followingId === p.clientId ? stop() : follow(p.clientId)
          }
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            border: "1px solid #e4e4e7",
            cursor: "pointer",
            background: followingId === p.clientId ? p.color : "#fff",
            color: followingId === p.clientId ? "#fff" : "#111",
          }}
        >
          {followingId === p.clientId
            ? `Following ${p.name}`
            : `Follow ${p.name}`}
        </button>
      ))}
    </div>
  );
}

function FollowDemo() {
  const hub = React.useMemo(() => new InMemoryHub(), []);
  const presence = React.useMemo(() => new InMemoryPresenceHub(), []);
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
      {[
        { label: "You", collab: collabA, accent: "#3b82f6" },
        { label: "Riley", collab: collabB, accent: "#f59e0b" },
      ].map((c) => (
        <CanvasProvider
          key={c.label}
          initialDocument={structuredClone(doc)}
          registry={registry}
          collab={c.collab}
          presence={presence.adapter()}
          self={{
            clientId: c.label,
            userId: c.label,
            name: c.label,
            color: c.accent,
            access: "write",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateRows: "auto 1fr",
              minHeight: 0,
            }}
          >
            <FollowBar />
            <CanvasRoot />
          </div>
        </CanvasProvider>
      ))}
    </div>
  );
}

export const FollowMode: Story = {
  name: "Follow a teammate's viewport",
  render: () => <FollowDemo />,
  play: async ({ canvasElement }) => {
    // Each pane sees the other as a teammate to follow.
    await waitFor(() => {
      expect(
        canvasElement.querySelector('[data-testid="follow-Riley"]'),
      ).not.toBeNull();
      expect(
        canvasElement.querySelector('[data-testid="follow-You"]'),
      ).not.toBeNull();
    });
  },
};
