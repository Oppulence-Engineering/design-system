"use client";

/**
 * SignOutButton component for @oppulence/auth
 *
 * A button component that handles user sign-out.
 */

import * as React from "react";
import { Button } from "@oppulence/design-system";

import { useAuth } from "../hooks";

// ============================================================================
// Types
// ============================================================================

export interface SignOutButtonProps {
  /**
   * Button variant.
   * @default "ghost"
   */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";

  /**
   * Button size.
   * @default "default"
   */
  size?: "default" | "sm" | "lg" | "icon";

  /**
   * Custom button content.
   * @default "Sign out"
   */
  children?: React.ReactNode;

  /**
   * Callback before sign out starts.
   */
  onSignOutStart?: () => void;

  /**
   * Callback after sign out completes.
   */
  onSignOutComplete?: () => void;

  /**
   * Callback if sign out fails.
   */
  onSignOutError?: (error: Error) => void;

  /**
   * Redirect URL after sign out.
   * If not provided, uses default from AuthProvider.
   */
  redirectUrl?: string;

  /**
   * Show loading state while signing out.
   * @default true
   */
  showLoadingState?: boolean;

  /**
   * Disable the button.
   * @default false
   */
  disabled?: boolean;
}

// ============================================================================
// Icons
// ============================================================================

function LogOutIcon() {
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
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="size-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ============================================================================
// SignOutButton Component
// ============================================================================

export function SignOutButton({
  variant = "ghost",
  size = "default",
  children,
  onSignOutStart,
  onSignOutComplete,
  onSignOutError,
  redirectUrl,
  showLoadingState = true,
  disabled = false,
}: SignOutButtonProps) {
  const { signOut, isLoading: authLoading } = useAuth();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    if (isSigningOut || disabled) return;

    setIsSigningOut(true);
    onSignOutStart?.();

    try {
      await signOut();
      onSignOutComplete?.();
      // Handle redirect if specified
      if (redirectUrl && typeof window !== "undefined") {
        window.location.href = redirectUrl;
      }
    } catch (error) {
      onSignOutError?.(error instanceof Error ? error : new Error("Sign out failed"));
    } finally {
      setIsSigningOut(false);
    }
  };

  const isDisabled = disabled || authLoading || isSigningOut;
  const showLoading = showLoadingState && isSigningOut;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSignOut}
      disabled={isDisabled}
    >
      {showLoading ? <LoadingSpinner /> : <LogOutIcon />}
      {children ?? "Sign out"}
    </Button>
  );
}
