import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useClickOutside } from "@oppulence/design-system/hooks/use-click-outside";
import { type RefObject } from "react";

function createRefWithElement(): RefObject<HTMLDivElement> {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return { current: el };
}

describe("useClickOutside", () => {
  it("fires handler when clicking outside", () => {
    const handler = vi.fn();
    const ref = createRefWithElement();

    renderHook(() => useClickOutside(ref, handler));

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire handler when clicking inside", () => {
    const handler = vi.fn();
    const ref = createRefWithElement();

    renderHook(() => useClickOutside(ref, handler));

    ref.current!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fire when clicking a child of the ref element", () => {
    const handler = vi.fn();
    const ref = createRefWithElement();
    const child = document.createElement("span");
    ref.current!.appendChild(child);

    renderHook(() => useClickOutside(ref, handler));

    child.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
  });

  it("uses configurable event type", () => {
    const handler = vi.fn();
    const ref = createRefWithElement();

    renderHook(() => useClickOutside(ref, handler, "mouseup"));

    const outside = document.createElement("div");
    document.body.appendChild(outside);

    // mousedown should not trigger
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();

    // mouseup should trigger
    outside.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("cleans up listeners on unmount", () => {
    const handler = vi.fn();
    const ref = createRefWithElement();

    const { unmount } = renderHook(() => useClickOutside(ref, handler));
    unmount();

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
  });
});
