/**
 * Rich-text rendering + editing (§14b). `RichTextView` renders a typed rich value to real
 * DOM (consecutive list-items grouped into a `<ul>`; `{{…}}` resolved when a data context is
 * present). `RichTextEditor` is an uncontrolled contentEditable with a floating toolbar; it
 * builds its initial DOM imperatively (never innerHTML — createElement + text nodes only, so
 * the package-wide `dangerouslySetInnerHTML` ban holds) and serializes DOM → rich on commit.
 */

"use client";

import * as React from "react";
import type { TextNode } from "../document/nodes";
import {
  blockTag,
  marksToCss,
  richToPlainText,
  type RichBlock,
  type RichMarks,
  type RichRun,
  type RichText,
} from "../document/rich-text";
import { isSafeUrl } from "../document/sanitize";
import { useCanvas } from "../store/context";
import { useBinding } from "../binding/context";
import { resolveTemplate } from "../binding/resolve";

/* ----------------------------- display ----------------------------- */

function alignStyle(block: RichBlock): React.CSSProperties {
  return block.align !== undefined ? { textAlign: block.align } : {};
}

function Runs({
  runs,
  resolve,
}: {
  runs: readonly RichRun[];
  resolve?: (s: string) => string;
}): React.ReactNode {
  return runs.map((run, i) => {
    const text = resolve !== undefined ? resolve(run.text) : run.text;
    const css = marksToCss(run.marks) as React.CSSProperties;
    const link = run.marks?.link;
    if (link !== undefined && isSafeUrl(link)) {
      return (
        <a key={i} href={link} style={css} rel="noopener noreferrer">
          {text}
        </a>
      );
    }
    return (
      <span key={i} style={css}>
        {text}
      </span>
    );
  });
}

