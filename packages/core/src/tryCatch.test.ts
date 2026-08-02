import { describe, expect, it } from "vitest";

import {
  combineResults,
  flatMapResult,
  isFailure,
  isSuccess,
  mapResult,
  tryCatch,
  tryCatchSync,
  tryCatchWithAbort,
  tryCatchWithTimeout,
  unwrapResult,
  unwrapResultOr,
} from "./tryCatch";

type ListenerTarget = {
  addEventListener: (
    type: string,
    listener: unknown,
    options?: unknown,
  ) => void;
  removeEventListener: (
    type: string,
    listener: unknown,
    options?: unknown,
  ) => void;
};

/**
 * Counts abort listeners still attached to a signal by intercepting the pair
 * that registers them. Reading them off the signal directly is not portable
 * across runtimes, and this measures exactly what leaked.
 */
function trackAbortListeners(signal: AbortSignal): () => number {
  const live = new Set<unknown>();
  const target = signal as unknown as ListenerTarget;
  const add = target.addEventListener.bind(target);
  const remove = target.removeEventListener.bind(target);

  target.addEventListener = (type, listener, options) => {
    if (type === "abort") live.add(listener);
    add(type, listener, options);
  };
  target.removeEventListener = (type, listener, options) => {
    live.delete(listener);
    remove(type, listener, options);
  };

  return () => live.size;
}

describe("tryCatch", () => {
  it("returns the value on success", async () => {
    expect(await tryCatch(Promise.resolve(1))).toEqual([null, 1]);
  });

  it("returns the error on rejection", async () => {
    const failure = new Error("nope");
    expect(await tryCatch(Promise.reject(failure))).toEqual([failure, null]);
  });
});

describe("tryCatchSync", () => {
  it("returns the value on success", () => {
    expect(tryCatchSync(() => 1)).toEqual([null, 1]);
  });

  it("returns the error when the function throws", () => {
    const failure = new Error("nope");
    expect(
      tryCatchSync(() => {
        throw failure;
      }),
    ).toEqual([failure, null]);
  });
});

describe("tryCatchWithTimeout", () => {
  it("returns the value when the promise wins", async () => {
    expect(await tryCatchWithTimeout(Promise.resolve("ok"), 1_000)).toEqual([
      null,
      "ok",
    ]);
  });

  it("returns an error when the timeout wins", async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 50));
    const [error, value] = await tryCatchWithTimeout(slow, 1);
    expect(value).toBeNull();
    expect((error as Error).message).toBe("Operation timed out");
  });

  it("uses a supplied timeout error", async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 50));
    const custom = new Error("too slow");
    const [error] = await tryCatchWithTimeout(slow, 1, custom);
    expect(error).toBe(custom);
  });
});

describe("tryCatchWithAbort", () => {
  it("returns the value when the promise settles first", async () => {
    const controller = new AbortController();
    expect(
      await tryCatchWithAbort(Promise.resolve("ok"), controller.signal),
    ).toEqual([null, "ok"]);
  });

  it("returns an AbortError when the signal fires first", async () => {
    const controller = new AbortController();
    const never = new Promise((resolve) => setTimeout(resolve, 1_000));
    queueMicrotask(() => controller.abort());
    const [error, value] = await tryCatchWithAbort(never, controller.signal);
    expect(value).toBeNull();
    expect((error as Error).name).toBe("AbortError");
  });

  it("returns immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const [error] = await tryCatchWithAbort(
      Promise.resolve("unused"),
      controller.signal,
    );
    expect((error as Error).name).toBe("AbortError");
  });

  /*
   * `once: true` only unregisters on fire. When the promise settles first — the
   * ordinary case — nothing removed the listener, so every call against a
   * long-lived controller left one behind.
   */
  it("removes its listener once the promise resolves", async () => {
    const controller = new AbortController();
    const outstanding = trackAbortListeners(controller.signal);

    for (let call = 0; call < 50; call += 1) {
      await tryCatchWithAbort(Promise.resolve(call), controller.signal);
    }

    expect(outstanding()).toBe(0);
  });

  it("removes its listener when the promise rejects", async () => {
    const controller = new AbortController();
    const outstanding = trackAbortListeners(controller.signal);

    for (let call = 0; call < 10; call += 1) {
      await tryCatchWithAbort(
        Promise.reject(new Error("nope")),
        controller.signal,
      );
    }

    expect(outstanding()).toBe(0);
  });

  it("removes its listener when the signal aborts", async () => {
    const controller = new AbortController();
    const outstanding = trackAbortListeners(controller.signal);
    const never = new Promise((resolve) => setTimeout(resolve, 1_000));

    queueMicrotask(() => controller.abort());
    await tryCatchWithAbort(never, controller.signal);

    expect(outstanding()).toBe(0);
  });
});

describe("result helpers", () => {
  it("narrows with isSuccess and isFailure", () => {
    expect(isSuccess<number, Error>([null, 1])).toBe(true);
    expect(isFailure<number, Error>([null, 1])).toBe(false);
    expect(isFailure<number, Error>([new Error("x"), null])).toBe(true);
  });

  it("maps only the success branch", () => {
    expect(mapResult<number, number, Error>([null, 2], (n) => n * 2)).toEqual([
      null,
      4,
    ]);
    const failure = new Error("x");
    expect(
      mapResult<number, number, Error>([failure, null], (n) => n * 2),
    ).toEqual([failure, null]);
  });

  it("chains with flatMapResult", () => {
    expect(
      flatMapResult<number, number, Error>([null, 2], (n) => [null, n + 1]),
    ).toEqual([null, 3]);
  });

  it("unwraps or throws", () => {
    expect(unwrapResult<number, Error>([null, 7])).toBe(7);
    expect(() =>
      unwrapResult<number, Error>([new Error("boom"), null]),
    ).toThrow("boom");
    expect(unwrapResultOr<number, Error>([new Error("boom"), null], 3)).toBe(3);
  });

  it("combines results, stopping at the first failure", () => {
    expect(
      combineResults<number, Error>([
        [null, 1],
        [null, 2],
      ]),
    ).toEqual([null, [1, 2]]);
    const failure = new Error("x");
    expect(
      combineResults<number, Error>([
        [null, 1],
        [failure, null],
      ]),
    ).toEqual([failure, null]);
  });
});
