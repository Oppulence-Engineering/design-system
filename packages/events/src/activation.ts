/**
 * @module @oppulence/events/activation
 * @file Canonical activation event dictionary and the typed server tracker
 *   that sends it to OpenPanel.
 *
 * Activation events record business outcomes that the product database has
 * already proved (a payment was recovered, a decision was persisted). They
 * are never emitted from a click. Each event names the record that backs it,
 * so every OpenPanel count can be reconciled against the database.
 *
 * Product events (`conduitt_*`, `eigenn_*`) keep their meaning. When one is
 * also a step of the shared lifecycle, it names that step in `feeds` and the
 * tracker sends the shared event too, tagged with `product`. This gives
 * per-product funnels and a portfolio funnel from the same emission.
 *
 * First-occurrence deduplication is the caller's job: the product writes a
 * unique ledger row per (workspace, event) and only calls `track` when the
 * insert succeeded. OpenPanel cannot deduplicate.
 */

import { z } from "zod";
import type { ServerTracker, TrackProperties } from "./server-tracker";

export const ActivationProductSchema = z.enum(["conduitt", "eigenn"]);
export type ActivationProduct = z.infer<typeof ActivationProductSchema>;

export const ActivationEnvironmentSchema = z.enum([
  "production",
  "staging",
  "development",
  "test",
]);
export type ActivationEnvironment = z.infer<typeof ActivationEnvironmentSchema>;

const id = z.string().min(1);
const amountMinor = z.number().int().positive();
const currency = z.string().regex(/^[A-Z]{3}$/);
const provider = z.string().min(1).max(40);
const stage = z.string().min(1).max(60);
const failureReason = z.enum([
  "auth_expired",
  "auth_revoked",
  "auth_abandoned",
  "provider_error",
  "empty_dataset",
  "partial_import",
  "job_failed",
  "unknown",
]);

const recoveredPayment = z.object({
  invoice_id: id,
  payment_id: id,
  amount_minor: amountMinor,
  currency,
});

type EventKind = "milestone" | "repeat" | "diagnostic" | "ux";
type SharedEventName =
  | "signup_completed"
  | "workspace_created"
  | "data_source_connected"
  | "setup_completed"
  | "first_valuable_outcome"
  | "repeat_valuable_outcome"
  | "subscription_started"
  | "subscription_cancelled";

export type ActivationEventDefinition = {
  readonly product: ActivationProduct | "shared";
  readonly kind: EventKind;
  readonly version: number;
  readonly status: "instrumented" | "not_instrumented";
  readonly description: string;
  /** The database record that proves the event happened. */
  readonly backingRecord: string;
  /** `workspace_once`: the caller holds a unique ledger row per workspace. */
  readonly dedup: "workspace_once" | "none";
  readonly feeds?: SharedEventName;
  readonly properties: z.ZodObject;
};

const outcome = z.object({ outcome: z.string().min(1) });

/**
 * The canonical activation dictionary. Names are stable: dashboards and
 * funnels depend on them. Change semantics by bumping `version`, never by
 * renaming. `docs/analytics/activation-events.md` in each consuming repo is
 * generated from this object.
 */
