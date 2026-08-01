import { z } from "zod";

import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationApiKeyRuntime } from "../../api-key-runtime";
import type { IntegrationNoAuthRuntime } from "../../no-auth-runtime";
import { createIntegrationTypedRestProvider } from "../../provider-rest";
import type {
  IntegrationTypedRestMethod,
  IntegrationTypedRestTool,
} from "../../provider-rest";
import { IntegrationProviderSdkError } from "../../provider-sdk";
import type { IntegrationProviderPack } from "../../provider-pack";
import type { IntegrationProviderSdk } from "../../provider-sdk";
import type { IntegrationOAuthRuntime } from "../../runtime";

export type RestInput = Record<string, unknown>;

/**
 * Most provider responses are a JSON document whose exact shape is the
 * provider's business. The lane still validates that it *is* one, and bounds
 * how much of it is read, which is what keeps an oversized or non-JSON body
 * from reaching a product.
 */
export const RestDocumentSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

/** Builds a query string from defined values only. */
export function restQuery(values: Readonly<Record<string, unknown>>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const entry of value) query.append(key, String(entry));
      continue;
    }
    query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * Escapes a caller value that becomes a path segment. The lane already refuses
 * a path that leaves the provider host, but a segment that smuggles a slash
 * would still address a different resource, so it is encoded here.
 */
export function restSegment(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const segment = String(value);
  if (!segment || segment.length > 512) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return encodeURIComponent(segment);
}

/** The compact per-action shape a REST pack declares. */
export interface RestAction<TInput extends RestInput = RestInput> {
  /** Source action ID suffix, for example "search". */
  readonly action: string;
  readonly name: string;
  readonly description: string;
  readonly method: IntegrationTypedRestMethod;
  readonly url: string | ((input: TInput) => string);
  readonly body?: (
    input: TInput,
  ) => Readonly<Record<string, unknown>> | string | undefined;
  readonly input: z.ZodType<TInput>;
  readonly output?: z.ZodType<unknown>;
  readonly headers?: (input: TInput) => Record<string, string>;
  readonly maxResponseBytes?: number;
  /** Set when a response carries no body, such as a 204 delete. */
  readonly emptyResponse?: boolean;
}

export type RestTransportKind = "api_key" | "oauth2" | "none";

export interface RestPackConfig {
  integrationId: string;
  /**
   * Why this provider is on the typed REST lane. Recorded against every
   * action, which is what the pack contract requires before REST is allowed.
   */
  sdkReview: string;
  transportKind: RestTransportKind;
  actions: readonly RestAction<any>[];
  /** Default headers merged into every request. */
  headers?: Readonly<Record<string, string>>;
}

export interface RestRuntimes {
  apiKeyRuntime?: Pick<IntegrationApiKeyRuntime, "request">;
  oauthRuntime?: Pick<IntegrationOAuthRuntime, "request">;
  noAuthRuntime?: Pick<IntegrationNoAuthRuntime, "request">;
}

function toolFor(
  integrationId: string,
  action: RestAction<any>,
  defaults: Readonly<Record<string, string>>,
): IntegrationTypedRestTool<any, unknown> {
  const outputSchema = action.emptyResponse
    ? (z.object({ ok: z.literal(true) }).strict() as z.ZodType<unknown>)
    : (action.output ?? (RestDocumentSchema as z.ZodType<unknown>));
  return {
    id: `${integrationId}:${action.action}`,
    name: action.name,
    description: action.description,
    version: "1.0.0",
    // The Zod schema is the contract; `params` exists for tool discovery.
    params: {},
    request: {
      method: action.method,
      url: action.url,
      headers: (input) => ({
        accept: "application/json",
        ...defaults,
        ...(action.headers?.(input) ?? {}),
      }),
      ...(action.body ? { body: action.body } : {}),
      ...(action.method === "GET" || action.method === "HEAD"
        ? { retry: { enabled: true } }
        : {}),
    },
    inputSchema: action.input,
    outputSchema,
    ...(action.emptyResponse
      ? { transformResponse: async () => ({ ok: true as const }) }
      : {}),
    maxResponseBytes: action.maxResponseBytes ?? 512 * 1024,
  };
}

/** Builds the executable adapter for a typed REST provider. */
export function createRestProviderSdk(
  config: RestPackConfig,
  runtimes: RestRuntimes,
): IntegrationProviderSdk | undefined {
  const defaults = config.headers ?? {};
  const tools = config.actions.map((action) =>
    toolFor(config.integrationId, action, defaults),
  );
  if (config.transportKind === "oauth2") {
    if (!runtimes.oauthRuntime) return undefined;
    return createIntegrationTypedRestProvider({
      integrationId: config.integrationId,
      transport: { kind: "oauth2", runtime: runtimes.oauthRuntime },
      tools,
    });
  }
  if (config.transportKind === "api_key") {
    if (!runtimes.apiKeyRuntime) return undefined;
    return createIntegrationTypedRestProvider({
      integrationId: config.integrationId,
      transport: { kind: "api_key", runtime: runtimes.apiKeyRuntime },
      tools,
    });
  }
  if (!runtimes.noAuthRuntime) return undefined;
  return createIntegrationTypedRestProvider({
    integrationId: config.integrationId,
    transport: { kind: "none", runtime: runtimes.noAuthRuntime },
    tools,
  });
}

/**
 * Wraps a typed REST action table as a delivery unit. Coverage is derived from
 * the pinned source, so an action the pack forgets shows up as deferred rather
 * than silently vanishing.
 */
export function createRestPack(
  config: RestPackConfig,
): IntegrationProviderPack {
  const baseline = SIMSTUDIO_BASELINE.integrations.find(
    (integration) => integration.id === config.integrationId,
  );
  if (!baseline) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const declared = new Set(
    config.actions.map((action) => `${config.integrationId}:${action.action}`),
  );

  return {
    integrationId: config.integrationId,
    coverage: baseline.operations.map((operation) =>
      declared.has(operation.id)
        ? {
            sourceOperationId: operation.id,
            lane: "typed_rest" as const,
            disposition: "supported" as const,
            sdkReview: config.sdkReview,
          }
        : {
            sourceOperationId: operation.id,
            disposition: "deferred" as const,
            reason: "No request is mapped for this action.",
          },
    ),
    triggerCoverage: baseline.triggers.map((trigger) => ({
      sourceTriggerId: trigger.id,
      disposition: "deferred" as const,
      reason:
        "Trigger delivery is scheduled with the trigger family work, not the action pack.",
    })),
    create(context) {
      const provider = createRestProviderSdk(config, context);
      return provider ? [provider] : [];
    },
  };
}
