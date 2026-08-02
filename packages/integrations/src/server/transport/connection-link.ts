import * as Merge from "@mergeapi/merge-sdk-typescript";
import {
  Configuration as PlaidConfiguration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";
import { z } from "zod";

import { ProductSchema, type Product } from "../../contracts";
import {
  createIntegrationCredentialReference,
  decryptIntegrationConnectionLinkCredential,
  encryptIntegrationConnectionLinkCredential,
  type IntegrationCredentialKeyring,
  type IntegrationCredentialReference,
  IntegrationCredentialReferenceSchema,
  type IntegrationCredentialVault,
  type MergeConnectionLinkCredential,
  type PlaidConnectionLinkCredential,
} from "./credentials";

export interface IntegrationConnectionLinkSubject {
  product: Product;
  subjectId: string;
}

export interface PlaidLinkSdk {
  linkTokenCreate(input: {
    client_name: string;
    country_codes: readonly CountryCode[];
    language: "en";
    products: readonly Products[];
    user: { client_user_id: string };
    webhook?: string;
    redirect_uri?: string;
  }): Promise<{
    data: {
      link_token: string;
      expiration: string;
      request_id?: string;
    };
  }>;
  itemPublicTokenExchange(input: { public_token: string }): Promise<{
    data: { access_token: string; item_id?: string; request_id?: string };
  }>;
}

export interface MergeLinkSdk {
  linkTokenCreate(input: {
    endUserDetailsRequest: {
      end_user_email_address: string;
      end_user_organization_name: string;
      end_user_origin_id: string;
      categories: Array<{ value: "accounting"; rawValue: "accounting" }>;
      integration?: string;
      link_expiry_mins?: number;
      should_create_magic_link_url?: boolean;
    };
  }): Promise<
    | {
        link_token: string;
        integration_name?: string;
        magic_link_url?: string;
      }
    | undefined
  >;
  accountTokenRetrieve(input: { publicToken: string }): Promise<
    | {
        account_token: string;
        integration?: { name?: string };
      }
    | undefined
  >;
}

export interface PlaidConnectionLinkConfig {
  clientId: string;
  secret: string;
  environment?: "sandbox" | "development" | "production";
  clientName?: string;
  countryCodes?: readonly CountryCode[];
  products?: readonly Products[];
  webhook?: string;
  redirectUri?: string;
  clientFactory?: () => PlaidLinkSdk;
}

export interface MergeConnectionLinkConfig {
  apiKey: string;
  /** The package restricts this connector to Merge Accounting. */
  integration?: string;
  linkExpiryMinutes?: number;
  createMagicLink?: boolean;
  resolveEndUser(input: IntegrationConnectionLinkSubject): Promise<{
    email: string;
    organizationName: string;
  }>;
  clientFactory?: (apiKey: string) => MergeLinkSdk;
}

export interface IntegrationConnectionLinkRuntimeConfig {
  credentialVault: IntegrationCredentialVault;
  credentialKeyring: IntegrationCredentialKeyring;
  plaid?: PlaidConnectionLinkConfig;
  merge?: MergeConnectionLinkConfig;
  /** Invoked only after the Link credential is encrypted and durable. */
  onConnected?(input: {
    connectionId: string;
    integrationId: "plaid" | "merge";
    product: Product;
    subjectId: string;
    providerMetadata: Readonly<Record<string, string>>;
  }): Promise<void>;
}

export interface CreatePlaidLinkTokenInput extends IntegrationConnectionLinkSubject {}

export interface CreateMergeLinkTokenInput extends IntegrationConnectionLinkSubject {}

export interface ConnectionLinkTokenResult {
  integrationId: "plaid" | "merge";
  linkToken: string;
  expiresAt?: string;
  magicLinkUrl?: string;
  providerMetadata: Readonly<Record<string, string>>;
}

export interface CompleteConnectionLinkInput extends IntegrationConnectionLinkSubject {
  publicToken: string;
}

export interface CompleteConnectionLinkResult {
  connectionId: string;
  integrationId: "plaid" | "merge";
  product: Product;
  subjectId: string;
  providerMetadata: Readonly<Record<string, string>>;
}

/** Rechecked immediately before a Link public token is exchanged or persisted. */
export type IntegrationConnectionLinkCompletionAuthorizer = (
  subject: IntegrationConnectionLinkSubject,
  integrationId: "plaid" | "merge",
) => Promise<void>;

export class IntegrationConnectionLinkError extends Error {
  readonly code:
    | "INTEGRATION_CONNECTION_LINK_PROVIDER_UNAVAILABLE"
    | "INTEGRATION_CONNECTION_LINK_INPUT_INVALID"
    | "INTEGRATION_CONNECTION_LINK_TOKEN_FAILED"
    | "INTEGRATION_CONNECTION_LINK_COMPLETION_FAILED"
    | "INTEGRATION_CONNECTION_LINK_CREDENTIAL_UNAVAILABLE"
    | "INTEGRATION_CONNECTION_LINK_CREDENTIAL_MISMATCH"
    | "INTEGRATION_CONNECTION_LINK_FINALIZATION_FAILED"
    | "INTEGRATION_CONNECTION_LINK_CRYPTO_UNAVAILABLE";

  constructor(code: IntegrationConnectionLinkError["code"]) {
    super("The integration connection-link request could not be completed.");
    this.name = "IntegrationConnectionLinkError";
    this.code = code;
  }
}

const SubjectSchema = z
  .object({
    product: ProductSchema,
    subjectId: z.string().min(1).max(320),
  })
  .strict();

const CompleteInputSchema = SubjectSchema.extend({
  publicToken: z.string().min(1).max(16_384),
}).strict();

function connectionId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new IntegrationConnectionLinkError(
      "INTEGRATION_CONNECTION_LINK_CRYPTO_UNAVAILABLE",
    );
  }
  return globalThis.crypto.randomUUID();
}

