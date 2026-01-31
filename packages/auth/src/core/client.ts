/**
 * WorkOS client singleton for @oppulence/auth
 *
 * Provides a lazy-initialized WorkOS client that's only created on first use.
 * This ensures environment variables are validated before API calls.
 */

import { WorkOS } from "@workos-inc/node";
import { assertServer, getEnvVar, debugLog } from "./env";
import { AuthError } from "./types";
import type {
  OAuthProvider,
  User,
  Organization,
  OrganizationMembership,
} from "./types";
import { WORKOS_OAUTH_PROVIDERS } from "./constants";

// ============================================================================
// Client Singleton
// ============================================================================

let workosClient: WorkOS | null = null;

/**
 * Gets the WorkOS client instance.
 * Lazily initializes on first call to avoid import-time errors.
 *
 * @throws {AuthError} If called on the client or if configuration is invalid
 */
export function getWorkOSClient(): WorkOS {
  assertServer("getWorkOSClient()");

  if (!workosClient) {
    const apiKey = getEnvVar("WORKOS_API_KEY");
    workosClient = new WorkOS(apiKey);
    debugLog("WorkOS client initialized");
  }

  return workosClient;
}

/**
 * Gets the WorkOS client ID for OAuth flows.
 */
export function getClientId(): string {
  return getEnvVar("WORKOS_CLIENT_ID");
}

// ============================================================================
// User Management API Wrappers
// ============================================================================

/**
 * Maps WorkOS user to our User type.
 */
function mapWorkOSUser(
  workosUser: Awaited<ReturnType<WorkOS["userManagement"]["getUser"]>>,
): User {
  return {
    id: workosUser.id,
    email: workosUser.email,
    emailVerified: workosUser.emailVerified,
    firstName: workosUser.firstName,
    lastName: workosUser.lastName,
    profilePictureUrl: workosUser.profilePictureUrl,
    createdAt: new Date(workosUser.createdAt),
    updatedAt: new Date(workosUser.updatedAt),
    metadata: (workosUser.metadata as Record<string, unknown>) ?? {},
  };
}

/**
 * Gets a user by ID.
 */
export async function getUser(userId: string): Promise<User> {
  const client = getWorkOSClient();

  try {
    const workosUser = await client.userManagement.getUser(userId);
    return mapWorkOSUser(workosUser);
  } catch (error) {
    debugLog("Failed to get user", { userId, error });
    throw new AuthError("User not found", "USER_NOT_FOUND", 404, error);
  }
}

/**
 * Authenticates a user with email and password.
 */
