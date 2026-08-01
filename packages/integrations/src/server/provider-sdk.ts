import { SIMSTUDIO_BASELINE } from "../catalog";
import type { IntegrationCredentialReference } from "./credentials";

export interface ProviderSdkInvocation {
  integrationId: string;
  operationId: string;
  reference: IntegrationCredentialReference;
  input: Readonly<Record<string, unknown>>;
  idempotencyKey?: string;
}

export interface ProviderSdkResult {
  operationId: string;
  output: unknown;
}

/**
 * Package-owned execution lanes. A provider can compose SDK, declarative REST,
 * and special-protocol adapters as long as every operation has one owner.
 */
export type IntegrationProviderExecutionLane = "sdk" | "typed_rest" | "special";

/**
 * A server-only, package-owned provider execution adapter. SDK adapters are
 * the default; typed REST and special-protocol adapters use the same boundary
 * when an SDK is unavailable or unsuitable for an operation.
 */
export interface IntegrationProviderSdk {
  readonly integrationId: string;
  readonly operationIds: readonly string[];
  /** Omitted by existing adapters and treated as the SDK-first default. */
  readonly executionLane?: IntegrationProviderExecutionLane;
  execute(input: ProviderSdkInvocation): Promise<ProviderSdkResult>;
}

/** Lookup and execution boundary for package-owned provider SDK adapters. */
export interface IntegrationProviderSdkRegistry {
  get(integrationId: string): IntegrationProviderSdk | undefined;
  /** Returns the lane for an operation, or the sole lane for a provider. */
  getExecutionLane(
    integrationId: string,
    operationId?: string,
  ): IntegrationProviderExecutionLane | undefined;
  execute(input: ProviderSdkInvocation): Promise<ProviderSdkResult>;
}

export class IntegrationProviderSdkError extends Error {
  readonly code:
    | "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID"
    | "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID"
    | "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE"
    | "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH"
    | "INTEGRATION_PROVIDER_EXECUTION_REQUEST_FAILED"
    | "INTEGRATION_PROVIDER_EXECUTION_RESPONSE_INVALID";

  constructor(code: IntegrationProviderSdkError["code"]) {
    super("The integration provider SDK request could not be completed.");
    this.name = "IntegrationProviderSdkError";
    this.code = code;
  }
}

/**
 * Combines package-owned SDK adapters into one strict execution boundary.
 * Product routes can authorize a connection and dispatch an operation without
 * ever receiving an OAuth token or API key.
 */
export function createIntegrationProviderSdkRegistry(
  providers: readonly IntegrationProviderSdk[],
): IntegrationProviderSdkRegistry {
  const byIntegrationId = new Map<string, IntegrationProviderSdk[]>();
  const byOperationId = new Map<string, IntegrationProviderSdk>();
  for (const provider of providers) {
    const executionLane = provider.executionLane ?? "sdk";
    if (
      !provider.integrationId ||
      new Set(provider.operationIds).size !== provider.operationIds.length ||
      provider.operationIds.some(
        (operationId) => !operationId.startsWith(`${provider.integrationId}:`),
      ) ||
      !["sdk", "typed_rest", "special"].includes(executionLane)
    ) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
      );
    }
    for (const operationId of provider.operationIds) {
      if (byOperationId.has(operationId)) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
        );
      }
      byOperationId.set(operationId, provider);
    }
    const providersForIntegration = byIntegrationId.get(provider.integrationId);
    if (providersForIntegration) {
      providersForIntegration.push(provider);
    } else {
      byIntegrationId.set(provider.integrationId, [provider]);
    }
  }

  function providerFor(
    integrationId: string,
    operationId: string,
  ): IntegrationProviderSdk | undefined {
    const provider = byOperationId.get(operationId);
    return provider?.integrationId === integrationId ? provider : undefined;
  }

  function aggregateProvider(
    integrationId: string,
  ): IntegrationProviderSdk | undefined {
    const providersForIntegration = byIntegrationId.get(integrationId);
    if (!providersForIntegration?.length) {
      return undefined;
    }
    if (providersForIntegration.length === 1) {
      return providersForIntegration[0];
    }
    const operationIds = providersForIntegration.flatMap(
      (provider) => provider.operationIds,
    );
    const lanes = new Set(
      providersForIntegration.map(
        (provider) => provider.executionLane ?? "sdk",
      ),
    );
    return {
      integrationId,
      operationIds,
      ...(lanes.size === 1
        ? {
            executionLane: providersForIntegration[0]?.executionLane ?? "sdk",
          }
        : {}),
      async execute(input) {
        const provider = providerFor(input.integrationId, input.operationId);
        if (!provider) {
          throw new IntegrationProviderSdkError(
            "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
          );
        }
        return provider.execute(input);
      },
    };
  }

  return {
    get(integrationId) {
      return aggregateProvider(integrationId);
    },
    getExecutionLane(integrationId, operationId) {
      if (operationId) {
        const provider = providerFor(integrationId, operationId);
        return provider?.executionLane ?? (provider ? "sdk" : undefined);
      }
      return aggregateProvider(integrationId)?.executionLane;
    },
    async execute(input) {
      const provider = providerFor(input.integrationId, input.operationId);
      if (!provider) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return provider.execute(input);
    },
  };
}

export interface ProviderSdkCoverageReport {
  sourceProviders: number;
  sourceOperations: number;
  sourceTriggers: number;
  executableProviders: number;
  executableOperations: number;
  executableTriggers: number;
  unimplementedProviders: number;
  unimplementedOperations: number;
  unimplementedTriggers: number;
  hasCompleteExecutionParity: boolean;
}

/**
 * Reports executable package coverage against the pinned Sim Studio source.
 * Catalogue and protocol records are deliberately excluded: an operation is
 * counted only when a package-owned SDK adapter can execute it.
 */
export function getProviderSdkCoverageReport(
  registry: IntegrationProviderSdkRegistry,
): ProviderSdkCoverageReport {
  const sourceProviders = SIMSTUDIO_BASELINE.integrations;
  const sourceOperationIds = new Set(
    sourceProviders.flatMap((provider) =>
      provider.operations.map((operation) => operation.id),
    ),
  );
  const executableProviders = sourceProviders.filter((provider) =>
    registry.get(provider.id),
  );
  const executableOperationIds = new Set(
    executableProviders.flatMap(
      (provider) => registry.get(provider.id)?.operationIds ?? [],
    ),
  );
  const executableOperations = [...executableOperationIds].filter(
    (operationId) => sourceOperationIds.has(operationId),
  ).length;
  const sourceTriggers = sourceProviders.reduce(
    (count, provider) => count + provider.triggers.length,
    0,
  );
  const sourceOperations = sourceOperationIds.size;
  const executableProviderCount = executableProviders.length;
  const executableTriggers = 0;
  return {
    sourceProviders: sourceProviders.length,
    sourceOperations,
    sourceTriggers,
    executableProviders: executableProviderCount,
    executableOperations,
    executableTriggers,
    unimplementedProviders: sourceProviders.length - executableProviderCount,
    unimplementedOperations: sourceOperations - executableOperations,
    unimplementedTriggers: sourceTriggers,
    hasCompleteExecutionParity:
      executableProviderCount === sourceProviders.length &&
      executableOperations === sourceOperations &&
      executableTriggers === sourceTriggers,
  };
}
