/**
 * Export a design to real, shippable HTML (§ export). Because the canvas renders real
 * DOM with typed styles, this is a faithful serialization — not an image. Component
 * instances become placeholder divs (they're runtime React); use `exportToReact` to keep
 * them as real components. Bindings optionally resolve against a data context (a filled
 * invoice) or are left as `{{…}}` (a reusable template).
 */

import type { CanvasDocument } from "../document/document";
import { ROOT_PARENT, type NodeId } from "../document/ids";
import type { SceneNode } from "../document/nodes";
import { childrenOf } from "../operations/children-index";
import { buildChildrenIndex } from "../operations/children-index";
import { styleToCss } from "../renderer/style-to-css";
import {
  itemScope,
  resolveArray,
  resolveAttrs,
  resolveCondition,
  resolveTemplate,
  type BindingData,
  type FilterMap,
} from "../binding/resolve";

export interface HtmlExportOptions {
  /** Resolve `{{…}}` bindings against this data (omit to keep template placeholders). */
  data?: BindingData;
  filters?: FilterMap;
  /** Indentation unit (default two spaces). */
  indent?: string;
  /** Emit a full standalone HTML document (for saving/printing) vs a fragment. */
  fullDocument?: boolean;
  title?: string;
  /**
   * Render root artboards at this width with `position: relative; height: auto` (instead
   * of their fixed canvas geometry) so flow/flex children reflow — used for responsive
   * previews at different breakpoints.
   */
  rootWidthOverride?: number;
}

const VOID_TAGS = new Set(["img", "br", "hr", "input"]);

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** camelCase React.CSSProperties → an inline `style="…"` value. */
export function cssToInline(css: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key in css) {
    const value = css[key];
    if (value === undefined || value === null) continue;
    const prop = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    parts.push(
      `${prop}: ${typeof value === "number" ? `${value}px` : String(value)}`,
    );
  }
  return parts.join("; ");
}

function nodeToHtml(
  doc: CanvasDocument,
  index: ReturnType<typeof buildChildrenIndex>,
  id: NodeId,
  opts: HtmlExportOptions,
  depth: number,
  scope: BindingData | undefined,
): string {
  const node: SceneNode | undefined = doc.nodes[id];
  if (node === undefined || !node.visible) return "";

  // Data-binding directives (only when a data scope is present).
  if (scope !== undefined) {
    if (
      node.visibleWhen !== undefined &&
      node.visibleWhen.length > 0 &&
      !resolveCondition(node.visibleWhen, scope, opts.filters)
    ) {
      return "";
    }
    if (node.repeat !== undefined && node.repeat.length > 0) {
      const items = resolveArray(node.repeat, scope);
      return items
        .map((item, i) =>
          nodeToHtmlBody(
            doc,
            index,
            node,
            opts,
            depth,
            itemScope(scope, item, i, node.repeatAs),
          ),
        )
        .filter((s) => s.length > 0)
        .join("\n");
    }
  }

  return nodeToHtmlBody(doc, index, node, opts, depth, scope);
}

function nodeToHtmlBody(
  doc: CanvasDocument,
  index: ReturnType<typeof buildChildrenIndex>,
  node: SceneNode,
  opts: HtmlExportOptions,
  depth: number,
  scope: BindingData | undefined,
): string {
  const pad = (opts.indent ?? "  ").repeat(depth);
  const cssObj = styleToCss(node.style) as Record<string, unknown>;
  // Responsive preview: render root artboards fluid at the override width.
  if (
    opts.rootWidthOverride !== undefined &&
    node.type === "frame" &&
    node.parentId === null
  ) {
    cssObj.position = "relative";
    cssObj.width = `${opts.rootWidthOverride}px`;
    cssObj.height = "auto";
    cssObj.minHeight = `${node.height}px`;
  }
  const styleStr = cssToInline(cssObj);
  const styleAttr =
    styleStr.length > 0 ? ` style="${escapeHtml(styleStr)}"` : "";

  const renderChildren = (): string => {
    const kids = childrenOf(index, node.id)
      .map((c) => nodeToHtml(doc, index, c, opts, depth + 1, scope))
      .filter((s) => s.length > 0);
    return kids.length > 0 ? `\n${kids.join("\n")}\n${pad}` : "";
  };

  switch (node.type) {
    case "frame":
    case "group":
      return `${pad}<div${styleAttr}>${renderChildren()}</div>`;
    case "text": {
      const text =
        scope !== undefined
          ? resolveTemplate(node.text, scope, opts.filters)
          : node.text;
      return `${pad}<div${styleAttr}>${escapeHtml(text)}</div>`;
    }
    case "element": {
      const attrs =
        scope !== undefined
          ? resolveAttrs(node.attrs, scope, opts.filters)
          : node.attrs;
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
        .join("");
      if (VOID_TAGS.has(node.tag))
        return `${pad}<${node.tag}${styleAttr}${attrStr} />`;
      return `${pad}<${node.tag}${styleAttr}${attrStr}>${renderChildren()}</${node.tag}>`;
    }
    case "component":
      return `${pad}<div${styleAttr} data-component="${escapeHtml(node.componentKey)}"><!-- ${escapeHtml(node.componentKey)} --></div>`;
    default:
      return "";
  }
}

/** Export a single artboard (or the whole document if `artboardId` omitted) to HTML. */
export function exportToHtml(
  doc: CanvasDocument,
  artboardId?: NodeId,
  opts: HtmlExportOptions = {},
): string {
  const index = buildChildrenIndex(doc.nodes);
  const roots =
    artboardId !== undefined ? [artboardId] : childrenOf(index, ROOT_PARENT);
  const body = roots
    .map((r) =>
      nodeToHtml(
        doc,
        index,
        r,
        opts,
        opts.fullDocument === true ? 2 : 0,
        opts.data,
      ),
    )
    .join("\n");
  if (opts.fullDocument !== true) return body;
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8" />',
    `    <title>${escapeHtml(opts.title ?? doc.meta.name)}</title>`,
    "    <style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}</style>",
    "  </head>",
    "  <body>",
    body,
    "  </body>",
    "</html>",
  ].join("\n");
}
