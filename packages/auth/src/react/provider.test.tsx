/**
 * Tests for AuthProvider session resolution.
 *
 * Focused on one distinction: the server saying "you are signed out" versus the
 * client being unable to reach the server. Conflating them logs a working user
 * out of the UI on a transient failure, because the session is re-fetched on an
 * interval and on window focus, not only at mount.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "./provider";
import { useAuth } from "./hooks";
import type { Session, User } from "../core/types";

const USER = {
  id: "user_1",
  email: "signed-in@example.com",
  emailVerified: true,
  firstName: "Ada",
  lastName: "Lovelace",
  profilePictureUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  metadata: {},
} as unknown as User;

const SESSION = {
  id: "session_1",
  userId: "user_1",
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ipAddress: null,
  userAgent: null,
  metadata: {},
} as unknown as Session;

/** Surfaces the pieces of auth state each assertion needs. */
function AuthProbe() {
  const { user, isAuthenticated, error, refreshSession } = useAuth();

  return (
    <div>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="email">{user?.email ?? "none"}</span>
      <span data-testid="error-code">{error?.code ?? "none"}</span>
      <button data-testid="refresh" onClick={() => void refreshSession()}>
        refresh
      </button>
    </div>
  );
}

const renderSignedIn = () =>
  render(
    <AuthProvider
      initialSession={{ user: USER, session: SESSION }}
      // Keeps the refresh path deterministic — the interval is irrelevant here.
      apiBaseUrl="/api/auth"
    >
      <AuthProbe />
    </AuthProvider>,
  );

/** Triggers `refreshSession`, whose failure path falls back to `fetchSession`. */
const clickRefresh = async () => {
  await act(async () => {
    screen.getByTestId("refresh").click();
  });
};

/**
 * Minimal stand-in for the parts of `Response` that `authFetch` reads. A real
 * `Response` is avoided deliberately: under jsdom its `json()` does not behave
 * consistently, which silently turned status-code cases into transport errors
 * and made these tests agree with each other for the wrong reason.
 */
const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

describe("AuthProvider session resolution", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the session when the server cannot be reached", async () => {
    renderSignedIn();
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");

    // Refresh fails, then the session re-fetch fails at the transport layer.
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
    await clickRefresh();

    await waitFor(() => {
      expect(screen.getByTestId("error-code")).toHaveTextContent(
        "NETWORK_ERROR",
      );
    });
    // The user never signed out; being offline is not evidence that they did.
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("email")).toHaveTextContent(USER.email);
  });

  it("keeps the session when the session endpoint returns 5xx", async () => {
    renderSignedIn();

    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: "upstream down" }, 503),
    );
    await clickRefresh();

    await waitFor(() => {
      expect(screen.getByTestId("error-code")).not.toHaveTextContent("none");
    });
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
  });

  it("clears the session when the server answers 401", async () => {
    renderSignedIn();

    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: "Unauthorized", code: "INVALID_SESSION" }, 401),
    );
    await clickRefresh();

    // A 401 is the server stating the caller is not signed in, which is the one
    // answer that should drop local session state.
    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("email")).toHaveTextContent("none");
  });

  it("clears the session when the endpoint reports a null user", async () => {
    renderSignedIn();

    // `/refresh` fails so the provider falls back to `/session`, which answers
    // 200 with an empty payload — the documented signed-out shape.
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: "expired" }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          user: null,
          session: null,
          organization: null,
          membership: null,
          organizations: [],
        }),
      );
    await clickRefresh();

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    });
  });
});
