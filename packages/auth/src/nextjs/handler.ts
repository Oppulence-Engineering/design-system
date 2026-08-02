/**
 * Next.js API route handler for @oppulence/auth
 *
 * Creates a catch-all handler for auth routes.
 * Deploy at: app/api/auth/[...auth]/route.ts
 */

import {
  authenticateWithPassword,
  createUserWithPassword,
  sendPasswordResetEmail,
  resetPassword,
  sendVerificationEmail,
  verifyEmail as verifyEmailCode,
  getOAuthAuthorizationUrl,
  handleOAuthCallback as processOAuthCallback,
  listUserOrganizations,
} from "../core/client";
import {
  createSession,
  resolveSession,
  updateSessionOrganization,
} from "../core/session";
import {
  getCookieFromRequest,
  getSessionFromRequest,
  createSessionCookieHeader,
  createClearSessionCookieHeader,
  validateCSRFToken,
} from "../core/cookies";
import {
  constantTimeCompare,
  validateOAuthState,
  generateOAuthState,
} from "../core/crypto";
import { getEnvVar, debugLog, getCallbackUrl } from "../core/env";
import { AuthError } from "../core/types";
import type {
  User,
  Organization,
  OrganizationMembership,
  OAuthProvider,
  WorkOSWebhookEvent,
  WorkOSWebhookPayload,
} from "../core/types";
import {
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../react/schemas";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the auth handler.
 */
export interface AuthHandlerConfig {
  /**
   * Callback when a user signs in.
   */
  onSignIn?: (user: User, isNewUser: boolean) => Promise<void>;

  /**
   * Callback when a user signs out.
   */
  onSignOut?: (userId: string) => Promise<void>;

  /**
   * Callback when organization is switched.
   */
  onOrgSwitch?: (userId: string, orgId: string) => Promise<void>;

  /**
   * WorkOS webhook secret for signature verification.
   *
   * NOT YET WIRED UP. The webhook route is unimplemented, so nothing reads
   * this and no signature is ever verified. Setting it does not make the
   * handler accept webhooks.
   */
  webhookSecret?: string;

  /**
   * Custom webhook handlers.
   *
   * NOT YET WIRED UP. The webhook route is unimplemented, so these are never
   * called. A POST to the webhook route answers 501.
   */
  webhooks?: Partial<
    Record<WorkOSWebhookEvent, (payload: WorkOSWebhookPayload) => Promise<void>>
  >;

  /**
   * URL to redirect after sign-in (can be overridden per request).
   */
  afterSignInUrl?: string;

  /**
   * URL to redirect after sign-out.
   */
  afterSignOutUrl?: string;

  /**
   * Enable debug logging.
   */
  debug?: boolean;
}

// ============================================================================
// Response Helpers
// ============================================================================

function jsonResponse(
  data: unknown,
  status = 200,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function errorResponse(error: AuthError): Response {
  return jsonResponse(error.toJSON(), error.status);
}

/**
 * Reads a JSON object from the request body, or fails with a 400.
 *
 * `request.json()` throws on an empty or malformed body, and the handlers left
 * that to their catch blocks — which report it as something it is not. Sign-in
 * turned a malformed body into 401 "Sign-in failed", telling a caller its
 * credentials were wrong when its request never parsed; elsewhere it reached
 * the dispatcher's catch and became a 500 carrying the JSON parser's own
 * message. A body the client got wrong is a 400.
 *
 * A non-object body is refused for the same reason: `null` is valid JSON, and
 * the verify-email and org-switch handlers destructure the body directly, so
 * `null` threw a TypeError from inside them.
 *
 * Uses UNKNOWN_ERROR because AuthErrorCode has no code for a malformed
 * request; adding one would change a union consumers may switch on
 * exhaustively. The status and message carry the meaning.
 */
async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new AuthError(
      "Request body must be valid JSON",
      "UNKNOWN_ERROR",
      400,
    );
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new AuthError(
      "Request body must be a JSON object",
      "UNKNOWN_ERROR",
      400,
    );
  }

  return body as Record<string, unknown>;
}

function redirectResponse(
  url: string,
  headers?: Record<string, string>,
): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      ...headers,
    },
  });
}

// ============================================================================
// Route Handlers
// ============================================================================

async function handleSession(request: Request): Promise<Response> {
  const token = getSessionFromRequest(request);

  if (!token) {
    return jsonResponse({
      user: null,
      session: null,
      organization: null,
      membership: null,
      organizations: [],
    });
  }

  try {
    const result = await resolveSession(token);
    if (!result) {
      return jsonResponse({
        user: null,
        session: null,
        organization: null,
        membership: null,
        organizations: [],
      });
    }

    const { resolved, newToken } = result;
    const organizations = await listUserOrganizations(resolved.user.id);

    const response = jsonResponse({
      user: resolved.user,
      session: resolved.session,
      organization: resolved.organization,
      membership: resolved.membership,
      organizations,
    });

    // Update cookie if token was refreshed
    if (newToken) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          "Set-Cookie": createSessionCookieHeader(newToken),
        },
      });
    }

    return response;
  } catch (error) {
    debugLog("Session resolution failed", { error });
    return jsonResponse({
      user: null,
      session: null,
      organization: null,
      membership: null,
      organizations: [],
    });
  }
}

