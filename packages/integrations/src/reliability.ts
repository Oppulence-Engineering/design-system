import { z } from "zod";

import {
  CONNECTION_STATES,
  IntegrationConnectionIssueSchema,
  SafeIntegrationSummarySchema,
  type IntegrationConnectionIssue,
  type IntegrationConnectionProjection,
} from "./contracts";

export const INTEGRATION_FAILURE_PHASES = [
  "connect",
  "authorize",
  "refresh",
  "request",
  "sync",
  "webhook",
  "disconnect",
] as const;

export const INTEGRATION_FAILURE_CODES = [
  "authorization_denied",
  "authorization_expired",
  "credential_invalid",
  "credential_revoked",
  "rate_limited",
  "provider_unavailable",
  "provider_timeout",
  "webhook_invalid",
  "webhook_replayed",
  "sync_failed",
  "configuration_invalid",
  "unknown",
] as const;

export const IntegrationFailurePhaseSchema = z.enum(INTEGRATION_FAILURE_PHASES);
export const IntegrationFailureCodeSchema = z.enum(INTEGRATION_FAILURE_CODES);

const RETRYABLE_FAILURE_CODES = new Set<
  (typeof INTEGRATION_FAILURE_CODES)[number]
>(["rate_limited", "provider_unavailable", "provider_timeout", "sync_failed"]);

export const IntegrationFailureSchema = z
  .object({
    phase: IntegrationFailurePhaseSchema,
    code: IntegrationFailureCodeSchema,
    retryable: z.boolean(),
    summary: SafeIntegrationSummarySchema,
  })
  .strict()
  .superRefine((failure, context) => {
    if (failure.retryable !== isRetryableIntegrationFailure(failure.code)) {
      context.addIssue({
        code: "custom",
        path: ["retryable"],
        message: `retryable must match the ${failure.code} failure policy.`,
      });
    }
  });

export type IntegrationFailure = z.infer<typeof IntegrationFailureSchema>;

export function isRetryableIntegrationFailure(
  code: IntegrationFailure["code"],
): boolean {
  return RETRYABLE_FAILURE_CODES.has(code);
}

export function createIntegrationFailure(
  input: IntegrationFailure,
): IntegrationFailure {
  return IntegrationFailureSchema.parse(input);
}

function errorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value.toLocaleLowerCase("en-US") : "";
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidates = [
    (error as { status?: unknown }).status,
    (error as { statusCode?: unknown }).statusCode,
    (error as { response?: { status?: unknown } }).response?.status,
    (error as { response?: { statusCode?: unknown } }).response?.statusCode,
  ];
  return candidates.find(
    (value): value is number =>
      typeof value === "number" && Number.isInteger(value),
  );
}

function errorRetryable(error: unknown): boolean | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as { retryable?: unknown }).retryable;
  return typeof value === "boolean" ? value : undefined;
}

export interface IntegrationFailureObservation {
  readonly phase: IntegrationFailure["phase"];
  readonly failure: IntegrationFailure;
  readonly integrationId?: string;
  readonly connectionId?: string;
}

export type IntegrationFailureObserver = (
  input: IntegrationFailureObservation,
) => void | Promise<void>;

/** Classifies a runtime error and reports only the safe result to the observer. */
export async function reportIntegrationFailure(
  observer: IntegrationFailureObserver | undefined,
  input: {
    phase: IntegrationFailure["phase"];
    error: unknown;
    integrationId?: string;
    connectionId?: string;
  },
): Promise<IntegrationFailure> {
  const failure = classifyIntegrationFailure(input);
  try {
    await observer?.({
      phase: input.phase,
      failure,
      integrationId: input.integrationId,
      connectionId: input.connectionId,
    });
  } catch {
    // Observability must never mask the provider/runtime failure.
  }
  return failure;
}

/**
 * Converts provider/runtime failures into a stable, secret-free product
 * failure. Callers may pass an SDK error or a small `{ status, code }` shape;
 * raw provider messages are intentionally ignored.
 */
