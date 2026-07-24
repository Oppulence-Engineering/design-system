/**
 * @module @oppulence/events/identity
 * @file Session-driven identify helpers for `@oppulence/events` clients. Dedupes
 *   identify calls per `userId:organizationId` pair so re-renders don't
 *   re-fire identify against OpenPanel.
 */

"use client";

import { useEffect, useRef } from "react";
import { useAnalytics } from "./client";

/**
 * Minimal user shape required for identify. Email is optional — when a privacy
 * policy disallows transmitting PII, callers can pass `undefined`.
 */
interface IdentifyUser {
  id: string;
  email?: string;
  name?: string;
}

/**
 * Optional organization context bundled into identify metadata. Used so
 * OpenPanel dashboards can segment by `teamId` / plan.
 */
interface IdentifyOrganization {
  id: string;
  name?: string;
  plan?: string;
}

/**
 * Hook input. `user` may be `null` while the session is still resolving.
 */
interface UseAnalyticsIdentifyInput {
  user: IdentifyUser | null | undefined;
  organization?: IdentifyOrganization | null;
}

/**
 * Fires `identify()` against the current `AnalyticsProvider` when the session
 * resolves. Dedupes by `userId:organizationId` so identify fires once per
 * user/team pairing across the session.
 *
 * @example
 *   ```tsx
 *   const session = useSession();
 *   useAnalyticsIdentify({
 *     user: session.user,
 *     organization: session.organization,
 *   });
 *   ```
 *
 * @param {UseAnalyticsIdentifyInput} input - Session payload
 */
export function useAnalyticsIdentify({
  user,
  organization,
}: UseAnalyticsIdentifyInput): void {
  const { identify, isTrackingEnabled } = useAnalytics();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      lastKey.current = null;
      return;
    }
    if (!isTrackingEnabled()) {
      return;
    }
    const key = `${user.id}:${organization?.id ?? ""}`;
    if (lastKey.current === key) {
      return;
    }
    lastKey.current = key;

    identify({
      userId: user.id,
      email: user.email,
      metadata: {
        name: user.name,
        teamId: organization?.id,
        teamName: organization?.name,
        plan: organization?.plan,
      },
    });
  }, [
    user,
    organization?.id,
    organization?.name,
    organization?.plan,
    identify,
    isTrackingEnabled,
  ]);
}

/**
 * Drop-in component that calls {@link useAnalyticsIdentify}. Useful inside
 * server-component-rooted layouts where you want to colocate identify with the
 * provider tree rather than reaching into a client auth provider.
 *
 * @param {UseAnalyticsIdentifyInput} props - Same payload as the hook
 * @returns {null} Renders nothing
 */
export function AnalyticsIdentify(props: UseAnalyticsIdentifyInput): null {
  useAnalyticsIdentify(props);
  return null;
}
