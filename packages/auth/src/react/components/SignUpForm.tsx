"use client";

/**
 * SignUpForm component for @oppulence/auth
 *
 * A complete registration form with password strength validation.
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
  Progress,
} from "@oppulence/design-system";
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldDescription,
  FieldError,
} from "@oppulence/design-system";
import { Alert, AlertDescription } from "@oppulence/design-system";

import { useAuth } from "../hooks";
import {
  signUpSchema,
  type SignUpFormData,
  evaluatePasswordStrength,
  getPasswordStrengthMessage,
} from "../schemas";
import type { OAuthProvider } from "../../core/types";
import { OAUTH_PROVIDER_NAMES } from "../../core/constants";

// ============================================================================
// Types
// ============================================================================

export interface SignUpFormProps {
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
   * Show name fields (first name, last name).
   * @default true
   */
  showNameFields?: boolean;

  /**
   * Show terms acceptance checkbox.
   * @default true
   */
  showTerms?: boolean;

  /**
   * Terms of service URL.
   * @default "/terms"
   */
  termsUrl?: string;

  /**
   * Privacy policy URL.
   * @default "/privacy"
   */
  privacyUrl?: string;

  /**
   * Show sign-in link.
   * @default true
   */
  showSignInLink?: boolean;

  /**
   * Callback on successful sign-up.
   */
  onSuccess?: () => void;

  /**
   * Callback on error.
   */
  onError?: (error: Error) => void;

  /**
   * URL to redirect after success (to verify email).
   */
  redirectTo?: string;

  /**
   * URL for sign-in link.
   * @default "/sign-in"
   */
  signInUrl?: string;

  /**
   * Display mode.
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
// Password Strength Indicator
// ============================================================================

interface PasswordStrengthProps {
  password: string;
}

function PasswordStrengthIndicator({ password }: PasswordStrengthProps) {
  const { strength, score, criteria } = evaluatePasswordStrength(password);

  if (!password) return null;

  const colors = {
    weak: "bg-destructive",
    fair: "bg-yellow-500",
    good: "bg-blue-500",
    strong: "bg-green-500",
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= score ? colors[strength] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <Text size="xs" variant="muted">
        {getPasswordStrengthMessage(strength)}
      </Text>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <CriteriaItem met={criteria.minLength} label="12+ characters" />
        <CriteriaItem met={criteria.hasUppercase} label="Uppercase letter" />
        <CriteriaItem met={criteria.hasLowercase} label="Lowercase letter" />
        <CriteriaItem met={criteria.hasNumber} label="Number" />
        <CriteriaItem met={criteria.hasSpecial} label="Special character" />
      </div>
    </div>
  );
}

function CriteriaItem({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`size-3 rounded-full flex items-center justify-center ${
          met ? "bg-green-500" : "bg-muted"
        }`}
      >
        {met && (
          <svg className="size-2 text-white" viewBox="0 0 12 12" fill="none">
            <path
              d="M10 3L4.5 8.5L2 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <Text size="xs" variant={met ? "default" : "muted"}>
        {label}
      </Text>
    </div>
  );
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
// SignUpForm Component
// ============================================================================

export function SignUpForm({
  providers = ["google", "github"],
  showEmailPassword = true,
  showNameFields = true,
  showTerms = true,
  termsUrl = "/terms",
  privacyUrl = "/privacy",
  showSignInLink = true,
  onSuccess,
  onError,
  redirectTo,
  signInUrl = "/sign-in",
  mode = "page",
  header,
  footer,
}: SignUpFormProps) {
  const { signUp, signInWithOAuth, isLoading, error, clearError } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      acceptTerms: false,
    },
  });

  const password = watch("password");

  const onSubmit = async (data: SignUpFormData) => {
    setIsSubmitting(true);
    clearError();

    try {
      await signUp(data.email, data.password, {
        firstName: data.firstName,
        lastName: data.lastName,
      });
      setSuccess(true);
      onSuccess?.();

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

  // Success state
  if (success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We&apos;ve sent a verification link to your email address. Please
              click the link to verify your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              width="full"
              onClick={() => setSuccess(false)}
            >
              Back to sign up
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            {/* Name Fields */}
            {showNameFields && (
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="firstName">First name</FieldLabel>
                  <FieldContent>
                    <Input
                      id="firstName"
                      type="text"
                      autoComplete="given-name"
                      placeholder="John"
                      disabled={isDisabled}
                      {...register("firstName")}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                  <FieldContent>
                    <Input
                      id="lastName"
                      type="text"
                      autoComplete="family-name"
                      placeholder="Doe"
                      disabled={isDisabled}
                      {...register("lastName")}
                    />
                  </FieldContent>
                </Field>
              </div>
            )}

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
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <FieldContent>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  disabled={isDisabled}
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
              </FieldContent>
              <PasswordStrengthIndicator password={password} />
              {errors.password && (
                <FieldError errors={[{ message: errors.password.message }]} />
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="confirmPassword">
                Confirm password
              </FieldLabel>
              <FieldContent>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  disabled={isDisabled}
                  aria-invalid={!!errors.confirmPassword}
                  {...register("confirmPassword")}
                />
              </FieldContent>
              {errors.confirmPassword && (
                <FieldError
                  errors={[{ message: errors.confirmPassword.message }]}
                />
              )}
            </Field>

            {/* Terms Checkbox */}
            {showTerms && (
              <Field>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    <Checkbox
                      id="acceptTerms"
                      disabled={isDisabled}
                      {...register("acceptTerms")}
                    />
                  </div>
                  <label
                    htmlFor="acceptTerms"
                    className="text-sm leading-snug cursor-pointer"
                  >
                    I agree to the{" "}
                    <a href={termsUrl} className="text-primary hover:underline">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a
                      href={privacyUrl}
                      className="text-primary hover:underline"
                    >
                      Privacy Policy
                    </a>
                  </label>
                </div>
                {errors.acceptTerms && (
                  <FieldError
                    errors={[{ message: errors.acceptTerms.message }]}
                  />
                )}
              </Field>
            )}

            <Button
              type="submit"
              width="full"
              loading={isSubmitting}
              disabled={isDisabled}
            >
              Create account
            </Button>
          </Stack>
        </form>
      )}

      {/* Sign In Link */}
      {showSignInLink && (
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <a
            href={signInUrl}
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </a>
        </p>
      )}
    </Stack>
  );

  // Page mode
  if (mode === "page") {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader>
            {header ?? (
              <>
                <CardTitle>Create an account</CardTitle>
                <CardDescription>
                  Enter your details to get started
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

  // Modal mode
  return (
    <div className="w-full">
      {header && <div className="mb-4">{header}</div>}
      {formContent}
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}
