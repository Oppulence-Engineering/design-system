import { createRequire } from "node:module";

import { SIMSTUDIO_BASELINE } from "../../../../catalog";
import { IntegrationProviderSdkError } from "../../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../../core/provider-pack";
import type { IntegrationOAuthRuntime } from "../../../runtime/oauth";
import {
  invokeSdkMethod,
  normalizeSdkOutput,
  ProviderSdkInvocationSchema,
  requiredInputString,
  type SdkMethodTarget,
} from "../sdk";

const atlassianRequire = createRequire(import.meta.url);

type AtlassianInput = Readonly<Record<string, unknown>>;

/**
 * One Atlassian SDK operation, addressed by the client's resource group and
 * method name. Using a dotted path keeps 119 actions declarative rather than
 * 119 hand-written call sites.
 */
export interface AtlassianOperation {
  /** Client group and method, for example ["issues", "getIssue"]. */
  readonly path: readonly [string, string];
  readonly params?: (input: AtlassianInput) => Record<string, unknown>;
  /** Response projection; defaults to shared SDK output normalisation. */
  readonly output?: (value: unknown, input: AtlassianInput) => unknown;
}

/**
 * Atlassian OAuth 3LO issues one token per site, and the site is identified by
 * a non-secret cloud ID. Products persist it on their own connection row and
 * pass it as operation input, which keeps site selection out of the credential
 * envelope.
 */
export function requiredCloudId(input: AtlassianInput): string {
  const cloudId = requiredInputString(input, "cloudId", "siteId");
  if (cloudId.length > 128 || !/^[A-Za-z0-9-]+$/u.test(cloudId)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return cloudId;
}

export type AtlassianClientFactory = (input: {
  accessToken: string;
  cloudId: string;
}) => SdkMethodTarget;

/** Jira Cloud v3 client, routed through the Atlassian API gateway. */
export function createJiraClient(input: {
  accessToken: string;
  cloudId: string;
}): SdkMethodTarget {
  const { Version3Client } = atlassianRequire("jira.js") as {
    Version3Client: new (config: unknown) => SdkMethodTarget;
  };
  return new Version3Client({
    authentication: {
      oauth2: { accessToken: input.accessToken, cloudId: input.cloudId },
    },
  });
}

/** Jira Service Management client from the same maintained package. */
export function createJiraServiceDeskClient(input: {
  accessToken: string;
  cloudId: string;
}): SdkMethodTarget {
  const { ServiceDeskClient } = atlassianRequire("jira.js") as {
    ServiceDeskClient: new (config: unknown) => SdkMethodTarget;
  };
  return new ServiceDeskClient({
    authentication: {
      oauth2: { accessToken: input.accessToken, cloudId: input.cloudId },
    },
  });
}

/**
 * Confluence needs both generations: v2 owns pages, spaces, and comments,
 * while CQL search, space updates, label writes, and attachment uploads exist
 * only on v1. The merged client exposes each group under its own key.
 */
export function createConfluenceClient(input: {
  accessToken: string;
  cloudId: string;
}): SdkMethodTarget {
  const { createV1Client, createV2Client } = atlassianRequire(
    "confluence.js",
  ) as {
    createV1Client: (config: unknown) => Record<string, unknown>;
    createV2Client: (config: unknown) => Record<string, unknown>;
  };
  const config = {
    auth: {
      type: "oauth2",
      accessToken: input.accessToken,
      cloudId: input.cloudId,
    },
  };
  const v1 = createV1Client(config);
  const v2 = createV2Client(config);
  // v2 wins on overlapping group names; v1 fills the gaps it does not model.
  return { ...v1, ...v2, v1, v2 } as SdkMethodTarget;
}

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

export interface AtlassianProviderSdkConfig {
  integrationId: string;
  operations: Readonly<Record<string, AtlassianOperation>>;
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory: AtlassianClientFactory;
}

/**
 * Builds one Atlassian-backed adapter from an operation table. Jira, Jira
 * Service Management, and Confluence all share this executor, so cloud-ID
 * validation and output normalisation are defined once.
 */
export function createAtlassianProviderSdk(
  config: AtlassianProviderSdkConfig,
): IntegrationProviderSdk {
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
      const cloudId = requiredCloudId(invocation.input);
      const parameters = operation.params?.(invocation.input) ?? {};

      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const client = config.clientFactory({
            accessToken: credential.accessToken,
            cloudId,
          });
          const result = await invokeSdkMethod(client, {
            path: operation.path,
            arguments: [parameters],
          });
          return {
            operationId: invocation.operationId,
            output: operation.output
              ? operation.output(result, invocation.input)
              : normalizeSdkOutput(result),
          };
        },
      );
    },
  };
}

export interface AtlassianPackConfig {
  integrationId: string;
  operations: Readonly<Record<string, AtlassianOperation>>;
  clientFactory: AtlassianClientFactory;
  triggerCoverage: IntegrationProviderPack["triggerCoverage"];
  /**
   * Actions with no SDK method, each recording the review that justifies the
   * typed REST lane, plus the adapters that execute them.
   */
  restCoverage?: Readonly<Record<string, string>>;
  createRestAdapters?: (
    context: Parameters<IntegrationProviderPack["create"]>[0],
  ) => readonly IntegrationProviderSdk[];
}

/** Wraps an Atlassian operation table as a delivery unit. */
export function createAtlassianPack(
  config: AtlassianPackConfig,
): IntegrationProviderPack {
  const baseline = SIMSTUDIO_BASELINE.integrations.find(
    (integration) => integration.id === config.integrationId,
  );
  if (!baseline) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const restCoverage = config.restCoverage ?? {};

  return {
    integrationId: config.integrationId,
    coverage: baseline.operations.map((operation) => {
      if (config.operations[operation.id]) {
        return {
          sourceOperationId: operation.id,
          lane: "sdk" as const,
          disposition: "supported" as const,
        };
      }
      const sdkReview = restCoverage[operation.id];
      if (sdkReview) {
        return {
          sourceOperationId: operation.id,
          lane: "typed_rest" as const,
          disposition: "supported" as const,
          sdkReview,
        };
      }
      return {
        sourceOperationId: operation.id,
        disposition: "deferred" as const,
        reason: "No Atlassian SDK method is mapped for this action.",
      };
    }),
    triggerCoverage: config.triggerCoverage,
    create(context) {
      if (!context.oauthRuntime) return [];
      return [
        createAtlassianProviderSdk({
          integrationId: config.integrationId,
          operations: config.operations,
          oauthRuntime: context.oauthRuntime,
          clientFactory: config.clientFactory,
        }),
        ...(config.createRestAdapters?.(context) ?? []),
      ];
    },
  };
}
