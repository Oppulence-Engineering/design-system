/**
 * Comment pins overlay (§ comments). Renders review pins in screen space and, in comment
 * mode, a capture layer that drops a pin where you click. Included by the canvas overlay.
 */

"use client";

import * as React from "react";
import { useCanvas } from "../store/context";
import { useCamera, useSessionStore } from "../store/hooks";
import { canvasToScreen, screenToCanvas } from "../viewport/camera";
import { clientPointToElement } from "../viewport/rect-cache";
import { useComments } from "./hooks";
import type { Comment } from "./store";

export function CommentPins(): React.JSX.Element | null {
  const { commentsStore } = useCanvas();
  const camera = useCamera();
  const commentMode = useSessionStore((s) => s.commentMode);
  const { comments, addComment, stopCommentMode, resolve } = useComments();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [draftBody, setDraftBody] = React.useState("");

  const placeAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = screenToCanvas(
      clientPointToElement(e.currentTarget, {
        x: e.clientX,
        y: e.clientY,
      }),
      camera,
    );
    const created = addComment(canvas, "");
    stopCommentMode();
    if (created !== null) {
      setOpenId(created.id);
      setDraftBody("");
    }
  };

  return (
    <>
      {commentMode ? (
        <div
          data-canvas-comment-capture=""
          onPointerDown={placeAt}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "auto",
            cursor: "crosshair",
          }}
        />
      ) : null}

      {comments.map((c) => {
        const p = canvasToScreen({ x: c.x, y: c.y }, camera);
        return (
          <Pin
            key={c.id}
            comment={c}
            x={p.x}
            y={p.y}
            open={openId === c.id}
            draft={openId === c.id ? draftBody : ""}
            onDraft={setDraftBody}
            onToggle={() => setOpenId((id) => (id === c.id ? null : c.id))}
            onSubmit={(body) => {
              if (body.trim().length > 0)
                commentsStore.getState().update(c.id, { body });
              else if (c.body === "") commentsStore.getState().remove(c.id); // discard empty draft
              setOpenId(null);
            }}
            onResolve={() => resolve(c.id, !c.resolved)}
          />
        );
      })}
    </>
  );
}

function Pin({
  comment,
  x,
  y,
  open,
  draft,
  onDraft,
  onToggle,
  onSubmit,
  onResolve,
}: {
  comment: Comment;
  x: number;
  y: number;
  open: boolean;
  draft: string;
  onDraft: (v: string) => void;
  onToggle: () => void;
  onSubmit: (body: string) => void;
  onResolve: () => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        pointerEvents: "auto",
        transform: "translate(-4px, -28px)",
      }}
    >
      <button
        data-canvas-comment-pin={comment.id}
        onClick={onToggle}
        title={comment.body || "New comment"}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50% 50% 50% 2px",
          border: "2px solid #fff",
          background: comment.resolved ? "#a1a1aa" : comment.author.color,
          color: "#fff",
          font: "12px system-ui",
          cursor: "pointer",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }}
      >
        {comment.author.name.charAt(0).toUpperCase()}
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 0,
            width: 220,
            background: "var(--ic-artboard-bg, #fff)",
            border: "1px solid var(--ic-border, #e4e4e7)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            padding: 10,
            font: "13px system-ui",
            zIndex: 20,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {comment.author.name}
          </div>
          {comment.body ? (
            <div style={{ marginBottom: 6 }}>{comment.body}</div>
          ) : null}
          {comment.replies.map((r) => (
            <div
              key={r.id}
              style={{ marginBottom: 4, color: "var(--ic-muted, #334155)" }}
            >
              <strong>{r.author.name}: </strong>
              {r.body}
            </div>
          ))}
          {comment.body === "" ? (
            <>
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => onDraft(e.target.value)}
                rows={3}
                placeholder="Add a comment…"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  font: "13px system-ui",
                  padding: 6,
                  border: "1px solid var(--ic-border, #e4e4e7)",
                  borderRadius: 6,
                }}
              />
              <button
                data-testid="comment-submit"
                onClick={() => onSubmit(draft)}
                style={{
                  marginTop: 6,
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--ic-accent, #3b82f6)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Comment
              </button>
            </>
          ) : (
            <button
              onClick={onResolve}
              style={{
                marginTop: 4,
                padding: "3px 8px",
                borderRadius: 6,
                border: "1px solid var(--ic-border, #e4e4e7)",
                background: "var(--ic-artboard-bg, #fff)",
                cursor: "pointer",
                font: "12px system-ui",
              }}
            >
              {comment.resolved ? "Reopen" : "Resolve"}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
