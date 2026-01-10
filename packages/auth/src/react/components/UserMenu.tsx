"use client";

/**
 * UserMenu component for @oppulence/auth
 *
 * A dropdown menu with user info, navigation, and sign-out.
 */

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@oppulence/design-system";
import { Avatar, AvatarImage, AvatarFallback } from "@oppulence/design-system";
import { Text } from "@oppulence/design-system";

import { useAuth } from "../hooks";
import type { User } from "../../core/types";

// ============================================================================
// Types
// ============================================================================

export interface UserMenuProps {
  /**
   * User object. Uses current user from context if not provided.
   */
  user?: User;

  /**
   * Menu items to show.
   * @default ["profile", "settings", "sign-out"]
   */
  items?: Array<"profile" | "settings" | "billing" | "sign-out">;

  /**
   * Custom menu items to add.
   */
  customItems?: Array<{
    label: string;
    icon?: React.ReactNode;
    href?: string;
    onClick?: () => void;
    separator?: boolean;
    variant?: "default" | "destructive";
  }>;

  /**
   * Custom trigger element.
   * Defaults to avatar with user initials.
   */
  trigger?: React.ReactNode;

  /**
   * Dropdown alignment.
   * @default "end"
   */
  align?: "start" | "center" | "end";

  /**
   * Avatar size.
   * @default "default"
   */
  avatarSize?: "xs" | "sm" | "default" | "lg";

  /**
   * Show user name/email in dropdown header.
   * @default true
   */
  showUserInfo?: boolean;

  /**
   * URL for profile link.
   * @default "/profile"
   */
  profileUrl?: string;

  /**
   * URL for settings link.
   * @default "/settings"
   */
  settingsUrl?: string;

  /**
   * URL for billing link.
   * @default "/settings/billing"
   */
  billingUrl?: string;

  /**
   * Callback when sign out is clicked.
   */
  onSignOut?: () => void;
}

// ============================================================================
// Icons
// ============================================================================

function UserIcon() {
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
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function SettingsIcon() {
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
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function CreditCardIcon() {
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
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

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

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(user: User): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.firstName) {
    return user.firstName.slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

function getDisplayName(user: User): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  return user.email.split("@")[0] ?? user.email;
}

// ============================================================================
// UserMenu Component
// ============================================================================

export function UserMenu({
  user: propUser,
  items = ["profile", "settings", "sign-out"],
  customItems = [],
  trigger,
  align = "end",
  avatarSize = "default",
  showUserInfo = true,
  profileUrl = "/profile",
  settingsUrl = "/settings",
  billingUrl = "/settings/billing",
  onSignOut,
}: UserMenuProps) {
  const { user: contextUser, signOut, isLoading } = useAuth();
  const user = propUser ?? contextUser;

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    onSignOut?.();
    await signOut();
  };

  const defaultTrigger = (
    <Avatar size={avatarSize}>
      {user.profilePictureUrl ? (
        <AvatarImage src={user.profilePictureUrl} alt={getDisplayName(user)} />
      ) : null}
      <AvatarFallback>{getInitials(user)}</AvatarFallback>
    </Avatar>
  );

  const menuItemIcons: Record<string, React.ReactNode> = {
    profile: <UserIcon />,
    settings: <SettingsIcon />,
    billing: <CreditCardIcon />,
    "sign-out": <LogOutIcon />,
  };

  const menuItemLabels: Record<string, string> = {
    profile: "Profile",
    settings: "Settings",
    billing: "Billing",
    "sign-out": "Sign out",
  };

  const menuItemUrls: Record<string, string> = {
    profile: profileUrl,
    settings: settingsUrl,
    billing: billingUrl,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        {trigger ?? defaultTrigger}
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} sideOffset={8}>
        {/* User Info Header */}
        {showUserInfo && (
          <>
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <Text size="sm" weight="medium">
                  {getDisplayName(user)}
                </Text>
                <Text size="xs" variant="muted">
                  {user.email}
                </Text>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Standard Menu Items */}
        <DropdownMenuGroup>
          {items
            .filter((item) => item !== "sign-out")
            .map((item) => (
              <DropdownMenuItem
                key={item}
                onClick={() => {
                  window.location.href = menuItemUrls[item] ?? "/";
                }}
              >
                {menuItemIcons[item]}
                {menuItemLabels[item]}
              </DropdownMenuItem>
            ))}
        </DropdownMenuGroup>

        {/* Custom Items */}
        {customItems.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {customItems.map((item, index) => (
                <React.Fragment key={index}>
                  {item.separator && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    variant={item.variant}
                    onClick={() => {
                      if (item.href) {
                        window.location.href = item.href;
                      } else if (item.onClick) {
                        item.onClick();
                      }
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuGroup>
          </>
        )}

        {/* Sign Out */}
        {items.includes("sign-out") && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={handleSignOut}
              disabled={isLoading}
            >
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
