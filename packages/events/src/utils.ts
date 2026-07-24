/* biome-ignore-all lint/suspicious/useIterableCallbackReturn: Legacy callback side effects are preserved without behavioral refactor. */
/**
 * @module @oppulence/events/utils
 * @file Utility functions and helpers for the events tracking system. This
 *   module provides reusable functionality for event processing and
 *   management.
 */

import type {
  EventBatch,
  EventContext,
  EventMetadata,
  QueuedEvent,
  TrackingConsent,
  TrackingOptions,
  UserIdentification,
} from "./types";

/**
 * Configuration for the event queue
 *
 * @interface
 */
export interface QueueConfig {
  /** Maximum queue size */
  maxSize: number;
  /** Flush interval in milliseconds */
  flushInterval: number;
  /** Batch size for sending */
  batchSize: number;
  /** Enable automatic flushing */
  autoFlush: boolean;
}

/**
 * Event queue for batching and managing events
 *
 * @class
 */
export class EventQueue {
  /** Internal queue storage */
  private readonly queue: QueuedEvent[] = [];
  /** Timer for auto-flush */
  private flushTimer: NodeJS.Timeout | null = null;
  /** Queue configuration */
  private readonly config: QueueConfig;
  /** Flush callback */
  private readonly onFlush: (events: QueuedEvent[]) => Promise<void>;

  /**
   * Creates an instance of EventQueue
   *
   * @param {QueueConfig} config - Queue configuration
   * @param {Function} onFlush - Callback for flushing events
   */
  constructor(
    config: Partial<QueueConfig>,
    onFlush: (events: QueuedEvent[]) => Promise<void>,
  ) {
    this.config = {
      maxSize: config.maxSize ?? 100,
      flushInterval: config.flushInterval ?? 5000,
      batchSize: config.batchSize ?? 10,
      autoFlush: config.autoFlush ?? true,
    };
    this.onFlush = onFlush;

    if (this.config.autoFlush) {
      this.startAutoFlush();
    }
  }

  /**
   * Adds an event to the queue
   *
   * @param {QueuedEvent} event - Event to queue
   * @returns {Promise<void>}
   */
  async add(event: QueuedEvent): Promise<void> {
    this.queue.push(event);

    if (this.queue.length >= this.config.maxSize) {
      await this.flush();
    }
  }

  /**
   * Flushes the queue
   *
   * @returns {Promise<void>}
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batches = this.createBatches();

    for (const batch of batches) {
      try {
        await this.onFlush(batch);
        batch.forEach((event) => event.onSuccess?.());
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        batch.forEach((event) => {
          event.metadata.retryCount++;
          event.onFailure?.(err);
        });
      }
    }

    this.queue.length = 0;
  }

  /**
   * Creates batches from the queue
   *
   * @private
   * @returns {QueuedEvent[][]} Array of batches
   */
  private createBatches(): QueuedEvent[][] {
    const batches: QueuedEvent[][] = [];
    const queueCopy = [...this.queue];

    while (queueCopy.length > 0) {
      batches.push(queueCopy.splice(0, this.config.batchSize));
    }

    return batches;
  }

  /**
   * Starts auto-flush timer
   *
   * @private
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushInterval);
  }

  /** Stops auto-flush timer */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Gets the current queue size
   *
   * @returns {number} Queue size
   */
  size(): number {
    return this.queue.length;
  }

  /** Clears the queue without flushing */
  clear(): void {
    this.queue.length = 0;
  }
}

/**
 * Consent manager for GDPR compliance
 *
 * @class
 */
export class ConsentManager {
  /** Storage key for consent */
  private static readonly STORAGE_KEY = "tracking-consent";
  /** Current consent state */
  private consent: TrackingConsent | null = null;

  /**
   * Loads consent from storage
   *
   * @returns {TrackingConsent | null} Consent state or null
   */
  loadConsent(): TrackingConsent | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(ConsentManager.STORAGE_KEY);
      if (!stored) return null;

      this.consent = JSON.parse(stored);
      return this.consent;
    } catch {
      return null;
    }
  }

  /**
   * Saves consent to storage
   *
   * @param {TrackingConsent} consent - Consent to save
   */
  saveConsent(consent: TrackingConsent): void {
    this.consent = consent;

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          ConsentManager.STORAGE_KEY,
          JSON.stringify(consent),
        );
      } catch (error) {
        console.error("Failed to save consent:", error);
      }
    }
  }

  /**
   * Checks if tracking is consented
   *
   * @param {string} [category] - Specific category to check
   * @returns {boolean} Whether tracking is consented
   */
  isConsented(category?: keyof TrackingConsent["categories"]): boolean {
    if (!this.consent) {
      this.loadConsent();
    }

    if (!this.consent?.consented) return false;

    if (category && this.consent.categories) {
      return this.consent.categories[category] ?? false;
    }

    return this.consent.consented;
  }

  /** Clears consent */
  clearConsent(): void {
    this.consent = null;

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(ConsentManager.STORAGE_KEY);
      } catch (error) {
        console.error("Failed to clear consent:", error);
      }
    }
  }
}

/**
 * Creates event metadata
 *
 * @param {string} [source='client'] - Event source. Default is `'client'`
 * @returns {EventMetadata} Event metadata
 */
