/**
 * Insert palette (§ assets/palette). Click to drop a new artboard, HTML block, text,
 * image, or a registered component onto the canvas. New items cascade so they don't
 * overlap; components come from the consumer's registry, so this doubles as a
 * design-system component palette.
 */

"use client";

import * as React from "react";
import { Button } from "@oppulence/design-system";
import { generateKeyBetween } from "../document/fractional-index";
import { asNodeId, ROOT_PARENT, type NodeId } from "../document/ids";
import type { FrameNode, SceneNode } from "../document/nodes";
import { childrenOf } from "../operations/children-index";
import type { CanvasOperation } from "../operations/operations";
import { useCanvas } from "../store/context";
import { useDocumentStore } from "../store/hooks";

type Insertable =
  | { kind: "frame" }
  | { kind: "text" }
  | { kind: "image" }
  | { kind: "component"; key: string };

export function CanvasPalette(): React.JSX.Element {
  const { documentStore, sessionStore, registry, idFactory } = useCanvas();
  const artboardCount = useDocumentStore(
    (s) => childrenOf(s.childrenIndex, ROOT_PARENT).length,
  );

  const insert = (item: Insertable) => {
    const nid = () => asNodeId(idFactory.nodeId());
    const state = documentStore.getState();
    // Cascade position from the number of existing artboards.
    const offset = artboardCount * 40;
    const rootKeys = childrenOf(state.childrenIndex, ROOT_PARENT);
    const lastRoot = rootKeys[rootKeys.length - 1];
    const lastKey =
      lastRoot !== undefined
        ? (state.document.nodes[lastRoot]?.sortKey ?? null)
        : null;

    const frameId = nid();
    const frame: FrameNode = {
      type: "frame",
      id: frameId,
      parentId: null,
      sortKey: generateKeyBetween(lastKey, null),
      name: item.kind === "component" ? item.key : item.kind,
      visible: true,
      locked: false,
      rotation: 0,
      x: 40 + offset,
      y: 40 + offset,
      width: 320,
      height: 200,
      clipsContent: true,
      style: {
        display: "flex",
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
        background: { type: "solid", color: "#ffffff" },
      },
    };
    const ops: CanvasOperation[] = [{ type: "insert-node", node: frame }];

    let child: SceneNode | null = null;
    const childKey = generateKeyBetween(null, null);
    if (item.kind === "text") {
      child = {
        type: "text",
        id: nid(),
        parentId: frameId,
        sortKey: childKey,
        name: "Text",
        visible: true,
        locked: false,
        rotation: 0,
        text: "Text",
        style: { fontSize: 16, color: "#111827" },
      };
    } else if (item.kind === "image") {
      const src =
        typeof window !== "undefined"
          ? window.prompt("Image URL:", "https://placehold.co/280x140")
          : null;
      child = {
        type: "element",
        id: nid(),
        parentId: frameId,
        sortKey: childKey,
        name: "img",
        visible: true,
        locked: false,
        rotation: 0,
        tag: "img",
        attrs: { src: src ?? "", alt: "" },
        style: {
          width: { unit: "%", value: 100 },
          height: { unit: "auto", value: 0 },
        },
      };
    } else if (item.kind === "component") {
      child = registry.createNode(
        item.key,
        { parentId: frameId, sortKey: childKey },
        idFactory,
      );
    }
    if (child !== null) ops.push({ type: "insert-node", node: child });

    documentStore.getState().apply(ops);
    sessionStore.getState().setSelection([frameId as NodeId]);
  };

  return (
    <div
      data-canvas-panel="palette"
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: "var(--ic-artboard-bg,#fff)",
        borderRight: "1px solid var(--ic-border,#e4e4e7)",
        font: "13px system-ui",
      }}
    >
      <div
        style={{
          font: "600 11px/1.4 system-ui",
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: "var(--ic-muted,#71717a)",
          marginBottom: 2,
        }}
      >
        Insert
      </div>
      <Button
        variant="outline"
        width="full"
        size="sm"
        onClick={() => insert({ kind: "frame" })}
      >
        + Frame
      </Button>
      <Button
        variant="outline"
        width="full"
        size="sm"
        onClick={() => insert({ kind: "text" })}
      >
        + Text
      </Button>
      <Button
        variant="outline"
        width="full"
        size="sm"
        onClick={() => insert({ kind: "image" })}
      >
        + Image
      </Button>
      {registry.keys().length > 0 ? (
        <div
          style={{
            font: "600 11px/1.4 system-ui",
            textTransform: "uppercase",
            letterSpacing: 0.4,
            color: "var(--ic-muted,#71717a)",
            margin: "8px 0 2px",
          }}
        >
          Components
        </div>
      ) : null}
      {registry.keys().map((key) => (
        <Button
          key={key}
          variant="outline"
          width="full"
          size="sm"
          onClick={() => insert({ kind: "component", key })}
        >
          {registry.get(key)?.label ?? key}
        </Button>
      ))}
    </div>
  );
}
