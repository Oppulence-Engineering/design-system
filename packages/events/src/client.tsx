/**
 * @module @oppulence/events/client
 * @file Client-side analytics implementation for React applications. This
 *   module provides client-side event tracking with OpenPanel integration.
 */

import {
  getInitSnippet,
  type TrackProperties,
  useOpenPanel,
} from "@openpanel/nextjs";
import Script from "next/script";
import * as React from "react";
import { useEffect, useMemo, useRef } from "react";
import {
  type AnalyticsClient,
  type EventContext,
  EventSeverity,
  type QueuedEvent,
  type TrackingConsent,
  type TrackingOptions,
  trackingOptionsSchema,
  type UserIdentification,
  userIdentificationSchema,
} from "./types";
import {
  ConsentManager,
  createEventMetadata,
  EventQueue,
  formatEventForLogging,
  getDeviceContext,
  sanitizeProperties,
} from "./utils";

/**
 * Client analytics configuration
 *
 * @interface
 */
export interface ClientAnalyticsConfig {
  /** Whether browser analytics scripts and dispatch should run */
  enabled?: boolean;
  /** OpenPanel client ID */
  clientId?: string;
  /** Track page attributes */
  trackAttributes?: boolean;
  /** Track screen views */
  trackScreenViews?: boolean;
  /** Track outgoing links */
  trackOutgoingLinks?: boolean;
  /** Enable debug mode */
  debug?: boolean;
  /** Batch configuration */
  batchConfig?: {
    enabled?: boolean;
    size?: number;
    flushInterval?: number;
  };
  /** Event transformer */
  transformEvent?: (event: TrackingOptions) => TrackingOptions;
  /** Event filter */
  filterEvent?: (event: TrackingOptions) => boolean;
  /** Enable automatic error tracking */
  trackErrors?: boolean;
  /** Enable performance tracking */
  trackPerformance?: boolean;
}

/**
 * Analytics context for React components
 *
 * @interface
 */
interface AnalyticsContextValue {
  /** Analytics client instance */
  analytics: AnalyticsClient;
  /** Track function */
  track: (options: TrackingOptions & TrackProperties) => void;
  /** Identify function */
  identify: (user: UserIdentification) => void;
  /** Set consent function */
  setConsent: (consent: TrackingConsent) => void;
  /** Check if tracking is enabled */
  isTrackingEnabled: () => boolean;
}

/**
 * Analytics React context
 *
 * @constant
 */
const AnalyticsContext = React.createContext<AnalyticsContextValue | null>(
  null,
);

const getOpenPanelClientId = (clientId?: string): string => {
  const resolvedClientId =
    clientId ?? process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID;

  if (!resolvedClientId) {
    throw new Error("NEXT_PUBLIC_OPENPANEL_CLIENT_ID is required");
  }

  return resolvedClientId;
};

/**
 * Client-side analytics implementation
 *
 * @class
 */
class ClientAnalytics implements AnalyticsClient {
  /** Event queue for batching */
  private readonly queue: EventQueue | null = null;
  /** Consent manager */
  private readonly consentManager = new ConsentManager();
  /** User identification data */
  private user: UserIdentification | null = null;
  /** Global context */
  private context: EventContext = {};
  /** Session ID */
  private readonly sessionId: string;
  /** Configuration */
  private readonly config: ClientAnalyticsConfig;
  /** Track function from OpenPanel */
  private openPanelTrack?: (
    event: string,
    properties?: Record<string, unknown>,
  ) => void;

  /**
   * Creates an instance of ClientAnalytics
   *
   * @param {ClientAnalyticsConfig} config - Configuration
   * @param {Function} [openPanelTrack] - OpenPanel track function
   */
  constructor(
    config: ClientAnalyticsConfig,
    openPanelTrack?: (
      event: string,
      properties?: Record<string, unknown>,
    ) => void,
  ) {
    this.config = config;
    this.sessionId = this.generateSessionId();
    this.context = getDeviceContext();
    this.openPanelTrack = openPanelTrack;

    // Initialize queue if batching is enabled
    if (config.batchConfig?.enabled) {
      this.queue = new EventQueue(
        {
          maxSize: config.batchConfig.size || 10,
          flushInterval: config.batchConfig.flushInterval || 5000,
          autoFlush: true,
        },
        this.flushBatch.bind(this),
      );
    }

    // Load consent
    this.consentManager.loadConsent();

    // Set up automatic tracking if configured
    this.setupAutomaticTracking();
  }

