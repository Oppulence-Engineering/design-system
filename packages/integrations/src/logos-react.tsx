"use client";

import * as React from "react";

import { getIntegrationLogo } from "./logos.js";

export interface IntegrationLogoProps extends Omit<
  React.ComponentPropsWithoutRef<"img">,
  "src" | "srcSet"
> {
  /** Canonical integration ID from the catalogue. */
  integrationId: string;
  /** Render this mark as decorative. Defaults to true. */
  decorative?: boolean;
  /** Rendered when an unknown future integration has no bundled mark. */
  fallback?: React.ReactNode;
}

/**
 * Render a locally bundled integration mark without a third-party image request.
 * The package bundles the data URI, so CSP can allow it with `img-src data:`.
 */
export function IntegrationLogo({
  integrationId,
  decorative = true,
  fallback = null,
  alt,
  height = 32,
  width = 32,
  ...props
}: IntegrationLogoProps): React.ReactNode {
  const logo = getIntegrationLogo(integrationId);
  if (!logo) return fallback;

  return (
    <img
      {...props}
      alt={decorative ? "" : (alt ?? integrationId)}
      aria-hidden={decorative || undefined}
      data-integration-logo={integrationId}
      data-integration-logo-source={logo.source}
      draggable={props.draggable ?? false}
      height={height}
      src={logo.dataUri}
      width={width}
    />
  );
}
