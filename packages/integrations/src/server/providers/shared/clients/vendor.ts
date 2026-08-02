import { SIMSTUDIO_BASELINE } from "../../../../catalog";
import type { IntegrationApiKeyRuntime } from "../../../runtime/api-key";
import { IntegrationProviderSdkError } from "../../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../../core/provider-pack";
import type { IntegrationOAuthRuntime } from "../../../runtime/oauth";
import {
  invokeSdkMethod,
  normalizeSdkOutput,
  ProviderSdkInvocationSchema,
  type SdkMethodTarget,
} from "../sdk";

export type VendorInput = Readonly<Record<string, unknown>>;

/** The credential shape each transport hands to a client factory. */
export type VendorCredential =
  | { readonly accessToken: string }
  | {
      readonly apiKey: string;
      readonly fields: Readonly<Record<string, string>>;
    };

/**
 * One vendor SDK action, addressed by the client's resource group and method.
 * Most maintained SDKs are method-per-endpoint, so a dotted path plus a
 * parameter mapper describes an action without a hand-written call site.
 */
export interface VendorOperation {
  readonly path: readonly string[];
  readonly params?: (input: VendorInput) => readonly unknown[];
  readonly output?: (value: unknown, input: VendorInput) => unknown;
  /**
   * Escape hatch for an SDK whose call does not reduce to one method. Returns
   * PromiseLike because a fluent query builder — PostgREST's, for instance —
   * is a thenable rather than a Promise.
   */
  readonly invoke?: (context: {
    client: SdkMethodTarget;
    input: VendorInput;
  }) => PromiseLike<unknown>;
}

export type VendorTransport =
  | {
      readonly kind: "oauth2";
      readonly runtime: Pick<IntegrationOAuthRuntime, "withCredential">;
    }
  | {
      readonly kind: "api_key";
      readonly runtime: Pick<IntegrationApiKeyRuntime, "withCredential">;
    };

export type VendorClientFactory = (
  credential: VendorCredential,
) => SdkMethodTarget;

export interface VendorProviderSdkConfig {
  integrationId: string;
  operations: Readonly<Record<string, VendorOperation>>;
  transport: VendorTransport;
  clientFactory: VendorClientFactory;
}

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/**
 * Builds a vendor-SDK-backed adapter from an operation table. Every provider
 * whose SDK is method-per-endpoint shares this executor, so credential
 * handling and output normalisation stay in one place.
 */
export function createVendorProviderSdk(
  config: VendorProviderSdkConfig,
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

      const run = async (credential: VendorCredential): Promise<unknown> => {
        const client = config.clientFactory(credential);
        if (operation.invoke) {
          return operation.invoke({ client, input: invocation.input });
        }
        return invokeSdkMethod(client, {
          path: operation.path,
          arguments: operation.params?.(invocation.input) ?? [],
        });
      };

      const project = (
        result: unknown,
      ): { operationId: string; output: unknown } => ({
        operationId: invocation.operationId,
        output: operation.output
          ? operation.output(result, invocation.input)
          : normalizeSdkOutput(result),
      });

      if (config.transport.kind === "oauth2") {
        return config.transport.runtime.withCredential(
          invocation.reference,
          async (credential) => project(await run(credential)),
        );
      }
      return config.transport.runtime.withCredential(
        invocation.reference,
        async (credential) => project(await run(credential)),
      );
    },
  };
}

export interface VendorPackConfig {
  integrationId: string;
  operations: Readonly<Record<string, VendorOperation>>;
  clientFactory: VendorClientFactory;
  /** Which credential runtime this provider's SDK authenticates with. */
  transportKind: VendorTransport["kind"];
  /** Names the SDK, for the deferred-action reason. */
  driver: string;
  triggerCoverage?: IntegrationProviderPack["triggerCoverage"];
}

/** Wraps a vendor operation table as a delivery unit. */
export function createVendorPack(
  config: VendorPackConfig,
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
            reason: `No ${config.driver} method is mapped for this action.`,
          },
    ),
    triggerCoverage:
      config.triggerCoverage ??
      baseline.triggers.map((trigger) => ({
        sourceTriggerId: trigger.id,
        disposition: "deferred" as const,
        reason: `${config.driver} delivers events by webhook; scheduled with the trigger family work.`,
      })),
    create(context) {
      const runtime =
        config.transportKind === "oauth2"
          ? context.oauthRuntime
          : context.apiKeyRuntime;
      if (!runtime) return [];
      return [
        createVendorProviderSdk({
          integrationId: config.integrationId,
          operations: config.operations,
          clientFactory: config.clientFactory,
          transport:
            config.transportKind === "oauth2"
              ? {
                  kind: "oauth2",
                  runtime: context.oauthRuntime as NonNullable<
                    typeof context.oauthRuntime
                  >,
                }
              : {
                  kind: "api_key",
                  runtime: context.apiKeyRuntime as NonNullable<
                    typeof context.apiKeyRuntime
                  >,
                },
        }),
      ];
    },
  };
}

/** Reads the bearer token from whichever transport supplied the credential. */
export function vendorToken(credential: VendorCredential): string {
  return "accessToken" in credential
    ? credential.accessToken
    : credential.apiKey;
}

/** Reads a non-secret deployment field, such as a Supabase project URL. */
export function vendorField(
  credential: VendorCredential,
  name: string,
): string | undefined {
  return "fields" in credential ? credential.fields[name] : undefined;
}

export function requiredVendorField(
  credential: VendorCredential,
  name: string,
): string {
  const value = vendorField(credential, name);
  if (!value) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return value;
}
