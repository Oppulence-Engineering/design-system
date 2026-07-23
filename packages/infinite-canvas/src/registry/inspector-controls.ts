/**
 * Inspector control descriptors (§8). A control addresses what it edits via a
 * DISCRIMINATED ACCESSOR mirroring the §4 op split — never a stringly path that could
 * rot against the op union. Each control dispatches to exactly one op type.
 */

import type { JsonValue } from "../document/json";

export type ControlTarget =
  | { kind: "style"; key: string } // dotted style key path, e.g. "padding.top"
  | { kind: "component-prop"; key: string }
  | { kind: "attr"; key: string }
  | { kind: "flag"; key: "name" | "visible" | "locked" | "clipsContent" }
  | { kind: "geometry"; key: "x" | "y" | "width" | "height" }
  | { kind: "text" };

export type ControlKind =
  | "text"
  | "number"
  | "select"
  | "color"
  | "toggle"
  | "dimension"
  | "box-edges"
  | "fill"
  | "shadow-list";

export interface InspectorControl {
  control: ControlKind;
  label: string;
  target: ControlTarget;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: readonly { label: string; value: JsonValue }[];
}

export interface InspectorSection {
  id: string;
  title: string;
  controls: readonly InspectorControl[];
}

/** Sentinel for a mixed-value multi-selection field. */
export const MIXED = Symbol("mixed");
export type Mixed = typeof MIXED;
