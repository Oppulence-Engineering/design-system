/**
 * Inspector panel (§8) — composed from design-system form components (Input, Label,
 * Switch, Select, Popover; no className, per the rules) plus react-colorful for the
 * color control. Renders the resolved inspector sections for the current selection with
 * multi-select "Mixed" handling.
 */

"use client";

import * as React from "react";
import { HexColorPicker } from "react-colorful";
import {
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@oppulence/design-system";
import { useInspectorSections } from "../headless/use-inspector";
import { useSelectionProps } from "../headless/use-node-props";
import { useSelection } from "../store/hooks";
import { MIXED, type InspectorControl } from "../registry/inspector-controls";

export function CanvasInspectorPanel(): React.JSX.Element {
  const sections = useInspectorSections();
  const selection = useSelection();
  const { field } = useSelectionProps();

  return (
    <div
      data-canvas-panel="inspector"
      style={{
        height: "100%",
        overflowY: "auto",
        background: "var(--ic-artboard-bg, #fff)",
        borderLeft: "1px solid var(--ic-border, #e4e4e7)",
      }}
    >
      {selection.length === 0 ? (
        <div
          style={{
            padding: 16,
            color: "var(--ic-muted, #71717a)",
            font: "13px system-ui",
          }}
        >
          Nothing selected
        </div>
      ) : (
        sections.map((section) => (
          <section
            key={section.id}
            style={{
              borderBottom: "1px solid var(--ic-border, #e4e4e7)",
              padding: 12,
            }}
          >
            <h3
              style={{
                margin: "0 0 8px",
                font: "600 11px/1.4 system-ui",
                textTransform: "uppercase",
                letterSpacing: 0.4,
                color: "var(--ic-muted, #71717a)",
              }}
            >
              {section.title}
            </h3>
            <div style={{ display: "grid", gap: 8 }}>
              {section.controls.map((control, i) => (
                <ControlRow key={i} control={control} field={field} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function ControlRow({
  control,
  field,
}: {
  control: InspectorControl;
  field: ReturnType<typeof useSelectionProps>["field"];
}): React.JSX.Element {
  const f = field(control.target);
  const isMixed = f.value === MIXED;
  const value = isMixed ? "" : f.value;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 64, flexShrink: 0 }}>
        <Label>{control.label}</Label>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {control.control === "color" ? (
          <ColorControl
            value={typeof value === "string" ? value : "#000000"}
            onChange={(v) => f.setAll(v)}
          />
        ) : control.control === "toggle" ? (
          <Switch
            checked={value === true}
            onCheckedChange={(checked: boolean) => f.setAll(checked)}
          />
        ) : control.control === "select" ? (
          <Select
            value={typeof value === "string" ? value : undefined}
            onValueChange={(v: string | null) => {
              if (v !== null) f.setAll(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={isMixed ? "Mixed" : "—"} />
            </SelectTrigger>
            <SelectContent>
              {control.options?.map((opt) => (
                <SelectItem key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : control.control === "number" ? (
          <Input
            type="number"
            value={typeof value === "number" ? value : ""}
            placeholder={isMixed ? "Mixed" : ""}
            min={control.min}
            max={control.max}
            step={control.step}
            onChange={(e) =>
              f.setAll(e.target.value === "" ? 0 : Number(e.target.value))
            }
          />
        ) : (
          <Input
            type="text"
            value={typeof value === "string" ? value : ""}
            placeholder={isMixed ? "Mixed" : ""}
            onChange={(e) => f.setAll(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}

function ColorControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid var(--ic-border, #e4e4e7)",
              background: "var(--ic-artboard-bg, #fff)",
              cursor: "pointer",
              font: "13px system-ui",
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: value,
                border: "1px solid var(--ic-border,#e4e4e7)",
              }}
            />
            {value}
          </button>
        }
      />
      <PopoverContent>
        <HexColorPicker color={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}
