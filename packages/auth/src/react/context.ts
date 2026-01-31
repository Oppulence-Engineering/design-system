"use client";

/**
 * React context for @oppulence/auth
 *
 * Provides authentication state to React components via context.
 * Use the useAuth() hook to access this context.
 */

import { createContext } from "react";
import type {
  User,
  Session,
  Organization,
  OrganizationMembership,
  AuthError,
  OAuthProvider,
  Permission,
  OrganizationRole,
} from "../core/types";

// ============================================================================
// Auth State Types
// ============================================================================

/**
 * Authentication state exposed through context.
 */
export interface AuthContextState {
  /** Current authenticated user (null if not authenticated) */
  user: User | null;
  /** Current session (null if not authenticated) */
  session: Session | null;
  /** Active organization (null if none selected) */
  organization: Organization | null;
  /** User's membership in the active organization */
  membership: OrganizationMembership | null;
  /** List of organizations the user belongs to */
  organizations: Organization[];
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether auth state is being loaded/hydrated */
  isLoading: boolean;
  /** Current auth error (null if none) */
  error: AuthError | null;
}

/**
 * Authentication methods exposed through context.
 */
export interface AuthContextMethods {
  /**
   * Signs in with email and password.
   */
  signIn: (email: string, password: string) => Promise<void>;

  /**
   * Signs up with email and password.
   */
  signUp: (
    email: string,
    password: string,
    options?: { firstName?: string; lastName?: string }
  ) => Promise<void>;

  /**
   * Signs out the current user.
   */
  signOut: () => Promise<void>;

  /**
   * Initiates OAuth sign-in with a provider.
   * Redirects to the provider's authorization page.
   */
  signInWithOAuth: (provider: OAuthProvider) => void;

  /**
   * Requests a password reset email.
   */
  forgotPassword: (email: string) => Promise<void>;

  /**
   * Resets password with a token.
   */
  resetPassword: (token: string, newPassword: string) => Promise<void>;

  /**
   * Sends a verification email to the current user.
   */
  sendVerificationEmail: () => Promise<void>;

  /**
   * Verifies the current user's email with a code.
   */
  verifyEmail: (code: string) => Promise<void>;

  /**
   * Switches the active organization.
   */
  switchOrganization: (organizationId: string) => Promise<void>;

  /**
   * Clears the active organization.
   */
  clearOrganization: () => Promise<void>;

  /**
   * Refreshes the current session.
   */
  refreshSession: () => Promise<void>;

  /**
   * Clears the current error.
   */
  clearError: () => void;

  // ========================================================================
  // MFA Methods
  // ========================================================================

  /**
   * Starts MFA enrollment and returns QR code URL and secret.
   */
  enrollMFA: () => Promise<{ qrCodeUrl: string; secret: string }>;

  /**
   * Verifies MFA enrollment with a TOTP code.
   * Returns backup codes on success.
   */
  verifyMFAEnrollment: (code: string) => Promise<{ backupCodes: string[] }>;

  /**
   * Verifies MFA challenge during sign-in.
   */
  verifyMFA: (
    challengeId: string,
    code: string,
    method: "totp" | "sms" | "backup",
    rememberDevice?: boolean
  ) => Promise<void>;

  /**
   * Sends an SMS code for MFA challenge.
   */
  sendMFASMS: (challengeId: string) => Promise<void>;

  /**
   * Resends verification email (alias for sendVerificationEmail with email param).
   */
  resendVerificationEmail: (email: string) => Promise<void>;

  /**
   * Alias for forgotPassword for component compatibility.
   */
  requestPasswordReset: (email: string) => Promise<void>;
}

/**
 * Permission checking utilities exposed through context.
 */
export interface AuthContextPermissions {
  /**
   * Checks if the user has a specific permission.
   */
  hasPermission: (permission: Permission) => boolean;

  /**
   * Checks if the user has all of the specified permissions.
   */
  hasAllPermissions: (permissions: Permission[]) => boolean;

  /**
   * Checks if the user has any of the specified permissions.
   */
  hasAnyPermission: (permissions: Permission[]) => boolean;

  /**
   * Checks if the user has at least the specified role level.
   */
  hasRole: (role: OrganizationRole) => boolean;

  /**
   * Checks if the user is the owner of the current organization.
   */
  isOwner: boolean;

  /**
   * Checks if the user is an admin of the current organization.
   */
  isAdmin: boolean;
}

/**
 * Complete auth context value.
 */
export interface AuthContextValue
  extends AuthContextState,
    AuthContextMethods,
    AuthContextPermissions {}

// ============================================================================
// Context Definition
// ============================================================================

/**
 * Default context value for uninitialized state.
 * Methods throw errors when called without a provider.
 */
const defaultContextValue: AuthContextValue = {
  // State
  user: null,
  session: null,
  organization: null,
  membership: null,
  organizations: [],
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Methods (throw if used without provider)
  signIn: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  signUp: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  signOut: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  signInWithOAuth: () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  forgotPassword: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  resetPassword: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  sendVerificationEmail: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  verifyEmail: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  switchOrganization: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  clearOrganization: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  refreshSession: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  clearError: () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  enrollMFA: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  verifyMFAEnrollment: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  verifyMFA: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  sendMFASMS: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  resendVerificationEmail: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },
  requestPasswordReset: async () => {
    throw new Error("AuthProvider not found. Wrap your app in <AuthProvider>.");
  },

  // Permissions (default to false/no access)
  hasPermission: () => false,
  hasAllPermissions: () => false,
  hasAnyPermission: () => false,
  hasRole: () => false,
  isOwner: false,
  isAdmin: false,
};

/**
 * React context for authentication state and methods.
 */
export const AuthContext = createContext<AuthContextValue>(defaultContextValue);

/**
 * Display name for React DevTools.
 */
AuthContext.displayName = "AuthContext";
