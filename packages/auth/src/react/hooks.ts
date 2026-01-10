"use client";

/**
 * React hooks for @oppulence/auth
 *
 * Provides convenient hooks for accessing authentication state
 * and methods from any component.
 */

import { useContext, useMemo } from "react";
import { AuthContext, type AuthContextValue } from "./context";
import type {
  User,
  Session,
  Organization,
  OrganizationMembership,
  Permission,
  OrganizationRole,
} from "../core/types";

// ============================================================================
// Main Auth Hook
// ============================================================================

/**
 * Access the full authentication context.
 *
 * Returns all auth state, methods, and permission helpers.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, signOut } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <SignInForm />;
 *   }
 *
 *   return (
 *     <div>
 *       <p>Welcome, {user.email}</p>
 *       <button onClick={signOut}>Sign Out</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider. " +
        "Make sure your component is wrapped in <AuthProvider>."
    );
  }

  return context;
}

// ============================================================================
// Specialized Hooks
// ============================================================================

/**
 * Access only the current user.
 *
 * Use this when you only need user data and don't need other auth state.
 * This hook has a stable reference - it won't cause re-renders when
 * other auth state changes.
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const user = useUser();
 *
 *   if (!user) {
 *     return <p>Not signed in</p>;
 *   }
 *
 *   return (
 *     <div>
 *       <img src={user.profilePictureUrl} alt={user.firstName} />
 *       <h1>{user.firstName} {user.lastName}</h1>
 *       <p>{user.email}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

/**
 * Access only the current session.
 *
 * Use this when you need session metadata like expiration time.
 *
 * @example
 * ```tsx
 * function SessionInfo() {
 *   const session = useSession();
 *
 *   if (!session) return null;
 *
 *   return (
 *     <p>Session expires: {session.expiresAt.toLocaleDateString()}</p>
 *   );
 * }
 * ```
 */
export function useSession(): Session | null {
  const { session } = useAuth();
  return session;
}

/**
 * Access the active organization.
 *
 * Returns the currently selected organization and methods to switch organizations.
 *
 * @example
 * ```tsx
 * function OrgHeader() {
 *   const { organization, switchOrganization } = useOrganization();
 *
 *   if (!organization) {
 *     return <p>No organization selected</p>;
 *   }
 *
 *   return (
 *     <div>
 *       <img src={organization.logoUrl} alt={organization.name} />
 *       <h2>{organization.name}</h2>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOrganization(): {
  organization: Organization | null;
  membership: OrganizationMembership | null;
  switchOrganization: (organizationId: string) => Promise<void>;
  clearOrganization: () => Promise<void>;
} {
  const { organization, membership, switchOrganization, clearOrganization } = useAuth();

  return useMemo(
    () => ({
      organization,
      membership,
      switchOrganization,
      clearOrganization,
    }),
    [organization, membership, switchOrganization, clearOrganization]
  );
}

/**
 * Access all organizations the user belongs to.
 *
 * Useful for organization switchers and selection UI.
 *
 * @example
 * ```tsx
 * function OrgSwitcher() {
 *   const { organizations, organization, switchOrganization } = useOrganizations();
 *
 *   return (
 *     <select
 *       value={organization?.id}
 *       onChange={(e) => switchOrganization(e.target.value)}
 *     >
 *       {organizations.map((org) => (
 *         <option key={org.id} value={org.id}>
 *           {org.name}
 *         </option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 */
export function useOrganizations(): {
  organizations: Organization[];
  organization: Organization | null;
  switchOrganization: (organizationId: string) => Promise<void>;
} {
  const { organizations, organization, switchOrganization } = useAuth();

  return useMemo(
    () => ({
      organizations,
      organization,
      switchOrganization,
    }),
    [organizations, organization, switchOrganization]
  );
}

/**
 * Access the user's membership in the current organization.
 *
 * Includes role and permissions information.
 *
 * @example
 * ```tsx
 * function MembershipBadge() {
 *   const membership = useMembership();
 *
 *   if (!membership) return null;
 *
 *   return (
 *     <Badge variant={membership.role === 'owner' ? 'default' : 'secondary'}>
 *       {membership.role}
 *     </Badge>
 *   );
 * }
 * ```
 */
export function useMembership(): OrganizationMembership | null {
  const { membership } = useAuth();
  return membership;
}

