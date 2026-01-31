/**
 * Higher-Order Components for Next.js Pages Router
 *
 * Provides authentication wrappers for API routes and page components
 * in the legacy Pages Router architecture.
 */

import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { getSessionFromRequest, getUserFromSession } from "./server";
import type {
  User,
  Session,
  Organization,
  OrganizationMembership,
} from "../core/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Extended request with auth context.
 */
export interface AuthenticatedRequest extends NextApiRequest {
  auth: {
    user: User;
    session: Session;
    organization: Organization | null;
    membership: OrganizationMembership | null;
  };
}

/**
 * Options for withAuth HOC.
 */
export interface WithAuthOptions {
  /**
   * Require user to be authenticated.
   * @default true
   */
  required?: boolean;

  /**
   * Require user to be in an organization.
   * @default false
   */
  requireOrganization?: boolean;

  /**
   * Required role for access.
   */
  requiredRole?: "owner" | "admin" | "member";

  /**
   * Custom unauthorized handler.
   */
  onUnauthorized?: (
    req: NextApiRequest,
    res: NextApiResponse,
  ) => void | Promise<void>;
}

/**
 * Auth props passed to getServerSideProps.
 */
export interface AuthProps {
  user: User | null;
  session: Session | null;
  organization: Organization | null;
}

/**
 * Options for withAuthSSR.
 */
export interface WithAuthSSROptions {
  /**
   * Redirect to sign-in if not authenticated.
   * @default true
   */
  redirectToSignIn?: boolean;

  /**
   * Sign-in URL.
   * @default "/sign-in"
   */
  signInUrl?: string;

  /**
   * Require user to be in an organization.
   * @default false
   */
  requireOrganization?: boolean;
}

// ============================================================================
// API Route HOC
// ============================================================================

/**
 * Wraps an API route handler with authentication.
 *
 * @param handler - The API route handler
 * @param options - Auth options
 * @returns Wrapped handler with auth context
 *
 * @example
 * ```ts
 * // pages/api/protected.ts
 * import { withAuth, type AuthenticatedRequest } from '@oppulence/auth/nextjs';
 *
 * async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
 *   const { user } = req.auth;
 *   res.json({ message: `Hello, ${user.email}!` });
 * }
 *
 * export default withAuth(handler);
 * ```
 */