export const ACTIVATION_EVENTS = {
  // ---------------------------------------------------------------- shared
  signup_completed: {
    product: "shared",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description: "A user record was persisted after the auth callback.",
    backingRecord: "users",
    dedup: "workspace_once",
    properties: z.object({ method: z.string().max(40).optional() }),
  },
  workspace_created: {
    product: "shared",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description:
      "A workspace (Eigenn team, Conduitt organization) was persisted.",
    backingRecord: "teams | organizations",
    dedup: "workspace_once",
    properties: z.object({}),
  },
  data_source_connected: {
    product: "shared",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description: "The first usable data connection. Fed by product events.",
    backingRecord: "see feeding product event",
    dedup: "workspace_once",
    properties: outcome,
  },
  setup_completed: {
    product: "shared",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description:
      "The workspace can produce value without more setup. Fed by product events.",
    backingRecord: "see feeding product event",
    dedup: "workspace_once",
    properties: outcome,
  },
  first_valuable_outcome: {
    product: "shared",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description:
      "The product's first-value contract was met. Fed by product events.",
    backingRecord: "see feeding product event",
    dedup: "workspace_once",
    properties: outcome,
  },
  repeat_valuable_outcome: {
    product: "shared",
    kind: "repeat",
    version: 1,
    status: "instrumented",
    description:
      "The first-value outcome happened again in a later week. Fed by product events.",
    backingRecord: "see feeding product event",
    dedup: "workspace_once",
    properties: outcome,
  },
  subscription_started: {
    product: "shared",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description:
      "The billing webhook recorded the first paid subscription period.",
    backingRecord: "subscriptions",
    dedup: "workspace_once",
    properties: z.object({ plan: z.string().min(1).max(60) }),
  },
  subscription_cancelled: {
    product: "shared",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description: "The billing webhook recorded a cancelled subscription.",
    backingRecord: "subscriptions",
    dedup: "none",
    properties: z.object({ plan: z.string().min(1).max(60) }),
  },
  integration_connection_failed: {
    product: "shared",
    kind: "diagnostic",
    version: 1,
    status: "instrumented",
    description: "A provider connection attempt failed. Not a funnel step.",
    backingRecord: "connection row error state",
    dedup: "none",
    properties: z.object({ provider, stage, reason: failureReason }),
  },
  integration_connection_recovered: {
    product: "shared",
    kind: "diagnostic",
    version: 1,
    status: "instrumented",
    description:
      "A failed provider connection became usable again. Not a funnel step.",
    backingRecord: "connection row status",
    dedup: "none",
    properties: z.object({ provider, stage }),
  },
  setup_blocked: {
    product: "shared",
    kind: "diagnostic",
    version: 1,
    status: "instrumented",
    description:
      "Setup stopped on a blocker the user must clear. Not a funnel step.",
    backingRecord: "activation read model blocker",
    dedup: "none",
    properties: z.object({ stage, reason: failureReason }),
  },
  setup_resumed: {
    product: "shared",
    kind: "diagnostic",
    version: 1,
    status: "instrumented",
    description: "A blocked setup stage completed. Not a funnel step.",
    backingRecord: "activation read model blocker cleared",
    dedup: "none",
    properties: z.object({ stage }),
  },

  // -------------------------------------------------------------- conduitt
  conduitt_ar_source_connected: {
    product: "conduitt",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description:
      "An accounting or payment provider connection was persisted as active.",
    backingRecord: "app_connections | stripe_accounts",
    dedup: "workspace_once",
    feeds: "data_source_connected",
    properties: z.object({ provider }),
  },
  conduitt_first_invoice_imported: {
    product: "conduitt",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description: "The first receivable exists in Conduitt, from any source.",
    backingRecord: "invoices",
    dedup: "workspace_once",
    properties: z.object({
      invoice_id: id,
      source: z.enum(["csv", "accounting", "stripe", "manual"]),
    }),
  },
  conduitt_first_actionable_receivable_identified: {
    product: "conduitt",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description: "The first invoice entered a collection stage.",
    backingRecord: "invoices.collection_stage",
    dedup: "workspace_once",
    properties: z.object({ invoice_id: id }),
  },
  conduitt_collection_workflow_activated: {
    product: "conduitt",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description:
      "An owner turned on autopilot or the first sequence enrolled an invoice.",
    backingRecord:
      "autopilot_settings.activated_at | follow_up_sequence_instances",
    dedup: "workspace_once",
    feeds: "setup_completed",
    properties: z.object({ mechanism: z.enum(["autopilot", "sequence"]) }),
  },
  conduitt_first_authorized_communication_sent: {
    product: "conduitt",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description: "The delivery provider accepted the first collection message.",
    backingRecord: "outbound message row with provider id",
    dedup: "workspace_once",
    properties: z.object({
      channel: z.enum(["email", "sms"]),
      invoice_id: id.optional(),
    }),
  },
  conduitt_first_debtor_response_received: {
    product: "conduitt",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description:
      "The first inbound debtor reply was matched to a receivable thread.",
    backingRecord: "inbox messages (inbound)",
    dedup: "workspace_once",
    properties: z.object({ channel: z.enum(["email", "sms", "portal"]) }),
  },
  conduitt_first_resolution_recorded: {
    product: "conduitt",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description: "The first promise-to-pay was recorded or dispute resolved.",
    backingRecord: "payment_promises | collection_disputes",
    dedup: "workspace_once",
    properties: z.object({
      resolution: z.enum(["promise_to_pay", "dispute_resolved"]),
      invoice_id: id,
    }),
  },
  conduitt_first_payment_recovered: {
    product: "conduitt",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description:
      "A settled payment landed on an invoice that Conduitt contacted before the payment date. Counted per payment row, never per message or invoice.",
    backingRecord: "invoice_payments",
    dedup: "workspace_once",
    feeds: "first_valuable_outcome",
    properties: recoveredPayment,
  },
  conduitt_repeat_payment_recovered: {
    product: "conduitt",
    kind: "repeat",
    version: 1,
    status: "instrumented",
    description:
      "A recovered payment on a different invoice, in a later ISO week than the first.",
    backingRecord: "invoice_payments",
    dedup: "workspace_once",
    feeds: "repeat_valuable_outcome",
    properties: recoveredPayment,
  },
  conduitt_first_payment_reconciled: {
    product: "conduitt",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description:
      "The first payment reached reconciliation_status = reconciled.",
    backingRecord: "invoice_payments.reconciliation_status",
    dedup: "workspace_once",
    properties: z.object({ payment_id: id }),
  },
  conduitt_recovered_cash_viewed: {
    product: "conduitt",
    kind: "ux",
    version: 1,
    status: "instrumented",
    description:
      "The customer saw the recovered-cash result card. Browser event.",
    backingRecord: "none (interaction)",
    dedup: "none",
    properties: z.object({}),
  },

  // ---------------------------------------------------------------- eigenn
  eigenn_financial_source_connected: {
    product: "eigenn",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description: "A bank or accounting connection was persisted as active.",
    backingRecord: "bank_connections | app connections",
    dedup: "workspace_once",
    feeds: "data_source_connected",
    properties: z.object({ provider }),
  },
  eigenn_financial_model_populated: {
    product: "eigenn",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description: "The first synced transactions were persisted.",
    backingRecord: "transactions",
    dedup: "workspace_once",
    properties: z.object({ transaction_count: z.number().int().positive() }),
  },
  eigenn_current_position_ready: {
    product: "eigenn",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description: "The first cash forecast completed for the team.",
    backingRecord: "team_business_profile.profile.activation.forecastRanAt",
    dedup: "workspace_once",
    feeds: "setup_completed",
    properties: z.object({}),
  },
  eigenn_first_scenario_created: {
    product: "eigenn",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description: "The first scenario row was persisted.",
    backingRecord: "scenarios",
    dedup: "workspace_once",
    properties: z.object({ scenario_id: id }),
  },
  eigenn_first_scenario_comparison_completed: {
    product: "eigenn",
    kind: "milestone",
    version: 1,
    status: "not_instrumented",
    description: "No persisted comparison record exists yet.",
    backingRecord: "none yet",
    dedup: "workspace_once",
    properties: z.object({}),
  },
  eigenn_first_recommendation_generated: {
    product: "eigenn",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description:
      "The first decision was saved with a recommended decision in its snapshot.",
    backingRecord: "decisions.snapshot",
    dedup: "workspace_once",
    properties: z.object({ decision_id: id }),
  },
  eigenn_first_recommendation_reviewed: {
    product: "eigenn",
    kind: "milestone",
    version: 1,
    status: "not_instrumented",
    description: "No persisted review record exists yet.",
    backingRecord: "none yet",
    dedup: "workspace_once",
    properties: z.object({}),
  },
  eigenn_first_decision_recorded: {
    product: "eigenn",
    kind: "milestone",
    version: 1,
    status: "instrumented",
    description:
      "The first decision reached status `decided` with a frozen snapshot.",
    backingRecord: "decisions",
    dedup: "workspace_once",
    feeds: "first_valuable_outcome",
    properties: z.object({
      decision_id: id,
      decision_kind: z.string().min(1).max(40),
    }),
  },
  eigenn_first_plan_committed: {
    product: "eigenn",
    kind: "milestone",
    version: 1,
    status: "not_instrumented",
    description: "No persisted plan-commit record exists yet.",
    backingRecord: "none yet",
    dedup: "workspace_once",
    properties: z.object({}),
  },
  eigenn_first_recurring_review_completed: {
    product: "eigenn",
    kind: "repeat",
    version: 1,
    status: "instrumented",
    description:
      "A decision moved to `revisited` while at least one checkpoint had a realized actual.",
    backingRecord: "decisions + decision_checkpoints",
    dedup: "workspace_once",
    feeds: "repeat_valuable_outcome",
    properties: z.object({
      decision_id: id,
      checkpoint_count: z.number().int().positive(),
    }),
  },
  eigenn_actual_vs_plan_reviewed: {
    product: "eigenn",
    kind: "ux",
    version: 1,
    status: "instrumented",
    description:
      "The customer opened a decision with realized checkpoints. Browser event.",
    backingRecord: "none (interaction)",
    dedup: "none",
    properties: z.object({ decision_id: id }),
  },
} as const satisfies Record<string, ActivationEventDefinition>;

