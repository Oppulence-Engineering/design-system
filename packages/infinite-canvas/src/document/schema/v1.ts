/**
 * Zod v1 schemas for the document (server-safe; exported from `./document` so consumer
 * tRPC routers can validate persisted documents). Schemas are FORWARD-COMPATIBLE:
 * unknown keys pass through (`.catchall`/`.loose`) so an older client round-trips a
 * newer client's data losslessly (§3d) — EXCEPT `attrs`, which is a closed, spec-defined
 * security surface and stays default-deny (sanitize, not schema, is the attr gate).
 *
 * The TypeScript types in `../nodes`/`../document` are hand-written (they read well at
 * consumer import sites); these schemas `satisfies` them so the two cannot drift.
 */

import { z } from "zod";
import type { CanvasDocument } from "../document";
import { CURRENT_SCHEMA_VERSION } from "../document";
import { HTML_TAGS } from "../nodes";

const jsonValue: z.ZodType = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);

// Style is intentionally loose (forward-compatible): known keys are not exhaustively
// modeled here; the sanitize boundary enforces safety, and unknown keys are preserved.
const nodeStyle = z.looseObject({}) as z.ZodType<Record<string, unknown>>;

const baseFields = {
  id: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  sortKey: z.string().min(1),
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  rotation: z.number(),
  visibleWhen: z.string().optional(),
  repeat: z.string().optional(),
  repeatAs: z.string().optional(),
  styleRef: z.string().optional(),
};

const frameNode = z.looseObject({
  ...baseFields,
  type: z.literal("frame"),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  clipsContent: z.boolean(),
  style: nodeStyle,
});

const elementNode = z.looseObject({
  ...baseFields,
  type: z.literal("element"),
  tag: z.enum(HTML_TAGS),
  // attrs is closed/default-deny at the sanitize boundary; here we only assert string values.
  attrs: z.record(z.string(), z.string()),
  style: nodeStyle,
});

const richMarks = z.looseObject({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  code: z.boolean().optional(),
  link: z.string().optional(),
  color: z.string().optional(),
});
const richRun = z.looseObject({
  text: z.string(),
  marks: richMarks.optional(),
});
const richBlock = z.looseObject({
  type: z.enum(["paragraph", "h1", "h2", "h3", "list-item"]),
  align: z.enum(["left", "center", "right"]).optional(),
  runs: z.array(richRun),
});

const textNode = z.looseObject({
  ...baseFields,
  type: z.literal("text"),
  text: z.string(),
  rich: z.array(richBlock).optional(),
  style: nodeStyle,
});

const componentNode = z.looseObject({
  ...baseFields,
  type: z.literal("component"),
  componentKey: z.string(),
  props: z.record(z.string(), jsonValue),
  style: nodeStyle,
});

const groupNode = z.looseObject({
  ...baseFields,
  type: z.literal("group"),
  style: nodeStyle,
});

export const sceneNodeSchema = z.discriminatedUnion("type", [
  frameNode,
  elementNode,
  textNode,
  componentNode,
  groupNode,
]);

export const canvasDocumentSchema = z.looseObject({
  schemaVersion: z.number().int().nonnegative(),
  id: z.string().min(1),
  meta: z.looseObject({ name: z.string() }),
  nodes: z.record(z.string(), sceneNodeSchema),
});

/** Parse-and-brand an unknown into a CanvasDocument, throwing on structural violation. */
export function parseDocument(raw: unknown): CanvasDocument {
  return canvasDocumentSchema.parse(raw) as unknown as CanvasDocument;
}

export function safeParseDocument(
  raw: unknown,
):
  | { success: true; data: CanvasDocument }
  | { success: false; error: z.ZodError } {
  const result = canvasDocumentSchema.safeParse(raw);
  if (result.success)
    return { success: true, data: result.data as unknown as CanvasDocument };
  return { success: false, error: result.error };
}

export { CURRENT_SCHEMA_VERSION };
