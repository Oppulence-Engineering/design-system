/**
 * Responsive breakpoints (§ responsive). Because content is real flex/grid HTML, the
 * same design reflows at different widths. `useResponsive` resizes the selected artboard
 * to a breakpoint (live in the editor); `ResponsivePreview` renders an artboard fluidly
 * at several widths via the HTML exporter (data-binding-aware).
 */

"use client";

import * as React from "react";
import type { CanvasDocument } from "../document/document";
import type { NodeId } from "../document/ids";
import type { BindingData, FilterMap } from "../binding/resolve";
import { useBinding } from "../binding/context";
import { exportToHtml } from "../export/to-html";
import { useCanvas } from "../store/context";
import { useSelection } from "../store/hooks";

export interface Breakpoint {
  name: string;
  width: number;
}

export const BREAKPOINTS: readonly Breakpoint[] = [
  { name: "Mobile", width: 375 },
  { name: "Tablet", width: 768 },
  { name: "Desktop", width: 1280 },
];

export interface Responsive {
  breakpoints: readonly Breakpoint[];
  /** Resize the selected (or given) artboard to a width. */
  setArtboardWidth: (width: number, artboardId?: NodeId) => void;
  selectedArtboard: NodeId | undefined;
}

export function useResponsive(): Responsive {
  const { documentStore } = useCanvas();
  const selection = useSelection();
  const selectedArtboard = selection.find((id) => {
    const node = documentStore.getState().document.nodes[id];
    return node?.type === "frame" && node.parentId === null;
  });

  return {
    breakpoints: BREAKPOINTS,
    selectedArtboard,
    setArtboardWidth: (width, artboardId) => {
      const id = artboardId ?? selectedArtboard;
      if (id === undefined) return;
      documentStore
        .getState()
        .apply([{ type: "set-node-geometry", nodeId: id, width }]);
    },
  };
}

export interface ResponsivePreviewProps {
  document: CanvasDocument;
  artboardId: NodeId;
  widths?: readonly number[];
  data?: BindingData;
  filters?: FilterMap;
  height?: number;
}

/** Render an artboard fluidly at several widths (each in an isolated iframe). */
export function ResponsivePreview({
  document: doc,
  artboardId,
  widths,
  data,
  filters,
  height = 480,
}: ResponsivePreviewProps): React.JSX.Element {
  const list = widths ?? BREAKPOINTS.map((b) => b.width);
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        overflowX: "auto",
        padding: 16,
        alignItems: "flex-start",
      }}
    >
      {list.map((w) => {
        const html = exportToHtml(doc, artboardId, {
          fullDocument: true,
          rootWidthOverride: w,
          data,
          filters,
        });
        return (
          <div key={w} style={{ flex: "0 0 auto" }}>
            <div
              style={{
                font: "12px system-ui",
                color: "#71717a",
                marginBottom: 6,
              }}
            >
              {w}px
            </div>
            <iframe
              title={`preview-${w}`}
              srcDoc={html}
              style={{
                width: w,
                height,
                border: "1px solid #e4e4e7",
                borderRadius: 8,
                background: "#fff",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
