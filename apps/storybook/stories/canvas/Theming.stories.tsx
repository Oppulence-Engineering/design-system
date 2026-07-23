import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  CanvasProvider,
  CanvasRoot,
  type CanvasTheme,
} from "@oppulence/infinite-canvas";
import {
  CanvasInspectorPanel,
  CanvasLayersPanel,
  CanvasToolbar,
} from "@oppulence/infinite-canvas/panels";
import { registry, sampleDocument, selfIdentity } from "./fixture";

const THEMES: Record<string, CanvasTheme | undefined> = {
  "Design system (default)": undefined,
  Grape: {
    accent: "#7c3aed",
    canvasBackground: "#faf5ff",
    artboardBackground: "#ffffff",
    border: "#e9d5ff",
    muted: "#7c3aed",
    gridColor: "#e9d5ff",
  },
  Emerald: {
    accent: "#059669",
    canvasBackground: "#ecfdf5",
    border: "#a7f3d0",
    muted: "#047857",
    gridColor: "#a7f3d0",
  },
  Midnight: {
    accent: "#38bdf8",
    canvasBackground: "#0b1120",
    artboardBackground: "#1e293b",
    border: "#334155",
    muted: "#94a3b8",
    gridColor: "#1e293b",
    showGrid: true,
  },
};

function ThemingDemo() {
  const [themeName, setThemeName] = React.useState("Grape");
  const theme = THEMES[themeName];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto 1fr",
        height: "100vh",
        font: "13px system-ui",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: 8,
          borderBottom: "1px solid #e4e4e7",
          background: "#fff",
          alignItems: "center",
        }}
      >
        <strong>Canvas theme:</strong>
        {Object.keys(THEMES).map((name) => (
          <button
            key={name}
            data-testid={`theme-${name}`}
            onClick={() => setThemeName(name)}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: "1px solid #e4e4e7",
              cursor: "pointer",
              background: themeName === name ? "#111827" : "#fff",
              color: themeName === name ? "#fff" : "#111",
            }}
          >
            {name}
          </button>
        ))}
        <span style={{ color: "#71717a" }}>
          ← the accent, grid, background & chrome all rebrand. Select a node to
          see the themed handles.
        </span>
      </div>
      {/* key forces a fresh provider per theme for a clean demo */}
      <CanvasProvider
        key={themeName}
        initialDocument={sampleDocument()}
        registry={registry}
        self={selfIdentity}
        theme={theme}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "200px 1fr 260px",
            minHeight: 0,
          }}
        >
          <CanvasLayersPanel />
          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateRows: "auto 1fr",
              minWidth: 0,
            }}
          >
            <CanvasToolbar />
            <CanvasRoot />
          </div>
          <CanvasInspectorPanel />
        </div>
      </CanvasProvider>
    </div>
  );
}

const meta: Meta<typeof ThemingDemo> = {
  title: "Canvas/Theming",
  component: ThemingDemo,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof ThemingDemo>;

export const BrandedCanvas: Story = {
  name: "Consumer-branded canvas",
  render: () => <ThemingDemo />,
  play: async ({ canvasElement }) => {
    // Switching theme sets the --ic-accent token on the theme wrapper.
    (
      canvasElement.querySelector(
        '[data-testid="theme-Emerald"]',
      ) as HTMLButtonElement
    )?.click();
    await waitFor(() => {
      const wrapper = canvasElement.querySelector(
        "[data-canvas-theme]",
      ) as HTMLElement;
      expect(wrapper?.style.getPropertyValue("--ic-accent")).toBe("#059669");
    });
  },
};
