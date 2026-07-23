/**
 * Layers panel (§8). Built on the headless `useLayerTree` hook. v1 uses plain styled
 * DOM chrome (themeable via the design-system CSS variables in canvas.css); swapping in
 * design-system `TreeView` is a follow-up that does not change the hook contract.
 */

"use client";

import * as React from "react";
import type { NodeId } from "../document/ids";
import { useLayerTree, type LayerRow } from "../headless/use-layer-tree";

export function CanvasLayersPanel(): React.JSX.Element {
  const tree = useLayerTree();
  return (
    <div
      data-canvas-panel="layers"
      role="tree"
      aria-label="Layers"
      style={{
        height: "100%",
        overflowY: "auto",
        font: "13px/1.5 system-ui, sans-serif",
        background: "var(--ic-artboard-bg, #fff)",
        borderRight: "1px solid var(--ic-border, #e4e4e7)",
      }}
    >
      {tree.rows.map((row) => (
        <LayerRowItem key={row.id} row={row} tree={tree} />
      ))}
    </div>
  );
}

function LayerRowItem({
  row,
  tree,
}: {
  row: LayerRow;
  tree: ReturnType<typeof useLayerTree>;
}): React.JSX.Element {
  return (
    <div
      role="treeitem"
      aria-selected={row.selected}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      onClick={(e) => tree.select(row.id, e.shiftKey || e.metaKey)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        paddingLeft: 8 + row.depth * 14,
        paddingRight: 8,
        height: 28,
        cursor: "default",
        background: row.selected
          ? "var(--ic-accent-fade, rgba(59,130,246,0.12))"
          : "transparent",
        opacity: row.visible ? 1 : 0.5,
      }}
    >
      {row.hasChildren ? (
        <button
          type="button"
          aria-label={row.expanded ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            tree.toggleExpanded(row.id);
          }}
          style={chevronStyle}
        >
          {row.expanded ? "▾" : "▸"}
        </button>
      ) : (
        <span style={{ width: 14 }} />
      )}
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {row.name}
      </span>
      <IconToggle
        active={row.visible}
        title={row.visible ? "Hide" : "Show"}
        onClick={() => tree.setVisible(row.id, !row.visible)}
      >
        {row.visible ? "◉" : "○"}
      </IconToggle>
      <IconToggle
        active={row.locked}
        title={row.locked ? "Unlock" : "Lock"}
        onClick={() => tree.setLocked(row.id, !row.locked)}
      >
        {row.locked ? "🔒" : "🔓"}
      </IconToggle>
    </div>
  );
}

function IconToggle({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ ...iconButtonStyle, opacity: active ? 1 : 0.4 }}
    >
      {children}
    </button>
  );
}

const chevronStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  color: "var(--ic-muted, #71717a)",
  fontSize: 10,
};

const iconButtonStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  fontSize: 11,
};

export type { NodeId };