type Dictionary = typeof ACTIVATION_EVENTS;
export type ActivationEventName = keyof Dictionary;

/** Events a given product's server tracker may send (its own + shared). */
export type TrackableActivationEvent<P extends ActivationProduct> = {
  [N in ActivationEventName]: Dictionary[N]["status"] extends "instrumented"
    ? Dictionary[N]["product"] extends P | "shared"
      ? N
      : never
    : never;
}[ActivationEventName];

export type ActivationEventProperties<N extends ActivationEventName> = z.input<
  Dictionary[N]["properties"]
>;

export type ActivationTrackInput<N extends ActivationEventName> = {
  /** Canonical workspace id: Eigenn `teams.id`, Conduitt `organizations.id`. */
  workspaceId: string;
  /** Canonical application user id. Omit for system-caused outcomes. */
  profileId?: string;
  /** When the backing record says the outcome happened. */
  occurredAt: Date;
  properties: ActivationEventProperties<N>;
};

export type ActivationTrackResult =
  | { sent: true }
  | {
      sent: false;
      reason:
        | "environment"
        | "invalid_properties"
        | "wrong_product"
        | "not_instrumented"
        | "transport_error";
    };

export const WorkspaceGroupPropertiesSchema = z
  .object({
    plan: z.string().max(60),
    trial_state: z.enum(["none", "trialing", "active", "past_due", "canceled"]),
    created_at: z.string(),
    company_size_bucket: z.string().max(20),
    industry: z.string().max(60),
    integration_provider: provider,
    connection_state: z.enum(["not_started", "connected", "error"]),
  })
  .partial();

