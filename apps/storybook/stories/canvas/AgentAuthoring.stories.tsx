import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { CanvasProvider, CanvasRoot } from "@oppulence/infinite-canvas";
import {
  useAgentAuthoring,
  type AgentCommand,
} from "@oppulence/infinite-canvas/agent";
import { registry } from "./fixture";

/** Canned "assistant" outputs — the shape an LLM would emit as a tool call. */
const RECIPES: { label: string; commands: AgentCommand[] }[] = [
  {
    label: "Build an invoice",
    commands: [
      {
        op: "add-frame",
        ref: "inv",
        name: "Invoice",
        x: 0,
        y: 0,
        width: 420,
        height: 520,
        layout: "column",
        background: "#ffffff",
        style: {
          padding: { top: 32, right: 32, bottom: 32, left: 32 },
          gap: 12,
        },
      },
      {
        op: "add-text",
        ref: "h",
        parent: "inv",
        text: "INVOICE",
        fontSize: 28,
        fontWeight: 800,
        color: "#0f172a",
      },
      {
        op: "add-text",
        parent: "inv",
        text: "Acme Corp — #INV-2043",
        fontSize: 13,
        color: "#64748b",
      },
      {
        op: "add-element",
        parent: "inv",
        tag: "div",
        style: {
          height: 1,
          background: { type: "solid", color: "#e2e8f0" },
          margin: { top: 8, bottom: 8, left: 0, right: 0 },
        },
      },
      {
        op: "add-text",
        parent: "inv",
        text: "Design services",
        fontSize: 15,
        color: "#0f172a",
      },
      {
        op: "add-text",
        parent: "inv",
        text: "Consulting",
        fontSize: 15,
        color: "#0f172a",
      },
      {
        op: "add-text",
        ref: "total",
        parent: "inv",
        text: "Total: $12,400.00",
        fontSize: 20,
        fontWeight: 700,
        color: "#0f172a",
        style: { margin: { top: 16, bottom: 0, left: 0, right: 0 } },
      },
    ],
  },
  {
    label: "Add a KPI row",
    commands: [
      {
        op: "add-frame",
        ref: "dash",
        name: "Dashboard",
        x: 480,
        y: 0,
        width: 560,
        height: 180,
        layout: "row",
        background: "#f8fafc",
        style: {
          padding: { top: 24, right: 24, bottom: 24, left: 24 },
          gap: 16,
        },
      },
      {
        op: "add-component",
        parent: "dash",
        componentKey: "stat-card",
        props: { label: "MRR", value: "$48.2k", accent: "#3b82f6" },
      },
      {
        op: "add-component",
        parent: "dash",
        componentKey: "stat-card",
        props: { label: "Churn", value: "1.8%", accent: "#f43f5e" },
      },
      {
        op: "add-component",
        parent: "dash",
        componentKey: "stat-card",
        props: { label: "NRR", value: "112%", accent: "#10b981" },
      },
    ],
  },
];

function Assistant() {
  const agent = useAgentAuthoring();
  const [json, setJson] = React.useState("");
  const [log, setLog] = React.useState<string>("");

  const runRecipe = (commands: AgentCommand[]) => {
    const result = agent.run(commands);
    setLog(
      result.ok ? `Applied ${result.applied} ops` : `Error: ${result.error}`,
    );
  };

  return (
    <div
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        font: "13px system-ui",
        height: "100%",
        boxSizing: "border-box",
        background: "#fff",
        borderRight: "1px solid #e4e4e7",
        overflowY: "auto",
      }}
    >
      <strong>Assistant</strong>
      <p style={{ color: "#71717a", margin: 0 }}>
        Canned LLM tool calls that drive the canvas via authoring commands.
      </p>
      {RECIPES.map((r) => (
        <button
          key={r.label}
          data-testid={`recipe-${r.label}`}
          onClick={() => runRecipe(r.commands)}
          style={btn}
        >
          {r.label}
        </button>
      ))}
      <hr style={{ width: "100%", border: 0, borderTop: "1px solid #eee" }} />
      <label style={{ color: "#71717a" }}>Or paste command JSON:</label>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={6}
        style={{
          font: "12px monospace",
          padding: 8,
          border: "1px solid #e4e4e7",
          borderRadius: 6,
        }}
        placeholder='[{"op":"add-frame","x":0,"y":0,"width":200,"height":120}]'
      />
      <button
        onClick={() => {
          try {
            setLog(JSON.stringify(agent.runCommandsJson(JSON.parse(json))));
          } catch (e) {
            setLog(`Parse error: ${String(e)}`);
          }
        }}
        style={btn}
      >
        Run JSON
      </button>
      <button
        onClick={() => setLog(JSON.stringify(agent.describe(), null, 2))}
        style={{
          ...btn,
          background: "#fff",
          color: "#111",
          border: "1px solid #e4e4e7",
        }}
      >
        Describe canvas (LLM context)
      </button>
      <pre
        style={{
          font: "11px monospace",
          color: "#334155",
          whiteSpace: "pre-wrap",
          margin: 0,
        }}
      >
        {log}
      </pre>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "none",
  background: "#3b82f6",
  color: "#fff",
  cursor: "pointer",
  font: "13px system-ui",
  textAlign: "left",
};

function AgentDemo() {
  return (
    <CanvasProvider
      initialDocument={{
        schemaVersion: 1,
        id: "agent" as never,
        meta: { name: "Agent Demo" },
        nodes: {},
      }}
      registry={registry}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          height: "100vh",
        }}
      >
        <Assistant />
        <CanvasRoot />
      </div>
    </CanvasProvider>
  );
}

const meta: Meta<typeof AgentDemo> = {
  title: "Canvas/AgentAuthoring",
  component: AgentDemo,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof AgentDemo>;

export const AssistantBuildsCanvas: Story = {
  name: "Assistant builds the canvas",
  render: () => <AgentDemo />,
  play: async ({ canvasElement }) => {
    // Click "Build an invoice" and assert the assistant's ops rendered real DOM.
    const button = canvasElement.querySelector(
      '[data-testid="recipe-Build an invoice"]',
    ) as HTMLButtonElement;
    button?.click();
    await waitFor(() => {
      const nodes = canvasElement.querySelectorAll("[data-canvas-node]");
      expect(nodes.length).toBeGreaterThan(3);
    });
    await waitFor(() => {
      expect(canvasElement.textContent).toContain("INVOICE");
    });
  },
};
