import { describe, expect, it, vi } from "vitest";
import { createCommentsStore, type Comment } from "./store";

function comment(id: string): Comment {
  return {
    id,
    x: 10,
    y: 20,
    author: { name: "A", color: "#000" },
    body: "hi",
    resolved: false,
    createdAt: 0,
    replies: [],
  };
}

describe("comments store", () => {
  it("adds, resolves, replies, and removes; notifies onChange", () => {
    const { store, onChange } = createCommentsStore();
    const changes = vi.fn();
    onChange(changes);

    store.getState().add(comment("c1"));
    expect(Object.keys(store.getState().comments)).toEqual(["c1"]);
    expect(changes).toHaveBeenCalledTimes(1);

    store.getState().resolve("c1", true);
    expect(store.getState().comments.c1?.resolved).toBe(true);

    store.getState().reply("c1", {
      id: "r1",
      author: { name: "B", color: "#111" },
      body: "ok",
      createdAt: 1,
    });
    expect(store.getState().comments.c1?.replies).toHaveLength(1);

    store.getState().remove("c1");
    expect(store.getState().comments.c1).toBeUndefined();
    expect(changes).toHaveBeenCalledTimes(4);
  });

  it("seeds from initial comments", () => {
    const { store } = createCommentsStore([comment("a"), comment("b")]);
    expect(Object.keys(store.getState().comments).sort()).toEqual(["a", "b"]);
  });
});
