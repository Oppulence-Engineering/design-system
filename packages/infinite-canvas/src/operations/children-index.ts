/**
 * Derived children index with orphan + cycle repair (§3).
 *
 * The index is DERIVED from `nodes`, never persisted. Per-property LWW merge in
 * collaboration guarantees two corruption cases we must resolve deterministically so
 * every client converges on the same tree:
 *   (a) orphan — a node whose `parentId` points at a deleted node → indexed under root
 *       (its stored parentId is left intact so an undo/re-insert reattaches it);
 *   (b) cycle — concurrent A→B ∥ B→A reparent → broken by detaching the node with the
 *       largest id in the cycle to root.
 * Both are pure functions of the node map, so all clients repair identically.
 */

import { ROOT_PARENT, type NodeId } from "../document/ids";
import type { ChildrenIndex } from "../document/document";
import { compareSiblings } from "../document/document";
import type { NodeMap, SceneNode } from "../document/nodes";
import { nullRecord } from "../document/keys";

/** Resolve each node's effective parent key ("root" or a live, acyclic ancestor). */
function resolveEffectiveParent(nodes: NodeMap): Map<string, string> {
  // Pass 1: raw parent — missing/absent parent repairs to root (orphan rule).
  const rawParent = new Map<string, string>();
  for (const id in nodes) {
    const node = nodes[id];
    if (node === undefined) continue;
    const pid = node.parentId;
    rawParent.set(
      id,
      pid !== null && nodes[pid] !== undefined ? pid : ROOT_PARENT,
    );
  }

  // Pass 2: break cycles deterministically (detach the largest-id member to root),
  // iterating to a fixpoint since breaking one cycle can expose nothing new but is cheap.
  for (;;) {
    const cycle = findCycle(rawParent);
    if (cycle === null) break;
    let maxId = cycle[0]!;
    for (const id of cycle) if (id > maxId) maxId = id;
    rawParent.set(maxId, ROOT_PARENT);
  }
  return rawParent;
}

/** Find one cycle in the parent map, or null. Returns the node ids forming the cycle. */
function findCycle(rawParent: Map<string, string>): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();

  for (const start of rawParent.keys()) {
    if ((color.get(start) ?? WHITE) !== WHITE) continue;
    const stack: string[] = [];
    let node: string | undefined = start;
    while (node !== undefined && node !== ROOT_PARENT) {
      const c = color.get(node) ?? WHITE;
      if (c === GRAY) {
        // Found a back-edge — extract the cycle from the stack.
        const at = stack.indexOf(node);
        return stack.slice(at);
      }
      if (c === BLACK) break;
      color.set(node, GRAY);
      stack.push(node);
      node = rawParent.get(node);
    }
    for (const n of stack) color.set(n, BLACK);
  }
  return null;
}

/**
 * Build the full children index from a node map, applying orphan + cycle repair and
 * sorting each bucket by `(sortKey, id)`. O(n log n). Used on load and after any
 * structural change (local or remote).
 */
export function buildChildrenIndex(nodes: NodeMap): ChildrenIndex {
  const effectiveParent = resolveEffectiveParent(nodes);
  const buckets = new Map<string, SceneNode[]>();

  for (const id in nodes) {
    const node = nodes[id];
    if (node === undefined) continue;
    const parentKey = effectiveParent.get(id) ?? ROOT_PARENT;
    let bucket = buckets.get(parentKey);
    if (bucket === undefined) {
      bucket = [];
      buckets.set(parentKey, bucket);
    }
    bucket.push(node);
  }

  const index = nullRecord<readonly NodeId[]>();
  for (const [parentKey, bucket] of buckets) {
    bucket.sort(compareSiblings);
    index[parentKey] = bucket.map((n) => n.id);
  }
  return index;
}

/** Ordered child ids for a parent (or the empty array). */
const EMPTY: readonly NodeId[] = Object.freeze([]);
export function childrenOf(
  index: ChildrenIndex,
  parentKey: string,
): readonly NodeId[] {
  return index[parentKey] ?? EMPTY;
}
