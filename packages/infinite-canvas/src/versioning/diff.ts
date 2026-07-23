/**
 * Document diff (§ versioning). Pure structural comparison of two document snapshots —
 * the basis for an audit trail ("what changed between v3 and v4") and rollback UX.
 */

import type { CanvasDocument } from "../document/document";
import type { NodeId } from "../document/ids";

export interface DocumentDiff {
  added: NodeId[];
  removed: NodeId[];
  changed: NodeId[];
  /** Meta keys whose value changed (name, styles, canvas settings, …). */
  metaChanged: string[];
}

export function diffDocuments(
  a: CanvasDocument,
  b: CanvasDocument,
): DocumentDiff {
  const added: NodeId[] = [];
  const removed: NodeId[] = [];
  const changed: NodeId[] = [];

  for (const id in b.nodes) {
    const before = a.nodes[id];
    const after = b.nodes[id]!;
    if (before === undefined) added.push(id as NodeId);
    else if (JSON.stringify(before) !== JSON.stringify(after))
      changed.push(id as NodeId);
  }
  for (const id in a.nodes) {
    if (b.nodes[id] === undefined) removed.push(id as NodeId);
  }

  const metaChanged: string[] = [];
  const keys = new Set([...Object.keys(a.meta), ...Object.keys(b.meta)]);
  for (const k of keys) {
    if (
      JSON.stringify((a.meta as Record<string, unknown>)[k]) !==
      JSON.stringify((b.meta as Record<string, unknown>)[k])
    ) {
      metaChanged.push(k);
    }
  }

  return { added, removed, changed, metaChanged };
}

/** Total number of differences (0 = identical). */
export function diffCount(diff: DocumentDiff): number {
  return (
    diff.added.length +
    diff.removed.length +
    diff.changed.length +
    diff.metaChanged.length
  );
}
