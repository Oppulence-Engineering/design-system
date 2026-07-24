import { isValidEventKey, type LogEventDefinition, LogEvents } from "./events";
import type { EventChannel } from "./types";
import { sanitizeProperties } from "./utils";

export type CorinthianAnalyticsSurface =
  | "corinthian-api"
  | "corinthian-web"
  | "corinthian-workbench"
  | "corinthian-worker"
  | (string & {});

export interface CorinthianAnalyticsInput {
  eventName: string;
  properties?: Record<string, unknown>;
  surface?: CorinthianAnalyticsSurface;
}

export interface ResolvedCorinthianAnalyticsEvent {
  definition: LogEventDefinition;
  eventName: string;
  legacyEventName?: string;
}

export interface PreparedCorinthianAnalyticsEvent {
  channel: EventChannel;
  event: string;
  properties: Record<string, unknown>;
}

const EVENTS_BY_NAME = new Map(
  Object.values(LogEvents).map((event) => [event.name, event]),
);

const STATIC_EVENT_ALIASES: Record<string, LogEventDefinition> = {
  "download-invoice-action": LogEvents.InvoiceDownloaded,
  "portal.initiate_payment.attempted": LogEvents.PortalPaymentStarted,
  "portal.initiate_payment.confirmed": LogEvents.PortalPaymentConfirmed,
  "portal.initiate_payment.failed": LogEvents.PortalPaymentFailed,
  "portal.initiate_payment.poll_failed": LogEvents.PortalPaymentFailed,
  "portal.initiate_payment.refresh_failed": LogEvents.PortalPaymentFailed,
  "portal.initiate_payment.succeeded": LogEvents.PortalPaymentInitiated,
  "portal.view.attempted": LogEvents.ClientPortalViewed,
  "portal.view.failed": LogEvents.ClientPortalViewFailed,
  "portal.view.succeeded": LogEvents.ClientPortalViewed,
  "portalAdmin.disable.attempted": LogEvents.ClientPortalDisabled,
  "portalAdmin.disable.failed": LogEvents.ClientPortalActionFailed,
  "portalAdmin.disable.succeeded": LogEvents.ClientPortalDisabled,
  "portalAdmin.enable.attempted": LogEvents.ClientPortalEnabled,
  "portalAdmin.enable.failed": LogEvents.ClientPortalActionFailed,
  "portalAdmin.enable.succeeded": LogEvents.ClientPortalEnabled,
  "portalAdmin.regenerate.attempted": LogEvents.ClientPortalTokenRegenerated,
  "portalAdmin.regenerate.failed": LogEvents.ClientPortalActionFailed,
  "portalAdmin.regenerate.succeeded": LogEvents.ClientPortalTokenRegenerated,
  "portalAdmin.view_activity.succeeded": LogEvents.ClientPortalActivityViewed,
  "recurring.detail.viewed": LogEvents.RecurringInvoiceViewed,
  "recurring.list.viewed": LogEvents.RecurringInvoicesListViewed,
  "recurring.widget.clicked": LogEvents.RecurringInvoiceWidgetClicked,
  "reminders.list.viewed": LogEvents.ReminderListViewed,
  "reminders.paused.auto_triggered": LogEvents.ReminderAutomationPaused,
  "reminders.widget.clicked": LogEvents.ReminderWidgetClicked,
} as const;

const REMINDER_ACTION_EVENTS = {
  bulkSend: LogEvents.ReminderBulkSent,
  create: LogEvents.ReminderCreated,
  delete: LogEvents.ReminderDeleted,
  sendNow: LogEvents.ReminderSent,
  snooze: LogEvents.ReminderSnoozed,
  update: LogEvents.ReminderUpdated,
} as const;

const RECURRING_ACTION_EVENTS = {
  create: LogEvents.RecurringInvoiceCreated,
  delete: LogEvents.RecurringInvoiceDeleted,
  pause: LogEvents.RecurringInvoicePaused,
  resume: LogEvents.RecurringInvoiceResumed,
  sendNow: LogEvents.RecurringInvoiceSentNow,
  skip: LogEvents.RecurringInvoiceSkipped,
  update: LogEvents.RecurringInvoiceUpdated,
} as const;

