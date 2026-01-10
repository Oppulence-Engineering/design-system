"use client";

/**
 * ProtectedRoute component for @oppulence/auth
 *
 * A wrapper component that protects content based on auth state.
 */

import * as React from "react";
import { Text } from "@oppulence/design-system";

import { useAuth, usePermissions } from "../hooks";
import type { Permission, OrganizationRole } from "../../core/types";

// ============================================================================
// Types
// ============================================================================

export interface ProtectedRouteProps {
  /**
   * Content to render when authorized.
   */
  children: React.ReactNode;

  /**
   * Content to render while loading auth state.
   * @default <LoadingFallback />
   */
  loadingFallback?: React.ReactNode;

  /**
   * Content to render when not authenticated.
   * @default null (redirects to sign-in)
   */
  unauthenticatedFallback?: React.ReactNode;

  /**
   * Content to render when authenticated but not authorized.
   * @default <UnauthorizedFallback />
   */
  unauthorizedFallback?: React.ReactNode;

  /**
   * Redirect to sign-in when not authenticated.
   * @default true
   */
  redirectToSignIn?: boolean;

  /**
   * URL to redirect to when not authenticated.
   * @default "/sign-in"
   */
  signInUrl?: string;

  /**
   * Require user to be in an organization.
   * @default false
   */
  requireOrganization?: boolean;

  /**
   * Required permission(s) to access.
   * If array, user must have ALL permissions.
   */
  requiredPermission?: Permission | Permission[];

  /**
   * Required role to access (user must have this role or higher).
   */
  requiredRole?: OrganizationRole;

  /**
   * Custom authorization check.
   */
  authorize?: () => boolean;

  /**
   * Callback when authorization fails.
   */
  onUnauthorized?: () => void;
}

// ============================================================================
// Loading Fallback
// ============================================================================

function LoadingFallback() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner />
        <Text size="sm" variant="muted">
          Loading...
        </Text>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="size-8 animate-spin text-muted-foreground"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ============================================================================
// Unauthorized Fallback
// ============================================================================

function UnauthorizedFallback() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-full bg-destructive/10 p-3">
          <ShieldIcon />
        </div>
        <div className="space-y-1">
          <Text size="lg" weight="semibold">
            Access Denied
          </Text>
          <Text size="sm" variant="muted">
            You don't have permission to view this content.
          </Text>
        </div>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      className="size-6 text-destructive"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

// ============================================================================
// ProtectedRoute Component
// ============================================================================

export function ProtectedRoute({
  children,
  loadingFallback,
  unauthenticatedFallback,
  unauthorizedFallback,
  redirectToSignIn = true,
  signInUrl = "/sign-in",
  requireOrganization = false,
  requiredPermission,
  requiredRole,
  authorize,
  onUnauthorized,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, organization } = useAuth();
  const { hasPermission, hasRole } = usePermissions();
  const [hasRedirected, setHasRedirected] = React.useState(false);

  // Check authorization
  const isAuthorized = React.useMemo(() => {
    if (!isAuthenticated) return false;

    // Check organization requirement
    if (requireOrganization && !organization) return false;

    // Check permission requirement
    if (requiredPermission) {
      const permissions = Array.isArray(requiredPermission)
        ? requiredPermission
        : [requiredPermission];

      if (!permissions.every((p) => hasPermission(p))) return false;
    }

    // Check role requirement
    if (requiredRole && !hasRole(requiredRole)) return false;

    // Custom authorization
    if (authorize && !authorize()) return false;

    return true;
  }, [
    isAuthenticated,
    organization,
    requireOrganization,
    requiredPermission,
    requiredRole,
    authorize,
    hasPermission,
    hasRole,
  ]);

  // Handle redirect
  React.useEffect(() => {
    if (isLoading || hasRedirected) return;

    if (!isAuthenticated && redirectToSignIn) {
      setHasRedirected(true);
      const returnUrl = typeof window !== "undefined" ? window.location.pathname : "/";
      const url = `${signInUrl}?returnUrl=${encodeURIComponent(returnUrl)}`;
      window.location.href = url;
    }
  }, [isAuthenticated, isLoading, redirectToSignIn, signInUrl, hasRedirected]);

  // Handle unauthorized callback
  React.useEffect(() => {
    if (!isLoading && isAuthenticated && !isAuthorized) {
      onUnauthorized?.();
    }
  }, [isLoading, isAuthenticated, isAuthorized, onUnauthorized]);

  // Loading state
  if (isLoading) {
    return <>{loadingFallback ?? <LoadingFallback />}</>;
  }

  // Not authenticated
  if (!isAuthenticated) {
    if (redirectToSignIn) {
      // Show loading while redirecting
      return <>{loadingFallback ?? <LoadingFallback />}</>;
    }
    return <>{unauthenticatedFallback ?? null}</>;
  }

  // Authenticated but not authorized
  if (!isAuthorized) {
    return <>{unauthorizedFallback ?? <UnauthorizedFallback />}</>;
  }

  // Authorized
  return <>{children}</>;
}

// ============================================================================
// HasPermission Component
// ============================================================================

export interface HasPermissionProps {
  /**
   * Required permission(s) to render children.
   * If array, user must have ALL permissions.
   */
  permission: Permission | Permission[];

  /**
   * Content to render when user has permission.
   */
  children: React.ReactNode;

  /**
   * Content to render when user doesn't have permission.
   * @default null
   */
  fallback?: React.ReactNode;
}

export function HasPermission({
  permission,
  children,
  fallback = null,
}: HasPermissionProps) {
  const { hasPermission } = usePermissions();

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAllPermissions = permissions.every((p) => hasPermission(p));

  if (!hasAllPermissions) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================================================
// HasRole Component
// ============================================================================

export interface HasRoleProps {
  /**
   * Required role (user must have this role or higher).
   */
  role: OrganizationRole;

  /**
   * Content to render when user has role.
   */
  children: React.ReactNode;

  /**
   * Content to render when user doesn't have role.
   * @default null
   */
  fallback?: React.ReactNode;
}

export function HasRole({ role, children, fallback = null }: HasRoleProps) {
  const { hasRole } = usePermissions();

  if (!hasRole(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
