/**
 * @module @oppulence/events/types
 * @file Core type definitions and Zod schemas for the events tracking system.
 *   This module provides comprehensive type safety for all event-related
 *   operations.
 */

import type { TrackProperties } from "@openpanel/nextjs";
import { z } from "zod";

/**
 * Event channel enumeration for categorizing events
 *
 * @enum
 */
export enum EventChannel {
  /** Login-related events */
  LOGIN = "login",
  /** Team-related events */
  TEAM = "team",
  /** Registration events */
  REGISTERED = "registered",
  /** Banking-related events */
  BANK = "bank",
  /** GoCardLess integration events */
  GOCARDLESS = "gocardless",
  /** Transaction-related events */
  TRANSACTION = "transaction",
  /** Vault/storage events */
  VAULT = "vault",
  /** Security-related events */
  SECURITY = "security",
  /** Inbox-related events */
  INBOX = "inbox",
  /** Import-related events */
  IMPORT = "import",
  /** Support-related events */
  SUPPORT = "support",
  /** Feedback events */
  FEEDBACK = "feedback",
  /** Enable Banking integration events */
  ENABLEBANKING = "enablebanking",
  /** Onboarding flow events */
  ONBOARDING = "onboarding",
  /** Billing, checkout, subscription events */
  BILLING = "billing",
  /** Invoice lifecycle events */
  INVOICE = "invoice",
  /** Time tracker events */
  TRACKER = "tracker",
  /** Customer CRUD events */
  CUSTOMER = "customer",
  /** Corinthian assistant events */
  ASSISTANT = "assistant",
  /** Settings + team-management events */
  SETTINGS = "settings",
  /** Payment lifecycle events (Stripe webhooks etc.) */
  PAYMENT = "payment",
  /** General product events (page views, feature use) */
  GENERAL = "general",
  /** Dunning / collections workflow execution events */
  WORKFLOW = "workflow",
  /** OAuth / API integration lifecycle */
  INTEGRATION = "integration",
  /** Document/report export and download events */
  EXPORT = "export",
  /** Activation milestones (first-time-in-workspace events) */
  ACTIVATION = "activation",
  /** Friction / health signals (errors, empty states, lost integrations) */
  FRICTION = "friction",
  /** Computed outcome / ROI events (DSO delta, recovery wins, attribution) */
  OUTCOME = "outcome",
}

/**
 * Event severity levels for prioritization and alerting
 *
 * @enum
 */
export enum EventSeverity {
  /** Debug-level events */
  DEBUG = "debug",
  /** Informational events */
  INFO = "info",
  /** Warning events that might need attention */
  WARNING = "warning",
  /** Error events that require immediate attention */
  ERROR = "error",
  /** Critical events that affect system stability */
  CRITICAL = "critical",
}

/**
 * Event status enumeration
 *
 * @enum
 */
export enum EventStatus {
  /** Event started */
  STARTED = "started",
  /** Event in progress */
  IN_PROGRESS = "in_progress",
  /** Event completed successfully */
  COMPLETED = "completed",
  /** Event failed */
  FAILED = "failed",
  /** Event cancelled by user */
  CANCELLED = "cancelled",
}

/**
 * Base event definition schema
 *
 * @constant
 */
export const eventDefinitionSchema = z.object({
  /** Human-readable event name */
  name: z.string().min(1, "Event name is required").max(100),
  /** Event channel for categorization */
  channel: z.nativeEnum(EventChannel),
  /** Optional event description */
  description: z.string().max(500).optional(),
  /** Event severity level */
  severity: z.nativeEnum(EventSeverity).default(EventSeverity.INFO),
  /** Whether this event should be tracked in production only */
  productionOnly: z.boolean().default(false),
  /** Tags for event filtering and searching */
  tags: z.array(z.string()).default([]),
  /** Event version for schema evolution */
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .default("1.0.0"),
});

/**
 * Inferred TypeScript type for event definition
 *
 * @typedef
 */
export type EventDefinition = z.infer<typeof eventDefinitionSchema>;

/**
 * User identification schema for analytics
 *
 * @constant
 */
