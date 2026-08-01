import { createHash } from "node:crypto";

import { z } from "zod";

import { ProductSchema, type Product } from "../contracts";
import type { IntegrationCredentialReference } from "./credentials";

/**
 * How a trigger observes provider events. The lifecycle a runtime must own
 * differs per kind, so this is modelled explicitly rather than flattened into
 * a single webhook shape.
 */
export type IntegrationTriggerKind = "webhook" | "poll" | "subscription";

export interface IntegrationTriggerConnection {
  connectionId: string;
  integrationId: string;
  product: Product;
  subjectId: string;
}

/**
 * A safe projection of one provider event. Sources emit these; raw payloads,
 * headers, signatures, and credentials never reach a product.
 */
export interface IntegrationTriggerEventDraft {
  /** Safe provider event name, for example "issue.created". */
  providerEvent: string;
  /** Provider-supplied identity, preferred over a derived digest. */
  externalId?: string;
  /** ISO-8601 timestamp reported by the provider. */
  occurredAt?: string;
  /** Validated projection the source chose to expose. */
  data?: unknown;
}

export interface IntegrationTriggerEvent extends IntegrationTriggerEventDraft {
  integrationId: string;
  triggerId: string;
  connection: IntegrationTriggerConnection;
  /** Stable SHA-256 key; a replayed delivery derives the same value. */
  idempotencyKey: string;
  receivedAt: string;
}

export interface IntegrationTriggerDelivery {
  connection: IntegrationTriggerConnection;
  events: readonly IntegrationTriggerEventDraft[];
}

interface IntegrationTriggerSourceBase {
  readonly integrationId: string;
  readonly triggerId: string;
}

export interface IntegrationWebhookTriggerSource extends IntegrationTriggerSourceBase {
  readonly kind: "webhook";
  /**
   * Verifies the provider signature against the original request bytes and
   * resolves the owning connection. Returning undefined rejects the delivery.
   */
  verify(input: {
    rawBody: Uint8Array;
    headers: Headers;
  }): Promise<IntegrationTriggerDelivery | undefined>;
}

export interface IntegrationPollTriggerSource extends IntegrationTriggerSourceBase {
  readonly kind: "poll";
  /** Minimum seconds between polls; the runtime refuses to run sooner. */
  readonly intervalSeconds: number;
  poll(input: {
    reference: IntegrationCredentialReference;
    cursor: string | undefined;
  }): Promise<{
    events: readonly IntegrationTriggerEventDraft[];
    cursor?: string;
  }>;
}

export interface IntegrationSubscriptionTriggerSource extends IntegrationTriggerSourceBase {
  readonly kind: "subscription";
  /** Renew this many seconds before expiry. Defaults to 900. */
  readonly renewWithinSeconds?: number;
  subscribe(input: {
    reference: IntegrationCredentialReference;
    callbackUrl: string;
  }): Promise<{ subscriptionId: string; expiresAt?: string }>;
  renew?(input: {
    reference: IntegrationCredentialReference;
    subscriptionId: string;
  }): Promise<{ expiresAt?: string }>;
  unsubscribe(input: {
    reference: IntegrationCredentialReference;
    subscriptionId: string;
  }): Promise<void>;
  verify(input: {
    rawBody: Uint8Array;
    headers: Headers;
    subscriptionId: string | undefined;
  }): Promise<IntegrationTriggerDelivery | undefined>;
}

export type IntegrationTriggerSource =
  | IntegrationWebhookTriggerSource
  | IntegrationPollTriggerSource
  | IntegrationSubscriptionTriggerSource;

export interface IntegrationTriggerCheckpointKey {
  connectionId: string;
  integrationId: string;
  product: Product;
  triggerId: string;
}

export interface IntegrationTriggerCheckpoint {
  /** Opaque provider cursor for poll sources. */
  cursor?: string;
  subscriptionId?: string;
  subscriptionExpiresAt?: string;
  lastEventAt?: string;
  lastRunAt?: string;
  lastErrorAt?: string;
  consecutiveFailures: number;
}

/**
 * Durable trigger state. Products own storage, exactly as they own the
 * credential vault; the package owns what is written and when.
 */
