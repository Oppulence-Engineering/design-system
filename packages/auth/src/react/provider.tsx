"use client";

/**
 * AuthProvider component for @oppulence/auth
 *
 * Wraps your application to provide authentication state and methods
 * to all child components via React context.
 */

import * as React from "react";
import { AuthContext, type AuthContextValue, type AuthContextState } from "./context";
import { AUTH_ROUTES, SESSION_REFRESH_INTERVAL, ROLE_HIERARCHY, hasRoleLevel } from "../core/constants";
import type {
  User,
  Session,
  Organization,
  OrganizationMembership,
  AuthError as AuthErrorType,
  OAuthProvider,
  Permission,
  OrganizationRole,
} from "../core/types";
import { AuthError } from "../core/types";

// ============================================================================
// Provider Props
// ============================================================================

export interface AuthProviderProps {
  children: React.ReactNode;
  /**
   * Initial session data from server-side rendering.
   * Pass this to avoid a loading flash on initial render.
   */
  initialSession?: {
    user: User;
    session: Session;
    organization?: Organization | null;
    membership?: OrganizationMembership | null;
    organizations?: Organization[];
  } | null;
  /**
   * Callback when auth state changes.
   */
  onAuthStateChange?: (state: AuthContextState) => void;
  /**
   * Custom base URL for auth API routes.
   * Defaults to /api/auth.
   */
  apiBaseUrl?: string;
}

// ============================================================================
// API Client
// ============================================================================

async function authFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new AuthError(
      data.message || "Request failed",
      data.code || "UNKNOWN_ERROR",
      response.status
    );
  }

  return data as T;
}

// ============================================================================
// Provider Component
// ============================================================================

