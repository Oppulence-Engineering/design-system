/**
 * `@oppulence/infinite-canvas/testing` — yjs-FREE test utilities for the library and
 * for consumers. The in-memory adapter, linked-pair harness, and document factories.
 */

export {
  makeComponent,
  makeDocument,
  makeElement,
  makeFrame,
  makeGroup,
  makeText,
  testIdFactory,
} from "./factories";
export type { FrameOptions } from "./factories";
export { InMemoryCollabAdapter, InMemoryHub } from "./in-memory-adapter";
export { createLinkedAdapterPair } from "./linked-pair";
export type { LinkedClient, LinkedPair } from "./linked-pair";
