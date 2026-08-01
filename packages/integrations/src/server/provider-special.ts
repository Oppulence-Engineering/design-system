import {
  IntegrationProviderSdkError,
  type IntegrationProviderSdk,
  type ProviderSdkInvocation,
  type ProviderSdkResult,
} from "./provider-sdk";

export interface IntegrationSpecialProviderConfig {
  readonly integrationId: string;
  readonly operationIds: readonly string[];
  /**
   * Package-owned protocol execution, for example a database driver, signed
   * request protocol, file-transfer stream, or vendor SDK operation that
   * cannot use the declarative REST executor. Credentials stay in the
   * closure's server runtime and never enter product code.
   */
  readonly execute: (
    input: ProviderSdkInvocation,
  ) => Promise<ProviderSdkResult>;
}

/**
 * Wraps a special protocol behind the same operation registry and product
 * execution route as SDK and typed REST providers.
 */
export function createIntegrationSpecialProvider(
  config: IntegrationSpecialProviderConfig,
): IntegrationProviderSdk {
  if (
    !config.integrationId ||
    !config.operationIds.length ||
    typeof config.execute !== "function" ||
    new Set(config.operationIds).size !== config.operationIds.length ||
    config.operationIds.some(
      (operationId) => !operationId.startsWith(`${config.integrationId}:`),
    )
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }

  return {
    integrationId: config.integrationId,
    operationIds: config.operationIds,
    executionLane: "special",
    async execute(input) {
      if (
        input.integrationId !== config.integrationId ||
        input.reference.integrationId !== config.integrationId
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      if (!config.operationIds.includes(input.operationId)) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      const result = await config.execute(input);
      if (result.operationId !== input.operationId) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
        );
      }
      return result;
    },
  };
}