export function createEventMetadata(
  source: "client" | "server" = "client",
): EventMetadata {
  return {
    id: generateEventId(),
    timestamp: new Date(),
    source,
    version: "1.0.0",
    retryCount: 0,
  };
}

/**
 * Generates a unique event ID
 *
 * @returns {string} Event ID
 */
export function generateEventId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
}

/**
 * Creates an event batch
 *
 * @param {QueuedEvent[]} events - Events to batch
 * @param {EventContext} [context] - Common context
 * @returns {EventBatch} Event batch
 */
export function createEventBatch(
  events: QueuedEvent[],
  context?: EventContext,
): EventBatch {
  return {
    batchId: generateEventId(),
    events: events.map((e) => e.event),
    createdAt: new Date().toISOString(),
    context,
  };
}

/**
 * Enriches event with context information
 *
 * @param {TrackingOptions} event - Event to enrich
 * @param {EventContext} context - Context to add
 * @returns {TrackingOptions} Enriched event
 */
export function enrichEventWithContext(
  event: TrackingOptions,
  context: EventContext,
): TrackingOptions {
  return {
    ...event,
    properties: {
      ...event.properties,
      context,
    },
  };
}

/**
 * Extracts device information
 *
 * @returns {Partial<EventContext>} Device context
 */
export function getDeviceContext(): Partial<EventContext> {
  if (typeof window === "undefined") {
    return {
      platform: "server",
      environment: process.env.NODE_ENV as
        | "production"
        | "staging"
        | "development",
    };
  }

  const ua = window.navigator.userAgent;
  const platform = window.navigator.platform;

  return {
    platform,
    os: detectOS(ua),
    browser: detectBrowser(ua),
    deviceType: detectDeviceType(ua),
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    locale: window.navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * Detects operating system from user agent
 *
 * @param {string} ua - User agent string
 * @returns {string} Operating system
 */
function detectOS(ua: string): string {
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad"))
    return "iOS";
  return "Unknown";
}

/**
 * Detects browser from user agent
 *
 * @param {string} ua - User agent string
 * @returns {string} Browser name
 */
function detectBrowser(ua: string): string {
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  if (ua.includes("Opera")) return "Opera";
  return "Unknown";
}

/**
 * Detects device type from user agent
 *
 * @param {string} ua - User agent string
 * @returns {'mobile' | 'tablet' | 'desktop'} Device type
 */
function detectDeviceType(ua: string): "mobile" | "tablet" | "desktop" {
  if (/Mobile|Android|iPhone/i.test(ua)) return "mobile";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  return "desktop";
}

/**
 * Debounces a function
 *
 * @template T
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttles a function
 *
 * @template T
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Retries a function with exponential backoff
 *
 * @template T
 * @param {Function} fn - Function to retry
 * @param {number} [maxRetries=3] - Maximum retry attempts. Default is `3`
 * @param {number} [delay=1000] - Initial delay in milliseconds. Default is
 *   `1000`
 * @returns {Promise<T>} Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * 2 ** i));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

/**
 * Sanitizes event properties
 *
 * @param {Record<string, unknown>} properties - Properties to sanitize
 * @returns {Record<string, unknown>} Sanitized properties
 */
export function sanitizeProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    // Remove sensitive keys
    if (isSensitiveKey(key)) continue;

    // Sanitize values
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = Array.isArray(value)
        ? value.map((v) =>
            typeof v === "object"
              ? sanitizeProperties(v as Record<string, unknown>)
              : v,
          )
        : sanitizeProperties(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Checks if a key is sensitive
 *
 * @param {string} key - Key to check
 * @returns {boolean} Whether the key is sensitive
 */
function isSensitiveKey(key: string): boolean {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /auth/i,
    /credit[_-]?card/i,
    /ssn/i,
  ];

  return sensitivePatterns.some((pattern) => pattern.test(key));
}

/**
 * Sanitizes a string value
 *
 * @param {string} value - Value to sanitize
 * @returns {string} Sanitized value
 */
function sanitizeString(value: string): string {
  // Remove potential PII patterns
  return value
    .replace(/\b[\w._%+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");
}

/**
 * Validates user identification data
 *
 * @param {unknown} data - Data to validate
 * @returns {UserIdentification | null} Valid user data or null
 */
export function validateUserIdentification(
  data: unknown,
): UserIdentification | null {
  if (!data || typeof data !== "object") return null;

  const { userId, fullName, email, ...rest } = data as Record<string, unknown>;

  if (!userId || typeof userId !== "string") return null;

  return {
    userId,
    fullName: typeof fullName === "string" ? fullName : null,
    email: typeof email === "string" ? email : undefined,
    ...rest,
  } as UserIdentification;
}

/**
 * Formats event for logging
 *
 * @param {TrackingOptions} event - Event to format
 * @returns {string} Formatted event string
 */
export function formatEventForLogging(event: TrackingOptions): string {
  const { event: eventName, properties, timestamp, severity, status } = event;

  const parts = [
    `[${timestamp || new Date().toISOString()}]`,
    severity && `[${severity.toUpperCase()}]`,
    `Event: ${eventName}`,
    status && `Status: ${status}`,
    properties &&
      Object.keys(properties).length > 0 &&
      `Properties: ${JSON.stringify(properties, null, 2)}`,
  ].filter(Boolean);

  return parts.join(" ");
}
