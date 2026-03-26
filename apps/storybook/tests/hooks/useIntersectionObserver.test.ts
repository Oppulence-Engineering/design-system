import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useIntersectionObserver } from "@oppulence/design-system/hooks/use-intersection-observer";
import { type RefObject } from "react";

type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;

let ioCallback: IOCallback;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  constructor(cb: IOCallback) {
    ioCallback = cb;
  }
  observe = mockObserve;
  unobserve = vi.fn();
  disconnect = mockDisconnect;
}

beforeEach(() => {
  mockObserve.mockClear();
  mockDisconnect.mockClear();
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createRef(): RefObject<HTMLDivElement> {
  const el = document.createElement("div");
  return { current: el };
}

describe("useIntersectionObserver", () => {
  it("returns undefined initially", () => {
    const ref = createRef();
    const { result } = renderHook(() => useIntersectionObserver(ref));
    expect(result.current).toBeUndefined();
  });

  it("observes the ref element", () => {
    const ref = createRef();
    renderHook(() => useIntersectionObserver(ref));
    expect(mockObserve).toHaveBeenCalledWith(ref.current);
  });

  it("returns entry when element intersects", () => {
    const ref = createRef();
    const { result } = renderHook(() => useIntersectionObserver(ref));

    const entry = { isIntersecting: true, intersectionRatio: 1 };
    act(() => ioCallback([entry]));

    expect(result.current?.isIntersecting).toBe(true);
  });

  it("updates when element leaves viewport", () => {
    const ref = createRef();
    const { result } = renderHook(() => useIntersectionObserver(ref));

    act(() => ioCallback([{ isIntersecting: true, intersectionRatio: 1 }]));
    expect(result.current?.isIntersecting).toBe(true);

    act(() => ioCallback([{ isIntersecting: false, intersectionRatio: 0 }]));
    expect(result.current?.isIntersecting).toBe(false);
  });

  it("freezes entry when freezeOnceVisible is true", () => {
    const ref = createRef();
    const { result } = renderHook(() =>
      useIntersectionObserver(ref, { freezeOnceVisible: true }),
    );

    // First observation triggers
    expect(mockObserve).toHaveBeenCalledTimes(1);

    act(() => ioCallback([{ isIntersecting: true, intersectionRatio: 1 }]));
    expect(result.current?.isIntersecting).toBe(true);

    // After becoming visible, observer should be disconnected and not re-observed
    expect(mockDisconnect).toHaveBeenCalled();
    // observe should not have been called a second time (frozen prevents re-creation)
    expect(mockObserve).toHaveBeenCalledTimes(1);
  });

  it("disconnects on unmount", () => {
    const ref = createRef();
    const { unmount } = renderHook(() => useIntersectionObserver(ref));
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
