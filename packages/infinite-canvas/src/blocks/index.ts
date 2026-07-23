/**
 * Template & block library (§ blocks). Named, reusable subtrees; consumer-persisted.
 */

export { createBlockStore } from "./store";
export type { Block, BlockStoreState, BlockStoreBundle } from "./store";
export { useBlockLibrary } from "./hooks";
export type { BlockLibrary } from "./hooks";
