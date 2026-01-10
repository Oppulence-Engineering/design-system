"use client";

/**
 * AuthFormBase component for @oppulence/auth
 *
 * A shared base wrapper for authentication forms that handles
 * Card/Dialog switching based on display mode.
 */

import * as React from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@oppulence/design-system";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@oppulence/design-system";

// ============================================================================
// Types
// ============================================================================

export interface AuthFormBaseProps {
  /**
   * Display mode for the form.
   * - "page": Renders in a Card for full-page layouts
   * - "modal": Renders in a Dialog for overlay display
   * @default "page"
   */
  mode?: "page" | "modal";

  /**
   * Form title displayed in the header.
   */
  title?: string;

  /**
   * Form description displayed below the title.
   */
  description?: string;

  /**
   * Whether the modal is open (only used in modal mode).
   */
  open?: boolean;

  /**
   * Callback when modal open state changes (only used in modal mode).
   */
  onOpenChange?: (open: boolean) => void;

  /**
   * Custom header content (replaces title/description).
   */
  header?: React.ReactNode;

  /**
   * Footer content displayed below the form.
   */
  footer?: React.ReactNode;

  /**
   * The form content.
   */
  children: React.ReactNode;

  /**
   * Maximum width for page mode.
   * @default "md"
   */
  maxWidth?: "sm" | "md" | "lg";
}

// ============================================================================
// Width Classes
// ============================================================================

const widthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
} as const;

// ============================================================================
// AuthFormBase Component
// ============================================================================

export function AuthFormBase({
  mode = "page",
  title,
  description,
  open,
  onOpenChange,
  header,
  footer,
  children,
  maxWidth = "md",
}: AuthFormBaseProps) {
  // Modal mode
  if (mode === "modal") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          {(header || title) && (
            <DialogHeader>
              {header ?? (
                <>
                  {title && <DialogTitle>{title}</DialogTitle>}
                  {description && (
                    <DialogDescription>{description}</DialogDescription>
                  )}
                </>
              )}
            </DialogHeader>
          )}
          <div className="py-4">{children}</div>
          {footer && <div className="pt-4">{footer}</div>}
        </DialogContent>
      </Dialog>
    );
  }

  // Page mode (default)
  return (
    <div className={`w-full mx-auto ${widthClasses[maxWidth]}`}>
      <Card>
        {(header || title) && (
          <CardHeader>
            {header ?? (
              <>
                {title && <CardTitle>{title}</CardTitle>}
                {description && (
                  <CardDescription>{description}</CardDescription>
                )}
              </>
            )}
          </CardHeader>
        )}
        <CardContent>
          <div className={header || title ? "" : "pt-6"}>{children}</div>
        </CardContent>
        {footer && <CardFooter>{footer}</CardFooter>}
      </Card>
    </div>
  );
}

// ============================================================================
// Utility Components
// ============================================================================

/**
 * Divider with "or" text for separating form sections.
 */
export function AuthDivider({ text = "or" }: { text?: string }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}

/**
 * Footer link for navigation between auth forms.
 */
export function AuthFooterLink({
  text,
  linkText,
  href,
  onClick,
}: {
  text: string;
  linkText: string;
  href?: string;
  onClick?: () => void;
}) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      {text}{" "}
      {href ? (
        <a href={href} className="text-primary hover:underline font-medium">
          {linkText}
        </a>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="text-primary hover:underline font-medium"
        >
          {linkText}
        </button>
      )}
    </p>
  );
}

/**
 * Branding header for auth forms.
 */
export function AuthBranding({
  logo,
  title,
  description,
}: {
  logo?: React.ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center mb-6">
      {logo && <div className="size-12">{logo}</div>}
      {title && (
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      )}
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
