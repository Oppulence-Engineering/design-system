/**
 * Design linter (§ a11y) — pure. Walks the document and flags accessibility/quality
 * issues: low text-contrast (WCAG AA), images missing alt text, links without href,
 * and very small font sizes. Fits a design-system org's quality bar.
 */

import type { CanvasDocument } from "../document/document";
import { ROOT_PARENT, type NodeId } from "../document/ids";
import type { Fill } from "../document/styles";
import type { SceneNode } from "../document/nodes";
import { buildChildrenIndex, childrenOf } from "../operations/children-index";
import { contrastRatio, meetsAA, parseColor } from "./contrast";

export type LintSeverity = "error" | "warning";

export interface LintIssue {
  nodeId: NodeId;
  rule: string;
  severity: LintSeverity;
  message: string;
}

function solidColor(fill: Fill | undefined): string | null {
  if (fill !== undefined && fill.type === "solid") return fill.color;
  return null;
}

/** Nearest ancestor background color (falls back to white). */
function backgroundFor(doc: CanvasDocument, node: SceneNode): string {
  let current: SceneNode | undefined = node;
  while (current !== undefined) {
    const bg = solidColor(current.style.background);
    if (bg !== null) return bg;
    current =
      current.parentId !== null ? doc.nodes[current.parentId] : undefined;
  }
  return "#ffffff";
}

function isLargeText(node: Extract<SceneNode, { type: "text" }>): boolean {
  const size = node.style.fontSize ?? 16;
  const weight = node.style.fontWeight ?? 400;
  return size >= 24 || (size >= 18.66 && weight >= 700);
}

export function lintNode(doc: CanvasDocument, node: SceneNode): LintIssue[] {
  const issues: LintIssue[] = [];

  if (node.type === "text") {
    const fgStr = node.style.color ?? "#000000";
    const bgStr = backgroundFor(doc, node);
    const fg = parseColor(fgStr);
    const bg = parseColor(bgStr);
    if (fg !== null && bg !== null) {
      const ratio = contrastRatio(fg, bg);
      if (!meetsAA(ratio, isLargeText(node))) {
        issues.push({
          nodeId: node.id,
          rule: "contrast",
          severity: "error",
          message: `Low contrast ${ratio.toFixed(2)}:1 (${fgStr} on ${bgStr}) — WCAG AA needs ${isLargeText(node) ? "3" : "4.5"}:1`,
        });
      }
    }
    if ((node.style.fontSize ?? 16) < 12) {
      issues.push({
        nodeId: node.id,
        rule: "font-size",
        severity: "warning",
        message: "Font size below 12px is hard to read",
      });
    }
  }

  if (node.type === "element") {
    if (node.tag === "img" && (node.attrs.alt ?? "").trim() === "") {
      issues.push({
        nodeId: node.id,
        rule: "img-alt",
        severity: "error",
        message: "Image is missing alt text",
      });
    }
    if (node.tag === "a" && (node.attrs.href ?? "").trim() === "") {
      issues.push({
        nodeId: node.id,
        rule: "link-href",
        severity: "warning",
        message: "Link has no href",
      });
    }
  }

  return issues;
}

/** Lint the whole document (or one artboard subtree). */
export function lintDocument(
  doc: CanvasDocument,
  rootId?: NodeId,
): LintIssue[] {
  const index = buildChildrenIndex(doc.nodes);
  const issues: LintIssue[] = [];
  const walk = (id: NodeId) => {
    const node = doc.nodes[id];
    if (node === undefined) return;
    issues.push(...lintNode(doc, node));
    for (const child of childrenOf(index, id)) walk(child);
  };
  const roots =
    rootId !== undefined ? [rootId] : childrenOf(index, ROOT_PARENT);
  for (const r of roots) walk(r);
  return issues;
}
