/**
 * @oppulence/auth - Main exports
 *
 * Enterprise-grade authentication built on WorkOS with custom UI components.
 *
 * @example
 * ```tsx
 * import {
 *   AuthProvider,
 *   useAuth,
 *   useUser,
 *   SignInForm,
 *   UserMenu,
 * } from '@oppulence/auth';
 * ```
 */

// ============================================================================
// React Hooks
// ============================================================================

export {
  useAuth,
  useUser,
  useSession,
  useOrganization,
  useOrganizations,
  useMembership,
  usePermissions,
  useIsAuthenticated,
  useAuthError,
  useSignIn,
  useSignOut,
} from "./react/hooks";

// ============================================================================
// React Provider
// ============================================================================

export { AuthProvider, type AuthProviderProps } from "./react/provider";

// ============================================================================
// React Context (advanced usage)
// ============================================================================

export {
  AuthContext,
  type AuthContextValue,
  type AuthContextState,
  type AuthContextMethods,
  type AuthContextPermissions,
} from "./react/context";

// ============================================================================
// Form Schemas
// ============================================================================

export {
  // Schemas
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  mfaEnrollSchema,
  mfaChallengeSchema,
  magicLinkSchema,
  // Field schemas
  emailSchema,
  passwordSchema,
  nameSchema,
  otpCodeSchema,
  // Types
  type SignInFormData,
  type SignUpFormData,
  type ForgotPasswordFormData,
  type ResetPasswordFormData,
  type VerifyEmailFormData,
  type MFAEnrollFormData,
  type MFAChallengeFormData,
  type MagicLinkFormData,
  // Password strength utilities
  evaluatePasswordStrength,
  getPasswordStrengthMessage,
  getPasswordStrengthColor,
  isValidEmail,
  isValidPassword,
  getPasswordErrors,
  type PasswordStrength,
  type PasswordStrengthResult,
} from "./react/schemas";

// ============================================================================
// Types
// ============================================================================

export type {
  // User types
  User,
  // Session types
  Session,
  SessionTokens,
  // Organization types
  Organization,
  OrganizationRole,
  OrganizationMembership,
  Permission,
  // Auth types
  AuthState,
  AuthConfig,
  ResolvedAuthConfig,
  AuthStrategy,
  OAuthProvider,
  // MFA types
  MFAFactorType,
  MFAEnrollmentChallenge,
  MFAChallengeData,
  // Error types
  AuthErrorCode,
  // Webhook types
  WorkOSWebhookEvent,
  WorkOSWebhookPayload,
} from "./core/types";

// Export AuthError as both type and value
export { AuthError } from "./core/types";

// ============================================================================
// Constants
// ============================================================================

export {
  DEFAULT_CONFIG,
  AUTH_ROUTES,
  OAUTH_PROVIDER_NAMES,
  ROLE_HIERARCHY,
  getRoleLevel,
  hasRoleLevel,
} from "./core/constants";

// ============================================================================
// React Components
// ============================================================================

export {
  SignInForm,
  type SignInFormProps,
} from "./react/components/SignInForm";
export {
  SignUpForm,
  type SignUpFormProps,
} from "./react/components/SignUpForm";
export {
  SignOutButton,
  type SignOutButtonProps,
} from "./react/components/SignOutButton";
export { UserMenu, type UserMenuProps } from "./react/components/UserMenu";
export {
  OrgSwitcher,
  type OrgSwitcherProps,
} from "./react/components/OrgSwitcher";
export {
  ProtectedRoute,
  type ProtectedRouteProps,
  HasPermission,
  type HasPermissionProps,
  HasRole,
  type HasRoleProps,
} from "./react/components/ProtectedRoute";

// Password Reset Components
export {
  ForgotPasswordForm,
  type ForgotPasswordFormProps,
} from "./react/components/ForgotPasswordForm";
export {
  ResetPasswordForm,
  type ResetPasswordFormProps,
} from "./react/components/ResetPasswordForm";

// Email Verification
export {
  VerifyEmailForm,
  type VerifyEmailFormProps,
} from "./react/components/VerifyEmailForm";

// MFA Components
export {
  MFAEnrollment,
  type MFAEnrollmentProps,
} from "./react/components/MFAEnrollment";
export {
  MFAChallenge,
  type MFAChallengeProps,
} from "./react/components/MFAChallenge";

// Form Base & Utilities
export {
  AuthFormBase,
  type AuthFormBaseProps,
  AuthDivider,
  AuthFooterLink,
  AuthBranding,
} from "./react/components/AuthFormBase";

// Social/OAuth Buttons
export {
  SocialButton,
  type SocialButtonProps,
  SocialButtonGroup,
  type SocialButtonGroupProps,
  SUPPORTED_PROVIDERS,
  isProviderSupported,
} from "./react/components/SocialButton";