/**
 * Access permission checking utilities.
 *
 * Provides methods to check user permissions and roles in the current organization.
 *
 * @example
 * ```tsx
 * function AdminPanel() {
 *   const { hasPermission, isAdmin, hasRole } = usePermissions();
 *
 *   if (!isAdmin) {
 *     return <p>Access denied</p>;
 *   }
 *
 *   return (
 *     <div>
 *       {hasPermission('billing:write') && <BillingSettings />}
 *       {hasRole('owner') && <DangerZone />}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePermissions(): {
  hasPermission: (permission: Permission) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasRole: (role: OrganizationRole) => boolean;
  isOwner: boolean;
  isAdmin: boolean;
  permissions: Permission[];
  role: OrganizationRole | null;
} {
  const {
    membership,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    hasRole,
    isOwner,
    isAdmin,
  } = useAuth();

  return useMemo(
    () => ({
      hasPermission,
      hasAllPermissions,
      hasAnyPermission,
      hasRole,
      isOwner,
      isAdmin,
      permissions: membership?.permissions ?? [],
      role: membership?.role ?? null,
    }),
    [
      membership,
      hasPermission,
      hasAllPermissions,
      hasAnyPermission,
      hasRole,
      isOwner,
      isAdmin,
    ]
  );
}

// ============================================================================
// Auth State Hooks
// ============================================================================

/**
 * Check if the user is authenticated.
 *
 * Returns a simple boolean and loading state.
 *
 * @example
 * ```tsx
 * function ProtectedPage() {
 *   const { isAuthenticated, isLoading } = useIsAuthenticated();
 *
 *   if (isLoading) {
 *     return <Spinner />;
 *   }
 *
 *   if (!isAuthenticated) {
 *     redirect('/sign-in');
 *   }
 *
 *   return <ProtectedContent />;
 * }
 * ```
 */
export function useIsAuthenticated(): {
  isAuthenticated: boolean;
  isLoading: boolean;
} {
  const { isAuthenticated, isLoading } = useAuth();

  return useMemo(
    () => ({
      isAuthenticated,
      isLoading,
    }),
    [isAuthenticated, isLoading]
  );
}

/**
 * Access the current auth error.
 *
 * @example
 * ```tsx
 * function AuthError() {
 *   const { error, clearError } = useAuthError();
 *
 *   if (!error) return null;
 *
 *   return (
 *     <Alert variant="destructive">
 *       <p>{error.message}</p>
 *       <button onClick={clearError}>Dismiss</button>
 *     </Alert>
 *   );
 * }
 * ```
 */
export function useAuthError(): {
  error: ReturnType<typeof useAuth>["error"];
  clearError: () => void;
} {
  const { error, clearError } = useAuth();

  return useMemo(
    () => ({
      error,
      clearError,
    }),
    [error, clearError]
  );
}

// ============================================================================
// Auth Action Hooks
// ============================================================================

/**
 * Access sign-in methods.
 *
 * @example
 * ```tsx
 * function SignInForm() {
 *   const { signIn, signInWithOAuth, isLoading } = useSignIn();
 *
 *   const handleSubmit = async (e) => {
 *     e.preventDefault();
 *     await signIn(email, password);
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {/* form fields *\/}
 *       <button disabled={isLoading}>Sign In</button>
 *       <button type="button" onClick={() => signInWithOAuth('google')}>
 *         Sign in with Google
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useSignIn(): {
  signIn: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: "google" | "github" | "microsoft") => void;
  isLoading: boolean;
  error: ReturnType<typeof useAuth>["error"];
} {
  const { signIn, signInWithOAuth, isLoading, error } = useAuth();

  return useMemo(
    () => ({
      signIn,
      signInWithOAuth,
      isLoading,
      error,
    }),
    [signIn, signInWithOAuth, isLoading, error]
  );
}

/**
 * Access sign-out method.
 *
 * @example
 * ```tsx
 * function SignOutButton() {
 *   const { signOut, isLoading } = useSignOut();
 *
 *   return (
 *     <button onClick={signOut} disabled={isLoading}>
 *       Sign Out
 *     </button>
 *   );
 * }
 * ```
 */
export function useSignOut(): {
  signOut: () => Promise<void>;
  isLoading: boolean;
} {
  const { signOut, isLoading } = useAuth();

  return useMemo(
    () => ({
      signOut,
      isLoading,
    }),
    [signOut, isLoading]
  );
}