export function AuthProvider({
  children,
  initialSession,
  onAuthStateChange,
  apiBaseUrl = "/api/auth",
}: AuthProviderProps) {
  const hasInitialSession = initialSession !== undefined;
  // State
  const [user, setUser] = React.useState<User | null>(initialSession?.user ?? null);
  const [session, setSession] = React.useState<Session | null>(initialSession?.session ?? null);
  const [organization, setOrganization] = React.useState<Organization | null>(
    initialSession?.organization ?? null
  );
  const [membership, setMembership] = React.useState<OrganizationMembership | null>(
    initialSession?.membership ?? null
  );
  const [organizations, setOrganizations] = React.useState<Organization[]>(
    initialSession?.organizations ?? []
  );
  const [isLoading, setIsLoading] = React.useState(!hasInitialSession);
  const [error, setError] = React.useState<AuthErrorType | null>(null);

  // Derived state
  const isAuthenticated = !!user && !!session;

  // Refs
  const refreshIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // =========================================================================
  // Session Management
  // =========================================================================

  const fetchSession = React.useCallback(async () => {
    try {
      const data = await authFetch<{
        user: User | null;
        session: Session | null;
        organization: Organization | null;
        membership: OrganizationMembership | null;
        organizations: Organization[];
      }>(`${apiBaseUrl}/session`);

      setUser(data.user);
      setSession(data.session);
      setOrganization(data.organization);
      setMembership(data.membership);
      setOrganizations(data.organizations);
      setError(null);
    } catch (err) {
      // Session fetch failed - user is not authenticated
      setUser(null);
      setSession(null);
      setOrganization(null);
      setMembership(null);
      setOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  const refreshSession = React.useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      await authFetch(`${apiBaseUrl}/refresh`, { method: "POST" });
      // Session cookie is updated automatically
    } catch {
      // Refresh failed - session may have expired
      await fetchSession();
    }
  }, [apiBaseUrl, isAuthenticated, fetchSession]);

  // Initial session fetch
  React.useEffect(() => {
    if (!hasInitialSession) {
      fetchSession();
    }
  }, [hasInitialSession, fetchSession]);

  // Session refresh interval
  React.useEffect(() => {
    if (isAuthenticated) {
      refreshIntervalRef.current = setInterval(refreshSession, SESSION_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, refreshSession]);

  // Refresh on window focus
  React.useEffect(() => {
    const handleFocus = () => {
      if (isAuthenticated) {
        refreshSession();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [isAuthenticated, refreshSession]);

  // Auth state change callback
  React.useEffect(() => {
    onAuthStateChange?.({
      user,
      session,
      organization,
      membership,
      organizations,
      isAuthenticated,
      isLoading,
      error,
    });
  }, [user, session, organization, membership, organizations, isAuthenticated, isLoading, error, onAuthStateChange]);

  // =========================================================================
  // Auth Methods
  // =========================================================================

  const signIn = React.useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await authFetch<{
          user: User;
          session: Session;
          organizations: Organization[];
        }>(`${apiBaseUrl}/sign-in`, {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });

        setUser(data.user);
        setSession(data.session);
        setOrganizations(data.organizations);

        // Auto-select first organization if multi-tenant
        if (data.organizations.length === 1) {
          const org = data.organizations[0];
          if (org) {
            await switchOrganization(org.id);
          }
        }
      } catch (err) {
        const authError = AuthError.from(err);
        setError(authError);
        throw authError;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const signUp = React.useCallback(
    async (
      email: string,
      password: string,
      options?: { firstName?: string; lastName?: string }
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        await authFetch(`${apiBaseUrl}/sign-up`, {
          method: "POST",
          body: JSON.stringify({ email, password, ...options }),
        });

        // Don't auto-sign-in - require email verification
      } catch (err) {
        const authError = AuthError.from(err);
        setError(authError);
        throw authError;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const signOut = React.useCallback(async () => {
    setIsLoading(true);

    try {
      await authFetch(`${apiBaseUrl}/sign-out`, { method: "POST" });
    } finally {
      setUser(null);
      setSession(null);
      setOrganization(null);
      setMembership(null);
      setOrganizations([]);
      setError(null);
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  const signInWithOAuth = React.useCallback(
    (provider: OAuthProvider) => {
      // Generate state for CSRF protection
      const state = crypto.randomUUID();
      sessionStorage.setItem("oauth_state", state);

      // Redirect to OAuth authorization
      window.location.href = `${apiBaseUrl}/callback?provider=${provider}&state=${state}`;
    },
    [apiBaseUrl]
  );

  const forgotPassword = React.useCallback(
    async (email: string) => {
      setError(null);

      try {
        await authFetch(`${apiBaseUrl}/forgot-password`, {
          method: "POST",
          body: JSON.stringify({ email }),
        });
      } catch (err) {
        // Don't reveal if email exists
        // Always succeed from user perspective
      }
    },
    [apiBaseUrl]
  );

  const resetPassword = React.useCallback(
    async (token: string, newPassword: string) => {
      setError(null);

      try {
        await authFetch(`${apiBaseUrl}/reset-password`, {
          method: "POST",
          body: JSON.stringify({ token, newPassword }),
        });
      } catch (err) {
        const authError = AuthError.from(err);
        setError(authError);
        throw authError;
      }
    },
    [apiBaseUrl]
  );

  const sendVerificationEmail = React.useCallback(async () => {
    if (!user) {
      throw new AuthError("Not authenticated", "INVALID_TOKEN", 401);
    }

    try {
      await authFetch(`${apiBaseUrl}/verify-email`, {
        method: "POST",
        body: JSON.stringify({ action: "send" }),
      });
    } catch (err) {
      const authError = AuthError.from(err);
      setError(authError);
      throw authError;
    }
  }, [apiBaseUrl, user]);

  const verifyEmail = React.useCallback(
    async (code: string) => {
      try {
        const data = await authFetch<{
          user: User;
          session: Session;
        }>(`${apiBaseUrl}/verify-email`, {
          method: "POST",
          body: JSON.stringify({ action: "verify", code }),
        });

        setUser(data.user);
        setSession(data.session);
      } catch (err) {
        const authError = AuthError.from(err);
        setError(authError);
        throw authError;
      }
    },
    [apiBaseUrl]
  );

  const switchOrganization = React.useCallback(
    async (organizationId: string) => {
      try {
        const data = await authFetch<{
          organization: Organization;
          membership: OrganizationMembership;
        }>(`${apiBaseUrl}/org/switch`, {
          method: "POST",
          body: JSON.stringify({ organizationId }),
        });

        setOrganization(data.organization);
        setMembership(data.membership);
      } catch (err) {
        const authError = AuthError.from(err);
        setError(authError);
        throw authError;
      }
    },
    [apiBaseUrl]
  );

  const clearOrganization = React.useCallback(async () => {
    try {
      await authFetch(`${apiBaseUrl}/org/switch`, {
        method: "POST",
        body: JSON.stringify({ organizationId: null }),
      });

      setOrganization(null);
      setMembership(null);
    } catch (err) {
      const authError = AuthError.from(err);
      setError(authError);
      throw authError;
    }
  }, [apiBaseUrl]);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  // =========================================================================
  // MFA Methods
  // =========================================================================

  const enrollMFA = React.useCallback(async () => {
    try {
      const data = await authFetch<{ qrCodeUrl: string; secret: string }>(
        `${apiBaseUrl}/mfa/enroll`,
        { method: "POST" }
      );
      return data;
    } catch (err) {
      const authError = AuthError.from(err);
      setError(authError);
      throw authError;
    }
  }, [apiBaseUrl]);

  const verifyMFAEnrollment = React.useCallback(
    async (code: string) => {
      try {
        const data = await authFetch<{ backupCodes: string[] }>(
          `${apiBaseUrl}/mfa/verify`,
          {
            method: "POST",
            body: JSON.stringify({ code, action: "enroll" }),
          }
        );
        return data;
      } catch (err) {
        const authError = AuthError.from(err);
        setError(authError);
        throw authError;
      }
    },
    [apiBaseUrl]
  );

  const verifyMFA = React.useCallback(
    async (
      challengeId: string,
      code: string,
      method: "totp" | "sms" | "backup",
      rememberDevice?: boolean
    ) => {
      setIsLoading(true);
      try {
        const data = await authFetch<{
          user: User;
          session: Session;
          organizations: Organization[];
        }>(`${apiBaseUrl}/mfa/verify`, {
          method: "POST",
          body: JSON.stringify({
            challengeId,
            code,
            method,
            rememberDevice,
            action: "challenge",
          }),
        });

        setUser(data.user);
        setSession(data.session);
        setOrganizations(data.organizations);
      } catch (err) {
        const authError = AuthError.from(err);
        setError(authError);
        throw authError;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const sendMFASMS = React.useCallback(
    async (challengeId: string) => {
      try {
        await authFetch(`${apiBaseUrl}/mfa/sms`, {
          method: "POST",
          body: JSON.stringify({ challengeId }),
        });
      } catch (err) {
        const authError = AuthError.from(err);
        setError(authError);
        throw authError;
      }
    },
    [apiBaseUrl]
  );

  // Aliases for component compatibility
  const requestPasswordReset = forgotPassword;

  const resendVerificationEmail = React.useCallback(
    async (email: string) => {
      try {
        await authFetch(`${apiBaseUrl}/verify-email`, {
          method: "POST",
          body: JSON.stringify({ action: "resend", email }),
        });
      } catch (err) {
        const authError = AuthError.from(err);
        setError(authError);
        throw authError;
      }
    },
    [apiBaseUrl]
  );

  // =========================================================================
  // Permission Helpers
  // =========================================================================

  const hasPermission = React.useCallback(
    (permission: Permission): boolean => {
      if (!membership) return false;
      return membership.permissions.includes(permission);
    },
    [membership]
  );

  const hasAllPermissions = React.useCallback(
    (permissions: Permission[]): boolean => {
      if (!membership) return false;
      return permissions.every((p) => membership.permissions.includes(p));
    },
    [membership]
  );

  const hasAnyPermission = React.useCallback(
    (permissions: Permission[]): boolean => {
      if (!membership) return false;
      return permissions.some((p) => membership.permissions.includes(p));
    },
    [membership]
  );

  const hasRole = React.useCallback(
    (role: OrganizationRole): boolean => {
      if (!membership) return false;
      return hasRoleLevel(membership.role, role);
    },
    [membership]
  );

  const isOwner = membership?.role === "owner";
  const isAdmin = membership?.role === "admin" || membership?.role === "owner";

  // =========================================================================
  // Context Value
  // =========================================================================

  const contextValue: AuthContextValue = React.useMemo(
    () => ({
      // State
      user,
      session,
      organization,
      membership,
      organizations,
      isAuthenticated,
      isLoading,
      error,

      // Methods
      signIn,
      signUp,
      signOut,
      signInWithOAuth,
      forgotPassword,
      resetPassword,
      sendVerificationEmail,
      verifyEmail,
      switchOrganization,
      clearOrganization,
      refreshSession,
      clearError,

      // MFA Methods
      enrollMFA,
      verifyMFAEnrollment,
      verifyMFA,
      sendMFASMS,
      resendVerificationEmail,
      requestPasswordReset,

      // Permissions
      hasPermission,
      hasAllPermissions,
      hasAnyPermission,
      hasRole,
      isOwner,
      isAdmin,
    }),
    [
      user,
      session,
      organization,
      membership,
      organizations,
      isAuthenticated,
      isLoading,
      error,
      signIn,
      signUp,
      signOut,
      signInWithOAuth,
      forgotPassword,
      resetPassword,
      sendVerificationEmail,
      verifyEmail,
      switchOrganization,
      clearOrganization,
      refreshSession,
      clearError,
      enrollMFA,
      verifyMFAEnrollment,
      verifyMFA,
      sendMFASMS,
      resendVerificationEmail,
      requestPasswordReset,
      hasPermission,
      hasAllPermissions,
      hasAnyPermission,
      hasRole,
      isOwner,
      isAdmin,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
