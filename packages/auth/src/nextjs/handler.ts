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
  getSessionFromRequest,
  createSessionCookieHeader,
  createClearSessionCookieHeader,
  validateCSRFToken,
} from "../core/cookies";
import { validateOAuthState, generateOAuthState } from "../core/crypto";
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
   */
  webhookSecret?: string;

  /**
   * Custom webhook handlers.
   */
  webhooks?: Partial<Record<WorkOSWebhookEvent, (payload: WorkOSWebhookPayload) => Promise<void>>>;

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

function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>): Response {
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

function redirectResponse(url: string, headers?: Record<string, string>): Response {
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
  config: AuthHandlerConfig
): Promise<Response> {
  try {
    const body = await request.json();
    const data = signInSchema.parse(body);

    const { user, accessToken, refreshToken } = await authenticateWithPassword(
      data.email,
      data.password
    );

    // Create session
    const sessionToken = await createSession(accessToken, refreshToken, user.id, {
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

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
      { "Set-Cookie": createSessionCookieHeader(sessionToken) }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error);
    }
    debugLog("Sign-in error", { error });
    return errorResponse(
      new AuthError("Sign-in failed", "INVALID_CREDENTIALS", 401, error)
    );
  }
}

async function handleSignUp(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const data = signUpSchema.parse(body);

    await createUserWithPassword(data.email, data.password, {
      firstName: data.firstName,
      lastName: data.lastName,
    });

    // Don't auto-sign-in - require email verification
    return jsonResponse({ success: true, message: "Check your email to verify your account" });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error);
    }
    debugLog("Sign-up error", { error });
    return errorResponse(
      new AuthError("Sign-up failed", "UNKNOWN_ERROR", 500, error)
    );
  }
}

async function handleSignOut(
  request: Request,
  config: AuthHandlerConfig
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

  return jsonResponse(
    { success: true },
    200,
    { "Set-Cookie": createClearSessionCookieHeader() }
  );
}

async function handleOAuthStart(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") as OAuthProvider | null;

  if (!provider || !["google", "github", "microsoft"].includes(provider)) {
    return errorResponse(
      new AuthError("Invalid OAuth provider", "CONFIGURATION_ERROR", 400)
    );
  }

  const state = generateOAuthState();
  const redirectUri = getCallbackUrl();
  const authUrl = getOAuthAuthorizationUrl(provider, redirectUri, state);

  // Set state in cookie for validation
  const stateCookie = `__oppulence_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`;

  return redirectResponse(authUrl, { "Set-Cookie": stateCookie });
}

