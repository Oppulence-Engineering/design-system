import { createHmac, timingSafeEqual } from "node:crypto";

import { SIMSTUDIO_BASELINE } from "../../../../catalog";
import type { IntegrationProviderPack } from "../../../core/provider-pack";
import type {
  IntegrationTriggerConnection,
  IntegrationTriggerEventDraft,
  IntegrationWebhookTriggerSource,
} from "../../../triggers";

/**
 * Atlassian delivers every event to one webhook URL and names the event in the
 * payload's `webhookEvent` field. The source catalogue models each event as a
 * separate trigger, so each one gets a source that accepts only its own event
 * names and the runtime routes by trigger ID.
 */
const JIRA_TRIGGER_EVENTS: Readonly<Record<string, readonly string[]>> = {
  "jira:jira-issue-created": ["jira:issue_created"],
  "jira:jira-issue-updated": ["jira:issue_updated"],
  "jira:jira-issue-deleted": ["jira:issue_deleted"],
  "jira:jira-issue-commented": ["comment_created"],
  "jira:jira-comment-updated": ["comment_updated"],
  "jira:jira-comment-deleted": ["comment_deleted"],
  "jira:jira-worklog-created": ["worklog_created"],
  "jira:jira-worklog-updated": ["worklog_updated"],
  "jira:jira-worklog-deleted": ["worklog_deleted"],
  "jira:jira-sprint-created": ["sprint_created"],
  "jira:jira-sprint-started": ["sprint_started"],
  "jira:jira-sprint-closed": ["sprint_closed"],
  "jira:jira-project-created": ["project_created"],
  "jira:jira-version-released": ["jira:version_released"],
  // The catch-all accepts any event the site is configured to send.
  "jira:jira-webhook": [],
};

const CONFLUENCE_TRIGGER_EVENTS: Readonly<Record<string, readonly string[]>> = {
  "confluence:confluence-page-created": ["page_created"],
  "confluence:confluence-page-updated": ["page_updated"],
  "confluence:confluence-page-removed": ["page_removed"],
  "confluence:confluence-page-moved": ["page_moved"],
  "confluence:confluence-page-restored": ["page_restored"],
  "confluence:confluence-page-permissions-updated": [
    "page_permissions_updated",
  ],
  "confluence:confluence-comment-created": ["comment_created"],
  "confluence:confluence-comment-removed": ["comment_removed"],
  "confluence:confluence-comment-updated": ["comment_updated"],
  "confluence:confluence-blog-created": ["blog_created"],
  "confluence:confluence-blog-updated": ["blog_updated"],
  "confluence:confluence-blog-removed": ["blog_removed"],
  "confluence:confluence-blog-restored": ["blog_restored"],
  "confluence:confluence-attachment-created": ["attachment_created"],
  "confluence:confluence-attachment-removed": ["attachment_removed"],
  "confluence:confluence-attachment-updated": ["attachment_updated"],
  "confluence:confluence-space-created": ["space_created"],
  "confluence:confluence-space-updated": ["space_updated"],
  "confluence:confluence-space-removed": ["space_removed"],
  "confluence:confluence-label-added": ["label_added"],
  "confluence:confluence-label-removed": ["label_removed"],
  "confluence:confluence-user-created": ["user_created"],
  "confluence:confluence-webhook": [],
};

const JSM_TRIGGER_EVENTS: Readonly<Record<string, readonly string[]>> = {
  "jira-service-management:jsm-request-created": ["jira:issue_created"],
  "jira-service-management:jsm-request-updated": ["jira:issue_updated"],
  "jira-service-management:jsm-request-commented": ["comment_created"],
  // Resolution is an issue update carrying a resolution change.
  "jira-service-management:jsm-request-resolved": ["jira:issue_updated"],
  "jira-service-management:jsm-webhook": [],
};

const TRIGGER_EVENTS: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  jira: JIRA_TRIGGER_EVENTS,
  confluence: CONFLUENCE_TRIGGER_EVENTS,
  "jira-service-management": JSM_TRIGGER_EVENTS,
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function safeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

/**
 * Atlassian signs a webhook with HMAC-SHA256 over the raw request body when a
 * secret is configured on the registration. The header carries the digest as
 * `sha256=<hex>`.
 */
function verifySignature(
  rawBody: Uint8Array,
  header: string | null,
  secret: string,
): boolean {
  if (!header) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return safeEqual(header.trim(), expected);
}

