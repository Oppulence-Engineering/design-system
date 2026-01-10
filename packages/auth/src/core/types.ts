/**
 * Core type definitions for @oppulence/auth
 *
 * These types model the authentication domain and are designed to be
 * compatible with WorkOS data structures while providing a clean API.
 */

// ============================================================================
// User Types
// ============================================================================

/**
 * Represents an authenticated user in the system.
 * Maps to WorkOS User Management API user object.
 */
export interface User {
  /** Unique identifier (WorkOS user ID) */
  id: string;
  /** User's email address */
  email: string;
  /** Whether the email has been verified */
  emailVerified: boolean;
  /** User's first name */
  firstName: string | null;
  /** User's last name */
  lastName: string | null;
  /** URL to user's profile picture */
  profilePictureUrl: string | null;
  /** When the user was created */
  createdAt: Date;
  /** When the user was last updated */
  updatedAt: Date;
  /** Custom metadata stored on the user */
  metadata: Record<string, unknown>;
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Represents an authenticated session.
 * Contains tokens and metadata for maintaining auth state.
 */
export interface Session {
  /** Unique session identifier */
  id: string;
  /** ID of the authenticated user */
  userId: string;
  /** When the session expires */
  expiresAt: Date;
  /** When the session was created */
  createdAt: Date;
  /** IP address that created the session */
  ipAddress: string | null;
  /** User agent string */
  userAgent: string | null;
  /** Custom session metadata */
  metadata: Record<string, unknown>;
}

/**
 * Internal session data stored in encrypted cookie.
 * Contains tokens needed for API authentication.
 */
export interface SessionTokens {
  /** JWT access token from WorkOS */
  accessToken: string;
  /** Opaque refresh token from WorkOS */
  refreshToken: string;
  /** When the access token expires (Unix timestamp) */
  accessTokenExpiresAt: number;
  /** When the refresh token expires (Unix timestamp) */
  refreshTokenExpiresAt: number;
  /** Active organization ID (if multi-tenant) */
  organizationId: string | null;
}

// ============================================================================
// Organization Types
// ============================================================================

/**
 * Represents an organization in a multi-tenant system.
 * Maps to WorkOS Organizations API.
 */
export interface Organization {
  /** Unique identifier (WorkOS organization ID) */
  id: string;
  /** Display name of the organization */
  name: string;
  /** URL-safe slug for the organization */
  slug: string | null;
  /** Organization's logo URL */
  logoUrl: string | null;
  /** When the organization was created */
  createdAt: Date;
  /** When the organization was last updated */
  updatedAt: Date;
  /** Custom organization metadata */
  metadata: Record<string, unknown>;
}

/**
 * Role within an organization.
 * Defines the hierarchy of permissions.
 */
export type OrganizationRole = "owner" | "admin" | "member" | "guest";

/**
 * Permission string format.
 * Uses resource:action pattern (e.g., "billing:read", "members:invite").
 */
export type Permission =
  | "org:read"
  | "org:write"
  | "org:delete"
  | "members:read"
  | "members:invite"
  | "members:remove"
  | "billing:read"
  | "billing:write"
  | (string & {}); // Allow custom permissions while keeping autocomplete

/**
 * Represents a user's membership in an organization.
 */
export interface OrganizationMembership {
  /** Unique identifier */
  id: string;
  /** ID of the user */
  userId: string;
  /** ID of the organization */
  organizationId: string;
  /** User's role in the organization */
  role: OrganizationRole;
  /** Explicit permissions granted */
  permissions: Permission[];
  /** When the membership was created */
  createdAt: Date;
}

// ============================================================================
// Auth State Types
// ============================================================================

/**
 * Complete authentication state exposed to React components.
 */
export interface AuthState {
  /** Current authenticated user (null if not authenticated) */
  user: User | null;
  /** Current session (null if not authenticated) */
  session: Session | null;
  /** Active organization (null if none selected) */
  organization: Organization | null;
  /** User's membership in the active organization */
  membership: OrganizationMembership | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether auth state is being loaded/hydrated */
  isLoading: boolean;
  /** Current auth error (null if none) */
  error: AuthError | null;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for the auth package.
 */
export interface AuthConfig {
  /** WorkOS Client ID (typically from WORKOS_CLIENT_ID env var) */
  clientId: string;
  /** Base URL for OAuth redirects (e.g., https://app.example.com) */
  redirectUri: string;
  /** Routes that don't require authentication (supports wildcards) */
  publicRoutes?: string[];
  /** Route to redirect unauthenticated users */
  signInUrl?: string;
  /** Route after successful sign-in */
  afterSignInUrl?: string;
  /** Route after sign-out */
  afterSignOutUrl?: string;
  /** Enable organization multi-tenancy */
  multiTenant?: boolean;
  /** Session cookie name */
  cookieName?: string;
  /** Cookie domain for cross-subdomain auth */
  cookieDomain?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Resolved configuration with defaults applied.
 */
export interface ResolvedAuthConfig extends Required<AuthConfig> {}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for authentication errors.
 * Used for programmatic error handling.
 */
export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "USER_NOT_FOUND"
  | "USER_ALREADY_EXISTS"
  | "EMAIL_NOT_VERIFIED"
  | "SESSION_EXPIRED"
  | "REFRESH_TOKEN_EXPIRED"
  | "INVALID_TOKEN"
  | "INVALID_CODE"
  | "MFA_REQUIRED"
  | "MFA_INVALID"
  | "MFA_NOT_ENROLLED"
  | "ORGANIZATION_NOT_FOUND"
  | "ORGANIZATION_MEMBERSHIP_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "CONFIGURATION_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Custom error class for authentication errors.
 * Provides structured error information for handling.
 */
export class AuthError extends Error {
  public readonly name = "AuthError";

  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly status: number = 401,
    public readonly cause?: unknown
  ) {
    super(message);

    // Maintains proper stack trace in V8 environments
    const ErrorWithCapture = Error as typeof Error & {
      captureStackTrace?: (target: object, constructor: Function) => void;
    };
    if (ErrorWithCapture.captureStackTrace) {
      ErrorWithCapture.captureStackTrace(this, AuthError);
    }
  }

