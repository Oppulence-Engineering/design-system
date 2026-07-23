/**
 * Headless inspector hook (§8). Resolves the inspector sections for the current
 * selection: built-in per-node-type sections, plus a component instance's registered
 * (or Zod-derived) sections. Store-only deps.
 */

"use client";

import * as React from "react";
import { z } from "zod";
import type { SceneNode, SceneNodeType } from "../document/nodes";
import { useCanvas } from "../store/context";
import { useDocumentStore, useSelection } from "../store/hooks";
import type { InspectorSection } from "../registry/inspector-controls";

/** Built-in sections per node type. */
const BUILT_IN: Record<SceneNodeType, InspectorSection[]> = {
  frame: [
    {
      id: "position",
      title: "Position & Size",
      controls: [
        {
          control: "number",
          label: "X",
          target: { kind: "geometry", key: "x" },
        },
        {
          control: "number",
          label: "Y",
          target: { kind: "geometry", key: "y" },
        },
        {
          control: "number",
          label: "W",
          target: { kind: "geometry", key: "width" },
          min: 0,
        },
        {
          control: "number",
          label: "H",
          target: { kind: "geometry", key: "height" },
          min: 0,
        },
      ],
    },
    layoutSection(),
    appearanceSection(),
  ],
  element: [layoutSection(), typographySection(), appearanceSection()],
  text: [
    {
      id: "text",
      title: "Text",
      controls: [
        { control: "text", label: "Content", target: { kind: "text" } },
      ],
    },
    typographySection(),
  ],
  component: [appearanceSection()],
  group: [layoutSection()],
};

function layoutSection(): InspectorSection {
  return {
    id: "layout",
    title: "Layout",
    controls: [
      {
        control: "select",
        label: "Display",
        target: { kind: "style", key: "display" },
        options: [
          { label: "Block", value: "block" },
          { label: "Flex", value: "flex" },
          { label: "Grid", value: "grid" },
          { label: "None", value: "none" },
        ],
      },
      {
        control: "select",
        label: "Direction",
        target: { kind: "style", key: "flexDirection" },
        options: [
          { label: "Row", value: "row" },
          { label: "Column", value: "column" },
        ],
      },
      {
        control: "number",
        label: "Gap",
        target: { kind: "style", key: "gap" },
        min: 0,
      },
    ],
  };
}

function typographySection(): InspectorSection {
  return {
    id: "typography",
    title: "Typography",
    controls: [
      {
        control: "number",
        label: "Size",
        target: { kind: "style", key: "fontSize" },
        min: 1,
      },
      {
        control: "number",
        label: "Weight",
        target: { kind: "style", key: "fontWeight" },
        min: 100,
        max: 900,
        step: 100,
      },
      {
        control: "color",
        label: "Color",
        target: { kind: "style", key: "color" },
      },
    ],
  };
}

function appearanceSection(): InspectorSection {
  return {
    id: "appearance",
    title: "Appearance",
    controls: [
      {
        control: "number",
        label: "Opacity",
        target: { kind: "style", key: "opacity" },
        min: 0,
        max: 1,
        step: 0.05,
      },
    ],
  };
}

/** Derive inspector controls from a component's Zod schema via the stable JSON-schema surface. */
function deriveFromSchema(schema: z.ZodType): InspectorSection[] {
  try {
    const json = z.toJSONSchema(schema) as {
      properties?: Record<string, { type?: string; enum?: unknown[] }>;
    };
    const props = json.properties ?? {};
    const controls = Object.entries(props).map(([key, prop]) => {
      const target = { kind: "component-prop" as const, key };
      if (Array.isArray(prop.enum)) {
        return {
          control: "select" as const,
          label: key,
          target,
          options: prop.enum.map((v) => ({
            label: String(v),
            value: v as never,
          })),
        };
      }
      if (prop.type === "number")
        return { control: "number" as const, label: key, target };
      if (prop.type === "boolean")
        return { control: "toggle" as const, label: key, target };
      return { control: "text" as const, label: key, target };
    });
    return controls.length > 0
      ? [{ id: "props", title: "Properties", controls }]
      : [];
  } catch {
    return [];
  }
}

export function useInspectorSections(): InspectorSection[] {
  const { registry } = useCanvas();
  const selection = useSelection();
  const nodes = useDocumentStore((s) => s.document.nodes);

  return React.useMemo(() => {
    const first = selection[0];
    if (first === undefined) return [];
    const node: SceneNode | undefined = nodes[first];
    if (node === undefined) return [];
    const base = BUILT_IN[node.type];
    if (node.type === "component") {
      const def = registry.get(node.componentKey);
      const componentSections =
        def?.inspector !== undefined
          ? [...def.inspector]
          : def !== undefined
            ? deriveFromSchema(def.schema)
            : [];
      return [...componentSections, ...base];
    }
    return base;
  }, [selection, nodes, registry]);
}
