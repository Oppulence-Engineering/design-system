/**
 * Standalone tRPC middleware for @oppulence/auth
 *
 * Use these for custom procedure composition.
 */

import { AuthError } from "../core/types";
import { hasRoleLevel } from "../core/constants";
import type { Permission, OrganizationRole } from "../core/types";
import type { AuthContext } from "./context";

// ============================================================================
// Types
// ============================================================================

/**
 * Middleware options type.
 */
interface MiddlewareOptions<TContext> {
  ctx: TContext;
  next: <TNewContext>(opts: { ctx: TNewContext }) => Promise<unknown>;
}

// ============================================================================
// Auth Middleware
// ============================================================================

/**
 * Middleware that requires authentication.
 * Throws if user is not authenticated.
 *
 * @example
 * ```ts
 * const isAuthed = t.middleware(authMiddleware);
 * const protectedProcedure = t.procedure.use(isAuthed);
 * ```
 */
export async function authMiddleware<TContext extends { auth: AuthContext }>(
  opts: MiddlewareOptions<TContext>
): Promise<unknown> {
  const { ctx, next } = opts;

  if (!ctx.auth?.isAuthenticated || !ctx.auth.user) {
    throw new AuthError("Authentication required", "SESSION_EXPIRED", 401);
  }

  return next({ ctx });
}

// ============================================================================
// Organization Middleware
// ============================================================================

/**
 * Middleware that requires an active organization.
 * Throws if no organization is selected.
 *
 * @example
 * ```ts
 * const hasOrg = t.middleware(orgMiddleware);
 * const orgProcedure = protectedProcedure.use(hasOrg);
 * ```
 */
export async function orgMiddleware<TContext extends { auth: AuthContext }>(
  opts: MiddlewareOptions<TContext>
): Promise<unknown> {
  const { ctx, next } = opts;

  if (!ctx.auth?.organization || !ctx.auth.membership) {
    throw new AuthError(
      "Organization selection required",
      "ORGANIZATION_NOT_FOUND",
      403
    );
  }

  return next({ ctx });
}

// ============================================================================
// Role Middleware Factory
// ============================================================================

/**
 * Creates middleware that requires a minimum role.
 *
 * @param role - Minimum required role
 * @returns Middleware function
 *
 * @example
 * ```ts
 * const isAdmin = t.middleware(roleMiddleware('admin'));
 * const adminProcedure = orgProcedure.use(isAdmin);
 * ```
 */
export function roleMiddleware(role: OrganizationRole) {
  return async function <TContext extends { auth: AuthContext }>(
    opts: MiddlewareOptions<TContext>
  ): Promise<unknown> {
    const { ctx, next } = opts;

    if (!ctx.auth?.membership) {
      throw new AuthError(
        "Organization membership required",
        "ORGANIZATION_MEMBERSHIP_NOT_FOUND",
        403
      );
    }

    if (!hasRoleLevel(ctx.auth.membership.role, role)) {
      throw new AuthError(
        `Role ${role} or higher required`,
        "PERMISSION_DENIED",
        403
      );
    }

    return next({ ctx });
  };
}

// ============================================================================
// Permission Middleware Factory
// ============================================================================

/**
 * Creates middleware that requires a specific permission.
 *
 * @param permission - Required permission
 * @returns Middleware function
 *
 * @example
 * ```ts
 * const canManageBilling = t.middleware(permissionMiddleware('billing:write'));
 * const billingProcedure = orgProcedure.use(canManageBilling);
 * ```
 */
export function permissionMiddleware(permission: Permission) {
  return async function <TContext extends { auth: AuthContext }>(
    opts: MiddlewareOptions<TContext>
  ): Promise<unknown> {
    const { ctx, next } = opts;

    if (!ctx.auth?.membership) {
      throw new AuthError(
        "Organization membership required",
        "ORGANIZATION_MEMBERSHIP_NOT_FOUND",
        403
      );
    }

    if (!ctx.auth.membership.permissions.includes(permission)) {
      throw new AuthError(
        `Permission ${permission} required`,
        "PERMISSION_DENIED",
        403
      );
    }

    return next({ ctx });
  };
}

// ============================================================================
// Combined Middleware Factory
// ============================================================================

/**
 * Creates middleware that requires multiple permissions (all must match).
 *
 * @param permissions - Required permissions
 * @returns Middleware function
 */
export function allPermissionsMiddleware(permissions: Permission[]) {
  return async function <TContext extends { auth: AuthContext }>(
    opts: MiddlewareOptions<TContext>
  ): Promise<unknown> {
    const { ctx, next } = opts;

    if (!ctx.auth?.membership) {
      throw new AuthError(
        "Organization membership required",
        "ORGANIZATION_MEMBERSHIP_NOT_FOUND",
        403
      );
    }

    const missing = permissions.filter(
      (p) => !ctx.auth.membership!.permissions.includes(p)
    );

    if (missing.length > 0) {
      throw new AuthError(
        `Missing permissions: ${missing.join(", ")}`,
        "PERMISSION_DENIED",
        403
      );
    }

    return next({ ctx });
  };
}

/**
 * Creates middleware that requires any of the specified permissions.
 *
 * @param permissions - Allowed permissions (any one will pass)
 * @returns Middleware function
 */
export function anyPermissionMiddleware(permissions: Permission[]) {
  return async function <TContext extends { auth: AuthContext }>(
    opts: MiddlewareOptions<TContext>
  ): Promise<unknown> {
    const { ctx, next } = opts;

    if (!ctx.auth?.membership) {
      throw new AuthError(
        "Organization membership required",
        "ORGANIZATION_MEMBERSHIP_NOT_FOUND",
        403
      );
    }

    const hasAny = permissions.some((p) =>
      ctx.auth.membership!.permissions.includes(p)
    );

    if (!hasAny) {
      throw new AuthError(
        `One of these permissions required: ${permissions.join(", ")}`,
        "PERMISSION_DENIED",
        403
      );
    }

    return next({ ctx });
  };
}