  /**
   * Creates an AuthError from an unknown error.
   * Useful for wrapping caught exceptions.
   */
  static from(error: unknown, fallbackCode: AuthErrorCode = "UNKNOWN_ERROR"): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    if (error instanceof Error) {
      return new AuthError(error.message, fallbackCode, 500, error);
    }

    return new AuthError(
      typeof error === "string" ? error : "An unknown error occurred",
      fallbackCode,
      500,
      error
    );
  }

  /**
   * Serializes the error for JSON responses.
   */
  toJSON(): { message: string; code: AuthErrorCode; status: number } {
    return {
      message: this.message,
      code: this.code,
      status: this.status,
    };
  }
}

// ============================================================================
// Auth Strategy Types
// ============================================================================

/**
 * Supported authentication strategies.
 */
export type AuthStrategy =
  | "email-password"
  | "magic-link"
  | "oauth:google"
  | "oauth:github"
  | "oauth:microsoft"
  | "saml"
  | "oidc";

/**
 * OAuth provider identifiers.
 */
export type OAuthProvider = "google" | "github" | "microsoft";

// ============================================================================
// MFA Types
// ============================================================================

/**
 * MFA factor types supported by WorkOS.
 */
export type MFAFactorType = "totp" | "sms";

/**
 * MFA enrollment challenge data.
 */
export interface MFAEnrollmentChallenge {
  /** Factor ID for verification */
  factorId: string;
  /** Factor type */
  type: MFAFactorType;
  /** TOTP secret (for totp type) */
  totpSecret?: string;
  /** QR code URI (for totp type) */
  totpUri?: string;
  /** Phone number (for sms type, partially masked) */
  phoneNumber?: string;
}

/**
 * MFA verification challenge data.
 */
export interface MFAChallengeData {
  /** Challenge ID */
  challengeId: string;
  /** Factor ID being verified */
  factorId: string;
  /** Factor type */
  type: MFAFactorType;
  /** When the challenge expires */
  expiresAt: Date;
}

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * WorkOS webhook event types we handle.
 */
export type WorkOSWebhookEvent =
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "organization.created"
  | "organization.updated"
  | "organization.deleted"
  | "organization_membership.created"
  | "organization_membership.updated"
  | "organization_membership.deleted"
  | "session.created"
  | "authentication.email_verification_succeeded"
  | "authentication.magic_auth_succeeded"
  | "authentication.mfa_succeeded"
  | "authentication.oauth_succeeded"
  | "authentication.password_reset_succeeded"
  | "authentication.sso_succeeded";

/**
 * WorkOS webhook payload structure.
 */
export interface WorkOSWebhookPayload<T = unknown> {
  /** Unique event ID */
  id: string;
  /** Event type */
  event: WorkOSWebhookEvent;
  /** Event data */
  data: T;
  /** When the event was created */
  createdAt: string;
}
