/**
 * @module @oppulence/events/server-tracker
 * @file Canonical server-side OpenPanel tracker factory used by every Node
 *   service in the monorepo. Each app calls `createServerTracker(config)`
 *   once at module load, binds the result to its project-specific env vars,
 *   and re-exports the bound functions.
 *
 * This module replaces the per-app `analytics.ts` and `analytics-first.ts`
 * files that previously duplicated the same OpenPanel singleton + cost-gate
 * + fire-and-forget pattern across corinthian-api, packages/worker, and
 * future microservices. Cross-cutting features (sampling, batching, retry,
 * metrics) added here flip on for every consumer at once.
 *
 * For Next.js server routes that need cookie-based consent gating, prefer
 * `setupAnalytics` from `@oppulence/events/server` — that path uses
 * `@openpanel/nextjs` and reads `cookies()`. This factory uses the
 * framework-agnostic `@openpanel/sdk` and works in any Node context.
 */

import { OpenPanel, type TrackProperties } from "@openpanel/sdk";
import { count, eq } from "drizzle-orm";
import { isEmissionEnabledFromProcessEnv } from "./gate";

/**
 * Re-export of OpenPanel's `TrackProperties` type so consumers can build
 * payloads without a direct `@openpanel/sdk` dependency. The shape is
 * `Record<string, unknown>` with optional `profileId` and `groups` fields.
 */
export type { TrackProperties } from "@openpanel/sdk";

// Drizzle's strict generics for `PgTable`/`PgColumn` don't compose across
// multiple drizzle-orm installs in the workspace. We accept the db/table/
// column as opaque values here — the call sites are type-checked, and
// inside this helper we just hand them to drizzle's runtime which doesn't
// care about the strict generics. Runtime is fine; this only loosens the
// types at the boundary.
// biome-ignore lint/suspicious/noExplicitAny: opaque drizzle handle
type Opaque = any;

/**
 * Configuration passed to {@link createServerTracker}. Each service binds
 * its own project-specific env vars to these fields and re-exports the
 * resulting tracker.
 */
export interface ServerTrackerConfig {
  /** OpenPanel project client id (public). */
  clientId: string | undefined;
  /** OpenPanel project client secret (server-only). */
  clientSecret: string | undefined;
  /**
   * Human-readable project name for logs and debug output only — e.g.
   * `"canvas"`, `"corinthian"`. Not sent to OpenPanel.
   */
  projectName?: string;
}

/**
 * Arguments for {@link ServerTracker.fireOnceForOrg}. Fires the event only
 * when the organization's row count on `table` (under the optional
 * `extraWhere` filter) is exactly 1 — i.e. when this is the first row of
 * its kind for the org.
 */
export interface FireOnceArgs {
  /** Drizzle Database handle. */
  db: Opaque;
  /** Table to count rows on. */
  table: Opaque;
  /** Column on `table` that holds the organization id. */
  orgColumn: Opaque;
  /** Organization scoping value. */
  organizationId: string;
  /**
   * Optional extra where clause (defaults to `eq(orgColumn, organizationId)`).
   * Use this when "first" needs a status filter — e.g. count only invoices
   * with non-draft status to define "first sent invoice".
   */
  extraWhere?: Opaque;
  /** Event display name (`LogEvents.X.name`). */
  eventName: string;
  /** Event channel (`LogEvents.X.channel`). */
  channel: string;
  /** Optional profile id for OpenPanel attribution. */
  profileId?: string;
  /** Extra properties merged into the OpenPanel payload. */
  properties?: TrackProperties;
}

/**
 * Arguments for {@link ServerTracker.identify}.
 */
export interface IdentifyArgs {
  /** OpenPanel profile id (typically the local user id). */
  profileId: string;
  /** Optional email for OpenPanel profile. */
  email?: string;
  /** Optional first name. */
  firstName?: string;
  /** Optional last name. */
  lastName?: string;
  /** Free-form properties (team id, plan, etc.). */
  properties?: Record<string, unknown>;
}

/**
 * Bound tracker returned by {@link createServerTracker}. Methods are
 * fire-and-forget and never throw — analytics failures must never break a
 * business mutation.
 */