async function handleOAuthCallback(
  request: Request,
  config: AuthHandlerConfig
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Check for OAuth error
  if (error) {
    const redirectUrl = config.afterSignInUrl ?? "/sign-in";
    return redirectResponse(`${redirectUrl}?error=${encodeURIComponent(error)}`);
  }

  // Validate state
  if (!state || !validateOAuthState(state)) {
    return errorResponse(
      new AuthError("Invalid OAuth state", "INVALID_TOKEN", 400)
    );
  }

  if (!code) {
    return errorResponse(
      new AuthError("Missing authorization code", "INVALID_CODE", 400)
    );
  }

  try {
    const { user, accessToken, refreshToken } = await processOAuthCallback(code);

    // Create session
    const sessionToken = await createSession(accessToken, refreshToken, user.id, {
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    // Callback
    await config.onSignIn?.(user, !user.emailVerified); // New if not verified

    const redirectUrl = config.afterSignInUrl ?? "/dashboard";
    return redirectResponse(redirectUrl, {
      "Set-Cookie": createSessionCookieHeader(sessionToken),
    });
  } catch (error) {
    debugLog("OAuth callback error", { error });
    const redirectUrl = config.afterSignInUrl ?? "/sign-in";
    return redirectResponse(`${redirectUrl}?error=oauth_failed`);
  }
}

async function handleRefresh(request: Request): Promise<Response> {
  const token = getSessionFromRequest(request);

  if (!token) {
    return errorResponse(
      new AuthError("No session to refresh", "SESSION_EXPIRED", 401)
    );
  }

  try {
    const result = await resolveSession(token);
    if (!result) {
      return errorResponse(
        new AuthError("Session expired", "SESSION_EXPIRED", 401)
      );
    }

    // If token was refreshed, send new cookie
    if (result.newToken) {
      return jsonResponse(
        { success: true },
        200,
        { "Set-Cookie": createSessionCookieHeader(result.newToken) }
      );
    }

    return jsonResponse({ success: true });
  } catch (error) {
    debugLog("Refresh error", { error });
    return errorResponse(
      new AuthError("Session refresh failed", "SESSION_EXPIRED", 401, error)
    );
  }
}

async function handleForgotPassword(request: Request): Promise<Response> {
  try {
    const body = await request.json();
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
    const body = await request.json();
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
      new AuthError("Password reset failed", "INVALID_TOKEN", 400, error)
    );
  }
}

async function handleVerifyEmail(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { action, code } = body;

    const token = getSessionFromRequest(request);
    if (!token) {
      return errorResponse(
        new AuthError("Authentication required", "SESSION_EXPIRED", 401)
      );
    }

    const result = await resolveSession(token);
    if (!result) {
      return errorResponse(
        new AuthError("Session expired", "SESSION_EXPIRED", 401)
      );
    }

    if (action === "send") {
      await sendVerificationEmail(result.resolved.user.id);
      return jsonResponse({ success: true, message: "Verification email sent" });
    }

    if (action === "verify") {
      const data = verifyEmailSchema.parse({ code });
      const { user, accessToken, refreshToken } = await verifyEmailCode(
        result.resolved.user.id,
        data.code
      );

      // Create new session with verified user
      const sessionToken = await createSession(accessToken, refreshToken, user.id);

      return jsonResponse(
        { user, success: true },
        200,
        { "Set-Cookie": createSessionCookieHeader(sessionToken) }
      );
    }

    return errorResponse(
      new AuthError("Invalid action", "CONFIGURATION_ERROR", 400)
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error);
    }
    debugLog("Verify email error", { error });
    return errorResponse(
      new AuthError("Verification failed", "INVALID_CODE", 400, error)
    );
  }
}

async function handleOrgSwitch(
  request: Request,
  config: AuthHandlerConfig
): Promise<Response> {
  try {
    const body = await request.json();
    const { organizationId } = body;

    const token = getSessionFromRequest(request);
    if (!token) {
      return errorResponse(
        new AuthError("Authentication required", "SESSION_EXPIRED", 401)
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

    return jsonResponse(
      { organization, membership },
      200,
      { "Set-Cookie": createSessionCookieHeader(newToken) }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error);
    }
    debugLog("Org switch error", { error });
    return errorResponse(
      new AuthError("Organization switch failed", "ORGANIZATION_NOT_FOUND", 400, error)
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
            return handleSession(request);
          case "callback":
            return handleOAuthCallback(request, config);
          default:
            // Check if it's an OAuth start (has provider param)
            if (url.searchParams.has("provider")) {
              return handleOAuthStart(request);
            }
            return errorResponse(
              new AuthError("Route not found", "CONFIGURATION_ERROR", 404)
            );
        }
      }

      // POST routes
      if (request.method === "POST") {
        switch (route) {
          case "sign-in":
            return handleSignIn(request, config);
          case "sign-up":
            return handleSignUp(request);
          case "sign-out":
            return handleSignOut(request, config);
          case "refresh":
            return handleRefresh(request);
          case "forgot-password":
            return handleForgotPassword(request);
          case "reset-password":
            return handleResetPassword(request);
          case "verify-email":
            return handleVerifyEmail(request);
          case "org/switch":
            return handleOrgSwitch(request, config);
          // TODO: MFA routes
          // case "mfa/enroll":
          // case "mfa/verify":
          // TODO: Webhook handler
          // case "webhook":
          default:
            return errorResponse(
              new AuthError("Route not found", "CONFIGURATION_ERROR", 404)
            );
        }
      }

      return errorResponse(
        new AuthError("Method not allowed", "CONFIGURATION_ERROR", 405)
      );
    } catch (error) {
      debugLog("Unhandled error in auth handler", { error });
      return errorResponse(AuthError.from(error));
    }
  };
}
