/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NextApiRequest, NextApiResponse } from "next";

const getSessionFromRequest = vi.fn();

vi.mock("./server", () => ({
  getSessionFromRequest: (...args: unknown[]) => getSessionFromRequest(...args),
  getUserFromSession: vi.fn(),
}));

const { withAuth, withAdmin, withOwner, withOrganization } =
  await import("./with-auth");

/** Roles a membership can carry, including one withAuth cannot require. */
type Role = "guest" | "member" | "admin" | "owner";

/** The subset withAuth accepts as `requiredRole`. */
type RequiredRole = "member" | "admin" | "owner";

/** A resolved session, optionally carrying an organization membership. */
function session(role?: Role) {
  const now = Math.floor(Date.now() / 1000);
  return {
    session: { sessionId: "sess_1", userId: "user_1" },
    tokens: { refreshTokenExpiresAt: now + 86_400 },
    user: { id: "user_1", email: "a@b.test" },
    organization: role ? { id: "org_1", name: "Org" } : null,
    membership: role ? { id: "mem_1", role, permissions: [] } : null,
  };
}

/** Minimal NextApiResponse recording what the wrapper did with it. */
function fakeResponse() {
  const state = { status: 0, body: undefined as unknown };
  const res = {
    status(code: number) {
      state.status = code;
      return res;
    },
    json(payload: unknown) {
      state.body = payload;
      return res;
    },
  };
  return { res: res as unknown as NextApiResponse, state };
}

const request = {} as NextApiRequest;

async function run(
  wrapped: ReturnType<typeof withAuth>,
): Promise<{ status: number; body: unknown; handlerRan: boolean }> {
  const { res, state } = fakeResponse();
  await wrapped(request, res);
  return { ...state, handlerRan: handlerRan };
}

let handlerRan = false;
const handler = vi.fn(async () => {
  handlerRan = true;
});

beforeEach(() => {
  handlerRan = false;
  handler.mockClear();
  getSessionFromRequest.mockReset();
});

describe("withAuth", () => {
  it("rejects an unauthenticated request", async () => {
    getSessionFromRequest.mockResolvedValue(null);

    const result = await run(withAuth(handler));

    expect(result.status).toBe(401);
    expect(result.handlerRan).toBe(false);
  });

  it("runs the handler for an authenticated request", async () => {
    getSessionFromRequest.mockResolvedValue(session());

    const result = await run(withAuth(handler));

    expect(result.handlerRan).toBe(true);
  });

  it("lets an unauthenticated request through when auth is optional", async () => {
    getSessionFromRequest.mockResolvedValue(null);

    const result = await run(withAuth(handler, { required: false }));

    expect(result.handlerRan).toBe(true);
  });

  it("returns 500 rather than running the handler when session lookup throws", async () => {
    getSessionFromRequest.mockRejectedValue(new Error("workos down"));

    const result = await run(withAuth(handler));

    expect(result.status).toBe(500);
    expect(result.handlerRan).toBe(false);
  });
});

describe("withAuth role enforcement", () => {
  /*
   * The check was `if (requiredRole && membership)`, so a request with no
   * membership skipped it entirely and reached the handler. withAdmin and
   * withOwner are the package's admin gates, and resolveSession reports a
   * membership it failed to load as null — so a transient WorkOS error, or
   * simply not having selected an organization, was enough.
   */
  describe("with no membership at all", () => {
    beforeEach(() => {
      getSessionFromRequest.mockResolvedValue(session());
    });

    it("refuses withAdmin", async () => {
      const result = await run(withAdmin(handler));

      expect(result.status).toBe(403);
      expect(result.handlerRan).toBe(false);
    });

    it("refuses withOwner", async () => {
      const result = await run(withOwner(handler));

      expect(result.status).toBe(403);
      expect(result.handlerRan).toBe(false);
    });

    it("refuses an explicit requiredRole", async () => {
      const result = await run(withAuth(handler, { requiredRole: "member" }));

      expect(result.status).toBe(403);
      expect(result.handlerRan).toBe(false);
    });

    it("calls onUnauthorized instead of the handler when given one", async () => {
      const onUnauthorized = vi.fn();

      await run(withAdmin(handler, { onUnauthorized }));

      expect(onUnauthorized).toHaveBeenCalled();
      expect(handlerRan).toBe(false);
    });
  });

  describe("with a membership", () => {
    const cases: ReadonlyArray<readonly [Role, RequiredRole, boolean]> = [
      ["owner", "admin", true],
      ["admin", "admin", true],
      ["member", "admin", false],
      ["guest", "admin", false],
      ["owner", "owner", true],
      ["admin", "owner", false],
      ["admin", "member", true],
      ["member", "member", true],
      ["guest", "member", false],
    ];

    for (const [actual, required, allowed] of cases) {
      it(`${allowed ? "admits" : "refuses"} ${actual} where ${required} is required`, async () => {
        getSessionFromRequest.mockResolvedValue(session(actual));

        const result = await run(withAuth(handler, { requiredRole: required }));

        expect(result.handlerRan).toBe(allowed);
        if (!allowed) expect(result.status).toBe(403);
      });
    }

    // The local hierarchy this used to carry had no "guest" and scored an
    // unknown role 0 rather than -1.
    it("refuses a role it does not recognise", async () => {
      getSessionFromRequest.mockResolvedValue(session("wizard" as Role));

      const result = await run(withAuth(handler, { requiredRole: "member" }));

      expect(result.status).toBe(403);
      expect(result.handlerRan).toBe(false);
    });
  });
});

describe("withOrganization", () => {
  it("refuses a session with no organization", async () => {
    getSessionFromRequest.mockResolvedValue(session());

    const result = await run(withOrganization(handler));

    expect(result.status).toBe(403);
    expect(result.handlerRan).toBe(false);
  });

  it("admits a session with an organization", async () => {
    getSessionFromRequest.mockResolvedValue(session("member"));

    const result = await run(withOrganization(handler));

    expect(result.handlerRan).toBe(true);
  });
});
