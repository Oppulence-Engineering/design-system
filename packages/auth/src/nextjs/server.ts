/**
 * Next.js server utilities for @oppulence/auth
 *
 * Use these functions in Server Components, Route Handlers, and Server Actions
 * to access authentication state.
 */

import { resolveSession, getSessionMetadata } from "../core/session";
import { getSessionFromNextCookies, type NextCookies } from "../core/cookies";
import { AuthError } from "../core/types";
import type {
  User,
  Session,
  Organization,
  OrganizationMembership,
  Permission,
  OrganizationRole,
} from "../core/types";
import { hasRoleLevel } from "../core/constants";

// ============================================================================
// Types
// ============================================================================

/**
 * Type for Next.js cookies() function.
 * Import from 'next/headers' in your app.
 */
interface NextCookiesInterface {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  delete(name: string): void;
}

// ============================================================================
// Session Retrieval
// ============================================================================

/**
 * Gets the current session from cookies.
 *
 * @param cookies - The cookies() object from next/headers
 * @returns Session data or null if not authenticated
 *
 * @example
 * ```ts
 * import { cookies } from 'next/headers';
 * import { getSession } from '@oppulence/auth/nextjs';
 *
 * export default async function Page() {
 *   const session = await getSession(cookies());
 *   if (!session) redirect('/sign-in');
 *   return <div>Session ID: {session.id}</div>;
 * }
 * ```
 */
export async function getSession(
  cookies: NextCookiesInterface
): Promise<Session | null> {
  const token = getSessionFromNextCookies(cookies as NextCookies);
  if (!token) return null;

  const result = await resolveSession(token);
  return result?.resolved.session ?? null;
}

/**
 * Gets the current user from cookies.
 *
 * @param cookies - The cookies() object from next/headers
 * @returns User data or null if not authenticated
 *
 * @example
 * ```ts
 * import { cookies } from 'next/headers';
 * import { getUser } from '@oppulence/auth/nextjs';
 *
 * export default async function ProfilePage() {
 *   const user = await getUser(cookies());
 *   if (!user) redirect('/sign-in');
 *   return <h1>Welcome, {user.firstName}</h1>;
 * }
 * ```
 */
export async function getUser(
  cookies: NextCookiesInterface
): Promise<User | null> {
  const token = getSessionFromNextCookies(cookies as NextCookies);
  if (!token) return null;

  const result = await resolveSession(token);
  return result?.resolved.user ?? null;
}

/**
 * Gets the active organization from cookies.
 *
 * @param cookies - The cookies() object from next/headers
 * @returns Organization data or null if none selected
 *
 * @example
 * ```ts
 * import { cookies } from 'next/headers';
 * import { getOrganization } from '@oppulence/auth/nextjs';
 *
 * export default async function OrgPage() {
 *   const org = await getOrganization(cookies());
 *   if (!org) redirect('/select-org');
 *   return <h1>{org.name}</h1>;
 * }
 * ```
 */
export async function getOrganization(
  cookies: NextCookiesInterface
): Promise<Organization | null> {
  const token = getSessionFromNextCookies(cookies as NextCookies);
  if (!token) return null;

  const result = await resolveSession(token);
  return result?.resolved.organization ?? null;
}

/**
 * Gets the user's membership in the active organization.
 *
 * @param cookies - The cookies() object from next/headers
 * @returns Membership data or null if no organization selected
 */
export async function getMembership(
  cookies: NextCookiesInterface
): Promise<OrganizationMembership | null> {
  const token = getSessionFromNextCookies(cookies as NextCookies);
  if (!token) return null;

  const result = await resolveSession(token);
  return result?.resolved.membership ?? null;
}

// ============================================================================
// Auth Guards
// ============================================================================

/**
 * Requires authentication. Throws if not authenticated.
 *
 * @param cookies - The cookies() object from next/headers
 * @returns User data (guaranteed non-null)
 * @throws {AuthError} If not authenticated
 *
 * @example
 * ```ts
 * import { cookies } from 'next/headers';
 * import { requireAuth } from '@oppulence/auth/nextjs';
 *
 * export async function GET() {
 *   const user = await requireAuth(cookies());
 *   // user is guaranteed to exist here
 *   return Response.json({ user });
 * }
 * ```
 */
export async function requireAuth(
  cookies: NextCookiesInterface
): Promise<User> {
  const user = await getUser(cookies);

  if (!user) {
    throw new AuthError(
      "Authentication required",
      "SESSION_EXPIRED",
      401
    );
  }

  return user;
}

/**
 * Requires an active organization. Throws if none selected.
 *
 * @param cookies - The cookies() object from next/headers
 * @returns Object with user, organization, and membership
 * @throws {AuthError} If not authenticated or no organization selected
 *
 * @example
 * ```ts
 * import { cookies } from 'next/headers';
 * import { requireOrg } from '@oppulence/auth/nextjs';
 *
 * export async function GET() {
 *   const { user, organization, membership } = await requireOrg(cookies());
 *   return Response.json({ organization });
 * }
 * ```
 */
export async function requireOrg(
  cookies: NextCookiesInterface
): Promise<{
  user: User;
  organization: Organization;
  membership: OrganizationMembership;
}> {
  const token = getSessionFromNextCookies(cookies as NextCookies);
  if (!token) {
    throw new AuthError("Authentication required", "SESSION_EXPIRED", 401);
  }

  const result = await resolveSession(token);
  if (!result) {
    throw new AuthError("Authentication required", "SESSION_EXPIRED", 401);
  }

  const { user, organization, membership } = result.resolved;

  if (!organization || !membership) {
    throw new AuthError(
      "Organization selection required",
      "ORGANIZATION_NOT_FOUND",
      403
    );
  }

  return { user, organization, membership };
}