async function handleSignIn(
  request: Request,
  config: AuthHandlerConfig,
): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    const data = signInSchema.parse(body);

    const { user, accessToken, refreshToken } = await authenticateWithPassword(
      data.email,
      data.password,
    );

    // Create session
    const sessionToken = await createSession(
      accessToken,
      refreshToken,
      user.id,
      {
        ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
    );

    // Get user's organizations
    const organizations = await listUserOrganizations(user.id);

    // Callback
    await config.onSignIn?.(user, false);

    return jsonResponse(
      {
        user,
        session: { id: user.id, userId: user.id }, // Simplified for response
        organizations,
      },
      200,
      { "Set-Cookie": createSessionCookieHeader(sessionToken) },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error);
    }
    debugLog("Sign-in error", { error });
    return errorResponse(
      new AuthError("Sign-in failed", "INVALID_CREDENTIALS", 401, error),
    );
  }
}

async function handleSignUp(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    const data = signUpSchema.parse(body);

    await createUserWithPassword(data.email, data.password, {
      firstName: data.firstName,
      lastName: data.lastName,
    });

    // Don't auto-sign-in - require email verification
    return jsonResponse({
      success: true,
      message: "Check your email to verify your account",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error);
    }
    debugLog("Sign-up error", { error });
    return errorResponse(
      new AuthError("Sign-up failed", "UNKNOWN_ERROR", 500, error),
    );
  }
}

async function handleSignOut(
  request: Request,
  config: AuthHandlerConfig,
): Promise<Response> {
  const token = getSessionFromRequest(request);

  if (token) {
    try {
      const result = await resolveSession(token);
      if (result) {
        await config.onSignOut?.(result.resolved.user.id);
      }
    } catch {
      // Ignore errors during sign-out
    }
  }

  return jsonResponse({ success: true }, 200, {
    "Set-Cookie": createClearSessionCookieHeader(),
  });
}

/**
 * POST routes the client calls that this handler does not serve yet.
 *
 * Kept explicit so they answer 501 rather than 404: the React provider posts to
 * the MFA routes (see provider.tsx), and `webhookSecret`/`webhooks` are
 * accepted in the handler config, so a consumer has every reason to think these
 * work.
 */
const UNIMPLEMENTED_POST_ROUTES: ReadonlySet<string> = new Set([
  "mfa/enroll",
  "mfa/verify",
  "mfa/sms",
  "webhook",
]);

/** Cookie holding the OAuth state, so the callback can be tied to this browser. */
const OAUTH_STATE_COOKIE = "__oppulence_oauth_state";

/** Expires the state cookie; the state is single-use. */
const CLEAR_OAUTH_STATE_COOKIE = [
  `${OAUTH_STATE_COOKIE}=`,
  "Path=/",
  "HttpOnly",
  "SameSite=Lax",
  "Max-Age=0",
  "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
]
  .filter(Boolean)
  .join("; ");

