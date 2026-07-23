/**
 * Security boundary (§3c). Documents are untrusted — user-authored and, in collab,
 * other-user-authored — and the renderer turns them into real DOM in the consumer's
 * origin. `sanitizeNode` is the per-node gate, run identically at local apply, remote
 * apply, AND inside `materializeDocFromYDoc` (so `store.document` and the materialized
 * Y.Doc stay byte-identical and the convergence assertion / reconciliation never loops).
 *
 * Rules enforced here: finite numbers, prototype-pollution-by-shape, `style.custom`
 * CSS allow/deny, `attrs` allowlist + URL-scheme allowlist, and per-node bounds.
 * Document/batch aggregates (maxNodes, maxSelection) are a SEPARATE gate — a per-node
 * function cannot see them.
 */

import { hasForbiddenSegment, isForbiddenSegment } from "./keys";
import { isFiniteNumber } from "./json";
import type {
  ComponentNode,
  ElementNode,
  FrameNode,
  HtmlTag,
  SceneNode,
  TextNode,
} from "./nodes";
import { HTML_TAGS } from "./nodes";
import type { NodeStyle } from "./styles";

export interface SanitizeLimits {
  maxTextLength: number;
  maxCustomStyleEntries: number;
  maxAttrs: number;
  maxAttrValueLength: number;
}

export const DEFAULT_LIMITS: SanitizeLimits = {
  maxTextLength: 100_000,
  maxCustomStyleEntries: 64,
  maxAttrs: 64,
  maxAttrValueLength: 8_192,
};

export interface SanitizeResult {
  node: SceneNode;
  /** True if the node was modified (a value was dropped/clamped/repaired). */
  changed: boolean;
  /** True if the node is fundamentally unusable and should render as an error badge. */
  invalid: boolean;
  issues: string[];
}

const URL_ATTRS = new Set([
  "href",
  "src",
  "srcset",
  "poster",
  "formaction",
  "xlink:href",
]);
const ALWAYS_STRIP_ATTRS = new Set(["target", "ping", "formtarget", "style"]);
const GLOBAL_ATTR_ALLOWLIST = new Set([
  "title",
  "alt",
  "role",
  "width",
  "height",
  "lang",
  "dir",
]);
const ALLOWED_URL_SCHEMES = new Set(["http:", "https:", "mailto:"]);

const HTML_TAG_SET: ReadonlySet<string> = new Set(HTML_TAGS);

