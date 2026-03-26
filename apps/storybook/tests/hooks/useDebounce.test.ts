import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useDebounce } from "@oppulence/design-system/hooks/use-debounce";
import { useDebounceCallback } from "@oppulence/design-system/hooks/use-debounce-callback";

describe("useDebounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 500));
    expect(result.current).toBe("hello");
  });

  it("debounces value updates", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } },
    );

    expect(result.current).toBe("a");

    rerender({ value: "b", delay: 300 });
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("b");
  });

  it("resets timer on rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 200),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    act(() => vi.advanceTimersByTime(100));
    rerender({ value: "c" });
    act(() => vi.advanceTimersByTime(100));

    // "c" hasn't fired yet — timer was reset
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("c");
  });
});

describe("useDebounceCallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces callback invocation", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceCallback(callback, 200));

    act(() => result.current("a"));
    act(() => result.current("b"));
    act(() => result.current("c"));

    expect(callback).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(200));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("c");
  });

  it("cancel prevents invocation", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceCallback(callback, 200));

    act(() => result.current("a"));
    act(() => result.current.cancel());

    act(() => vi.advanceTimersByTime(200));
    expect(callback).not.toHaveBeenCalled();
  });

  it("flush invokes immediately", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceCallback(callback, 200));

    act(() => result.current("a"));
    act(() => result.current.flush());

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("a");
  });

  it("isPending reflects timer state", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceCallback(callback, 200));

    expect(result.current.isPending()).toBe(false);

    act(() => result.current("a"));
    expect(result.current.isPending()).toBe(true);

    act(() => vi.advanceTimersByTime(200));
    expect(result.current.isPending()).toBe(false);
  });

  it("leading option invokes on first call", () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useDebounceCallback(callback, 200, { leading: true }),
    );

    act(() => result.current("a"));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("a");
  });
});
