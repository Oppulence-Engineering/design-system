import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEventListener } from "@oppulence/design-system/hooks/use-event-listener";

describe("useEventListener", () => {
  it("listens to window events by default", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener("click", handler));

    window.dispatchEvent(new MouseEvent("click"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("listens to events on a provided element", () => {
    const handler = vi.fn();
    const el = document.createElement("div");
    document.body.appendChild(el);

    renderHook(() => useEventListener("click", handler, el));

    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);

    // Window click should not trigger
    handler.mockClear();
    window.dispatchEvent(new MouseEvent("click"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("listens to document events", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener("keydown", handler, document));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("cleans up on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useEventListener("click", handler));

    unmount();
    window.dispatchEvent(new MouseEvent("click"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("uses the latest handler without re-attaching", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const { rerender } = renderHook(
      ({ handler }) => useEventListener("click", handler),
      { initialProps: { handler: handler1 } },
    );

    rerender({ handler: handler2 });
    window.dispatchEvent(new MouseEvent("click"));

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });
});
