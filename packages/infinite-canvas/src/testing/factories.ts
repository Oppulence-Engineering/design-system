/**
 * Test/document factories (part of the yjs-free `./testing` export). Handy for
 * consumers writing their own tests and for the library's own suites.
 */

import {
  CURRENT_SCHEMA_VERSION,
  type CanvasDocument,
} from "../document/document";
import {
  asDocumentId,
  asNodeId,
  createSeededIdFactory,
  type IdFactory,
  type NodeId,
} from "../document/ids";
import type {
  ComponentNode,
  ElementNode,
  FrameNode,
  GroupNode,
  HtmlTag,
  NodeMap,
  SceneNode,
  TextNode,
} from "../document/nodes";
import { nullRecord } from "../document/keys";

let counter = 0;
function nextKey(): string {
  // Simple increasing sortKey for fixtures ("a0" < "a1" < ...). Not fractional; fine for tests.
  return `a${(counter++).toString(36).padStart(4, "0")}`;
}

export interface FrameOptions {
  id?: string;
  parentId?: NodeId | null;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  sortKey?: string;
}

export function makeFrame(opts: FrameOptions = {}): FrameNode {
  return {
    type: "frame",
    id: asNodeId(opts.id ?? `frame-${counter++}`),
    parentId: opts.parentId ?? null,
    sortKey: opts.sortKey ?? nextKey(),
    name: opts.name ?? "Frame",
    visible: true,
    locked: false,
    rotation: 0,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    width: opts.width ?? 400,
    height: opts.height ?? 300,
    clipsContent: true,
    style: {},
  };
}

export function makeElement(
  parentId: NodeId,
  opts: {
    id?: string;
    tag?: HtmlTag;
    sortKey?: string;
    attrs?: Record<string, string>;
  } = {},
): ElementNode {
  return {
    type: "element",
    id: asNodeId(opts.id ?? `el-${counter++}`),
    parentId,
    sortKey: opts.sortKey ?? nextKey(),
    name: opts.tag ?? "div",
    visible: true,
    locked: false,
    rotation: 0,
    tag: opts.tag ?? "div",
    attrs: opts.attrs ?? {},
    style: {},
  };
}

export function makeText(
  parentId: NodeId,
  opts: { id?: string; text?: string; sortKey?: string } = {},
): TextNode {
  return {
    type: "text",
    id: asNodeId(opts.id ?? `text-${counter++}`),
    parentId,
    sortKey: opts.sortKey ?? nextKey(),
    name: "Text",
    visible: true,
    locked: false,
    rotation: 0,
    text: opts.text ?? "Hello",
    style: {},
  };
}

export function makeComponent(
  parentId: NodeId,
  opts: {
    id?: string;
    componentKey?: string;
    props?: ComponentNode["props"];
    sortKey?: string;
  } = {},
): ComponentNode {
  return {
    type: "component",
    id: asNodeId(opts.id ?? `cmp-${counter++}`),
    parentId,
    sortKey: opts.sortKey ?? nextKey(),
    name: opts.componentKey ?? "Component",
    visible: true,
    locked: false,
    rotation: 0,
    componentKey: opts.componentKey ?? "card",
    props: opts.props ?? {},
    style: {},
  };
}

export function makeGroup(
  parentId: NodeId | null,
  opts: { id?: string; sortKey?: string } = {},
): GroupNode {
  return {
    type: "group",
    id: asNodeId(opts.id ?? `grp-${counter++}`),
    parentId,
    sortKey: opts.sortKey ?? nextKey(),
    name: "Group",
    visible: true,
    locked: false,
    rotation: 0,
    style: {},
  };
}

/** Build a document from a list of nodes (order irrelevant; keyed by id). */
export function makeDocument(
  nodes: SceneNode[] = [],
  name = "Test",
): CanvasDocument {
  const map: NodeMap = nullRecord<SceneNode>();
  for (const node of nodes) map[node.id] = node;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: asDocumentId("doc-test"),
    meta: { name },
    nodes: map,
  };
}

/** A deterministic id factory for reproducible tests. */
export function testIdFactory(prefix = "t"): IdFactory {
  return createSeededIdFactory(prefix);
}
