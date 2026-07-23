/**
 * Comments / review pins (§ comments). A comment is anchored to a canvas point (and
 * optionally a node) with an author, body, resolved flag, and replies. Held in a
 * per-instance vanilla store (like presence); the consumer seeds it and persists changes
 * via `onChange` — the library never stores comments itself. Builds on the presence/collab
 * mental model without requiring CRDTs.
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import type { NodeId } from "../document/ids";

export interface CommentReply {
  id: string;
  author: { name: string; color: string };
  body: string;
  createdAt: number;
}

export interface Comment {
  id: string;
  /** Canvas-space anchor. */
  x: number;
  y: number;
  /** Optional node the pin is attached to. */
  nodeId?: NodeId;
  author: { name: string; color: string };
  body: string;
  resolved: boolean;
  createdAt: number;
  replies: CommentReply[];
}

export interface CommentsState {
  comments: Record<string, Comment>;
  add: (comment: Comment) => void;
  update: (id: string, patch: Partial<Comment>) => void;
  resolve: (id: string, resolved: boolean) => void;
  reply: (id: string, reply: CommentReply) => void;
  remove: (id: string) => void;
  load: (comments: readonly Comment[]) => void;
}

export interface CommentsStoreBundle {
  store: StoreApi<CommentsState>;
  onChange: (fn: (comments: Comment[]) => void) => () => void;
}

export function createCommentsStore(
  initial: readonly Comment[] = [],
): CommentsStoreBundle {
  const listeners = new Set<(comments: Comment[]) => void>();
  const notify = (map: Record<string, Comment>) => {
    const list = Object.values(map);
    for (const l of listeners) l(list);
  };

  const store = createStore<CommentsState>((set, get) => ({
    comments: Object.fromEntries(initial.map((c) => [c.id, c])),
    add: (comment) => {
      const comments = { ...get().comments, [comment.id]: comment };
      set({ comments });
      notify(comments);
    },
    update: (id, patch) => {
      const existing = get().comments[id];
      if (existing === undefined) return;
      const comments = { ...get().comments, [id]: { ...existing, ...patch } };
      set({ comments });
      notify(comments);
    },
    resolve: (id, resolved) => get().update(id, { resolved }),
    reply: (id, reply) => {
      const existing = get().comments[id];
      if (existing === undefined) return;
      const comments = {
        ...get().comments,
        [id]: { ...existing, replies: [...existing.replies, reply] },
      };
      set({ comments });
      notify(comments);
    },
    remove: (id) => {
      const comments = { ...get().comments };
      delete comments[id];
      set({ comments });
      notify(comments);
    },
    load: (list) => {
      const comments = Object.fromEntries(list.map((c) => [c.id, c]));
      set({ comments });
    },
  }));

  return {
    store,
    onChange: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
