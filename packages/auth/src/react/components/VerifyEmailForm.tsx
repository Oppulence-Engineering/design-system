"use client";

/**
 * VerifyEmailForm component for @oppulence/auth
 *
 * A form for verifying email with OTP code.
 */

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@oppulence/design-system";
import {
  Button,
  Stack,
  Text,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@oppulence/design-system";
import { Alert, AlertDescription } from "@oppulence/design-system";

import { useAuth } from "../hooks";

// ============================================================================
// Types
// ============================================================================

export interface VerifyEmailFormProps {
  /**
   * Email address being verified.
   */
  email: string;

  /**
   * Number of digits in the OTP code.
   * @default 6
   */
  codeLength?: number;

  /**
   * Callback on successful verification.
   */
  onSuccess?: () => void;

  /**
   * Callback on error.
   */
  onError?: (error: Error) => void;

  /**
   * URL to redirect after success.
   */
  redirectTo?: string;

  /**
   * Cooldown in seconds before resend is allowed.
   * @default 60
   */
  resendCooldown?: number;

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

function MailOpenIcon() {
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
        d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V17.25z"
      />
    </svg>
  );
}

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
// VerifyEmailForm Component
// ============================================================================

export function VerifyEmailForm({
  email,
  codeLength = 6,
  onSuccess,
  onError,
  redirectTo,
  resendCooldown = 60,
  mode = "page",
  header,
  footer,
}: VerifyEmailFormProps) {
  const { verifyEmail, resendVerificationEmail, isLoading, error, clearError } =
    useAuth();
  const [code, setCode] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  // Handle cooldown timer
  React.useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Auto-submit when code is complete
  React.useEffect(() => {
    if (code.length === codeLength && !isSubmitting) {
      handleSubmit();
    }
  }, [code, codeLength]);

  const handleSubmit = async () => {
    if (code.length !== codeLength || isSubmitting) return;

    setIsSubmitting(true);
    clearError();

    try {
      await verifyEmail(code);
      setIsSuccess(true);
      onSuccess?.();

      if (redirectTo) {
        setTimeout(() => {
          window.location.href = redirectTo;
        }, 1500);
      }
    } catch (err) {
      setCode("");
      onError?.(err as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    clearError();

    try {
      await resendVerificationEmail(email);
      setCooldown(resendCooldown);
    } catch (err) {
      onError?.(err as Error);
    } finally {
      setIsResending(false);
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
              Email verified!
            </Text>
            <Text size="sm" variant="muted">
              Your email has been successfully verified.
              {redirectTo && " Redirecting..."}
            </Text>
          </div>
        </div>

        {!redirectTo && (
          <Button
            width="full"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Continue
          </Button>
        )}
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
      {/* Icon and instructions */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <MailOpenIcon />
        </div>
        <div className="space-y-2">
          <Text size="sm" variant="muted">
            We sent a verification code to
          </Text>
          <Text size="sm" weight="medium">
            {email}
          </Text>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* OTP Input */}
      <div className="flex flex-col items-center gap-4">
        <InputOTP
          maxLength={codeLength}
          value={code}
          onChange={setCode}
          disabled={isDisabled}
        >
          <InputOTPGroup>
            {Array.from({ length: Math.floor(codeLength / 2) }).map((_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            {Array.from({ length: Math.ceil(codeLength / 2) }).map((_, i) => (
              <InputOTPSlot
                key={i + Math.floor(codeLength / 2)}
                index={i + Math.floor(codeLength / 2)}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>

        <Button
          width="full"
          loading={isSubmitting}
          disabled={isDisabled || code.length !== codeLength}
          onClick={handleSubmit}
        >
          Verify email
        </Button>
      </div>

      {/* Resend */}
      <div className="text-center">
        <Text size="sm" variant="muted" as="span">
          Didn&apos;t receive a code?{" "}
        </Text>
        {cooldown > 0 ? (
          <Text size="sm" variant="muted" as="span">
            Resend in {cooldown}s
          </Text>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-sm text-primary hover:underline font-medium disabled:opacity-50"
          >
            {isResending ? "Sending..." : "Resend code"}
          </button>
        )}
      </div>
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
                <CardTitle>Verify your email</CardTitle>
                <CardDescription>
                  Enter the verification code sent to your email.
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
