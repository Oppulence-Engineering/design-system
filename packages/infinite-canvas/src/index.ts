/**
 * `@oppulence/infinite-canvas` — main entrypoint. Provider, renderer, hooks, tools,
 * registry, and the imperative CanvasApi. NEVER re-exports `./collab/yjs` (that would
 * pull yjs into the default entrypoint and break corinthian's yjs-free typecheck).
 */

"use client";

// Provider + context + hooks
export { CanvasProvider } from "./store/provider";
export type {
  CanvasProviderProps,
  CanvasStorageBinding,
} from "./store/provider";
export { useCanvas } from "./store/context";
export type { CanvasContextValue } from "./store/context";
export {
  useActiveTool,
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
} from "./store/hooks";
export type {
  CanvasApi,
  CanvasStatus,
  ViewportBridge,
} from "./store/canvas-api";
export { zoomCameraAtScreenPoint } from "./store/canvas-api";

// Renderer
export { CanvasRoot } from "./renderer/canvas-root";
export type { CanvasRootProps } from "./renderer/canvas-root";
export { NodeRenderer } from "./renderer/node-renderer";
export { styleToCss } from "./renderer/style-to-css";

// Registry
export {
  createComponentRegistry,
  defineComponent,
  emptyRegistry,
} from "./registry/component-registry";
export type {
  ComponentDefinition,
  ComponentRegistry,
} from "./registry/component-registry";

// Tools
export { ToolRegistry, builtInTools } from "./tools/tool-registry";
export {
  toolId,
  TOOL_COMPONENT,
  TOOL_ELEMENT,
  TOOL_FRAME,
  TOOL_HAND,
  TOOL_SELECT,
  TOOL_TEXT,
} from "./tools/tool";
export type {
  CanvasPointerEvent,
  Tool,
  ToolContext,
  ToolId,
} from "./tools/tool";
export { createSelectTool } from "./tools/select-tool";
export { createHandTool } from "./tools/hand-tool";
export { createFrameTool } from "./tools/frame-tool";
export { createTextTool } from "./tools/text-tool";
export { snapRect } from "./tools/snapping";
export type { SnapResult } from "./tools/snapping";
export type { SnapGuide } from "./store/session-store";

// Session / gesture types
export type {
  EditorMode,
  Gesture,
  ResizeHandle,
  SessionState,
} from "./store/session-store";

// Camera / geometry
export type { Camera } from "./viewport/camera";
export {
  cameraToFit,
  canvasToScreen,
  clampZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  screenToCanvas,
  zoomAtPoint,
} from "./viewport/camera";
export type { Point, Rect, Size } from "./viewport/geometry";

// Review comments
export { useComments } from "./comments/hooks";
export type { CommentsApi } from "./comments/hooks";
export type { Comment, CommentReply } from "./comments/store";

// Template & block library
export { useBlockLibrary } from "./blocks/hooks";
export type { BlockLibrary } from "./blocks/hooks";
export type { Block } from "./blocks/store";

// Responsive breakpoints
export {
  BREAKPOINTS,
  ResponsivePreview,
  useResponsive,
} from "./responsive/index";
export type {
  Breakpoint,
  Responsive,
  ResponsivePreviewProps,
} from "./responsive/index";

// Theming
export { themeToCssVars } from "./theme/theme";
export type { CanvasTheme } from "./theme/theme";

// Design linting (a11y / contrast)
export {
  contrastRatio,
  lintDocument,
  lintNode,
  meetsAA,
  parseColor,
  useDesignLint,
} from "./lint/index";
export type { DesignLint, LintIssue, LintSeverity } from "./lint/index";

// Data binding (templates)
export {
  DEFAULT_FILTERS,
  hasBinding,
  itemScope,
  resolveArray,
  resolveAttrs,
  resolveCondition,
  resolvePath,
  resolveTemplate,
  resolveValue,
} from "./binding/resolve";
export type { BindingData, BindingFilter, FilterMap } from "./binding/resolve";
export { BindingProvider, useBinding } from "./binding/context";
export type { BindingContextValue } from "./binding/context";

// Everything server-safe (document model, ops, schemas, sanitize).
export * from "./document";
