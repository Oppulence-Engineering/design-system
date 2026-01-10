"use client";

/**
 * SignInForm component for @oppulence/auth
 *
 * A complete sign-in form with email/password and OAuth support.
 * Uses @oppulence/design-system components with react-hook-form.
 */

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@oppulence/design-system";
import {
  Button,
  Input,
  Checkbox,
  Separator,
  Stack,
  Text,
} from "@oppulence/design-system";
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldError,
} from "@oppulence/design-system";
import { Alert, AlertDescription } from "@oppulence/design-system";

import { useAuth } from "../hooks";
import { signInSchema, type SignInFormData } from "../schemas";
import type { User, OAuthProvider } from "../../core/types";
import { OAUTH_PROVIDER_NAMES } from "../../core/constants";

// ============================================================================
// Types
// ============================================================================

export interface SignInFormProps {
  /**
   * OAuth providers to display.
   * @default ["google", "github"]
   */
  providers?: OAuthProvider[];

  /**
   * Show email/password form.
   * @default true
   */
  showEmailPassword?: boolean;

  /**
   * Show magic link option.
   * @default false
   */
  showMagicLink?: boolean;

  /**
   * Show "Remember me" checkbox.
   * @default true
   */
  showRememberMe?: boolean;

  /**
   * Show "Forgot password" link.
   * @default true
   */
  showForgotPassword?: boolean;

  /**
   * Show sign-up link.
   * @default true
   */
  showSignUpLink?: boolean;

  /**
   * Callback on successful sign-in.
   */
  onSuccess?: (user: User) => void;

  /**
   * Callback on error.
   */
  onError?: (error: Error) => void;

  /**
   * URL to redirect after success.
   * Overrides default afterSignInUrl.
   */
  redirectTo?: string;

  /**
   * URL for forgot password link.
   * @default "/forgot-password"
   */
  forgotPasswordUrl?: string;

  /**
   * URL for sign-up link.
   * @default "/sign-up"
   */
  signUpUrl?: string;

  /**
   * Display mode.
   * - "page": Standalone page layout
   * - "modal": Compact modal layout
   * @default "page"
   */
  mode?: "page" | "modal";

  /**
   * Custom header content.
   */
  header?: React.ReactNode;

  /**
   * Custom footer content.
   */
  footer?: React.ReactNode;
}

// ============================================================================
// OAuth Button Component
// ============================================================================

interface OAuthButtonProps {
  provider: OAuthProvider;
  onClick: () => void;
  disabled?: boolean;
}

function OAuthButton({ provider, onClick, disabled }: OAuthButtonProps) {
  const icons: Record<OAuthProvider, React.ReactNode> = {
    google: (
      <svg className="size-4" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
    github: (
      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
    microsoft: (
      <svg className="size-4" viewBox="0 0 23 23" fill="none">
        <path fill="#f35325" d="M1 1h10v10H1z" />
        <path fill="#81bc06" d="M12 1h10v10H12z" />
        <path fill="#05a6f0" d="M1 12h10v10H1z" />
        <path fill="#ffba08" d="M12 12h10v10H12z" />
      </svg>
    ),
  };

  return (
    <Button
      variant="outline"
      width="full"
      onClick={onClick}
      disabled={disabled}
      iconLeft={icons[provider]}
    >
      Continue with {OAUTH_PROVIDER_NAMES[provider]}
    </Button>
  );
}

// ============================================================================
// SignInForm Component
// ============================================================================

export function SignInForm({
  providers = ["google", "github"],
  showEmailPassword = true,
  showMagicLink = false,
  showRememberMe = true,
  showForgotPassword = true,
  showSignUpLink = true,
  onSuccess,
  onError,
  redirectTo,
  forgotPasswordUrl = "/forgot-password",
  signUpUrl = "/sign-up",
  mode = "page",
  header,
  footer,
}: SignInFormProps) {
  const { signIn, signInWithOAuth, isLoading, error, clearError } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: SignInFormData) => {
    setIsSubmitting(true);
    clearError();

    try {
      await signIn(data.email, data.password);
      // If we get here, sign-in was successful
      // The auth context will have the user
      // onSuccess callback will be called by the parent
      if (redirectTo) {
        window.location.href = redirectTo;
      }
    } catch (err) {
      onError?.(err as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuth = (provider: OAuthProvider) => {
    clearError();
    signInWithOAuth(provider);
  };

  const isDisabled = isLoading || isSubmitting;

  const formContent = (
    <Stack gap="lg">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* OAuth Providers */}
      {providers.length > 0 && (
        <Stack gap="sm">
          {providers.map((provider) => (
            <OAuthButton
              key={provider}
              provider={provider}
              onClick={() => handleOAuth(provider)}
              disabled={isDisabled}
            />
          ))}
        </Stack>
      )}

      {/* Divider */}
      {providers.length > 0 && showEmailPassword && (
        <div className="relative">
          <Separator />
          <span className="bg-background text-muted-foreground absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-xs">
            or continue with email
          </span>
        </div>
      )}

      {/* Email/Password Form */}
      {showEmailPassword && (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack gap="md">
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <FieldContent>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={isDisabled}
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </FieldContent>
              {errors.email && (
                <FieldError errors={[{ message: errors.email.message }]} />
              )}
            </Field>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                {showForgotPassword && (
                  <a
                    href={forgotPasswordUrl}
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </a>
                )}
              </div>
              <FieldContent>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  disabled={isDisabled}
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
              </FieldContent>
              {errors.password && (
                <FieldError errors={[{ message: errors.password.message }]} />
              )}
            </Field>

            {showRememberMe && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  disabled={isDisabled}
                  {...register("rememberMe")}
                />
                <label
                  htmlFor="rememberMe"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Remember me
                </label>
              </div>
            )}

            <Button
              type="submit"
              width="full"
              loading={isSubmitting}
              disabled={isDisabled}
            >
              Sign in
            </Button>
          </Stack>
        </form>
      )}

      {/* Magic Link Option */}
      {showMagicLink && (
        <Button variant="ghost" width="full" disabled={isDisabled}>
          Sign in with magic link
        </Button>
      )}

      {/* Sign Up Link */}
      {showSignUpLink && (
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <a href={signUpUrl} className="text-primary hover:underline font-medium">
            Sign up
          </a>
        </p>
      )}
    </Stack>
  );

  // Page mode: Full card with header
  if (mode === "page") {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader>
            {header ?? (
              <>
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>
                  Sign in to your account to continue
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>{formContent}</CardContent>
          {footer && <CardFooter>{footer}</CardFooter>}
        </Card>
      </div>
    );
  }

  // Modal mode: Compact content only
  return (
    <div className="w-full">
      {header && <div className="mb-4">{header}</div>}
      {formContent}
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}
