/**
 * @oppulence/auth/nextjs - Next.js integration
 *
 * Provides middleware, server utilities, and API handlers for Next.js.
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { authMiddleware } from '@oppulence/auth/nextjs';
 *
 * export default authMiddleware({
 *   publicRoutes: ['/sign-in', '/sign-up'],
 * });
 *
 * // app/api/auth/[...auth]/route.ts
 * import { createAuthHandler } from '@oppulence/auth/nextjs';
 *
 * const handler = createAuthHandler();
 * export { handler as GET, handler as POST };
 * ```
 */

// ============================================================================
// Middleware
// ============================================================================

export {
  authMiddleware,
  type AuthMiddlewareConfig,
  type MiddlewareAuth,
} from "./nextjs/middleware";

// ============================================================================
// Server Utilities
// ============================================================================

export {
  getSession,
  getUser,
  getOrganization,
  getMembership,
  requireAuth,
  requireOrg,
  requirePermission,
  requireRole,
} from "./nextjs/server";

// ============================================================================
// API Handler
// ============================================================================

export {
  createAuthHandler,
  type AuthHandlerConfig,
} from "./nextjs/handler";

// ============================================================================
// Cookie Utilities (for advanced usage)
// ============================================================================

export {
  getSessionFromNextCookies,
  setSessionInNextCookies,
  clearSessionInNextCookies,
  getSessionFromNextRequest,
  setSessionInNextResponse,
  clearSessionFromNextResponse,
} from "./core/cookies";

// ============================================================================
// Session Utilities (for advanced usage)
// ============================================================================

export {
  createSession,
  resolveSession,
  getValidSession,
  updateSessionOrganization,
  getSessionMetadata,
  sessionNeedsRefresh,
  type ResolvedSession,
} from "./core/session";

// ============================================================================
// Pages Router HOCs
// ============================================================================

export {
  // API Route HOCs
  withAuth,
  withAdmin,
  withOwner,
  withOrganization,
  // SSR HOCs
  withAuthSSR,
  requireAuth as requireAuthSSR,
  redirectIfAuthenticated,
  // Types
  type AuthenticatedRequest,
  type WithAuthOptions,
  type WithAuthSSROptions,
  type AuthProps,
} from "./nextjs/with-auth";
