"use client";

/**
 * ResetPasswordForm component for @oppulence/auth
 *
 * A form for setting a new password after receiving a reset link.
 */

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@oppulence/design-system";
import { Button, Input, Stack, Text } from "@oppulence/design-system";
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldError,
} from "@oppulence/design-system";
import { Alert, AlertDescription } from "@oppulence/design-system";

import { useAuth } from "../hooks";
import {
  evaluatePasswordStrength,
  getPasswordStrengthMessage,
} from "../schemas";

// ============================================================================
// Types
// ============================================================================

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character",
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export interface ResetPasswordFormProps {
  /**
   * Reset token from URL.
   */
  token: string;

  /**
   * Callback on successful password reset.
   */
  onSuccess?: () => void;

  /**
   * Callback on error.
   */
  onError?: (error: Error) => void;

  /**
   * URL to redirect after success.
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
// Icons
// ============================================================================

function CheckCircleIcon() {
  return (
    <svg
      className="size-12 text-green-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

// ============================================================================
// ResetPasswordForm Component
// ============================================================================

export function ResetPasswordForm({
  token,
  onSuccess,
  onError,
  signInUrl = "/sign-in",
  mode = "page",
  header,
  footer,
}: ResetPasswordFormProps) {
  const { resetPassword, isLoading, error, clearError } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password");

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsSubmitting(true);
    clearError();

    try {
      await resetPassword(token, data.password);
      setIsSuccess(true);
      onSuccess?.();
    } catch (err) {
      onError?.(err as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = isLoading || isSubmitting;

  // Success state
  if (isSuccess) {
    const successContent = (
      <Stack gap="lg">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-green-500/10 p-4">
            <CheckCircleIcon />
          </div>
          <div className="space-y-2">
            <Text size="lg" weight="semibold">
              Password reset successful
            </Text>
            <Text size="sm" variant="muted">
              Your password has been updated. You can now sign in with your new
              password.
            </Text>
          </div>
        </div>

        <Button
          width="full"
          onClick={() => {
            window.location.href = signInUrl;
          }}
        >
          Continue to sign in
        </Button>
      </Stack>
    );

    if (mode === "page") {
      return (
        <div className="w-full max-w-md mx-auto">
          <Card>
            <CardContent>
              <div className="pt-6">{successContent}</div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return <div className="w-full">{successContent}</div>;
  }

  const formContent = (
    <Stack gap="lg">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap="md">
          <Field>
            <FieldLabel htmlFor="password">New password</FieldLabel>
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
              Confirm new password
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

          <Button width="full" loading={isSubmitting} disabled={isDisabled}>
            Reset password
          </Button>
        </Stack>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <a
          href={signInUrl}
          className="text-primary hover:underline font-medium"
        >
          Sign in
        </a>
      </p>
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
                <CardTitle>Reset your password</CardTitle>
                <CardDescription>
                  Enter a new password for your account.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>{formContent}</CardContent>
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