export interface IntegrationTriggerStore {
  readCheckpoint(
    key: IntegrationTriggerCheckpointKey,
  ): Promise<IntegrationTriggerCheckpoint | undefined>;
  saveCheckpoint(
    key: IntegrationTriggerCheckpointKey,
    checkpoint: IntegrationTriggerCheckpoint,
  ): Promise<void>;
  deleteCheckpoint(key: IntegrationTriggerCheckpointKey): Promise<void>;
  /**
   * Records a delivery key. Returns false when the key was already present,
   * which is how the runtime suppresses a replay. Implementations should make
   * this atomic and expire rows at `expiresAt`.
   */
  recordDelivery(input: {
    key: IntegrationTriggerCheckpointKey;
    idempotencyKey: string;
    expiresAt: string;
  }): Promise<boolean>;
  deleteDeliveries(key: IntegrationTriggerCheckpointKey): Promise<void>;
}

export type IntegrationTriggerAuditAction =
  | "subscribed"
  | "renewed"
  | "unsubscribed"
  | "delivered"
  | "duplicate"
  | "failed";

export interface IntegrationTriggerAuditRecord {
  action: IntegrationTriggerAuditAction;
  integrationId: string;
  triggerId: string;
  connectionId?: string;
  product?: Product;
  idempotencyKey?: string;
  detail?: string;
  at: string;
}

export interface IntegrationTriggerRuntimeConfig {
  sources: readonly IntegrationTriggerSource[];
  store: IntegrationTriggerStore;
  /**
   * Product seam. Receives credential-free events only. Throwing marks the
   * delivery failed and leaves the idempotency key unrecorded so the provider
   * may safely retry.
   */
  onEvent(event: IntegrationTriggerEvent): Promise<void>;
  audit?(record: IntegrationTriggerAuditRecord): Promise<void>;
  /** Attempts per event before the delivery is reported failed. Default 3. */
  maxAttempts?: number;
  /** Idempotency-key retention. Default 7 days, bounded to 30. */
  deliveryRetentionSeconds?: number;
  /** Marks a trigger stale after this long with no event. Default 24 hours. */
  freshnessSeconds?: number;
  now?: () => Date;
}

export type IntegrationTriggerHealthState =
  | "healthy"
  | "stale"
  | "failing"
  | "unregistered";

export interface IntegrationTriggerHealth {
  integrationId: string;
  triggerId: string;
  kind: IntegrationTriggerKind;
  state: IntegrationTriggerHealthState;
  lastEventAt?: string;
  lastRunAt?: string;
  consecutiveFailures: number;
  /** Seconds since the last observed event, when one has been seen. */
  freshnessSeconds?: number;
  subscriptionExpiresAt?: string;
}

export interface IntegrationTriggerDeliveryResult {
  integrationId: string;
  triggerId: string;
  accepted: true;
  delivered: number;
  duplicates: number;
}

export interface IntegrationTriggerPollResult extends IntegrationTriggerDeliveryResult {
  cursor?: string;
}

export interface IntegrationTriggerRuntime {
  /** Handles a verified inbound webhook or subscription notification. */
  deliver(input: {
    integrationId: string;
    triggerId: string;
    rawBody: Uint8Array;
    headers: Headers;
  }): Promise<IntegrationTriggerDeliveryResult>;
  poll(input: {
    reference: IntegrationCredentialReference;
    subjectId: string;
    triggerId: string;
    force?: boolean;
  }): Promise<IntegrationTriggerPollResult>;
  subscribe(input: {
    reference: IntegrationCredentialReference;
    triggerId: string;
    callbackUrl: string;
  }): Promise<{ subscriptionId: string; expiresAt?: string }>;
  /** Renews only when the subscription is inside its renewal window. */
  renewDue(input: {
    reference: IntegrationCredentialReference;
    triggerId: string;
  }): Promise<{ renewed: boolean; expiresAt?: string }>;
  /** Unsubscribes every registered trigger and clears durable state. */
  disconnect(reference: IntegrationCredentialReference): Promise<void>;
  getHealth(input: {
    reference: IntegrationCredentialReference;
    triggerId: string;
  }): Promise<IntegrationTriggerHealth>;
  listSources(): readonly {
    integrationId: string;
    triggerId: string;
    kind: IntegrationTriggerKind;
  }[];
}

