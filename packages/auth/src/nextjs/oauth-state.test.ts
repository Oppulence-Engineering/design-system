/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The OAuth callback's state check.
 *
 * handleOAuthStart has always set an HttpOnly `__oppulence_oauth_state` cookie,
 * but the callback never read it: it only asked `validateOAuthState`, which
 * checks that the timestamp prefix is recent and nothing else. Any
 * `<base36-timestamp>.<anything>` was accepted, so the callback could be driven
 * by someone who never started the flow — an attacker could run OAuth with
 * their own account and hand the resulting code, plus a self-made state, to a
 * victim, logging the victim's browser into the attacker's account.
 *
 * WorkOS is mocked out; only the state check runs here.
 */

const processOAuthCallback = vi.fn();

// handler.ts imports this as `handleOAuthCallback as processOAuthCallback`, so
// the mock has to provide the real export name.
vi.mock("../core/client", () => ({
  handleOAuthCallback: (...args: unknown[]) => processOAuthCallback(...args),
  getOAuthAuthorizationUrl: (
    _provider: string,
    _redirectUri: string,
    state: string,
  ) => `https://provider.test/authorize?state=${encodeURIComponent(state)}`,
  authenticateWithPassword: vi.fn(),
  createUserWithPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  resetPassword: vi.fn(),
  sendVerificationEmail: vi.fn(),
  verifyEmail: vi.fn(),
  listUserOrganizations: vi.fn(),
}));

const { createAuthHandler } = await import("./handler");

const STATE_COOKIE = "__oppulence_oauth_state";
const handler = createAuthHandler({});

/** A state of the shape generateOAuthState produces: base36 time, then random. */
function freshState(random = "abcdef0123456789"): string {
  return `${Date.now().toString(36)}.${random}`;
}

function callback(
  params: Record<string, string>,
  cookie?: string,
): Promise<Response> {
  const url = new URL("https://app.example.test/api/auth/callback");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return handler(
    new Request(url, { headers: cookie ? { cookie } : {} }),
  ) as Promise<Response>;
}

const setCookies = (response: Response): string[] =>
  response.headers.getSetCookie?.() ?? [
    response.headers.get("set-cookie") ?? "",
  ];

describe("OAuth callback state validation", () => {
  beforeEach(() => {
    processOAuthCallback.mockReset();
    processOAuthCallback.mockResolvedValue({
      user: { id: "user_1", emailVerified: true },
      accessToken: "at",
      refreshToken: "rt",
    });
  });

  it("rejects a state that was never issued to this browser", async () => {
    const response = await callback({ code: "c", state: freshState() });

    expect(response.status).toBe(400);
    expect(processOAuthCallback).not.toHaveBeenCalled();
  });

  it("rejects a state that does not match the cookie", async () => {
    const response = await callback(
      { code: "c", state: freshState("attacker-half") },
      `${STATE_COOKIE}=${freshState("victim-half")}`,
    );

    expect(response.status).toBe(400);
    expect(processOAuthCallback).not.toHaveBeenCalled();
  });

  it("rejects when the cookie is absent but the state looks fresh", async () => {
    const response = await callback({ code: "c", state: freshState() }, "a=1");

    expect(response.status).toBe(400);
    expect(processOAuthCallback).not.toHaveBeenCalled();
  });

  it("rejects a stale state even when it matches the cookie", async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000).getTime();
    const stale = `${old.toString(36)}.abcdef`;

    const response = await callback(
      { code: "c", state: stale },
      `${STATE_COOKIE}=${stale}`,
    );

    expect(response.status).toBe(400);
    expect(processOAuthCallback).not.toHaveBeenCalled();
  });

  it("accepts a state matching the cookie and exchanges the code", async () => {
    const state = freshState();

    const response = await callback(
      { code: "the-code", state },
      `${STATE_COOKIE}=${state}`,
    );

    expect(response.status).toBe(302);
    expect(processOAuthCallback).toHaveBeenCalledWith("the-code");
  });

  it("clears the state cookie once it has been used", async () => {
    const state = freshState();

    const response = await callback(
      { code: "the-code", state },
      `${STATE_COOKIE}=${state}`,
    );

    const cleared = setCookies(response).find((value) =>
      value.startsWith(`${STATE_COOKIE}=;`),
    );
    expect(cleared).toBeDefined();
    expect(cleared).toContain("Max-Age=0");
  });

  it("still sets the session cookie on success", async () => {
    const state = freshState();

    const response = await callback(
      { code: "the-code", state },
      `${STATE_COOKIE}=${state}`,
    );

    expect(
      setCookies(response).some((value) =>
        value.startsWith("__oppulence_session="),
      ),
    ).toBe(true);
  });

  it("clears the state cookie when the state is rejected", async () => {
    const response = await callback({ code: "c", state: freshState() });

    expect(
      setCookies(response).some((value) =>
        value.startsWith(`${STATE_COOKIE}=;`),
      ),
    ).toBe(true);
  });

  it("rejects a request with no state at all", async () => {
    const response = await callback({ code: "c" });

    expect(response.status).toBe(400);
    expect(processOAuthCallback).not.toHaveBeenCalled();
  });
});

describe("OAuth start", () => {
  it("issues a state cookie matching the state it sends to the provider", async () => {
    const response = (await handler(
      new Request("https://app.example.test/api/auth/oauth?provider=google"),
    )) as Response;

    expect(response.status).toBe(302);

    const cookie = setCookies(response).find((value) =>
      value.startsWith(`${STATE_COOKIE}=`),
    );
    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");

    const cookieState = decodeURIComponent(
      (cookie as string).slice(`${STATE_COOKIE}=`.length).split(";")[0] ?? "",
    );
    const sentState = new URL(
      response.headers.get("location") as string,
    ).searchParams.get("state");

    expect(cookieState).toBe(sentState);
  });
});

/*
 * The React provider posts to every MFA route below, and the MFA components are
 * shipped and wired to them, so these were reached in normal use — and answered
 * the same "Route not found" 404 as a mistyped URL. `webhookSecret` and
 * `webhooks` are likewise accepted in the handler config while the route that
 * would use them does not exist.
 */
describe("routes the client calls but the handler does not implement", () => {
  const post = (route: string) =>
    handler(
      new Request(`https://app.example.test/api/auth/${route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    ) as Promise<Response>;

  for (const route of ["mfa/enroll", "mfa/verify", "mfa/sms", "webhook"]) {
    it(`answers 501 for ${route}, not 404`, async () => {
      const response = await post(route);

      expect(response.status).toBe(501);
      expect(await response.json()).toMatchObject({
        message: expect.stringContaining("not implemented"),
      });
    });
  }

  it("still answers 404 for a route that simply does not exist", async () => {
    expect((await post("nonsense")).status).toBe(404);
  });
});
