/**
 * The document: a flat node map plus metadata. This is the JSON-serializable interop
 * format between the library and every consumer's storage layer.
 */

import type { DocumentId, NodeId } from "./ids";
import type { JsonValue } from "./json";
import type { NodeMap, SceneNode } from "./nodes";

export const CURRENT_SCHEMA_VERSION = 1;

export interface DocumentMeta {
  name: string;
  /** Reader-version gate for hard schema breaks (§3d). */
  minReaderVersion?: number;
  /** Consumer-defined extras (canvas background, etc.). Forward-compatible. */
  [key: string]: JsonValue | undefined;
}

export interface CanvasDocument {
  schemaVersion: number;
  id: DocumentId;
  meta: DocumentMeta;
  /** Flat map, keyed by NodeId. No nested children arrays anywhere. */
  nodes: NodeMap;
}

/**
 * Derived, never-persisted index of children per parent, ordered by `(sortKey, id)`.
 * Maintained incrementally by the operation layer; renderers subscribe to it.
 * Key is a NodeId or the literal "root" for top-level artboards.
 */
export type ChildrenIndex = Record<string, readonly NodeId[]>;

/** Read a node or undefined. */
export function getNode(
  doc: CanvasDocument,
  id: NodeId,
): SceneNode | undefined {
  return doc.nodes[id];
}

/** Comparator implementing `(sortKey, id)` total order — the tie-break that makes concurrent equal-key inserts converge. */
export function compareSiblings(a: SceneNode, b: SceneNode): number {
  if (a.sortKey < b.sortKey) return -1;
  if (a.sortKey > b.sortKey) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}