export class IntegrationTriggerError extends Error {
  readonly code:
    | "INTEGRATION_TRIGGER_SOURCE_UNAVAILABLE"
    | "INTEGRATION_TRIGGER_CONFIGURATION_INVALID"
    | "INTEGRATION_TRIGGER_SIGNATURE_INVALID"
    | "INTEGRATION_TRIGGER_PAYLOAD_INVALID"
    | "INTEGRATION_TRIGGER_DELIVERY_FAILED"
    | "INTEGRATION_TRIGGER_SUBSCRIPTION_FAILED"
    | "INTEGRATION_TRIGGER_NOT_DUE";

  constructor(code: IntegrationTriggerError["code"]) {
    super("The integration trigger request could not be completed.");
    this.name = "IntegrationTriggerError";
    this.code = code;
  }
}

const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_ATTEMPTS = 10;
const DEFAULT_RETENTION_SECONDS = 7 * 24 * 60 * 60;
const MAX_RETENTION_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_FRESHNESS_SECONDS = 24 * 60 * 60;
const DEFAULT_RENEW_WITHIN_SECONDS = 900;
const MAX_EVENTS_PER_DELIVERY = 1_000;

const ConnectionSchema = z
  .object({
    connectionId: z.string().min(1).max(320),
    integrationId: z.string().min(1).max(160),
    product: ProductSchema,
    subjectId: z.string().min(1).max(320),
  })
  .strict();

const EventDraftSchema = z
  .object({
    providerEvent: z.string().min(1).max(200),
    externalId: z.string().min(1).max(320).optional(),
    occurredAt: z.string().datetime({ offset: true }).optional(),
    data: z.unknown().optional(),
  })
  .strict();

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
}

/**
 * Prefers the provider's own event identity and falls back to a digest of the
 * projected event, so a redelivered webhook resolves to the same key whether
 * or not the provider supplies an ID.
 */
function idempotencyKeyFor(input: {
  integrationId: string;
  triggerId: string;
  connectionId: string;
  event: IntegrationTriggerEventDraft;
}): string {
  const identity =
    input.event.externalId ??
    stableStringify({
      providerEvent: input.event.providerEvent,
      occurredAt: input.event.occurredAt,
      data: input.event.data,
    });
  return createHash("sha256")
    .update(
      [input.integrationId, input.triggerId, input.connectionId, identity].join(
        " ",
      ),
    )
    .digest("hex");
}

function boundedSeconds(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > maximum) {
    throw new IntegrationTriggerError(
      "INTEGRATION_TRIGGER_CONFIGURATION_INVALID",
    );
  }
  return resolved;
}

function checkpointKey(input: {
  connectionId: string;
  integrationId: string;
  product: Product;
  triggerId: string;
}): IntegrationTriggerCheckpointKey {
  return {
    connectionId: input.connectionId,
    integrationId: input.integrationId,
    product: input.product,
    triggerId: input.triggerId,
  };
}

function emptyCheckpoint(): IntegrationTriggerCheckpoint {
  return { consecutiveFailures: 0 };
}

/**
 * Owns the trigger lifecycle the source providers deliberately do not: replay
 * suppression, cursor and subscription persistence, retry with a bounded
 * attempt count, unsubscription on disconnect, audit records, and freshness
 * reporting. Sources contribute only verification and provider I/O.
 */
