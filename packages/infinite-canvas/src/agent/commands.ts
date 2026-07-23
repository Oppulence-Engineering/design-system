/**
 * High-level agent authoring commands (§ AI op-authoring). These are what an LLM emits —
 * ref-based, no ids/sortKeys to invent — and `compileAgentCommands` lowers them to the
 * validated CanvasOperation batch that `api.apply` consumes. Refs are string handles the
 * model assigns to new nodes (or an existing NodeId to target something already there).
 */

import { z } from "zod";
import { generateKeyBetween } from "../document/fractional-index";
import { asNodeId, type NodeId } from "../document/ids";
import type { JsonValue } from "../document/json";
import { HTML_TAGS, type FrameNode, type SceneNode } from "../document/nodes";
import { ROOT_PARENT } from "../document/ids";
import { childrenOf } from "../operations/children-index";
import type { CanvasState } from "../operations/apply";
import type { CanvasOperation } from "../operations/operations";

const styleObject = z.record(z.string(), z.unknown());

export const agentCommandSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add-frame"),
    ref: z.string().optional(),
    parent: z.string().optional(),
    name: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    background: z.string().optional(),
    layout: z.enum(["row", "column", "none"]).optional(),
    style: styleObject.optional(),
    /** Template directives: repeat over an array path, and/or show only when a path is truthy. */
    repeat: z.string().optional(),
    visibleWhen: z.string().optional(),
  }),
  z.object({
    op: z.literal("add-text"),
    ref: z.string().optional(),
    parent: z.string().optional(),
    text: z.string(),
    fontSize: z.number().optional(),
    fontWeight: z.number().optional(),
    color: z.string().optional(),
    style: styleObject.optional(),
    visibleWhen: z.string().optional(),
  }),
  z.object({
    op: z.literal("add-element"),
    ref: z.string().optional(),
    parent: z.string().optional(),
    tag: z.enum(HTML_TAGS),
    attrs: z.record(z.string(), z.string()).optional(),
    style: styleObject.optional(),
  }),
  z.object({
    op: z.literal("add-component"),
    ref: z.string().optional(),
    parent: z.string().optional(),
    componentKey: z.string(),
    props: z.record(z.string(), z.unknown()).optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
  z.object({ op: z.literal("set-style"), ref: z.string(), style: styleObject }),
  z.object({ op: z.literal("set-text"), ref: z.string(), text: z.string() }),
  z.object({
    op: z.literal("set-props"),
    ref: z.string(),
    props: z.record(z.string(), z.unknown()),
  }),
  z.object({ op: z.literal("remove"), ref: z.string() }),
]);

export type AgentCommand = z.infer<typeof agentCommandSchema>;
export const agentCommandsSchema = z.array(agentCommandSchema);

/** JSON Schema for the command list — hand this to an LLM tool definition. */
export function agentCommandsJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(agentCommandsSchema) as Record<string, unknown>;
}

export interface CompileContext {
  state: CanvasState;
  createNodeId: () => NodeId;
}

export interface CompileResult {
  ops: CanvasOperation[];
  /** ref → the NodeId it resolved to (new or existing). */
  refs: Record<string, NodeId>;
}