function optionalMetadata(
  values: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
}

function createPlaidClient(config: PlaidConnectionLinkConfig): PlaidLinkSdk {
  const environment = config.environment ?? "production";
  return new PlaidApi(
    new PlaidConfiguration({
      basePath: PlaidEnvironments[environment],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": config.clientId,
          "PLAID-SECRET": config.secret,
        },
      },
    }),
  ) as unknown as PlaidLinkSdk;
}

function createMergeClient(apiKey: string): MergeLinkSdk {
  const configuration = new Merge.Configuration({ apiKey });
  return {
    linkTokenCreate(input) {
      return new Merge.Accounting.LinkTokenApi(configuration).linkTokenCreate(
        input as never,
      );
    },
    accountTokenRetrieve(input) {
      return new Merge.Accounting.AccountTokenApi(
        configuration,
      ).accountTokenRetrieve(input);
    },
  };
}

async function saveConnectionLinkCredential(input: {
  config: IntegrationConnectionLinkRuntimeConfig;
  subject: IntegrationConnectionLinkSubject;
  integrationId: "plaid" | "merge";
  credential: PlaidConnectionLinkCredential | MergeConnectionLinkCredential;
  providerMetadata: Readonly<Record<string, string>>;
}): Promise<CompleteConnectionLinkResult> {
  const parsedSubject = SubjectSchema.safeParse(input.subject);
  if (!parsedSubject.success) {
    throw new IntegrationConnectionLinkError(
      "INTEGRATION_CONNECTION_LINK_INPUT_INVALID",
    );
  }
  const generatedConnectionId = connectionId();
  const reference = createIntegrationCredentialReference({
    connectionId: generatedConnectionId,
    integrationId: input.integrationId,
    product: parsedSubject.data.product,
  });
  const encrypted = await encryptIntegrationConnectionLinkCredential({
    reference,
    credential: input.credential,
    keyring: input.config.credentialKeyring,
  });
  await input.config.credentialVault.save(reference, encrypted);
  try {
    await input.config.onConnected?.({
      connectionId: generatedConnectionId,
      integrationId: input.integrationId,
      product: parsedSubject.data.product,
      subjectId: parsedSubject.data.subjectId,
      providerMetadata: input.providerMetadata,
    });
  } catch {
    await input.config.credentialVault.revoke(reference).catch(() => undefined);
    throw new IntegrationConnectionLinkError(
      "INTEGRATION_CONNECTION_LINK_FINALIZATION_FAILED",
    );
  }
  return {
    connectionId: generatedConnectionId,
    integrationId: input.integrationId,
    product: parsedSubject.data.product,
    subjectId: parsedSubject.data.subjectId,
    providerMetadata: input.providerMetadata,
  };
}

/**
 * Package-owned browser Link completion boundary for Plaid and Merge. Products
 * only authorize the current actor and persist the non-secret connection ID.
 */