  /**
   * Sets the OpenPanel track function
   *
   * @param {Function} trackFn - Track function
   */
  setOpenPanelTrack(
    trackFn: (event: string, properties?: Record<string, unknown>) => void,
  ): void {
    this.openPanelTrack = trackFn;
  }

  /**
   * Tracks an event
   *
   * @param {TrackingOptions & TrackProperties} options - Event options
   * @returns {Promise<void>}
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Client-side event tracking with batching, deduplication, and consent-aware dispatch
  async track(options: TrackingOptions & TrackProperties): Promise<void> {
    try {
      // Validate options
      const validation = trackingOptionsSchema.safeParse(options);
      if (!validation.success) {
        if (this.config.debug) {
          console.error("Invalid tracking options:", validation.error.issues);
        }
        return;
      }

      let event = validation.data;

      // Check consent
      if (!this.isTrackingEnabled()) {
        if (this.config.debug) {
          console.log("Tracking not consented, skipping event:", event.event);
        }
        return;
      }

      // Apply filter
      if (this.config.filterEvent && !this.config.filterEvent(event)) {
        if (this.config.debug) {
          console.log("Event filtered out:", event.event);
        }
        return;
      }

      // Apply transformation
      if (this.config.transformEvent) {
        event = this.config.transformEvent(event);
      }

      // Enrich event
      const enrichedEvent = this.enrichEvent(event);

      // Log in debug mode
      if (this.config.debug) {
        console.log("Track:", formatEventForLogging(enrichedEvent));
      }

      // Send or queue event
      if (this.queue) {
        await this.queueEvent(enrichedEvent);
      } else {
        await this.sendEvent(enrichedEvent);
      }
    } catch (error) {
      if (this.config.debug) {
        console.error("Failed to track event:", error);
      }
    }
  }

  /**
   * Identifies a user
   *
   * @param {UserIdentification} user - User data
   * @returns {Promise<void>}
   */
  async identify(user: UserIdentification): Promise<void> {
    const validation = userIdentificationSchema.safeParse(user);
    if (!validation.success) {
      if (this.config.debug) {
        console.error("Invalid user identification:", validation.error.issues);
      }
      return;
    }

    this.user = validation.data;

    // Track identification event
    await this.track({
      event: "User Identified",
      properties: {
        userId: user.userId,
        ...user.metadata,
      },
      severity: EventSeverity.INFO,
    });
  }

