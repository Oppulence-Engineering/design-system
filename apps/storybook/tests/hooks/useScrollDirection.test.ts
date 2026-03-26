import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useScrollDirection } from "@oppulence/design-system/hooks/use-scroll-direction";

describe("useScrollDirection", () => {
  let rafCallback: FrameRequestCallback;

  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallback = cb;
      return 1;
    });
    Object.defineProperty(window, "scrollY", { value: 0, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with null direction", () => {
    const { result } = renderHook(() => useScrollDirection());
    expect(result.current.scrollDirection).toBeNull();
    expect(result.current.isScrollingUp).toBe(false);
    expect(result.current.isScrollingDown).toBe(false);
  });

  it("detects downward scroll", () => {
    const { result } = renderHook(() => useScrollDirection());

    act(() => {
      Object.defineProperty(window, "scrollY", { value: 100, writable: true });
      window.dispatchEvent(new Event("scroll"));
      rafCallback(0);
    });

    expect(result.current.scrollDirection).toBe("down");
    expect(result.current.isScrollingDown).toBe(true);
    expect(result.current.scrollY).toBe(100);
  });

  it("detects upward scroll", () => {
    const { result } = renderHook(() => useScrollDirection());

    // First scroll down
    act(() => {
      Object.defineProperty(window, "scrollY", { value: 200, writable: true });
      window.dispatchEvent(new Event("scroll"));
      rafCallback(0);
    });

    // Then scroll up
    act(() => {
      Object.defineProperty(window, "scrollY", { value: 50, writable: true });
      window.dispatchEvent(new Event("scroll"));
      rafCallback(0);
    });

    expect(result.current.scrollDirection).toBe("up");
    expect(result.current.isScrollingUp).toBe(true);
  });

  it("respects threshold", () => {
    const { result } = renderHook(() => useScrollDirection({ threshold: 50 }));

    // Small scroll under threshold
    act(() => {
      Object.defineProperty(window, "scrollY", { value: 30, writable: true });
      window.dispatchEvent(new Event("scroll"));
      rafCallback(0);
    });

    expect(result.current.scrollDirection).toBeNull();

    // Scroll past threshold
    act(() => {
      Object.defineProperty(window, "scrollY", { value: 80, writable: true });
      window.dispatchEvent(new Event("scroll"));
      rafCallback(0);
    });

    expect(result.current.scrollDirection).toBe("down");
  });
});