export function createIntegrationConnectionLinkRuntime(
  config: IntegrationConnectionLinkRuntimeConfig,
) {
  const plaidConfig = config.plaid;
  const mergeConfig = config.merge;

  return {
    async createPlaidLinkToken(
      rawInput: CreatePlaidLinkTokenInput,
    ): Promise<ConnectionLinkTokenResult> {
      const subject = SubjectSchema.safeParse(rawInput);
      if (!subject.success) {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_INPUT_INVALID",
        );
      }
      if (!plaidConfig) {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_PROVIDER_UNAVAILABLE",
        );
      }
      try {
        const response = await (
          plaidConfig.clientFactory ?? (() => createPlaidClient(plaidConfig))
        )().linkTokenCreate({
          client_name: plaidConfig.clientName ?? "Oppulence",
          country_codes: plaidConfig.countryCodes ?? [CountryCode.Us],
          language: "en",
          products: plaidConfig.products ?? [Products.Transactions],
          user: { client_user_id: subject.data.subjectId },
          ...(plaidConfig.webhook ? { webhook: plaidConfig.webhook } : {}),
          ...(plaidConfig.redirectUri
            ? { redirect_uri: plaidConfig.redirectUri }
            : {}),
        });
        if (!response.data.link_token) {
          throw new Error("Missing Plaid link token.");
        }
        return {
          integrationId: "plaid",
          linkToken: response.data.link_token,
          expiresAt: response.data.expiration,
          providerMetadata: optionalMetadata({
            requestId: response.data.request_id,
          }),
        };
      } catch {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_TOKEN_FAILED",
        );
      }
    },

    async completePlaidLink(
      rawInput: CompleteConnectionLinkInput,
      authorize: IntegrationConnectionLinkCompletionAuthorizer,
    ): Promise<CompleteConnectionLinkResult> {
      const input = CompleteInputSchema.safeParse(rawInput);
      if (!input.success) {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_INPUT_INVALID",
        );
      }
      if (!plaidConfig) {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_PROVIDER_UNAVAILABLE",
        );
      }
      /*
       * Outside the catch below, which rewrites anything it does not recognise
       * into COMPLETION_FAILED. The product's authorizer is the natural place
       * to throw its own error to deny a request, and a plain Error — the
       * obvious thing to throw — came back to the caller as a generic
       * provider failure. The request was still refused, but an HTTP layer
       * could not map it to a 403 and a denial was indistinguishable from a
       * Plaid outage in monitoring.
       */
      await authorize(
        { product: input.data.product, subjectId: input.data.subjectId },
        "plaid",
      );

      try {
        const response = await (
          plaidConfig.clientFactory ?? (() => createPlaidClient(plaidConfig))
        )().itemPublicTokenExchange({
          public_token: input.data.publicToken,
        });
        if (!response.data.access_token) {
          throw new Error("Missing Plaid access token.");
        }
        return saveConnectionLinkCredential({
          config,
          subject: {
            product: input.data.product,
            subjectId: input.data.subjectId,
          },
          integrationId: "plaid",
          credential: {
            kind: "plaid",
            accessToken: response.data.access_token,
            itemId: response.data.item_id,
          },
          providerMetadata: optionalMetadata({
            itemId: response.data.item_id,
            requestId: response.data.request_id,
          }),
        });
      } catch (error) {
        if (error instanceof IntegrationConnectionLinkError) throw error;
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_COMPLETION_FAILED",
        );
      }
    },

    async createMergeLinkToken(
      rawInput: CreateMergeLinkTokenInput,
    ): Promise<ConnectionLinkTokenResult> {
      const subject = SubjectSchema.safeParse(rawInput);
      if (!subject.success) {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_INPUT_INVALID",
        );
      }
      if (!mergeConfig) {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_PROVIDER_UNAVAILABLE",
        );
      }
      try {
        const endUser = await mergeConfig.resolveEndUser(subject.data);
        if (
          !endUser.email ||
          endUser.email.length > 320 ||
          !endUser.organizationName ||
          endUser.organizationName.length > 512
        ) {
          throw new Error("Invalid Merge end user.");
        }
        const response = await (mergeConfig.clientFactory ?? createMergeClient)(
          mergeConfig.apiKey,
        ).linkTokenCreate({
          endUserDetailsRequest: {
            end_user_email_address: endUser.email,
            end_user_organization_name: endUser.organizationName,
            end_user_origin_id: subject.data.subjectId,
            categories: [{ value: "accounting", rawValue: "accounting" }],
            ...(mergeConfig.integration
              ? { integration: mergeConfig.integration }
              : {}),
            ...(mergeConfig.linkExpiryMinutes
              ? { link_expiry_mins: mergeConfig.linkExpiryMinutes }
              : {}),
            ...(mergeConfig.createMagicLink !== undefined
              ? { should_create_magic_link_url: mergeConfig.createMagicLink }
              : {}),
          },
        });
        if (!response?.link_token) {
          throw new Error("Missing Merge link token.");
        }
        return {
          integrationId: "merge",
          linkToken: response.link_token,
          magicLinkUrl: response.magic_link_url,
          providerMetadata: optionalMetadata({
            integrationName: response.integration_name,
          }),
        };
      } catch {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_TOKEN_FAILED",
        );
      }
    },

    async completeMergeLink(
      rawInput: CompleteConnectionLinkInput,
      authorize: IntegrationConnectionLinkCompletionAuthorizer,
    ): Promise<CompleteConnectionLinkResult> {
      const input = CompleteInputSchema.safeParse(rawInput);
      if (!input.success) {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_INPUT_INVALID",
        );
      }
      if (!mergeConfig) {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_PROVIDER_UNAVAILABLE",
        );
      }
      // Outside the catch below, for the reason given in completePlaidLink.
      await authorize(
        { product: input.data.product, subjectId: input.data.subjectId },
        "merge",
      );

      try {
        const response = await (mergeConfig.clientFactory ?? createMergeClient)(
          mergeConfig.apiKey,
        ).accountTokenRetrieve({ publicToken: input.data.publicToken });
        if (!response?.account_token) {
          throw new Error("Missing Merge account token.");
        }
        const integrationName = response.integration?.name;
        return saveConnectionLinkCredential({
          config,
          subject: {
            product: input.data.product,
            subjectId: input.data.subjectId,
          },
          integrationId: "merge",
          credential: {
            kind: "merge",
            accountToken: response.account_token,
            integrationName,
          },
          providerMetadata: optionalMetadata({ integrationName }),
        });
      } catch (error) {
        if (error instanceof IntegrationConnectionLinkError) throw error;
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_COMPLETION_FAILED",
        );
      }
    },

    async withPlaidCredential<T>(
      rawReference: IntegrationCredentialReference,
      operation: (credential: PlaidConnectionLinkCredential) => Promise<T>,
    ): Promise<T> {
      const reference =
        IntegrationCredentialReferenceSchema.safeParse(rawReference);
      if (!reference.success || reference.data.integrationId !== "plaid") {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_CREDENTIAL_UNAVAILABLE",
        );
      }
      const encrypted = await config.credentialVault.read(reference.data);
      if (!encrypted) {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_CREDENTIAL_UNAVAILABLE",
        );
      }
      const credential = await decryptIntegrationConnectionLinkCredential({
        reference: reference.data,
        credential: encrypted,
        keyring: config.credentialKeyring,
      });
      if (credential.kind !== "plaid") {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_CREDENTIAL_MISMATCH",
        );
      }
      return operation(credential);
    },

    async withMergeCredential<T>(
      rawReference: IntegrationCredentialReference,
      operation: (credential: MergeConnectionLinkCredential) => Promise<T>,
    ): Promise<T> {
      const reference =
        IntegrationCredentialReferenceSchema.safeParse(rawReference);
      if (!reference.success || reference.data.integrationId !== "merge") {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_CREDENTIAL_UNAVAILABLE",
        );
      }
      const encrypted = await config.credentialVault.read(reference.data);
      if (!encrypted) {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_CREDENTIAL_UNAVAILABLE",
        );
      }
      const credential = await decryptIntegrationConnectionLinkCredential({
        reference: reference.data,
        credential: encrypted,
        keyring: config.credentialKeyring,
      });
      if (credential.kind !== "merge") {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_CREDENTIAL_MISMATCH",
        );
      }
      return operation(credential);
    },

    async revoke(rawReference: IntegrationCredentialReference): Promise<void> {
      const reference =
        IntegrationCredentialReferenceSchema.safeParse(rawReference);
      if (!reference.success) {
        throw new IntegrationConnectionLinkError(
          "INTEGRATION_CONNECTION_LINK_CREDENTIAL_UNAVAILABLE",
        );
      }
      await config.credentialVault.revoke(reference.data);
    },
  };
}

export type IntegrationConnectionLinkRuntime = ReturnType<
  typeof createIntegrationConnectionLinkRuntime
>;