export function classifyIntegrationFailure(input: {
  phase: IntegrationFailure["phase"];
  error: unknown;
}): IntegrationFailure {
  const code = errorCode(input.error);
  const status = errorStatus(input.error);
  const retryable = errorRetryable(input.error);
  if (code.includes("signature") || code.includes("webhook_invalid")) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "webhook_invalid",
      retryable: false,
      summary: "The provider delivery could not be verified.",
    });
  }
  if (code.includes("replay")) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "webhook_replayed",
      retryable: false,
      summary: "The provider delivery was already processed.",
    });
  }
  if (
    code.includes("authorization_denied") ||
    code.includes("authorization_failed") ||
    code.includes("oauth_denied") ||
    code.includes("access_denied")
  ) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "authorization_denied",
      retryable: false,
      summary: "The provider authorization was denied.",
    });
  }
  if (
    code.includes("state_expired") ||
    code.includes("authorization_expired") ||
    code.includes("oauth_state_expired")
  ) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "authorization_expired",
      retryable: false,
      summary: "The provider authorization session expired.",
    });
  }
  if (code.includes("timeout") || status === 408 || status === 504) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "provider_timeout",
      retryable: true,
      summary: "The provider did not respond before the request timeout.",
    });
  }
  if (status === 429 || code.includes("rate")) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "rate_limited",
      retryable: true,
      summary: "The provider temporarily limited requests.",
    });
  }
  if (
    (status !== undefined && status >= 500) ||
    code.includes("provider_unavailable") ||
    code.includes("service_unavailable") ||
    code.includes("api_base_unavailable") ||
    ((code.includes("oauth2_token_exchange_failed") ||
      code.includes("oauth2_refresh_failed")) &&
      (status === undefined ||
        status === 408 ||
        status === 429 ||
        status >= 500))
  ) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "provider_unavailable",
      retryable: true,
      summary: "The provider is temporarily unavailable.",
    });
  }
  if (
    retryable === true ||
    code.includes("oauth2_api_request_failed") ||
    code.includes("api_request_failed") ||
    code.includes("subscription_failed") ||
    code.includes("connection_link_token_failed") ||
    code.includes("connection_link_completion_failed")
  ) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "provider_unavailable",
      retryable: true,
      summary: "The provider is temporarily unavailable.",
    });
  }
  if (
    code.includes("revoked") ||
    code.includes("invalid_grant") ||
    code.includes("refresh_token_invalid")
  ) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "credential_revoked",
      retryable: false,
      summary: "The provider authorization is no longer valid.",
    });
  }
  if (
    code.includes("sync_enqueue_failed") ||
    code.includes("finalization_failed") ||
    code.includes("delivery_failed")
  ) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "sync_failed",
      retryable: true,
      summary: "The integration synchronization did not complete.",
    });
  }
  if (
    code.includes("token_exchange_failed") &&
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== 429
  ) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "authorization_denied",
      retryable: false,
      summary: "The provider authorization was denied.",
    });
  }
  if (
    code.includes("refresh_failed") &&
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== 429
  ) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "credential_revoked",
      retryable: false,
      summary: "The provider authorization is no longer valid.",
    });
  }
  if (
    status === 401 ||
    status === 403 ||
    code.includes("credential") ||
    code.includes("unauthorized")
  ) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "credential_invalid",
      retryable: false,
      summary: "The provider credential was rejected.",
    });
  }
  if (
    code.includes("configuration") ||
    code.includes("invalid_api_path") ||
    code.includes("connection_mode_unsupported") ||
    code.includes("provider_sdk_operation_unavailable") ||
    code.includes("trigger_source_unavailable") ||
    code.includes("request_invalid") ||
    code.includes("api_key_invalid") ||
    code.includes("no_auth_invalid") ||
    code.includes("connection_link_input_invalid")
  ) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "configuration_invalid",
      retryable: false,
      summary: "The integration configuration needs attention.",
    });
  }
  if (code.includes("credential_refresh_unavailable")) {
    return createIntegrationFailure({
      phase: input.phase,
      code: "credential_invalid",
      retryable: false,
      summary: "The provider credential cannot be refreshed.",
    });
  }
  if (input.phase === "sync") {
    return createIntegrationFailure({
      phase: input.phase,
      code: "sync_failed",
      retryable: true,
      summary: "The provider synchronization did not complete.",
    });
  }
  return createIntegrationFailure({
    phase: input.phase,
    code: "unknown",
    retryable: false,
    summary: "The integration request could not be completed.",
  });
}

