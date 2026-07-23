/**
 * `@oppulence/infinite-canvas/headless` — hooks with store-only deps (no design-system
 * peer). This is corinthian's path: `CanvasRoot` + these hooks + app-local chrome.
 */

export { useLayerTree } from "./use-layer-tree";
export type { LayerRow, LayerTree } from "./use-layer-tree";
export {
  readTarget,
  useNodeProps,
  useSelectionProps,
  writeTargetOp,
} from "./use-node-props";
export type { NodeProps, SelectionFieldValue } from "./use-node-props";
export { useInspectorSections } from "./use-inspector";

// Re-export the store hooks (they are headless too).
export {
  useCamera,
  useCanvasApi,
  useCanvasCommands,
  useCanvasHistory,
  useChildren,
  useDocumentStore,
  useMode,
  useNode,
  usePeers,
  usePresenceStore,
  useSelection,
  useSessionStore,
} from "../store/hooks";
export { useCanvas } from "../store/context";
export type {
  ControlKind,
  ControlTarget,
  InspectorControl,
  InspectorSection,
  Mixed,
} from "../registry/inspector-controls";
export { MIXED } from "../registry/inspector-controls";
