/**
 * Per-node renderer (§6). Dispatches by node type; renders real DOM for HTML/text/frame
 * nodes and consumer components (validated, error-boundaried) for component nodes.
 * Children come from the derived index; each child subscribes independently so a single
 * edit re-renders only the touched node.
 */

"use client";

import * as React from "react";
import type { NodeId } from "../document/ids";
import type { SceneNode } from "../document/nodes";
import { assertNever } from "../document/nodes";
import { useCanvas } from "../store/context";
import { useChildren, useNode, useSessionStore } from "../store/hooks";
import { styleToCss } from "./style-to-css";
import { NodeErrorBoundary } from "./node-error-boundary";
import { ArtboardContext, useRectCache } from "./renderer-context";

export function NodeRenderer({ id }: { id: NodeId }): React.ReactNode {
  const node = useNode(id);
  if (node === undefined || !node.visible) return null;
  return <NodeBody node={node} />;
}

/** Callback ref that registers a node's element into the rect cache for its artboard. */
function useNodeRegistration(id: NodeId): (el: HTMLElement | null) => void {
  const cache = useRectCache();
  const artboardId = React.useContext(ArtboardContext);
  return React.useCallback(
    (el: HTMLElement | null) => {
      if (cache === null || el === null) return;
      const cleanup = cache.register(id, el, artboardId);
      // React 19 callback-ref cleanup.
      return cleanup;
    },
    [cache, id, artboardId],
  );
}

function NodeChildren({ id }: { id: NodeId }): React.ReactNode {
  const children = useChildren(id);
  return children.map((childId) => <NodeRenderer key={childId} id={childId} />);
}

function NodeBody({ node }: { node: SceneNode }): React.ReactNode {
  const css = styleToCss(node.style);
  const register = useNodeRegistration(node.id);

  switch (node.type) {
    case "frame": {
      // Root artboards are absolutely positioned in canvas space; nested frames flow.
      const artboardStyle: React.CSSProperties =
        node.parentId === null
          ? {
              position: "absolute",
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
              overflow: node.clipsContent ? "hidden" : "visible",
              background: "var(--ic-artboard-bg, #ffffff)",
              // Browser-level LOD: skip rendering work for offscreen artboard interiors.
              contentVisibility: "auto",
              containIntrinsicSize: `${node.width}px ${node.height}px`,
              ...css,
            }
          : css;
      const inner = (
        <div
          ref={register}
          data-canvas-node={node.id}
          data-node-type="frame"
          style={artboardStyle}
        >
          <NodeChildren id={node.id} />
        </div>
      );
      // Descendants register under this artboard when it is a root frame.
      return node.parentId === null ? (
        <ArtboardContext.Provider value={node.id}>
          {inner}
        </ArtboardContext.Provider>
      ) : (
        inner
      );
    }

    case "element": {
      const Tag = node.tag as keyof React.JSX.IntrinsicElements;
      return React.createElement(
        Tag,
        {
          ref: register,
          "data-canvas-node": node.id,
          style: css,
          ...node.attrs,
        },
        <NodeChildren id={node.id} />,
      );
    }

    case "text":
      return <TextNodeBody node={node} css={css} register={register} />;

    case "component":
      return <ComponentNodeBody node={node} css={css} register={register} />;

    case "group":
      return (
        <div
          data-canvas-node={node.id}
          data-node-type="group"
          style={{ display: "contents", ...css }}
        >
          <NodeChildren id={node.id} />
        </div>
      );

    default:
      return assertNever(node, "node");
  }
}

function TextNodeBody({
  node,
  css,
  register,
}: {
  node: Extract<SceneNode, { type: "text" }>;
  css: React.CSSProperties;
  register: (el: HTMLElement | null) => void;
}): React.ReactNode {
  const { sessionStore, documentStore } = useCanvas();
  const editing = useSessionStore((s) => s.editingTextId === node.id);
  const editorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (editing && editorRef.current !== null) {
      editorRef.current.focus();
      // Place caret at end.
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);

  if (editing) {
    // Uncontrolled contentEditable — reconciling `text` mid-edit would break IME.
    const commit = () => {
      const value = editorRef.current?.innerText ?? node.text;
      sessionStore.getState().setEditingText(null);
      if (value !== node.text) {
        sessionStore.getState().setSelection([node.id]);
        documentStore
          .getState()
          .apply([{ type: "set-text", nodeId: node.id, text: value }]);
      }
    };
    return (
      <div
        ref={editorRef}
        data-canvas-node={node.id}
        data-node-type="text"
        contentEditable
        suppressContentEditableWarning
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
            e.preventDefault();
            commit();
          }
        }}
        style={{
          ...css,
          pointerEvents: "auto",
          outline: "1px solid var(--ic-accent, #3b82f6)",
          cursor: "text",
        }}
      >
        {node.text}
      </div>
    );
  }

  return (
    <div
      ref={register}
      data-canvas-node={node.id}
      data-node-type="text"
      style={css}
    >
      {node.text}
    </div>
  );
}

function ComponentNodeBody({
  node,
  css,
  register,
}: {
  node: Extract<SceneNode, { type: "component" }>;
  css: React.CSSProperties;
  register: (el: HTMLElement | null) => void;
}): React.ReactNode {
  const { registry, onError } = useCanvas();
  const def = registry.get(node.componentKey);

  if (def === undefined) {
    return (
      <div
        ref={register}
        data-canvas-node={node.id}
        style={{ ...css, ...placeholderStyle }}
      >
        Unknown component: {node.componentKey}
      </div>
    );
  }

  const parsed = def.schema.safeParse(node.props);
  if (!parsed.success) {
    return (
      <div
        ref={register}
        data-canvas-node={node.id}
        style={{ ...css, ...placeholderStyle }}
      >
        Invalid props for {def.label}
      </div>
    );
  }

  const Comp = def.component;
  return (
    <div ref={register} data-canvas-node={node.id} style={css}>
      <NodeErrorBoundary
        nodeId={node.id}
        resetKey={JSON.stringify(node.props)}
        onError={(error) =>
          onError?.({ scope: "render", nodeId: node.id, error })
        }
      >
        <Comp {...parsed.data} />
      </NodeErrorBoundary>
    </div>
  );
}

const placeholderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  border: "1px dashed var(--ic-border, #d4d4d8)",
  color: "var(--ic-muted, #71717a)",
  font: "12px/1.4 system-ui, sans-serif",
  borderRadius: 6,
  padding: 8,
};
