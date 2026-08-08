import { describe, expect, test } from "bun:test";

import {
  createConnectionIssue,
  createIntegrationFailure,
  classifyIntegrationFailure,
  isRetryableIntegrationFailure,
  planConnectionRecovery,
  reportIntegrationFailure,
} from "../src/reliability";
import { IntegrationConnectionProjectionSchema } from "../src/contracts";

describe("integration reliability helpers", () => {
  test("classifies retryable provider failures without exposing raw errors", () => {
    const failure = createIntegrationFailure({
      phase: "request",
      code: "provider_timeout",
      retryable: true,
      summary: "The provider did not respond before the request timeout.",
    });

    expect(failure).toEqual({
      phase: "request",
      code: "provider_timeout",
      retryable: true,
      summary: "The provider did not respond before the request timeout.",
    });
    expect(isRetryableIntegrationFailure(failure.code)).toBeTrue();
    expect(isRetryableIntegrationFailure("credential_invalid")).toBeFalse();
  });

  test("maps provider failures to safe stable product errors", () => {
    expect(
      classifyIntegrationFailure({
        phase: "request",
        error: { status: 429, message: "secret provider response" },
      }),
    ).toEqual({
      phase: "request",
      code: "rate_limited",
      retryable: true,
      summary: "The provider temporarily limited requests.",
    });
    expect(
      classifyIntegrationFailure({
        phase: "refresh",
        error: { code: "OAUTH2_REFRESH_TOKEN_REVOKED", message: "do not leak" },
      }).summary,
    ).not.toContain("leak");
    expect(
      classifyIntegrationFailure({
        phase: "refresh",
        error: { code: "refresh_timeout" },
      }).code,
    ).toBe("provider_timeout");
    expect(
      classifyIntegrationFailure({
        phase: "request",
        error: { response: { statusCode: 503 } },
      }).code,
    ).toBe("provider_unavailable");
    expect(
      classifyIntegrationFailure({
        phase: "authorize",
        error: { code: "OAUTH2_AUTHORIZATION_FAILED" },
      }).code,
    ).toBe("authorization_denied");
    expect(
      classifyIntegrationFailure({
        phase: "webhook",
        error: { code: "INTEGRATION_WEBHOOK_REPLAYED" },
      }).code,
    ).toBe("webhook_replayed");
    expect(
      classifyIntegrationFailure({
        phase: "request",
        error: { code: "INTEGRATION_CONFIGURATION_INVALID" },
      }).code,
    ).toBe("configuration_invalid");
    expect(
      classifyIntegrationFailure({
        phase: "request",
        error: { code: "OAUTH2_API_REQUEST_FAILED" },
      }),
    ).toMatchObject({ code: "provider_unavailable", retryable: true });
    expect(
      classifyIntegrationFailure({
        phase: "refresh",
        error: { code: "OAUTH2_REFRESH_FAILED" },
      }),
    ).toMatchObject({ code: "provider_unavailable", retryable: true });
    expect(
      classifyIntegrationFailure({
        phase: "authorize",
        error: { code: "OAUTH2_TOKEN_EXCHANGE_FAILED" },
      }),
    ).toMatchObject({ code: "provider_unavailable", retryable: true });
    expect(
      classifyIntegrationFailure({
        phase: "sync",
        error: { code: "INTEGRATION_WEBHOOK_SYNC_ENQUEUE_FAILED" },
      }),
    ).toMatchObject({ code: "sync_failed", retryable: true });
  });

  test("enforces retry policy and safe browser-facing issue summaries", () => {
    expect(() =>
      createIntegrationFailure({
        phase: "request",
        code: "rate_limited",
        retryable: false,
        summary: "The provider temporarily limited requests.",
      }),
    ).toThrow();
    expect(() =>
      createConnectionIssue({
        code: "provider_error",
        summary: "Authorization header sk_live_supersecret was rejected.",
        recoverable: false,
      }),
    ).toThrow();
    expect(() =>
      createConnectionIssue({
        code: "provider_error",
        summary: "The provider credential was rejected.",
        recoverable: false,
        suggestedAction: "reconnect",
      }),
    ).toThrow();
    expect(() =>
      createConnectionIssue({
        code: "provider_error",
        summary: "The provider credential was rejected.",
        recoverable: true,
        suggestedAction: "reconnect",
      }),
    ).not.toThrow();
  });

  test("rejects unsafe issue summaries in the projection schema itself", () => {
    const result = IntegrationConnectionProjectionSchema.safeParse({
      id: "connection-1",
      integrationId: "stripe",
      product: "eigenn",
      displayName: "Stripe",
      state: "attention",
      enabledCapabilities: [],
      permittedActions: ["inspect"],
      safeIssue: {
        code: "provider_error",
        summary: "The provider returned access_token=sk_live_supersecret.",
        recoverable: false,
      },
    });
    expect(result.success).toBeFalse();
  });

  test("reports a safe classified failure without allowing observer errors to escape", async () => {
    const observations: unknown[] = [];
    const failure = await reportIntegrationFailure(
      async (observation) => {
        observations.push(observation);
        throw new Error("observer failure");
      },
      {
        phase: "request",
        error: { status: 429, message: "secret provider message" },
        integrationId: "stripe",
        connectionId: "connection-1",
      },
    );
    expect(failure.code).toBe("rate_limited");
    expect(observations[0]).toMatchObject({
      integrationId: "stripe",
      connectionId: "connection-1",
      failure: { code: "rate_limited" },
    });
    expect(JSON.stringify(observations[0])).not.toContain("secret");
  });

  test("selects reconnect for failed connections and sync for stale data", () => {
    const issue = createConnectionIssue({
      code: "credential_revoked",
      summary: "Reconnect this provider to restore access.",
      recoverable: true,
      suggestedAction: "reconnect",
    });

    expect(
      planConnectionRecovery({
        state: "attention",
        permittedActions: ["reconnect", "inspect"],
        safeIssue: issue,
      }),
    ).toMatchObject({
      primaryAction: "reconnect",
      shouldNotify: true,
    });

    expect(
      planConnectionRecovery({
        state: "healthy",
        permittedActions: ["sync_now", "inspect"],
        sourceFreshness: { state: "stale" },
      }),
    ).toMatchObject({
      primaryAction: "sync_now",
      shouldNotify: true,
    });
  });

  test("never invents a recovery action that the product did not permit", () => {
    expect(
      planConnectionRecovery({
        state: "disconnected",
        permittedActions: ["inspect"],
      }),
    ).toMatchObject({
      primaryAction: undefined,
      shouldNotify: true,
    });
  });
});
