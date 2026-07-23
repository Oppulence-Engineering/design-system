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

export function useRectCache(): RectCache | null {
  return React.useContext(RectCacheContext);
}
