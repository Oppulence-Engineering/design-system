import { z } from "zod";

import {
  IntegrationIdSchema,
  ProductSchema,
  type IntegrationId,
  type Product,
} from "../../contracts";
import {
  createIntegrationCredentialReference,
  decryptIntegrationApiKeyCredential,
  encryptIntegrationApiKeyCredential,
  IntegrationCredentialReferenceSchema,
  type IntegrationCredentialKeyring,
  type IntegrationCredentialReference,
  type IntegrationCredentialVault,
} from "../transport/credentials";
import {
  assertCredentialFields,
  createApiKeyProviderSdk,
  type ApiKeyProviderConfiguration,
  type ApiKeyProviderRequest,
} from "../transport/api-key";

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
  {
    integrationId: "s3" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "amazon-dynamodb" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "amazon-sqs" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "amazon-rds" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "aws-ses" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "aws-iam" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "aws-sts" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "aws-identity-center" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "aws-secrets-manager" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "aws-textract" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "aws-appconfig" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "athena" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "cloudwatch" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "cloudformation" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  {
    integrationId: "codepipeline" as const,
    credentialFields: [
      { name: "secretAccessKey", required: true },
      { name: "sessionToken" },
    ],
  },
  // Vendor SDKs that authenticate with a secret key plus a per-tenant host,
  // both held in the same encrypted envelope.
  { integrationId: "clerk" as const },
  {
    integrationId: "okta" as const,
    credentialFields: [{ name: "orgUrl", required: true }],
  },
  {
    integrationId: "supabase" as const,
    credentialFields: [{ name: "projectUrl", required: true }],
  },
  {
    integrationId: "datadog" as const,
    credentialFields: [
      { name: "applicationKey", required: true },
      { name: "site" },
    ],
  },
  {
    integrationId: "algolia" as const,
    credentialFields: [{ name: "applicationId", required: true }],
  },
  {
    integrationId: "upstash" as const,
    credentialFields: [{ name: "restUrl", required: true }],
  },
  { integrationId: "pinecone" as const },
  {
    integrationId: "qdrant" as const,
    credentialFields: [{ name: "url", required: true }],
  },
  {
    integrationId: "elasticsearch" as const,
    credentialFields: [{ name: "cloudId" }, { name: "node" }],
  },
  { integrationId: "google-translate" as const },
  { integrationId: "google-maps" as const },
  {
    integrationId: "twilio-voice" as const,
    credentialFields: [{ name: "accountSid", required: true }],
  },
  {
    integrationId: "zendesk" as const,
    credentialFields: [
      { name: "subdomain", required: true },
      { name: "email", required: true },
    ],
  },
  {
    integrationId: "azure-devops" as const,
    credentialFields: [
      { name: "organizationUrl", required: true },
      { name: "project" },
    ],
  },
  {
    integrationId: "temporal" as const,
    credentialFields: [
      { name: "namespace" },
      { name: "address" },
      { name: "tls" },
    ],
  },
  // Typed REST providers. Each names the one host its relative paths resolve
  // against, which is what keeps an action from choosing its own destination.
  {
    integrationId: "perplexity" as const,
    apiBaseUrl: "https://api.perplexity.ai",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    integrationId: "jina" as const,
    apiBaseUrl: "https://r.jina.ai",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    integrationId: "tavily" as const,
    apiBaseUrl: "https://api.tavily.com",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    integrationId: "exa" as const,
    apiBaseUrl: "https://api.exa.ai",
    credentialHeader: "x-api-key",
  },
  {
    integrationId: "brandfetch" as const,
    apiBaseUrl: "https://api.brandfetch.io",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    integrationId: "hunter-io" as const,
    apiBaseUrl: "https://api.hunter.io",
    credentialHeader: "X-API-KEY",
  },
  {
    integrationId: "telegram" as const,
    apiBaseUrl: "https://api.telegram.org",
    // The Bot API authenticates by path, not by header: every method lives
    // under /bot<token>/. A header-authenticated request is simply not a
    // route the API serves.
    credentialPathPrefix: "/bot{credential}",
  },
  {
    integrationId: "calendly" as const,
    apiBaseUrl: "https://api.calendly.com",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    integrationId: "discord" as const,
    apiBaseUrl: "https://discord.com/api/v10",
    credentialHeader: "Authorization",
    credentialPrefix: "Bot",
  },
  {
    integrationId: "sendgrid" as const,
    apiBaseUrl: "https://api.sendgrid.com",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    integrationId: "pagerduty" as const,
    apiBaseUrl: "https://api.pagerduty.com",
    credentialHeader: "Authorization",
    // PagerDuty's scheme takes no space between the key and the "=".
    credentialPrefix: "Token token={credential}",
  },
  {
    integrationId: "typeform" as const,
    apiBaseUrl: "https://api.typeform.com",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    // AppSheet posts every action to one table endpoint and authenticates
    // with an application access key header.
    integrationId: "google-appsheet" as const,
    apiBaseUrl: "https://api.appsheet.com",
    credentialHeader: "ApplicationAccessKey",
  },
  {
    integrationId: "tailscale" as const,
    apiBaseUrl: "https://api.tailscale.com",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer",
  },
  {
    integrationId: "mongodb" as const,
    credentialFields: [{ name: "uri", required: true }],
  },
  {
    integrationId: "neo4j" as const,
    credentialFields: [{ name: "password", required: true }],
  },
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
      // This is where a vendor pack receives its secrets, so it is where the
      // credential is held to the fields its provider declared. A missing
      // application key fails here rather than as an opaque provider error.
      const provider = providers.get(reference.data.integrationId);
      if (provider) {
        try {
          assertCredentialFields(provider.configuration, credential);
        } catch {
          throw new IntegrationApiKeyRuntimeError(
            "INTEGRATION_API_KEY_CREDENTIAL_UNAVAILABLE",
          );
        }
      }
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
