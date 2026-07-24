/**
 * @module @oppulence/events
 * @file Main entry point for the Canvas events tracking system. This module
 *   exports all public APIs for event tracking, analytics, and monitoring.
 */

// ============================================================================
// Core Type Exports
// ============================================================================

export {
  type AnalyticsClient,
  type AnalyticsConfig,
  analyticsConfigSchema,
  createEventDefinition,
  type EventBatch,
  // Enumerations
  EventChannel,
  type EventContext,
  // Core Types
  type EventDefinition,
  type EventMetadata,
  EventSeverity,
  EventStatus,
  eventBatchSchema,
  eventContextSchema,
  // Schemas (for runtime validation)
  eventDefinitionSchema,
  extractUserInfo,
  // Type Guards
  isEventDefinition,
  isTrackingOptions,
  type QueuedEvent,
  type TrackFunction,
  type TrackingConsent,
  type TrackingOptions,
  trackingConsentSchema,
  trackingOptionsSchema,
  type UserIdentification,
  userIdentificationSchema,
  // Validation Functions
  validateEventData,
} from "./types";

// ============================================================================
// Event Definitions and Registry
// ============================================================================

export {
  ActivationEvents,
  AssistantEvents,
  // Event Namespaces
  AuthenticationEvents,
  BankingEvents,
  BillingEvents,
  ClientPortalEvents,
  CustomerEvents,
  EnableBankingEvents,
  EngagementEvents,
  // Types
  type EventKey,
  ExpansionEvents,
  ExportEvents,
  FrictionEvents,
  GeneralEvents,
  // Helper Functions
  getEventDefinition,
  getEventMetadata,
  getEventsByChannel,
  getEventsBySeverity,
  getEventsByTag,
  GoCardLessEvents,
  CommsComplianceEvents,
  InboxEvents,
  IntegrationEvents,
  InvoiceEvents,
  isValidEventKey,
  type LogEventDefinition,
  // Complete Registry
  LogEvents,
  OnboardingEvents,
  OutcomeEvents,
  PaymentEvents,
  SettingsEvents,
  SupportEvents,
  TeamEvents,
  TrackerEvents,
  TransactionEvents,
  VaultEvents,
  WorkflowEvents,
} from "./events";

// ============================================================================
// Corinthian analytics contract
// ============================================================================

export {
  type CorinthianAnalyticsInput,
  type CorinthianAnalyticsSurface,
  prepareCorinthianAnalyticsEvent,
  type PreparedCorinthianAnalyticsEvent,
  resolveCorinthianAnalyticsEvent,
  type ResolvedCorinthianAnalyticsEvent,
  sanitizeCorinthianAnalyticsProperties,
} from "./corinthian";

// ============================================================================
// Utility Exports
// ============================================================================

export {
  ConsentManager,
  createEventBatch,
  // Factory Functions
  createEventMetadata,
  // Utility Functions
  debounce,
  // Classes
  EventQueue,
  // Context Functions
  enrichEventWithContext,
  formatEventForLogging,
  generateEventId,
  getDeviceContext,
  // Types
  type QueueConfig,
  retryWithBackoff,
  sanitizeProperties,
  throttle,
  validateUserIdentification,
} from "./utils";

// ============================================================================
// Server-Side Analytics
// ============================================================================

export {
  // Middleware
  analyticsMiddleware,
  createTracker,
  // No-op singleton (returned by setupAnalytics when the gate is closed)
  NOOP_ANALYTICS_CLIENT,
  // Classes
  ServerAnalytics,
  // Types
  type ServerAnalyticsConfig,
  // Factory Functions
  setupAnalytics,
} from "./server";

// ============================================================================
// Cost Gate (single source of truth across all consumers)
// ============================================================================

export {
  EMISSION_OPT_IN_ENV_VAR,
  type EmissionGateInput,
  isEmissionEnabled,
  isEmissionEnabledFromProcessEnv,
} from "./gate";

// ============================================================================
// Canonical server-side tracker (factory) — Node.js, framework-agnostic
// ============================================================================

export {
  createServerTracker,
  type FireOnceArgs,
  type IdentifyArgs,
  NOOP_SERVER_TRACKER,
  type ServerTracker,
  type ServerTrackerConfig,
} from "./server-tracker";

// ============================================================================
// Client-Side Analytics (React)
// ============================================================================

