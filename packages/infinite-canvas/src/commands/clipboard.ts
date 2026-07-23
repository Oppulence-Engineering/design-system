/**
 * Clipboard payload (§7b). Programmatic copy/cut/paste operate on an INTERNAL in-store
 * buffer (deterministic; cross-document). OS-clipboard interop with the custom MIME
 * type only works through real keyboard copy/cut/paste DOM events (the async Clipboard
 * API can't carry a custom MIME from a programmatic button), so `api.commands.paste()`
 * pastes the internal buffer.
 */

import type { SceneNode } from "../document/nodes";

export const CLIPBOARD_MIME = "application/x-oppulence-canvas+json";
export const CLIPBOARD_VERSION = 1;

/** A self-contained serialized subtree, id-remapped on paste. */
export interface ClipboardPayload {
  version: number;
  mime: typeof CLIPBOARD_MIME;
  /** Roots of the copied selection (their `parentId` is normalized to null in the payload). */
  roots: readonly string[];
  /** Flat map of all copied nodes (roots + descendants). */
  nodes: Record<string, SceneNode>;
}

/** Serialize to the `text/plain` fallback string used for OS clipboard events. */
export function serializeClipboard(payload: ClipboardPayload): string {
  return JSON.stringify(payload);
}

/** Parse a clipboard string, returning null if it is not our payload. */
export function parseClipboard(raw: string): ClipboardPayload | null {
  try {
    const parsed = JSON.parse(raw) as ClipboardPayload;
    if (parsed.mime !== CLIPBOARD_MIME || !Array.isArray(parsed.roots))
      return null;
    return parsed;
  } catch {
    return null;
  }
}
