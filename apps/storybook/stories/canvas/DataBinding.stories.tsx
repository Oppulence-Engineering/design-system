import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  CanvasProvider,
  CanvasRoot,
  type CanvasDocument,
  type SceneNode,
} from "@oppulence/infinite-canvas";
import { registry } from "./fixture";

/** An invoice TEMPLATE — text/props hold {{bindings}}, resolved against a data context. */
function templateDoc(): CanvasDocument {
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
      id: "inv" as never,
      name: "Invoice",
      x: 0,
      y: 0,
      width: 420,
      height: 640,
      clipsContent: true,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: { top: 36, right: 36, bottom: 36, left: 36 },
        background: { type: "solid", color: "#ffffff" },
      },
    } as never),
    base({
      type: "text",
      id: "t1" as never,
      parentId: "inv" as never,
      text: "INVOICE {{invoice.number}}",
      style: { fontSize: 26, fontWeight: 800, color: "#0f172a" },
    } as never),
    base({
      type: "text",
      id: "t2" as never,
      parentId: "inv" as never,
      text: "Billed to {{customer.name}}",
      style: { fontSize: 14, color: "#64748b" },
    } as never),
    base({
      type: "text",
      id: "t3" as never,
      parentId: "inv" as never,
      text: "Issued {{invoice.date | date}}",
      style: { fontSize: 14, color: "#64748b" },
    } as never),
    base({
      type: "element",
      id: "hr" as never,
      parentId: "inv" as never,
      tag: "div",
      attrs: {},
      style: {
        height: 1,
        background: { type: "solid", color: "#e2e8f0" },
        margin: { top: 8, bottom: 8, left: 0, right: 0 },
      },
    } as never),
    // Line items — a row that REPEATS over invoice.items (a variable-length list).
    base({
      type: "frame",
      id: "rows" as never,
      parentId: "inv" as never,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      clipsContent: false,
      style: { display: "flex", flexDirection: "column", gap: 4 },
    } as never),
    base({
      type: "frame",
      id: "row" as never,
      parentId: "rows" as never,
      repeat: "invoice.items",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      clipsContent: false,
      style: { display: "flex", justifyContent: "space-between" },
    } as never),
    base({
      type: "text",
      id: "row-desc" as never,
      parentId: "row" as never,
      text: "{{item.qty}}× {{item.description}}",
      style: { fontSize: 14, color: "#0f172a" },
    } as never),
    base({
      type: "text",
      id: "row-amt" as never,
      parentId: "row" as never,
      text: "{{item.amount | currency}}",
      style: { fontSize: 14, fontWeight: 600, color: "#0f172a" },
    } as never),
    // Conditional — only shows when there's a discount.
    base({
      type: "text",
      id: "discount" as never,
      parentId: "inv" as never,
      visibleWhen: "invoice.discount",
      text: "Discount applied: −{{invoice.discount | currency}}",
      style: { fontSize: 13, color: "#059669" },
    } as never),
    base({
      type: "text",
      id: "t4" as never,
      parentId: "inv" as never,
      text: "Amount due",
      style: { fontSize: 13, color: "#94a3b8", letterSpacing: 1 },
    } as never),
    base({
      type: "text",
      id: "t5" as never,
      parentId: "inv" as never,
      text: "{{invoice.total | currency:USD}}",
      style: { fontSize: 40, fontWeight: 800, color: "#0f172a" },
    } as never),
    base({
      type: "component",
      id: "stat" as never,
      parentId: "inv" as never,
      componentKey: "stat-card",
      props: {
        label: "Status",
        value: "{{invoice.status | upper}}",
        accent: "#10b981",
      },
      style: {
        width: 220,
        height: 100,
        margin: { top: 16, bottom: 0, left: 0, right: 0 } as never,
      },
    } as never),
  ];
  const map: Record<string, SceneNode> = {};
  for (const node of nodes) map[node.id] = node;
  return {
    schemaVersion: 1,
    id: "tmpl" as never,
    meta: { name: "Invoice Template" },
    nodes: map,
  };
}

const DATASETS = {
  Acme: {
    invoice: {
      number: "INV-2043",
      total: 12400,
      date: "2026-01-15",
      status: "paid",
      discount: 0,
      items: [
        { qty: 2, description: "Design sprint", amount: 6000 },
        { qty: 1, description: "Consulting", amount: 4400 },
        { qty: 4, description: "Support hours", amount: 2000 },
      ],
    },
    customer: { name: "Acme Corp" },
  },
  Globex: {
    invoice: {
      number: "INV-2044",
      total: 8750.5,
      date: "2026-02-02",
      status: "overdue",
      discount: 500,
      items: [
        { qty: 1, description: "Migration", amount: 7250.5 },
        { qty: 3, description: "Training", amount: 2000 },
      ],
    },
    customer: { name: "Globex Inc" },
  },
};

function DataBindingDemo() {
  const [dataset, setDataset] = React.useState<keyof typeof DATASETS | "none">(
    "Acme",
  );
  const doc = React.useMemo(() => templateDoc(), []);
  const data = dataset === "none" ? undefined : DATASETS[dataset];

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
        <strong>Render with data:</strong>
        {(["none", "Acme", "Globex"] as const).map((d) => (
          <button
            key={d}
            data-testid={`data-${d}`}
            onClick={() => setDataset(d)}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: "1px solid #e4e4e7",
              cursor: "pointer",
              background: dataset === d ? "#3b82f6" : "#fff",
              color: dataset === d ? "#fff" : "#111",
            }}
          >
            {d === "none" ? "Template (raw)" : d}
          </button>
        ))}
        <span style={{ color: "#71717a" }}>
          ← same design, different data. Double-click a text node to see the `
          {`{`}...{`}`}` template.
        </span>
      </div>
      <CanvasProvider initialDocument={doc} registry={registry} data={data}>
        <CanvasRoot />
      </CanvasProvider>
    </div>
  );
}

const meta: Meta<typeof DataBindingDemo> = {
  title: "Canvas/DataBinding",
  component: DataBindingDemo,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof DataBindingDemo>;

export const InvoiceTemplate: Story = {
  name: "Invoice template (design once, render with data)",
  render: () => <DataBindingDemo />,
  play: async ({ canvasElement }) => {
    // Default (Acme) data resolves the bindings to real values.
    await waitFor(() => {
      expect(canvasElement.textContent).toContain("INVOICE INV-2043");
      expect(canvasElement.textContent).toContain("$12,400.00");
      expect(canvasElement.textContent).toContain("Acme Corp");
      // Repeater expanded all 3 line items; conditional discount hidden (0).
      expect(canvasElement.textContent).toContain("2× Design sprint");
      expect(canvasElement.textContent).toContain("4× Support hours");
      expect(canvasElement.textContent).not.toContain("Discount applied");
    });
    // Switch datasets → different values, different line-item count, discount now shows.
    (
      canvasElement.querySelector(
        '[data-testid="data-Globex"]',
      ) as HTMLButtonElement
    )?.click();
    await waitFor(() => {
      expect(canvasElement.textContent).toContain("Globex Inc");
      expect(canvasElement.textContent).toContain("INV-2044");
      expect(canvasElement.textContent).toContain("1× Migration");
      expect(canvasElement.textContent).toContain("Discount applied");
    });
    // Raw template mode shows the {{…}} placeholders.
    (
      canvasElement.querySelector(
        '[data-testid="data-none"]',
      ) as HTMLButtonElement
    )?.click();
    await waitFor(() => {
      expect(canvasElement.textContent).toContain("{{invoice.number}}");
    });
  },
};
