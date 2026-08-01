import { timingSafeEqual } from "node:crypto";

import type { IntegrationCredentialReference } from "../../credentials";
import type { IntegrationOAuthRuntime } from "../../runtime";
import type {
  IntegrationPollTriggerSource,
  IntegrationSubscriptionTriggerSource,
  IntegrationTriggerConnection,
  IntegrationTriggerDelivery,
  IntegrationTriggerEventDraft,
  IntegrationWebhookTriggerSource,
} from "../../triggers";
import {
  createMicrosoftGraphClient,
  graphOutput,
  type MicrosoftGraphClientFactory,
} from "./client";

/** Graph caps a change-notification subscription at just under three days. */
const MAX_SUBSCRIPTION_MINUTES = 4_230;
const DEFAULT_POLL_INTERVAL_SECONDS = 300;

function safeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

function expiry(minutes: number, now: () => Date): string {
  return new Date(now().getTime() + minutes * 60_000).toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export interface MicrosoftGraphTriggerConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: MicrosoftGraphClientFactory;
  now?: () => Date;
}

export interface OutlookPollTriggerConfig extends MicrosoftGraphTriggerConfig {
  /** Defaults to 300 seconds. */
  intervalSeconds?: number;
}

/**
 * Polls the signed-in mailbox for messages received after the last checkpoint.
 * The cursor is the newest `receivedDateTime` observed, so a restart resumes
 * without replaying the mailbox.
 */
export function createOutlookPollTriggerSource(
  config: OutlookPollTriggerConfig,
): IntegrationPollTriggerSource {
  const clientFactory = config.clientFactory ?? createMicrosoftGraphClient;
  return {
    kind: "poll",
    integrationId: "outlook",
    triggerId: "outlook:outlook-poller",
    intervalSeconds: config.intervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS,
    async poll({ reference, cursor }) {
      return config.oauthRuntime.withCredential(
        reference,
        async (credential) => {
          const client = clientFactory(credential.accessToken);
          const query: Record<string, unknown> = {
            $orderby: "receivedDateTime desc",
            $top: 50,
            $select: "id,subject,receivedDateTime,from,isRead,conversationId",
          };
          if (cursor) {
            query.$filter = `receivedDateTime gt ${cursor}`;
          }
          const response = asRecord(
            await client.api("/me/messages").query(query).get(),
          );
          const messages = Array.isArray(response?.value) ? response.value : [];
          const events: IntegrationTriggerEventDraft[] = messages.flatMap(
            (message) => {
              const record = asRecord(message);
              if (!record?.id) return [];
              const receivedAt =
                typeof record.receivedDateTime === "string"
                  ? record.receivedDateTime
                  : undefined;
              return [
                {
                  providerEvent: "message.received",
                  externalId: String(record.id),
                  ...(receivedAt ? { occurredAt: receivedAt } : {}),
                  data: graphOutput(record),
                },
              ];
            },
          );
          // The query is newest-first, so the first result carries the cursor.
          const newest = events[0]?.occurredAt;
          return {
            events: [...events].reverse(),
            ...(newest ? { cursor: newest } : {}),
          };
        },
      );
    },
  };
}

export interface MicrosoftTeamsSubscriptionTriggerConfig extends MicrosoftGraphTriggerConfig {
  /**
   * Product lookup mapping a Graph subscription back to an authorized
   * connection. The package never stores tenant records itself.
   */
  resolveConnection(input: {
    subscriptionId: string;
    resource?: string;
  }): Promise<IntegrationTriggerConnection | undefined>;
  /** Opaque value Graph echoes back; used to authenticate a notification. */
  clientState: string;
  /** Defaults to the Graph maximum for chat subscriptions. */
  subscriptionMinutes?: number;
}

function notificationDelivery(
  payload: unknown,
  clientState: string,
):
  | {
      subscriptionId: string;
      resource?: string;
      events: IntegrationTriggerEventDraft[];
    }
  | undefined {
  const body = asRecord(payload);
  const notifications = Array.isArray(body?.value) ? body.value : [];
  const events: IntegrationTriggerEventDraft[] = [];
  let subscriptionId: string | undefined;
  let resource: string | undefined;

  for (const entry of notifications) {
    const record = asRecord(entry);
    if (!record) continue;
    // Every notification must carry the clientState we registered with.
    if (
      typeof record.clientState !== "string" ||
      !safeEqual(record.clientState, clientState)
    ) {
      return undefined;
    }
    if (typeof record.subscriptionId === "string") {
      subscriptionId = record.subscriptionId;
    }
    if (typeof record.resource === "string") {
      resource = record.resource;
    }
    const changeType =
      typeof record.changeType === "string" ? record.changeType : "updated";
    const resourceData = asRecord(record.resourceData);
    events.push({
      providerEvent: `chatMessage.${changeType}`,
      ...(typeof resourceData?.id === "string"
        ? { externalId: String(resourceData.id) }
        : {}),
      data: graphOutput({ resource: record.resource, resourceData }),
    });
  }
  if (!subscriptionId || events.length === 0) return undefined;
  return { subscriptionId, resource, events };
}

