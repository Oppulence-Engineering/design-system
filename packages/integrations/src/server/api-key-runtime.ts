import { z } from "zod";

import {
  IntegrationIdSchema,
  ProductSchema,
  type IntegrationId,
  type Product,
} from "../contracts";
import {
  createIntegrationCredentialReference,
  decryptIntegrationApiKeyCredential,
  encryptIntegrationApiKeyCredential,
  IntegrationCredentialReferenceSchema,
  type IntegrationCredentialKeyring,
  type IntegrationCredentialReference,
  type IntegrationCredentialVault,
} from "./credentials";
import {
  createApiKeyProviderSdk,
  type ApiKeyProviderConfiguration,
  type ApiKeyProviderRequest,
} from "./api-key";

export interface IntegrationApiKeySubject {
  product: Product;
  subjectId: string;
}

export interface IntegrationApiKeyRuntimeConfig {
  providers: readonly ApiKeyProviderConfiguration[];
  credentialVault: IntegrationCredentialVault;
  credentialKeyring: IntegrationCredentialKeyring;
  fetcher?: typeof fetch;
  /** Invoked after the encrypted credential is durable in the supplied vault. */
  onConnected?(input: {
    connectionId: string;
    integrationId: IntegrationId;
    product: Product;
    subjectId: string;
  }): Promise<void>;
}

export interface ConnectIntegrationApiKeyInput extends IntegrationApiKeySubject {
  integrationId: string;
  apiKey: string;
}

export interface ConnectIntegrationApiKeyResult {
  connectionId: string;
  integrationId: IntegrationId;
  product: Product;
  subjectId: string;
}

export interface IntegrationApiKeyProviderRequest {
  reference: IntegrationCredentialReference;
  request: ApiKeyProviderRequest;
}

/** Rechecked by a product immediately before an API key is persisted. */
export type IntegrationApiKeyAuthorizer = (
  subject: Pick<IntegrationApiKeySubject, "product" | "subjectId"> & {
    integrationId: IntegrationId;
  },
) => Promise<void>;

export interface IntegrationApiKeyRuntime {
  connect(
    input: ConnectIntegrationApiKeyInput,
    authorize: IntegrationApiKeyAuthorizer,
  ): Promise<ConnectIntegrationApiKeyResult>;
  request(input: IntegrationApiKeyProviderRequest): Promise<Response>;
  revoke(reference: IntegrationCredentialReference): Promise<void>;
}

export class IntegrationApiKeyRuntimeError extends Error {
  readonly code:
    | "INTEGRATION_API_KEY_PROVIDER_UNAVAILABLE"
    | "INTEGRATION_API_KEY_INVALID"
    | "INTEGRATION_API_KEY_FINALIZATION_FAILED"
    | "INTEGRATION_API_KEY_CREDENTIAL_UNAVAILABLE"
    | "INTEGRATION_API_KEY_CRYPTO_UNAVAILABLE";

  constructor(code: IntegrationApiKeyRuntimeError["code"]) {
    super("The integration API key could not be processed.");
    this.name = "IntegrationApiKeyRuntimeError";
    this.code = code;
  }
}

const ConnectIntegrationApiKeyInputSchema = z
  .object({
    integrationId: IntegrationIdSchema,
    product: ProductSchema,
    subjectId: z.string().min(1).max(320),
    apiKey: z.string().min(1).max(16_384),
  })
  .strict();

function createConnectionId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new IntegrationApiKeyRuntimeError(
      "INTEGRATION_API_KEY_CRYPTO_UNAVAILABLE",
    );
  }
  return globalThis.crypto.randomUUID();
}

function providersByIntegrationId(
  configurations: readonly ApiKeyProviderConfiguration[],
  fetcher: typeof fetch | undefined,
) {
  const providers = new Map<
    IntegrationId,
    ReturnType<typeof createApiKeyProviderSdk>
  >();
  for (const configuration of configurations) {
    if (providers.has(configuration.integrationId)) {
      throw new Error(
        `Duplicate API-key provider configuration: ${configuration.integrationId}.`,
      );
    }
    providers.set(
      configuration.integrationId,
      createApiKeyProviderSdk(configuration, fetcher),
    );
  }
  return providers;
}

/**
 * Owns API-key validation, encryption, durable-vault persistence, provider
 * request authentication, and revocation. The consuming product supplies only
 * present-tense authorization and the database/audit callback.
 */
export function createIntegrationApiKeyRuntime(
  config: IntegrationApiKeyRuntimeConfig,
): IntegrationApiKeyRuntime {
  const providers = providersByIntegrationId(config.providers, config.fetcher);

  return {
    async connect(rawInput, authorize) {
      const input = ConnectIntegrationApiKeyInputSchema.safeParse(rawInput);
      if (!input.success) {
        throw new IntegrationApiKeyRuntimeError("INTEGRATION_API_KEY_INVALID");
      }
      const provider = providers.get(input.data.integrationId);
      if (!provider) {
        throw new IntegrationApiKeyRuntimeError(
          "INTEGRATION_API_KEY_PROVIDER_UNAVAILABLE",
        );
      }
      await authorize({
        integrationId: input.data.integrationId,
        product: input.data.product,
        subjectId: input.data.subjectId,
      });
      const connectionId = createConnectionId();
      const reference = createIntegrationCredentialReference({
        connectionId,
        integrationId: provider.configuration.integrationId,
        product: input.data.product,
      });
      const credential = await encryptIntegrationApiKeyCredential({
        reference,
        credential: { apiKey: input.data.apiKey },
        keyring: config.credentialKeyring,
      });
      await config.credentialVault.save(reference, credential);
      try {
        await config.onConnected?.({
          connectionId,
          integrationId: provider.configuration.integrationId,
          product: input.data.product,
          subjectId: input.data.subjectId,
        });
      } catch {
        await config.credentialVault.revoke(reference);
        throw new IntegrationApiKeyRuntimeError(
          "INTEGRATION_API_KEY_FINALIZATION_FAILED",
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
      const reference = IntegrationCredentialReferenceSchema.safeParse(
        input.reference,
      );
      if (!reference.success) {
        throw new IntegrationApiKeyRuntimeError(
          "INTEGRATION_API_KEY_CREDENTIAL_UNAVAILABLE",
        );
      }
      const provider = providers.get(reference.data.integrationId);
      if (!provider) {
        throw new IntegrationApiKeyRuntimeError(
          "INTEGRATION_API_KEY_PROVIDER_UNAVAILABLE",
        );
      }
      const encrypted = await config.credentialVault.read(reference.data);
      if (!encrypted) {
        throw new IntegrationApiKeyRuntimeError(
          "INTEGRATION_API_KEY_CREDENTIAL_UNAVAILABLE",
        );
      }
      const credential = await decryptIntegrationApiKeyCredential({
        reference: reference.data,
        credential: encrypted,
        keyring: config.credentialKeyring,
      });
      return provider.request(credential, input.request);
    },

    async revoke(rawReference) {
      const reference =
        IntegrationCredentialReferenceSchema.safeParse(rawReference);
      if (!reference.success) {
        throw new IntegrationApiKeyRuntimeError(
          "INTEGRATION_API_KEY_CREDENTIAL_UNAVAILABLE",
        );
      }
      await config.credentialVault.revoke(reference.data);
    },
  };
}