export function createConnectionIssue(input: {
  code: IntegrationConnectionIssue["code"];
  summary: string;
  recoverable: boolean;
  severity?: IntegrationConnectionIssue["severity"];
  suggestedAction?: IntegrationConnectionIssue["suggestedAction"];
  occurredAt?: string;
  nextRetryAt?: string;
}): IntegrationConnectionIssue {
  return IntegrationConnectionIssueSchema.parse(input);
}

export interface ConnectionRecoveryPlan {
  readonly state: (typeof CONNECTION_STATES)[number];
  readonly primaryAction:
    | "connect"
    | "reconnect"
    | "sync_now"
    | "configure"
    | "disconnect"
    | "inspect"
    | undefined;
  readonly shouldNotify: boolean;
  readonly summary: string;
}

/**
 * Converts safe connection state into one deterministic customer-facing
 * recovery recommendation. Authorization and action permission remain owned
 * by the product; this helper only chooses among already-permitted actions.
 */
export function planConnectionRecovery(
  connection: Pick<
    IntegrationConnectionProjection,
    "state" | "permittedActions" | "safeIssue" | "sourceFreshness"
  >,
): ConnectionRecoveryPlan {
  const permitted = new Set(connection.permittedActions);
  const issue = connection.safeIssue;
  const stale =
    connection.state === "stale" ||
    connection.sourceFreshness?.state === "stale";
  const failed =
    connection.state === "attention" ||
    connection.sourceFreshness?.state === "failed";
  const suggestedAction =
    issue?.suggestedAction && permitted.has(issue.suggestedAction)
      ? issue.suggestedAction
      : undefined;

  if (connection.state === "not_connected") {
    return {
      state: connection.state,
      primaryAction: permitted.has("connect") ? "connect" : undefined,
      shouldNotify: false,
      summary: "Connect this provider to begin using its enabled capabilities.",
    };
  }
  if (
    connection.state === "authorizing" ||
    connection.state === "initial_sync"
  ) {
    return {
      state: connection.state,
      primaryAction: permitted.has("inspect") ? "inspect" : undefined,
      shouldNotify: false,
      summary:
        connection.state === "authorizing"
          ? "Authorization is in progress."
          : "The first synchronization is in progress.",
    };
  }
  if (connection.state === "disconnected") {
    return {
      state: connection.state,
      primaryAction:
        suggestedAction ??
        (permitted.has("reconnect") ? "reconnect" : undefined),
      shouldNotify: true,
      summary: issue?.summary ?? "Reconnect this provider to restore access.",
    };
  }
  if (failed) {
    return {
      state: connection.state,
      primaryAction:
        suggestedAction ??
        (permitted.has("reconnect")
          ? "reconnect"
          : permitted.has("sync_now")
            ? "sync_now"
            : permitted.has("configure")
              ? "configure"
              : undefined),
      shouldNotify: true,
      summary: issue?.summary ?? "This provider needs attention.",
    };
  }
  if (stale) {
    return {
      state: connection.state,
      primaryAction:
        suggestedAction ??
        (permitted.has("sync_now")
          ? "sync_now"
          : permitted.has("reconnect")
            ? "reconnect"
            : permitted.has("inspect")
              ? "inspect"
              : undefined),
      shouldNotify: true,
      summary: issue?.summary ?? "This provider has stale data.",
    };
  }
  return {
    state: connection.state,
    primaryAction: permitted.has("inspect") ? "inspect" : undefined,
    shouldNotify: false,
    summary: issue?.summary ?? "This provider is healthy.",
  };
}
