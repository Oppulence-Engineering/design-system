"use client";

/**
 * ForgotPasswordForm component for @oppulence/auth
 *
 * A form for requesting a password reset email.
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

// ============================================================================
// Types
// ============================================================================

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export interface ForgotPasswordFormProps {
  /**
   * Callback on successful submission.
   */
  onSuccess?: () => void;

  /**
   * Callback on error.
   */
  onError?: (error: Error) => void;

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
// Icons
// ============================================================================

function MailIcon() {
  return (
    <svg
      className="size-12 text-primary"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
      />
    </svg>
  );
}

// ============================================================================
// ForgotPasswordForm Component
// ============================================================================

export function ForgotPasswordForm({
  onSuccess,
  onError,
  signInUrl = "/sign-in",
  mode = "page",
  header,
  footer,
}: ForgotPasswordFormProps) {
  const { requestPasswordReset, isLoading, error, clearError } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [submittedEmail, setSubmittedEmail] = React.useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    clearError();

    try {
      await requestPasswordReset(data.email);
      setSubmittedEmail(data.email);
      setIsSuccess(true);
      onSuccess?.();
    } catch (err) {
      onError?.(err as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = isLoading || isSubmitting;

  // Success state - show email sent message
  if (isSuccess) {
    const successContent = (
      <Stack gap="lg">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <MailIcon />
          </div>
          <div className="space-y-2">
            <Text size="lg" weight="semibold">
              Check your email
            </Text>
            <Text size="sm" variant="muted">
              We&apos;ve sent a password reset link to{" "}
              <span className="font-medium text-foreground">
                {submittedEmail}
              </span>
            </Text>
          </div>
        </div>

        <Stack gap="sm">
          <Text size="xs" variant="muted" as="p">
            Didn&apos;t receive the email? Check your spam folder or try again.
          </Text>
          <Button
            variant="outline"
            width="full"
            onClick={() => {
              setIsSuccess(false);
              setSubmittedEmail("");
            }}
          >
            Try another email
          </Button>
        </Stack>

        <p className="text-center text-sm text-muted-foreground">
          <a
            href={signInUrl}
            className="text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            <ArrowLeftIcon />
            Back to sign in
          </a>
        </p>
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
            <FieldLabel htmlFor="email">Email address</FieldLabel>
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

          <Button width="full" loading={isSubmitting} disabled={isDisabled}>
            Send reset link
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
                <CardTitle>Forgot password?</CardTitle>
                <CardDescription>
                  Enter your email and we&apos;ll send you a link to reset your
                  password.
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
