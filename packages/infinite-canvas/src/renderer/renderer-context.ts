/**
 * Renderer-internal contexts: the shared RectCache and the current artboard id (so each
 * node registers under the right subtree for invalidation).
 */

"use client";

import * as React from "react";
import type { NodeId } from "../document/ids";
import type { RectCache } from "../viewport/rect-cache";

export const RectCacheContext = React.createContext<RectCache | null>(null);
export const ArtboardContext = React.createContext<NodeId | null>(null);

/**
 * True inside a repeated node's non-canonical projections (§ repeaters). A `repeat`
 * node renders N DOM copies that share ONE logical `node.id`; registering every copy in
 * the rect cache would clobber the id (last-write-wins) and race on cleanup. Only the
 * first (canonical) instance registers; deeper instances suppress registration for their
 * whole subtree so the cache holds one stable rect per id.
 */
export const SuppressRectRegistrationContext =
  React.createContext<boolean>(false);

export function useRectCache(): RectCache | null {
  return React.useContext(RectCacheContext);
}
