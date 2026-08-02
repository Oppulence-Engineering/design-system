import { createRequire } from "node:module";

import { SIMSTUDIO_BASELINE } from "../../../../catalog";
import { IntegrationProviderSdkError } from "../../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../../core/provider-pack";
import type { IntegrationOAuthRuntime } from "../../../runtime/oauth";
import { ProviderSdkInvocationSchema } from "../sdk";

const graphRequire = createRequire(import.meta.url);

/**
 * Structural view of the fluent builder returned by
 * `@microsoft/microsoft-graph-client`. Typing it here keeps every Graph pack
 * testable with an injected client and free of `any`.
 */
export interface MicrosoftGraphRequestBuilder {
  version(value: string): MicrosoftGraphRequestBuilder;
  query(parameters: Record<string, unknown>): MicrosoftGraphRequestBuilder;
  header(name: string, value: string): MicrosoftGraphRequestBuilder;
  responseType(value: string): MicrosoftGraphRequestBuilder;
  get(): Promise<unknown>;
  post(body?: unknown): Promise<unknown>;
  patch(body?: unknown): Promise<unknown>;
  put(body?: unknown): Promise<unknown>;
  delete(): Promise<unknown>;
}

export interface MicrosoftGraphClient {
  api(path: string): MicrosoftGraphRequestBuilder;
}

export type MicrosoftGraphClientFactory = (
  accessToken: string,
) => MicrosoftGraphClient;

type GraphInput = Readonly<Record<string, unknown>>;

export type MicrosoftGraphMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface MicrosoftGraphOperation {
  readonly method: MicrosoftGraphMethod;
  /** Graph resource path, already URL-encoded by the pack. */
  readonly path: (input: GraphInput) => string;
  readonly query?: (input: GraphInput) => Record<string, unknown> | undefined;
  /** Request headers, such as the If-Match ETag Planner writes require. */
  readonly headers?: (input: GraphInput) => Record<string, string> | undefined;
  readonly body?: (input: GraphInput) => unknown;
  /** Response projection; defaults to the shared Graph envelope cleanup. */
  readonly output?: (value: unknown, input: GraphInput) => unknown;
  /** Set for endpoints that return raw bytes, such as file downloads. */
  readonly responseType?: "text" | "arraybuffer";
}

/**
 * Lazily loads the official client so registering one Graph pack does not pull
 * the SDK into a process that never uses it.
 */
