import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  CanvasProvider,
  CanvasRoot,
  useComments,
} from "@oppulence/infinite-canvas";
import { registry, sampleDocument, selfIdentity } from "./fixture";

function CommentToolbar() {
  const { commentMode, startCommentMode, stopCommentMode, comments } =
    useComments();
  const open = comments.filter((c) => !c.resolved).length;
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: 8,
        borderBottom: "1px solid #e4e4e7",
        background: "#fff",
        font: "13px system-ui",
      }}
    >
      <button
        data-testid="comment-toggle"
        onClick={() => (commentMode ? stopCommentMode() : startCommentMode())}
        style={{
          padding: "4px 12px",
          borderRadius: 6,
          border: "1px solid #e4e4e7",
          cursor: "pointer",
          background: commentMode ? "#3b82f6" : "#fff",
          color: commentMode ? "#fff" : "#111",
        }}
      >
        {commentMode ? "Click canvas to place…" : "💬 Comment"}
      </button>
      <span style={{ color: "#71717a" }}>
        {open} open · {comments.length} total
      </span>
    </div>
  );
}

function CommentsDemo() {
  return (
    <CanvasProvider
      initialDocument={sampleDocument()}
      registry={registry}
      self={selfIdentity}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto 1fr",
          height: "100vh",
        }}
      >
        <CommentToolbar />
        <CanvasRoot />
      </div>
    </CanvasProvider>
  );
}

const meta: Meta<typeof CommentsDemo> = {
  title: "Canvas/Comments",
  component: CommentsDemo,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof CommentsDemo>;

export const ReviewPins: Story = {
  name: "Review pins",
  render: () => <CommentsDemo />,
  play: async ({ canvasElement }) => {
    (
      canvasElement.querySelector(
        '[data-testid="comment-toggle"]',
      ) as HTMLButtonElement
    )?.click();
    await waitFor(() => {
      expect(
        canvasElement.querySelector("[data-canvas-comment-capture]"),
      ).not.toBeNull();
    });
    const capture = canvasElement.querySelector(
      "[data-canvas-comment-capture]",
    ) as HTMLElement;
    capture.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 300,
        clientY: 300,
      }),
    );
    await waitFor(() => {
      expect(
        canvasElement.querySelector("[data-canvas-comment-pin]"),
      ).not.toBeNull();
    });
  },
};
