/**
 * Toolbar (§8) — composed from design-system `Button`s (no className; variants only,
 * per the design-system rules). Tool switching, undo/redo with enabled state, zoom-fit.
 */

"use client";

import * as React from "react";
import { Button } from "@oppulence/design-system";
import {
  useActiveTool,
  useCanvasApi,
  useCanvasHistory,
  useSessionStore,
} from "../store/hooks";
import {
  TOOL_FRAME,
  TOOL_HAND,
  TOOL_SELECT,
  TOOL_TEXT,
  type ToolId,
} from "../tools/tool";

const TOOLS: { id: ToolId; label: string }[] = [
  { id: TOOL_SELECT, label: "Select" },
  { id: TOOL_HAND, label: "Hand" },
  { id: TOOL_FRAME, label: "Frame" },
  { id: TOOL_TEXT, label: "Text" },
];

export function CanvasToolbar(): React.JSX.Element {
  const api = useCanvasApi();
  const activeToolId = useActiveTool();
  const setTool = useSessionStore((s) => s.setTool);
  const { undo, redo, canUndo, canRedo } = useCanvasHistory();

  return (
    <div
      data-canvas-panel="toolbar"
      role="toolbar"
      aria-label="Canvas tools"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: 6,
        background: "var(--ic-artboard-bg, #fff)",
        borderBottom: "1px solid var(--ic-border, #e4e4e7)",
      }}
    >
      {TOOLS.map((tool) => (
        <Button
          key={tool.id}
          variant={activeToolId === tool.id ? "default" : "ghost"}
          size="sm"
          onClick={() => setTool(tool.id)}
        >
          {tool.label}
        </Button>
      ))}
      <div
        style={{
          width: 1,
          height: 20,
          background: "var(--ic-border,#e4e4e7)",
          margin: "0 4px",
        }}
      />
      <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo}>
        Undo
      </Button>
      <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo}>
        Redo
      </Button>
      <div style={{ flex: 1 }} />
      <Button
        variant="outline"
        size="sm"
        onClick={() => api.camera.zoomToFit()}
      >
        Fit
      </Button>
    </div>
  );
}
