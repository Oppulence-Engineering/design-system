/**
 * Command palette (§ ⌘K). A searchable, keyboard-driven command launcher — press ⌘K /
 * Ctrl+K to open. Ships a default command set built from the CanvasApi/tools/export, and
 * accepts consumer commands. Power-user productivity without hunting through menus.
 */

"use client";

import * as React from "react";
import { TOOL_FRAME, TOOL_HAND, TOOL_SELECT, TOOL_TEXT } from "../tools/tool";
import { useCanvasApi, useSessionStore } from "../store/hooks";
import { useCanvasExport } from "../export/index";

export interface Command {
  id: string;
  label: string;
  group?: string;
  hint?: string;
  run: () => void;
}

export interface CanvasCommandPaletteProps {
  /** Extra commands merged with the built-ins. */
  commands?: readonly Command[];
  /** Disable the built-in ⌘K/Ctrl+K listener (open it yourself via `open`). */
  disableHotkey?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function useDefaultCommands(): Command[] {
  const api = useCanvasApi();
  const setTool = useSessionStore((s) => s.setTool);
  const exporter = useCanvasExport();
  return React.useMemo<Command[]>(
    () => [
      {
        id: "undo",
        label: "Undo",
        group: "Edit",
        hint: "⌘Z",
        run: () => api.history.undo(),
      },
      {
        id: "redo",
        label: "Redo",
        group: "Edit",
        hint: "⇧⌘Z",
        run: () => api.history.redo(),
      },
      {
        id: "duplicate",
        label: "Duplicate",
        group: "Edit",
        hint: "⌘D",
        run: () => api.commands.duplicate(),
      },
      {
        id: "group",
        label: "Group",
        group: "Edit",
        hint: "⌘G",
        run: () => api.commands.group(),
      },
      {
        id: "ungroup",
        label: "Ungroup",
        group: "Edit",
        run: () => api.commands.ungroup(),
      },
      {
        id: "front",
        label: "Bring to front",
        group: "Arrange",
        run: () => api.commands.bringToFront(),
      },
      {
        id: "back",
        label: "Send to back",
        group: "Arrange",
        run: () => api.commands.sendToBack(),
      },
      {
        id: "selectAll",
        label: "Select all",
        group: "Edit",
        hint: "⌘A",
        run: () => api.commands.selectAll(),
      },
      {
        id: "fit",
        label: "Zoom to fit",
        group: "View",
        hint: "⇧1",
        run: () => api.camera.zoomToFit(),
      },
      {
        id: "zoomSel",
        label: "Zoom to selection",
        group: "View",
        hint: "⇧2",
        run: () => api.camera.zoomToSelection(),
      },
      {
        id: "tool-select",
        label: "Tool: Select",
        group: "Tools",
        run: () => setTool(TOOL_SELECT),
      },
      {
        id: "tool-hand",
        label: "Tool: Hand",
        group: "Tools",
        run: () => setTool(TOOL_HAND),
      },
      {
        id: "tool-frame",
        label: "Tool: Frame",
        group: "Tools",
        run: () => setTool(TOOL_FRAME),
      },
      {
        id: "tool-text",
        label: "Tool: Text",
        group: "Tools",
        run: () => setTool(TOOL_TEXT),
      },
      {
        id: "export-html",
        label: "Copy as HTML",
        group: "Export",
        run: () => void navigator.clipboard?.writeText(exporter.toHtml()),
      },
      {
        id: "export-react",
        label: "Copy as React",
        group: "Export",
        run: () => void navigator.clipboard?.writeText(exporter.toReact().code),
      },
      {
        id: "print",
        label: "Print / PDF",
        group: "Export",
        run: () => exporter.printPdf(),
      },
    ],
    [api, setTool, exporter],
  );
}

export function CanvasCommandPalette(
  props: CanvasCommandPaletteProps,
): React.JSX.Element | null {
  const defaults = useDefaultCommands();
  const all = React.useMemo(
    () => [...defaults, ...(props.commands ?? [])],
    [defaults, props.commands],
  );
  const controlled = props.open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlled ? props.open! : internalOpen;
  const setOpen = React.useCallback(
    (v: boolean) => {
      if (!controlled) setInternalOpen(v);
      props.onOpenChange?.(v);
    },
    [controlled, props],
  );

  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (props.disableHotkey === true) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, props.disableHotkey, setOpen]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return all;
    return all.filter((c) =>
      `${c.group ?? ""} ${c.label}`.toLowerCase().includes(q),
    );
  }, [all, query]);

  if (!open) return null;

  const runAt = (i: number) => {
    const cmd = filtered[i];
    if (cmd !== undefined) {
      setOpen(false);
      cmd.run();
    }
  };

  return (
    <div
      data-canvas-command-palette=""
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "90vw",
          background: "var(--ic-artboard-bg,#fff)",
          borderRadius: 12,
          boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
          overflow: "hidden",
          font: "14px system-ui",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              runAt(active);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Type a command…"
          data-testid="command-input"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "14px 16px",
            border: "none",
            borderBottom: "1px solid var(--ic-border,#e4e4e7)",
            outline: "none",
            font: "15px system-ui",
            background: "transparent",
          }}
        />
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, color: "var(--ic-muted,#71717a)" }}>
              No commands
            </div>
          ) : (
            filtered.map((c, i) => (
              <div
                key={c.id}
                data-testid={`command-${c.id}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => runAt(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  cursor: "pointer",
                  background:
                    i === active
                      ? "var(--ic-accent-fade, rgba(59,130,246,0.12))"
                      : "transparent",
                }}
              >
                <span>
                  {c.group !== undefined ? (
                    <span
                      style={{
                        color: "var(--ic-muted,#71717a)",
                        marginRight: 8,
                      }}
                    >
                      {c.group}
                    </span>
                  ) : null}
                  {c.label}
                </span>
                {c.hint !== undefined ? (
                  <kbd
                    style={{
                      color: "var(--ic-muted,#71717a)",
                      font: "12px monospace",
                    }}
                  >
                    {c.hint}
                  </kbd>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
