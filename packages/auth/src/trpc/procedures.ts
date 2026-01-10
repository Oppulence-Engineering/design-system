/**
 * tRPC procedure builders for @oppulence/auth
 *
 * Creates pre-configured procedures with auth enforcement.
 */

import { AuthError } from "../core/types";
import type {
  User,
  Session,
  Organization,
  OrganizationMembership,
  Permission,
  OrganizationRole,
} from "../core/types";
import type { AuthContext } from "./context";

// ============================================================================
// Types
// ============================================================================

/**
 * tRPC instance type.
 * We accept any tRPC instance to avoid version coupling.
 */
interface TRPCInstance {
  middleware: <T>(fn: MiddlewareFn<T>) => unknown;
  procedure: {
    use: (middleware: unknown) => unknown;
  };
}

/**
 * Middleware function type.
 */
type MiddlewareFn<T> = (opts: {
  ctx: { auth: AuthContext };
  next: (opts: { ctx: T }) => Promise<unknown>;
}) => Promise<unknown>;

/**
 * Context with guaranteed user.
 */
export interface ProtectedContext {
  auth: AuthContext & {
    user: User;
    session: Session;
    isAuthenticated: true;
  };
}

/**
 * Context with guaranteed organization.
 */
export interface OrgContext extends ProtectedContext {
  auth: ProtectedContext["auth"] & {
    organization: Organization;
    membership: OrganizationMembership;
  };
}

/**
 * Procedure builders returned by createAuthProcedures.
 */
export interface AuthProcedureBuilders<T extends TRPCInstance> {
  /**
   * Procedure that requires authentication.
   * Context will have user and session guaranteed.
   */
  protectedProcedure: unknown;

  /**
   * Procedure that requires an active organization.
   * Context will have organization and membership guaranteed.
   */
  orgProcedure: unknown;

  /**
   * Procedure that requires admin role.
   */
  adminProcedure: unknown;

  /**
   * Procedure that requires member role or higher.
   */
  memberProcedure: unknown;

  /**
   * Creates a procedure that requires a specific permission.
   */
  permissionProcedure: (permission: Permission) => unknown;
}

// ============================================================================
// Procedure Factory
// ============================================================================

/**
 * Creates auth-aware procedure builders.
 *
 * @param t - Your tRPC instance (from initTRPC)
 * @returns Object with procedure builders
 *
 * @example
 * ```ts
 * // server/trpc/trpc.ts
 * import { initTRPC } from '@trpc/server';
 * import { createAuthProcedures } from '@oppulence/auth/trpc';
 *
 * const t = initTRPC.context<Context>().create();
 *
 * const {
 *   protectedProcedure,
 *   orgProcedure,
 *   adminProcedure,
 *   permissionProcedure,
 * } = createAuthProcedures(t);
 *
 * // Usage in routers:
 * export const userRouter = router({
 *   me: protectedProcedure.query(({ ctx }) => {
 *     // ctx.auth.user is guaranteed to exist
 *     return ctx.auth.user;
 *   }),
 *
 *   orgSettings: orgProcedure.query(({ ctx }) => {
 *     // ctx.auth.organization is guaranteed
 *     return ctx.auth.organization;
 *   }),
 *
 *   billing: permissionProcedure('billing:read').query(({ ctx }) => {
 *     // Permission already verified
 *   }),
 * });
 * ```
 */
export function createAuthProcedures<T extends TRPCInstance>(
  t: T
): AuthProcedureBuilders<T> {
  // Auth required middleware
  const isAuthenticated = t.middleware(async ({ ctx, next }) => {
    if (!ctx.auth?.isAuthenticated || !ctx.auth.user || !ctx.auth.session) {
      throw new AuthError("Authentication required", "SESSION_EXPIRED", 401);
    }

    return next({
      ctx: {
        ...ctx,
        auth: ctx.auth as ProtectedContext["auth"],
      },
    });
  });

  // Organization required middleware
  const hasOrganization = t.middleware(async ({ ctx, next }) => {
    const auth = ctx.auth as ProtectedContext["auth"];

    if (!auth.organization || !auth.membership) {
      throw new AuthError(
        "Organization selection required",
        "ORGANIZATION_NOT_FOUND",
        403
      );
    }

    return next({
      ctx: {
        ...ctx,
        auth: auth as OrgContext["auth"],
      },
    });
  });

  // Role check middleware factory
  const hasRole = (role: OrganizationRole) =>
    t.middleware(async ({ ctx, next }) => {
      const auth = ctx.auth as OrgContext["auth"];

      if (!auth.hasRole(role)) {
        throw new AuthError(
          `Role ${role} or higher required`,
          "PERMISSION_DENIED",
          403
        );
      }

      return next({ ctx });
    });

  // Permission check middleware factory
  const hasPermission = (permission: Permission) =>
    t.middleware(async ({ ctx, next }) => {
      const auth = ctx.auth as OrgContext["auth"];

      if (!auth.hasPermission(permission)) {
        throw new AuthError(
          `Permission ${permission} required`,
          "PERMISSION_DENIED",
          403
        );
      }

      return next({ ctx });
    });

  // Build procedures
  const protectedProcedure = (t.procedure as any).use(isAuthenticated);
  const orgProcedure = protectedProcedure.use(hasOrganization);
  const adminProcedure = orgProcedure.use(hasRole("admin"));
  const memberProcedure = orgProcedure.use(hasRole("member"));

  return {
    protectedProcedure,
    orgProcedure,
    adminProcedure,
    memberProcedure,
    permissionProcedure: (permission: Permission) =>
      orgProcedure.use(hasPermission(permission)),
  };
}