export function createIntegrationTriggerRuntime(
  config: IntegrationTriggerRuntimeConfig,
): IntegrationTriggerRuntime {
  const now = config.now ?? (() => new Date());
  const maxAttempts = boundedSeconds(
    config.maxAttempts,
    DEFAULT_MAX_ATTEMPTS,
    MAX_ATTEMPTS,
  );
  const retentionSeconds = boundedSeconds(
    config.deliveryRetentionSeconds,
    DEFAULT_RETENTION_SECONDS,
    MAX_RETENTION_SECONDS,
  );
  const freshnessSeconds = boundedSeconds(
    config.freshnessSeconds,
    DEFAULT_FRESHNESS_SECONDS,
    MAX_RETENTION_SECONDS,
  );

  const sources = new Map<string, IntegrationTriggerSource>();
  for (const source of config.sources) {
    if (
      !source.integrationId ||
      !source.triggerId ||
      !source.triggerId.startsWith(`${source.integrationId}:`)
    ) {
      throw new IntegrationTriggerError(
        "INTEGRATION_TRIGGER_CONFIGURATION_INVALID",
      );
    }
    const key = `${source.integrationId} ${source.triggerId}`;
    if (sources.has(key)) {
      throw new IntegrationTriggerError(
        "INTEGRATION_TRIGGER_CONFIGURATION_INVALID",
      );
    }
    if (source.kind === "poll") {
      boundedSeconds(source.intervalSeconds, 60, MAX_RETENTION_SECONDS);
    }
    sources.set(key, source);
  }

  function sourceFor(
    integrationId: string,
    triggerId: string,
  ): IntegrationTriggerSource {
    const source = sources.get(`${integrationId} ${triggerId}`);
    if (!source) {
      throw new IntegrationTriggerError(
        "INTEGRATION_TRIGGER_SOURCE_UNAVAILABLE",
      );
    }
    return source;
  }

  async function audit(
    record: Omit<IntegrationTriggerAuditRecord, "at">,
  ): Promise<void> {
    if (!config.audit) return;
    try {
      await config.audit({ ...record, at: now().toISOString() });
    } catch {
      // An audit sink must never mask or fail a provider delivery.
    }
  }

  async function readCheckpoint(
    key: IntegrationTriggerCheckpointKey,
  ): Promise<IntegrationTriggerCheckpoint> {
    return (await config.store.readCheckpoint(key)) ?? emptyCheckpoint();
  }

  /**
   * Records the key first and emits second, then releases the key when the
   * product handler exhausts its attempts. This keeps a concurrent redelivery
   * from double-emitting while still letting the provider retry a failure.
   */
  async function emit(
    key: IntegrationTriggerCheckpointKey,
    event: IntegrationTriggerEvent,
  ): Promise<"delivered" | "duplicate"> {
    const expiresAt = new Date(
      now().getTime() + retentionSeconds * 1_000,
    ).toISOString();
    const fresh = await config.store.recordDelivery({
      key,
      idempotencyKey: event.idempotencyKey,
      expiresAt,
    });
    if (!fresh) {
      await audit({
        action: "duplicate",
        integrationId: event.integrationId,
        triggerId: event.triggerId,
        connectionId: event.connection.connectionId,
        product: event.connection.product,
        idempotencyKey: event.idempotencyKey,
      });
      return "duplicate";
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        await config.onEvent(event);
        await audit({
          action: "delivered",
          integrationId: event.integrationId,
          triggerId: event.triggerId,
          connectionId: event.connection.connectionId,
          product: event.connection.product,
          idempotencyKey: event.idempotencyKey,
        });
        return "delivered";
      } catch (error) {
        lastError = error;
      }
    }
    await audit({
      action: "failed",
      integrationId: event.integrationId,
      triggerId: event.triggerId,
      connectionId: event.connection.connectionId,
      product: event.connection.product,
      idempotencyKey: event.idempotencyKey,
      detail: lastError instanceof Error ? lastError.name : undefined,
    });
    throw new IntegrationTriggerError("INTEGRATION_TRIGGER_DELIVERY_FAILED");
  }

  async function dispatch(input: {
    source: IntegrationTriggerSource;
    delivery: IntegrationTriggerDelivery;
  }): Promise<{ delivered: number; duplicates: number }> {
    const connection = ConnectionSchema.parse(input.delivery.connection);
    if (connection.integrationId !== input.source.integrationId) {
      throw new IntegrationTriggerError("INTEGRATION_TRIGGER_PAYLOAD_INVALID");
    }
    if (input.delivery.events.length > MAX_EVENTS_PER_DELIVERY) {
      throw new IntegrationTriggerError("INTEGRATION_TRIGGER_PAYLOAD_INVALID");
    }
    const key = checkpointKey({
      connectionId: connection.connectionId,
      integrationId: connection.integrationId,
      product: connection.product,
      triggerId: input.source.triggerId,
    });
    const receivedAt = now().toISOString();
    let delivered = 0;
    let duplicates = 0;
    let latestEventAt: string | undefined;
    let failure: unknown;

    for (const raw of input.delivery.events) {
      const parsed = EventDraftSchema.safeParse(raw);
      if (!parsed.success) {
        throw new IntegrationTriggerError(
          "INTEGRATION_TRIGGER_PAYLOAD_INVALID",
        );
      }
      const draft = parsed.data;
      const event: IntegrationTriggerEvent = {
        ...draft,
        integrationId: input.source.integrationId,
        triggerId: input.source.triggerId,
        connection,
        receivedAt,
        idempotencyKey: idempotencyKeyFor({
          integrationId: input.source.integrationId,
          triggerId: input.source.triggerId,
          connectionId: connection.connectionId,
          event: draft,
        }),
      };
      try {
        const outcome = await emit(key, event);
        if (outcome === "delivered") delivered += 1;
        else duplicates += 1;
      } catch (error) {
        failure = error;
        break;
      }
      if (
        draft.occurredAt &&
        (!latestEventAt || draft.occurredAt > latestEventAt)
      ) {
        latestEventAt = draft.occurredAt;
      }
    }

    const checkpoint = await readCheckpoint(key);
    await config.store.saveCheckpoint(key, {
      ...checkpoint,
      lastRunAt: receivedAt,
      ...(delivered > 0
        ? { lastEventAt: latestEventAt ?? receivedAt }
        : undefined),
      ...(failure
        ? {
            lastErrorAt: receivedAt,
            consecutiveFailures: checkpoint.consecutiveFailures + 1,
          }
        : { consecutiveFailures: 0 }),
    });
    if (failure) throw failure;
    return { delivered, duplicates };
  }

  return {
    listSources() {
      return [...sources.values()].map((source) => ({
        integrationId: source.integrationId,
        triggerId: source.triggerId,
        kind: source.kind,
      }));
    },

    async deliver(input) {
      const source = sourceFor(input.integrationId, input.triggerId);
      if (source.kind === "poll") {
        throw new IntegrationTriggerError(
          "INTEGRATION_TRIGGER_SOURCE_UNAVAILABLE",
        );
      }
      const delivery =
        source.kind === "webhook"
          ? await source.verify({
              rawBody: input.rawBody,
              headers: input.headers,
            })
          : await source.verify({
              rawBody: input.rawBody,
              headers: input.headers,
              subscriptionId: undefined,
            });
      if (!delivery) {
        throw new IntegrationTriggerError(
          "INTEGRATION_TRIGGER_SIGNATURE_INVALID",
        );
      }
      const counts = await dispatch({ source, delivery });
      return {
        integrationId: source.integrationId,
        triggerId: source.triggerId,
        accepted: true,
        ...counts,
      };
    },

    async poll(input) {
      const source = sourceFor(input.reference.integrationId, input.triggerId);
      if (source.kind !== "poll") {
        throw new IntegrationTriggerError(
          "INTEGRATION_TRIGGER_SOURCE_UNAVAILABLE",
        );
      }
      const key = checkpointKey({
        connectionId: input.reference.connectionId,
        integrationId: input.reference.integrationId,
        product: input.reference.product,
        triggerId: input.triggerId,
      });
      const checkpoint = await readCheckpoint(key);
      const currentTime = now().getTime();
      if (!input.force && checkpoint.lastRunAt) {
        const elapsed = currentTime - Date.parse(checkpoint.lastRunAt);
        if (elapsed < source.intervalSeconds * 1_000) {
          throw new IntegrationTriggerError("INTEGRATION_TRIGGER_NOT_DUE");
        }
      }
      const result = await source.poll({
        reference: input.reference,
        cursor: checkpoint.cursor,
      });
      const counts = await dispatch({
        source,
        delivery: {
          connection: {
            connectionId: input.reference.connectionId,
            integrationId: input.reference.integrationId,
            product: input.reference.product,
            subjectId: input.subjectId,
          },
          events: result.events,
        },
      });
      if (result.cursor !== undefined && result.cursor !== checkpoint.cursor) {
        const advanced = await readCheckpoint(key);
        await config.store.saveCheckpoint(key, {
          ...advanced,
          cursor: result.cursor,
        });
      }
      return {
        integrationId: source.integrationId,
        triggerId: source.triggerId,
        accepted: true,
        ...counts,
        ...(result.cursor === undefined ? {} : { cursor: result.cursor }),
      };
    },

    async subscribe(input) {
      const source = sourceFor(input.reference.integrationId, input.triggerId);
      if (source.kind !== "subscription") {
        throw new IntegrationTriggerError(
          "INTEGRATION_TRIGGER_SOURCE_UNAVAILABLE",
        );
      }
      let registration: { subscriptionId: string; expiresAt?: string };
      try {
        registration = await source.subscribe({
          reference: input.reference,
          callbackUrl: input.callbackUrl,
        });
      } catch {
        throw new IntegrationTriggerError(
          "INTEGRATION_TRIGGER_SUBSCRIPTION_FAILED",
        );
      }
      const key = checkpointKey({
        connectionId: input.reference.connectionId,
        integrationId: input.reference.integrationId,
        product: input.reference.product,
        triggerId: input.triggerId,
      });
      const checkpoint = await readCheckpoint(key);
      await config.store.saveCheckpoint(key, {
        ...checkpoint,
        subscriptionId: registration.subscriptionId,
        ...(registration.expiresAt
          ? { subscriptionExpiresAt: registration.expiresAt }
          : {}),
      });
      await audit({
        action: "subscribed",
        integrationId: source.integrationId,
        triggerId: source.triggerId,
        connectionId: input.reference.connectionId,
        product: input.reference.product,
      });
      return registration;
    },

    async renewDue(input) {
      const source = sourceFor(input.reference.integrationId, input.triggerId);
      if (source.kind !== "subscription" || !source.renew) {
        throw new IntegrationTriggerError(
          "INTEGRATION_TRIGGER_SOURCE_UNAVAILABLE",
        );
      }
      const key = checkpointKey({
        connectionId: input.reference.connectionId,
        integrationId: input.reference.integrationId,
        product: input.reference.product,
        triggerId: input.triggerId,
      });
      const checkpoint = await readCheckpoint(key);
      if (!checkpoint.subscriptionId) {
        throw new IntegrationTriggerError(
          "INTEGRATION_TRIGGER_SUBSCRIPTION_FAILED",
        );
      }
      const window =
        (source.renewWithinSeconds ?? DEFAULT_RENEW_WITHIN_SECONDS) * 1_000;
      if (
        checkpoint.subscriptionExpiresAt &&
        Date.parse(checkpoint.subscriptionExpiresAt) - now().getTime() > window
      ) {
        return { renewed: false };
      }
      let renewal: { expiresAt?: string };
      try {
        renewal = await source.renew({
          reference: input.reference,
          subscriptionId: checkpoint.subscriptionId,
        });
      } catch {
        throw new IntegrationTriggerError(
          "INTEGRATION_TRIGGER_SUBSCRIPTION_FAILED",
        );
      }
      await config.store.saveCheckpoint(key, {
        ...checkpoint,
        ...(renewal.expiresAt
          ? { subscriptionExpiresAt: renewal.expiresAt }
          : {}),
      });
      await audit({
        action: "renewed",
        integrationId: source.integrationId,
        triggerId: source.triggerId,
        connectionId: input.reference.connectionId,
        product: input.reference.product,
      });
      return { renewed: true, ...renewal };
    },

    async disconnect(reference) {
      for (const source of sources.values()) {
        if (source.integrationId !== reference.integrationId) continue;
        const key = checkpointKey({
          connectionId: reference.connectionId,
          integrationId: reference.integrationId,
          product: reference.product,
          triggerId: source.triggerId,
        });
        const checkpoint = await config.store.readCheckpoint(key);
        if (source.kind === "subscription" && checkpoint?.subscriptionId) {
          try {
            await source.unsubscribe({
              reference,
              subscriptionId: checkpoint.subscriptionId,
            });
            await audit({
              action: "unsubscribed",
              integrationId: source.integrationId,
              triggerId: source.triggerId,
              connectionId: reference.connectionId,
              product: reference.product,
            });
          } catch {
            // A provider that already dropped the subscription must not block
            // local cleanup; the checkpoint is removed either way.
            await audit({
              action: "failed",
              integrationId: source.integrationId,
              triggerId: source.triggerId,
              connectionId: reference.connectionId,
              product: reference.product,
              detail: "unsubscribe",
            });
          }
        }
        await config.store.deleteDeliveries(key);
        await config.store.deleteCheckpoint(key);
      }
    },

    async getHealth(input) {
      const source = sourceFor(input.reference.integrationId, input.triggerId);
      const key = checkpointKey({
        connectionId: input.reference.connectionId,
        integrationId: input.reference.integrationId,
        product: input.reference.product,
        triggerId: input.triggerId,
      });
      const checkpoint = await config.store.readCheckpoint(key);
      if (!checkpoint) {
        return {
          integrationId: source.integrationId,
          triggerId: source.triggerId,
          kind: source.kind,
          state: "unregistered",
          consecutiveFailures: 0,
        };
      }
      const elapsedSeconds = checkpoint.lastEventAt
        ? Math.max(
            0,
            Math.floor(
              (now().getTime() - Date.parse(checkpoint.lastEventAt)) / 1_000,
            ),
          )
        : undefined;
      const state: IntegrationTriggerHealthState =
        checkpoint.consecutiveFailures > 0
          ? "failing"
          : elapsedSeconds !== undefined && elapsedSeconds > freshnessSeconds
            ? "stale"
            : "healthy";
      return {
        integrationId: source.integrationId,
        triggerId: source.triggerId,
        kind: source.kind,
        state,
        consecutiveFailures: checkpoint.consecutiveFailures,
        ...(checkpoint.lastEventAt
          ? { lastEventAt: checkpoint.lastEventAt }
          : {}),
        ...(checkpoint.lastRunAt ? { lastRunAt: checkpoint.lastRunAt } : {}),
        ...(elapsedSeconds === undefined
          ? {}
          : { freshnessSeconds: elapsedSeconds }),
        ...(checkpoint.subscriptionExpiresAt
          ? { subscriptionExpiresAt: checkpoint.subscriptionExpiresAt }
          : {}),
      };
    },
  };
}