export type WorkspaceGroupInput = {
  workspaceId: string;
  name: string;
  properties: z.input<typeof WorkspaceGroupPropertiesSchema>;
};

export type ActivationTracker<P extends ActivationProduct> = {
  track: <N extends TrackableActivationEvent<P>>(
    name: N,
    input: ActivationTrackInput<N>,
  ) => ActivationTrackResult;
  upsertWorkspace: (input: WorkspaceGroupInput) => void;
};

export type ActivationTrackerConfig<P extends ActivationProduct> = {
  tracker: ServerTracker;
  product: P;
  environment: ActivationEnvironment;
  appVersion?: string;
};

const SharedInputSchema = z.object({
  workspaceId: z.string().min(1),
  profileId: z.string().min(1).optional(),
  occurredAt: z.date(),
});

const DEFINITIONS: Readonly<Record<string, ActivationEventDefinition>> =
  ACTIVATION_EVENTS;

function definitionFor(name: string): ActivationEventDefinition | undefined {
  return DEFINITIONS[name];
}

/** Every dictionary entry with its name, for docs generation and audits. */
export function listActivationEvents(): ReadonlyArray<
  ActivationEventDefinition & { readonly name: ActivationEventName }
> {
  return (Object.keys(ACTIVATION_EVENTS) as ActivationEventName[]).map(
    (name) => ({ ...DEFINITIONS[name], name }),
  );
}