/** The entity a Jira or Confluence event carries, as a safe projection. */
function eventSubject(payload: Record<string, unknown>): {
  externalId?: string;
  data: unknown;
} {
  for (const key of ["issue", "page", "blog", "comment", "space", "worklog"]) {
    const entity = asRecord(payload[key]);
    if (entity) {
      const id = entity.id ?? entity.key;
      return {
        ...(id === undefined ? {} : { externalId: String(id) }),
        data: {
          [key]: {
            id: entity.id,
            key: entity.key,
            self: entity.self,
            title: entity.title,
            status: asRecord(entity.fields)?.status,
          },
        },
      };
    }
  }
  return { data: {} };
}

export interface AtlassianWebhookTriggerConfig {
  /** Secret configured on the Atlassian webhook registration. */
  secret: string;
  /** Product lookup from the non-secret site identity to a connection. */
  resolveConnection(input: {
    cloudId?: string;
    webhookEvent: string;
  }): Promise<IntegrationTriggerConnection | undefined>;
  /** Header carrying the HMAC digest. Defaults to Atlassian's. */
  signatureHeader?: string;
}

/**
 * Builds every webhook trigger source for one Atlassian provider. Each source
 * verifies the shared signature, then accepts only the events its own trigger
 * models, so an issue-created subscriber never sees a comment event.
 */
export function createAtlassianWebhookTriggerSources(
  integrationId: keyof typeof TRIGGER_EVENTS,
  config: AtlassianWebhookTriggerConfig,
): readonly IntegrationWebhookTriggerSource[] {
  const events = TRIGGER_EVENTS[integrationId];
  if (!events) {
    throw new Error(`No Atlassian trigger map for ${integrationId}.`);
  }
  const signatureHeader = config.signatureHeader ?? "x-hub-signature";

  return Object.entries(events).map(([triggerId, accepted]) => ({
    kind: "webhook" as const,
    integrationId,
    triggerId,
    async verify({ rawBody, headers }) {
      if (
        !verifySignature(rawBody, headers.get(signatureHeader), config.secret)
      ) {
        return undefined;
      }
      let payload: Record<string, unknown> | undefined;
      try {
        payload = asRecord(JSON.parse(new TextDecoder().decode(rawBody)));
      } catch {
        return undefined;
      }
      const webhookEvent =
        typeof payload?.webhookEvent === "string"
          ? payload.webhookEvent
          : typeof payload?.event === "string"
            ? payload.event
            : undefined;
      if (!payload || !webhookEvent) return undefined;
      // An empty accept list is the provider's catch-all trigger.
      if (accepted.length > 0 && !accepted.includes(webhookEvent)) {
        return undefined;
      }
      const connection = await config.resolveConnection({
        ...(typeof payload.matchedWebhookIds === "string"
          ? { cloudId: payload.matchedWebhookIds }
          : {}),
        ...(typeof payload.cloudId === "string"
          ? { cloudId: payload.cloudId }
          : {}),
        webhookEvent,
      });
      if (!connection) return undefined;
      const subject = eventSubject(payload);
      const occurredAt =
        typeof payload.timestamp === "number"
          ? new Date(payload.timestamp).toISOString()
          : undefined;
      const event: IntegrationTriggerEventDraft = {
        providerEvent: webhookEvent,
        ...(subject.externalId ? { externalId: subject.externalId } : {}),
        ...(occurredAt ? { occurredAt } : {}),
        data: subject.data,
      };
      return { connection, events: [event] };
    },
  }));
}

function coverageFor(
  integrationId: keyof typeof TRIGGER_EVENTS,
): IntegrationProviderPack["triggerCoverage"] {
  const baseline = SIMSTUDIO_BASELINE.integrations.find(
    (integration) => integration.id === integrationId,
  );
  const mapped = TRIGGER_EVENTS[integrationId];
  return (baseline?.triggers ?? []).map((trigger) =>
    mapped[trigger.id]
      ? {
          sourceTriggerId: trigger.id,
          kind: "webhook" as const,
          disposition: "supported" as const,
        }
      : {
          sourceTriggerId: trigger.id,
          disposition: "deferred" as const,
          reason: "No Atlassian webhook event is mapped for this trigger.",
        },
  );
}

export function jiraTriggerCoverage(): IntegrationProviderPack["triggerCoverage"] {
  return coverageFor("jira");
}

export function confluenceTriggerCoverage(): IntegrationProviderPack["triggerCoverage"] {
  return coverageFor("confluence");
}

export function jiraServiceManagementTriggerCoverage(): IntegrationProviderPack["triggerCoverage"] {
  return coverageFor("jira-service-management");
}