export const userIdentificationSchema = z.object({
  /** Unique user identifier */
  userId: z.string().min(1, "User ID is required"),
  /** User's full name */
  fullName: z.string().nullable().optional(),
  /** User's email address */
  email: z.string().email().optional(),
  /** User's team ID */
  teamId: z.string().optional(),
  /** User's role */
  role: z.string().optional(),
  /** User's subscription plan */
  plan: z.string().optional(),
  /** Additional user metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Inferred TypeScript type for user identification
 *
 * @typedef
 */
export type UserIdentification = z.infer<typeof userIdentificationSchema>;

/**
 * Event tracking options schema
 *
 * @constant
 */
export const trackingOptionsSchema = z.object({
  /** Event name or key */
  event: z.string().min(1, "Event name is required"),
  /** Event properties */
  properties: z.record(z.string(), z.unknown()).optional(),
  /** User context */
  user: userIdentificationSchema.optional(),
  /** Session ID for correlation */
  sessionId: z.string().optional(),
  /** Client timestamp */
  timestamp: z.string().datetime().optional(),
  /** Event severity */
  severity: z.nativeEnum(EventSeverity).optional(),
  /** Event status */
  status: z.nativeEnum(EventStatus).optional(),
  /** Error details if applicable */
  error: z
    .object({
      message: z.string(),
      code: z.string().optional(),
      stack: z.string().optional(),
    })
    .optional(),
  /** Performance metrics */
  metrics: z
    .object({
      duration: z.number().optional(),
      startTime: z.number().optional(),
      endTime: z.number().optional(),
    })
    .optional(),
});

/**
 * Inferred TypeScript type for tracking options
 *
 * @typedef
 */
export type TrackingOptions = z.infer<typeof trackingOptionsSchema>;

/**
 * Analytics client configuration schema
 *
 * @constant
 */
export const analyticsConfigSchema = z.object({
  /** OpenPanel client ID */
  clientId: z.string().min(1, "Client ID is required"),
  /** OpenPanel client secret */
  clientSecret: z.string().min(1, "Client secret is required").optional(),
  /** Enable debug mode */
  debug: z.boolean().default(false),
  /** Enable tracking in development */
  trackInDevelopment: z.boolean().default(false),
  /** Track page attributes */
  trackAttributes: z.boolean().default(true),
  /** Track screen views */
  trackScreenViews: z.boolean().default(true),
  /** Track outgoing links */
  trackOutgoingLinks: z.boolean().default(true),
  /** Custom event transformer */
  transformEvent: z
    .function({
      input: z.tuple([trackingOptionsSchema]),
      output: trackingOptionsSchema,
    })
    .optional(),
  /** Event filter function */
  filterEvent: z
    .function({ input: z.tuple([trackingOptionsSchema]), output: z.boolean() })
    .optional(),
  /** Batch size for event sending */
  batchSize: z.number().int().min(1).max(100).default(10),
  /** Flush interval in milliseconds */
  flushInterval: z.number().int().min(100).max(60_000).default(5000),
  /** Maximum retry attempts */
  maxRetries: z.number().int().min(0).max(10).default(3),
  /** Retry delay in milliseconds */
  retryDelay: z.number().int().min(100).max(10_000).default(1000),
});

/**
 * Inferred TypeScript type for analytics configuration
 *
 * @typedef
 */
export type AnalyticsConfig = z.infer<typeof analyticsConfigSchema>;

/**
 * Event context schema for enriching events
 *
 * @constant
 */
export const eventContextSchema = z.object({
  /** Application version */
  appVersion: z.string().optional(),
  /** Environment (production, staging, development) */
  environment: z.enum(["production", "staging", "development"]).optional(),
  /** Client platform */
  platform: z.string().optional(),
  /** Client OS */
  os: z.string().optional(),
  /** Browser information */
  browser: z.string().optional(),
  /** Device type */
  deviceType: z.enum(["desktop", "mobile", "tablet"]).optional(),
  /** Screen resolution */
  screenResolution: z.string().optional(),
  /** User locale */
  locale: z.string().optional(),
  /** Timezone */
  timezone: z.string().optional(),
  /** IP address (if available and consented) */
  ipAddress: z
    .string()
    .regex(
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}$/,
    )
    .optional(),
  /** Country code */
  country: z.string().length(2).optional(),
  /** Additional context data */
  custom: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Inferred TypeScript type for event context
 *
 * @typedef
 */
export type EventContext = z.infer<typeof eventContextSchema>;

/**
 * Event batch schema for bulk sending
 *
 * @constant
 */
export const eventBatchSchema = z.object({
  /** Batch ID for tracking */
  batchId: z.string().uuid(),
  /** Events in the batch */
  events: z.array(trackingOptionsSchema).min(1).max(100),
  /** Batch creation timestamp */
  createdAt: z.string().datetime(),
  /** Common context for all events in batch */
  context: eventContextSchema.optional(),
});

/**
 * Inferred TypeScript type for event batch
 *
 * @typedef
 */
export type EventBatch = z.infer<typeof eventBatchSchema>;

/**
 * Tracking consent schema for GDPR compliance
 *
 * @constant
 */
export const trackingConsentSchema = z.object({
  /** Whether tracking is consented */
  consented: z.boolean(),
  /** Consent timestamp */
  consentedAt: z.string().datetime().optional(),
  /** Consent version */
  consentVersion: z.string().optional(),
  /** Consent categories */
  categories: z
    .object({
      necessary: z.boolean().default(true),
      analytics: z.boolean().default(false),
      marketing: z.boolean().default(false),
      preferences: z.boolean().default(false),
    })
    .optional(),
});

/**
 * Inferred TypeScript type for tracking consent
 *
 * @typedef
 */
export type TrackingConsent = z.infer<typeof trackingConsentSchema>;

/**
 * Extended track function type with proper typing
 *
 * @typedef
 */
export type TrackFunction = (
  options: TrackingOptions & TrackProperties,
) => void | Promise<void>;

/**
 * Analytics client interface
 *
 * @interface
 */
export interface AnalyticsClient {
  /** Track an event */
  track: TrackFunction;
  /** Identify a user */
  identify: (user: UserIdentification) => void | Promise<void>;
  /** Set user properties */
  setUserProperties: (properties: Record<string, unknown>) => void;
  /** Set global context */
  setContext: (context: EventContext) => void;
  /** Flush pending events */
  flush: () => Promise<void>;
  /** Reset client state */
  reset: () => void;
  /** Get current session ID */
  getSessionId: () => string;
  /** Check if tracking is enabled */
  isTrackingEnabled: () => boolean;
  /** Set tracking consent */
  setConsent: (consent: TrackingConsent) => void;
}

/**
 * Event metadata for internal tracking
 *
 * @interface
 */
export interface EventMetadata {
  /** Event ID */
  id: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event source */
  source: "client" | "server";
  /** Event version */
  version: string;
  /** Retry count */
  retryCount: number;
  /** Last error if any */
  lastError?: string;
}

/**
 * Event queue item for batching
 *
 * @interface
 */
export interface QueuedEvent {
  /** Event data */
  event: TrackingOptions;
  /** Event metadata */
  metadata: EventMetadata;
  /** Callback on success */
  onSuccess?: () => void;
  /** Callback on failure */
  onFailure?: (error: Error) => void;
}

/**
 * Type guard to check if an object is a valid event definition
 *
 * @param {unknown} value - Value to check
 * @returns {boolean} Whether the value is a valid event definition
 */
export function isEventDefinition(value: unknown): value is EventDefinition {
  return eventDefinitionSchema.safeParse(value).success;
}

/**
 * Type guard to check if an object is a valid tracking option
 *
 * @param {unknown} value - Value to check
 * @returns {boolean} Whether the value is a valid tracking option
 */
export function isTrackingOptions(value: unknown): value is TrackingOptions {
  return trackingOptionsSchema.safeParse(value).success;
}

/**
 * Validates and sanitizes event data
 *
 * @param {unknown} data - Data to validate
 * @returns {TrackingOptions} Validated tracking options
 * @throws {z.ZodError} If validation fails
 */
export function validateEventData(data: unknown): TrackingOptions {
  return trackingOptionsSchema.parse(data);
}

/**
 * Creates a strongly-typed event definition
 *
 * @param {EventDefinition} definition - Event definition
 * @returns {EventDefinition} Validated event definition
 */
export function createEventDefinition(
  definition: EventDefinition,
): EventDefinition {
  return eventDefinitionSchema.parse(definition);
}

/**
 * Extracts user information from various sources
 *
 * @param {Record<string, unknown>} data - Data containing user information
 * @returns {UserIdentification | null} Extracted user information or null
 */
export function extractUserInfo(
  data: Record<string, unknown>,
): UserIdentification | null {
  const result = userIdentificationSchema.safeParse(data);
  return result.success ? result.data : null;
}
