/**
 * Export a design to a React/TSX component (§ export) — "design → shippable component".
 * Component instances stay REAL components (`<StatCard {...} />`), so the output is code
 * a developer can drop in, not a flattened snapshot. Emits the import list for the
 * registered components used.
 */

import type { CanvasDocument } from "../document/document";
import { ROOT_PARENT, type NodeId } from "../document/ids";
import type { SceneNode } from "../document/nodes";
import {
  blockTag,
  marksToCss,
  type RichRun,
  type RichText,
} from "../document/rich-text";
import { isSafeUrl } from "../document/sanitize";
import { buildChildrenIndex, childrenOf } from "../operations/children-index";
import { styleToCss } from "../renderer/style-to-css";

function richRunsJsx(runs: readonly RichRun[]): string {
  return runs
    .map((run) => {
      const text = `{${JSON.stringify(run.text)}}`;
      const css = marksToCss(run.marks);
      const styleAttr =
        Object.keys(css).length > 0 ? ` style={${JSON.stringify(css)}}` : "";
      const link = run.marks?.link;
      if (link !== undefined && isSafeUrl(link))
        return `<a href={${JSON.stringify(link)}}${styleAttr} rel="noopener noreferrer">${text}</a>`;
      return `<span${styleAttr}>${text}</span>`;
    })
    .join("");
}

function richToJsx(rich: RichText): string {
  let out = "";
  let i = 0;
  while (i < rich.length) {
    const block = rich[i]!;
    if (block.type === "list-item") {
      let items = "";
      while (i < rich.length && rich[i]!.type === "list-item") {
        items += `<li>${richRunsJsx(rich[i]!.runs)}</li>`;
        i++;
      }
      out += `<ul>${items}</ul>`;
      continue;
    }
    const tag = blockTag(block.type);
    out += `<${tag}>${richRunsJsx(block.runs)}</${tag}>`;
    i++;
  }
  return out;
}

export interface ReactExportOptions {
  /** Name of the generated component (default "Design"). */
  componentName?: string;
  indent?: string;
}

export interface ReactExportResult {
  code: string;
  /** componentKey → PascalCase component identifier used in the JSX. */
  componentImports: Record<string, string>;
}

function pascal(key: string): string {
  return key
    .split(/[-_\s]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

function styleLiteral(node: SceneNode): string {
  const css = styleToCss(node.style) as Record<string, unknown>;
  const entries = Object.entries(css).map(
    ([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`,
  );
  return entries.length > 0 ? `{{ ${entries.join(", ")} }}` : "";
}

function nodeToJsx(
  doc: CanvasDocument,
  index: ReturnType<typeof buildChildrenIndex>,
  id: NodeId,
  depth: number,
  indent: string,
  imports: Record<string, string>,
): string {
  const node: SceneNode | undefined = doc.nodes[id];
  if (node === undefined || !node.visible) return "";
  const pad = indent.repeat(depth);
  const style = styleLiteral(node);
  const styleAttr = style.length > 0 ? ` style=${style}` : "";

  const children = () =>
    childrenOf(index, id)
      .map((c) => nodeToJsx(doc, index, c, depth + 1, indent, imports))
      .filter((s) => s.length > 0)
      .join("\n");

  switch (node.type) {
    case "frame":
    case "group": {
      const kids = children();
      return kids.length > 0
        ? `${pad}<div${styleAttr}>\n${kids}\n${pad}</div>`
        : `${pad}<div${styleAttr} />`;
    }
    case "text":
      return node.rich !== undefined
        ? `${pad}<div${styleAttr}>${richToJsx(node.rich)}</div>`
        : `${pad}<div${styleAttr}>{${JSON.stringify(node.text)}}</div>`;
    case "element": {
      const attrs = Object.entries(node.attrs)
        .map(([k, v]) => ` ${k}=${JSON.stringify(v)}`)
        .join("");
      const kids = children();
      return kids.length > 0
        ? `${pad}<${node.tag}${styleAttr}${attrs}>\n${kids}\n${pad}</${node.tag}>`
        : `${pad}<${node.tag}${styleAttr}${attrs} />`;
    }
    case "component": {
      const name = pascal(node.componentKey);
      imports[node.componentKey] = name;
      const props = Object.entries(node.props)
        .map(([k, v]) => ` ${k}={${JSON.stringify(v)}}`)
        .join("");
      return `${pad}<${name}${props} />`;
    }
    default:
      return "";
  }
}

/** Export an artboard (or the whole document) as a React component's source. */
export function exportToReact(
  doc: CanvasDocument,
  artboardId?: NodeId,
  opts: ReactExportOptions = {},
): ReactExportResult {
  const index = buildChildrenIndex(doc.nodes);
  const indent = opts.indent ?? "  ";
  const componentName = opts.componentName ?? "Design";
  const imports: Record<string, string> = {};
  const roots =
    artboardId !== undefined ? [artboardId] : childrenOf(index, ROOT_PARENT);
  const body = roots
    .map((r) => nodeToJsx(doc, index, r, 3, indent, imports))
    .join("\n");

  const importLines = Object.values(imports)
    .sort()
    .map((name) => `// import { ${name} } from "your-components";`)
    .join("\n");

  const code = [
    importLines,
    importLines.length > 0 ? "" : null,
    `export function ${componentName}() {`,
    `${indent}return (`,
    `${indent}${indent}<>`,
    body,
    `${indent}${indent}</>`,
    `${indent});`,
    "}",
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");

  return { code, componentImports: imports };
}