/**
 * Requires a specific permission. Throws if user lacks permission.
 *
 * @param cookies - The cookies() object from next/headers
 * @param permission - Required permission
 * @returns Object with user, organization, and membership
 * @throws {AuthError} If not authorized
 *
 * @example
 * ```ts
 * import { cookies } from 'next/headers';
 * import { requirePermission } from '@oppulence/auth/nextjs';
 *
 * export async function DELETE() {
 *   await requirePermission(cookies(), 'members:remove');
 *   // User has permission to remove members
 * }
 * ```
 */
export async function requirePermission(
  cookies: NextCookiesInterface,
  permission: Permission
): Promise<{
  user: User;
  organization: Organization;
  membership: OrganizationMembership;
}> {
  const result = await requireOrg(cookies);

  if (!result.membership.permissions.includes(permission)) {
    throw new AuthError(
      `Permission denied: ${permission} required`,
      "PERMISSION_DENIED",
      403
    );
  }

  return result;
}

/**
 * Requires a minimum role level. Throws if user's role is insufficient.
 *
 * @param cookies - The cookies() object from next/headers
 * @param role - Minimum required role
 * @returns Object with user, organization, and membership
 * @throws {AuthError} If not authorized
 *
 * @example
 * ```ts
 * import { cookies } from 'next/headers';
 * import { requireRole } from '@oppulence/auth/nextjs';
 *
 * export async function POST() {
 *   await requireRole(cookies(), 'admin');
 *   // User is admin or owner
 * }
 * ```
 */
export async function requireRole(
  cookies: NextCookiesInterface,
  role: OrganizationRole
): Promise<{
  user: User;
  organization: Organization;
  membership: OrganizationMembership;
}> {
  const result = await requireOrg(cookies);

  if (!hasRoleLevel(result.membership.role, role)) {
    throw new AuthError(
      `Role denied: ${role} or higher required`,
      "PERMISSION_DENIED",
      403
    );
  }

  return result;
}

// ============================================================================
// Session Metadata (lightweight)
// ============================================================================

/**
 * Gets session metadata without full resolution.
 * Faster than getSession when you only need basic info.
 *
 * @param cookies - The cookies() object from next/headers
 * @returns Basic session info or null
 */
export async function getSessionInfo(
  cookies: NextCookiesInterface
): Promise<{
  userId: string;
  organizationId: string | null;
  expiresAt: Date;
} | null> {
  const token = getSessionFromNextCookies(cookies as NextCookies);
  if (!token) return null;

  return getSessionMetadata(token);
}

// ============================================================================
// Pages Router Support
// ============================================================================

/**
 * Interface for Next.js request with cookies (Pages Router).
 */
interface NextApiRequestLike {
  cookies: Partial<Record<string, string>>;
}

/**
 * Interface for getServerSideProps request.
 */
interface IncomingMessageLike {
  cookies?: Partial<Record<string, string>>;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Gets session from a Pages Router request object.
 * Works with both API routes and getServerSideProps.
 *
 * @param req - The request object with cookies
 * @returns Session data or null if not authenticated
 *
 * @example
 * ```ts
 * // pages/api/protected.ts
 * import { getSessionFromRequest } from '@oppulence/auth/nextjs';
 *
 * export default async function handler(req, res) {
 *   const session = await getSessionFromRequest(req);
 *   if (!session) return res.status(401).json({ error: 'Unauthorized' });
 *   // ...
 * }
 * ```
 */
export async function getSessionFromRequest(
  req: NextApiRequestLike | IncomingMessageLike
): Promise<{
  session: { sessionId: string; userId: string; organizationId: string | null };
  tokens: { accessToken: string; refreshToken: string; accessTokenExpiresAt: number; refreshTokenExpiresAt: number };
  user: User;
  organization: Organization | null;
  membership: OrganizationMembership | null;
} | null> {
  // Get cookies from request
  const cookies = 'cookies' in req && typeof req.cookies === 'object'
    ? req.cookies ?? {}
    : {};

  // Create a minimal cookies-like interface for getSessionFromNextCookies
  const cookiesInterface = {
    get(name: string) {
      const value = cookies[name];
      return value ? { value } : undefined;
    },
  } as NextCookies;

  const token = getSessionFromNextCookies(cookiesInterface);
  if (!token) return null;

  const result = await resolveSession(token);
  if (!result) return null;

  return {
    session: {
      sessionId: result.resolved.session.id,
      userId: result.resolved.session.userId,
      organizationId: result.resolved.organization?.id ?? null,
    },
    tokens: {
      accessToken: result.resolved.tokens.accessToken,
      refreshToken: result.resolved.tokens.refreshToken,
      accessTokenExpiresAt: result.resolved.tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: result.resolved.tokens.refreshTokenExpiresAt,
    },
    user: result.resolved.user,
    organization: result.resolved.organization,
    membership: result.resolved.membership,
  };
}

/**
 * Gets user from session data.
 * Helper for consistent user retrieval.
 */
export function getUserFromSession(session: {
  user: User;
}): User {
  return session.user;
}
