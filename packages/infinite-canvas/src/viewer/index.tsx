/**
 * Read-only viewer / embed (§ embed). Renders a design (optionally filled with data) as
 * a non-editable, interactive document — the customer-facing invoice/report view, or an
 * embeddable share surface. Reuses the real renderer (live React components, bindings,
 * repeaters) but without the infinite-canvas editing chrome (no tools, pan, or overlay).
 */

"use client";

import * as React from "react";
import type { CanvasDocument } from "../document/document";
import { ROOT_PARENT, type NodeId } from "../document/ids";
import type { BindingData, FilterMap } from "../binding/resolve";
import type { ComponentRegistry } from "../registry/component-registry";
import type { CanvasTheme } from "../theme/theme";
import { CanvasProvider } from "../store/provider";
import { useCanvas } from "../store/context";
import { useChildren, useNode } from "../store/hooks";
import { NodeRenderer } from "../renderer/node-renderer";
import { styleToCss } from "../renderer/style-to-css";

export interface CanvasViewerProps {
  document: CanvasDocument;
  registry?: ComponentRegistry;
  /** Fill `{{…}}` bindings with this data (a specific invoice/report). */
  data?: BindingData;
  filters?: FilterMap;
  /** Render one artboard (default: all, stacked). */
  artboardId?: NodeId;
  theme?: CanvasTheme;
  /** Gap between stacked artboards (px). */
  gap?: number;
}

/** A single artboard rendered as a natural-flow document (not canvas-positioned). */
function ViewerArtboard({
  frameId,
}: {
  frameId: NodeId;
}): React.JSX.Element | null {
  const frame = useNode(frameId);
  const children = useChildren(frameId);
  if (frame === undefined || frame.type !== "frame" || !frame.visible)
    return null;
  const css = styleToCss(frame.style);
  return (
    <div
      data-canvas-viewer-artboard={frameId}
      style={{
        position: "relative",
        width: frame.width,
        minHeight: frame.height,
        overflow: frame.clipsContent ? "hidden" : "visible",
        background: "var(--ic-artboard-bg, #ffffff)",
        ...css,
      }}
    >
      {children.map((id) => (
        <NodeRenderer key={id} id={id} />
      ))}
    </div>
  );
}

function ViewerSurface({
  artboardId,
  gap = 24,
}: {
  artboardId?: NodeId;
  gap?: number;
}): React.JSX.Element {
  const { documentStore } = useCanvas();
  const roots = useChildren(ROOT_PARENT);
  const list = artboardId !== undefined ? [artboardId] : roots;
  // Content is interactive in view mode (real links/buttons work).
  return (
    <div
      data-canvas-viewer=""
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap,
        padding: gap,
      }}
    >
      {list.map((id) => {
        const node = documentStore.getState().document.nodes[id];
        if (node === undefined || node.type !== "frame") return null;
        return <ViewerArtboard key={id} frameId={id} />;
      })}
    </div>
  );
}

/**
 * Read-only render of a design. Mounts a `read`-access provider (no editing) with a
 * data-binding context, so filled templates render exactly as they will for the customer.
 */
export function CanvasViewer(props: CanvasViewerProps): React.JSX.Element {
  return (
    <CanvasProvider
      initialDocument={props.document}
      registry={props.registry}
      access="read"
      data={props.data}
      filters={props.filters}
      theme={props.theme}
    >
      <ViewerSurface artboardId={props.artboardId} gap={props.gap} />
    </CanvasProvider>
  );
}
