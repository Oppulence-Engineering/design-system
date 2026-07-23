/**
 * Runtime Zod schemas for the operation union + a JSON-Schema export (§ AI op-authoring).
 * Lets a consumer validate op-logs server-side AND hand an LLM a machine-readable tool
 * contract ("here are the ops; emit a batch"). The document/nodes schemas already exist
 * in ../document/schema/v1; this adds the op layer on top.
 */

import { z } from "zod";
import { sceneNodeSchema } from "../document/schema/v1";

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

const nodeId = z.string().min(1);

export const operationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("insert-node"), node: sceneNodeSchema }),
  z.object({ type: z.literal("remove-node"), nodeId }),
  z.object({
    type: z.literal("move-node"),
    nodeId,
    parentId: nodeId.nullable(),
    sortKey: z.string(),
  }),
  z.object({
    type: z.literal("set-node-geometry"),
    nodeId,
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
  z.object({ type: z.literal("set-text"), nodeId, text: z.string() }),
  z.object({
    type: z.literal("set-node-flags"),
    nodeId,
    name: z.string().optional(),
    visible: z.boolean().optional(),
    locked: z.boolean().optional(),
    clipsContent: z.boolean().optional(),
    visibleWhen: z.string().optional(),
    repeat: z.string().optional(),
    repeatAs: z.string().optional(),
  }),
  z.object({
    type: z.literal("set-node-attrs"),
    nodeId,
    set: z.record(z.string(), z.string()),
    unset: z.array(z.string()),
  }),
  z.object({
    type: z.literal("set-component-props"),
    nodeId,
    set: z.record(z.string(), jsonValue),
    unset: z.array(z.string()),
  }),
  z.object({
    type: z.literal("set-node-style"),
    nodeId,
    set: z.record(z.string(), jsonValue),
    unset: z.array(z.string()),
  }),
  z.object({
    type: z.literal("set-document-meta"),
    set: z.record(z.string(), jsonValue),
    unset: z.array(z.string()),
  }),
  z.object({
    type: z.literal("rebalance-sort-keys"),
    parentId: nodeId.nullable(),
    keys: z.record(z.string(), z.string()),
  }),
]);

/** A batch is an array of operations. */
export const operationArraySchema = z.array(operationSchema);

/** JSON Schema for the operation union — feed to an LLM tool definition. */
export function operationsJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(operationArraySchema) as Record<string, unknown>;
}

/** Parse-and-validate an unknown into an operation array (throws on violation). */
export function parseOperations(
  raw: unknown,
): import("./operations").CanvasOperation[] {
  return operationArraySchema.parse(
    raw,
  ) as unknown as import("./operations").CanvasOperation[];
}

export function safeParseOperations(
  raw: unknown,
):
  | { success: true; data: import("./operations").CanvasOperation[] }
  | { success: false; error: z.ZodError } {
  const result = operationArraySchema.safeParse(raw);
  if (result.success)
    return {
      success: true,
      data: result.data as unknown as import("./operations").CanvasOperation[],
    };
  return { success: false, error: result.error };
}
