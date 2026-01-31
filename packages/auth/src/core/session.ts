/**
 * Session management for @oppulence/auth
 *
 * Handles session creation, validation, refresh, and storage.
 * Sessions are stored as encrypted JWE tokens in HTTP-only cookies.
 */

import { encrypt, decrypt, generateToken } from "./crypto";
import {
  refreshAccessToken,
  getUser,
  getOrganization,
  getOrganizationMembership,
} from "./client";
import { debugLog, assertServer } from "./env";
import {
  ACCESS_TOKEN_LIFETIME,
  REFRESH_TOKEN_LIFETIME,
  TOKEN_REFRESH_BUFFER,
} from "./constants";
import type {
  Session,
  SessionTokens,
  User,
  Organization,
  OrganizationMembership,
  AuthError as AuthErrorType,
} from "./types";
import { AuthError } from "./types";

// ============================================================================
// Session Data Types
// ============================================================================

/**
 * Internal session payload stored in encrypted cookie.
 */
interface SessionPayload extends SessionTokens {
  /** Session ID */
  sessionId: string;
  /** User ID */
  userId: string;
  /** IP address that created the session */
  ipAddress: string | null;
  /** User agent string */
  userAgent: string | null;
  /** When the session was created (Unix timestamp) */
  createdAt: number;
  /** Index signature for compatibility with encrypt() */
  [key: string]: string | number | null;
}

/**
 * Full session data with resolved user and organization.
 */
export interface ResolvedSession {
  session: Session;
  tokens: SessionTokens;
  user: User;
  organization: Organization | null;
  membership: OrganizationMembership | null;
}

// ============================================================================
// Session Creation
// ============================================================================

/**
 * Creates a new session from authentication result.
 *
 * @param accessToken - JWT access token from WorkOS
 * @param refreshToken - Opaque refresh token from WorkOS
 * @param userId - ID of the authenticated user
 * @param options - Additional session metadata
 * @returns Encrypted session token for cookie storage
 */
export async function createSession(
  accessToken: string,
  refreshToken: string,
  userId: string,
  options?: {
    ipAddress?: string;
    userAgent?: string;
    organizationId?: string;
  },
): Promise<string> {
  assertServer("createSession()");

  const now = Math.floor(Date.now() / 1000);

  const payload: SessionPayload = {
    sessionId: generateToken(16),
    userId,
    accessToken,
    refreshToken,
    accessTokenExpiresAt: now + ACCESS_TOKEN_LIFETIME,
    refreshTokenExpiresAt: now + REFRESH_TOKEN_LIFETIME,
    organizationId: options?.organizationId ?? null,
    ipAddress: options?.ipAddress ?? null,
    userAgent: options?.userAgent ?? null,
    createdAt: now,
  };

  // Encrypt the session with 30-day expiry (matches refresh token)
  const encrypted = await encrypt(payload, "30d");

  debugLog("Session created", { sessionId: payload.sessionId, userId });
  return encrypted;
}

// ============================================================================
// Session Decoding
// ============================================================================

/**
 * Decodes and validates an encrypted session token.
 * Does NOT refresh the token - use getValidSession for that.
 *
 * @param encryptedToken - Encrypted session token from cookie
 * @returns Session payload or null if invalid
 */
export async function decodeSession(
  encryptedToken: string,
): Promise<SessionPayload | null> {
  assertServer("decodeSession()");

  try {
    const payload = await decrypt<SessionPayload>(encryptedToken);

    // Validate required fields
    if (
      !payload.sessionId ||
      !payload.userId ||
      !payload.accessToken ||
      !payload.refreshToken
    ) {
      debugLog("Session missing required fields");
      return null;
    }

    return payload;
  } catch (error) {
    debugLog("Failed to decode session", { error });
    return null;
  }
}

// ============================================================================
// Session Validation & Refresh
// ============================================================================

/**
 * Gets a valid session, refreshing tokens if needed.
 * This is the main entry point for session validation.
 *
 * @param encryptedToken - Encrypted session token from cookie
 * @returns Valid session data with new token if refreshed, or null if invalid
 */
