/**
 * Server-safe document entrypoint (`@oppulence/infinite-canvas/document`).
 *
 * Zero React, zero zustand — safe to import in a Next.js server component or a tRPC
 * router to validate/migrate persisted documents. Also the home of the op/batch/
 * clipboard schemas and `JsonValue` for consumer server-side op-log validation.
 */

// Types
export type { CanvasDocument, ChildrenIndex, DocumentMeta } from "./document";
export { CURRENT_SCHEMA_VERSION, compareSiblings, getNode } from "./document";
export type { JsonObject, JsonPrimitive, JsonValue } from "./json";
export { isFiniteNumber, isJsonObject } from "./json";
export type {
  BatchId,
  ChildrenIndexKey,
  ClientId,
  DocumentId,
  IdFactory,
  NodeId,
} from "./ids";
export {
  asBatchId,
  asClientId,
  asDocumentId,
  asNodeId,
  createSeededIdFactory,
  defaultIdFactory,
  ROOT_PARENT,
} from "./ids";
export type {
  ComponentNode,
  ElementNode,
  FrameNode,
  GroupNode,
  HtmlTag,
  NodeMap,
  SceneNode,
  SceneNodeBase,
  SceneNodeType,
  TextNode,
} from "./nodes";
export { assertNever, HTML_TAGS, isArtboard } from "./nodes";
export type {
  BorderStyle,
  BoxEdges,
  CompoundStyleKey,
  CornerRadii,
  Dimension,
  Fill,
  NodePosition,
  NodeStyle,
  ShadowStyle,
} from "./styles";
export { COMPOUND_STYLE_KEYS } from "./styles";

// Keys / prototype-pollution guard
export {
  hasForbiddenSegment,
  isForbiddenSegment,
  nullRecord,
  withKey,
  withoutKey,
} from "./keys";

// Sanitize boundary
export type { SanitizeLimits, SanitizeResult } from "./sanitize";
export {
  DEFAULT_LIMITS,
  isSafeCustomCss,
  isSafeUrl,
  sanitizeNode,
} from "./sanitize";

// Schemas + migration
export {
  canvasDocumentSchema,
  parseDocument,
  safeParseDocument,
  sceneNodeSchema,
} from "./schema/v1";
export type { Migration, MigrationOutcome } from "./schema/migrate";
export {
  migrateCanvasDocument,
  migrateCanvasDocumentSafe,
  migrations,
} from "./schema/migrate";

// Operations (schemas/types are the op-log format consumers may validate server-side)
export type {
  BatchOrigin,
  CanvasOperation,
  CanvasOperationType,
  OperationBatch,
} from "../operations/operations";
