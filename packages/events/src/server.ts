/**
 * @module @oppulence/events/server
 * @file Server-side analytics implementation for Next.js applications. This
 *   module provides server-side event tracking with OpenPanel integration.
 */

import { OpenPanel, type TrackProperties } from "@openpanel/nextjs";
import { waitUntil } from "@vercel/functions";
import { cookies } from "next/headers";
import { isEmissionEnabledFromProcessEnv } from "./gate";
import {
  type AnalyticsClient,
  type EventContext,
  EventSeverity,
  EventStatus,
  type TrackingConsent,
  type TrackingOptions,
  trackingOptionsSchema,
  type UserIdentification,
  userIdentificationSchema,
} from "./types";
import {
  createEventMetadata,
  formatEventForLogging,
  getDeviceContext,
  retryWithBackoff,
  sanitizeProperties,
} from "./utils";

/**
 * Configuration options for server-side analytics
 *
 * @interface
 */
export interface ServerAnalyticsConfig {
  /** User identification data */
  userId?: string;
  /** User's full name */
  fullName?: string | null;
  /** User's email address */
  email?: string;
  /** Team ID */
  teamId?: string;
  /** User role */
  role?: string;
  /** Subscription plan */
  plan?: string;
  /** Additional user metadata */
  metadata?: Record<string, unknown>;
  /** Custom OpenPanel client configuration */
  clientConfig?: {
    clientId?: string;
    clientSecret?: string;
  };
  /** Enable debug mode */
  debug?: boolean;
  /** Custom event transformer */
  transformEvent?: (event: TrackingOptions) => TrackingOptions;
  /** Event filter */
  filterEvent?: (event: TrackingOptions) => boolean;
}

/**
 * Server-side analytics client implementation
 *
 * @class
 */
export class ServerAnalytics implements AnalyticsClient {
  /** OpenPanel client instance */
  private readonly client: OpenPanel;
  /** User identification data */
  private user: UserIdentification | null = null;
  /** Global event context */
  private context: EventContext = {};
  /** Debug mode flag */
  private readonly debug: boolean;
  /** Event transformer function */
  private readonly transformEvent?: (event: TrackingOptions) => TrackingOptions;
  /** Event filter function */
  private readonly filterEvent?: (event: TrackingOptions) => boolean;
  /** Tracking consent state */
  private consent: TrackingConsent | null = null;

  /**
   * Creates an instance of ServerAnalytics
   *
   * @param {ServerAnalyticsConfig} [config] - Configuration options
   */
  constructor(config?: ServerAnalyticsConfig) {
    const clientId =
      config?.clientConfig?.clientId ||
      process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID;
    const clientSecret =
      config?.clientConfig?.clientSecret || process.env.OPENPANEL_SECRET_KEY;

    if (!clientId) {
      throw new Error(
        "OpenPanel client ID is required. Set NEXT_PUBLIC_OPENPANEL_CLIENT_ID environment variable.",
      );
    }

    this.client = new OpenPanel({
      clientId,
      clientSecret: clientSecret || "",
    });

    this.debug = config?.debug ?? process.env.NODE_ENV === "development";
    this.transformEvent = config?.transformEvent;
    this.filterEvent = config?.filterEvent;

    // Set initial context
    this.context = {
      ...getDeviceContext(),
      environment: (process.env.NODE_ENV || "development") as
        | "production"
        | "staging"
        | "development",
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
    };

    // Set user if provided
    if (config?.userId) {
      this.setUserFromConfig(config);
    }
  }

  /**
   * Sets user data from configuration
   *
   * @private
   * @param {ServerAnalyticsConfig} config - Configuration with user data
   */
  private setUserFromConfig(config: ServerAnalyticsConfig): void {
    const userData: Partial<UserIdentification> = {
      userId: config.userId,
      fullName: config.fullName,
      email: config.email,
      teamId: config.teamId,
      role: config.role,
      plan: config.plan,
      metadata: config.metadata,
    };

    const validation = userIdentificationSchema.safeParse(userData);
    if (validation.success) {
      this.user = validation.data;
    } else if (this.debug) {
      console.warn("Invalid user data provided:", validation.error.issues);
    }
  }

