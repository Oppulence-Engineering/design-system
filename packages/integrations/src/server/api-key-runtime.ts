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

/**
 * Public API-key profiles for package-owned SDK adapters. Products should use
 * `createBuiltInIntegrationApiKeyRuntime` unless they are adding a custom
 * adapter or need the generic HTTP transport for another provider.
 */
export const BUILT_IN_API_KEY_PROVIDER_CONFIGURATIONS = Object.freeze([
  {
    integrationId: "stripe" as const,
    apiBaseUrl: "https://api.stripe.com",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    integrationId: "github" as const,
    apiBaseUrl: "https://api.github.com",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    integrationId: "gitlab" as const,
    apiBaseUrl: "https://gitlab.com/api/v4",
    credentialHeader: "PRIVATE-TOKEN",
  },
  {
    integrationId: "cloudflare" as const,
    apiBaseUrl: "https://api.cloudflare.com/client/v4",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    integrationId: "elevenlabs" as const,
    apiBaseUrl: "https://api.elevenlabs.io/v1",
    credentialHeader: "xi-api-key",
  },
  {
    integrationId: "firecrawl" as const,
    apiBaseUrl: "https://api.firecrawl.dev/v2",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    integrationId: "intercom" as const,
    apiBaseUrl: "https://api.intercom.io",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    // Mailgun's client performs its own API-key basic authentication; do not
    // expose a generic HTTP profile that could send the key incorrectly.
    integrationId: "mailgun" as const,
  },
  {
    // Mailchimp derives the regional API host from the key suffix. Its
    // package-owned SDK is the only safe transport for this profile.
    integrationId: "mailchimp" as const,
  },
  {
    integrationId: "vercel" as const,
    apiBaseUrl: "https://api.vercel.com",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    integrationId: "square" as const,
    apiBaseUrl: "https://connect.squareup.com",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    integrationId: "google-books" as const,
    apiBaseUrl: "https://www.googleapis.com/books/v1",
    credentialHeader: "X-Goog-Api-Key",
  },
  {
    integrationId: "youtube" as const,
    apiBaseUrl: "https://www.googleapis.com/youtube/v3",
    credentialHeader: "X-Goog-Api-Key",
  },
  {
    integrationId: "resend" as const,
    apiBaseUrl: "https://api.resend.com",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    // Brex's typed SDK owns authentication and transport. This profile exists
    // only to encrypt the OAuth/API token and make it available to that SDK.
    integrationId: "brex" as const,
  },
  // Protocol providers. Each stores a driver connection — host, user, and
  // secret — in the composite credential envelope rather than a bearer token,
  // so none of them exposes a generic HTTP transport.
  { integrationId: "postgresql" as const },
  { integrationId: "mysql" as const },
  { integrationId: "clickhouse" as const },
  { integrationId: "redis" as const },
  { integrationId: "ssh" as const },
  { integrationId: "sftp" as const },
  { integrationId: "jupyter" as const },
  // AWS authenticates with an access key pair, which the same envelope holds.
  { integrationId: "s3" as const },
  { integrationId: "amazon-dynamodb" as const },
  { integrationId: "amazon-sqs" as const },
  { integrationId: "amazon-rds" as const },
  { integrationId: "aws-ses" as const },
  { integrationId: "aws-iam" as const },
  { integrationId: "aws-sts" as const },
  { integrationId: "aws-identity-center" as const },
  { integrationId: "aws-secrets-manager" as const },
  { integrationId: "aws-textract" as const },
  { integrationId: "aws-appconfig" as const },
  { integrationId: "athena" as const },
  { integrationId: "cloudwatch" as const },
  { integrationId: "cloudformation" as const },
  { integrationId: "codepipeline" as const },
  // Vendor SDKs that authenticate with a secret key plus a per-tenant host,
  // both held in the same encrypted envelope.
  { integrationId: "clerk" as const },
  { integrationId: "okta" as const },
  { integrationId: "supabase" as const },
  { integrationId: "datadog" as const },
  { integrationId: "algolia" as const },
  { integrationId: "upstash" as const },
  { integrationId: "pinecone" as const },
  { integrationId: "qdrant" as const },
  { integrationId: "elasticsearch" as const },
  { integrationId: "google-translate" as const },
  { integrationId: "mongodb" as const },
  { integrationId: "neo4j" as const },
] satisfies readonly ApiKeyProviderConfiguration[]);

export type BuiltInIntegrationApiKeyRuntimeConfig = Omit<
  IntegrationApiKeyRuntimeConfig,
  "providers"
>;

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
  /**
   * Executes a package-owned provider SDK call with a decrypted API key.
   *
   * This is intentionally server-only. It allows an SDK adapter supplied by
   * this package to initialise a vendor client without making products read,
   * persist, or pass through the underlying secret.
   */
  withCredential<T>(
    reference: IntegrationCredentialReference,
    operation: (credential: {
      readonly apiKey: string;
      readonly fields: Readonly<Record<string, string>>;
    }) => Promise<T>,
  ): Promise<T>;
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

    async withCredential(rawReference, operation) {
      const reference =
        IntegrationCredentialReferenceSchema.safeParse(rawReference);
      if (!reference.success) {
        throw new IntegrationApiKeyRuntimeError(
          "INTEGRATION_API_KEY_CREDENTIAL_UNAVAILABLE",
        );
      }
      if (!providers.has(reference.data.integrationId)) {
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
      return operation(credential);
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

/**
 * Creates encrypted API-key storage for every currently shipped API-key SDK.
 * Consumers provide database/vault and authorization policy only; public
 * provider transport and credential conventions remain package-owned.
 */
export function createBuiltInIntegrationApiKeyRuntime(
  config: BuiltInIntegrationApiKeyRuntimeConfig,
): IntegrationApiKeyRuntime {
  return createIntegrationApiKeyRuntime({
    ...config,
    providers: BUILT_IN_API_KEY_PROVIDER_CONFIGURATIONS,
  });
}