/** True if a URL attribute value is safe (allowed scheme or a relative URL). */
export function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  // Relative URLs (no scheme) and fragments/anchors are safe.
  if (/^[#/.?]/.test(trimmed)) return true;
  // A bare path without a scheme (no colon before the first slash) is relative.
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (schemeMatch === null) return true;
  return ALLOWED_URL_SCHEMES.has(`${schemeMatch[1]!.toLowerCase()}:`);
}

const CSS_DANGEROUS_PROP = /binding|behavior|expression|^-moz-binding/i;
const CSS_DANGEROUS_VALUE =
  /url\s*\(|expression\s*\(|javascript:|vbscript:|@import|<\/?\w/i;

/** True if a `style.custom` [prop, value] pair is safe to render. */
export function isSafeCustomCss(prop: string, value: string): boolean {
  if (prop.includes(".") || hasForbiddenSegment(prop)) return false;
  const lowerProp = prop.trim().toLowerCase();
  if (lowerProp === "" || CSS_DANGEROUS_PROP.test(lowerProp)) return false;
  if (lowerProp === "content") return false;
  if (lowerProp === "position" && /fixed|sticky/i.test(value)) return false;
  if (CSS_DANGEROUS_VALUE.test(value)) return false;
  return true;
}

function sanitizeCustom(
  custom: Record<string, string>,
  limits: SanitizeLimits,
  issues: string[],
): { custom: Record<string, string>; changed: boolean } {
  const out: Record<string, string> = {};
  let changed = false;
  let count = 0;
  for (const prop in custom) {
    const value = custom[prop];
    if (value === undefined) continue;
    if (count >= limits.maxCustomStyleEntries) {
      issues.push("style.custom entry limit exceeded");
      changed = true;
      break;
    }
    if (typeof value === "string" && isSafeCustomCss(prop, value)) {
      out[prop] = value;
      count++;
    } else {
      issues.push(`dropped unsafe custom css: ${prop}`);
      changed = true;
    }
  }
  return { custom: out, changed };
}

/** Reject NaN/Infinity numeric style values; drop `position: fixed/sticky`; filter custom. */
function sanitizeStyle(
  style: NodeStyle,
  limits: SanitizeLimits,
  issues: string[],
): { style: NodeStyle; changed: boolean } {
  let changed = false;
  const out: NodeStyle = { ...style };

  if (
    out.position === ("fixed" as NodeStyle["position"]) ||
    out.position === ("sticky" as NodeStyle["position"])
  ) {
    delete out.position;
    issues.push("dropped position:fixed/sticky");
    changed = true;
  }

  for (const key of [
    "opacity",
    "fontSize",
    "fontWeight",
    "letterSpacing",
  ] as const) {
    const value = out[key];
    if (value !== undefined && !isFiniteNumber(value)) {
      delete out[key];
      issues.push(`dropped non-finite style.${key}`);
      changed = true;
    }
  }

  if (out.custom !== undefined) {
    const result = sanitizeCustom(out.custom, limits, issues);
    out.custom = result.custom;
    changed = changed || result.changed;
  }

  return { style: out, changed };
}

function sanitizeFrame(
  node: FrameNode,
  limits: SanitizeLimits,
  issues: string[],
): SanitizeResult {
  let changed = false;
  let invalid = false;
  const out: FrameNode = { ...node };
  for (const key of ["x", "y", "width", "height"] as const) {
    if (!isFiniteNumber(out[key])) {
      issues.push(`non-finite frame.${key}`);
      out[key] = 0;
      changed = true;
      invalid = true; // a frame with bad geometry would wedge culling — badge it
    }
  }
  const styleResult = sanitizeStyle(out.style, limits, issues);
  out.style = styleResult.style;
  changed = changed || styleResult.changed;
  return { node: out, changed, invalid, issues };
}

function sanitizeElement(
  node: ElementNode,
  limits: SanitizeLimits,
  issues: string[],
): SanitizeResult {
  let changed = false;
  let invalid = false;
  const out: ElementNode = { ...node };

  if (!HTML_TAG_SET.has(out.tag)) {
    issues.push(`unknown/forbidden tag: ${out.tag}`);
    out.tag = "div" as HtmlTag;
    changed = true;
    invalid = true;
  }

  const attrs: Record<string, string> = {};
  let attrCount = 0;
  for (const rawKey in node.attrs) {
    const value = node.attrs[rawKey];
    if (value === undefined) continue;
    const key = rawKey.toLowerCase();
    if (attrCount >= limits.maxAttrs) {
      issues.push("attr limit exceeded");
      changed = true;
      break;
    }
    if (isForbiddenSegment(key) || key.includes(".")) {
      issues.push(`dropped forbidden attr key: ${key}`);
      changed = true;
      continue;
    }
    if (key.startsWith("on") || ALWAYS_STRIP_ATTRS.has(key)) {
      issues.push(`dropped unsafe attr: ${key}`);
      changed = true;
      continue;
    }
    if (value.length > limits.maxAttrValueLength) {
      issues.push(`dropped oversized attr: ${key}`);
      changed = true;
      continue;
    }
    const allowed =
      GLOBAL_ATTR_ALLOWLIST.has(key) ||
      URL_ATTRS.has(key) ||
      key.startsWith("aria-") ||
      key.startsWith("data-");
    if (!allowed) {
      issues.push(`dropped non-allowlisted attr: ${key}`);
      changed = true;
      continue;
    }
    if (URL_ATTRS.has(key) && !isSafeUrl(value)) {
      issues.push(`dropped unsafe url attr: ${key}`);
      changed = true;
      continue;
    }
    attrs[key] = value;
    attrCount++;
  }
  out.attrs = attrs;
  if (Object.keys(attrs).length !== Object.keys(node.attrs).length)
    changed = true;

  const styleResult = sanitizeStyle(out.style, limits, issues);
  out.style = styleResult.style;
  changed = changed || styleResult.changed;
  return { node: out, changed, invalid, issues };
}

function sanitizeText(
  node: TextNode,
  limits: SanitizeLimits,
  issues: string[],
): SanitizeResult {
  let changed = false;
  const out: TextNode = { ...node };
  if (out.text.length > limits.maxTextLength) {
    out.text = out.text.slice(0, limits.maxTextLength);
    issues.push("clamped oversized text");
    changed = true;
  }
  const styleResult = sanitizeStyle(out.style, limits, issues);
  out.style = styleResult.style;
  changed = changed || styleResult.changed;
  return { node: out, changed, invalid: false, issues };
}

function sanitizeComponent(
  node: ComponentNode,
  limits: SanitizeLimits,
  issues: string[],
): SanitizeResult {
  let changed = false;
  const out: ComponentNode = { ...node };
  // Prototype-pollution guard on component-prop keys (by shape — this namespace was
  // easy to miss when the guard was written by enumeration).
  const props: ComponentNode["props"] = {};
  for (const key in node.props) {
    const value = node.props[key];
    if (value === undefined) continue;
    if (isForbiddenSegment(key) || key.includes(".")) {
      issues.push(`dropped forbidden prop key: ${key}`);
      changed = true;
      continue;
    }
    props[key] = value;
  }
  out.props = props;
  const styleResult = sanitizeStyle(out.style, limits, issues);
  out.style = styleResult.style;
  changed = changed || styleResult.changed;
  return { node: out, changed, invalid: false, issues };
}

/**
 * Sanitize a single node. Returns the (possibly repaired) node, whether it changed,
 * and whether it should render as an error badge. Never throws; never mutates input.
 */
export function sanitizeNode(
  node: SceneNode,
  limits: SanitizeLimits = DEFAULT_LIMITS,
): SanitizeResult {
  const issues: string[] = [];

  // Structural guard shared by all node types: id / parentId must be safe keys.
  if (isForbiddenSegment(node.id) || node.id === "") {
    return {
      node,
      changed: false,
      invalid: true,
      issues: ["forbidden node id"],
    };
  }
  if (node.parentId !== null && isForbiddenSegment(node.parentId)) {
    return {
      node: { ...node, parentId: null },
      changed: true,
      invalid: false,
      issues: ["forbidden parentId reset to root"],
    };
  }
  if (node.rotation !== 0 && !isFiniteNumber(node.rotation)) {
    node = { ...node, rotation: 0 };
  }

  switch (node.type) {
    case "frame":
      return sanitizeFrame(node, limits, issues);
    case "element":
      return sanitizeElement(node, limits, issues);
    case "text":
      return sanitizeText(node, limits, issues);
    case "component":
      return sanitizeComponent(node, limits, issues);
    case "group": {
      const styleResult = sanitizeStyle(node.style, limits, issues);
      return {
        node: { ...node, style: styleResult.style },
        changed: styleResult.changed,
        invalid: false,
        issues,
      };
    }
    default:
      return exhaustive(node);
  }
}

function exhaustive(node: never): never {
  throw new Error(`Unknown node type: ${JSON.stringify(node)}`);
}