export async function authenticateWithPassword(
  email: string,
  password: string,
): Promise<{ user: User; accessToken: string; refreshToken: string }> {
  const client = getWorkOSClient();

  try {
    const result = await client.userManagement.authenticateWithPassword({
      clientId: getClientId(),
      email,
      password,
    });

    return {
      user: mapWorkOSUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  } catch (error) {
    debugLog("Password authentication failed", { email, error });

    // WorkOS returns specific error codes we can map
    const message =
      error instanceof Error ? error.message : "Authentication failed";

    if (message.includes("invalid")) {
      throw new AuthError(
        "Invalid email or password",
        "INVALID_CREDENTIALS",
        401,
        error,
      );
    }
    if (message.includes("not verified")) {
      throw new AuthError(
        "Email not verified",
        "EMAIL_NOT_VERIFIED",
        401,
        error,
      );
    }

    throw new AuthError(
      "Authentication failed",
      "INVALID_CREDENTIALS",
      401,
      error,
    );
  }
}

/**
 * Creates a new user with email and password.
 */
export async function createUserWithPassword(
  email: string,
  password: string,
  options?: { firstName?: string; lastName?: string },
): Promise<User> {
  const client = getWorkOSClient();

  try {
    const workosUser = await client.userManagement.createUser({
      email,
      password,
      firstName: options?.firstName,
      lastName: options?.lastName,
    });

    debugLog("User created", { userId: workosUser.id, email });
    return mapWorkOSUser(workosUser);
  } catch (error) {
    debugLog("Failed to create user", { email, error });

    const message =
      error instanceof Error ? error.message : "User creation failed";

    if (message.includes("already exists")) {
      throw new AuthError(
        "A user with this email already exists",
        "USER_ALREADY_EXISTS",
        409,
        error,
      );
    }

    throw new AuthError("Failed to create user", "UNKNOWN_ERROR", 500, error);
  }
}

/**
 * Sends a password reset email.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const client = getWorkOSClient();
  const appUrl = getEnvVar("NEXT_PUBLIC_APP_URL");

  try {
    await client.userManagement.sendPasswordResetEmail({
      email,
      passwordResetUrl: `${appUrl}/reset-password`,
    });
    debugLog("Password reset email sent", { email });
  } catch (error) {
    debugLog("Failed to send password reset email", { email, error });
    // Don't reveal if user exists - always succeed from user perspective
  }
}

/**
 * Resets a user's password with a token.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<User> {
  const client = getWorkOSClient();

  try {
    const result = await client.userManagement.resetPassword({
      token,
      newPassword,
    });

    debugLog("Password reset successful", { userId: result.user.id });
    return mapWorkOSUser(result.user);
  } catch (error) {
    debugLog("Password reset failed", { error });
    throw new AuthError(
      "Invalid or expired reset token",
      "INVALID_TOKEN",
      400,
      error,
    );
  }
}

/**
 * Sends an email verification code.
 */
export async function sendVerificationEmail(userId: string): Promise<void> {
  const client = getWorkOSClient();

  try {
    await client.userManagement.sendVerificationEmail({
      userId,
    });
    debugLog("Verification email sent", { userId });
  } catch (error) {
    debugLog("Failed to send verification email", { userId, error });
    throw new AuthError(
      "Failed to send verification email",
      "UNKNOWN_ERROR",
      500,
      error,
    );
  }
}

/**
 * Verifies a user's email with a code.
 */
export async function verifyEmail(
  userId: string,
  code: string,
): Promise<{ user: User; accessToken: string; refreshToken: string }> {
  const client = getWorkOSClient();

  try {
    const result =
      await client.userManagement.authenticateWithEmailVerification({
        clientId: getClientId(),
        code,
        pendingAuthenticationToken: userId, // This should actually be the pending token
      });

    return {
      user: mapWorkOSUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  } catch (error) {
    debugLog("Email verification failed", { userId, error });
    throw new AuthError(
      "Invalid verification code",
      "INVALID_CODE",
      400,
      error,
    );
  }
}

/**
 * Refreshes an access token using a refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const client = getWorkOSClient();

  try {
    const result = await client.userManagement.authenticateWithRefreshToken({
      clientId: getClientId(),
      refreshToken,
    });

    debugLog("Token refreshed successfully");
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  } catch (error) {
    debugLog("Token refresh failed", { error });
    throw new AuthError("Session expired", "REFRESH_TOKEN_EXPIRED", 401, error);
  }
}

// ============================================================================
// OAuth API Wrappers
// ============================================================================

/**
 * Gets the OAuth authorization URL for a provider.
 */
export function getOAuthAuthorizationUrl(
  provider: OAuthProvider,
  redirectUri: string,
  state?: string,
): string {
  const client = getWorkOSClient();

  const url = client.userManagement.getAuthorizationUrl({
    provider: WORKOS_OAUTH_PROVIDERS[provider],
    clientId: getClientId(),
    redirectUri,
    state,
  });

  debugLog("Generated OAuth URL", { provider, redirectUri });
  return url;
}

/**
 * Handles the OAuth callback and exchanges code for tokens.
 */
export async function handleOAuthCallback(
  code: string,
): Promise<{ user: User; accessToken: string; refreshToken: string }> {
  const client = getWorkOSClient();

  try {
    const result = await client.userManagement.authenticateWithCode({
      clientId: getClientId(),
      code,
    });

    debugLog("OAuth callback successful", { userId: result.user.id });
    return {
      user: mapWorkOSUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  } catch (error) {
    debugLog("OAuth callback failed", { error });
    throw new AuthError(
      "OAuth authentication failed",
      "INVALID_CODE",
      400,
      error,
    );
  }
}

// ============================================================================
// Organization API Wrappers
// ============================================================================

/**
 * Maps WorkOS organization to our Organization type.
 */
function mapWorkOSOrganization(
  workosOrg: Awaited<ReturnType<WorkOS["organizations"]["getOrganization"]>>,
): Organization {
  // WorkOS Organization type may vary - cast to access optional fields
  const org = workosOrg as {
    id: string;
    name: string;
    slug?: string;
    logoUrl?: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
  };

  return {
    id: org.id,
    name: org.name,
    slug: org.slug ?? null,
    logoUrl: org.logoUrl ?? null,
    createdAt: new Date(org.createdAt),
    updatedAt: new Date(org.updatedAt),
    metadata: org.metadata ?? {},
  };
}

/**
 * Gets an organization by ID.
 */
export async function getOrganization(
  organizationId: string,
): Promise<Organization> {
  const client = getWorkOSClient();

  try {
    const workosOrg =
      await client.organizations.getOrganization(organizationId);
    return mapWorkOSOrganization(workosOrg);
  } catch (error) {
    debugLog("Failed to get organization", { organizationId, error });
    throw new AuthError(
      "Organization not found",
      "ORGANIZATION_NOT_FOUND",
      404,
      error,
    );
  }
}

/**
 * Lists organizations for a user.
 */
export async function listUserOrganizations(
  userId: string,
): Promise<Organization[]> {
  const client = getWorkOSClient();

  try {
    const memberships = await client.userManagement.listOrganizationMemberships(
      {
        userId,
      },
    );

    const orgs = await Promise.all(
      memberships.data.map((m) => getOrganization(m.organizationId)),
    );

    debugLog("Listed user organizations", { userId, count: orgs.length });
    return orgs;
  } catch (error) {
    debugLog("Failed to list user organizations", { userId, error });
    throw new AuthError(
      "Failed to list organizations",
      "UNKNOWN_ERROR",
      500,
      error,
    );
  }
}

/**
 * Gets a user's membership in an organization.
 */
export async function getOrganizationMembership(
  userId: string,
  organizationId: string,
): Promise<OrganizationMembership> {
  const client = getWorkOSClient();

  try {
    const memberships = await client.userManagement.listOrganizationMemberships(
      {
        userId,
        organizationId,
      },
    );

    const membership = memberships.data[0];
    if (!membership) {
      throw new AuthError(
        "User is not a member of this organization",
        "ORGANIZATION_MEMBERSHIP_NOT_FOUND",
        404,
      );
    }

    return {
      id: membership.id,
      userId: membership.userId,
      organizationId: membership.organizationId,
      role:
        (membership.role?.slug as OrganizationMembership["role"]) ?? "member",
      permissions: [], // WorkOS doesn't expose this directly; implement via role mapping
      createdAt: new Date(membership.createdAt),
    };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    debugLog("Failed to get organization membership", {
      userId,
      organizationId,
      error,
    });
    throw new AuthError(
      "Failed to get membership",
      "UNKNOWN_ERROR",
      500,
      error,
    );
  }
}