export {
  // Components
  AnalyticsProvider,
  // Types
  type ClientAnalyticsConfig,
  Provider, // Legacy, deprecated
  // Functions
  track, // Legacy, deprecated
  // Hooks
  useAnalytics,
  // HOC
  withAnalytics,
} from "./client";

// ============================================================================
// Default Analytics Instance Factory
// ============================================================================

/**
 * Creates a default analytics instance based on the environment
 *
 * @example
 *   ```typescript
 *   // Server-side usage
 *   const analytics = await createAnalytics({
 *     userId: user.id,
 *     email: user.email,
 *   });
 *
 *   // Track an event
 *   await analytics.track({
 *     event: 'Button Clicked',
 *     properties: { buttonId: 'submit' }
 *   });
 *   ```;
 *
 * @param {Partial<AnalyticsConfig>} [config] - Optional configuration overrides
 * @returns {Promise<AnalyticsClient>} Analytics client instance
 */
export async function createAnalytics(
  config?: Partial<import("./server").ServerAnalyticsConfig>,
): Promise<import("./types").AnalyticsClient> {
  // Dynamic import based on environment
  if (typeof window === "undefined") {
    const { setupAnalytics } = await import("./server");
    return setupAnalytics(config);
  }
  // For client-side, this would need to be handled differently
  // as it requires React context
  throw new Error(
    "Use AnalyticsProvider component for client-side analytics initialization",
  );
}

// ============================================================================
// Preset Event Trackers
// ============================================================================

/**
 * Preset tracker for authentication events
 *
 * @class
 */
export class AuthTracker {
  /**
   * Creates an authentication tracker
   *
   * @param {AnalyticsClient} client - Analytics client
   */
  constructor(private readonly client: import("./types").AnalyticsClient) {}

  /**
   * Tracks user sign in
   *
   * @param {Object} data - Sign in data
   * @returns {Promise<void>}
   */
  async signIn(data: { userId: string; method?: string }): Promise<void> {
    const { AuthenticationEvents } = await import("./events");
    const { EventSeverity, EventStatus } = await import("./types");
    await this.client.track({
      event: AuthenticationEvents.SignIn.name,
      properties: data,
      severity: EventSeverity.INFO,
      status: EventStatus.COMPLETED,
    });
  }

  /**
   * Tracks user sign out
   *
   * @param {Object} data - Sign out data
   * @returns {Promise<void>}
   */
  async signOut(data?: { reason?: string }): Promise<void> {
    const { AuthenticationEvents } = await import("./events");
    const { EventSeverity, EventStatus } = await import("./types");
    await this.client.track({
      event: AuthenticationEvents.SignOut.name,
      properties: data,
      severity: EventSeverity.INFO,
      status: EventStatus.COMPLETED,
    });
  }

  /**
   * Tracks user registration
   *
   * @param {Object} data - Registration data
   * @returns {Promise<void>}
   */
  async register(data: {
    userId: string;
    email: string;
    source?: string;
  }): Promise<void> {
    const { AuthenticationEvents } = await import("./events");
    const { EventSeverity, EventStatus } = await import("./types");
    await this.client.track({
      event: AuthenticationEvents.Registered.name,
      properties: data,
      severity: EventSeverity.INFO,
      status: EventStatus.COMPLETED,
    });
  }
}

/**
 * Preset tracker for banking events
 *
 * @class
 */
export class BankingTracker {
  /**
   * Creates a banking tracker
   *
   * @param {AnalyticsClient} client - Analytics client
   */
  constructor(private readonly client: import("./types").AnalyticsClient) {}

  /**
   * Tracks bank connection completion
   *
   * @param {Object} data - Connection data
   * @returns {Promise<void>}
   */
  async connectCompleted(data: {
    provider: string;
    accountCount?: number;
  }): Promise<void> {
    const { BankingEvents } = await import("./events");
    const { EventSeverity, EventStatus } = await import("./types");
    await this.client.track({
      event: BankingEvents.ConnectBankCompleted.name,
      properties: data,
      severity: EventSeverity.INFO,
      status: EventStatus.COMPLETED,
    });
  }

  /**
   * Tracks bank connection failure
   *
   * @param {Object} data - Failure data
   * @returns {Promise<void>}
   */
  async connectFailed(data: {
    provider: string;
    error: string;
  }): Promise<void> {
    const { BankingEvents } = await import("./events");
    const { EventSeverity, EventStatus } = await import("./types");
    await this.client.track({
      event: BankingEvents.ConnectBankFailed.name,
      properties: data,
      severity: EventSeverity.ERROR,
      status: EventStatus.FAILED,
      error: {
        message: data.error,
        code: "BANK_CONNECTION_FAILED",
      },
    });
  }
}