  /**
   * Sets user properties
   *
   * @param {Record<string, unknown>} properties - Properties to set
   */
  setUserProperties(properties: Record<string, unknown>): void {
    if (!this.user) {
      if (this.config.debug) {
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
   * Flushes pending events
   *
   * @returns {Promise<void>}
   */
  async flush(): Promise<void> {
    if (this.queue) {
      await this.queue.flush();
    }
  }

  /** Resets the analytics client */
  reset(): void {
    this.user = null;
    this.context = getDeviceContext();
    this.queue?.clear();
  }

  /**
   * Gets the session ID
   *
   * @returns {string} Session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Checks if tracking is enabled
   *
   * @returns {boolean} Whether tracking is enabled
   */
  isTrackingEnabled(): boolean {
    try {
      // Some versions may not accept arguments; default to true if unavailable
      // biome-ignore lint/suspicious/noExplicitAny: complex type
      const fn = (this.consentManager as any).isConsented;
      if (typeof fn === "function") {
        return fn.length === 0
          ? fn.call(this.consentManager)
          : fn.call(this.consentManager, "analytics");
      }
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Sets tracking consent
   *
   * @param {TrackingConsent} consent - Consent state
   */
  setConsent(consent: TrackingConsent): void {
    this.consentManager.saveConsent(consent);
  }

  /**
   * Generates a session ID
   *
   * @private
   * @returns {string} Session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 15);
    return `${timestamp}-${random}`;
  }

  /**
   * Enriches an event with context
   *
   * @private
   * @param {TrackingOptions} event - Event to enrich
   * @returns {TrackingOptions} Enriched event
   */
  private enrichEvent(event: TrackingOptions): TrackingOptions {
    return {
      ...event,
      user: event.user || this.user || undefined,
      sessionId: event.sessionId || this.sessionId,
      timestamp: event.timestamp || new Date().toISOString(),
      properties: {
        ...event.properties,
        _context: this.context,
        _metadata: createEventMetadata("client"),
      },
    };
  }

  /**
   * Queues an event for batch sending
   *
   * @private
   * @param {TrackingOptions} event - Event to queue
   * @returns {Promise<void>}
   */
  private async queueEvent(event: TrackingOptions): Promise<void> {
    if (!this.queue) return;

    const queuedEvent: QueuedEvent = {
      event,
      metadata: createEventMetadata("client"),
    };

    await this.queue.add(queuedEvent);
  }

  /**
   * Sends an event immediately
   *
   * @private
   * @param {TrackingOptions} event - Event to send
   * @returns {Promise<void>}
   */
  private sendEvent(event: TrackingOptions): Promise<void> {
    if (!this.openPanelTrack) {
      if (this.config.debug) {
        console.warn("OpenPanel track function not available");
      }
      return Promise.resolve();
    }

    const { event: eventName, properties = {}, ...rest } = event;
    const sanitized = sanitizeProperties({ ...properties, ...rest });

    this.openPanelTrack(eventName, sanitized);
    return Promise.resolve();
  }

  /**
   * Flushes a batch of events
   *
   * @private
   * @param {QueuedEvent[]} events - Events to flush
   * @returns {Promise<void>}
   */
  private async flushBatch(events: QueuedEvent[]): Promise<void> {
    for (const queuedEvent of events) {
      await this.sendEvent(queuedEvent.event);
    }
  }

  /**
   * Sets up automatic tracking
   *
   * @private
   */
  private setupAutomaticTracking(): void {
    if (this.config.trackErrors) {
      this.setupErrorTracking();
    }

    if (this.config.trackPerformance) {
      this.setupPerformanceTracking();
    }
  }

  /**
   * Sets up error tracking
   *
   * @private
   */
  private setupErrorTracking(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("error", (event) => {
      this.track({
        event: "Error",
        severity: EventSeverity.ERROR,
        error: {
          message: event.message,
          code: "RUNTIME_ERROR",
          stack: event.error?.stack,
        },
        properties: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      }).catch(console.error);
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.track({
        event: "Unhandled Promise Rejection",
        severity: EventSeverity.ERROR,
        error: {
          message: String(event.reason),
          code: "UNHANDLED_REJECTION",
        },
      }).catch(console.error);
    });
  }

  /**
   * Sets up performance tracking
   *
   * @private
   */
  private setupPerformanceTracking(): void {
    if (typeof window === "undefined" || !window.performance) return;

    // Track page load performance
    window.addEventListener("load", () => {
      const perfData = window.performance.timing;
      const loadTime = perfData.loadEventEnd - perfData.navigationStart;

      this.track({
        event: "Page Load",
        severity: EventSeverity.INFO,
        metrics: {
          duration: loadTime,
          startTime: perfData.navigationStart,
          endTime: perfData.loadEventEnd,
        },
        properties: {
          domContentLoaded:
            perfData.domContentLoadedEventEnd - perfData.navigationStart,
          domInteractive: perfData.domInteractive - perfData.navigationStart,
        },
      }).catch(console.error);
    });
  }
}

/**
 * Analytics provider component
 *
 * @component
 */
export const AnalyticsProvider: React.FC<{
  children: React.ReactNode;
  config?: ClientAnalyticsConfig;
}> = ({ children, config }) => {
  const openPanel = useOpenPanel() || { track: () => {} };
  const openPanelTrack = openPanel.track;
  const analyticsRef = useRef<ClientAnalytics | undefined>(undefined);
  const isProd = process.env.NODE_ENV === "production";
  const enabled = config?.enabled ?? true;
  const clientId = getOpenPanelClientId(config?.clientId);

  // Create analytics instance
  if (!analyticsRef.current) {
    analyticsRef.current = new ClientAnalytics(
      {
        clientId,
        trackAttributes: config?.trackAttributes ?? true,
        trackScreenViews: config?.trackScreenViews ?? isProd,
        trackOutgoingLinks: config?.trackOutgoingLinks ?? isProd,
        debug: config?.debug ?? !isProd,
        ...config,
      },
      openPanelTrack,
    );
  }

  const analytics = analyticsRef.current;
  if (!analytics) {
    throw new Error("Analytics client failed to initialize");
  }

  // Update OpenPanel track function
  useEffect(() => {
    analyticsRef.current?.setOpenPanelTrack(openPanelTrack);
  }, [openPanelTrack]);

  // Create context value
  const contextValue = useMemo<AnalyticsContextValue>(
    () => ({
      analytics,
      track: (options) => {
        if (!enabled) {
          return;
        }

        analytics.track(options);
      },
      identify: (user) => {
        if (!enabled) {
          return;
        }

        analytics.identify(user);
      },
      setConsent: (consent) => {
        analytics.setConsent(consent);
      },
      isTrackingEnabled: () => enabled && analytics.isTrackingEnabled(),
    }),
    [analytics, enabled],
  );
  const initOptions = {
    clientId,
    trackAttributes: config?.trackAttributes ?? true,
    trackScreenViews: config?.trackScreenViews ?? isProd,
    trackOutgoingLinks: config?.trackOutgoingLinks ?? isProd,
    sdk: "nextjs",
    sdkVersion: "1.1.3",
  };

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {enabled && (
        <>
          <Script
            async
            defer
            src="https://openpanel.dev/op1.js?v=1.1.3"
            strategy="afterInteractive"
          />
          <Script
            id="openpanel-init"
            strategy="afterInteractive"
          >{`${getInitSnippet()}
            window.op('init', ${JSON.stringify(initOptions)});`}</Script>
        </>
      )}
      {children}
    </AnalyticsContext.Provider>
  );
};

/**
 * Hook to use analytics in React components
 *
 * @returns {AnalyticsContextValue} Analytics context value
 * @throws {Error} If used outside of AnalyticsProvider
 */
export function useAnalytics(): AnalyticsContextValue {
  const context = React.useContext(AnalyticsContext);

  if (!context) {
    throw new Error("useAnalytics must be used within AnalyticsProvider");
  }

  return context;
}

/**
 * Legacy track function for backwards compatibility
 *
 * @deprecated Use useAnalytics hook instead
 * @param {Object} options - Track options
 */
export const track = (options: { event: string } & TrackProperties) => {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    console.log("Track", options);
    return;
  }

  const { event, ...rest } = options;
  if (typeof window === "undefined") {
    return;
  }

  window.op?.("track", event, rest);
};

/**
 * Legacy provider component for backwards compatibility
 *
 * @deprecated Use AnalyticsProvider instead
 */
export const Provider = () => {
  const isProd = process.env.NODE_ENV === "production";
  const clientId = getOpenPanelClientId();
  const initOptions = {
    clientId,
    trackAttributes: true,
    trackScreenViews: isProd,
    trackOutgoingLinks: isProd,
    sdk: "nextjs",
    sdkVersion: "1.1.3",
  };

  return (
    <>
      <Script
        async
        defer
        src="https://openpanel.dev/op1.js?v=1.1.3"
        strategy="afterInteractive"
      />
      <Script
        id="openpanel-legacy-init"
        strategy="afterInteractive"
      >{`${getInitSnippet()}
            window.op('init', ${JSON.stringify(initOptions)});`}</Script>
    </>
  );
};

/**
 * HOC to inject analytics into components
 *
 * @template P
 * @param {React.ComponentType<P & AnalyticsContextValue>} Component - Component
 *   to wrap
 * @returns {React.ComponentType<P>} Wrapped component
 */
export function withAnalytics<P extends object>(
  Component: React.ComponentType<P & AnalyticsContextValue>,
): React.ComponentType<P> {
  return (props: P) => {
    const analytics = useAnalytics();
    return <Component {...props} {...analytics} />;
  };
}
