import * as React from "react";
import { z } from "zod";
import {
  asDocumentId,
  asNodeId,
  createComponentRegistry,
  defineComponent,
  type CanvasDocument,
  type SceneNode,
} from "@oppulence/infinite-canvas";

/* ---- a registered component the canvas can place ---- */

const StatCard = ({ label, value, accent }: { label: string; value: string; accent: string }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
      padding: 20,
      borderRadius: 12,
      background: "#fff",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      border: "1px solid #eee",
      height: "100%",
      boxSizing: "border-box",
    }}
  >
    <span style={{ fontSize: 12, color: "#71717a", textTransform: "uppercase", letterSpacing: 0.5 }}>
      {label}
    </span>
    <span style={{ fontSize: 28, fontWeight: 700, color: accent }}>{value}</span>
  </div>
);

export const registry = createComponentRegistry({
  "stat-card": defineComponent({
    key: "stat-card",
    label: "Stat Card",
    schema: z.object({ label: z.string(), value: z.string(), accent: z.string() }),
    component: StatCard,
    defaultProps: { label: "Revenue", value: "$12.4k", accent: "#3b82f6" },
    defaultSize: { width: 220, height: 120 },
  }),
});

/* ---- helpers to build nodes tersely ---- */

let seq = 0;
const key = () => `a${(seq++).toString(36).padStart(3, "0")}`;

function n(node: Partial<SceneNode> & Pick<SceneNode, "type" | "id">): SceneNode {
  return {
    parentId: null,
    sortKey: key(),
    name: node.type,
    visible: true,
    locked: false,
    rotation: 0,
    ...(node as SceneNode),
  };
}

/** A sample design: two artboards with real HTML layout, text, and a component instance. */
export function sampleDocument(): CanvasDocument {
  seq = 0;
  const hero = asNodeId("hero");
  const heroTitle = asNodeId("hero-title");
  const heroSub = asNodeId("hero-sub");
  const heroCta = asNodeId("hero-cta");
  const dash = asNodeId("dash");
  const dashRow = asNodeId("dash-row");
  const stat1 = asNodeId("stat1");
  const stat2 = asNodeId("stat2");

  const nodes: SceneNode[] = [
    // Artboard 1 — a hero
    n({
      type: "frame",
      id: hero,
      name: "Hero",
      x: 0,
      y: 0,
      width: 480,
      height: 320,
      clipsContent: true,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: { top: 0, bottom: 0, left: 0, right: 0 } as never,
        alignItems: "flex-start",
        justifyContent: "center",
        padding: { top: 48, bottom: 48, left: 40, right: 40 },
        background: { type: "solid", color: "#0f172a" },
      },
    } as never),
    n({
      type: "text",
      id: heroTitle,
      parentId: hero,
      name: "Title",
      text: "Design in real HTML.",
      style: { fontSize: 40, fontWeight: 800, color: "#ffffff", lineHeight: 1.1 },
    } as never),
    n({
      type: "text",
      id: heroSub,
      parentId: hero,
      name: "Subtitle",
      text: "An infinite canvas that renders the components you ship.",
      style: { fontSize: 16, color: "#94a3b8", lineHeight: 1.5 },
    } as never),
    n({
      type: "element",
      id: heroCta,
      parentId: hero,
      name: "Button",
      tag: "button",
      attrs: {},
      style: {
        padding: { top: 10, bottom: 10, left: 20, right: 20 },
        background: { type: "solid", color: "#3b82f6" },
        color: "#ffffff",
        borderRadius: { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
        fontSize: 14,
        fontWeight: 600,
        margin: { top: 8, bottom: 0, left: 0, right: 0 },
      },
    } as never),

    // Artboard 2 — a dashboard row with two component instances
    n({
      type: "frame",
      id: dash,
      name: "Dashboard",
      x: 560,
      y: 0,
      width: 520,
      height: 220,
      clipsContent: true,
      style: {
        display: "flex",
        padding: { top: 32, bottom: 32, left: 32, right: 32 },
        background: { type: "solid", color: "#f8fafc" },
      },
    } as never),
    n({
      type: "frame",
      id: dashRow,
      parentId: dash,
      name: "Row",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      clipsContent: false,
      style: { display: "flex", gap: 16, width: { unit: "%", value: 100 } as never },
    } as never),
    n({
      type: "component",
      id: stat1,
      parentId: dashRow,
      name: "Revenue",
      componentKey: "stat-card",
      props: { label: "Revenue", value: "$12.4k", accent: "#3b82f6" },
      style: { width: 220, height: 120 },
    } as never),
    n({
      type: "component",
      id: stat2,
      parentId: dashRow,
      name: "Users",
      componentKey: "stat-card",
      props: { label: "Active Users", value: "1,204", accent: "#10b981" },
      style: { width: 220, height: 120 },
    } as never),
  ];

  const map: Record<string, SceneNode> = {};
  for (const node of nodes) map[node.id] = node;

  return {
    schemaVersion: 1,
    id: asDocumentId("sample"),
    meta: { name: "Sample Design" },
    nodes: map,
  };
}

export const selfIdentity = {
  clientId: "me",
  userId: "u1",
  name: "You",
  color: "#3b82f6",
  access: "write" as const,
};
