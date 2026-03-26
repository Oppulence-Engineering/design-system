import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useLocalStorage } from "@oppulence/design-system/hooks/use-local-storage";

describe("useLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns initial value when key is absent", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("reads existing value from localStorage", () => {
    localStorage.setItem("test-key", JSON.stringify("existing"));
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));
    expect(result.current[0]).toBe("existing");
  });

  it("writes to localStorage on setValue", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "a"));

    act(() => result.current[1]("b"));

    expect(result.current[0]).toBe("b");
    expect(JSON.parse(localStorage.getItem("test-key")!)).toBe("b");
  });

  it("supports functional updates", () => {
    const { result } = renderHook(() => useLocalStorage("counter", 0));

    act(() => result.current[1]((prev) => prev + 1));
    expect(result.current[0]).toBe(1);

    act(() => result.current[1]((prev) => prev + 5));
    expect(result.current[0]).toBe(6);
  });

  it("serializes objects as JSON", () => {
    const obj = { name: "test", count: 42 };
    const { result } = renderHook(() =>
      useLocalStorage("obj-key", { name: "", count: 0 }),
    );

    act(() => result.current[1](obj));

    expect(result.current[0]).toEqual(obj);
    expect(JSON.parse(localStorage.getItem("obj-key")!)).toEqual(obj);
  });

  it("removeValue restores initial value and clears storage", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));

    act(() => result.current[1]("updated"));
    expect(result.current[0]).toBe("updated");

    act(() => result.current[2]());
    expect(result.current[0]).toBe("default");
    expect(localStorage.getItem("test-key")).toBeNull();
  });

  it("responds to cross-tab storage events", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "test-key",
          newValue: JSON.stringify("from-other-tab"),
        }),
      );
    });

    expect(result.current[0]).toBe("from-other-tab");
  });

  it("ignores storage events for different keys", () => {
    const { result } = renderHook(() => useLocalStorage("my-key", "original"));

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "other-key",
          newValue: JSON.stringify("irrelevant"),
        }),
      );
    });

    expect(result.current[0]).toBe("original");
  });
});
