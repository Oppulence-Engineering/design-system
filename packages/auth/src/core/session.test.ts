/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const refreshAccessToken = vi.fn();

vi.mock("./client", () => ({
  refreshAccessToken: (...args: unknown[]) => refreshAccessToken(...args),
  getUser: vi.fn(),
  getOrganization: vi.fn(),
  getOrganizationMembership: vi.fn(),
}));

const { encrypt } = await import("./crypto");
const { decodeSession, getValidSession, createSession } =
  await import("./session");

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Encrypts a session payload directly, bypassing createSession's field set. */
async function sessionToken(
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const now = nowSeconds();
  return encrypt(
    {
      sessionId: "sess_1",
      userId: "user_1",
      accessToken: "at",
      refreshToken: "rt",
      accessTokenExpiresAt: now + 3600,
      refreshTokenExpiresAt: now + 86_400,
      organizationId: null,
      ipAddress: null,
      userAgent: null,
      createdAt: now,
      ...overrides,
    },
    "30d",
  );
}

describe("createSession and decodeSession", () => {
  it("round-trips a session", async () => {
    const token = await createSession("at", "rt", "user_1");
    const payload = await decodeSession(token);

    expect(payload?.userId).toBe("user_1");
    expect(payload?.accessToken).toBe("at");
    expect(payload?.refreshToken).toBe("rt");
  });

  it("rejects a token that is not ours", async () => {
    expect(await decodeSession("not-a-token")).toBeNull();
    expect(await decodeSession("")).toBeNull();
  });

  it("rejects a payload missing an identity field", async () => {
    for (const missing of [
      "sessionId",
      "userId",
      "accessToken",
      "refreshToken",
    ]) {
      expect(
        await decodeSession(await sessionToken({ [missing]: "" })),
      ).toBeNull();
    }
  });

  /*
   * Every expiry comparison is a `>=`, and NaN loses every comparison. A
   * payload without usable timestamps passed both `now >= refreshTokenExpiresAt`
   * and `now >= accessTokenExpiresAt - buffer`, so getValidSession fell through
   * to "token is still valid" — the session never expired and never refreshed.
   */
  describe("expiry timestamps", () => {
    const unusable = [
      ["undefined", undefined],
      ["null", null],
      ["a string", "soon"],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
    ] as const;

    for (const [label, value] of unusable) {
      it(`rejects a refresh expiry of ${label}`, async () => {
        const token = await sessionToken({ refreshTokenExpiresAt: value });

        expect(await decodeSession(token)).toBeNull();
        expect(await getValidSession(token)).toBeNull();
      });

      it(`rejects an access expiry of ${label}`, async () => {
        const token = await sessionToken({ accessTokenExpiresAt: value });

        expect(await decodeSession(token)).toBeNull();
        expect(await getValidSession(token)).toBeNull();
      });
    }
  });
});

describe("getValidSession", () => {
  beforeEach(() => {
    refreshAccessToken.mockReset();
    refreshAccessToken.mockResolvedValue({
      accessToken: "new-at",
      refreshToken: "new-rt",
    });
  });

  it("returns the session untouched while the access token is fresh", async () => {
    const result = await getValidSession(await sessionToken());

    expect(result?.newToken).toBeNull();
    expect(result?.session.accessToken).toBe("at");
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("rejects a session whose refresh token has expired", async () => {
    const token = await sessionToken({
      refreshTokenExpiresAt: nowSeconds() - 10,
    });

    expect(await getValidSession(token)).toBeNull();
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("refreshes when the access token is close to expiring", async () => {
    const token = await sessionToken({
      accessTokenExpiresAt: nowSeconds() + 5,
    });

    const result = await getValidSession(token);

    expect(refreshAccessToken).toHaveBeenCalledWith("rt");
    expect(result?.session.accessToken).toBe("new-at");
    expect(result?.newToken).toBeTruthy();
  });

  it("returns null when the refresh call fails", async () => {
    refreshAccessToken.mockRejectedValue(new Error("workos down"));
    const token = await sessionToken({
      accessTokenExpiresAt: nowSeconds() + 5,
    });

    expect(await getValidSession(token)).toBeNull();
  });
});