export function createMicrosoftGraphClient(
  accessToken: string,
): MicrosoftGraphClient {
  const { Client } = graphRequire("@microsoft/microsoft-graph-client") as {
    Client: {
      init(options: {
        authProvider: (
          done: (error: Error | null, token: string | null) => void,
        ) => void;
      }): MicrosoftGraphClient;
    };
  };
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/** Reads a required string, rejecting values that could escape the path. */
export function graphSegment(input: GraphInput, ...names: string[]): string {
  for (const name of names) {
    const value = input[name];
    if (typeof value === "string" && value.trim()) {
      const segment = value.trim();
      if (segment.length > 512 || /[/?#]/u.test(segment))
        throw invocationError();
      return encodeURIComponent(segment);
    }
  }
  throw invocationError();
}

/** Reads an optional path segment with the same escaping guarantees. */
export function optionalGraphSegment(
  input: GraphInput,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const value = input[name];
    if (typeof value === "string" && value.trim()) {
      return graphSegment(input, name);
    }
  }
  return undefined;
}

/**
 * Graph responses carry `@odata.*` service annotations that are noise to a
 * product. Keep paging state, drop the rest.
 */
export function graphOutput(value: unknown): unknown {
  if (value === undefined || value === null) return { deleted: true };
  if (Array.isArray(value)) return value.map(graphOutput);
  if (typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const projection: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (key === "@odata.nextLink") {
      projection.nextLink = entry;
      continue;
    }
    if (key === "@odata.deltaLink") {
      projection.deltaLink = entry;
      continue;
    }
    if (key.startsWith("@odata.")) continue;
    projection[key] = graphOutput(entry);
  }
  return projection;
}

async function runGraphOperation(
  client: MicrosoftGraphClient,
  operation: MicrosoftGraphOperation,
  input: GraphInput,
): Promise<unknown> {
  let builder = client.api(operation.path(input));
  const query = operation.query?.(input);
  if (query && Object.keys(query).length > 0) {
    builder = builder.query(query);
  }
  for (const [name, value] of Object.entries(
    operation.headers?.(input) ?? {},
  )) {
    builder = builder.header(name, value);
  }
  if (operation.responseType) {
    builder = builder.responseType(operation.responseType);
  }
  switch (operation.method) {
    case "GET":
      return builder.get();
    case "DELETE":
      return builder.delete();
    case "POST":
      return builder.post(operation.body?.(input));
    case "PATCH":
      return builder.patch(operation.body?.(input));
    case "PUT":
      return builder.put(operation.body?.(input));
    default:
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
      );
  }
}

export interface MicrosoftGraphProviderSdkConfig {
  integrationId: string;
  operations: Readonly<Record<string, MicrosoftGraphOperation>>;
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: MicrosoftGraphClientFactory;
}

/**
 * Builds one Graph-backed provider adapter from an operation table. All seven
 * Microsoft providers share this executor, so a fix to paging, escaping, or
 * envelope projection lands for every one of them at once.
 */
export function createMicrosoftGraphProviderSdk(
  config: MicrosoftGraphProviderSdkConfig,
): IntegrationProviderSdk {
  const clientFactory = config.clientFactory ?? createMicrosoftGraphClient;
  const operationIds = Object.freeze(Object.keys(config.operations));

  return {
    integrationId: config.integrationId,
    operationIds,
    executionLane: "sdk",
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) throw invocationError();
      const invocation = parsed.data;
      if (
        invocation.integrationId !== config.integrationId ||
        invocation.reference.integrationId !== config.integrationId
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const operation = config.operations[invocation.operationId];
      if (!operation) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const result = await runGraphOperation(
            clientFactory(credential.accessToken),
            operation,
            invocation.input,
          );
          return {
            operationId: invocation.operationId,
            output: operation.output
              ? operation.output(result, invocation.input)
              : graphOutput(result),
          };
        },
      );
    },
  };
}

export interface MicrosoftGraphPackConfig {
  integrationId: string;
  operations: Readonly<Record<string, MicrosoftGraphOperation>>;
  /** Every source trigger, since a pack may not leave one unaccounted for. */
  triggerCoverage: IntegrationProviderPack["triggerCoverage"];
  clientFactory?: MicrosoftGraphClientFactory;
}

/**
 * Wraps a Graph operation table as a delivery unit and checks it against the
 * pinned source at construction, so a missing or invented action fails where
 * the pack is defined rather than at execution time.
 */
export function createMicrosoftGraphPack(
  config: MicrosoftGraphPackConfig,
): IntegrationProviderPack {
  const baseline = SIMSTUDIO_BASELINE.integrations.find(
    (integration) => integration.id === config.integrationId,
  );
  if (!baseline) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return {
    integrationId: config.integrationId,
    coverage: baseline.operations.map((operation) =>
      config.operations[operation.id]
        ? {
            sourceOperationId: operation.id,
            lane: "sdk" as const,
            disposition: "supported" as const,
          }
        : {
            sourceOperationId: operation.id,
            disposition: "deferred" as const,
            reason: "No Microsoft Graph endpoint is mapped for this action.",
          },
    ),
    triggerCoverage: config.triggerCoverage,
    create(context) {
      if (!context.oauthRuntime) return [];
      return [
        createMicrosoftGraphProviderSdk({
          integrationId: config.integrationId,
          operations: config.operations,
          oauthRuntime: context.oauthRuntime,
          ...(config.clientFactory
            ? { clientFactory: config.clientFactory }
            : {}),
        }),
      ];
    },
  };
}