export interface IntegrationTriggerRoutesConfig {
  runtime: IntegrationTriggerRuntime;
  /** Defaults to `/integrations`. */
  basePath?: string;
  /** Bounds the accepted body. Defaults to 1 MiB. */
  maxBodyBytes?: number;
}

const DEFAULT_MAX_BODY_BYTES = 1_048_576;

/**
 * Mounts trigger delivery at
 * `POST /:integrationId/triggers/:triggerId`. Signature verification belongs
 * to the source, so the route only bounds the body and maps failures to a
 * status without leaking which check rejected the request.
 */
export function createIntegrationTriggerRoutes(
  config: IntegrationTriggerRoutesConfig,
): { handle(request: Request): Promise<Response | undefined> } {
  const basePath = config.basePath ?? "/integrations";
  const maxBodyBytes = config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return {
    async handle(request) {
      const url = new URL(request.url);
      if (!url.pathname.startsWith(`${basePath}/`)) return undefined;
      const segments = url.pathname.slice(basePath.length + 1).split("/");
      if (segments.length !== 3 || segments[1] !== "triggers") return undefined;
      if (request.method !== "POST") {
        return new Response(null, { status: 405 });
      }
      const [integrationId, , triggerId] = segments;
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength > maxBodyBytes) {
        return new Response(null, { status: 413 });
      }
      try {
        const result = await config.runtime.deliver({
          integrationId: decodeURIComponent(integrationId),
          triggerId: decodeURIComponent(triggerId),
          rawBody: new Uint8Array(buffer),
          headers: request.headers,
        });
        return Response.json(result, { status: 202 });
      } catch (error) {
        if (error instanceof IntegrationTriggerError) {
          const status =
            error.code === "INTEGRATION_TRIGGER_SOURCE_UNAVAILABLE"
              ? 404
              : error.code === "INTEGRATION_TRIGGER_SIGNATURE_INVALID"
                ? 401
                : error.code === "INTEGRATION_TRIGGER_PAYLOAD_INVALID"
                  ? 400
                  : 500;
          return new Response(null, { status });
        }
        return new Response(null, { status: 500 });
      }
    },
  };
}

