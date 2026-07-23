/**
 * Canvas description for LLM context (§ AI op-authoring). A compact, JSON-serializable
 * snapshot of the document + selection + available components that an assistant reads
 * before emitting authoring commands.
 */

import { ROOT_PARENT, type NodeId } from "../document/ids";
import type { SceneNode } from "../document/nodes";
import type { CanvasState } from "../operations/apply";
import { childrenOf } from "../operations/children-index";
import type { ComponentRegistry } from "../registry/component-registry";

export interface DescribedNode {
  id: string;
  type: string;
  name: string;
  text?: string;
  componentKey?: string;
  tag?: string;
  children: DescribedNode[];
}

export interface CanvasDescription {
  documentName: string;
  nodeCount: number;
  tree: DescribedNode[];
  selection: string[];
  availableComponents: { key: string; label: string }[];
}

function describeNode(state: CanvasState, id: NodeId): DescribedNode | null {
  const node: SceneNode | undefined = state.document.nodes[id];
  if (node === undefined) return null;
  const described: DescribedNode = {
    id: node.id,
    type: node.type,
    name: node.name,
    children: [],
  };
  if (node.type === "text") described.text = node.text.slice(0, 120);
  if (node.type === "component") described.componentKey = node.componentKey;
  if (node.type === "element") described.tag = node.tag;
  for (const childId of childrenOf(state.childrenIndex, id)) {
    const child = describeNode(state, childId);
    if (child !== null) described.children.push(child);
  }
  return described;
}

export function describeCanvas(
  state: CanvasState,
  selection: readonly NodeId[],
  registry: ComponentRegistry,
): CanvasDescription {
  const tree: DescribedNode[] = [];
  for (const rootId of childrenOf(state.childrenIndex, ROOT_PARENT)) {
    const node = describeNode(state, rootId);
    if (node !== null) tree.push(node);
  }
  return {
    documentName: state.document.meta.name,
    nodeCount: Object.keys(state.document.nodes).length,
    tree,
    selection: [...selection],
    availableComponents: registry
      .keys()
      .map((key) => ({ key, label: registry.get(key)?.label ?? key })),
  };
}