export async function getValidSession(
  encryptedToken: string,
): Promise<{ session: SessionPayload; newToken: string | null } | null> {
  assertServer("getValidSession()");

  const payload = await decodeSession(encryptedToken);
  if (!payload) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  // Check if refresh token has expired
  if (now >= payload.refreshTokenExpiresAt) {
    debugLog("Refresh token expired", { sessionId: payload.sessionId });
    return null;
  }

  // Check if access token needs refresh (expires within buffer time)
  if (now >= payload.accessTokenExpiresAt - TOKEN_REFRESH_BUFFER) {
    debugLog("Access token expiring soon, refreshing", {
      sessionId: payload.sessionId,
    });

    try {
      const { accessToken, refreshToken } = await refreshAccessToken(
        payload.refreshToken,
      );

      // Update payload with new tokens
      const newPayload: SessionPayload = {
        ...payload,
        accessToken,
        refreshToken,
        accessTokenExpiresAt: now + ACCESS_TOKEN_LIFETIME,
        // Extend refresh token on each use (sliding window)
        refreshTokenExpiresAt: now + REFRESH_TOKEN_LIFETIME,
      };

      const newToken = await encrypt(newPayload, "30d");
      debugLog("Session refreshed successfully", {
        sessionId: payload.sessionId,
      });

      return { session: newPayload, newToken };
    } catch (error) {
      debugLog("Token refresh failed", { sessionId: payload.sessionId, error });
      return null;
    }
  }

  // Token is still valid
  return { session: payload, newToken: null };
}

// ============================================================================
// Full Session Resolution
// ============================================================================

/**
 * Resolves a full session with user and organization data.
 * Use this when you need complete session context.
 *
 * @param encryptedToken - Encrypted session token from cookie
 * @returns Full resolved session or null if invalid
 */
export async function resolveSession(
  encryptedToken: string,
): Promise<{ resolved: ResolvedSession; newToken: string | null } | null> {
  assertServer("resolveSession()");

  const result = await getValidSession(encryptedToken);
  if (!result) {
    return null;
  }

  const { session: payload, newToken } = result;

  try {
    // Fetch user data
    const user = await getUser(payload.userId);

    // Fetch organization data if set
    let organization: Organization | null = null;
    let membership: OrganizationMembership | null = null;

    if (payload.organizationId) {
      try {
        organization = await getOrganization(payload.organizationId);
        membership = await getOrganizationMembership(
          payload.userId,
          payload.organizationId,
        );
      } catch (error) {
        // Organization might have been deleted or user removed
        debugLog("Failed to resolve organization", {
          organizationId: payload.organizationId,
          error,
        });
      }
    }

    const session: Session = {
      id: payload.sessionId,
      userId: payload.userId,
      expiresAt: new Date(payload.refreshTokenExpiresAt * 1000),
      createdAt: new Date(payload.createdAt * 1000),
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      metadata: {},
    };

    const tokens: SessionTokens = {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      accessTokenExpiresAt: payload.accessTokenExpiresAt,
      refreshTokenExpiresAt: payload.refreshTokenExpiresAt,
      organizationId: payload.organizationId,
    };

    return {
      resolved: {
        session,
        tokens,
        user,
        organization,
        membership,
      },
      newToken,
    };
  } catch (error) {
    debugLog("Failed to resolve session", {
      sessionId: payload.sessionId,
      error,
    });
    return null;
  }
}

// ============================================================================
// Session Modification
// ============================================================================

/**
 * Updates the active organization in a session.
 *
 * @param encryptedToken - Current encrypted session token
 * @param organizationId - New organization ID (or null to clear)
 * @returns New encrypted session token
 */
export async function updateSessionOrganization(
  encryptedToken: string,
  organizationId: string | null,
): Promise<string> {
  assertServer("updateSessionOrganization()");

  const payload = await decodeSession(encryptedToken);
  if (!payload) {
    throw new AuthError("Invalid session", "INVALID_TOKEN", 401);
  }

  // Validate the user has access to the organization
  if (organizationId) {
    await getOrganizationMembership(payload.userId, organizationId);
  }

  const newPayload: SessionPayload = {
    ...payload,
    organizationId,
  };

  const newToken = await encrypt(newPayload, "30d");
  debugLog("Session organization updated", {
    sessionId: payload.sessionId,
    organizationId,
  });

  return newToken;
}

// ============================================================================
// Session Metadata
// ============================================================================

/**
 * Extracts session metadata without full resolution.
 * Useful for quick checks without API calls.
 */
export async function getSessionMetadata(
  encryptedToken: string,
): Promise<{
  userId: string;
  organizationId: string | null;
  expiresAt: Date;
} | null> {
  const payload = await decodeSession(encryptedToken);
  if (!payload) {
    return null;
  }

  return {
    userId: payload.userId,
    organizationId: payload.organizationId,
    expiresAt: new Date(payload.refreshTokenExpiresAt * 1000),
  };
}

/**
 * Checks if a session token needs to be refreshed.
 * Returns true if access token expires within the buffer time.
 */
export async function sessionNeedsRefresh(
  encryptedToken: string,
): Promise<boolean> {
  const payload = await decodeSession(encryptedToken);
  if (!payload) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return now >= payload.accessTokenExpiresAt - TOKEN_REFRESH_BUFFER;
}
