/**
 * Rich-text editing commands built on the standard Selection/Range DOM APIs — the modern
 * replacement for the deprecated `document.execCommand`. Each command mutates the
 * contentEditable subtree and returns a fresh `Range` for the editor to reselect; the editor
 * owns the `window.getSelection()` read/write around them, so these functions are pure DOM
 * surgery over an explicit range and unit-testable in jsdom (no reliance on the browser's
 * selection singleton).
 *
 * The markup they produce is deliberately simple (`<strong>/<em>/<u>/<s>/<a>` + block tags):
 * `domToRich` is the source of truth and re-derives the typed model from whatever ends up in
 * the tree, so these never need to emit canonical HTML — only recognizable marks.
 */

"use client";

/** Inline mark elements recognized by `domToRich` (bold / italic / underline / strike). */
export type MarkTag = "STRONG" | "EM" | "U" | "S";
/** Block element tags the block picker can set. */
export type BlockTag = "H1" | "H2" | "H3" | "P";

/** Nearest ancestor of `node` (exclusive of `stop`) whose tag matches, or null. */
function ancestorWithTag(
  node: Node | null,
  tag: string,
  stop: HTMLElement,
): HTMLElement | null {
  let n: Node | null = node;
  while (n !== null && n !== stop) {
    if (
      n.nodeType === Node.ELEMENT_NODE &&
      (n as HTMLElement).tagName === tag
    ) {
      return n as HTMLElement;
    }
    n = n.parentNode;
  }
  return null;
}

/** Unwrap an element in place (replace it with its children); returns a Range over them. */
function unwrap(el: HTMLElement): Range {
  const range = document.createRange();
  const parent = el.parentNode;
  if (parent === null) {
    range.selectNodeContents(el);
    return range;
  }
  const first = el.firstChild;
  const last = el.lastChild;
  while (el.firstChild !== null) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
  if (first !== null && last !== null) {
    range.setStartBefore(first);
    range.setEndAfter(last);
  }
  return range;
}

/** Flatten nested same-`tag` elements inside a fragment/element (keep their children). */
function flattenTag(root: DocumentFragment | HTMLElement, tag: string): void {
  for (const nested of Array.from(root.querySelectorAll(tag.toLowerCase()))) {
    const parent = nested.parentNode;
    if (parent === null) continue;
    while (nested.firstChild !== null)
      parent.insertBefore(nested.firstChild, nested);
    parent.removeChild(nested);
  }
}

/** Wrap the range's contents in a fresh `tag` element (flattening same-tag nesting). */
function wrapRange(range: Range, tag: string): Range {
  const wrapper = document.createElement(tag.toLowerCase());
  const frag = range.extractContents();
  flattenTag(frag, tag);
  wrapper.appendChild(frag);
  range.insertNode(wrapper);
  const out = document.createRange();
  out.selectNodeContents(wrapper);
  return out;
}

/**
 * Toggle an inline mark over the selection: if it is already fully inside a matching mark
 * element, unwrap it; otherwise wrap the selected contents. A collapsed range is a no-op
 * (there is nothing to mark).
 */
export function toggleInlineMark(
  editor: HTMLElement,
  range: Range,
  tag: MarkTag,
): Range {
  if (range.collapsed) return range;
  const startMark = ancestorWithTag(range.startContainer, tag, editor);
  const endMark = ancestorWithTag(range.endContainer, tag, editor);
  if (startMark !== null && startMark === endMark) return unwrap(startMark);
  return wrapRange(range, tag);
}

/**
 * Wrap the selection in an anchor (or retarget an anchor the selection already sits inside).
 * The caller is responsible for validating `href` (scheme allowlist) before calling.
 */
export function applyLink(
  editor: HTMLElement,
  range: Range,
  href: string,
): Range {
  if (range.collapsed) return range;
  const existing = ancestorWithTag(range.startContainer, "A", editor);
  if (
    existing !== null &&
    existing === ancestorWithTag(range.endContainer, "A", editor)
  ) {
    existing.setAttribute("href", href);
    const out = document.createRange();
    out.selectNodeContents(existing);
    return out;
  }
  const anchor = document.createElement("a");
  anchor.setAttribute("href", href);
  const frag = range.extractContents();
  flattenTag(frag, "A");
  anchor.appendChild(frag);
  range.insertNode(anchor);
  const out = document.createRange();
  out.selectNodeContents(anchor);
  return out;
}

/** The editor's direct-child block elements that the range intersects. */
function blocksInRange(editor: HTMLElement, range: Range): HTMLElement[] {
  return (Array.from(editor.children) as HTMLElement[]).filter((child) =>
    range.intersectsNode(child),
  );
}

/**
 * Set the block type (H1/H2/H3/P) of every block the selection touches. When the editor holds
 * bare inline content (no block wrapper yet), everything is wrapped into one new block.
 */
export function setBlockTag(
  editor: HTMLElement,
  range: Range,
  tag: BlockTag,
): Range {
  const out = document.createRange();
  const blocks = blocksInRange(editor, range);
  if (blocks.length === 0) {
    const block = document.createElement(tag.toLowerCase());
    while (editor.firstChild !== null) block.appendChild(editor.firstChild);
    editor.appendChild(block);
    out.selectNodeContents(block);
    return out;
  }
  const created: HTMLElement[] = [];
  for (const block of blocks) {
    const next = document.createElement(tag.toLowerCase());
    if (block.style.textAlign !== "")
      next.style.textAlign = block.style.textAlign;
    while (block.firstChild !== null) next.appendChild(block.firstChild);
    block.parentNode?.replaceChild(next, block);
    created.push(next);
  }
  const first = created[0];
  const last = created[created.length - 1];
  if (first !== undefined && last !== undefined) {
    out.setStartBefore(first);
    out.setEndAfter(last);
  }
  return out;
}

/**
 * Toggle an unordered list over the selected blocks: if the selection already covers a list,
 * unwrap each `<li>` back to a paragraph; otherwise fold the touched blocks into a `<ul>`.
 */
export function toggleUnorderedList(editor: HTMLElement, range: Range): Range {
  const out = document.createRange();
  const blocks = blocksInRange(editor, range);
  const existingList = blocks.find(
    (block) => block.tagName === "UL" || block.tagName === "OL",
  );
  if (existingList !== undefined) {
    const frag = document.createDocumentFragment();
    const created: HTMLElement[] = [];
    for (const item of Array.from(existingList.children)) {
      const paragraph = document.createElement("p");
      while (item.firstChild !== null) paragraph.appendChild(item.firstChild);
      frag.appendChild(paragraph);
      created.push(paragraph);
    }
    existingList.parentNode?.replaceChild(frag, existingList);
    const first = created[0];
    const last = created[created.length - 1];
    if (first !== undefined && last !== undefined) {
      out.setStartBefore(first);
      out.setEndAfter(last);
    }
    return out;
  }

  const list = document.createElement("ul");
  if (blocks.length === 0) {
    const item = document.createElement("li");
    while (editor.firstChild !== null) item.appendChild(editor.firstChild);
    list.appendChild(item);
    editor.appendChild(list);
  } else {
    for (const block of blocks) {
      const item = document.createElement("li");
      while (block.firstChild !== null) item.appendChild(block.firstChild);
      list.appendChild(item);
    }
    const anchorBlock = blocks[0];
    anchorBlock?.parentNode?.insertBefore(list, anchorBlock);
    for (const block of blocks) block.remove();
  }
  out.selectNodeContents(list);
  return out;
}
