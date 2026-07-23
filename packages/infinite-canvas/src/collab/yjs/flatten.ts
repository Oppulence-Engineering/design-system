/**
 * Node ↔ flat-key translation for the Y.Doc (§10). Each node is one flat Y.Map with
 * DOTTED string keys — `style.fill`, `style.padding.top`, `attrs.href`,
 * `componentProps.label` — never nested Y.Maps. Known compound style values flatten one
 * level deeper so concurrent sub-property edits merge; other objects/arrays are single
 * LWW registers. The forbidden-segment guard runs on every key during un-flatten.
 */

import { hasForbiddenSegment } from "../../document/keys";
import { COMPOUND_STYLE_KEYS } from "../../document/styles";
import type { JsonValue } from "../../document/json";
import type { SceneNode } from "../../document/nodes";

type Flat = Record<string, JsonValue>;

const COMPOUND = new Set<string>(COMPOUND_STYLE_KEYS);

/** Flatten a node into dotted-key form for storage in a Y.Map. */
export function flattenNode(node: SceneNode): Flat {
  const flat: Flat = {};
  for (const key in node) {
    if (key === "style" || key === "attrs" || key === "props") continue;
    flat[key] = (node as unknown as Record<string, JsonValue>)[key]!;
  }
  // style.*
  const style = node.style as Record<string, JsonValue>;
  for (const k in style) {
    const value = style[k];
    if (value === undefined) continue;
    if (
      COMPOUND.has(k) &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      for (const subk in value as Record<string, JsonValue>) {
        flat[`style.${k}.${subk}`] = (value as Record<string, JsonValue>)[
          subk
        ]!;
      }
    } else {
      flat[`style.${k}`] = value;
    }
  }
  if (node.type === "element") {
    for (const k in node.attrs) flat[`attrs.${k}`] = node.attrs[k]!;
  }
  if (node.type === "component") {
    for (const k in node.props) flat[`componentProps.${k}`] = node.props[k]!;
  }
  return flat;
}

/** Reconstruct a node from its flat-key form. Applies the forbidden-segment guard. */
export function unflattenNode(flat: Flat): SceneNode {
  const base: Record<string, JsonValue> = {};
  const style: Record<string, JsonValue> = {};
  const attrs: Record<string, string> = {};
  const props: Record<string, JsonValue> = {};

  for (const key in flat) {
    if (hasForbiddenSegment(key)) continue; // prototype-pollution guard, by shape
    const value = flat[key]!;
    if (key.startsWith("style.")) {
      const rest = key.slice("style.".length);
      const parts = rest.split(".");
      if (parts.length === 2) {
        const [head, sub] = parts as [string, string];
        const compound =
          (style[head] as Record<string, JsonValue> | undefined) ?? {};
        compound[sub] = value;
        style[head] = compound;
      } else {
        style[rest] = value;
      }
    } else if (key.startsWith("attrs.")) {
      attrs[key.slice("attrs.".length)] = String(value);
    } else if (key.startsWith("componentProps.")) {
      props[key.slice("componentProps.".length)] = value;
    } else {
      base[key] = value;
    }
  }

  const node = { ...base, style } as unknown as SceneNode;
  if (node.type === "element") node.attrs = attrs;
  if (node.type === "component") node.props = props;
  return node;
}