  /**
   * Tracks an event
   *
   * @param {TrackingOptions & TrackProperties} options - Event options
   * @returns {Promise<void>}
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Server-side event tracking with queue buffering, retry logic, and provider routing
  async track(options: TrackingOptions & TrackProperties): Promise<void> {
    try {
      // Validate tracking options
      const validation = trackingOptionsSchema.safeParse(options);
      if (!validation.success) {
        if (this.debug) {
          console.error("Invalid tracking options:", validation.error.issues);
        }
        return;
      }

      let event = validation.data;

      // Apply filter if configured
      if (this.filterEvent && !this.filterEvent(event)) {
        if (this.debug) {
          console.log("Event filtered out:", event.event);
        }
        return;
      }

      // Apply transformation if configured
      if (this.transformEvent) {
        event = this.transformEvent(event);
      }

      // Check consent
      if (!(await this.checkConsent())) {
        if (this.debug) {
          console.log("Tracking not consented, skipping event:", event.event);
        }
        return;
      }

      // Enrich event with context and metadata
      const enrichedEvent = this.enrichEvent(event);

      // Log in development
      if (this.debug) {
        console.log("Track:", formatEventForLogging(enrichedEvent));
      }

      // Skip tracking in non-production if not in debug mode
      if (process.env.NODE_ENV !== "production" && !this.debug) {
        return;
      }

      // Extract event name and properties
      const { event: eventName, properties = {}, ...rest } = enrichedEvent;

      // Sanitize properties
      const sanitizedProperties = sanitizeProperties({
        ...properties,
        ...rest,
      });

      // Send event with retry logic
      await retryWithBackoff(
        // biome-ignore lint/suspicious/useAwait: retryWithBackoff expects an async callback contract
        async () => {
          waitUntil(this.client.track(eventName, sanitizedProperties));
        },
        3,
        1000,
      );
    } catch (error) {
      if (this.debug) {
        console.error("Failed to track event:", error);
      }
      // Don't throw - analytics should not break the application
    }
  }

  /**
   * Identifies a user
   *
   * @param {UserIdentification} user - User identification data
   * @returns {Promise<void>}
   */
  async identify(user: UserIdentification): Promise<void> {
    try {
      const validation = userIdentificationSchema.safeParse(user);
      if (!validation.success) {
        if (this.debug) {
          console.error(
            "Invalid user identification:",
            validation.error.issues,
          );
        }
        return;
      }

      this.user = validation.data;

      // Check consent before identifying
      if (!(await this.checkConsent())) {
        return;
      }

      const { userId, fullName, ...metadata } = this.user;

      // Parse name for OpenPanel
      const nameParts = fullName?.split(" ") || [];
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");

      // Send identification with retry
      await retryWithBackoff(
        // biome-ignore lint/suspicious/useAwait: retryWithBackoff expects an async callback contract
        async () => {
          const identifyPromise = this.client.identify({
            profileId: userId,
            firstName,
            lastName,
            ...sanitizeProperties(metadata as Record<string, unknown>),
          });
          if (identifyPromise) {
            waitUntil(identifyPromise);
          }
        },
        3,
        1000,
      );

      if (this.debug) {
        console.log("User identified:", userId);
      }
    } catch (error) {
      if (this.debug) {
        console.error("Failed to identify user:", error);
      }
    }
  }

  /**
   * Sets user properties
   *
   * @param {Record<string, unknown>} properties - Properties to set
   */
  setUserProperties(properties: Record<string, unknown>): void {
    if (!this.user) {
      if (this.debug) {
        console.warn("Cannot set user properties: no user identified");
      }
      return;
    }

    this.user = {
      ...this.user,
      metadata: {
        ...this.user.metadata,
        ...properties,
      },
    };
  }

  /**
   * Sets global context
   *
   * @param {EventContext} context - Context to set
   */
  setContext(context: EventContext): void {
    this.context = {
      ...this.context,
      ...context,
    };
  }

  /**
   * Flushes pending events (no-op for server-side)
   *
   * @returns {Promise<void>}
   */
  async flush(): Promise<void> {
    // No-op for server-side tracking
    // Events are sent immediately with waitUntil
  }

  /** Resets client state */
  reset(): void {
    this.user = null;
    this.context = getDeviceContext();
    this.consent = null;
  }

  /**
   * Gets current session ID
   *
   * @returns {string} Session ID
   */
  getSessionId(): string {
    // Generate or retrieve session ID
    // In a real implementation, this would be stored in cookies or session
    return `session-${Date.now()}`;
  }

  /**
   * Checks if tracking is enabled
   *
   * @returns {boolean} Whether tracking is enabled
   */
  isTrackingEnabled(): boolean {
    return this.consent?.consented ?? true;
  }

  /**
   * Sets tracking consent
   *
   * @param {TrackingConsent} consent - Consent state
   */
  setConsent(consent: TrackingConsent): void {
    this.consent = consent;
  }

