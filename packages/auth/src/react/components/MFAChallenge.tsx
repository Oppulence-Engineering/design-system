"use client";

/**
 * MFAChallenge component for @oppulence/auth
 *
 * A form for entering MFA code during sign-in.
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
  Checkbox,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Input,
} from "@oppulence/design-system";
import { Field, FieldLabel, FieldContent } from "@oppulence/design-system";
import { Alert, AlertDescription } from "@oppulence/design-system";

import { useAuth } from "../hooks";

// ============================================================================
// Types
// ============================================================================

export interface MFAChallengeProps {
  /**
   * Challenge ID from the sign-in response.
   */
  challengeId: string;

  /**
   * Available MFA methods.
   * @default ["totp"]
   */
  methods?: Array<"totp" | "sms" | "backup">;

  /**
   * Phone number hint for SMS (last 4 digits).
   */
  phoneHint?: string;

  /**
   * Callback on successful MFA verification.
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
   * Show "Remember this device" checkbox.
   * @default true
   */
  showRememberDevice?: boolean;

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

function ShieldIcon() {
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
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      className="size-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
      />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg
      className="size-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
      />
    </svg>
  );
}

function AppIcon() {
  return (
    <svg
      className="size-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3M9 11.25h6M9 14.25h6"
      />
    </svg>
  );
}

// ============================================================================
// Method Type
// ============================================================================

type MFAMethod = "totp" | "sms" | "backup";

// ============================================================================
// MFAChallenge Component
// ============================================================================

export function MFAChallenge({
  challengeId,
  methods = ["totp"],
  phoneHint,
  onSuccess,
  onError,
  redirectTo,
  showRememberDevice = true,
  mode = "page",
  header,
  footer,
}: MFAChallengeProps) {
  const { verifyMFA, sendMFASMS, isLoading, error, clearError } = useAuth();

  const [selectedMethod, setSelectedMethod] = React.useState<MFAMethod>(
    methods[0] ?? "totp",
  );
  const [code, setCode] = React.useState("");
  const [backupCode, setBackupCode] = React.useState("");
  const [rememberDevice, setRememberDevice] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSendingSMS, setIsSendingSMS] = React.useState(false);
  const [smsSent, setSmsSent] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  // Handle cooldown timer for SMS
  React.useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Auto-submit when OTP is complete
  React.useEffect(() => {
    if (
      (selectedMethod === "totp" || selectedMethod === "sms") &&
      code.length === 6 &&
      !isSubmitting
    ) {
      handleSubmit();
    }
  }, [code, selectedMethod]);

  const handleSubmit = async () => {
    const codeValue = selectedMethod === "backup" ? backupCode : code;
    if (!codeValue || isSubmitting) return;

    setIsSubmitting(true);
    clearError();

    try {
      await verifyMFA(challengeId, codeValue, selectedMethod, rememberDevice);
      onSuccess?.();

      if (redirectTo) {
        window.location.href = redirectTo;
      }
    } catch (err) {
      if (selectedMethod !== "backup") {
        setCode("");
      }
      onError?.(err as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendSMS = async () => {
    if (isSendingSMS || cooldown > 0) return;

    setIsSendingSMS(true);
    clearError();

    try {
      await sendMFASMS(challengeId);
      setSmsSent(true);
      setCooldown(60);
    } catch (err) {
      onError?.(err as Error);
    } finally {
      setIsSendingSMS(false);
    }
  };

  const isDisabled = isLoading || isSubmitting;

  const renderMethodSelector = () => {
    if (methods.length <= 1) return null;

    return (
      <div className="flex gap-2">
        {methods.includes("totp") && (
          <button
            type="button"
            onClick={() => {
              setSelectedMethod("totp");
              setCode("");
              clearError();
            }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
              selectedMethod === "totp"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/50"
            }`}
          >
            <AppIcon />
            <span>Authenticator</span>
          </button>
        )}
        {methods.includes("sms") && (
          <button
            type="button"
            onClick={() => {
              setSelectedMethod("sms");
              setCode("");
              clearError();
            }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
              selectedMethod === "sms"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/50"
            }`}
          >
            <PhoneIcon />
            <span>SMS</span>
          </button>
        )}
        {methods.includes("backup") && (
          <button
            type="button"
            onClick={() => {
              setSelectedMethod("backup");
              setBackupCode("");
              clearError();
            }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
              selectedMethod === "backup"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/50"
            }`}
          >
            <KeyIcon />
            <span>Backup</span>
          </button>
        )}
      </div>
    );
  };

  const renderMethodContent = () => {
    switch (selectedMethod) {
      case "totp":
        return (
          <Stack gap="md">
            <div className="text-center">
              <Text size="sm" variant="muted">
                Enter the 6-digit code from your authenticator app
              </Text>
            </div>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                disabled={isDisabled}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </Stack>
        );

      case "sms":
        return (
          <Stack gap="md">
            <div className="text-center">
              <Text size="sm" variant="muted">
                {smsSent
                  ? `Enter the code sent to ***-***-${phoneHint ?? "****"}`
                  : `We'll send a code to ***-***-${phoneHint ?? "****"}`}
              </Text>
            </div>

            {smsSent ? (
              <>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                    disabled={isDisabled}
                  >
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <div className="text-center">
                  {cooldown > 0 ? (
                    <Text size="xs" variant="muted">
                      Resend in {cooldown}s
                    </Text>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendSMS}
                      disabled={isSendingSMS}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      Resend code
                    </button>
                  )}
                </div>
              </>
            ) : (
              <Button
                width="full"
                variant="outline"
                loading={isSendingSMS}
                onClick={handleSendSMS}
              >
                Send code
              </Button>
            )}
          </Stack>
        );

      case "backup":
        return (
          <Stack gap="md">
            <div className="text-center">
              <Text size="sm" variant="muted">
                Enter one of your backup codes
              </Text>
            </div>
            <Field>
              <FieldLabel htmlFor="backupCode">Backup code</FieldLabel>
              <FieldContent>
                <Input
                  id="backupCode"
                  type="text"
                  placeholder="XXXX-XXXX"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  disabled={isDisabled}
                  autoComplete="off"
                />
              </FieldContent>
            </Field>
          </Stack>
        );
    }
  };

  const formContent = (
    <Stack gap="lg">
      {/* Header icon */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <ShieldIcon />
        </div>
        <div className="space-y-2">
          <Text size="lg" weight="semibold">
            Two-factor authentication
          </Text>
          <Text size="sm" variant="muted">
            Enter your authentication code to continue
          </Text>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Method selector */}
      {renderMethodSelector()}

      {/* Method content */}
      {renderMethodContent()}

      {/* Remember device */}
      {showRememberDevice && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="rememberDevice"
            checked={rememberDevice}
            onCheckedChange={(checked) => setRememberDevice(checked === true)}
            disabled={isDisabled}
          />
          <label htmlFor="rememberDevice" className="text-sm cursor-pointer">
            Remember this device for 30 days
          </label>
        </div>
      )}

      {/* Submit button */}
      <Button
        width="full"
        loading={isSubmitting}
        disabled={
          isDisabled ||
          (selectedMethod === "backup" ? !backupCode : code.length !== 6) ||
          (selectedMethod === "sms" && !smsSent)
        }
        onClick={handleSubmit}
      >
        Verify
      </Button>
    </Stack>
  );

  // Page mode
  if (mode === "page") {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          {header && <CardHeader>{header}</CardHeader>}
          <CardContent>
            <div className={header ? "" : "pt-6"}>{formContent}</div>
          </CardContent>
          {footer && <div className="p-6 pt-0">{footer}</div>}
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
