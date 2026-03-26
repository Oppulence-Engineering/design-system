import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useCopyToClipboard } from "@oppulence/design-system/hooks/use-copy-to-clipboard";

describe("useCopyToClipboard", () => {
  const mockWriteText = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });
    mockWriteText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with isCopied false", () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.isCopied).toBe(false);
  });

  it("copies text and sets isCopied", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      const success = await result.current.copy("hello");
      expect(success).toBe(true);
    });

    expect(mockWriteText).toHaveBeenCalledWith("hello");
    expect(result.current.isCopied).toBe(true);
  });

  it("resets isCopied after timeout", async () => {
    const { result } = renderHook(() => useCopyToClipboard({ timeout: 1000 }));

    await act(async () => {
      await result.current.copy("hello");
    });
    expect(result.current.isCopied).toBe(true);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.isCopied).toBe(false);
  });

  it("returns false when clipboard API fails", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("denied"));
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      const success = await result.current.copy("hello");
      expect(success).toBe(false);
    });

    expect(result.current.isCopied).toBe(false);
  });

  it("resets timer on consecutive copies", async () => {
    const { result } = renderHook(() => useCopyToClipboard({ timeout: 500 }));

    await act(async () => {
      await result.current.copy("first");
    });
    expect(result.current.isCopied).toBe(true);

    act(() => vi.advanceTimersByTime(300));

    await act(async () => {
      await result.current.copy("second");
    });
    expect(result.current.isCopied).toBe(true);

    // Original 500ms passed, but timer was reset
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.isCopied).toBe(true);

    act(() => vi.advanceTimersByTime(300));
    expect(result.current.isCopied).toBe(false);
  });
});