export interface ServerTracker {
  /** True when the tracker is wired to a real OpenPanel client (config valid AND cost gate open). */
  readonly enabled: boolean;
  /**
   * Fires a track event to OpenPanel. No-op when {@link ServerTracker.enabled}
   * is false. Errors are swallowed.
   */
  track: (name: string, properties?: TrackProperties) => void;
  /**
   * Identifies a user against the OpenPanel profile. No-op when disabled.
   */
  identify: (args: IdentifyArgs) => void;
  /**
   * Fires `eventName` only when the org's row-count on `table` is exactly 1
   * (post-insert). Run this AFTER the row has been inserted so the count
   * includes the new row. Errors are swallowed.
   */
  fireOnceForOrg: (args: FireOnceArgs) => Promise<void>;
}

interface Catchable {
  catch: (onRejected: (reason: unknown) => unknown) => unknown;
}

const isCatchable = (value: unknown): value is Catchable =>
  typeof value === "object" &&
  value !== null &&
  "catch" in value &&
  typeof (value as Catchable).catch === "function";

const ignoreAnalyticsRejection = (result: unknown): void => {
  if (!isCatchable(result)) {
    return;
  }

  result.catch(() => {
    // Best-effort.
  });
};

/**
 * Sentinel tracker for tests, CI, and any context where the SDK is
 * intentionally not wired. All methods are no-ops. Useful as a default
 * dependency-injection value.
 */
export const NOOP_SERVER_TRACKER: ServerTracker = {
  enabled: false,
  track: () => {
    // intentional no-op
  },
  identify: () => {
    // intentional no-op
  },
  fireOnceForOrg: async () => {
    // intentional no-op
  },
};

/**
 * Creates a server-side tracker bound to a specific OpenPanel project.
 *
 * The returned tracker is wired to a real `OpenPanel` SDK client only when
 * BOTH credentials are present AND {@link isEmissionEnabledFromProcessEnv}
 * returns true (i.e. production, or `NEXT_PUBLIC_ENABLE_OPENPANEL=true` set
 * explicitly). In any other case the tracker is the {@link NOOP_SERVER_TRACKER}
 * sentinel — every method is a no-op and no network traffic fires.
 *
 * Errors during `track`/`identify`/`fireOnceForOrg` are swallowed: analytics
 * is best-effort and must never interfere with the calling business path.
 *
 * @example
 *   // corinthian-api/src/lib/analytics.ts
 *   import { createServerTracker } from "@oppulence/events/server-tracker";
 *
 *   export const tracker = createServerTracker({
 *     clientId: process.env.CORINTHIAN_OPENPANEL_CLIENT_ID,
 *     clientSecret: process.env.CORINTHIAN_OPENPANEL_SECRET_KEY,
 *     projectName: "corinthian",
 *   });
 *
 *   export const trackServerEvent = (
 *     name: string,
 *     props?: Record<string, unknown>
 *   ) => tracker.track(name, props);
 *   export const fireOnceForOrg = tracker.fireOnceForOrg;
 */
export function createServerTracker(
  config: ServerTrackerConfig,
): ServerTracker {
  if (
    !(
      config.clientId &&
      config.clientSecret &&
      isEmissionEnabledFromProcessEnv()
    )
  ) {
    return NOOP_SERVER_TRACKER;
  }

  const op = new OpenPanel({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });

  return {
    enabled: true,
    track(name, properties) {
      ignoreAnalyticsRejection(op.track(name, properties));
    },
    identify(args) {
      try {
        const result = op.identify({
          profileId: args.profileId,
          email: args.email,
          firstName: args.firstName,
          lastName: args.lastName,
          properties: args.properties,
        });
        ignoreAnalyticsRejection(result);
      } catch {
        // Best-effort.
      }
    },
    async fireOnceForOrg(args) {
      try {
        const [row] = await args.db
          .select({ value: count() })
          .from(args.table)
          .where(args.extraWhere ?? eq(args.orgColumn, args.organizationId));

        if (row?.value !== 1) {
          return;
        }

        ignoreAnalyticsRejection(
          op.track(args.eventName, {
            channel: args.channel,
            profileId: args.profileId,
            properties: args.properties,
          }),
        );
      } catch {
        // Never let analytics break the business mutation.
      }
    },
  };
}
