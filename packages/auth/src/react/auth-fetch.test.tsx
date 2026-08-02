import * as React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./provider";
import { useAuth } from "./hooks";

/**
 * How the client reacts to a response that is not the JSON it expects.
 *
 * `authFetch` called `response.json()` unguarded, so a gateway 502, a
 * framework error page, or an empty body threw a SyntaxError in place of the
 * AuthError callers catch — surfacing to the user as "Unexpected token < in
 * JSON at position 0", with the HTTP status lost.
 */

function respond(
  body: string,
  init: { status: number; contentType?: string },
): Response {
  return new Response(body, {
    status: init.status,
    headers: { "content-type": init.contentType ?? "text/html" },
  });
}

/** Renders useAuth under a provider that starts with a known-empty session. */
function renderAuth() {
  return renderHook(() => useAuth(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={null}>{children}</AuthProvider>
    ),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authFetch error handling", () => {
  it("reports the status when a gateway returns an HTML error page", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          respond("<html><body>502 Bad Gateway</body></html>", { status: 502 }),
        ),
    );

    const { result } = renderAuth();

    await expect(result.current.signIn("a@b.test", "pw")).rejects.toMatchObject(
      { status: 502 },
    );

    await waitFor(() => {
      expect(result.current.error?.status).toBe(502);
    });
    expect(result.current.error?.message).not.toContain("JSON at position");
  });

  it("reports the status for an empty error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respond("", { status: 503 })),
    );

    const { result } = renderAuth();

    await expect(result.current.signIn("a@b.test", "pw")).rejects.toMatchObject(
      { status: 503 },
    );
  });

  it("still prefers the message and code the handler sends", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: "Invalid credentials",
            code: "INVALID_CREDENTIALS",
          }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const { result } = renderAuth();

    await expect(result.current.signIn("a@b.test", "pw")).rejects.toMatchObject(
      {
        status: 401,
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      },
    );
  });

  it("raises a clear error when a success response is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respond("not json", { status: 200 })),
    );

    const { result } = renderAuth();

    await expect(result.current.signIn("a@b.test", "pw")).rejects.toMatchObject(
      {
        message: expect.stringContaining("could not be parsed"),
      },
    );
  });
});
