"use client";

/**
 * SocialButton component for @oppulence/auth
 *
 * Standalone OAuth/social login buttons with provider branding.
 * Can be used individually or as a group.
 */

import * as React from "react";
import { Button, Stack } from "@oppulence/design-system";
import type { OAuthProvider } from "../../core/types";
import { OAUTH_PROVIDER_NAMES } from "../../core/constants";

// ============================================================================
// Types
// ============================================================================

export interface SocialButtonProps {
  /**
   * OAuth provider for this button.
   */
  provider: OAuthProvider;

  /**
   * Click handler (typically calls signInWithOAuth).
   */
  onClick: () => void;

  /**
   * Whether the button is disabled.
   */
  disabled?: boolean;

  /**
   * Whether the button is in a loading state.
   */
  loading?: boolean;

  /**
   * Button variant style.
   * @default "outline"
   */
  variant?: "outline" | "secondary" | "ghost";

  /**
   * Button size.
   * @default "default"
   */
  size?: "sm" | "default" | "lg";

  /**
   * Custom label text.
   * Defaults to "Continue with {Provider}"
   */
  label?: string;

  /**
   * Show only the icon (no text).
   * @default false
   */
  iconOnly?: boolean;
}

export interface SocialButtonGroupProps {
  /**
   * OAuth providers to display.
   */
  providers: OAuthProvider[];

  /**
   * Click handler called with the provider.
   */
  onProviderClick: (provider: OAuthProvider) => void;

  /**
   * Whether all buttons are disabled.
   */
  disabled?: boolean;

  /**
   * Provider currently loading (if any).
   */
  loadingProvider?: OAuthProvider | null;

  /**
   * Button variant style.
   * @default "outline"
   */
  variant?: "outline" | "secondary" | "ghost";

  /**
   * Button size.
   * @default "default"
   */
  size?: "sm" | "default" | "lg";

  /**
   * Layout direction.
   * @default "vertical"
   */
  layout?: "vertical" | "horizontal";

  /**
   * Show only icons (no text).
   * @default false
   */
  iconOnly?: boolean;
}

// ============================================================================
// Provider Icons
// ============================================================================

const providerIcons: Record<OAuthProvider, React.ReactNode> = {
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
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  ),
  microsoft: (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
    </svg>
  ),
};

// ============================================================================
// Provider Colors (for branded variants)
// ============================================================================

const providerColors: Record<OAuthProvider, string> = {
  google: "hover:bg-[#4285f4]/10",
  github: "hover:bg-[#333]/10",
  microsoft: "hover:bg-[#00a4ef]/10",
};

// ============================================================================
// SocialButton Component
// ============================================================================

export function SocialButton({
  provider,
  onClick,
  disabled = false,
  loading = false,
  variant = "outline",
  size = "default",
  label,
  iconOnly = false,
}: SocialButtonProps) {
  const icon = providerIcons[provider];
  const providerName = OAUTH_PROVIDER_NAMES[provider];
  const buttonLabel = label ?? `Continue with ${providerName}`;

  if (iconOnly) {
    return (
      <Button
        variant={variant}
        size="icon"
        onClick={onClick}
        disabled={disabled}
        loading={loading}
        aria-label={buttonLabel}
      >
        {icon}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      width="full"
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      iconLeft={icon}
    >
      {buttonLabel}
    </Button>
  );
}

// ============================================================================
// SocialButtonGroup Component
// ============================================================================

export function SocialButtonGroup({
  providers,
  onProviderClick,
  disabled = false,
  loadingProvider = null,
  variant = "outline",
  size = "default",
  layout = "vertical",
  iconOnly = false,
}: SocialButtonGroupProps) {
  if (providers.length === 0) {
    return null;
  }

  const buttons = providers.map((provider) => (
    <SocialButton
      key={provider}
      provider={provider}
      onClick={() => onProviderClick(provider)}
      disabled={disabled || loadingProvider !== null}
      loading={loadingProvider === provider}
      variant={variant}
      size={size}
      iconOnly={iconOnly}
    />
  ));

  if (layout === "horizontal") {
    return (
      <div className="flex gap-2 justify-center">
        {buttons}
      </div>
    );
  }

  return <Stack gap="sm">{buttons}</Stack>;
}

// ============================================================================
// Utility: Get all supported providers
// ============================================================================

export const SUPPORTED_PROVIDERS: OAuthProvider[] = ["google", "github", "microsoft"];

/**
 * Check if a provider is supported.
 */
export function isProviderSupported(provider: string): provider is OAuthProvider {
  return SUPPORTED_PROVIDERS.includes(provider as OAuthProvider);
}
