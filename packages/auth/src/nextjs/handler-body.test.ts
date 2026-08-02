/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

/**
 * What the handler does with a request body it cannot use.
 *
 * `request.json()` throws on an empty or malformed body, and the handlers left
 * that to their catch blocks, which reported it as something else: sign-in
 * answered 401 "Sign-in failed" — telling a caller its credentials were wrong
 * when its request never parsed — and the routes without their own catch
 * reached the dispatcher's and became a 500 carrying the JSON parser's message.
 *
 * WorkOS is mocked out; none of these requests should reach it.
 */

const authenticateWithPassword = vi.fn();
const createUserWithPassword = vi.fn();

vi.mock("../core/client", () => ({
  authenticateWithPassword: (...args: unknown[]) =>
    authenticateWithPassword(...args),
  createUserWithPassword: (...args: unknown[]) =>
    createUserWithPassword(...args),
  handleOAuthCallback: vi.fn(),
  getOAuthAuthorizationUrl: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  resetPassword: vi.fn(),
  sendVerificationEmail: vi.fn(),
  verifyEmail: vi.fn(),
  listUserOrganizations: vi.fn(),
}));

const { createAuthHandler } = await import("./handler");

const handler = createAuthHandler({});

function post(route: string, body: BodyInit | null): Promise<Response> {
  return handler(
    new Request(`https://app.example.test/api/auth/${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  ) as Promise<Response>;
}

const BODY_ROUTES = [
  "sign-in",
  "sign-up",
  "forgot-password",
  "reset-password",
  "verify-email",
  "org/switch",
];

describe("a body that is not usable JSON", () => {
  for (const route of BODY_ROUTES) {
    describe(route, () => {
      it("answers 400 for an empty body", async () => {
        const response = await post(route, null);

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
          message: expect.stringContaining("JSON"),
        });
      });

      it("answers 400 for malformed JSON", async () => {
        expect((await post(route, "{not json")).status).toBe(400);
      });

      // `null` and `[]` are valid JSON, and the handlers that destructure the
      // body directly threw a TypeError on them.
      it("answers 400 for a JSON null body", async () => {
        expect((await post(route, "null")).status).toBe(400);
      });

      it("answers 400 for a JSON array body", async () => {
        expect((await post(route, "[]")).status).toBe(400);
      });
    });
  }

  it("does not reach WorkOS for a malformed sign-in", async () => {
    await post("sign-in", "{not json");

    expect(authenticateWithPassword).not.toHaveBeenCalled();
  });

  it("does not report a malformed sign-in as bad credentials", async () => {
    const response = await post("sign-in", "{not json");
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).not.toBe(401);
    expect(body.code).not.toBe("INVALID_CREDENTIALS");
  });
});

describe("org/switch organizationId validation", () => {
  it("answers 400 when organizationId is not a string", async () => {
    const response = await post(
      "org/switch",
      JSON.stringify({ organizationId: 42 }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: expect.stringContaining("organizationId"),
    });
  });

  it("still requires a session for a well-formed body", async () => {
    const response = await post(
      "org/switch",
      JSON.stringify({ organizationId: "org_1" }),
    );

    expect(response.status).toBe(401);
  });
});