/** Lower agent commands to a validated CanvasOperation batch. Pure (given a createNodeId). */
export function compileAgentCommands(
  commands: readonly AgentCommand[],
  ctx: CompileContext,
): CompileResult {
  const { state, createNodeId } = ctx;
  const refs: Record<string, NodeId> = {};
  const ops: CanvasOperation[] = [];
  // Track the running last sortKey per parent so multiple appended children stay ordered.
  const lastKey = new Map<string, string | null>();

  const parentKeyOf = (parentId: NodeId | null) => parentId ?? ROOT_PARENT;

  const initLastKey = (parentId: NodeId | null): string | null => {
    const pk = parentKeyOf(parentId);
    if (lastKey.has(pk)) return lastKey.get(pk)!;
    const kids = childrenOf(state.childrenIndex, pk);
    const lastId = kids[kids.length - 1];
    const key =
      lastId !== undefined
        ? (state.document.nodes[lastId]?.sortKey ?? null)
        : null;
    lastKey.set(pk, key);
    return key;
  };
  const nextKey = (parentId: NodeId | null): string => {
    const prev = initLastKey(parentId);
    const key = generateKeyBetween(prev, null);
    lastKey.set(parentKeyOf(parentId), key);
    return key;
  };

  const resolveRef = (ref: string): NodeId | undefined => {
    if (refs[ref] !== undefined) return refs[ref];
    // Existing node id.
    if (state.document.nodes[ref] !== undefined) return asNodeId(ref);
    return undefined;
  };
  const resolveParent = (ref: string | undefined): NodeId | null => {
    if (ref === undefined) return null;
    return resolveRef(ref) ?? null;
  };

  for (const cmd of commands) {
    switch (cmd.op) {
      case "add-frame": {
        const id = createNodeId();
        if (cmd.ref !== undefined) refs[cmd.ref] = id;
        const parentId = resolveParent(cmd.parent);
        const isRoot = parentId === null;
        const style = {
          ...(cmd.style as Record<string, JsonValue> | undefined),
        };
        if (cmd.background !== undefined)
          style.background = { type: "solid", color: cmd.background };
        if (cmd.layout !== undefined && cmd.layout !== "none") {
          style.display = "flex";
          style.flexDirection = cmd.layout;
        }
        const node: FrameNode = {
          type: "frame",
          id,
          parentId,
          sortKey: nextKey(parentId),
          name: cmd.name ?? "Frame",
          visible: true,
          locked: false,
          rotation: 0,
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          width: cmd.width ?? (isRoot ? 400 : 200),
          height: cmd.height ?? (isRoot ? 300 : 120),
          clipsContent: true,
          style,
          ...(cmd.repeat !== undefined ? { repeat: cmd.repeat } : {}),
          ...(cmd.visibleWhen !== undefined
            ? { visibleWhen: cmd.visibleWhen }
            : {}),
        };
        ops.push({ type: "insert-node", node });
        break;
      }
      case "add-text": {
        const id = createNodeId();
        if (cmd.ref !== undefined) refs[cmd.ref] = id;
        const parentId = resolveParent(cmd.parent);
        const style = {
          ...(cmd.style as Record<string, JsonValue> | undefined),
        };
        if (cmd.fontSize !== undefined) style.fontSize = cmd.fontSize;
        if (cmd.fontWeight !== undefined) style.fontWeight = cmd.fontWeight;
        if (cmd.color !== undefined) style.color = cmd.color;
        if (parentId === null) {
          style.position = "absolute";
          style.left = style.left ?? 0;
          style.top = style.top ?? 0;
        }
        const node: SceneNode = {
          type: "text",
          id,
          parentId,
          sortKey: nextKey(parentId),
          name: "Text",
          visible: true,
          locked: false,
          rotation: 0,
          text: cmd.text,
          style,
          ...(cmd.visibleWhen !== undefined
            ? { visibleWhen: cmd.visibleWhen }
            : {}),
        };
        ops.push({ type: "insert-node", node });
        break;
      }
      case "add-element": {
        const id = createNodeId();
        if (cmd.ref !== undefined) refs[cmd.ref] = id;
        const parentId = resolveParent(cmd.parent);
        const node: SceneNode = {
          type: "element",
          id,
          parentId,
          sortKey: nextKey(parentId),
          name: cmd.tag,
          visible: true,
          locked: false,
          rotation: 0,
          tag: cmd.tag,
          attrs: cmd.attrs ?? {},
          style: { ...(cmd.style as Record<string, JsonValue> | undefined) },
        };
        ops.push({ type: "insert-node", node });
        break;
      }
      case "add-component": {
        const id = createNodeId();
        if (cmd.ref !== undefined) refs[cmd.ref] = id;
        const parentId = resolveParent(cmd.parent);
        const node: SceneNode = {
          type: "component",
          id,
          parentId,
          sortKey: nextKey(parentId),
          name: cmd.componentKey,
          visible: true,
          locked: false,
          rotation: 0,
          componentKey: cmd.componentKey,
          props: (cmd.props as Record<string, JsonValue> | undefined) ?? {},
          style: { width: cmd.width ?? 220, height: cmd.height ?? 120 },
        };
        ops.push({ type: "insert-node", node });
        break;
      }
      case "set-style": {
        const id = resolveRef(cmd.ref);
        if (id !== undefined) {
          ops.push({
            type: "set-node-style",
            nodeId: id,
            set: cmd.style as Record<string, JsonValue>,
            unset: [],
          });
        }
        break;
      }
      case "set-text": {
        const id = resolveRef(cmd.ref);
        if (id !== undefined)
          ops.push({ type: "set-text", nodeId: id, text: cmd.text });
        break;
      }
      case "set-props": {
        const id = resolveRef(cmd.ref);
        if (id !== undefined) {
          ops.push({
            type: "set-component-props",
            nodeId: id,
            set: cmd.props as Record<string, JsonValue>,
            unset: [],
          });
        }
        break;
      }
      case "remove": {
        const id = resolveRef(cmd.ref);
        if (id !== undefined) ops.push({ type: "remove-node", nodeId: id });
        break;
      }
    }
  }

  return { ops, refs };
}
