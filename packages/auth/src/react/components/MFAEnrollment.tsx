"use client";

/**
 * MFAEnrollment component for @oppulence/auth
 *
 * A multi-step flow for setting up TOTP-based MFA.
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@oppulence/design-system";
import { Alert, AlertDescription } from "@oppulence/design-system";

import { useAuth } from "../hooks";

// ============================================================================
// Types
// ============================================================================

export interface MFAEnrollmentProps {
  /**
   * Callback on successful MFA enrollment.
   */
  onSuccess?: () => void;

  /**
   * Callback on error.
   */
  onError?: (error: Error) => void;

  /**
   * Callback when user cancels enrollment.
   */
  onCancel?: () => void;

  /**
   * URL to redirect after success.
   */
  redirectTo?: string;

  /**
   * Display mode.
   * @default "page"
   */
  mode?: "page" | "modal";

  /**
   * Custom header content.
   */
  header?: React.ReactNode;
}

// ============================================================================
// Icons
// ============================================================================

function ShieldCheckIcon() {
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

function CopyIcon() {
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
        d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ============================================================================
// Steps
// ============================================================================

type EnrollmentStep = "setup" | "verify" | "backup" | "complete";

// ============================================================================
// MFAEnrollment Component
// ============================================================================

export function MFAEnrollment({
  onSuccess,
  onError,
  onCancel,
  redirectTo,
  mode = "page",
  header,
}: MFAEnrollmentProps) {
  const { enrollMFA, verifyMFAEnrollment, isLoading, error, clearError } = useAuth();

  const [step, setStep] = React.useState<EnrollmentStep>("setup");
  const [qrCodeUrl, setQrCodeUrl] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [code, setCode] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [copiedSecret, setCopiedSecret] = React.useState(false);
  const [copiedBackup, setCopiedBackup] = React.useState(false);

  // Start enrollment on mount
  React.useEffect(() => {
    const startEnrollment = async () => {
      try {
        const result = await enrollMFA();
        setQrCodeUrl(result.qrCodeUrl);
        setSecret(result.secret);
      } catch (err) {
        onError?.(err as Error);
      }
    };

    startEnrollment();
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6 || isSubmitting) return;

    setIsSubmitting(true);
    clearError();

    try {
      const result = await verifyMFAEnrollment(code);
      setBackupCodes(result.backupCodes);
      setStep("backup");
    } catch (err) {
      setCode("");
      onError?.(err as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = () => {
    setStep("complete");
    onSuccess?.();

    if (redirectTo) {
      setTimeout(() => {
        window.location.href = redirectTo;
      }, 2000);
    }
  };

  const copySecret = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const copyBackupCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const isDisabled = isLoading || isSubmitting;

  // Render based on step
  const renderContent = () => {
    switch (step) {
      case "setup":
        return (
          <Stack gap="lg">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <ShieldCheckIcon />
              </div>
              <div className="space-y-2">
                <Text size="lg" weight="semibold">
                  Set up two-factor authentication
                </Text>
                <Text size="sm" variant="muted">
                  Scan the QR code with your authenticator app to get started.
                </Text>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="qr">
              <TabsList>
                <TabsTrigger value="qr">QR Code</TabsTrigger>
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              </TabsList>

              <TabsContent value="qr">
                <div className="flex flex-col items-center gap-4 py-4">
                  {qrCodeUrl ? (
                    <div className="rounded-lg border bg-white p-4">
                      <img
                        src={qrCodeUrl}
                        alt="QR Code for authenticator app"
                        className="size-48"
                      />
                    </div>
                  ) : (
                    <div className="size-48 rounded-lg border bg-muted animate-pulse" />
                  )}
                  <Text size="xs" variant="muted">
                    Scan with Google Authenticator, Authy, or similar app
                  </Text>
                </div>
              </TabsContent>

              <TabsContent value="manual">
                <div className="space-y-4 py-4">
                  <Text size="sm" variant="muted">
                    If you can&apos;t scan the QR code, enter this secret key manually:
                  </Text>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
                      {secret ?? "Loading..."}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copySecret}
                      disabled={!secret}
                    >
                      {copiedSecret ? <CheckIcon /> : <CopyIcon />}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Stack gap="sm">
              <Button
                width="full"
                onClick={() => setStep("verify")}
                disabled={!qrCodeUrl}
              >
                Continue
              </Button>
              {onCancel && (
                <Button variant="ghost" width="full" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </Stack>
          </Stack>
        );

      case "verify":
        return (
          <Stack gap="lg">
            <div className="text-center space-y-2">
              <Text size="lg" weight="semibold">
                Verify setup
              </Text>
              <Text size="sm" variant="muted">
                Enter the 6-digit code from your authenticator app.
              </Text>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col items-center gap-4">
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

            <Stack gap="sm">
              <Button
                width="full"
                loading={isSubmitting}
                disabled={isDisabled || code.length !== 6}
                onClick={handleVerify}
              >
                Verify
              </Button>
              <Button
                variant="ghost"
                width="full"
                onClick={() => setStep("setup")}
                disabled={isSubmitting}
              >
                Back
              </Button>
            </Stack>
          </Stack>
        );

      case "backup":
        return (
          <Stack gap="lg">
            <div className="text-center space-y-2">
              <Text size="lg" weight="semibold">
                Save your backup codes
              </Text>
              <Text size="sm" variant="muted">
                These codes can be used to access your account if you lose your
                authenticator device. Save them somewhere safe.
              </Text>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-4">
                {backupCodes.map((code, i) => (
                  <code key={i} className="text-sm font-mono text-center py-1">
                    {code}
                  </code>
                ))}
              </div>
              <Button
                variant="outline"
                width="full"
                onClick={copyBackupCodes}
                iconLeft={copiedBackup ? <CheckIcon /> : <CopyIcon />}
              >
                {copiedBackup ? "Copied!" : "Copy codes"}
              </Button>
            </div>

            <Alert>
              <AlertDescription>
                Each backup code can only be used once. Store them securely and
                don&apos;t share them with anyone.
              </AlertDescription>
            </Alert>

            <Button width="full" onClick={handleComplete}>
              I&apos;ve saved my codes
            </Button>
          </Stack>
        );

      case "complete":
        return (
          <Stack gap="lg">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-full bg-green-500/10 p-4">
                <CheckCircleIcon />
              </div>
              <div className="space-y-2">
                <Text size="lg" weight="semibold">
                  Two-factor authentication enabled
                </Text>
                <Text size="sm" variant="muted">
                  Your account is now protected with two-factor authentication.
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
    }
  };

  // Page mode
  if (mode === "page") {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          {header && (
            <CardHeader>
              {header}
            </CardHeader>
          )}
          <CardContent>
            <div className={header ? "" : "pt-6"}>{renderContent()}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Modal mode
  return (
    <div className="w-full">
      {header && <div className="mb-4">{header}</div>}
      {renderContent()}
    </div>
  );
}