/**
 * Registers a Graph change-notification subscription for Teams chat messages.
 * Graph expires these within days, so the runtime's renewal window is what
 * keeps the trigger alive.
 */
export function createMicrosoftTeamsChatSubscriptionSource(
  config: MicrosoftTeamsSubscriptionTriggerConfig,
): IntegrationSubscriptionTriggerSource {
  const clientFactory = config.clientFactory ?? createMicrosoftGraphClient;
  const now = config.now ?? (() => new Date());
  const minutes = Math.min(
    config.subscriptionMinutes ?? MAX_SUBSCRIPTION_MINUTES,
    MAX_SUBSCRIPTION_MINUTES,
  );

  async function withClient<T>(
    reference: IntegrationCredentialReference,
    operation: (client: ReturnType<MicrosoftGraphClientFactory>) => Promise<T>,
  ): Promise<T> {
    return config.oauthRuntime.withCredential(reference, async (credential) =>
      operation(clientFactory(credential.accessToken)),
    );
  }

  return {
    kind: "subscription",
    integrationId: "microsoft-teams",
    triggerId: "microsoft-teams:microsoftteams-chat-subscription",
    // Renew an hour out; Graph rejects a renewal after expiry.
    renewWithinSeconds: 3_600,
    async subscribe({ reference, callbackUrl }) {
      return withClient(reference, async (client) => {
        const created = asRecord(
          await client.api("/subscriptions").post({
            changeType: "created,updated,deleted",
            notificationUrl: callbackUrl,
            resource: "/me/chats/getAllMessages",
            expirationDateTime: expiry(minutes, now),
            clientState: config.clientState,
          }),
        );
        if (typeof created?.id !== "string") {
          throw new Error("Microsoft Graph returned no subscription ID.");
        }
        return {
          subscriptionId: created.id,
          ...(typeof created.expirationDateTime === "string"
            ? { expiresAt: created.expirationDateTime }
            : {}),
        };
      });
    },
    async renew({ reference, subscriptionId }) {
      return withClient(reference, async (client) => {
        const renewed = asRecord(
          await client
            .api(`/subscriptions/${encodeURIComponent(subscriptionId)}`)
            .patch({ expirationDateTime: expiry(minutes, now) }),
        );
        return typeof renewed?.expirationDateTime === "string"
          ? { expiresAt: renewed.expirationDateTime }
          : {};
      });
    },
    async unsubscribe({ reference, subscriptionId }) {
      await withClient(reference, async (client) => {
        await client
          .api(`/subscriptions/${encodeURIComponent(subscriptionId)}`)
          .delete();
      });
    },
    async verify({ rawBody }) {
      let payload: unknown;
      try {
        payload = JSON.parse(new TextDecoder().decode(rawBody));
      } catch {
        return undefined;
      }
      const delivery = notificationDelivery(payload, config.clientState);
      if (!delivery) return undefined;
      const connection = await config.resolveConnection({
        subscriptionId: delivery.subscriptionId,
        ...(delivery.resource ? { resource: delivery.resource } : {}),
      });
      if (!connection) return undefined;
      return { connection, events: delivery.events };
    },
  };
}

export interface MicrosoftTeamsWebhookTriggerConfig {
  /** Shared secret configured on the Teams outgoing webhook. */
  clientState: string;
  resolveConnection(input: {
    subscriptionId: string;
    resource?: string;
  }): Promise<IntegrationTriggerConnection | undefined>;
}

/**
 * Accepts Graph change notifications delivered to a standalone webhook
 * endpoint, for products that register subscriptions outside this package.
 */
export function createMicrosoftTeamsWebhookTriggerSource(
  config: MicrosoftTeamsWebhookTriggerConfig,
): IntegrationWebhookTriggerSource {
  return {
    kind: "webhook",
    integrationId: "microsoft-teams",
    triggerId: "microsoft-teams:microsoftteams-webhook",
    async verify({ rawBody }): Promise<IntegrationTriggerDelivery | undefined> {
      let payload: unknown;
      try {
        payload = JSON.parse(new TextDecoder().decode(rawBody));
      } catch {
        return undefined;
      }
      const delivery = notificationDelivery(payload, config.clientState);
      if (!delivery) return undefined;
      const connection = await config.resolveConnection({
        subscriptionId: delivery.subscriptionId,
        ...(delivery.resource ? { resource: delivery.resource } : {}),
      });
      if (!connection) return undefined;
      return { connection, events: delivery.events };
    },
  };
}
