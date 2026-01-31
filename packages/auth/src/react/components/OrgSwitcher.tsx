"use client";

/**
 * OrgSwitcher component for @oppulence/auth
 *
 * A dropdown for switching between organizations in multi-tenant apps.
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
import { Button, Badge } from "@oppulence/design-system";

import { useOrganizations } from "../hooks";
import type { Organization } from "../../core/types";

// ============================================================================
// Types
// ============================================================================

export interface OrgSwitcherProps {
  /**
   * Callback when organization changes.
   */
  onOrgChange?: (org: Organization) => void;

  /**
   * Show "Create organization" option.
   * @default true
   */
  showCreateOrg?: boolean;

  /**
   * URL for create organization page.
   * @default "/organizations/new"
   */
  createOrgUrl?: string;

  /**
   * Show organization settings link.
   * @default true
   */
  showSettings?: boolean;

  /**
   * URL for organization settings.
   * @default "/settings/organization"
   */
  settingsUrl?: string;

  /**
   * Custom trigger element.
   */
  trigger?: React.ReactNode;

  /**
   * Dropdown alignment.
   * @default "start"
   */
  align?: "start" | "center" | "end";

  /**
   * Show organization count badge.
   * @default false
   */
  showCount?: boolean;

  /**
   * Compact mode (smaller trigger).
   * @default false
   */
  compact?: boolean;
}

// ============================================================================
// Icons
// ============================================================================

function BuildingIcon() {
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
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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

function ChevronDownIcon() {
  return (
    <svg
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getOrgInitials(org: Organization): string {
  const words = org.name.split(" ");
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
  }
  return org.name.slice(0, 2).toUpperCase();
}

// ============================================================================
// OrgSwitcher Component
// ============================================================================

export function OrgSwitcher({
  onOrgChange,
  showCreateOrg = true,
  createOrgUrl = "/organizations/new",
  showSettings = true,
  settingsUrl = "/settings/organization",
  trigger,
  align = "start",
  showCount = false,
  compact = false,
}: OrgSwitcherProps) {
  const { organizations, organization, switchOrganization } =
    useOrganizations();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleOrgSwitch = async (org: Organization) => {
    if (org.id === organization?.id) return;

    setIsLoading(true);
    try {
      await switchOrganization(org.id);
      onOrgChange?.(org);
    } finally {
      setIsLoading(false);
    }
  };

  // Default trigger
  const defaultTrigger = compact ? (
    <Button variant="ghost" size="sm" disabled={isLoading}>
      <Avatar size="xs">
        {organization?.logoUrl ? (
          <AvatarImage src={organization.logoUrl} alt={organization.name} />
        ) : null}
        <AvatarFallback>
          {organization ? getOrgInitials(organization) : "?"}
        </AvatarFallback>
      </Avatar>
      <ChevronDownIcon />
    </Button>
  ) : (
    <Button variant="outline" disabled={isLoading}>
      <Avatar size="xs">
        {organization?.logoUrl ? (
          <AvatarImage src={organization.logoUrl} alt={organization.name} />
        ) : null}
        <AvatarFallback>
          {organization ? getOrgInitials(organization) : <BuildingIcon />}
        </AvatarFallback>
      </Avatar>
      <span className="max-w-32 truncate">
        {organization?.name ?? "Select organization"}
      </span>
      {showCount && organizations.length > 1 && (
        <Badge variant="secondary">{organizations.length}</Badge>
      )}
      <ChevronDownIcon />
    </Button>
  );

  if (organizations.length === 0 && !showCreateOrg) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>{trigger ?? defaultTrigger}</DropdownMenuTrigger>

      <DropdownMenuContent align={align} sideOffset={8}>
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Organization List */}
        <DropdownMenuGroup>
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleOrgSwitch(org)}
              disabled={isLoading}
            >
              <Avatar size="xs">
                {org.logoUrl ? (
                  <AvatarImage src={org.logoUrl} alt={org.name} />
                ) : null}
                <AvatarFallback>{getOrgInitials(org)}</AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate">{org.name}</span>
              {org.id === organization?.id && <CheckIcon />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        {/* Actions */}
        {(showCreateOrg || showSettings) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {showSettings && organization && (
                <DropdownMenuItem
                  onClick={() => {
                    window.location.href = settingsUrl;
                  }}
                >
                  <SettingsIcon />
                  Organization settings
                </DropdownMenuItem>
              )}
              {showCreateOrg && (
                <DropdownMenuItem
                  onClick={() => {
                    window.location.href = createOrgUrl;
                  }}
                >
                  <PlusIcon />
                  Create organization
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
