import { describe, expect, it } from "vitest";

import { ErrorHandler } from "./error-handler";

const quiet = { logError: false } as const;

describe("ErrorHandler.toDesktopClientError", () => {
  it("keeps an Error's message and stack", () => {
    const error = ErrorHandler.toDesktopClientError(new Error("boom"));

    expect(error.message).toBe("boom");
    expect(error.stack).toBeDefined();
  });

  it("accepts a string", () => {
    expect(ErrorHandler.toDesktopClientError("plain").message).toBe("plain");
  });

  it("falls back for an unrecognised value", () => {
    const error = ErrorHandler.toDesktopClientError({ odd: true });

    expect(error.message).toBe("An unknown error occurred");
    expect(error.code).toBe("UNKNOWN_ERROR");
  });

  it("uses the supplied code and context", () => {
    const error = ErrorHandler.toDesktopClientError(
      new Error("nope"),
      "WINDOW_OPERATION_FAILED",
      { operation: "close" },
    );

    expect(error.code).toBe("WINDOW_OPERATION_FAILED");
    expect(error.context).toEqual({ operation: "close" });
  });
});

describe("ErrorHandler.wrap", () => {
  it("returns the value on success", async () => {
    expect(await ErrorHandler.wrap(() => 42, quiet)).toEqual({
      success: true,
      data: 42,
    });
  });

  it("returns an error result on failure", async () => {
    const result = await ErrorHandler.wrap(() => {
      throw new Error("boom");
    }, quiet);

    expect(result.success).toBe(false);
    expect(ErrorHandler.isSuccess(result)).toBe(false);
  });

  it("applies a transformer to the error", async () => {
    const result = await ErrorHandler.wrap(
      () => {
        throw new Error("boom");
      },
      {
        ...quiet,
        transformer: (error) => ({ ...error, message: "transformed" }),
      },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("transformed");
    }
  });
});

describe("ErrorHandler.withFallback", () => {
  it("returns the value when the operation succeeds", async () => {
    expect(await ErrorHandler.withFallback(() => "ok", "fallback", quiet)).toBe(
      "ok",
    );
  });

  it("returns the fallback when it throws", async () => {
    expect(
      await ErrorHandler.withFallback(
        () => {
          throw new Error("boom");
        },
        "fallback",
        quiet,
      ),
    ).toBe("fallback");
  });
});

describe("ErrorHandler.withRetry", () => {
  it("returns on the first success", async () => {
    let calls = 0;
    const value = await ErrorHandler.withRetry(() => {
      calls += 1;
      return "ok";
    }, quiet);

    expect(value).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries until it succeeds", async () => {
    let calls = 0;
    const value = await ErrorHandler.withRetry(
      () => {
        calls += 1;
        if (calls < 3) throw new Error("not yet");
        return "ok";
      },
      { ...quiet, retryDelay: 1 },
    );

    expect(value).toBe("ok");
    expect(calls).toBe(3);
  });

  it("gives up after maxRetries and throws the last error", async () => {
    let calls = 0;
    await expect(
      ErrorHandler.withRetry(
        () => {
          calls += 1;
          throw new Error(`attempt ${calls}`);
        },
        { ...quiet, maxRetries: 2, retryDelay: 1 },
      ),
    ).rejects.toMatchObject({ message: "attempt 2" });

    expect(calls).toBe(2);
  });

  /*
   * `lastError` is only assigned by a failed attempt, so a maxRetries of 0 ran
   * no attempts and threw `undefined` — a rejection a caller cannot inspect,
   * log, or match on.
   */
  it("throws a real error when it runs no attempts", async () => {
    let thrown: unknown = "nothing thrown";
    try {
      await ErrorHandler.withRetry(() => "unreachable", {
        ...quiet,
        maxRetries: 0,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    expect(thrown).toMatchObject({ code: "UNKNOWN_ERROR" });
    expect((thrown as { message: string }).message).toContain("no attempts");
  });

  it("does not run the operation when maxRetries is zero", async () => {
    let calls = 0;
    await ErrorHandler.withRetry(
      () => {
        calls += 1;
        return "x";
      },
      { ...quiet, maxRetries: 0 },
    ).catch(() => undefined);

    expect(calls).toBe(0);
  });
});

describe("ErrorHandler.createCircuitBreaker", () => {
  it("passes calls through while the operation succeeds", async () => {
    const protectedCall = ErrorHandler.createCircuitBreaker(() => "ok");

    expect(await protectedCall()).toBe("ok");
    expect(await protectedCall()).toBe("ok");
  });

  it("opens after the failure threshold and then fails fast", async () => {
    let calls = 0;
    const protectedCall = ErrorHandler.createCircuitBreaker(() => {
      calls += 1;
      throw new Error("down");
    }, 2);

    await expect(protectedCall()).rejects.toThrow("down");
    await expect(protectedCall()).rejects.toThrow("down");
    expect(calls).toBe(2);

    // Third call is refused without touching the operation.
    await expect(protectedCall()).rejects.toMatchObject({
      message: "Circuit breaker is open",
    });
    expect(calls).toBe(2);
  });

  it("closes again once the timeout has passed", async () => {
    let shouldFail = true;
    const protectedCall = ErrorHandler.createCircuitBreaker(
      () => {
        if (shouldFail) throw new Error("down");
        return "recovered";
      },
      1,
      20,
    );

    await expect(protectedCall()).rejects.toThrow("down");
    await expect(protectedCall()).rejects.toMatchObject({
      message: "Circuit breaker is open",
    });

    shouldFail = false;
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(await protectedCall()).toBe("recovered");
  });
});

describe("ErrorHandler.isSuccess", () => {
  it("narrows both branches", () => {
    expect(ErrorHandler.isSuccess({ success: true, data: 1 })).toBe(true);
    expect(
      ErrorHandler.isSuccess({
        success: false,
        error: { code: "UNKNOWN_ERROR", message: "x" },
      }),
    ).toBe(false);
  });
});
