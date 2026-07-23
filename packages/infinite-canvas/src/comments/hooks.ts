/**
 * Comments hooks (§ comments). `useComments` exposes the review-pin API; comment mode
 * turns the next canvas click into a pin placement.
 */

"use client";

import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import type { NodeId } from "../document/ids";
import { useCanvas } from "../store/context";
import type { Comment } from "./store";

export interface CommentsApi {
  comments: Comment[];
  commentMode: boolean;
  startCommentMode: (author?: { name: string; color: string }) => void;
  stopCommentMode: () => void;
  addComment: (
    canvasPoint: { x: number; y: number },
    body: string,
    nodeId?: NodeId,
  ) => Comment | null;
  resolve: (id: string, resolved: boolean) => void;
  reply: (id: string, body: string) => void;
  remove: (id: string) => void;
}

export function useComments(): CommentsApi {
  const { commentsStore, sessionStore, idFactory } = useCanvas();
  const comments = useStore(
    commentsStore,
    useShallow((s) => Object.values(s.comments)),
  );
  const commentMode = useStore(sessionStore, (s) => s.commentMode);

  return {
    comments,
    commentMode,
    startCommentMode: (author) =>
      sessionStore.getState().setCommentMode(true, author),
    stopCommentMode: () => sessionStore.getState().setCommentMode(false),
    addComment: (canvasPoint, body, nodeId) => {
      const author = sessionStore.getState().commentAuthor ?? {
        name: "Anonymous",
        color: "#71717a",
      };
      const comment: Comment = {
        id: idFactory.nodeId(),
        x: canvasPoint.x,
        y: canvasPoint.y,
        nodeId,
        author,
        body,
        resolved: false,
        createdAt: nowMs(),
        replies: [],
      };
      commentsStore.getState().add(comment);
      return comment;
    },
    resolve: (id, resolved) => commentsStore.getState().resolve(id, resolved),
    reply: (id, body) => {
      const author = sessionStore.getState().commentAuthor ?? {
        name: "Anonymous",
        color: "#71717a",
      };
      commentsStore
        .getState()
        .reply(id, {
          id: idFactory.nodeId(),
          author,
          body,
          createdAt: nowMs(),
        });
    },
    remove: (id) => commentsStore.getState().remove(id),
  };
}

function nowMs(): number {
  return typeof Date !== "undefined" ? Date.now() : 0;
}