async function handleOAuthStart(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") as OAuthProvider | null;

  if (!provider || !["google", "github", "microsoft"].includes(provider)) {
    return errorResponse(
      new AuthError("Invalid OAuth provider", "CONFIGURATION_ERROR", 400),
    );
  }

  const state = generateOAuthState();
  const redirectUri = getCallbackUrl();
  const authUrl = getOAuthAuthorizationUrl(provider, redirectUri, state);

  // Set state in cookie for validation
  const stateCookie = [
    `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
    // Matches the session cookie: over HTTPS only, outside development.
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  return redirectResponse(authUrl, { "Set-Cookie": stateCookie });
}

async function handleOAuthCallback(
  request: Request,
  config: AuthHandlerConfig,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Check for OAuth error
  if (error) {
    const redirectUrl = config.afterSignInUrl ?? "/sign-in";
    return withClearedOAuthState(
      redirectResponse(`${redirectUrl}?error=${encodeURIComponent(error)}`),
    );
  }

  /*
   * The state must match the cookie set when the flow started, which is what
   * ties this callback to the browser that began it.
   *
   * handleOAuthStart has always set that cookie, but the callback never read
   * it: `validateOAuthState` only checks that the timestamp prefix is recent,
   * so any `<base36-timestamp>.<anything>` was accepted. That left the callback
   * open to being driven by a third party — an attacker could run the flow with
   * their own account and hand the resulting code and a self-made state to a
   * victim, logging the victim's browser into the attacker's account. The
   * random half of the state was generated and then never compared to anything.
   */
  const expectedState = getCookieFromRequest(request, OAUTH_STATE_COOKIE);

  if (
    !state ||
    !expectedState ||
    !constantTimeCompare(state, expectedState) ||
    !validateOAuthState(state)
  ) {
    return withClearedOAuthState(
      errorResponse(new AuthError("Invalid OAuth state", "INVALID_TOKEN", 400)),
    );
  }

  if (!code) {
    return withClearedOAuthState(
      errorResponse(
        new AuthError("Missing authorization code", "INVALID_CODE", 400),
      ),
    );
  }

  try {
    const { user, accessToken, refreshToken } =
      await processOAuthCallback(code);

    // Create session
    const sessionToken = await createSession(
      accessToken,
      refreshToken,
      user.id,
      {
        ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
    );

    // Callback
    await config.onSignIn?.(user, !user.emailVerified); // New if not verified

    const redirectUrl = config.afterSignInUrl ?? "/dashboard";
    return withClearedOAuthState(
      redirectResponse(redirectUrl, {
        "Set-Cookie": createSessionCookieHeader(sessionToken),
      }),
    );
  } catch (error) {
    debugLog("OAuth callback error", { error });
    const redirectUrl = config.afterSignInUrl ?? "/sign-in";
    return withClearedOAuthState(
      redirectResponse(`${redirectUrl}?error=oauth_failed`),
    );
  }
}

/**
 * Expires the OAuth state cookie on the way out.
 *
 * Appended rather than set, so it survives alongside the session cookie the
 * success path already writes. A state is good for exactly one callback.
 */
function withClearedOAuthState(response: Response): Response {
  response.headers.append("Set-Cookie", CLEAR_OAUTH_STATE_COOKIE);
  return response;
}

async function handleRefresh(request: Request): Promise<Response> {
  const token = getSessionFromRequest(request);

  if (!token) {
    return errorResponse(
      new AuthError("No session to refresh", "SESSION_EXPIRED", 401),
    );
  }

  try {
    const result = await resolveSession(token);
    if (!result) {
      return errorResponse(
        new AuthError("Session expired", "SESSION_EXPIRED", 401),
      );
    }

    // If token was refreshed, send new cookie
    if (result.newToken) {
      return jsonResponse({ success: true }, 200, {
        "Set-Cookie": createSessionCookieHeader(result.newToken),
      });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    debugLog("Refresh error", { error });
    return errorResponse(
      new AuthError("Session refresh failed", "SESSION_EXPIRED", 401, error),
    );
  }
}

async function handleForgotPassword(request: Request): Promise<Response> {
  /*
   * Read outside the catch below, which answers "sent" to everything so that a
   * caller cannot learn which addresses exist. A body that is not JSON reveals
   * nothing about any account, so refusing it leaks nothing — and reporting
   * "a reset link has been sent" to a request that never parsed only hides a
   * client bug.
   */
  const body = await readJsonBody(request);

  try {
    const data = forgotPasswordSchema.parse(body);

    await sendPasswordResetEmail(data.email);

    // Always return success to prevent email enumeration
    return jsonResponse({
      success: true,
      message: "If an account exists, a reset link has been sent",
    });
  } catch (error) {
    debugLog("Forgot password error", { error });
    // Still return success
    return jsonResponse({
      success: true,
      message: "If an account exists, a reset link has been sent",
    });
  }
}

async function handleResetPassword(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    const data = resetPasswordSchema.parse(body);

    await resetPassword(data.token, data.password);

    return jsonResponse({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error);
    }
    debugLog("Reset password error", { error });
    return errorResponse(
      new AuthError("Password reset failed", "INVALID_TOKEN", 400, error),
    );
  }
}

async function handleVerifyEmail(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    const { action, code } = body;

    const token = getSessionFromRequest(request);
    if (!token) {
      return errorResponse(
        new AuthError("Authentication required", "SESSION_EXPIRED", 401),
      );
    }

    const result = await resolveSession(token);
    if (!result) {
      return errorResponse(
        new AuthError("Session expired", "SESSION_EXPIRED", 401),
      );
    }

    if (action === "send") {
      await sendVerificationEmail(result.resolved.user.id);
      return jsonResponse({
        success: true,
        message: "Verification email sent",
      });
    }

    if (action === "verify") {
      const data = verifyEmailSchema.parse({ code });
      const { user, accessToken, refreshToken } = await verifyEmailCode(
        result.resolved.user.id,
        data.code,
      );

      // Create new session with verified user
      const sessionToken = await createSession(
        accessToken,
        refreshToken,
        user.id,
      );

      return jsonResponse({ user, success: true }, 200, {
        "Set-Cookie": createSessionCookieHeader(sessionToken),
      });
    }

    return errorResponse(
      new AuthError("Invalid action", "CONFIGURATION_ERROR", 400),
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error);
    }
    debugLog("Verify email error", { error });
    return errorResponse(
      new AuthError("Verification failed", "INVALID_CODE", 400, error),
    );
  }
}

async function handleOrgSwitch(
  request: Request,
  config: AuthHandlerConfig,
): Promise<Response> {
  try {
    const body = await readJsonBody(request);

    /*
     * Validated rather than destructured straight out of the body. It is
     * passed to updateSessionOrganization and stored in the session, and
     * nothing checked it was a string — a number, an object or an array went
     * in unexamined.
     */
    const rawOrganizationId = body["organizationId"];
    if (
      rawOrganizationId !== undefined &&
      rawOrganizationId !== null &&
      typeof rawOrganizationId !== "string"
    ) {
      return errorResponse(
        new AuthError(
          "organizationId must be a string or null",
          "UNKNOWN_ERROR",
          400,
        ),
      );
    }
    const organizationId = rawOrganizationId ?? null;

    const token = getSessionFromRequest(request);
    if (!token) {
      return errorResponse(
        new AuthError("Authentication required", "SESSION_EXPIRED", 401),
      );
    }

    const newToken = await updateSessionOrganization(token, organizationId);

    let organization: Organization | null = null;
    let membership: OrganizationMembership | null = null;

    if (organizationId) {
      const result = await resolveSession(newToken);
      if (result) {
        organization = result.resolved.organization;
        membership = result.resolved.membership;
        await config.onOrgSwitch?.(result.resolved.user.id, organizationId);
      }
    }

    return jsonResponse({ organization, membership }, 200, {
      "Set-Cookie": createSessionCookieHeader(newToken),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error);
    }
    debugLog("Org switch error", { error });
    return errorResponse(
      new AuthError(
        "Organization switch failed",
        "ORGANIZATION_NOT_FOUND",
        400,
        error,
      ),
    );
  }
}

// ============================================================================
// Main Handler Factory
// ============================================================================

/**
 * Creates the auth API route handler.
 *
 * @param config - Handler configuration
 * @returns Request handler function
 *
 * @example
 * ```ts
 * // app/api/auth/[...auth]/route.ts
 * import { createAuthHandler } from '@oppulence/auth/nextjs';
 *
 * const handler = createAuthHandler({
 *   onSignIn: async (user, isNewUser) => {
 *     console.log('User signed in:', user.email);
 *   },
 * });
 *
 * export { handler as GET, handler as POST };
 * ```
 */
export function createAuthHandler(config: AuthHandlerConfig = {}) {
  return async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Extract route from path (e.g., /api/auth/sign-in -> sign-in)
    const route = path.split("/api/auth/")[1] ?? "";

    debugLog("Auth request", { method: request.method, route });

    try {
      // GET routes
      if (request.method === "GET") {
        switch (route) {
          case "session":
            return await handleSession(request);
          case "callback":
            return await handleOAuthCallback(request, config);
          default:
            // Check if it's an OAuth start (has provider param)
            if (url.searchParams.has("provider")) {
              return await handleOAuthStart(request);
            }
            return errorResponse(
              new AuthError("Route not found", "CONFIGURATION_ERROR", 404),
            );
        }
      }

      // POST routes
      if (request.method === "POST") {
        switch (route) {
          case "sign-in":
            return await handleSignIn(request, config);
          case "sign-up":
            return await handleSignUp(request);
          case "sign-out":
            return await handleSignOut(request, config);
          case "refresh":
            return await handleRefresh(request);
          case "forgot-password":
            return await handleForgotPassword(request);
          case "reset-password":
            return await handleResetPassword(request);
          case "verify-email":
            return await handleVerifyEmail(request);
          case "org/switch":
            return await handleOrgSwitch(request, config);
          default:
            /*
             * Routes the client already calls that this handler has not
             * implemented. The React provider posts to every MFA route below,
             * and the MFA components are shipped and wired to them, so these
             * were reached in normal use and answered the generic "Route not
             * found" 404 — which reads as a mistyped URL rather than a missing
             * feature. They now say what is actually wrong.
             */
            if (UNIMPLEMENTED_POST_ROUTES.has(route)) {
              return errorResponse(
                new AuthError(
                  `The "${route}" route is not implemented in @oppulence/auth yet`,
                  "CONFIGURATION_ERROR",
                  501,
                ),
              );
            }
            return errorResponse(
              new AuthError("Route not found", "CONFIGURATION_ERROR", 404),
            );
        }
      }

      return errorResponse(
        new AuthError("Method not allowed", "CONFIGURATION_ERROR", 405),
      );
    } catch (error) {
      debugLog("Unhandled error in auth handler", { error });
      return errorResponse(AuthError.from(error));
    }
  };
}
