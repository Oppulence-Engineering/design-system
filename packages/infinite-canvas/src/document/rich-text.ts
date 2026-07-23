/**
 * Rich text (§14b) — a small typed block/inline model for TextNode. Server-safe and
 * framework-agnostic (no React value imports) so it works in ./document, the renderer, and
 * the pure exporters alike. A TextNode keeps its plain `text` as a lossless fallback (search,
 * plain export, older readers); `rich` overrides it for display/edit/export when present.
 *
 * Deliberately flat and JSON-serializable (LWW under collab for v1 — a per-node Y.Text is the
 * future granular-merge path, per the plan). Marks are a closed set; a link's href is
 * validated at the sanitize boundary.
 */

export interface RichMarks {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  /** Hyperlink href — sanitized (URL-scheme allowlist) at the document boundary. */
  link?: string;
  /** CSS color — sanitized (no url()/expression) at the document boundary. */
  color?: string;
}

export interface RichRun {
  text: string;
  marks?: RichMarks;
}

export type RichBlockType = "paragraph" | "h1" | "h2" | "h3" | "list-item";
export type RichAlign = "left" | "center" | "right";

export interface RichBlock {
  type: RichBlockType;
  align?: RichAlign;
  runs: RichRun[];
}

export type RichText = RichBlock[];

/** Concatenate a rich value to plain text (blocks joined by newlines) — the `text` mirror. */
export function richToPlainText(rich: RichText): string {
  return rich
    .map((block) => block.runs.map((run) => run.text).join(""))
    .join("\n");
}

/** Inline marks → a CSS property object (camelCase; usable as React style or via cssToInline). */
export function marksToCss(
  marks: RichMarks | undefined,
): Record<string, string | number> {
  const css: Record<string, string | number> = {};
  if (marks === undefined) return css;
  if (marks.bold === true) css.fontWeight = 700;
  if (marks.italic === true) css.fontStyle = "italic";
  const deco: string[] = [];
  if (marks.underline === true) deco.push("underline");
  if (marks.strike === true) deco.push("line-through");
  if (deco.length > 0) css.textDecoration = deco.join(" ");
  if (marks.code === true) {
    css.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
    css.background = "rgba(0,0,0,0.06)";
    css.padding = "0 3px";
    css.borderRadius = 3;
  }
  if (marks.color !== undefined) css.color = marks.color;
  return css;
}

const BLOCK_TAGS: Record<RichBlockType, "p" | "h1" | "h2" | "h3" | "li"> = {
  paragraph: "p",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  "list-item": "li",
};

/** The HTML tag for a block type (list-item → li; consumers wrap runs of li in ul). */
export function blockTag(type: RichBlockType): "p" | "h1" | "h2" | "h3" | "li" {
  return BLOCK_TAGS[type] ?? "p";
}

export const RICH_BLOCK_TYPES: readonly RichBlockType[] = [
  "paragraph",
  "h1",
  "h2",
  "h3",
  "list-item",
];