export function RichTextView({
  rich,
  resolve,
}: {
  rich: RichText;
  resolve?: (s: string) => string;
}): React.ReactNode {
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < rich.length) {
    const block = rich[i]!;
    if (block.type === "list-item") {
      const items: RichBlock[] = [];
      while (i < rich.length && rich[i]!.type === "list-item")
        items.push(rich[i++]!);
      out.push(
        <ul key={`ul-${i}`} style={{ margin: 0, paddingLeft: "1.5em" }}>
          {items.map((it, j) => (
            <li key={j} style={alignStyle(it)}>
              <Runs runs={it.runs} resolve={resolve} />
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    const Tag = blockTag(block.type);
    out.push(
      <Tag key={i} style={{ margin: 0, ...alignStyle(block) }}>
        <Runs runs={block.runs} resolve={resolve} />
      </Tag>,
    );
    i++;
  }
  return out;
}

/* -------------------------- DOM <-> rich --------------------------- */

/** Build DOM nodes for the editor's initial content (no innerHTML — createElement only). */
function richToDom(rich: RichText): Node[] {
  const out: Node[] = [];
  let i = 0;
  const runEls = (runs: readonly RichRun[]): Node[] =>
    runs.map((run) => {
      const link = run.marks?.link;
      const el = document.createElement(
        link !== undefined && isSafeUrl(link) ? "a" : "span",
      );
      if (el instanceof HTMLAnchorElement && link !== undefined)
        el.setAttribute("href", link);
      Object.assign(el.style, marksToCss(run.marks));
      el.textContent = run.text;
      return el;
    });
  while (i < rich.length) {
    const block = rich[i]!;
    if (block.type === "list-item") {
      const ul = document.createElement("ul");
      while (i < rich.length && rich[i]!.type === "list-item") {
        const li = document.createElement("li");
        if (rich[i]!.align !== undefined) li.style.textAlign = rich[i]!.align!;
        li.append(...runEls(rich[i]!.runs));
        ul.append(li);
        i++;
      }
      out.push(ul);
      continue;
    }
    const el = document.createElement(blockTag(block.type));
    if (block.align !== undefined) el.style.textAlign = block.align;
    el.append(...runEls(block.runs));
    out.push(el);
    i++;
  }
  return out;
}

const BLOCK_TYPE_BY_TAG: Record<string, RichBlock["type"]> = {
  P: "paragraph",
  DIV: "paragraph",
  H1: "h1",
  H2: "h2",
  H3: "h3",
  LI: "list-item",
};

function alignOf(el: HTMLElement): RichBlock["align"] | undefined {
  const a = el.style.textAlign;
  return a === "left" || a === "center" || a === "right" ? a : undefined;
}

function marksEqual(
  a: RichMarks | undefined,
  b: RichMarks | undefined,
): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

/** Fold an element's formatting into the active mark set. */
function foldMarks(marks: RichMarks, el: HTMLElement): RichMarks {
  const next: RichMarks = { ...marks };
  const tag = el.tagName;
  if (tag === "B" || tag === "STRONG") next.bold = true;
  if (tag === "I" || tag === "EM") next.italic = true;
  if (tag === "U") next.underline = true;
  if (tag === "S" || tag === "STRIKE" || tag === "DEL") next.strike = true;
  if (tag === "CODE") next.code = true;
  if (tag === "A") {
    const href = el.getAttribute("href");
    if (href !== null && isSafeUrl(href)) next.link = href;
  }
  const fw = el.style.fontWeight;
  if (fw === "bold" || Number(fw) >= 600) next.bold = true;
  if (el.style.fontStyle === "italic") next.italic = true;
  const deco = `${el.style.textDecoration} ${el.style.textDecorationLine}`;
  if (deco.includes("underline")) next.underline = true;
  if (deco.includes("line-through")) next.strike = true;
  const color = el.style.color || el.getAttribute("color");
  if (color !== null && color !== "" && color !== undefined) next.color = color;
  return next;
}

function inlineRuns(block: Node): RichRun[] {
  const runs: RichRun[] = [];
  const push = (text: string, marks: RichMarks) => {
    if (text === "") return;
    const clean = Object.keys(marks).length > 0 ? { text, marks } : { text };
    const last = runs[runs.length - 1];
    if (last !== undefined && marksEqual(last.marks, clean.marks))
      last.text += text;
    else runs.push(clean);
  };
  const walk = (node: Node, marks: RichMarks) => {
    if (node.nodeType === Node.TEXT_NODE) {
      push(node.textContent ?? "", marks);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.tagName === "BR") return;
    const next = foldMarks(marks, el);
    for (const child of Array.from(el.childNodes)) walk(child, next);
  };
  for (const child of Array.from(block.childNodes)) walk(child, {});
  return runs.length > 0 ? runs : [{ text: "" }];
}

/** Serialize a contentEditable element's DOM back into a typed rich value. */
export function domToRich(root: HTMLElement): RichText {
  const children = Array.from(root.childNodes);
  const isBlockEl = (n: Node): boolean =>
    n.nodeType === Node.ELEMENT_NODE &&
    (BLOCK_TYPE_BY_TAG[(n as HTMLElement).tagName] !== undefined ||
      (n as HTMLElement).tagName === "UL" ||
      (n as HTMLElement).tagName === "OL");
  const hasBlocks = children.some(isBlockEl);
  const blocks: RichBlock[] = [];
  if (!hasBlocks) {
    blocks.push({ type: "paragraph", runs: inlineRuns(root) });
    return blocks;
  }
  for (const node of children) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent ?? "";
      if (t.trim() !== "")
        blocks.push({ type: "paragraph", runs: [{ text: t }] });
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    if (el.tagName === "UL" || el.tagName === "OL") {
      for (const li of Array.from(el.children)) {
        if (li.tagName === "LI")
          blocks.push({
            type: "list-item",
            align: alignOf(li as HTMLElement),
            runs: inlineRuns(li),
          });
      }
      continue;
    }
    const type = BLOCK_TYPE_BY_TAG[el.tagName] ?? "paragraph";
    blocks.push({ type, align: alignOf(el), runs: inlineRuns(el) });
  }
  return blocks.length > 0
    ? blocks
    : [{ type: "paragraph", runs: [{ text: "" }] }];
}

/* ------------------------------ editor ----------------------------- */

const TB_BTN: React.CSSProperties = {
  minWidth: 26,
  height: 26,
  border: "none",
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
  borderRadius: 4,
  font: "13px system-ui",
};

export function RichTextEditor({
  node,
  css,
}: {
  node: TextNode;
  css: React.CSSProperties;
}): React.ReactNode {
  const { sessionStore, documentStore } = useCanvas();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const initial: RichText = node.rich ?? [
      { type: "paragraph", runs: [{ text: node.text }] },
    ];
    el.replaceChildren(...richToDom(initial));
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = React.useCallback(() => {
    const el = ref.current;
    sessionStore.getState().setEditingText(null);
    if (el === null) return;
    const rich = domToRich(el);
    documentStore.getState().apply([
      { type: "set-rich-text", nodeId: node.id, rich },
      { type: "set-text", nodeId: node.id, text: richToPlainText(rich) },
    ]);
  }, [documentStore, sessionStore, node.id]);

  const exec = (command: string, value?: string) => {
    ref.current?.focus();
    // execCommand is deprecated but the pragmatic v1 rich-edit primitive (a full
    // ProseMirror/TipTap dep is out of scope for a raw-source package). DOM is the truth
    // — domToRich re-derives marks from whatever markup the browser produced.
    document.execCommand(command, false, value);
  };

  const setBlock = (tag: string) => exec("formatBlock", tag);

  const link = () => {
    const url = window.prompt("Link URL");
    if (url !== null && url !== "") {
      if (isSafeUrl(url)) exec("createLink", url);
      else window.alert("Unsupported or unsafe URL scheme.");
    }
  };

  return (
    <div style={{ position: "relative" }} data-node-type="text">
      <div
        role="toolbar"
        aria-label="Text formatting"
        onMouseDown={(e) => e.preventDefault()} // keep selection in the editor
        style={{
          position: "absolute",
          top: -38,
          left: 0,
          display: "flex",
          gap: 2,
          padding: 3,
          background: "var(--ic-accent, #3b82f6)",
          borderRadius: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          zIndex: 20,
        }}
      >
        <button
          style={{ ...TB_BTN, fontWeight: 700 }}
          data-testid="rt-bold"
          onClick={() => exec("bold")}
        >
          B
        </button>
        <button
          style={{ ...TB_BTN, fontStyle: "italic" }}
          onClick={() => exec("italic")}
        >
          I
        </button>
        <button
          style={{ ...TB_BTN, textDecoration: "underline" }}
          onClick={() => exec("underline")}
        >
          U
        </button>
        <button
          style={{ ...TB_BTN, textDecoration: "line-through" }}
          onClick={() => exec("strikeThrough")}
        >
          S
        </button>
        <button style={TB_BTN} data-testid="rt-link" onClick={link}>
          🔗
        </button>
        <span
          style={{
            width: 1,
            background: "rgba(255,255,255,0.4)",
            margin: "2px 3px",
          }}
        />
        <button style={TB_BTN} onClick={() => setBlock("H1")}>
          H1
        </button>
        <button style={TB_BTN} onClick={() => setBlock("H2")}>
          H2
        </button>
        <button style={TB_BTN} onClick={() => setBlock("P")}>
          ¶
        </button>
        <button
          style={TB_BTN}
          data-testid="rt-ul"
          onClick={() => exec("insertUnorderedList")}
        >
          • List
        </button>
      </div>
      <div
        ref={ref}
        data-canvas-node={node.id}
        contentEditable
        suppressContentEditableWarning
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            commit();
          }
        }}
        style={{
          ...css,
          pointerEvents: "auto",
          outline: "1px solid var(--ic-accent, #3b82f6)",
          cursor: "text",
          minWidth: 8,
        }}
      />
    </div>
  );
}

/** Read-only rich render bound to the active data context (used by NodeBody). */
export function BoundRichText({ rich }: { rich: RichText }): React.ReactNode {
  const binding = useBinding();
  const resolve = React.useMemo(
    () =>
      binding !== null
        ? (s: string) => resolveTemplate(s, binding.data, binding.filters)
        : undefined,
    [binding],
  );
  return <RichTextView rich={rich} resolve={resolve} />;
}