/**
 * An in-memory store for tests and local development. Products supply a
 * durable implementation; trigger state must survive a restart.
 */
export function createInMemoryIntegrationTriggerStore(): IntegrationTriggerStore {
  const checkpoints = new Map<string, IntegrationTriggerCheckpoint>();
  const deliveries = new Map<string, Map<string, number>>();
  const serialize = (key: IntegrationTriggerCheckpointKey): string =>
    [key.product, key.integrationId, key.connectionId, key.triggerId].join(" ");

  return {
    async readCheckpoint(key) {
      return checkpoints.get(serialize(key));
    },
    async saveCheckpoint(key, checkpoint) {
      checkpoints.set(serialize(key), checkpoint);
    },
    async deleteCheckpoint(key) {
      checkpoints.delete(serialize(key));
    },
    async recordDelivery({ key, idempotencyKey, expiresAt }) {
      const serialized = serialize(key);
      const seen = deliveries.get(serialized) ?? new Map<string, number>();
      deliveries.set(serialized, seen);
      const expiry = Date.parse(expiresAt);
      const existing = seen.get(idempotencyKey);
      if (existing !== undefined && existing > Date.now()) return false;
      seen.set(idempotencyKey, expiry);
      return true;
    },
    async deleteDeliveries(key) {
      deliveries.delete(serialize(key));
    },
  };
}
