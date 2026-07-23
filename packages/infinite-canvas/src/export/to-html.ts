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
import { resolveNodeStyle, stylesFromMeta } from "../styles-lib/resolve";
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
  /**
   * Paginate for print/PDF (§ paginated PDF). `page` sets the CSS `@page` size/margin;
   * repeated line-item rows get `break-inside: avoid`; running header/footer HTML repeats
   * on every printed page (Chrome print / headless). Only applied with `fullDocument`.
   */
  page?: { size?: string; margin?: string };
  /**
   * Print-chrome slot repeated on every page. This is RAW HTML (a `<div>` with a logo /
   * page layout is the point) and the literal string is TRUSTED — never string-concatenate
   * untrusted data into it. Dynamic values belong in `{{…}}` bindings, which resolve
   * against `data` and are HTML-escaped, so a hostile `{{customer.name}}` can't inject markup.
   */
  runningHeader?: string;
  /** See {@link HtmlExportOptions.runningHeader} — same raw-HTML / escaped-binding rules. */
  runningFooter?: string;
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
            true,
          ),
        )
        .filter((s) => s.length > 0)
        .join("\n");
    }
  }

  return nodeToHtmlBody(doc, index, node, opts, depth, scope, false);
}

function nodeToHtmlBody(
  doc: CanvasDocument,
  index: ReturnType<typeof buildChildrenIndex>,
  node: SceneNode,
  opts: HtmlExportOptions,
  depth: number,
  scope: BindingData | undefined,
  isRepeatItem: boolean,
): string {
  const pad = (opts.indent ?? "  ").repeat(depth);
  const effectiveStyle =
    node.styleRef !== undefined
      ? resolveNodeStyle(node, stylesFromMeta(doc.meta))
      : node.style;
  const cssObj = styleToCss(effectiveStyle) as Record<string, unknown>;
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
  // Repeated rows must not split across printed pages.
  const classAttr = isRepeatItem ? ' class="ic-repeat-item"' : "";

  const renderChildren = (): string => {
    const kids = childrenOf(index, node.id)
      .map((c) => nodeToHtml(doc, index, c, opts, depth + 1, scope))
      .filter((s) => s.length > 0);
    return kids.length > 0 ? `\n${kids.join("\n")}\n${pad}` : "";
  };

  switch (node.type) {
    case "frame":
    case "group":
      return `${pad}<div${classAttr}${styleAttr}>${renderChildren()}</div>`;
    case "text": {
      const text =
        scope !== undefined
          ? resolveTemplate(node.text, scope, opts.filters)
          : node.text;
      return `${pad}<div${classAttr}${styleAttr}>${escapeHtml(text)}</div>`;
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
        return `${pad}<${node.tag}${classAttr}${styleAttr}${attrStr} />`;
      return `${pad}<${node.tag}${classAttr}${styleAttr}${attrStr}>${renderChildren()}</${node.tag}>`;
    }
    case "component":
      return `${pad}<div${classAttr}${styleAttr} data-component="${escapeHtml(node.componentKey)}"><!-- ${escapeHtml(node.componentKey)} --></div>`;
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

  const paginated =
    opts.page !== undefined ||
    opts.runningHeader !== undefined ||
    opts.runningFooter !== undefined;
  const pageCss =
    opts.page !== undefined
      ? `@page{size:${opts.page.size ?? "A4"};margin:${opts.page.margin ?? "20mm"}}`
      : "";
  // Print-only rules: fixed header/footer + row break-avoid. Scoped to @media print so the
  // fixed chrome doesn't overlap content in an on-screen preview.
  const printCss = paginated
    ? "@media print{.ic-repeat-item{break-inside:avoid;page-break-inside:avoid}" +
      (opts.runningHeader !== undefined
        ? ".ic-running-header{position:fixed;top:0;left:0;right:0}"
        : "") +
      (opts.runningFooter !== undefined
        ? ".ic-running-footer{position:fixed;bottom:0;left:0;right:0}"
        : "") +
      "}"
    : "";
  // Resolve {{…}} in the chrome against the data context, HTML-escaping the resolved
  // values (the literal structure is the caller's trusted HTML — see the type doc).
  const chrome = (html: string): string =>
    opts.data !== undefined
      ? resolveTemplate(html, opts.data, opts.filters, escapeHtml)
      : html;
  const header =
    opts.runningHeader !== undefined
      ? `    <div class="ic-running-header">${chrome(opts.runningHeader)}</div>\n`
      : "";
  const footer =
    opts.runningFooter !== undefined
      ? `    <div class="ic-running-footer">${chrome(opts.runningFooter)}</div>\n`
      : "";

  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8" />',
    `    <title>${escapeHtml(opts.title ?? doc.meta.name)}</title>`,
    `    <style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}${pageCss}${printCss}</style>`,
    "  </head>",
    "  <body>",
    header + body + "\n" + footer,
    "  </body>",
    "</html>",
  ].join("\n");
}

/**
 * Server-safe convenience: render a filled template to a standalone HTML document. Pure —
 * call it in a Node job to batch-render thousands of invoices, then pipe the HTML to your
 * own HTML→PDF engine (Puppeteer / WeasyPrint / Prince). No browser or React required.
 */
export function renderTemplateToHtml(
  doc: CanvasDocument,
  data: BindingData,
  opts: Omit<HtmlExportOptions, "data" | "fullDocument"> & {
    artboardId?: NodeId;
  } = {},
): string {
  const { artboardId, ...rest } = opts;
  return exportToHtml(doc, artboardId, { ...rest, data, fullDocument: true });
}
