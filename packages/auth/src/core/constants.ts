/**
 * Default configuration values and constants for @oppulence/auth
 */

import type { AuthConfig, ResolvedAuthConfig } from "./types";

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration values.
 * These can be overridden when initializing the auth package.
 */
export const DEFAULT_CONFIG: Omit<ResolvedAuthConfig, "clientId" | "redirectUri"> = {
  publicRoutes: [],
  signInUrl: "/sign-in",
  afterSignInUrl: "/dashboard",
  afterSignOutUrl: "/",
  multiTenant: true,
  cookieName: "__oppulence_session",
  cookieDomain: "",
  debug: false,
};

/**
 * Resolves partial config with defaults.
 */
export function resolveConfig(config: AuthConfig): ResolvedAuthConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
  };
}

// ============================================================================
// Session Constants
// ============================================================================

/**
 * Access token lifetime in seconds (15 minutes).
 * After this, the token must be refreshed.
 */
export const ACCESS_TOKEN_LIFETIME = 15 * 60;

/**
 * Refresh token lifetime in seconds (30 days).
 * After this, the user must re-authenticate.
 */
export const REFRESH_TOKEN_LIFETIME = 30 * 24 * 60 * 60;

/**
 * Buffer time in seconds before token expiry to trigger refresh (5 minutes).
 * Proactively refresh when access token expires in less than this time.
 */
export const TOKEN_REFRESH_BUFFER = 5 * 60;

/**
 * Session refresh interval in milliseconds (1 minute).
 * How often the client checks if tokens need refreshing.
 */
export const SESSION_REFRESH_INTERVAL = 60 * 1000;

// ============================================================================
// Cookie Constants
// ============================================================================

/**
 * Cookie max age in seconds (matches refresh token lifetime).
 */
export const COOKIE_MAX_AGE = REFRESH_TOKEN_LIFETIME;

/**
 * Cookie options for secure session storage.
 */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// ============================================================================
// Rate Limiting Constants
// ============================================================================

/**
 * Maximum sign-in attempts per IP per minute.
 */
export const RATE_LIMIT_SIGN_IN_PER_MINUTE = 5;

/**
 * Maximum sign-in attempts per IP per hour.
 */
export const RATE_LIMIT_SIGN_IN_PER_HOUR = 20;

/**
 * Maximum password reset requests per email per hour.
 */
export const RATE_LIMIT_PASSWORD_RESET_PER_HOUR = 3;

/**
 * Lockout duration in seconds after max attempts (15 minutes).
 */
export const RATE_LIMIT_LOCKOUT_DURATION = 15 * 60;

// ============================================================================
// API Route Constants
// ============================================================================

/**
 * Base path for auth API routes.
 */
export const AUTH_API_BASE = "/api/auth";

/**
 * Auth API route paths.
 */
export const AUTH_ROUTES = {
  SESSION: `${AUTH_API_BASE}/session`,
  SIGN_IN: `${AUTH_API_BASE}/sign-in`,
  SIGN_UP: `${AUTH_API_BASE}/sign-up`,
  SIGN_OUT: `${AUTH_API_BASE}/sign-out`,
  CALLBACK: `${AUTH_API_BASE}/callback`,
  REFRESH: `${AUTH_API_BASE}/refresh`,
  VERIFY_EMAIL: `${AUTH_API_BASE}/verify-email`,
  FORGOT_PASSWORD: `${AUTH_API_BASE}/forgot-password`,
  RESET_PASSWORD: `${AUTH_API_BASE}/reset-password`,
  MFA_ENROLL: `${AUTH_API_BASE}/mfa/enroll`,
  MFA_VERIFY: `${AUTH_API_BASE}/mfa/verify`,
  ORG_SWITCH: `${AUTH_API_BASE}/org/switch`,
  WEBHOOK: `${AUTH_API_BASE}/webhook`,
} as const;

// ============================================================================
// OAuth Provider Constants
// ============================================================================

/**
 * OAuth provider display names.
 */
export const OAUTH_PROVIDER_NAMES = {
  google: "Google",
  github: "GitHub",
  microsoft: "Microsoft",
} as const;

/**
 * WorkOS OAuth provider identifiers.
 */
export const WORKOS_OAUTH_PROVIDERS = {
  google: "GoogleOAuth",
  github: "GitHubOAuth",
  microsoft: "MicrosoftOAuth",
} as const;

// ============================================================================
// Role Hierarchy
// ============================================================================

/**
 * Role hierarchy for permission checks.
 * Higher index = more permissions.
 */
export const ROLE_HIERARCHY = ["guest", "member", "admin", "owner"] as const;

/**
 * Get the hierarchy level of a role.
 */
export function getRoleLevel(role: string): number {
  const index = ROLE_HIERARCHY.indexOf(role as (typeof ROLE_HIERARCHY)[number]);
  return index === -1 ? -1 : index;
}

/**
 * Check if role A has at least the same permissions as role B.
 */
export function hasRoleLevel(roleA: string, roleB: string): boolean {
  return getRoleLevel(roleA) >= getRoleLevel(roleB);
}