export function withAuth(
  handler: (
    req: AuthenticatedRequest,
    res: NextApiResponse,
  ) => void | Promise<void>,
  options: WithAuthOptions = {},
): NextApiHandler {
  const {
    required = true,
    requireOrganization = false,
    requiredRole,
    onUnauthorized,
  } = options;

  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Get session from request
      const sessionResult = await getSessionFromRequest(req);

      if (!sessionResult && required) {
        if (onUnauthorized) {
          return onUnauthorized(req, res);
        }
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (sessionResult) {
        const { session, tokens, user, organization, membership } =
          sessionResult;

        // Check organization requirement
        if (requireOrganization && !organization) {
          if (onUnauthorized) {
            return onUnauthorized(req, res);
          }
          return res.status(403).json({ error: "Organization required" });
        }

        // Check role requirement
        if (requiredRole && membership) {
          const roleHierarchy = { owner: 3, admin: 2, member: 1 };
          const userRoleLevel =
            roleHierarchy[membership.role as keyof typeof roleHierarchy] ?? 0;
          const requiredRoleLevel = roleHierarchy[requiredRole];

          if (userRoleLevel < requiredRoleLevel) {
            if (onUnauthorized) {
              return onUnauthorized(req, res);
            }
            return res.status(403).json({ error: "Insufficient permissions" });
          }
        }

        // Attach auth context to request
        (req as AuthenticatedRequest).auth = {
          user,
          session: {
            id: session.sessionId,
            userId: session.userId,
            expiresAt: new Date(tokens.refreshTokenExpiresAt * 1000),
            createdAt: new Date(),
            ipAddress: null,
            userAgent: null,
            metadata: {},
          },
          organization,
          membership,
        };
      }

      return handler(req as AuthenticatedRequest, res);
    } catch (error) {
      console.error("[withAuth] Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

/**
 * Wraps an API route handler that requires admin role.
 */
export function withAdmin(
  handler: (
    req: AuthenticatedRequest,
    res: NextApiResponse,
  ) => void | Promise<void>,
  options: Omit<WithAuthOptions, "requiredRole"> = {},
): NextApiHandler {
  return withAuth(handler, { ...options, requiredRole: "admin" });
}

/**
 * Wraps an API route handler that requires owner role.
 */
export function withOwner(
  handler: (
    req: AuthenticatedRequest,
    res: NextApiResponse,
  ) => void | Promise<void>,
  options: Omit<WithAuthOptions, "requiredRole"> = {},
): NextApiHandler {
  return withAuth(handler, { ...options, requiredRole: "owner" });
}

/**
 * Wraps an API route handler that requires organization membership.
 */
export function withOrganization(
  handler: (
    req: AuthenticatedRequest,
    res: NextApiResponse,
  ) => void | Promise<void>,
  options: Omit<WithAuthOptions, "requireOrganization"> = {},
): NextApiHandler {
  return withAuth(handler, { ...options, requireOrganization: true });
}

// ============================================================================
// getServerSideProps HOC
// ============================================================================

/**
 * Creates a getServerSideProps function with authentication.
 *
 * @param getServerSidePropsFunc - The original getServerSideProps function
 * @param options - Auth options
 * @returns Wrapped getServerSideProps with auth props
 *
 * @example
 * ```ts
 * // pages/dashboard.tsx
 * import { withAuthSSR, type AuthProps } from '@oppulence/auth/nextjs';
 *
 * interface PageProps extends AuthProps {
 *   data: SomeData;
 * }
 *
 * export const getServerSideProps = withAuthSSR(async (context, auth) => {
 *   // auth.user is available here
 *   const data = await fetchData(auth.user?.id);
 *   return {
 *     props: { data },
 *   };
 * });
 *
 * export default function Dashboard({ user, data }: PageProps) {
 *   return <div>Welcome, {user?.email}</div>;
 * }
 * ```
 */
export function withAuthSSR<
  P extends Record<string, unknown> = Record<string, unknown>,
>(
  getServerSidePropsFunc?: (
    context: GetServerSidePropsContext,
    auth: AuthProps,
  ) => Promise<GetServerSidePropsResult<P>>,
  options: WithAuthSSROptions = {},
): (
  context: GetServerSidePropsContext,
) => Promise<GetServerSidePropsResult<P & AuthProps>> {
  const {
    redirectToSignIn = true,
    signInUrl = "/sign-in",
    requireOrganization = false,
  } = options;

  return async (context: GetServerSidePropsContext) => {
    try {
      // Get session from request
      const sessionResult = await getSessionFromRequest(context.req);

      const auth: AuthProps = {
        user: sessionResult?.user ?? null,
        session: sessionResult
          ? {
              id: sessionResult.session.sessionId,
              userId: sessionResult.session.userId,
              expiresAt: new Date(
                sessionResult.tokens.refreshTokenExpiresAt * 1000,
              ),
              createdAt: new Date(),
              ipAddress: null,
              userAgent: null,
              metadata: {},
            }
          : null,
        organization: sessionResult?.organization ?? null,
      };

      // Handle unauthenticated
      if (!sessionResult && redirectToSignIn) {
        const returnUrl = context.resolvedUrl;
        return {
          redirect: {
            destination: `${signInUrl}?returnUrl=${encodeURIComponent(returnUrl)}`,
            permanent: false,
          },
        };
      }

      // Handle organization requirement
      if (requireOrganization && sessionResult && !sessionResult.organization) {
        return {
          redirect: {
            destination: "/organizations/select",
            permanent: false,
          },
        };
      }

      // Call the wrapped function if provided
      if (getServerSidePropsFunc) {
        const result = await getServerSidePropsFunc(context, auth);

        // Merge auth props with result props
        if ("props" in result) {
          const props = await result.props;
          return {
            ...result,
            props: {
              ...props,
              ...auth,
            } as P & AuthProps,
          };
        }

        return result as GetServerSidePropsResult<P & AuthProps>;
      }

      // Return just auth props
      return {
        props: auth as P & AuthProps,
      };
    } catch (error) {
      console.error("[withAuthSSR] Error:", error);

      // Redirect to sign-in on error
      if (redirectToSignIn) {
        return {
          redirect: {
            destination: signInUrl,
            permanent: false,
          },
        };
      }

      return {
        props: {
          user: null,
          session: null,
          organization: null,
        } as P & AuthProps,
      };
    }
  };
}

/**
 * Creates a getServerSideProps function that redirects if not authenticated.
 * Simpler version when you don't need custom logic.
 */
export function requireAuth(options: WithAuthSSROptions = {}) {
  return withAuthSSR(undefined, { ...options, redirectToSignIn: true });
}

/**
 * Creates a getServerSideProps function that redirects if already authenticated.
 * Useful for sign-in/sign-up pages.
 */
export function redirectIfAuthenticated(
  redirectTo: string = "/",
): (
  context: GetServerSidePropsContext,
) => Promise<GetServerSidePropsResult<AuthProps>> {
  return async (context: GetServerSidePropsContext) => {
    try {
      const sessionResult = await getSessionFromRequest(context.req);

      if (sessionResult) {
        return {
          redirect: {
            destination: redirectTo,
            permanent: false,
          },
        };
      }

      return {
        props: {
          user: null,
          session: null,
          organization: null,
        },
      };
    } catch {
      return {
        props: {
          user: null,
          session: null,
          organization: null,
        },
      };
    }
  };
}