const UNSAFE_KEY_PATTERNS = [
  /address/i,
  /api[_-]?key/i,
  /auth/i,
  /body/i,
  /card[_-]?number/i,
  /completion/i,
  /content/i,
  /credit[_-]?card/i,
  /email/i,
  /html/i,
  /note/i,
  /password/i,
  /phone/i,
  /prompt/i,
  /secret/i,
  /signature/i,
  /ssn/i,
  /token/i,
];

const REMINDER_ACTION_PATTERN =
  /^reminders\.(bulkSend|create|delete|sendNow|snooze|update)\.(attempted|cancelled|failed|succeeded)$/;

const RECURRING_ACTION_PATTERN =
  /^recurring\.(create|delete|pause|resume|sendNow|skip|update)\.(attempted|failed|succeeded)$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isUnsafeKey = (key: string): boolean =>
  UNSAFE_KEY_PATTERNS.some((pattern) => pattern.test(key));

const sanitizeStringValue = (value: string): string =>
  sanitizeProperties({ value }).value as string;

const sanitizeValue = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item))
      .filter((item) => item !== undefined);
  }

  if (isRecord(value)) {
    return sanitizeCorinthianAnalyticsProperties(value);
  }

  if (typeof value === "string") {
    return sanitizeStringValue(value);
  }

  return value;
};

export function sanitizeCorinthianAnalyticsProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (isUnsafeKey(key)) {
      continue;
    }

    const sanitizedValue = sanitizeValue(value);
    if (sanitizedValue !== undefined) {
      sanitized[key] = sanitizedValue;
    }
  }

  return sanitized;
}

function resolveDynamicCorinthianAnalyticsEvent(
  eventName: string,
): LogEventDefinition | undefined {
  const reminderMatch = REMINDER_ACTION_PATTERN.exec(eventName);
  if (reminderMatch) {
    const [, action, status] = reminderMatch;
    if (status === "cancelled") {
      return LogEvents.ReminderActionCancelled;
    }
    return status === "failed"
      ? LogEvents.ReminderActionFailed
      : REMINDER_ACTION_EVENTS[action as keyof typeof REMINDER_ACTION_EVENTS];
  }

  const recurringMatch = RECURRING_ACTION_PATTERN.exec(eventName);
  if (recurringMatch) {
    const [, action, status] = recurringMatch;
    if (status === "failed") {
      return action === "delete"
        ? LogEvents.RecurringInvoiceDeleteFailed
        : LogEvents.RecurringInvoiceActionFailed;
    }
    return RECURRING_ACTION_EVENTS[
      action as keyof typeof RECURRING_ACTION_EVENTS
    ];
  }

  return;
}

export function resolveCorinthianAnalyticsEvent(
  eventName: string,
): ResolvedCorinthianAnalyticsEvent {
  const canonicalByKey = isValidEventKey(eventName)
    ? LogEvents[eventName]
    : undefined;
  const canonicalByName = EVENTS_BY_NAME.get(eventName);
  const alias =
    STATIC_EVENT_ALIASES[eventName] ??
    resolveDynamicCorinthianAnalyticsEvent(eventName);

  if (canonicalByKey) {
    return {
      definition: canonicalByKey,
      eventName: canonicalByKey.name,
    };
  }

  if (canonicalByName) {
    return {
      definition: canonicalByName,
      eventName,
    };
  }

  if (alias) {
    return {
      definition: alias,
      eventName: alias.name,
      legacyEventName: eventName,
    };
  }

  return {
    definition: LogEvents.FeatureUsed,
    eventName,
  };
}

export function prepareCorinthianAnalyticsEvent({
  eventName,
  properties,
  surface,
}: CorinthianAnalyticsInput): PreparedCorinthianAnalyticsEvent {
  const resolved = resolveCorinthianAnalyticsEvent(eventName);
  const mergedProperties = {
    ...(properties ?? {}),
    ...(surface ? { surface } : {}),
    ...(resolved.legacyEventName
      ? { legacyEventName: resolved.legacyEventName }
      : {}),
  };

  return {
    channel: resolved.definition.channel,
    event: resolved.eventName,
    properties: sanitizeCorinthianAnalyticsProperties(mergedProperties),
  };
}