  /**
   * Checks consent from cookies
   *
   * @private
   * @returns {Promise<boolean>} Whether tracking is consented
   */
  private async checkConsent(): Promise<boolean> {
    // Check internal consent state first
    if (this.consent !== null) {
      return this.consent.consented;
    }

    // Check cookies for consent
    try {
      const cookieStore = await cookies();
      const consentCookie = cookieStore.get("tracking-consent");

      // Default to true if no consent cookie exists
      if (!consentCookie) {
        return true;
      }

      // Check if consent is granted (value === '1')
      return consentCookie.value === "1";
    } catch (error) {
      if (this.debug) {
        console.error("Failed to check consent:", error);
      }
      // Default to true on error
      return true;
    }
  }

  /**
   * Enriches event with context and user data
   *
   * @private
   * @param {TrackingOptions} event - Event to enrich
   * @returns {TrackingOptions} Enriched event
   */
  private enrichEvent(event: TrackingOptions): TrackingOptions {
    const metadata = createEventMetadata("server");

    return {
      ...event,
      user: event.user || this.user || undefined,
      sessionId: event.sessionId || this.getSessionId(),
      timestamp: event.timestamp || new Date().toISOString(),
      properties: {
        ...event.properties,
        _metadata: metadata,
        _context: this.context,
        _user: this.user,
      },
    };
  }
}

/**
 * AnalyticsClient implementation that swallows every call. Returned by
 * {@link setupAnalytics} when the {@link isEmissionEnabledFromProcessEnv}
 * gate is closed, so callers can `await analytics.track(...)` unconditionally
 * without burning OpenPanel quota in dev.
 */
export const NOOP_ANALYTICS_CLIENT: AnalyticsClient = {
  track: async () => {
    // gated no-op
  },
  identify: () => {
    // gated no-op
  },
  setUserProperties: () => {
    // gated no-op
  },
  setContext: () => {
    // gated no-op
  },
  flush: async () => {
    // gated no-op
  },
  reset: () => {
    // gated no-op
  },
  getSessionId: () => "",
  isTrackingEnabled: () => false,
  setConsent: () => {
    // gated no-op
  },
};

/**
 * Sets up server-side analytics with automatic user identification.
 *
 * Cost gate: when {@link isEmissionEnabledFromProcessEnv} returns false
 * (i.e. non-production AND no `NEXT_PUBLIC_ENABLE_OPENPANEL=true` opt-in),
 * returns {@link NOOP_ANALYTICS_CLIENT}. The function never throws and the
 * returned client is always safe to await.
 *
 * @param {ServerAnalyticsConfig} [options] - Configuration options
 * @returns {Promise<AnalyticsClient>} Analytics client instance (real or no-op)
 */
export async function setupAnalytics(
  options?: ServerAnalyticsConfig,
): Promise<AnalyticsClient> {
  if (!isEmissionEnabledFromProcessEnv()) {
    return NOOP_ANALYTICS_CLIENT;
  }

  const analytics = new ServerAnalytics(options);

  // Auto-identify user if data is provided
  if (options?.userId && options?.fullName) {
    await analytics.identify({
      userId: options.userId,
      fullName: options.fullName,
      email: options.email,
      teamId: options.teamId,
      role: options.role,
      plan: options.plan,
      metadata: options.metadata,
    });
  }

  return analytics;
}

/**
 * Creates a simple track function for backwards compatibility
 *
 * @param {ServerAnalyticsConfig} [config] - Configuration options
 * @returns {Promise<{ track: Function }>} Object with track function
 */
export async function createTracker(config?: ServerAnalyticsConfig): Promise<{
  track: (options: { event: string } & TrackProperties) => Promise<void>;
}> {
  const analytics = await setupAnalytics(config);

  return {
    track: async (options: { event: string } & TrackProperties) => {
      try {
        await analytics.track({
          event: options.event,
          properties: options,
          severity: EventSeverity.INFO,
          status: EventStatus.COMPLETED,
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Track error:", error);
        }
      }
    },
  };
}

/**
 * Express/Connect middleware for automatic event context
 *
 * @param {ServerAnalyticsConfig} [config] - Configuration options
 * @returns {Function} Middleware function
 */
export function analyticsMiddleware(config?: ServerAnalyticsConfig) {
  return async (req: Request, _res: Response, next: () => void) => {
    // Extract context from request
    const context: EventContext = {
      ipAddress:
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        undefined,
      country: req.headers.get("cf-ipcountry") || undefined,
      custom: {
        path: new URL(req.url).pathname,
        method: req.method,
        userAgent: req.headers.get("user-agent"),
      },
    };

    // Set up analytics with context
    const analytics = await setupAnalytics({
      ...config,
      metadata: {
        ...config?.metadata,
        requestContext: context,
      },
    });

    // Attach to request for use in handlers
    (req as Request & { analytics: AnalyticsClient }).analytics = analytics;

    next();
  };
}
