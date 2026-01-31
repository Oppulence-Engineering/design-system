/**
 * tRPC context builder for @oppulence/auth
 *
 * Creates auth context from request headers for tRPC procedures.
 */

import { resolveSession, getSessionMetadata } from "../core/session";
import { getCookieName } from "../core/cookies";
import { hasRoleLevel } from "../core/constants";
import type {
  User,
  Session,
  Organization,
  OrganizationMembership,
  Permission,
  OrganizationRole,
} from "../core/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for creating auth context.
 */
export interface CreateAuthContextOptions {
  /**
   * Request headers containing cookies.
   */
  headers: Headers;
}

/**
 * Auth context available in tRPC procedures.
 */
export interface AuthContext {
  /** Current user or null */
  user: User | null;
  /** Current session or null */
  session: Session | null;
  /** Active organization or null */
  organization: Organization | null;
  /** User's membership or null */
  membership: OrganizationMembership | null;
  /** Check if user has a specific permission */
  hasPermission: (permission: Permission) => boolean;
  /** Check if user has at least the specified role */
  hasRole: (role: OrganizationRole) => boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
}

// ============================================================================
// Context Builder
// ============================================================================

/**
 * Creates auth context from request headers.
 *
 * @param options - Context options with headers
 * @returns Auth context for tRPC procedures
 *
 * @example
 * ```ts
 * // server/trpc/context.ts
 * import { createAuthContext } from '@oppulence/auth/trpc';
 *
 * export async function createContext({ req }: { req: Request }) {
 *   const auth = await createAuthContext({ headers: req.headers });
 *
 *   return {
 *     auth,
 *     // ... other context
 *   };
 * }
 * ```
 */
export async function createAuthContext(
  options: CreateAuthContextOptions,
): Promise<AuthContext> {
  const { headers } = options;

  // Get session token from cookie header
  const cookieHeader = headers.get("cookie");
  const sessionToken = parseCookieValue(cookieHeader, getCookieName());

  // Default empty context
  const emptyContext: AuthContext = {
    user: null,
    session: null,
    organization: null,
    membership: null,
    hasPermission: () => false,
    hasRole: () => false,
    isAuthenticated: false,
  };

  if (!sessionToken) {
    return emptyContext;
  }

  try {
    const result = await resolveSession(sessionToken);
    if (!result) {
      return emptyContext;
    }

    const { user, session, organization, membership } = result.resolved;

    return {
      user,
      session,
      organization,
      membership,
      hasPermission: (permission: Permission) => {
        if (!membership) return false;
        return membership.permissions.includes(permission);
      },
      hasRole: (role: OrganizationRole) => {
        if (!membership) return false;
        return hasRoleLevel(membership.role, role);
      },
      isAuthenticated: true,
    };
  } catch {
    return emptyContext;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parses a specific cookie value from the cookie header.
 */
function parseCookieValue(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.trim().split("=");
    if (cookieName === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}
