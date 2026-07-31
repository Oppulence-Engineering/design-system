import { z } from "zod";

import {
  IntegrationIdSchema,
  ProductSchema,
  type IntegrationId,
  type Product,
} from "../contracts";
import {
  createUnauthenticatedProviderSdk,
  type UnauthenticatedProviderConfiguration,
  type UnauthenticatedProviderRequest,
} from "./unauthenticated";

export interface IntegrationNoAuthSubject {
  product: Product;
  subjectId: string;
}

export interface IntegrationNoAuthRuntimeConfig {
  providers: readonly UnauthenticatedProviderConfiguration[];
  /** Persists the product connection record and audit event after authorization. */
  onConnected?(input: {
    connectionId: string;
    integrationId: IntegrationId;
    product: Product;
    subjectId: string;
  }): Promise<void>;
  fetcher?: typeof fetch;
}

export interface ConnectIntegrationNoAuthInput extends IntegrationNoAuthSubject {
  integrationId: string;
}

export interface ConnectIntegrationNoAuthResult {
  connectionId: string;
  integrationId: IntegrationId;
  product: Product;
  subjectId: string;
}

export interface IntegrationNoAuthProviderRequest {
  integrationId: string;
  request: UnauthenticatedProviderRequest;
}

export type IntegrationNoAuthAuthorizer = (
  subject: Pick<IntegrationNoAuthSubject, "product" | "subjectId"> & {
    integrationId: IntegrationId;
  },
) => Promise<void>;

export interface IntegrationNoAuthRuntime {
  connect(
    input: ConnectIntegrationNoAuthInput,
    authorize: IntegrationNoAuthAuthorizer,
  ): Promise<ConnectIntegrationNoAuthResult>;
  request(input: IntegrationNoAuthProviderRequest): Promise<Response>;
}

export class IntegrationNoAuthRuntimeError extends Error {
  readonly code:
    | "INTEGRATION_NO_AUTH_PROVIDER_UNAVAILABLE"
    | "INTEGRATION_NO_AUTH_INVALID"
    | "INTEGRATION_NO_AUTH_FINALIZATION_FAILED"
    | "INTEGRATION_NO_AUTH_CRYPTO_UNAVAILABLE";

  constructor(code: IntegrationNoAuthRuntimeError["code"]) {
    super("The unauthenticated integration request could not be processed.");
    this.name = "IntegrationNoAuthRuntimeError";
    this.code = code;
  }
}

const ConnectIntegrationNoAuthInputSchema = z
  .object({
    integrationId: IntegrationIdSchema,
    product: ProductSchema,
    subjectId: z.string().min(1).max(320),
  })
  .strict();

function createConnectionId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new IntegrationNoAuthRuntimeError(
      "INTEGRATION_NO_AUTH_CRYPTO_UNAVAILABLE",
    );
  }
  return globalThis.crypto.randomUUID();
}

function providersByIntegrationId(
  configurations: readonly UnauthenticatedProviderConfiguration[],
  fetcher: typeof fetch | undefined,
) {
  const providers = new Map<
    IntegrationId,
    ReturnType<typeof createUnauthenticatedProviderSdk>
  >();
  for (const configuration of configurations) {
    if (providers.has(configuration.integrationId)) {
      throw new Error(
        `Duplicate no-auth provider configuration: ${configuration.integrationId}.`,
      );
    }
    providers.set(
      configuration.integrationId,
      createUnauthenticatedProviderSdk(configuration, fetcher),
    );
  }
  return providers;
}

/**
 * Owns no-auth provider configuration, safe HTTPS transport, connection IDs,
 * and the authorized connection callback. Products do not invent a separate
 * connection protocol merely because the provider has no credential.
 */
export function createIntegrationNoAuthRuntime(
  config: IntegrationNoAuthRuntimeConfig,
): IntegrationNoAuthRuntime {
  const providers = providersByIntegrationId(config.providers, config.fetcher);

  return {
    async connect(rawInput, authorize) {
      const input = ConnectIntegrationNoAuthInputSchema.safeParse(rawInput);
      if (!input.success) {
        throw new IntegrationNoAuthRuntimeError("INTEGRATION_NO_AUTH_INVALID");
      }
      const provider = providers.get(input.data.integrationId);
      if (!provider) {
        throw new IntegrationNoAuthRuntimeError(
          "INTEGRATION_NO_AUTH_PROVIDER_UNAVAILABLE",
        );
      }
      await authorize({
        integrationId: input.data.integrationId,
        product: input.data.product,
        subjectId: input.data.subjectId,
      });
      const connectionId = createConnectionId();
      try {
        await config.onConnected?.({
          connectionId,
          integrationId: provider.configuration.integrationId,
          product: input.data.product,
          subjectId: input.data.subjectId,
        });
      } catch {
        throw new IntegrationNoAuthRuntimeError(
          "INTEGRATION_NO_AUTH_FINALIZATION_FAILED",
        );
      }
      return {
        connectionId,
        integrationId: provider.configuration.integrationId,
        product: input.data.product,
        subjectId: input.data.subjectId,
      };
    },

    async request(input) {
      const integrationId = IntegrationIdSchema.safeParse(input.integrationId);
      if (!integrationId.success) {
        throw new IntegrationNoAuthRuntimeError("INTEGRATION_NO_AUTH_INVALID");
      }
      const provider = providers.get(integrationId.data);
      if (!provider) {
        throw new IntegrationNoAuthRuntimeError(
          "INTEGRATION_NO_AUTH_PROVIDER_UNAVAILABLE",
        );
      }
      return provider.request(input.request);
    },
  };
}