/**
 * Binds the dictionary to one product and one deployment environment.
 *
 * Only `production` sends. Every other environment returns
 * `{ sent: false, reason: "environment" }`, so staging, CI, and local runs
 * can never reach a production funnel.
 *
 * @example
 *   const activation = createActivationTracker({
 *     tracker, product: "conduitt", environment: env.OPENPANEL_ENVIRONMENT,
 *   });
 *   // Only after the ledger insert for (organizationId, event) succeeded:
 *   activation.track("conduitt_first_payment_recovered", {
 *     workspaceId: organizationId, profileId, occurredAt: payment.paidAt,
 *     properties: { invoice_id, payment_id, amount_minor, currency: "USD" },
 *   });
 */
export function createActivationTracker<P extends ActivationProduct>(
  config: ActivationTrackerConfig<P>,
): ActivationTracker<P> {
  const envelope = (
    input: z.infer<typeof SharedInputSchema>,
    version: number,
  ) => ({
    ...(input.profileId ? { profileId: input.profileId } : {}),
    groups: [input.workspaceId],
    workspace_id: input.workspaceId,
    product: config.product,
    environment: config.environment,
    app_version: config.appVersion ?? "unknown",
    event_version: version,
    source: "server",
    occurred_at: input.occurredAt.toISOString(),
  });

  const send = (name: string, properties: TrackProperties): boolean => {
    try {
      config.tracker.track(name, properties);
      return true;
    } catch {
      return false;
    }
  };

  return {
    track(name, input) {
      const definition = definitionFor(name);
      if (!definition || definition.status !== "instrumented") {
        return { sent: false, reason: "not_instrumented" };
      }
      if (
        definition.product !== "shared" &&
        definition.product !== config.product
      ) {
        return { sent: false, reason: "wrong_product" };
      }
      const shared = SharedInputSchema.safeParse(input);
      const properties = definition.properties.safeParse(input.properties);
      if (!(shared.success && properties.success)) {
        return { sent: false, reason: "invalid_properties" };
      }
      if (config.environment !== "production") {
        return { sent: false, reason: "environment" };
      }
      const sent = send(name, {
        ...properties.data,
        ...envelope(shared.data, definition.version),
      });
      if (sent && definition.feeds) {
        send(definition.feeds, {
          outcome: name,
          ...envelope(shared.data, ACTIVATION_EVENTS[definition.feeds].version),
        });
      }
      return sent ? { sent: true } : { sent: false, reason: "transport_error" };
    },

    upsertWorkspace(input) {
      if (config.environment !== "production") return;
      const properties = WorkspaceGroupPropertiesSchema.strip().safeParse(
        input.properties,
      );
      if (!properties.success) return;
      try {
        config.tracker.upsertGroup({
          id: input.workspaceId,
          type: "workspace",
          name: input.name,
          properties: { ...properties.data, product: config.product },
        });
      } catch {
        // Best-effort: group metadata must never break the caller.
      }
    },
  };
}