/**
 * Preset tracker for transaction events
 *
 * @class
 */
export class TransactionTracker {
  /**
   * Creates a transaction tracker
   *
   * @param {AnalyticsClient} client - Analytics client
   */
  constructor(private readonly client: import("./types").AnalyticsClient) {}

  /**
   * Tracks transaction export
   *
   * @param {Object} data - Export data
   * @returns {Promise<void>}
   */
  async export(data: {
    format: string;
    count: number;
    dateRange?: { start: string; end: string };
  }): Promise<void> {
    const { TransactionEvents } = await import("./events");
    const { EventSeverity, EventStatus } = await import("./types");
    await this.client.track({
      event: TransactionEvents.ExportTransactions.name,
      properties: data,
      severity: EventSeverity.INFO,
      status: EventStatus.COMPLETED,
    });
  }

  /**
   * Tracks transaction import
   *
   * @param {Object} data - Import data
   * @returns {Promise<void>}
   */
  async import(data: {
    source: string;
    count: number;
    success: boolean;
  }): Promise<void> {
    const { TransactionEvents } = await import("./events");
    const { EventSeverity, EventStatus } = await import("./types");
    await this.client.track({
      event: TransactionEvents.ImportTransactions.name,
      properties: data,
      severity: EventSeverity.INFO,
      status: data.success ? EventStatus.COMPLETED : EventStatus.FAILED,
    });
  }
}

// ============================================================================
// Error Tracking Utilities
// ============================================================================

/**
 * Captures and tracks errors
 *
 * @example
 *   ```typescript
 *   try {
 *     await riskyOperation();
 *   } catch (error) {
 *     await captureError(analytics, error, {
 *       operation: 'riskyOperation'
 *     });
 *   }
 *   ```;
 *
 * @param {AnalyticsClient} client - Analytics client
 * @param {Error} error - Error to track
 * @param {Object} [context] - Additional context
 * @returns {Promise<void>}
 */
export async function captureError(
  client: import("./types").AnalyticsClient,
  error: Error,
  context?: Record<string, unknown>,
): Promise<void> {
  const { EventSeverity, EventStatus } = await import("./types");
  await client.track({
    event: "Error Captured",
    severity: EventSeverity.ERROR,
    status: EventStatus.FAILED,
    error: {
      message: error.message,
      code: error.name,
      stack: error.stack,
    },
    properties: {
      ...context,
      errorName: error.name,
      errorMessage: error.message,
    },
  });
}

/**
 * Tracks performance metrics
 *
 * @example
 *   ```typescript
 *   const start = performance.now();
 *   await heavyOperation();
 *   const duration = performance.now() - start;
 *   await trackPerformance(analytics, 'heavyOperation', duration);
 *   ```;
 *
 * @param {AnalyticsClient} client - Analytics client
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 * @param {Object} [metadata] - Additional metadata
 * @returns {Promise<void>}
 */
export async function trackPerformance(
  client: import("./types").AnalyticsClient,
  operation: string,
  duration: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { EventSeverity, EventStatus } = await import("./types");
  await client.track({
    event: "Performance Metric",
    severity: EventSeverity.INFO,
    status: EventStatus.COMPLETED,
    metrics: {
      duration,
      startTime: Date.now() - duration,
      endTime: Date.now(),
    },
    properties: {
      operation,
      ...metadata,
    },
  });
}

// ============================================================================
// Constants and Configuration
// ============================================================================

/**
 * Default analytics configuration
 *
 * @constant
 */
export const DEFAULT_CONFIG = {
  batchSize: 10,
  flushInterval: 5000,
  maxRetries: 3,
  retryDelay: 1000,
  debug: process.env.NODE_ENV === "development",
  trackInDevelopment: false,
  trackAttributes: true,
  trackScreenViews: true,
  trackOutgoingLinks: true,
} as const;

/**
 * Analytics SDK version
 *
 * @constant
 */
export const VERSION = "1.0.0";

/**
 * Supported analytics providers
 *
 * @constant
 */
export const PROVIDERS = {
  OPENPANEL: "openpanel",
  CUSTOM: "custom",
} as const;

// ============================================================================
// Re-export OpenPanel types for convenience
// ============================================================================

// Note: PostEventPayload was removed from @openpanel/nextjs in a recent version
