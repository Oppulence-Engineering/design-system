import Stripe from "stripe";
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import * as Merge from "@mergeapi/merge-sdk-typescript";
import { WebClient } from "@slack/web-api";
import { Client as HubSpotClient } from "@hubspot/api-client";
import { Gitlab } from "@gitbeaker/rest";
import Cloudflare from "cloudflare";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import Firecrawl from "@mendable/firecrawl-js";
import {
  ApiClient as AsanaApiClient,
  ProjectsApi as AsanaProjectsApi,
  SectionsApi as AsanaSectionsApi,
  StoriesApi as AsanaStoriesApi,
  TasksApi as AsanaTasksApi,
  WorkspacesApi as AsanaWorkspacesApi,
} from "asana";
import { Dropbox } from "dropbox";
import { Brex } from "brex";
import { IntercomClient } from "intercom-client";
import Mailgun from "mailgun.js";
import { Octokit } from "@octokit/rest";
import { LinearClient } from "@linear/sdk";
import { Vercel } from "@vercel/sdk";
import { google } from "googleapis";
import { Resend } from "resend";
import { SquareClient } from "square";
import {
  Configuration as PlaidConfiguration,
  PlaidApi,
  PlaidEnvironments,
} from "plaid";
import { XeroClient } from "xero-node";
import { z } from "zod";

import { INTEGRATION_CATALOGUE, SIMSTUDIO_BASELINE } from "../catalog";
import { IntegrationIdSchema } from "../contracts";
import type { IntegrationCredentialReference } from "./credentials";
import type { IntegrationApiKeyRuntime } from "./api-key-runtime";
import type { IntegrationOAuthRuntime } from "./runtime";
import type { IntegrationConnectionLinkRuntime } from "./connection-link";

const mailchimpRequire = createRequire(import.meta.url);
const airtableRequire = createRequire(import.meta.url);
const quickBooksRequire = createRequire(import.meta.url);

const ProviderSdkInvocationSchema = z
  .object({
    integrationId: IntegrationIdSchema,
    operationId: z.string().min(3).max(160),
    reference: z
      .object({
        connectionId: z.string().min(1).max(160),
        integrationId: IntegrationIdSchema,
        product: z.enum(["eigenn", "conduitt"]),
      })
      .strict(),
    input: z.record(z.string().min(1).max(160), z.unknown()).default({}),
    idempotencyKey: z.string().min(1).max(255).optional(),
  })
  .strict();

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

export interface BuiltInProviderSdkRegistryConfig {
  /** Required for package-owned API-key adapters such as Stripe and GitHub. */
  apiKeyRuntime?: Pick<IntegrationApiKeyRuntime, "withCredential">;
  /** Optional package configuration for a trusted self-managed GitLab host. */
  gitlab?: Omit<GitLabProviderSdkConfig, "apiKeyRuntime">;
  /** Required for package-owned OAuth adapters such as Slack and HubSpot. */
  oauthRuntime?: Pick<IntegrationOAuthRuntime, "withCredential">;
  /** Required for package-owned browser-Link adapters such as Plaid and Merge. */
  connectionLinkRuntime?: Pick<
    IntegrationConnectionLinkRuntime,
    "withPlaidCredential" | "withMergeCredential"
  >;
  /** Deployment configuration for the official Xero Node SDK. */
  xero?: Omit<XeroProviderSdkConfig, "oauthRuntime">;
  /** Deployment configuration for the maintained QuickBooks Node SDK. */
  quickbooks?: Omit<QuickBooksProviderSdkConfig, "oauthRuntime">;
  /** Deployment configuration for the Plaid Node SDK. */
  plaid?: Omit<PlaidProviderSdkConfig, "connectionLinkRuntime">;
  /** Deployment configuration for Merge's TypeScript SDK. */
  merge?: Omit<MergeProviderSdkConfig, "connectionLinkRuntime">;
}

/**
 * The standard package registry for currently shipped provider SDK adapters.
 * Products configure their encrypted credential runtimes once, then mount the
 * execution route; they do not instantiate vendor SDKs or handle secrets.
 */
export function createBuiltInProviderSdkRegistry(
  config: BuiltInProviderSdkRegistryConfig,
): IntegrationProviderSdkRegistry {
  const providers: IntegrationProviderSdk[] = [];
  if (config.apiKeyRuntime) {
    providers.push(
      createStripeProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createGitHubProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createGitLabProviderSdk({
        apiKeyRuntime: config.apiKeyRuntime,
        ...config.gitlab,
      }),
      createCloudflareProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createElevenLabsProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createFirecrawlProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createMailgunProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createIntercomProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createMailchimpProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createVercelProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createSquareProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createGoogleBooksProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createYouTubeProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createResendProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createBrexProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
    );
  }
  if (config.oauthRuntime) {
    providers.push(
      createSlackProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createHubSpotProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createLinearProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleCalendarProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleDriveProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleSheetsProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleDocsProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGmailProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleFormsProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleTasksProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleContactsProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleMeetProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleGroupsProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleSlidesProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createAirtableProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createAsanaProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createDropboxProviderSdk({ oauthRuntime: config.oauthRuntime }),
    );
    if (config.xero) {
      providers.push(
        createXeroProviderSdk({
          oauthRuntime: config.oauthRuntime,
          ...config.xero,
        }),
      );
    }
    if (config.quickbooks) {
      providers.push(
        createQuickBooksProviderSdk({
          oauthRuntime: config.oauthRuntime,
          ...config.quickbooks,
        }),
      );
    }
  }
  if (config.connectionLinkRuntime && config.plaid) {
    providers.push(
      createPlaidProviderSdk({
        connectionLinkRuntime: config.connectionLinkRuntime,
        ...config.plaid,
      }),
    );
  }
  if (config.connectionLinkRuntime && config.merge) {
    providers.push(
      createMergeProviderSdk({
        connectionLinkRuntime: config.connectionLinkRuntime,
        ...config.merge,
      }),
    );
  }
  return createIntegrationProviderSdkRegistry(providers);
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

interface StripeSdkClient {
  paymentIntents: StripeResource;
  customers: StripeResource;
  subscriptions: StripeResource;
  invoices: StripeResource;
  charges: StripeResource;
  products: StripeResource;
  prices: StripeResource;
  events: StripeResource;
}

interface StripeResource {
  create?(
    input: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
  retrieve?(
    id: string,
    input?: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
  update?(
    id: string,
    input: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
  confirm?(
    id: string,
    input?: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
  capture?(
    id: string,
    input?: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
  cancel?(
    id: string,
    input?: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
  list?(
    input: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
  search?(
    input: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
  del?(
    id: string,
    input?: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
  resume?(
    id: string,
    input?: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
  finalizeInvoice?(
    id: string,
    input?: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
  pay?(
    id: string,
    input?: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
  voidInvoice?(
    id: string,
    input?: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
  sendInvoice?(
    id: string,
    input?: Record<string, unknown>,
    options?: StripeRequestOptions,
  ): Promise<unknown>;
}

interface StripeRequestOptions {
  idempotencyKey?: string;
}

type StripeClientFactory = (
  apiKey: string,
  configuration: { timeout: number; maxNetworkRetries: number },
) => StripeSdkClient;

export interface StripeProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: StripeClientFactory;
  requestTimeoutMs?: number;
  maxNetworkRetries?: number;
}

function createStripeClient(
  apiKey: string,
  configuration: { timeout: number; maxNetworkRetries: number },
): StripeSdkClient {
  return new Stripe(apiKey, {
    timeout: configuration.timeout,
    maxNetworkRetries: configuration.maxNetworkRetries,
    telemetry: false,
  }) as unknown as StripeSdkClient;
}

const STRIPE_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "stripe",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

function requireStripeOperation(operationId: string): void {
  if (!STRIPE_OPERATION_IDS.includes(operationId)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
}

function requireString(
  value: unknown,
  code: IntegrationProviderSdkError["code"],
): string {
  if (typeof value !== "string" || !value.trim() || value.length > 1_000) {
    throw new IntegrationProviderSdkError(code);
  }
  return value;
}

function asInputRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return { ...(value as Record<string, unknown>) };
}

function withId(input: Readonly<Record<string, unknown>>): {
  id: string;
  rest: Record<string, unknown>;
} {
  const rest = asInputRecord(input);
  const id = requireString(
    rest.id,
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
  delete rest.id;
  return { id, rest };
}

function stripeOptions(
  input: ProviderSdkInvocation,
): StripeRequestOptions | undefined {
  return input.idempotencyKey
    ? { idempotencyKey: input.idempotencyKey }
    : undefined;
}

function requireMethod(
  resource: StripeResource,
  method: keyof StripeResource,
): (...arguments_: unknown[]) => Promise<unknown> {
  const candidate = resource[method];
  if (typeof candidate !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  return candidate.bind(resource) as (
    ...arguments_: unknown[]
  ) => Promise<unknown>;
}

async function executeStripeOperation(
  client: StripeSdkClient,
  invocation: ProviderSdkInvocation,
): Promise<unknown> {
  const input = asInputRecord(invocation.input);
  const options = stripeOptions(invocation);
  const method = (resource: StripeResource, name: keyof StripeResource) =>
    requireMethod(resource, name);
  const resource = (name: keyof StripeSdkClient) => client[name];

  switch (invocation.operationId) {
    case "stripe:create-payment-intent":
      return method(resource("paymentIntents"), "create")(input, options);
    case "stripe:retrieve-payment-intent": {
      const { id, rest } = withId(input);
      return method(resource("paymentIntents"), "retrieve")(id, rest, options);
    }
    case "stripe:update-payment-intent": {
      const { id, rest } = withId(input);
      return method(resource("paymentIntents"), "update")(id, rest, options);
    }
    case "stripe:confirm-payment-intent": {
      const { id, rest } = withId(input);
      return method(resource("paymentIntents"), "confirm")(id, rest, options);
    }
    case "stripe:capture-payment-intent": {
      const { id, rest } = withId(input);
      return method(resource("paymentIntents"), "capture")(id, rest, options);
    }
    case "stripe:cancel-payment-intent": {
      const { id, rest } = withId(input);
      return method(resource("paymentIntents"), "cancel")(id, rest, options);
    }
    case "stripe:list-payment-intents":
      return method(resource("paymentIntents"), "list")(input, options);
    case "stripe:search-payment-intents":
      return method(resource("paymentIntents"), "search")(input, options);
    case "stripe:create-customer":
      return method(resource("customers"), "create")(input, options);
    case "stripe:retrieve-customer": {
      const { id, rest } = withId(input);
      return method(resource("customers"), "retrieve")(id, rest, options);
    }
    case "stripe:update-customer": {
      const { id, rest } = withId(input);
      return method(resource("customers"), "update")(id, rest, options);
    }
    case "stripe:delete-customer": {
      const { id, rest } = withId(input);
      return method(resource("customers"), "del")(id, rest, options);
    }
    case "stripe:list-customers":
      return method(resource("customers"), "list")(input, options);
    case "stripe:search-customers":
      return method(resource("customers"), "search")(input, options);
    case "stripe:create-subscription":
      return method(resource("subscriptions"), "create")(input, options);
    case "stripe:retrieve-subscription": {
      const { id, rest } = withId(input);
      return method(resource("subscriptions"), "retrieve")(id, rest, options);
    }
    case "stripe:update-subscription": {
      const { id, rest } = withId(input);
      return method(resource("subscriptions"), "update")(id, rest, options);
    }
    case "stripe:cancel-subscription": {
      const { id, rest } = withId(input);
      return method(resource("subscriptions"), "cancel")(id, rest, options);
    }
    case "stripe:resume-subscription": {
      const { id, rest } = withId(input);
      return method(resource("subscriptions"), "resume")(id, rest, options);
    }
    case "stripe:list-subscriptions":
      return method(resource("subscriptions"), "list")(input, options);
    case "stripe:search-subscriptions":
      return method(resource("subscriptions"), "search")(input, options);
    case "stripe:create-invoice":
      return method(resource("invoices"), "create")(input, options);
    case "stripe:retrieve-invoice": {
      const { id, rest } = withId(input);
      return method(resource("invoices"), "retrieve")(id, rest, options);
    }
    case "stripe:update-invoice": {
      const { id, rest } = withId(input);
      return method(resource("invoices"), "update")(id, rest, options);
    }
    case "stripe:delete-invoice": {
      const { id, rest } = withId(input);
      return method(resource("invoices"), "del")(id, rest, options);
    }
    case "stripe:finalize-invoice": {
      const { id, rest } = withId(input);
      return method(resource("invoices"), "finalizeInvoice")(id, rest, options);
    }
    case "stripe:pay-invoice": {
      const { id, rest } = withId(input);
      return method(resource("invoices"), "pay")(id, rest, options);
    }
    case "stripe:void-invoice": {
      const { id, rest } = withId(input);
      return method(resource("invoices"), "voidInvoice")(id, rest, options);
    }
    case "stripe:send-invoice": {
      const { id, rest } = withId(input);
      return method(resource("invoices"), "sendInvoice")(id, rest, options);
    }
    case "stripe:list-invoices":
      return method(resource("invoices"), "list")(input, options);
    case "stripe:search-invoices":
      return method(resource("invoices"), "search")(input, options);
    case "stripe:create-charge":
      return method(resource("charges"), "create")(input, options);
    case "stripe:retrieve-charge": {
      const { id, rest } = withId(input);
      return method(resource("charges"), "retrieve")(id, rest, options);
    }
    case "stripe:update-charge": {
      const { id, rest } = withId(input);
      return method(resource("charges"), "update")(id, rest, options);
    }
    case "stripe:capture-charge": {
      const { id, rest } = withId(input);
      return method(resource("charges"), "capture")(id, rest, options);
    }
    case "stripe:list-charges":
      return method(resource("charges"), "list")(input, options);
    case "stripe:search-charges":
      return method(resource("charges"), "search")(input, options);
    case "stripe:create-product":
      return method(resource("products"), "create")(input, options);
    case "stripe:retrieve-product": {
      const { id, rest } = withId(input);
      return method(resource("products"), "retrieve")(id, rest, options);
    }
    case "stripe:update-product": {
      const { id, rest } = withId(input);
      return method(resource("products"), "update")(id, rest, options);
    }
    case "stripe:delete-product": {
      const { id, rest } = withId(input);
      return method(resource("products"), "del")(id, rest, options);
    }
    case "stripe:list-products":
      return method(resource("products"), "list")(input, options);
    case "stripe:search-products":
      return method(resource("products"), "search")(input, options);
    case "stripe:create-price":
      return method(resource("prices"), "create")(input, options);
    case "stripe:retrieve-price": {
      const { id, rest } = withId(input);
      return method(resource("prices"), "retrieve")(id, rest, options);
    }
    case "stripe:update-price": {
      const { id, rest } = withId(input);
      return method(resource("prices"), "update")(id, rest, options);
    }
    case "stripe:list-prices":
      return method(resource("prices"), "list")(input, options);
    case "stripe:search-prices":
      return method(resource("prices"), "search")(input, options);
    case "stripe:retrieve-event": {
      const { id, rest } = withId(input);
      return method(resource("events"), "retrieve")(id, rest, options);
    }
    case "stripe:list-events":
      return method(resource("events"), "list")(input, options);
    default:
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
      );
  }
}

/**
 * All Stripe operations from the pinned Sim Studio baseline, executed through
 * Stripe's maintained Node SDK. The API key stays encrypted until this
 * package-created client is constructed for one request.
 */
export function createStripeProviderSdk(
  config: StripeProviderSdkConfig,
): IntegrationProviderSdk {
  const timeout = config.requestTimeoutMs ?? 15_000;
  const maxNetworkRetries = config.maxNetworkRetries ?? 2;
  if (
    !Number.isSafeInteger(timeout) ||
    timeout < 100 ||
    timeout > 120_000 ||
    !Number.isSafeInteger(maxNetworkRetries) ||
    maxNetworkRetries < 0 ||
    maxNetworkRetries > 5
  ) {
    throw new Error("Invalid Stripe SDK configuration.");
  }
  const clientFactory = config.clientFactory ?? createStripeClient;

  return {
    integrationId: "stripe",
    operationIds: STRIPE_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "stripe" ||
        invocation.reference.integrationId !== "stripe"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      requireStripeOperation(invocation.operationId);
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await executeStripeOperation(
            clientFactory(credential.apiKey, { timeout, maxNetworkRetries }),
            invocation,
          ),
        }),
      );
    },
  };
}

export function getStripeProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  return {
    operations: STRIPE_OPERATION_IDS.length,
    operationIds: STRIPE_OPERATION_IDS,
  };
}

interface SlackApiClient {
  apiCall(method: string, options?: Record<string, unknown>): Promise<unknown>;
}

type SlackClientFactory = (
  accessToken: string,
  configuration: { timeout: number },
) => SlackApiClient;

export interface SlackProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: SlackClientFactory;
  fetcher?: typeof fetch;
  requestTimeoutMs?: number;
  maxDownloadBytes?: number;
}

function createSlackClient(
  accessToken: string,
  configuration: { timeout: number },
): SlackApiClient {
  return new WebClient(accessToken, {
    timeout: configuration.timeout,
  });
}

const SLACK_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "slack",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

const SLACK_OPERATION_METHODS: Readonly<Record<string, string>> = {
  "slack:send-message": "chat.postMessage",
  "slack:send-ephemeral-message": "chat.postEphemeral",
  "slack:create-canvas": "canvases.create",
  "slack:read-messages": "conversations.history",
  "slack:get-message": "conversations.replies",
  "slack:get-thread": "conversations.replies",
  "slack:get-thread-replies": "conversations.replies",
  "slack:get-channel-history": "conversations.history",
  "slack:get-message-permalink": "chat.getPermalink",
  "slack:set-assistant-status": "assistant.threads.setStatus",
  "slack:set-assistant-title": "assistant.threads.setTitle",
  "slack:set-suggested-prompts": "assistant.threads.setSuggestedPrompts",
  "slack:list-channels": "conversations.list",
  "slack:list-channel-members": "conversations.members",
  "slack:list-users": "users.list",
  "slack:get-user-info": "users.info",
  "slack:download-file": "files.info",
  "slack:update-message": "chat.update",
  "slack:delete-message": "chat.delete",
  "slack:add-reaction": "reactions.add",
  "slack:remove-reaction": "reactions.remove",
  "slack:get-channel-info": "conversations.info",
  "slack:get-user-presence": "users.getPresence",
  "slack:edit-canvas": "canvases.edit",
  "slack:create-channel-canvas": "conversations.canvases.create",
  "slack:get-canvas-info": "files.info",
  "slack:list-canvases": "files.list",
  "slack:lookup-canvas-sections": "canvases.sections.lookup",
  "slack:delete-canvas": "canvases.delete",
  "slack:create-conversation": "conversations.create",
  "slack:invite-to-conversation": "conversations.invite",
  "slack:open-view": "views.open",
  "slack:update-view": "views.update",
  "slack:push-view": "views.push",
  "slack:publish-view": "views.publish",
  "slack:schedule-message": "chat.scheduleMessage",
  "slack:list-scheduled-messages": "chat.scheduledMessages.list",
  "slack:delete-scheduled-message": "chat.deleteScheduledMessage",
  "slack:archive-conversation": "conversations.archive",
  "slack:rename-conversation": "conversations.rename",
  "slack:set-conversation-topic": "conversations.setTopic",
  "slack:set-conversation-purpose": "conversations.setPurpose",
};

function assertSlackOperationCoverage(): void {
  const expected = new Set(SLACK_OPERATION_IDS);
  const implemented = Object.keys(SLACK_OPERATION_METHODS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Slack provider SDK operation coverage is incomplete.");
  }
}

function normalizeSlackValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeSlackValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key.replace(/[A-Z]/gu, (character) => `_${character.toLowerCase()}`),
      normalizeSlackValue(child),
    ]),
  );
}

function slackParameters(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const parameters = normalizeSlackValue(asInputRecord(input)) as Record<
    string,
    unknown
  >;
  for (const key of [
    "credential",
    "oauth_credential",
    "bot_token",
    "api_key",
    "auth_method",
  ]) {
    delete parameters[key];
  }
  return parameters;
}

function asProviderResult(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  return value as Record<string, unknown>;
}

function isSlackDownloadUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "slack.com" || url.hostname.endsWith(".slack.com"))
    );
  } catch {
    return false;
  }
}

async function readBoundedResponse(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) {
      break;
    }
    length += next.value.byteLength;
    if (length > maximumBytes) {
      void reader.cancel().catch(() => undefined);
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
      );
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function downloadSlackFile(
  result: Record<string, unknown>,
  accessToken: string,
  fetcher: typeof fetch,
  maximumBytes: number,
): Promise<{ file: Record<string, unknown>; content: Uint8Array }> {
  const file = result.file;
  if (!file || typeof file !== "object" || Array.isArray(file)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  const record = file as Record<string, unknown>;
  const downloadUrl =
    typeof record.url_private_download === "string"
      ? record.url_private_download
      : record.url_private;
  if (typeof downloadUrl !== "string" || !isSlackDownloadUrl(downloadUrl)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  const response = await fetcher(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  return {
    file: record,
    content: await readBoundedResponse(response, maximumBytes),
  };
}

/**
 * All 42 Slack operations from the pinned Sim Studio baseline. The maintained
 * Slack Web API SDK receives a short-lived access token only inside the
 * encrypted OAuth runtime callback.
 */
export function createSlackProviderSdk(
  config: SlackProviderSdkConfig,
): IntegrationProviderSdk {
  assertSlackOperationCoverage();
  const timeout = config.requestTimeoutMs ?? 15_000;
  const maximumDownloadBytes = config.maxDownloadBytes ?? 25 * 1024 * 1024;
  if (
    !Number.isSafeInteger(timeout) ||
    timeout < 100 ||
    timeout > 120_000 ||
    !Number.isSafeInteger(maximumDownloadBytes) ||
    maximumDownloadBytes < 1_024 ||
    maximumDownloadBytes > 100 * 1024 * 1024
  ) {
    throw new Error("Invalid Slack SDK configuration.");
  }
  const clientFactory = config.clientFactory ?? createSlackClient;
  const fetcher = config.fetcher ?? fetch;

  return {
    integrationId: "slack",
    operationIds: SLACK_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "slack" ||
        invocation.reference.integrationId !== "slack"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const method = SLACK_OPERATION_METHODS[invocation.operationId];
      if (!method) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const result = asProviderResult(
            await clientFactory(credential.accessToken, { timeout }).apiCall(
              method,
              slackParameters(invocation.input),
            ),
          );
          return {
            operationId: invocation.operationId,
            output:
              invocation.operationId === "slack:download-file"
                ? await downloadSlackFile(
                    result,
                    credential.accessToken,
                    fetcher,
                    maximumDownloadBytes,
                  )
                : result,
          };
        },
      );
    },
  };
}

export function getSlackProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertSlackOperationCoverage();
  return {
    operations: SLACK_OPERATION_IDS.length,
    operationIds: SLACK_OPERATION_IDS,
  };
}

interface HubSpotApiRequest {
  method: string;
  path: string;
  body?: unknown;
  qs?: Record<string, string>;
}

interface HubSpotApiResponse {
  ok: boolean;
  json(): Promise<unknown>;
}

interface HubSpotApiClient {
  setAccessToken(accessToken: string): void;
  apiRequest(request: HubSpotApiRequest): Promise<HubSpotApiResponse>;
}

type HubSpotClientFactory = () => HubSpotApiClient;

export interface HubSpotProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: HubSpotClientFactory;
}

function createHubSpotClient(): HubSpotApiClient {
  return new HubSpotClient() as unknown as HubSpotApiClient;
}

const HUBSPOT_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "hubspot",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

function hubSpotPathSegment(value: unknown): string {
  return encodeURIComponent(
    requireString(value, "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID"),
  );
}

function optionalHubSpotString(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim() || value.length > 1_000) {
    return undefined;
  }
  return value;
}

function hubSpotInputString(
  input: Readonly<Record<string, unknown>>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = optionalHubSpotString(input[key]);
    if (value) {
      return value;
    }
  }
  throw new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

function parseHubSpotJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
}

function hubSpotQuery(
  input: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): Record<string, string> | undefined {
  const query = Object.fromEntries(
    keys.flatMap((key) => {
      const value = input[key];
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return [[key, String(value)]];
      }
      if (
        Array.isArray(value) &&
        value.every((entry) => typeof entry === "string")
      ) {
        return [[key, value.join(",")]];
      }
      return [];
    }),
  );
  return Object.keys(query).length ? query : undefined;
}

function hubSpotObjectReadRequest(
  objectType: string,
  idKey: string,
  input: Readonly<Record<string, unknown>>,
): HubSpotApiRequest {
  const id =
    optionalHubSpotString(input[idKey]) ?? optionalHubSpotString(input.id);
  const query = hubSpotQuery(input, [
    "limit",
    "after",
    "properties",
    "associations",
    "archived",
    "idProperty",
  ]);
  return {
    method: "GET",
    path: id
      ? `/crm/v3/objects/${objectType}/${hubSpotPathSegment(id)}`
      : `/crm/v3/objects/${objectType}`,
    qs: query,
  };
}

function hubSpotObjectCreateRequest(
  objectType: string,
  input: Readonly<Record<string, unknown>>,
): HubSpotApiRequest {
  const body: Record<string, unknown> = {
    properties: parseHubSpotJson(input.properties),
  };
  const associations = parseHubSpotJson(input.associations);
  if (Array.isArray(associations) && associations.length) {
    body.associations = associations;
  }
  return {
    method: "POST",
    path: `/crm/v3/objects/${objectType}`,
    body,
  };
}

function hubSpotObjectUpdateRequest(
  objectType: string,
  idKey: string,
  input: Readonly<Record<string, unknown>>,
): HubSpotApiRequest {
  return {
    method: "PATCH",
    path: `/crm/v3/objects/${objectType}/${hubSpotPathSegment(
      hubSpotInputString(input, idKey, "id"),
    )}`,
    qs: hubSpotQuery(input, ["idProperty"]),
    body: { properties: parseHubSpotJson(input.properties) },
  };
}

function hubSpotObjectDeleteRequest(
  objectType: string,
  idKey: string,
  input: Readonly<Record<string, unknown>>,
): HubSpotApiRequest {
  return {
    method: "DELETE",
    path: `/crm/v3/objects/${objectType}/${hubSpotPathSegment(
      hubSpotInputString(input, idKey, "id"),
    )}`,
  };
}

function hubSpotObjectSearchRequest(
  objectType: string,
  input: Readonly<Record<string, unknown>>,
): HubSpotApiRequest {
  const body: Record<string, unknown> = {};
  for (const key of ["filterGroups", "sorts", "properties"]) {
    const value = parseHubSpotJson(input[key]);
    if (Array.isArray(value) && value.length) {
      body[key] = value;
    }
  }
  for (const key of ["query", "limit", "after"]) {
    if (input[key] !== undefined) {
      body[key] = input[key];
    }
  }
  return {
    method: "POST",
    path: `/crm/v3/objects/${objectType}/search`,
    body,
  };
}

function hubSpotMembershipBody(
  input: Readonly<Record<string, unknown>>,
): string[] {
  const value = parseHubSpotJson(input.recordIds);
  const ids = Array.isArray(value)
    ? value.map((entry) => String(entry).trim()).filter(Boolean)
    : typeof value === "string"
      ? value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];
  if (!ids.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return ids;
}

type HubSpotOperationRequestFactory = (
  input: Readonly<Record<string, unknown>>,
) => HubSpotApiRequest;

const HUBSPOT_OPERATION_REQUESTS: Readonly<
  Record<string, HubSpotOperationRequestFactory>
> = {
  "hubspot:get-contacts": (input) =>
    hubSpotObjectReadRequest("contacts", "contactId", input),
  "hubspot:create-contact": (input) =>
    hubSpotObjectCreateRequest("contacts", input),
  "hubspot:update-contact": (input) =>
    hubSpotObjectUpdateRequest("contacts", "contactId", input),
  "hubspot:search-contacts": (input) =>
    hubSpotObjectSearchRequest("contacts", input),
  "hubspot:delete-contact": (input) =>
    hubSpotObjectDeleteRequest("contacts", "contactId", input),
  "hubspot:get-companies": (input) =>
    hubSpotObjectReadRequest("companies", "companyId", input),
  "hubspot:create-company": (input) =>
    hubSpotObjectCreateRequest("companies", input),
  "hubspot:update-company": (input) =>
    hubSpotObjectUpdateRequest("companies", "companyId", input),
  "hubspot:search-companies": (input) =>
    hubSpotObjectSearchRequest("companies", input),
  "hubspot:delete-company": (input) =>
    hubSpotObjectDeleteRequest("companies", "companyId", input),
  "hubspot:get-deals": (input) =>
    hubSpotObjectReadRequest("deals", "dealId", input),
  "hubspot:create-deal": (input) => hubSpotObjectCreateRequest("deals", input),
  "hubspot:update-deal": (input) =>
    hubSpotObjectUpdateRequest("deals", "dealId", input),
  "hubspot:search-deals": (input) => hubSpotObjectSearchRequest("deals", input),
  "hubspot:delete-deal": (input) =>
    hubSpotObjectDeleteRequest("deals", "dealId", input),
  "hubspot:get-tickets": (input) =>
    hubSpotObjectReadRequest("tickets", "ticketId", input),
  "hubspot:create-ticket": (input) =>
    hubSpotObjectCreateRequest("tickets", input),
  "hubspot:update-ticket": (input) =>
    hubSpotObjectUpdateRequest("tickets", "ticketId", input),
  "hubspot:search-tickets": (input) =>
    hubSpotObjectSearchRequest("tickets", input),
  "hubspot:delete-ticket": (input) =>
    hubSpotObjectDeleteRequest("tickets", "ticketId", input),
  "hubspot:get-notes": (input) =>
    hubSpotObjectReadRequest("notes", "noteId", input),
  "hubspot:create-note": (input) => hubSpotObjectCreateRequest("notes", input),
  "hubspot:search-notes": (input) => hubSpotObjectSearchRequest("notes", input),
  "hubspot:get-emails": (input) =>
    hubSpotObjectReadRequest("emails", "emailId", input),
  "hubspot:create-email": (input) =>
    hubSpotObjectCreateRequest("emails", input),
  "hubspot:search-emails": (input) =>
    hubSpotObjectSearchRequest("emails", input),
  "hubspot:get-properties": (input) => {
    const objectType = hubSpotPathSegment(
      hubSpotInputString(input, "objectType"),
    );
    const propertyName = optionalHubSpotString(input.propertyName);
    return {
      method: "GET",
      path: `/crm/v3/properties/${objectType}${
        propertyName ? `/${hubSpotPathSegment(propertyName)}` : ""
      }`,
      qs: hubSpotQuery(input, ["archived"]),
    };
  },
  "hubspot:list-associations": (input) => ({
    method: "GET",
    path: `/crm/v4/objects/${hubSpotPathSegment(
      hubSpotInputString(input, "objectType"),
    )}/${hubSpotPathSegment(hubSpotInputString(input, "objectId", "id"))}/associations/${hubSpotPathSegment(
      hubSpotInputString(input, "toObjectType"),
    )}`,
    qs: hubSpotQuery(input, ["limit", "after"]),
  }),
  "hubspot:create-association": (input) => {
    const objectType = hubSpotPathSegment(
      hubSpotInputString(input, "objectType"),
    );
    const objectId = hubSpotPathSegment(
      hubSpotInputString(input, "objectId", "id"),
    );
    const toObjectType = hubSpotPathSegment(
      hubSpotInputString(input, "toObjectType"),
    );
    const toObjectId = hubSpotPathSegment(
      hubSpotInputString(input, "toObjectId"),
    );
    const associationTypeId = input.associationTypeId;
    return {
      method: "PUT",
      path:
        associationTypeId === undefined || associationTypeId === null
          ? `/crm/v4/objects/${objectType}/${objectId}/associations/default/${toObjectType}/${toObjectId}`
          : `/crm/v4/objects/${objectType}/${objectId}/associations/${toObjectType}/${toObjectId}`,
      body:
        associationTypeId === undefined || associationTypeId === null
          ? undefined
          : [
              {
                associationCategory:
                  optionalHubSpotString(input.associationCategory) ??
                  "HUBSPOT_DEFINED",
                associationTypeId,
              },
            ],
    };
  },
  "hubspot:delete-association": (input) => ({
    method: "DELETE",
    path: `/crm/v4/objects/${hubSpotPathSegment(
      hubSpotInputString(input, "objectType"),
    )}/${hubSpotPathSegment(hubSpotInputString(input, "objectId", "id"))}/associations/${hubSpotPathSegment(
      hubSpotInputString(input, "toObjectType"),
    )}/${hubSpotPathSegment(hubSpotInputString(input, "toObjectId"))}`,
  }),
  "hubspot:get-association-labels": (input) => ({
    method: "GET",
    path: `/crm/v4/associations/${hubSpotPathSegment(
      hubSpotInputString(input, "objectType"),
    )}/${hubSpotPathSegment(hubSpotInputString(input, "toObjectType"))}/labels`,
  }),
  "hubspot:get-line-items": (input) =>
    hubSpotObjectReadRequest("line_items", "lineItemId", input),
  "hubspot:create-line-item": (input) =>
    hubSpotObjectCreateRequest("line_items", input),
  "hubspot:update-line-item": (input) =>
    hubSpotObjectUpdateRequest("line_items", "lineItemId", input),
  "hubspot:search-line-items": (input) =>
    hubSpotObjectSearchRequest("line_items", input),
  "hubspot:delete-line-item": (input) =>
    hubSpotObjectDeleteRequest("line_items", "lineItemId", input),
  "hubspot:get-quotes": (input) =>
    hubSpotObjectReadRequest("quotes", "quoteId", input),
  "hubspot:search-quotes": (input) =>
    hubSpotObjectSearchRequest("quotes", input),
  "hubspot:get-appointments": (input) =>
    hubSpotObjectReadRequest("appointments", "appointmentId", input),
  "hubspot:create-appointment": (input) =>
    hubSpotObjectCreateRequest("appointments", input),
  "hubspot:update-appointment": (input) =>
    hubSpotObjectUpdateRequest("appointments", "appointmentId", input),
  "hubspot:get-carts": (input) =>
    hubSpotObjectReadRequest("carts", "cartId", input),
  "hubspot:list-owners": (input) => ({
    method: "GET",
    path: "/crm/v3/owners",
    qs: hubSpotQuery(input, ["limit", "after", "email"]),
  }),
  "hubspot:get-marketing-events": (input) => {
    const eventId =
      optionalHubSpotString(input.eventId) ?? optionalHubSpotString(input.id);
    return {
      method: "GET",
      path: eventId
        ? `/marketing/v3/marketing-events/${hubSpotPathSegment(eventId)}`
        : "/marketing/v3/marketing-events",
      qs: eventId ? undefined : hubSpotQuery(input, ["limit", "after"]),
    };
  },
  "hubspot:get-lists": (input) => {
    const listId =
      optionalHubSpotString(input.listId) ?? optionalHubSpotString(input.id);
    return listId
      ? {
          method: "GET",
          path: `/crm/v3/lists/${hubSpotPathSegment(listId)}`,
        }
      : {
          method: "POST",
          path: "/crm/v3/lists/search",
          body: {
            offset: typeof input.offset === "number" ? input.offset : 0,
            ...(optionalHubSpotString(input.query)
              ? { query: input.query }
              : {}),
            ...(typeof input.count === "number" ? { count: input.count } : {}),
          },
        };
  },
  "hubspot:create-list": (input) => ({
    method: "POST",
    path: "/crm/v3/lists",
    body: {
      name: input.name,
      objectTypeId: input.objectTypeId,
      processingType: input.processingType,
    },
  }),
  "hubspot:get-list-members": (input) => ({
    method: "GET",
    path: `/crm/v3/lists/${hubSpotPathSegment(
      hubSpotInputString(input, "listId", "id"),
    )}/memberships`,
    qs: hubSpotQuery(input, ["limit", "after"]),
  }),
  "hubspot:add-list-members": (input) => ({
    method: "PUT",
    path: `/crm/v3/lists/${hubSpotPathSegment(
      hubSpotInputString(input, "listId", "id"),
    )}/memberships/add`,
    body: hubSpotMembershipBody(input),
  }),
  "hubspot:remove-list-members": (input) => ({
    method: "PUT",
    path: `/crm/v3/lists/${hubSpotPathSegment(
      hubSpotInputString(input, "listId", "id"),
    )}/memberships/remove`,
    body: hubSpotMembershipBody(input),
  }),
  "hubspot:get-users": (input) => ({
    method: "GET",
    path: "/crm/v3/objects/users",
    qs: hubSpotQuery(input, ["limit", "after", "properties"]),
  }),
};

function assertHubSpotOperationCoverage(): void {
  const expected = new Set(HUBSPOT_OPERATION_IDS);
  const implemented = Object.keys(HUBSPOT_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("HubSpot provider SDK operation coverage is incomplete.");
  }
}

async function readHubSpotResponse(
  response: HubSpotApiResponse,
): Promise<unknown> {
  if (!response.ok) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  try {
    return await response.json();
  } catch {
    return { success: true };
  }
}

/**
 * Every HubSpot action in the pinned Sim Studio catalogue, routed through the
 * maintained HubSpot Node client. The client receives an OAuth access token
 * only inside the integration package's encrypted credential callback.
 */
export function createHubSpotProviderSdk(
  config: HubSpotProviderSdkConfig,
): IntegrationProviderSdk {
  assertHubSpotOperationCoverage();
  const clientFactory = config.clientFactory ?? createHubSpotClient;
  return {
    integrationId: "hubspot",
    operationIds: HUBSPOT_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "hubspot" ||
        invocation.reference.integrationId !== "hubspot"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = HUBSPOT_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      const request = requestFactory(invocation.input);
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const client = clientFactory();
          client.setAccessToken(credential.accessToken);
          return {
            operationId: invocation.operationId,
            output: await readHubSpotResponse(await client.apiRequest(request)),
          };
        },
      );
    },
  };
}

export function getHubSpotProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertHubSpotOperationCoverage();
  return {
    operations: HUBSPOT_OPERATION_IDS.length,
    operationIds: HUBSPOT_OPERATION_IDS,
  };
}

interface GitHubApiClient {
  request(
    route: string,
    parameters: Record<string, unknown>,
  ): Promise<{ data: unknown }>;
}

type GitHubClientFactory = (apiKey: string) => GitHubApiClient;

export interface GitHubProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: GitHubClientFactory;
}

function createGitHubClient(apiKey: string): GitHubApiClient {
  return new Octokit({
    auth: apiKey,
    userAgent: "@oppulence/integrations",
  }) as unknown as GitHubApiClient;
}

const GITHUB_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "github",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GitHubApiRequest {
  route: string;
  parameters: Record<string, unknown>;
}

type GitHubOperationRequestFactory = (
  input: Readonly<Record<string, unknown>>,
) => GitHubApiRequest;

const GITHUB_CREDENTIAL_PARAMETER_NAMES = new Set([
  "access_token",
  "api_key",
  "auth",
  "authorization",
  "bearer",
  "bot_token",
  "credential",
  "headers",
  "oauth_credential",
  "password",
  "refresh_token",
  "request",
  "secret",
  "token",
]);

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/gu, (character) => `_${character.toLowerCase()}`);
}

function gitHubParameters(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(input)) {
    const key = toSnakeCase(rawKey);
    if (!GITHUB_CREDENTIAL_PARAMETER_NAMES.has(key)) {
      parameters[key] = value;
    }
  }
  if (
    parameters.pull_number === undefined &&
    parameters.issue_number !== undefined
  ) {
    parameters.pull_number = parameters.issue_number;
  }
  if (
    parameters.issue_number === undefined &&
    parameters.pull_number !== undefined
  ) {
    parameters.issue_number = parameters.pull_number;
  }
  return parameters;
}

function gitHubRequest(
  route: string,
  input: Readonly<Record<string, unknown>>,
  additions?: Readonly<Record<string, unknown>>,
): GitHubApiRequest {
  return {
    route,
    parameters: { ...gitHubParameters(input), ...additions },
  };
}

function gitHubRest(route: string): GitHubOperationRequestFactory {
  return (input) => gitHubRequest(route, input);
}

function gitHubGraphql(
  query: string,
  input: Readonly<Record<string, unknown>>,
  variables: Readonly<Record<string, unknown>> = gitHubParameters(input),
): GitHubApiRequest {
  return gitHubRequest("POST /graphql", input, { query, variables });
}

const GITHUB_PROJECT_FIELDS = `
  id
  number
  title
  shortDescription
  closed
  public
  url
`;

const GITHUB_OPERATION_REQUESTS: Readonly<
  Record<string, GitHubOperationRequestFactory>
> = {
  "github:get-pr-details": gitHubRest(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
  ),
  "github:create-pr-comment": (input) =>
    gitHubRequest(
      input.path
        ? "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments"
        : "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      input,
      input.path ? undefined : { event: "COMMENT" },
    ),
  "github:get-repository-info": gitHubRest("GET /repos/{owner}/{repo}"),
  "github:get-latest-commit": (input) => {
    const parameters = gitHubParameters(input);
    const branch = optionalHubSpotString(parameters.branch);
    return branch
      ? gitHubRequest("GET /repos/{owner}/{repo}/commits/{branch}", input)
      : gitHubRequest("GET /repos/{owner}/{repo}/commits", input);
  },
  "github:create-issue-comment": gitHubRest(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
  ),
  "github:list-issue-comments": gitHubRest(
    "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
  ),
  "github:update-comment": gitHubRest(
    "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
  ),
  "github:delete-comment": gitHubRest(
    "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}",
  ),
  "github:list-pr-comments": gitHubRest(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
  ),
  "github:create-pull-request": gitHubRest("POST /repos/{owner}/{repo}/pulls"),
  "github:update-pull-request": gitHubRest(
    "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
  ),
  "github:merge-pull-request": gitHubRest(
    "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
  ),
  "github:list-pull-requests": gitHubRest("GET /repos/{owner}/{repo}/pulls"),
  "github:get-pr-files": gitHubRest(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
  ),
  "github:close-pull-request": (input) =>
    gitHubRequest("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", input, {
      state: "closed",
    }),
  "github:request-pr-reviewers": gitHubRest(
    "POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
  ),
  "github:create-pr-review": gitHubRest(
    "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
  ),
  "github:get-file-content": gitHubRest(
    "GET /repos/{owner}/{repo}/contents/{path}",
  ),
  "github:create-file": gitHubRest("PUT /repos/{owner}/{repo}/contents/{path}"),
  "github:update-file": gitHubRest("PUT /repos/{owner}/{repo}/contents/{path}"),
  "github:delete-file": gitHubRest(
    "DELETE /repos/{owner}/{repo}/contents/{path}",
  ),
  "github:get-directory-tree": gitHubRest(
    "GET /repos/{owner}/{repo}/contents/{path}",
  ),
  "github:get-readme": gitHubRest("GET /repos/{owner}/{repo}/readme"),
  "github:list-tags": gitHubRest("GET /repos/{owner}/{repo}/tags"),
  "github:list-branches": gitHubRest("GET /repos/{owner}/{repo}/branches"),
  "github:get-branch": gitHubRest(
    "GET /repos/{owner}/{repo}/branches/{branch}",
  ),
  "github:create-branch": gitHubRest("POST /repos/{owner}/{repo}/git/refs"),
  "github:delete-branch": gitHubRest(
    "DELETE /repos/{owner}/{repo}/git/refs/heads/{branch}",
  ),
  "github:get-branch-protection": gitHubRest(
    "GET /repos/{owner}/{repo}/branches/{branch}/protection",
  ),
  "github:update-branch-protection": gitHubRest(
    "PUT /repos/{owner}/{repo}/branches/{branch}/protection",
  ),
  "github:create-issue": gitHubRest("POST /repos/{owner}/{repo}/issues"),
  "github:update-issue": gitHubRest(
    "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
  ),
  "github:list-issues": gitHubRest("GET /repos/{owner}/{repo}/issues"),
  "github:get-issue": gitHubRest(
    "GET /repos/{owner}/{repo}/issues/{issue_number}",
  ),
  "github:close-issue": (input) =>
    gitHubRequest("PATCH /repos/{owner}/{repo}/issues/{issue_number}", input, {
      state: "closed",
    }),
  "github:add-issue-labels": gitHubRest(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
  ),
  "github:remove-issue-label": gitHubRest(
    "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}",
  ),
  "github:add-issue-assignees": gitHubRest(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/assignees",
  ),
  "github:create-release": gitHubRest("POST /repos/{owner}/{repo}/releases"),
  "github:update-release": gitHubRest(
    "PATCH /repos/{owner}/{repo}/releases/{release_id}",
  ),
  "github:list-releases": gitHubRest("GET /repos/{owner}/{repo}/releases"),
  "github:get-release": gitHubRest(
    "GET /repos/{owner}/{repo}/releases/{release_id}",
  ),
  "github:get-latest-release": gitHubRest(
    "GET /repos/{owner}/{repo}/releases/latest",
  ),
  "github:delete-release": gitHubRest(
    "DELETE /repos/{owner}/{repo}/releases/{release_id}",
  ),
  "github:list-workflows": gitHubRest(
    "GET /repos/{owner}/{repo}/actions/workflows",
  ),
  "github:get-workflow": gitHubRest(
    "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}",
  ),
  "github:trigger-workflow": gitHubRest(
    "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
  ),
  "github:list-workflow-runs": gitHubRest(
    "GET /repos/{owner}/{repo}/actions/runs",
  ),
  "github:get-workflow-run": gitHubRest(
    "GET /repos/{owner}/{repo}/actions/runs/{run_id}",
  ),
  "github:cancel-workflow-run": gitHubRest(
    "POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel",
  ),
  "github:rerun-workflow": gitHubRest(
    "POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun",
  ),
  "github:list-projects": (input) =>
    gitHubGraphql(
      `query($owner_login: String!) {
        repositoryOwner(login: $owner_login) {
          ... on User { projectsV2(first: 100) { nodes { ${GITHUB_PROJECT_FIELDS} } } }
          ... on Organization { projectsV2(first: 100) { nodes { ${GITHUB_PROJECT_FIELDS} } } }
        }
      }`,
      input,
    ),
  "github:get-project": (input) =>
    gitHubGraphql(
      `query($owner_login: String!, $project_number: Int!) {
        repositoryOwner(login: $owner_login) {
          ... on User { projectV2(number: $project_number) { ${GITHUB_PROJECT_FIELDS} } }
          ... on Organization { projectV2(number: $project_number) { ${GITHUB_PROJECT_FIELDS} } }
        }
      }`,
      input,
    ),
  "github:create-project": (input) =>
    gitHubGraphql(
      `mutation($owner_id: ID!, $title: String!) {
        createProjectV2(input: {ownerId: $owner_id, title: $title}) {
          projectV2 { ${GITHUB_PROJECT_FIELDS} }
        }
      }`,
      input,
    ),
  "github:update-project": (input) =>
    gitHubGraphql(
      `mutation($project_id: ID!, $title: String, $short_description: String, $project_public: Boolean, $closed: Boolean) {
        updateProjectV2(input: {projectId: $project_id, title: $title, shortDescription: $short_description, public: $project_public, closed: $closed}) {
          projectV2 { ${GITHUB_PROJECT_FIELDS} }
        }
      }`,
      input,
    ),
  "github:delete-project": (input) =>
    gitHubGraphql(
      `mutation($project_id: ID!) { deleteProjectV2(input: {projectId: $project_id}) { clientMutationId } }`,
      input,
    ),
  "github:search-code": gitHubRest("GET /search/code"),
  "github:search-commits": gitHubRest("GET /search/commits"),
  "github:search-issues": gitHubRest("GET /search/issues"),
  "github:search-repositories": gitHubRest("GET /search/repositories"),
  "github:search-users": gitHubRest("GET /search/users"),
  "github:list-commits": gitHubRest("GET /repos/{owner}/{repo}/commits"),
  "github:get-commit": gitHubRest("GET /repos/{owner}/{repo}/commits/{ref}"),
  "github:compare-commits": gitHubRest(
    "GET /repos/{owner}/{repo}/compare/{base}...{head}",
  ),
  "github:create-gist": gitHubRest("POST /gists"),
  "github:get-gist": gitHubRest("GET /gists/{gist_id}"),
  "github:list-gists": (input) => {
    const parameters = gitHubParameters(input);
    return optionalHubSpotString(parameters.username)
      ? gitHubRequest("GET /users/{username}/gists", input)
      : gitHubRequest("GET /gists", input);
  },
  "github:update-gist": gitHubRest("PATCH /gists/{gist_id}"),
  "github:delete-gist": gitHubRest("DELETE /gists/{gist_id}"),
  "github:fork-gist": gitHubRest("POST /gists/{gist_id}/forks"),
  "github:star-gist": gitHubRest("PUT /gists/{gist_id}/star"),
  "github:unstar-gist": gitHubRest("DELETE /gists/{gist_id}/star"),
  "github:fork-repository": gitHubRest("POST /repos/{owner}/{repo}/forks"),
  "github:list-forks": gitHubRest("GET /repos/{owner}/{repo}/forks"),
  "github:create-milestone": gitHubRest(
    "POST /repos/{owner}/{repo}/milestones",
  ),
  "github:get-milestone": gitHubRest(
    "GET /repos/{owner}/{repo}/milestones/{milestone_number}",
  ),
  "github:list-milestones": gitHubRest("GET /repos/{owner}/{repo}/milestones"),
  "github:update-milestone": gitHubRest(
    "PATCH /repos/{owner}/{repo}/milestones/{milestone_number}",
  ),
  "github:delete-milestone": gitHubRest(
    "DELETE /repos/{owner}/{repo}/milestones/{milestone_number}",
  ),
  "github:add-issue-reaction": gitHubRest(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/reactions",
  ),
  "github:remove-issue-reaction": gitHubRest(
    "DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}",
  ),
  "github:add-comment-reaction": gitHubRest(
    "POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions",
  ),
  "github:remove-comment-reaction": gitHubRest(
    "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}",
  ),
  "github:star-repository": gitHubRest("PUT /user/starred/{owner}/{repo}"),
  "github:unstar-repository": gitHubRest("DELETE /user/starred/{owner}/{repo}"),
  "github:check-if-starred": gitHubRest("GET /user/starred/{owner}/{repo}"),
  "github:list-stargazers": gitHubRest("GET /repos/{owner}/{repo}/stargazers"),
};

function assertGitHubOperationCoverage(): void {
  const expected = new Set(GITHUB_OPERATION_IDS);
  const implemented = Object.keys(GITHUB_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("GitHub provider SDK operation coverage is incomplete.");
  }
}

/**
 * All pinned GitHub actions, executed through Octokit. A GitHub token is
 * decrypted only while this package constructs its short-lived SDK client.
 */
export function createGitHubProviderSdk(
  config: GitHubProviderSdkConfig,
): IntegrationProviderSdk {
  assertGitHubOperationCoverage();
  const clientFactory = config.clientFactory ?? createGitHubClient;
  return {
    integrationId: "github",
    operationIds: GITHUB_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "github" ||
        invocation.reference.integrationId !== "github"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = GITHUB_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      const request = requestFactory(invocation.input);
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: (
            await clientFactory(credential.apiKey).request(
              request.route,
              request.parameters,
            )
          ).data,
        }),
      );
    },
  };
}

export function getGitHubProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGitHubOperationCoverage();
  return {
    operations: GITHUB_OPERATION_IDS.length,
    operationIds: GITHUB_OPERATION_IDS,
  };
}

type GitLabSdkClient = Record<string, unknown>;
type GitLabClientFactory = (apiKey: string, host: string) => GitLabSdkClient;

export interface GitLabProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: GitLabClientFactory;
  /** A deployment-controlled GitLab origin. Request input can never override it. */
  host?: string;
}

function normalizeGitLabHost(value: string): string {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) {
      throw new Error("unsafe GitLab host");
    }
    return url.origin;
  } catch {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
}

function createGitLabClient(apiKey: string, host: string): GitLabSdkClient {
  return new Gitlab({ token: apiKey, host }) as unknown as GitLabSdkClient;
}

const GITLAB_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "gitlab",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GitLabSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function gitLabRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): GitLabSdkRequest {
  const argumentsCopy = [...arguments_];
  while (argumentsCopy.at(-1) === undefined) argumentsCopy.pop();
  return { path, arguments: argumentsCopy };
}

function gitLabId(
  input: Readonly<Record<string, unknown>>,
  field: string,
): string | number {
  const value = input[field];
  if (
    (typeof value === "string" && value.trim() && value.length <= 1_000) ||
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
  ) {
    return typeof value === "string" ? value.trim() : value;
  }
  throw new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

function gitLabNumber(
  input: Readonly<Record<string, unknown>>,
  field: string,
): number {
  const value = input[field];
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  throw new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

function gitLabOptions(
  input: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): Record<string, unknown> | undefined {
  const options = definedVercelFields(
    Object.fromEntries(fields.map((field) => [field, input[field]])),
  );
  return Object.keys(options).length ? options : undefined;
}

function gitLabProjectId(
  input: Readonly<Record<string, unknown>>,
): string | number {
  return gitLabId(input, "projectId");
}

function gitLabResource(
  input: Readonly<Record<string, unknown>>,
  suffix: "Members" | "Invitations" | "AccessRequests",
): { path: readonly string[]; resourceId: string | number } {
  const type = requiredVercelString(input, "resourceType").toLowerCase();
  if (type !== "project" && type !== "group") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return {
    path: [`${type === "project" ? "Project" : "Group"}${suffix}`],
    resourceId: gitLabId(input, "resourceId"),
  };
}

const GITLAB_OPERATION_REQUESTS: Readonly<
  Record<string, (input: Readonly<Record<string, unknown>>) => GitLabSdkRequest>
> = {
  "gitlab:list-projects": (input) =>
    gitLabRequest(
      ["Projects", "all"],
      gitLabOptions(input, [
        "owned",
        "membership",
        "search",
        "visibility",
        "orderBy",
        "sort",
        "perPage",
        "page",
      ]),
    ),
  "gitlab:get-project": (input) =>
    gitLabRequest(["Projects", "show"], gitLabProjectId(input)),
  "gitlab:list-groups": (input) =>
    gitLabRequest(
      ["Groups", "all"],
      gitLabOptions(input, [
        "owned",
        "search",
        "topLevelOnly",
        "visibility",
        "minAccessLevel",
        "allAvailable",
        "orderBy",
        "sort",
        "perPage",
        "page",
      ]),
    ),
  "gitlab:get-group": (input) =>
    gitLabRequest(["Groups", "show"], gitLabId(input, "groupId")),
  "gitlab:list-issues": (input) =>
    gitLabRequest(
      ["Issues", "all"],
      definedVercelFields({
        projectId: gitLabProjectId(input),
        state: input.state,
        labels: input.labels,
        assigneeId: input.assigneeId,
        milestone: input.milestoneTitle,
        search: input.search,
        orderBy: input.orderBy,
        sort: input.sort,
        perPage: input.perPage,
        page: input.page,
      }),
    ),
  "gitlab:get-issue": (input) =>
    gitLabRequest(["Issues", "show"], gitLabNumber(input, "issueIid"), {
      projectId: gitLabProjectId(input),
    }),
  "gitlab:create-issue": (input) =>
    gitLabRequest(
      ["Issues", "create"],
      gitLabProjectId(input),
      requiredVercelString(input, "title"),
      gitLabOptions(input, [
        "description",
        "labels",
        "assigneeIds",
        "milestoneId",
        "dueDate",
        "confidential",
      ]),
    ),
  "gitlab:update-issue": (input) =>
    gitLabRequest(
      ["Issues", "edit"],
      gitLabProjectId(input),
      gitLabNumber(input, "issueIid"),
      gitLabOptions(input, [
        "title",
        "description",
        "stateEvent",
        "labels",
        "assigneeIds",
        "milestoneId",
        "dueDate",
        "confidential",
      ]),
    ),
  "gitlab:delete-issue": (input) =>
    gitLabRequest(
      ["Issues", "remove"],
      gitLabProjectId(input),
      gitLabNumber(input, "issueIid"),
    ),
  "gitlab:add-issue-comment": (input) =>
    gitLabRequest(
      ["IssueNotes", "create"],
      gitLabProjectId(input),
      gitLabNumber(input, "issueIid"),
      requiredVercelString(input, "body"),
      gitLabOptions(input, ["internal"]),
    ),
  "gitlab:list-merge-requests": (input) =>
    gitLabRequest(
      ["MergeRequests", "all"],
      definedVercelFields({
        projectId: gitLabProjectId(input),
        state: input.state,
        labels: input.labels,
        sourceBranch: input.sourceBranch,
        targetBranch: input.targetBranch,
        orderBy: input.orderBy,
        sort: input.sort,
        perPage: input.perPage,
        page: input.page,
      }),
    ),
  "gitlab:get-merge-request": (input) =>
    gitLabRequest(
      ["MergeRequests", "show"],
      gitLabProjectId(input),
      gitLabNumber(input, "mergeRequestIid"),
    ),
  "gitlab:create-merge-request": (input) =>
    gitLabRequest(
      ["MergeRequests", "create"],
      gitLabProjectId(input),
      requiredVercelString(input, "sourceBranch"),
      requiredVercelString(input, "targetBranch"),
      requiredVercelString(input, "title"),
      gitLabOptions(input, [
        "description",
        "labels",
        "assigneeIds",
        "milestoneId",
        "removeSourceBranch",
        "squash",
        "draft",
      ]),
    ),
  "gitlab:update-merge-request": (input) =>
    gitLabRequest(
      ["MergeRequests", "edit"],
      gitLabProjectId(input),
      gitLabNumber(input, "mergeRequestIid"),
      gitLabOptions(input, [
        "title",
        "description",
        "stateEvent",
        "labels",
        "assigneeIds",
        "milestoneId",
        "targetBranch",
        "removeSourceBranch",
        "squash",
        "draft",
      ]),
    ),
  "gitlab:merge-merge-request": (input) =>
    gitLabRequest(
      ["MergeRequests", "merge"],
      gitLabProjectId(input),
      gitLabNumber(input, "mergeRequestIid"),
      gitLabOptions(input, [
        "mergeCommitMessage",
        "squashCommitMessage",
        "squash",
        "shouldRemoveSourceBranch",
        "mergeWhenPipelineSucceeds",
      ]),
    ),
  "gitlab:add-mr-comment": (input) =>
    gitLabRequest(
      ["MergeRequestNotes", "create"],
      gitLabProjectId(input),
      gitLabNumber(input, "mergeRequestIid"),
      requiredVercelString(input, "body"),
      gitLabOptions(input, ["internal"]),
    ),
  "gitlab:list-pipelines": (input) =>
    gitLabRequest(
      ["Pipelines", "all"],
      gitLabProjectId(input),
      gitLabOptions(input, [
        "ref",
        "status",
        "orderBy",
        "sort",
        "perPage",
        "page",
      ]),
    ),
  "gitlab:get-pipeline": (input) =>
    gitLabRequest(
      ["Pipelines", "show"],
      gitLabProjectId(input),
      gitLabNumber(input, "pipelineId"),
    ),
  "gitlab:create-pipeline": (input) =>
    gitLabRequest(
      ["Pipelines", "create"],
      gitLabProjectId(input),
      requiredVercelString(input, "ref"),
      gitLabOptions(input, ["variables", "inputs"]),
    ),
  "gitlab:retry-pipeline": (input) =>
    gitLabRequest(
      ["Pipelines", "retry"],
      gitLabProjectId(input),
      gitLabNumber(input, "pipelineId"),
    ),
  "gitlab:cancel-pipeline": (input) =>
    gitLabRequest(
      ["Pipelines", "cancel"],
      gitLabProjectId(input),
      gitLabNumber(input, "pipelineId"),
    ),
  "gitlab:list-repository-tree": (input) =>
    gitLabRequest(
      ["Repositories", "allRepositoryTrees"],
      gitLabProjectId(input),
      gitLabOptions(input, ["path", "ref", "recursive", "perPage", "page"]),
    ),
  "gitlab:get-file": (input) =>
    gitLabRequest(
      ["RepositoryFiles", "show"],
      gitLabProjectId(input),
      requiredVercelString(input, "filePath"),
      requiredVercelString(input, "ref"),
    ),
  "gitlab:create-file": (input) =>
    gitLabRequest(
      ["RepositoryFiles", "create"],
      gitLabProjectId(input),
      requiredVercelString(input, "filePath"),
      requiredVercelString(input, "branch"),
      requiredVercelString(input, "content"),
      requiredVercelString(input, "commitMessage"),
      gitLabOptions(input, [
        "startBranch",
        "authorName",
        "authorEmail",
        "executeFilemode",
      ]),
    ),
  "gitlab:update-file": (input) =>
    gitLabRequest(
      ["RepositoryFiles", "edit"],
      gitLabProjectId(input),
      requiredVercelString(input, "filePath"),
      requiredVercelString(input, "branch"),
      requiredVercelString(input, "content"),
      requiredVercelString(input, "commitMessage"),
      gitLabOptions(input, [
        "startBranch",
        "authorName",
        "authorEmail",
        "executeFilemode",
        "lastCommitId",
      ]),
    ),
  "gitlab:list-commits": (input) =>
    gitLabRequest(
      ["Commits", "all"],
      gitLabProjectId(input),
      gitLabOptions(input, [
        "refName",
        "since",
        "until",
        "path",
        "author",
        "perPage",
        "page",
      ]),
    ),
  "gitlab:list-branches": (input) =>
    gitLabRequest(
      ["Branches", "all"],
      gitLabProjectId(input),
      gitLabOptions(input, ["search", "perPage", "page"]),
    ),
  "gitlab:create-branch": (input) =>
    gitLabRequest(
      ["Branches", "create"],
      gitLabProjectId(input),
      requiredVercelString(input, "branch"),
      requiredVercelString(input, "ref"),
    ),
  "gitlab:delete-branch": (input) =>
    gitLabRequest(
      ["Branches", "remove"],
      gitLabProjectId(input),
      requiredVercelString(input, "branch"),
    ),
  "gitlab:compare-branches": (input) =>
    gitLabRequest(
      ["Repositories", "compare"],
      gitLabProjectId(input),
      requiredVercelString(input, "from"),
      requiredVercelString(input, "to"),
      gitLabOptions(input, ["straight", "fromProjectId", "unidiff"]),
    ),
  "gitlab:get-mr-changes": (input) =>
    gitLabRequest(
      ["MergeRequests", "showChanges"],
      gitLabProjectId(input),
      gitLabNumber(input, "mergeRequestIid"),
    ),
  "gitlab:approve-merge-request": (input) =>
    gitLabRequest(
      ["MergeRequestApprovals", "approve"],
      gitLabProjectId(input),
      gitLabNumber(input, "mergeRequestIid"),
      gitLabOptions(input, ["sha"]),
    ),
  "gitlab:list-pipeline-jobs": (input) =>
    gitLabRequest(
      ["Jobs", "all"],
      gitLabProjectId(input),
      definedVercelFields({
        pipelineId: gitLabNumber(input, "pipelineId"),
        scope: input.scope,
        includeRetried: input.includeRetried,
        perPage: input.perPage,
        page: input.page,
      }),
    ),
  "gitlab:get-job-log": (input) =>
    gitLabRequest(
      ["Jobs", "showLog"],
      gitLabProjectId(input),
      gitLabNumber(input, "jobId"),
    ),
  "gitlab:play-job": (input) =>
    gitLabRequest(
      ["Jobs", "play"],
      gitLabProjectId(input),
      gitLabNumber(input, "jobId"),
      definedVercelFields({ jobVariablesAttributes: input.jobVariables }),
    ),
  "gitlab:list-releases": (input) =>
    gitLabRequest(
      ["ProjectReleases", "all"],
      gitLabProjectId(input),
      gitLabOptions(input, ["orderBy", "sort", "perPage", "page"]),
    ),
  "gitlab:create-release": (input) =>
    gitLabRequest(
      ["ProjectReleases", "create"],
      gitLabProjectId(input),
      gitLabOptions(input, [
        "tagName",
        "name",
        "description",
        "ref",
        "releasedAt",
        "tagMessage",
        "assetLinks",
        "milestones",
      ]),
    ),
  "gitlab:list-members": (input) => {
    const resource = gitLabResource(input, "Members");
    return gitLabRequest(
      [...resource.path, "all"],
      resource.resourceId,
      definedVercelFields({
        includeInherited: !Boolean(input.directOnly),
        query: input.query,
        userIds:
          typeof input.userIds === "string"
            ? input.userIds
                .split(",")
                .map((value) => Number(value.trim()))
                .filter(Number.isSafeInteger)
            : undefined,
        state: input.state,
        showSeatInfo: input.showSeatInfo,
        perPage: input.perPage,
        page: input.page,
      }),
    );
  },
  "gitlab:add-member": (input) => {
    const resource = gitLabResource(input, "Members");
    return gitLabRequest(
      [...resource.path, "add"],
      resource.resourceId,
      gitLabNumber(input, "accessLevel"),
      definedVercelFields({
        userId: input.userId,
        username: input.username,
        expiresAt: input.expiresAt,
        memberRoleId: input.memberRoleId,
      }),
    );
  },
  "gitlab:update-member": (input) => {
    const resource = gitLabResource(input, "Members");
    return gitLabRequest(
      [...resource.path, "edit"],
      resource.resourceId,
      gitLabNumber(input, "userId"),
      gitLabNumber(input, "accessLevel"),
      gitLabOptions(input, ["expiresAt", "memberRoleId"]),
    );
  },
  "gitlab:remove-member": (input) => {
    const resource = gitLabResource(input, "Members");
    return gitLabRequest(
      [...resource.path, "remove"],
      resource.resourceId,
      gitLabNumber(input, "userId"),
      gitLabOptions(input, ["skipSubresources", "unassignIssuables"]),
    );
  },
  "gitlab:invite-member-by-email": (input) => {
    const resource = gitLabResource(input, "Invitations");
    return gitLabRequest(
      [...resource.path, "add"],
      resource.resourceId,
      gitLabNumber(input, "accessLevel"),
      definedVercelFields({
        email: requiredVercelString(input, "email"),
        expiresAt: input.expiresAt,
        memberRoleId: input.memberRoleId,
        inviteSource: input.inviteSource,
      }),
    );
  },
  "gitlab:list-invitations": (input) => {
    const resource = gitLabResource(input, "Invitations");
    return gitLabRequest(
      [...resource.path, "all"],
      resource.resourceId,
      gitLabOptions(input, ["query", "perPage", "page"]),
    );
  },
  "gitlab:update-invitation": (input) => {
    const resource = gitLabResource(input, "Invitations");
    return gitLabRequest(
      [...resource.path, "edit"],
      resource.resourceId,
      requiredVercelString(input, "email"),
      gitLabOptions(input, ["accessLevel", "expiresAt"]),
    );
  },
  "gitlab:revoke-invitation": (input) => {
    const resource = gitLabResource(input, "Invitations");
    return gitLabRequest(
      [...resource.path, "remove"],
      resource.resourceId,
      requiredVercelString(input, "email"),
    );
  },
  "gitlab:list-access-requests": (input) => {
    const resource = gitLabResource(input, "AccessRequests");
    return gitLabRequest(
      [...resource.path, "all"],
      resource.resourceId,
      gitLabOptions(input, ["perPage", "page"]),
    );
  },
  "gitlab:approve-access-request": (input) => {
    const resource = gitLabResource(input, "AccessRequests");
    return gitLabRequest(
      [...resource.path, "approve"],
      resource.resourceId,
      gitLabNumber(input, "userId"),
      gitLabOptions(input, ["accessLevel"]),
    );
  },
  "gitlab:deny-access-request": (input) => {
    const resource = gitLabResource(input, "AccessRequests");
    return gitLabRequest(
      [...resource.path, "deny"],
      resource.resourceId,
      gitLabNumber(input, "userId"),
    );
  },
  "gitlab:list-saml-group-links": (input) =>
    gitLabRequest(
      ["GroupSAMLLinks", "all"],
      gitLabId(input, "groupId"),
      gitLabOptions(input, ["perPage", "page"]),
    ),
  "gitlab:list-user-memberships": (input) =>
    gitLabRequest(
      ["Users", "allMemberships"],
      gitLabNumber(input, "userId"),
      definedVercelFields({
        type: input.membershipType,
        perPage: input.perPage,
        page: input.page,
      }),
    ),
  "gitlab:search-users": (input) =>
    gitLabRequest(
      ["Users", "all"],
      definedVercelFields({
        search: requiredVercelString(input, "search"),
        perPage: input.perPage,
        page: input.page,
      }),
    ),
  "gitlab:create-user": (input) =>
    gitLabRequest(
      ["Users", "create"],
      gitLabOptions(input, [
        "email",
        "username",
        "name",
        "password",
        "resetPassword",
        "forceRandomPassword",
        "admin",
        "skipConfirmation",
      ]),
    ),
  "gitlab:update-user": (input) =>
    gitLabRequest(
      ["Users", "edit"],
      gitLabNumber(input, "userId"),
      gitLabOptions(input, ["email", "username", "name", "admin"]),
    ),
  "gitlab:delete-user": (input) =>
    gitLabRequest(
      ["Users", "remove"],
      gitLabNumber(input, "userId"),
      gitLabOptions(input, ["hardDelete"]),
    ),
  "gitlab:block-user": (input) =>
    gitLabRequest(["Users", "block"], gitLabNumber(input, "userId")),
  "gitlab:unblock-user": (input) =>
    gitLabRequest(["Users", "unblock"], gitLabNumber(input, "userId")),
  "gitlab:deactivate-user": (input) =>
    gitLabRequest(["Users", "deactivate"], gitLabNumber(input, "userId")),
  "gitlab:activate-user": (input) =>
    gitLabRequest(["Users", "activate"], gitLabNumber(input, "userId")),
  "gitlab:ban-user": (input) =>
    gitLabRequest(["Users", "ban"], gitLabNumber(input, "userId")),
  "gitlab:unban-user": (input) =>
    gitLabRequest(["Users", "unban"], gitLabNumber(input, "userId")),
  "gitlab:approve-user-signup": (input) =>
    gitLabRequest(["Users", "approve"], gitLabNumber(input, "userId")),
  "gitlab:reject-user-signup": (input) =>
    gitLabRequest(["Users", "reject"], gitLabNumber(input, "userId")),
  "gitlab:delete-user-identity": (input) =>
    gitLabRequest(
      ["Users", "removeAuthenticationIdentity"],
      gitLabNumber(input, "userId"),
      requiredVercelString(input, "provider"),
    ),
  "gitlab:add-saml-group-link": (input) =>
    gitLabRequest(
      ["GroupSAMLLinks", "create"],
      gitLabId(input, "groupId"),
      requiredVercelString(input, "samlGroupName"),
      gitLabNumber(input, "accessLevel"),
      gitLabOptions(input, ["memberRoleId", "provider"]),
    ),
  "gitlab:delete-saml-group-link": (input) =>
    gitLabRequest(
      ["GroupSAMLLinks", "remove"],
      gitLabId(input, "groupId"),
      requiredVercelString(input, "samlGroupName"),
      gitLabOptions(input, ["provider"]),
    ),
};

function assertGitLabOperationCoverage(): void {
  const expected = new Set(GITLAB_OPERATION_IDS);
  const implemented = Object.keys(GITLAB_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("GitLab provider SDK operation coverage is incomplete.");
  }
}

/**
 * All pinned GitLab actions use the maintained GitBeaker SDK. The deployment
 * controls the GitLab origin, which prevents an action input from directing a
 * decrypted personal access token to an arbitrary host.
 */
export function createGitLabProviderSdk(
  config: GitLabProviderSdkConfig,
): IntegrationProviderSdk {
  assertGitLabOperationCoverage();
  const host = normalizeGitLabHost(config.host ?? "https://gitlab.com");
  const clientFactory = config.clientFactory ?? createGitLabClient;
  return {
    integrationId: "gitlab",
    operationIds: GITLAB_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "gitlab" ||
        invocation.reference.integrationId !== "gitlab"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = GITLAB_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await invokeSquareMethod(
            clientFactory(credential.apiKey, host),
            requestFactory(invocation.input),
          ),
        }),
      );
    },
  };
}

export function getGitLabProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGitLabOperationCoverage();
  return {
    operations: GITLAB_OPERATION_IDS.length,
    operationIds: GITLAB_OPERATION_IDS,
  };
}

type CloudflareSdkClient = Record<string, unknown>;
type CloudflareClientFactory = (apiKey: string) => CloudflareSdkClient;

export interface CloudflareProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: CloudflareClientFactory;
}

function createCloudflareClient(apiKey: string): CloudflareSdkClient {
  return new Cloudflare({ apiToken: apiKey }) as unknown as CloudflareSdkClient;
}

const CLOUDFLARE_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "cloudflare",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

// cloudflare@7.0.0 exposes individual zone-setting reads but not the source
// action's complete zone-settings collection endpoint. Keep that action
// catalogue-only rather than adding a raw REST escape hatch.
const CLOUDFLARE_SDK_OPERATION_IDS = Object.freeze(
  CLOUDFLARE_OPERATION_IDS.filter(
    (operationId) => operationId !== "cloudflare:get-zone-settings",
  ),
);

interface CloudflareSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function cloudflareRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): CloudflareSdkRequest {
  return { path, arguments: arguments_ };
}

function cloudflareZoneId(input: Readonly<Record<string, unknown>>): string {
  return requiredVercelString(input, "zoneId", "zone_id");
}

function cloudflareCsv(
  input: Readonly<Record<string, unknown>>,
  field: string,
): string[] | undefined {
  return optionalVercelCsv(input, field);
}

function cloudflareDnsRecord(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return definedVercelFields({
    zone_id: cloudflareZoneId(input),
    type: requiredVercelString(input, "type"),
    name: requiredVercelString(input, "name"),
    content: requiredVercelString(input, "content"),
    ttl: optionalVercelNumber(input, "ttl"),
    proxied: optionalVercelBoolean(input, "proxied"),
    priority: optionalVercelNumber(input, "priority"),
    comment: optionalVercelString(input, "comment"),
    tags: cloudflareCsv(input, "tags"),
  });
}

const CLOUDFLARE_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => CloudflareSdkRequest
  >
> = {
  "cloudflare:list-zones": (input) =>
    cloudflareRequest(
      ["zones", "list"],
      definedVercelFields({
        name: optionalVercelString(input, "name"),
        status: optionalVercelString(input, "status"),
        page: optionalVercelNumber(input, "page"),
        per_page: optionalVercelNumber(input, "per_page"),
        order: optionalVercelString(input, "order"),
        direction: optionalVercelString(input, "direction"),
        match: optionalVercelString(input, "match"),
        account: optionalVercelString(input, "accountId")
          ? { id: optionalVercelString(input, "accountId") }
          : undefined,
      }),
    ),
  "cloudflare:get-zone-details": (input) =>
    cloudflareRequest(["zones", "get"], { zone_id: cloudflareZoneId(input) }),
  "cloudflare:create-zone": (input) =>
    cloudflareRequest(
      ["zones", "create"],
      definedVercelFields({
        name: requiredVercelString(input, "name"),
        account: { id: requiredVercelString(input, "accountId", "account_id") },
        type: optionalVercelString(input, "type"),
      }),
    ),
  "cloudflare:delete-zone": (input) =>
    cloudflareRequest(["zones", "delete"], {
      zone_id: cloudflareZoneId(input),
    }),
  "cloudflare:list-dns-records": (input) =>
    cloudflareRequest(
      ["dns", "records", "list"],
      definedVercelFields({
        zone_id: cloudflareZoneId(input),
        type: optionalVercelString(input, "type"),
        name: optionalVercelString(input, "name"),
        content: optionalVercelString(input, "content"),
        page: optionalVercelNumber(input, "page"),
        per_page: optionalVercelNumber(input, "per_page"),
        direction: optionalVercelString(input, "direction"),
        match: optionalVercelString(input, "match"),
        order: optionalVercelString(input, "order"),
        proxied: optionalVercelBoolean(input, "proxied"),
        search: optionalVercelString(input, "search"),
        tag: optionalVercelString(input, "tag"),
        tag_match: optionalVercelString(input, "tag_match"),
        comment: optionalVercelString(input, "commentFilter"),
      }),
    ),
  "cloudflare:create-dns-record": (input) =>
    cloudflareRequest(["dns", "records", "create"], cloudflareDnsRecord(input)),
  "cloudflare:update-dns-record": (input) =>
    cloudflareRequest(
      ["dns", "records", "edit"],
      requiredVercelString(input, "recordId", "record_id"),
      cloudflareDnsRecord(input),
    ),
  "cloudflare:delete-dns-record": (input) =>
    cloudflareRequest(
      ["dns", "records", "delete"],
      requiredVercelString(input, "recordId", "record_id"),
      { zone_id: cloudflareZoneId(input) },
    ),
  "cloudflare:list-certificates": (input) =>
    cloudflareRequest(
      ["ssl", "certificatePacks", "list"],
      definedVercelFields({
        zone_id: cloudflareZoneId(input),
        status: optionalVercelString(input, "status"),
        page: optionalVercelNumber(input, "page"),
        per_page: optionalVercelNumber(input, "per_page"),
        deploy: optionalVercelBoolean(input, "deploy"),
      }),
    ),
  "cloudflare:update-zone-setting": (input) =>
    cloudflareRequest(
      ["zones", "settings", "edit"],
      requiredVercelString(input, "settingId", "setting_id"),
      {
        zone_id: cloudflareZoneId(input),
        value: input.value,
      },
    ),
  "cloudflare:dns-analytics": (input) =>
    cloudflareRequest(
      ["dns", "analytics", "reports", "get"],
      definedVercelFields({
        zone_id: cloudflareZoneId(input),
        since: optionalVercelString(input, "since"),
        until: optionalVercelString(input, "until"),
        metrics: optionalVercelString(input, "metrics"),
        dimensions: optionalVercelString(input, "dimensions"),
        filters: optionalVercelString(input, "filters"),
        sort: cloudflareCsv(input, "sort"),
        limit: optionalVercelNumber(input, "limit"),
      }),
    ),
  "cloudflare:purge-cache": (input) => {
    const purgeEverything = optionalVercelBoolean(input, "purge_everything");
    const targets = definedVercelFields({
      files: cloudflareCsv(input, "files"),
      tags: cloudflareCsv(input, "tags"),
      hosts: cloudflareCsv(input, "hosts"),
      prefixes: cloudflareCsv(input, "prefixes"),
    });
    if (!purgeEverything && Object.keys(targets).length === 0) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return cloudflareRequest(
      ["cache", "purge"],
      definedVercelFields({
        zone_id: cloudflareZoneId(input),
        purge_everything: purgeEverything || undefined,
        ...targets,
      }),
    );
  },
};

function assertCloudflareOperationCoverage(): void {
  const expected = new Set(CLOUDFLARE_SDK_OPERATION_IDS);
  const implemented = Object.keys(CLOUDFLARE_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Cloudflare provider SDK operation coverage is incomplete.",
    );
  }
}

/**
 * Executes Cloudflare actions exposed by Cloudflare's official SDK. A missing
 * SDK method remains catalogue-only instead of falling back to raw REST.
 */
export function createCloudflareProviderSdk(
  config: CloudflareProviderSdkConfig,
): IntegrationProviderSdk {
  assertCloudflareOperationCoverage();
  const clientFactory = config.clientFactory ?? createCloudflareClient;
  return {
    integrationId: "cloudflare",
    operationIds: CLOUDFLARE_SDK_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "cloudflare" ||
        invocation.reference.integrationId !== "cloudflare"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        CLOUDFLARE_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await invokeSquareMethod(
            clientFactory(credential.apiKey),
            requestFactory(invocation.input),
          ),
        }),
      );
    },
  };
}

export function getCloudflareProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertCloudflareOperationCoverage();
  return {
    operations: CLOUDFLARE_SDK_OPERATION_IDS.length,
    operationIds: CLOUDFLARE_SDK_OPERATION_IDS,
  };
}

type ElevenLabsSdkClient = Record<string, unknown>;
type ElevenLabsClientFactory = (apiKey: string) => ElevenLabsSdkClient;

export interface ElevenLabsProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: ElevenLabsClientFactory;
  /** Maximum decoded size accepted for an input or generated audio payload. */
  maxAudioBytes?: number;
}

function createElevenLabsClient(apiKey: string): ElevenLabsSdkClient {
  return new ElevenLabsClient({ apiKey }) as unknown as ElevenLabsSdkClient;
}

const ELEVENLABS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "elevenlabs",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

const ELEVENLABS_AUDIO_OPERATION_IDS = new Set([
  "elevenlabs:text-to-speech",
  "elevenlabs:sound-effects",
  "elevenlabs:speech-to-speech",
  "elevenlabs:audio-isolation",
]);

interface ElevenLabsSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function elevenLabsRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): ElevenLabsSdkRequest {
  return { path, arguments: arguments_ };
}

function elevenLabsVoiceSettings(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> | undefined {
  const voiceSettings = definedVercelFields({
    stability: optionalVercelNumber(input, "stability"),
    similarityBoost: optionalVercelNumber(input, "similarityBoost"),
    style: optionalVercelNumber(input, "style"),
    useSpeakerBoost: optionalVercelBoolean(input, "useSpeakerBoost"),
    speed: optionalVercelNumber(input, "speed"),
  });
  for (const value of [
    voiceSettings.stability,
    voiceSettings.similarityBoost,
    voiceSettings.style,
  ]) {
    if (typeof value === "number" && (value < 0 || value > 1)) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
  }
  return Object.keys(voiceSettings).length ? voiceSettings : undefined;
}

function elevenLabsAudioUpload(
  input: Readonly<Record<string, unknown>>,
  maximumBytes: number,
): Record<string, unknown> {
  const rawFile = input.audioFile;
  if (!rawFile || typeof rawFile !== "object" || Array.isArray(rawFile)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const file = rawFile as Record<string, unknown>;
  const encoded = optionalVercelString(file, "base64", "data", "content");
  if (!encoded || !/^[A-Za-z0-9+/_=-]*$/u.test(encoded)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const data = Buffer.from(encoded, "base64");
  if (!data.byteLength || data.byteLength > maximumBytes) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return {
    data,
    filename: optionalVercelString(file, "filename", "name") ?? "audio",
    contentType:
      optionalVercelString(file, "mimeType", "contentType", "type") ??
      "application/octet-stream",
    contentLength: data.byteLength,
  };
}

function elevenLabsOutputMimeType(
  input: Readonly<Record<string, unknown>>,
): string {
  const outputFormat = optionalVercelString(input, "outputFormat");
  if (outputFormat?.startsWith("wav")) return "audio/wav";
  if (outputFormat?.startsWith("pcm")) return "audio/pcm";
  if (outputFormat?.startsWith("ulaw") || outputFormat?.startsWith("alaw")) {
    return "audio/basic";
  }
  return "audio/mpeg";
}

async function elevenLabsAudioOutput(
  value: unknown,
  input: Readonly<Record<string, unknown>>,
  maximumBytes: number,
): Promise<Record<string, unknown>> {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as ReadableStream<Uint8Array>).getReader !== "function"
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  const reader = (value as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.byteLength;
    if (length > maximumBytes) {
      void reader.cancel().catch(() => undefined);
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
      );
    }
    chunks.push(next.value);
  }
  const audio = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  const mimeType = elevenLabsOutputMimeType(input);
  const data = audio.toString("base64");
  return {
    audioBase64: data,
    mimeType,
    byteLength: audio.byteLength,
    // The package cannot invent a durable URL. Products can persist this
    // portable payload with their existing file service if they need one.
    audioFile: {
      data,
      encoding: "base64",
      mimeType,
      byteLength: audio.byteLength,
    },
  };
}

function elevenLabsOptionalPageSize(
  input: Readonly<Record<string, unknown>>,
): number | undefined {
  const pageSize = optionalVercelNumber(input, "pageSize");
  if (pageSize === undefined) return undefined;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return pageSize;
}

function elevenLabsAudioRequest(
  input: Readonly<Record<string, unknown>>,
  maximumBytes: number,
  operationId: string,
): ElevenLabsSdkRequest {
  if (operationId === "elevenlabs:text-to-speech") {
    return elevenLabsRequest(
      ["textToSpeech", "convert"],
      requiredVercelString(input, "voiceId"),
      definedVercelFields({
        text: requiredVercelString(input, "text"),
        modelId: optionalVercelString(input, "modelId"),
        outputFormat: optionalVercelString(input, "outputFormat"),
        voiceSettings: elevenLabsVoiceSettings(input),
      }),
    );
  }
  if (operationId === "elevenlabs:sound-effects") {
    const durationSeconds = optionalVercelNumber(input, "durationSeconds");
    const promptInfluence = optionalVercelNumber(input, "promptInfluence");
    if (
      (durationSeconds !== undefined &&
        (durationSeconds < 0.5 || durationSeconds > 30)) ||
      (promptInfluence !== undefined &&
        (promptInfluence < 0 || promptInfluence > 1))
    ) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return elevenLabsRequest(
      ["textToSoundEffects", "convert"],
      definedVercelFields({
        text: requiredVercelString(input, "text"),
        modelId: optionalVercelString(input, "modelId"),
        outputFormat: optionalVercelString(input, "outputFormat"),
        durationSeconds,
        promptInfluence,
        loop: optionalVercelBoolean(input, "loop"),
      }),
    );
  }
  if (operationId === "elevenlabs:speech-to-speech") {
    return elevenLabsRequest(
      ["speechToSpeech", "convert"],
      requiredVercelString(input, "voiceId"),
      definedVercelFields({
        audio: elevenLabsAudioUpload(input, maximumBytes),
        modelId: optionalVercelString(input, "modelId"),
        outputFormat: optionalVercelString(input, "outputFormat"),
        removeBackgroundNoise: optionalVercelBoolean(
          input,
          "removeBackgroundNoise",
        ),
      }),
    );
  }
  return elevenLabsRequest(
    ["audioIsolation", "convert"],
    definedVercelFields({
      audio: elevenLabsAudioUpload(input, maximumBytes),
      fileFormat: optionalVercelString(input, "fileFormat"),
    }),
  );
}

const ELEVENLABS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => ElevenLabsSdkRequest
  >
> = {
  "elevenlabs:list-voices": (input) =>
    elevenLabsRequest(
      ["voices", "search"],
      definedVercelFields({
        search: optionalVercelString(input, "search"),
        category: optionalVercelString(input, "category"),
        pageSize: elevenLabsOptionalPageSize(input),
        nextPageToken: optionalVercelString(input, "nextPageToken"),
      }),
    ),
  "elevenlabs:get-voice": (input) =>
    elevenLabsRequest(
      ["voices", "get"],
      requiredVercelString(input, "voiceId"),
      { withSettings: true },
    ),
  "elevenlabs:get-voice-settings": (input) =>
    elevenLabsRequest(
      ["voices", "settings", "get"],
      requiredVercelString(input, "voiceId"),
    ),
  "elevenlabs:edit-voice-settings": (input) => {
    const voiceSettings = elevenLabsVoiceSettings(input);
    if (!voiceSettings) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return elevenLabsRequest(
      ["voices", "settings", "update"],
      requiredVercelString(input, "voiceId"),
      voiceSettings,
    );
  },
  "elevenlabs:list-models": () => elevenLabsRequest(["models", "list"]),
  "elevenlabs:get-user-info": () => elevenLabsRequest(["user", "get"]),
};

function assertElevenLabsOperationCoverage(): void {
  const expected = new Set(ELEVENLABS_OPERATION_IDS);
  const implemented = new Set([
    ...Object.keys(ELEVENLABS_OPERATION_REQUESTS),
    ...ELEVENLABS_AUDIO_OPERATION_IDS,
  ]);
  if (
    expected.size !== implemented.size ||
    [...implemented].some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "ElevenLabs provider SDK operation coverage is incomplete.",
    );
  }
}

/**
 * All pinned ElevenLabs actions use the official SDK. Generated audio is
 * returned as a bounded portable payload; storage and any durable URL remain
 * product-owned business logic.
 */
export function createElevenLabsProviderSdk(
  config: ElevenLabsProviderSdkConfig,
): IntegrationProviderSdk {
  assertElevenLabsOperationCoverage();
  const maximumAudioBytes = config.maxAudioBytes ?? 25 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maximumAudioBytes) ||
    maximumAudioBytes < 1_024 ||
    maximumAudioBytes > 100 * 1024 * 1024
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const clientFactory = config.clientFactory ?? createElevenLabsClient;
  return {
    integrationId: "elevenlabs",
    operationIds: ELEVENLABS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "elevenlabs" ||
        invocation.reference.integrationId !== "elevenlabs"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const request = ELEVENLABS_AUDIO_OPERATION_IDS.has(invocation.operationId)
        ? elevenLabsAudioRequest(
            invocation.input,
            maximumAudioBytes,
            invocation.operationId,
          )
        : ELEVENLABS_OPERATION_REQUESTS[invocation.operationId]?.(
            invocation.input,
          );
      if (!request) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const response = await invokeSquareMethod(
            clientFactory(credential.apiKey),
            request,
          );
          return {
            operationId: invocation.operationId,
            output: ELEVENLABS_AUDIO_OPERATION_IDS.has(invocation.operationId)
              ? await elevenLabsAudioOutput(
                  response,
                  invocation.input,
                  maximumAudioBytes,
                )
              : response,
          };
        },
      );
    },
  };
}

export function getElevenLabsProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertElevenLabsOperationCoverage();
  return {
    operations: ELEVENLABS_OPERATION_IDS.length,
    operationIds: ELEVENLABS_OPERATION_IDS,
  };
}

type FirecrawlSdkClient = Record<string, unknown>;
type FirecrawlClientFactory = (apiKey: string) => FirecrawlSdkClient;

export interface FirecrawlProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: FirecrawlClientFactory;
  /** Maximum decoded size accepted for a document parsing upload. */
  maxFileBytes?: number;
}

function createFirecrawlClient(apiKey: string): FirecrawlSdkClient {
  return new Firecrawl({ apiKey }) as unknown as FirecrawlSdkClient;
}

const FIRECRAWL_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "firecrawl",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface FirecrawlSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function firecrawlRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): FirecrawlSdkRequest {
  return { path, arguments: arguments_ };
}

function firecrawlJsonObject(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): Record<string, unknown> | undefined {
  const value = optionalVercelJson(input, ...names);
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value as Record<string, unknown>;
}

function firecrawlStringArray(
  input: Readonly<Record<string, unknown>>,
  name: string,
): string[] | undefined {
  const value = input[name];
  if (value === undefined || value === null || value === "") return undefined;
  const parsed =
    typeof value === "string" && value.trim().startsWith("[")
      ? optionalVercelJson(input, name)
      : value;
  const values = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "string"
      ? parsed.split(/[,\n]/u)
      : undefined;
  if (
    !values ||
    values.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return values.map((entry) => entry.trim());
}

function requiredFirecrawlUrls(
  input: Readonly<Record<string, unknown>>,
): string[] {
  const urls = firecrawlStringArray(input, "urls");
  if (!urls?.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return urls;
}

function firecrawlOptionalInteger(
  input: Readonly<Record<string, unknown>>,
  name: string,
  minimum = 1,
): number | undefined {
  const value = optionalVercelNumber(input, name);
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < minimum) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

function firecrawlScrapeOptions(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const inherited = firecrawlJsonObject(input, "scrapeOptions") ?? {};
  return definedVercelFields({
    ...inherited,
    formats: optionalVercelJson(input, "formats") ?? inherited.formats,
    onlyMainContent:
      optionalVercelBoolean(input, "onlyMainContent") ??
      inherited.onlyMainContent,
    includeTags:
      firecrawlStringArray(input, "includeTags") ?? inherited.includeTags,
    excludeTags:
      firecrawlStringArray(input, "excludeTags") ?? inherited.excludeTags,
    maxAge: firecrawlOptionalInteger(input, "maxAge", 0) ?? inherited.maxAge,
    headers: firecrawlJsonObject(input, "headers") ?? inherited.headers,
    waitFor: firecrawlOptionalInteger(input, "waitFor", 0) ?? inherited.waitFor,
    mobile: optionalVercelBoolean(input, "mobile") ?? inherited.mobile,
    skipTlsVerification:
      optionalVercelBoolean(input, "skipTlsVerification") ??
      inherited.skipTlsVerification,
    timeout: firecrawlOptionalInteger(input, "timeout", 1) ?? inherited.timeout,
    parsers: optionalVercelJson(input, "parsers") ?? inherited.parsers,
    actions: optionalVercelJson(input, "actions") ?? inherited.actions,
    location: firecrawlJsonObject(input, "location") ?? inherited.location,
    removeBase64Images:
      optionalVercelBoolean(input, "removeBase64Images") ??
      inherited.removeBase64Images,
    blockAds: optionalVercelBoolean(input, "blockAds") ?? inherited.blockAds,
    proxy: optionalVercelString(input, "proxy") ?? inherited.proxy,
    storeInCache:
      optionalVercelBoolean(input, "storeInCache") ?? inherited.storeInCache,
    zeroDataRetention:
      optionalVercelBoolean(input, "zeroDataRetention") ??
      inherited.zeroDataRetention,
  });
}

function firecrawlFile(
  input: Readonly<Record<string, unknown>>,
  maximumBytes: number,
): Record<string, unknown> {
  const rawFile = input.file;
  if (!rawFile || typeof rawFile !== "object" || Array.isArray(rawFile)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const file = rawFile as Record<string, unknown>;
  const encoded = optionalVercelString(file, "base64", "data", "content");
  if (!encoded || !/^[A-Za-z0-9+/_=-]*$/u.test(encoded)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const data = Buffer.from(encoded, "base64");
  if (!data.byteLength || data.byteLength > maximumBytes) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return {
    data,
    filename: optionalVercelString(file, "filename", "name") ?? "document",
    contentType:
      optionalVercelString(file, "mimeType", "contentType", "type") ??
      "application/octet-stream",
  };
}

const FIRECRAWL_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (
      input: Readonly<Record<string, unknown>>,
      maximumFileBytes: number,
    ) => FirecrawlSdkRequest
  >
> = {
  "firecrawl:scrape": (input) =>
    firecrawlRequest(
      ["scrape"],
      requiredVercelString(input, "url"),
      firecrawlScrapeOptions(input),
    ),
  "firecrawl:batch-scrape": (input) =>
    firecrawlRequest(
      ["startBatchScrape"],
      requiredFirecrawlUrls(input),
      definedVercelFields({
        options: firecrawlScrapeOptions(input),
        maxConcurrency: firecrawlOptionalInteger(input, "maxConcurrency"),
        ignoreInvalidURLs: optionalVercelBoolean(input, "ignoreInvalidURLs"),
        zeroDataRetention: optionalVercelBoolean(input, "zeroDataRetention"),
      }),
    ),
  "firecrawl:batch-scrape-status": (input) =>
    firecrawlRequest(
      ["getBatchScrapeStatus"],
      requiredVercelString(input, "jobId"),
    ),
  "firecrawl:search": (input) =>
    firecrawlRequest(
      ["search"],
      requiredVercelString(input, "query"),
      definedVercelFields({
        limit: firecrawlOptionalInteger(input, "limit"),
        sources: optionalVercelJson(input, "sources"),
        categories: optionalVercelJson(input, "categories"),
        tbs: optionalVercelString(input, "tbs"),
        location: firecrawlJsonObject(input, "location"),
        country: optionalVercelString(input, "country"),
        timeout: firecrawlOptionalInteger(input, "timeout", 1),
        ignoreInvalidURLs: optionalVercelBoolean(input, "ignoreInvalidURLs"),
        scrapeOptions: firecrawlJsonObject(input, "scrapeOptions"),
      }),
    ),
  "firecrawl:crawl": (input) =>
    firecrawlRequest(
      ["startCrawl"],
      requiredVercelString(input, "url"),
      definedVercelFields({
        limit: firecrawlOptionalInteger(input, "limit"),
        maxDiscoveryDepth:
          firecrawlOptionalInteger(input, "maxDiscoveryDepth") ??
          firecrawlOptionalInteger(input, "maxDepth"),
        excludePaths: firecrawlStringArray(input, "excludePaths"),
        includePaths: firecrawlStringArray(input, "includePaths"),
        scrapeOptions: firecrawlScrapeOptions(input),
        prompt: optionalVercelString(input, "prompt"),
        sitemap: optionalVercelString(input, "sitemap"),
        crawlEntireDomain: optionalVercelBoolean(input, "crawlEntireDomain"),
        allowExternalLinks: optionalVercelBoolean(input, "allowExternalLinks"),
        allowSubdomains: optionalVercelBoolean(input, "allowSubdomains"),
        ignoreQueryParameters: optionalVercelBoolean(
          input,
          "ignoreQueryParameters",
        ),
        delay: firecrawlOptionalInteger(input, "delay", 0),
        maxConcurrency: firecrawlOptionalInteger(input, "maxConcurrency"),
      }),
    ),
  "firecrawl:crawl-status": (input) =>
    firecrawlRequest(["getCrawlStatus"], requiredVercelString(input, "jobId")),
  "firecrawl:cancel-crawl": (input) =>
    firecrawlRequest(["cancelCrawl"], requiredVercelString(input, "jobId")),
  "firecrawl:map": (input) =>
    firecrawlRequest(
      ["map"],
      requiredVercelString(input, "url"),
      definedVercelFields({
        search: optionalVercelString(input, "search"),
        sitemap: optionalVercelString(input, "sitemap"),
        includeSubdomains: optionalVercelBoolean(input, "includeSubdomains"),
        ignoreQueryParameters: optionalVercelBoolean(
          input,
          "ignoreQueryParameters",
        ),
        limit: firecrawlOptionalInteger(input, "limit"),
        timeout: firecrawlOptionalInteger(input, "timeout", 1),
        location: firecrawlJsonObject(input, "location"),
      }),
    ),
  "firecrawl:extract": (input) =>
    firecrawlRequest(
      ["startExtract"],
      definedVercelFields({
        urls: firecrawlStringArray(input, "urls"),
        prompt: optionalVercelString(input, "prompt"),
        schema: firecrawlJsonObject(input, "schema"),
        enableWebSearch: optionalVercelBoolean(input, "enableWebSearch"),
        ignoreSitemap: optionalVercelBoolean(input, "ignoreSitemap"),
        includeSubdomains: optionalVercelBoolean(input, "includeSubdomains"),
        showSources: optionalVercelBoolean(input, "showSources"),
        ignoreInvalidURLs: optionalVercelBoolean(input, "ignoreInvalidURLs"),
        scrapeOptions: firecrawlJsonObject(input, "scrapeOptions"),
      }),
    ),
  "firecrawl:extract-status": (input) =>
    firecrawlRequest(
      ["getExtractStatus"],
      requiredVercelString(input, "jobId"),
    ),
  "firecrawl:agent": (input) =>
    firecrawlRequest(
      ["startAgent"],
      definedVercelFields({
        prompt: requiredVercelString(input, "prompt"),
        urls: firecrawlStringArray(input, "urls"),
        schema: firecrawlJsonObject(input, "schema"),
        maxCredits: firecrawlOptionalInteger(input, "maxCredits"),
        strictConstrainToURLs: optionalVercelBoolean(
          input,
          "strictConstrainToURLs",
        ),
      }),
    ),
  "firecrawl:parse-document": (input, maximumFileBytes) =>
    firecrawlRequest(
      ["parse"],
      firecrawlFile(input, maximumFileBytes),
      firecrawlScrapeOptions(input),
    ),
  "firecrawl:credit-usage": () => firecrawlRequest(["getCreditUsage"]),
};

function assertFirecrawlOperationCoverage(): void {
  const expected = new Set(FIRECRAWL_OPERATION_IDS);
  const implemented = Object.keys(FIRECRAWL_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Firecrawl provider SDK operation coverage is incomplete.");
  }
}

/** All pinned Firecrawl actions use Firecrawl's official TypeScript SDK. */
export function createFirecrawlProviderSdk(
  config: FirecrawlProviderSdkConfig,
): IntegrationProviderSdk {
  assertFirecrawlOperationCoverage();
  const maximumFileBytes = config.maxFileBytes ?? 25 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maximumFileBytes) ||
    maximumFileBytes < 1_024 ||
    maximumFileBytes > 100 * 1024 * 1024
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const clientFactory = config.clientFactory ?? createFirecrawlClient;
  return {
    integrationId: "firecrawl",
    operationIds: FIRECRAWL_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "firecrawl" ||
        invocation.reference.integrationId !== "firecrawl"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        FIRECRAWL_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await invokeSquareMethod(
            clientFactory(credential.apiKey),
            requestFactory(invocation.input, maximumFileBytes),
          ),
        }),
      );
    },
  };
}

export function getFirecrawlProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertFirecrawlOperationCoverage();
  return {
    operations: FIRECRAWL_OPERATION_IDS.length,
    operationIds: FIRECRAWL_OPERATION_IDS,
  };
}

interface AirtableSdkRecord {
  id?: string;
  fields?: Record<string, unknown>;
  _rawJson?: unknown;
}

interface AirtableSdkTable {
  select(input: Record<string, unknown>): { all(): Promise<unknown> };
  find(recordId: string): Promise<unknown>;
  create(
    records: readonly unknown[],
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  update(
    recordId: string,
    fields: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  update(
    records: readonly unknown[],
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  destroy(recordIds: readonly string[]): Promise<unknown>;
}

interface AirtableSdkClient {
  base(baseId: string): { table(tableId: string): AirtableSdkTable };
}

type AirtableClientFactory = (accessToken: string) => AirtableSdkClient;

export interface AirtableProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: AirtableClientFactory;
}

function createAirtableClient(accessToken: string): AirtableSdkClient {
  const Airtable = airtableRequire("airtable") as new (options: {
    apiKey: string;
  }) => AirtableSdkClient;
  return new Airtable({ apiKey: accessToken });
}

const AIRTABLE_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "airtable",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

// airtable@0.12.2 exposes the table-record API only. Its public SDK does not
// cover the metadata (bases/schema) endpoints or performUpsert. Those source
// actions stay catalogue-only rather than escaping to raw REST.
const AIRTABLE_SDK_OPERATION_IDS = Object.freeze(
  AIRTABLE_OPERATION_IDS.filter(
    (operationId) =>
      ![
        "airtable:list-bases",
        "airtable:list-tables",
        "airtable:get-base-schema",
        "airtable:upsert-records",
      ].includes(operationId),
  ),
);

function requiredAirtableRecordArray(
  input: Readonly<Record<string, unknown>>,
  field: "records" | "recordIds",
): unknown[] {
  const value = optionalVercelJson(input, field);
  if (!Array.isArray(value) || !value.length || value.length > 10) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

function requiredAirtableFields(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const fields = optionalVercelJson(input, "fields");
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return fields as Record<string, unknown>;
}

function airtableWriteOptions(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return definedVercelFields({
    typecast: optionalVercelBoolean(input, "typecast"),
  });
}

function airtableOutput(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(airtableOutput);
  if (!value || typeof value !== "object") return value;
  const record = value as AirtableSdkRecord;
  if (record._rawJson && typeof record._rawJson === "object") {
    return record._rawJson;
  }
  if (record.id && !record.fields) return { id: record.id, deleted: true };
  return value;
}

/**
 * Executes the Airtable actions modelled by Airtable's official SDK. Metadata
 * and upsert source actions are deliberately unavailable until the SDK adds
 * public methods for them.
 */
export function createAirtableProviderSdk(
  config: AirtableProviderSdkConfig,
): IntegrationProviderSdk {
  const clientFactory = config.clientFactory ?? createAirtableClient;
  return {
    integrationId: "airtable",
    operationIds: AIRTABLE_SDK_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "airtable" ||
        invocation.reference.integrationId !== "airtable"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      if (!AIRTABLE_SDK_OPERATION_IDS.includes(invocation.operationId)) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const input = invocation.input;
          const table = clientFactory(credential.accessToken)
            .base(requiredVercelString(input, "baseId"))
            .table(requiredVercelString(input, "tableId"));
          let result: unknown;
          switch (invocation.operationId) {
            case "airtable:list-records":
              result = await table
                .select(
                  definedVercelFields({
                    maxRecords: optionalVercelNumber(input, "maxRecords"),
                    filterByFormula: optionalVercelString(
                      input,
                      "filterFormula",
                    ),
                  }),
                )
                .all();
              break;
            case "airtable:get-record":
              result = await table.find(
                requiredVercelString(input, "recordId"),
              );
              break;
            case "airtable:create-records":
              result = await table.create(
                requiredAirtableRecordArray(input, "records"),
                airtableWriteOptions(input),
              );
              break;
            case "airtable:update-record":
              result = await table.update(
                requiredVercelString(input, "recordId"),
                requiredAirtableFields(input),
                airtableWriteOptions(input),
              );
              break;
            case "airtable:update-multiple-records":
              result = await table.update(
                requiredAirtableRecordArray(input, "records"),
                airtableWriteOptions(input),
              );
              break;
            case "airtable:delete-records": {
              const recordIds = requiredAirtableRecordArray(input, "recordIds");
              if (
                recordIds.some(
                  (recordId) =>
                    typeof recordId !== "string" || !recordId.trim(),
                )
              ) {
                throw new IntegrationProviderSdkError(
                  "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
                );
              }
              result = await table.destroy(recordIds as string[]);
              break;
            }
            default:
              throw new IntegrationProviderSdkError(
                "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
              );
          }
          return {
            operationId: invocation.operationId,
            output: airtableOutput(result),
          };
        },
      );
    },
  };
}

export function getAirtableProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  return {
    operations: AIRTABLE_SDK_OPERATION_IDS.length,
    operationIds: AIRTABLE_SDK_OPERATION_IDS,
  };
}

interface AsanaSdkClient {
  tasks: Record<
    string,
    (...arguments_: readonly unknown[]) => Promise<unknown>
  >;
  projects: Record<
    string,
    (...arguments_: readonly unknown[]) => Promise<unknown>
  >;
  sections: Record<
    string,
    (...arguments_: readonly unknown[]) => Promise<unknown>
  >;
  stories: Record<
    string,
    (...arguments_: readonly unknown[]) => Promise<unknown>
  >;
  workspaces: Record<
    string,
    (...arguments_: readonly unknown[]) => Promise<unknown>
  >;
}

type AsanaClientFactory = (accessToken: string) => AsanaSdkClient;

export interface AsanaProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: AsanaClientFactory;
}

function createAsanaClient(accessToken: string): AsanaSdkClient {
  const apiClient = new AsanaApiClient();
  apiClient.authentications.token!.accessToken = accessToken;
  return {
    tasks: new AsanaTasksApi(apiClient) as unknown as AsanaSdkClient["tasks"],
    projects: new AsanaProjectsApi(
      apiClient,
    ) as unknown as AsanaSdkClient["projects"],
    sections: new AsanaSectionsApi(
      apiClient,
    ) as unknown as AsanaSdkClient["sections"],
    stories: new AsanaStoriesApi(
      apiClient,
    ) as unknown as AsanaSdkClient["stories"],
    workspaces: new AsanaWorkspacesApi(
      apiClient,
    ) as unknown as AsanaSdkClient["workspaces"],
  };
}

const ASANA_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "asana",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

function asanaString(
  input: Readonly<Record<string, unknown>>,
  ...fields: readonly string[]
): string | undefined {
  for (const field of fields) {
    const value = optionalVercelString(input, field);
    if (value) return value;
  }
  return undefined;
}

function requiredAsanaString(
  input: Readonly<Record<string, unknown>>,
  ...fields: readonly string[]
): string {
  const value = asanaString(input, ...fields);
  if (!value) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

function asanaStringArray(
  input: Readonly<Record<string, unknown>>,
  field: string,
): string[] | undefined {
  const json = optionalVercelJson(input, field);
  if (json !== undefined) {
    if (
      !Array.isArray(json) ||
      !json.length ||
      json.length > 100 ||
      json.some((value) => typeof value !== "string" || !value.trim())
    ) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return json.map((value) => value.trim());
  }
  return optionalVercelString(input, field)
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function asanaObject(
  input: Readonly<Record<string, unknown>>,
  field: string,
): Record<string, unknown> | undefined {
  const value = optionalVercelJson(input, field);
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value as Record<string, unknown>;
}

function asanaData(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const supplied = asanaObject(input, "data");
  if (supplied) return supplied;
  const data = definedVercelFields({
    name: optionalVercelString(input, "name"),
    notes: optionalVercelString(input, "notes"),
    html_notes: optionalVercelString(input, "htmlNotes"),
    workspace: asanaString(input, "workspaceId", "workspaceGid", "workspace"),
    projects: asanaStringArray(input, "projects"),
    assignee: asanaString(input, "assigneeId", "assigneeGid", "assignee"),
    due_on: optionalVercelString(input, "dueOn"),
    due_at: optionalVercelString(input, "dueAt"),
    start_on: optionalVercelString(input, "startOn"),
    start_at: optionalVercelString(input, "startAt"),
    completed: optionalVercelBoolean(input, "completed"),
    followers: asanaStringArray(input, "followers"),
    color: optionalVercelString(input, "color"),
  });
  if (!Object.keys(data).length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return data;
}

function asanaOptions(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const supplied = asanaObject(input, "options");
  if (supplied) return supplied;
  return definedVercelFields({
    limit: optionalVercelNumber(input, "limit"),
    offset: optionalVercelString(input, "offset"),
    workspace: asanaString(input, "workspaceId", "workspaceGid", "workspace"),
    team: asanaString(input, "teamId", "teamGid", "team"),
    project: asanaString(input, "projectId", "projectGid", "project"),
    section: asanaString(input, "sectionId", "sectionGid", "section"),
    assignee: asanaString(input, "assigneeId", "assigneeGid", "assignee"),
    text: optionalVercelString(input, "text"),
    completed_since: optionalVercelString(input, "completedSince"),
    modified_since: optionalVercelString(input, "modifiedSince"),
    archived: optionalVercelBoolean(input, "archived"),
    completed: optionalVercelBoolean(input, "completed"),
    opt_fields: optionalVercelString(input, "optFields"),
  });
}

function callAsana(
  client: AsanaSdkClient,
  resource: keyof AsanaSdkClient,
  method: string,
  ...arguments_: readonly unknown[]
): Promise<unknown> {
  const operation = client[resource][method];
  if (typeof operation !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return operation(...arguments_);
}

/** All pinned Asana actions use Asana's official generated Node SDK. */
export function createAsanaProviderSdk(
  config: AsanaProviderSdkConfig,
): IntegrationProviderSdk {
  const clientFactory = config.clientFactory ?? createAsanaClient;
  return {
    integrationId: "asana",
    operationIds: ASANA_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "asana" ||
        invocation.reference.integrationId !== "asana"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      if (!ASANA_OPERATION_IDS.includes(invocation.operationId)) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const input = invocation.input;
          const client = clientFactory(credential.accessToken);
          let output: unknown;
          switch (invocation.operationId) {
            case "asana:get-task": {
              const taskId = asanaString(input, "taskId", "taskGid");
              output = taskId
                ? await callAsana(
                    client,
                    "tasks",
                    "getTask",
                    taskId,
                    asanaOptions(input),
                  )
                : await callAsana(
                    client,
                    "tasks",
                    "getTasks",
                    asanaOptions(input),
                  );
              break;
            }
            case "asana:create-task":
              output = await callAsana(client, "tasks", "createTask", {
                data: asanaData(input),
              });
              break;
            case "asana:update-task":
              output = await callAsana(
                client,
                "tasks",
                "updateTask",
                { data: asanaData(input) },
                requiredAsanaString(input, "taskId", "taskGid"),
              );
              break;
            case "asana:get-projects":
              output = await callAsana(
                client,
                "projects",
                "getProjects",
                asanaOptions(input),
              );
              break;
            case "asana:search-tasks":
              output = await callAsana(
                client,
                "tasks",
                "searchTasksForWorkspace",
                requiredAsanaString(input, "workspaceId", "workspaceGid"),
                asanaOptions(input),
              );
              break;
            case "asana:add-comment":
              output = await callAsana(
                client,
                "stories",
                "createStoryForTask",
                {
                  data: {
                    text: requiredVercelString(input, "text"),
                  },
                },
                requiredAsanaString(input, "taskId", "taskGid"),
              );
              break;
            case "asana:create-subtask":
              output = await callAsana(
                client,
                "tasks",
                "createSubtaskForTask",
                { data: asanaData(input) },
                requiredAsanaString(input, "taskId", "taskGid"),
              );
              break;
            case "asana:delete-task":
              output = await callAsana(
                client,
                "tasks",
                "deleteTask",
                requiredAsanaString(input, "taskId", "taskGid"),
              );
              break;
            case "asana:add-followers": {
              const followers = asanaStringArray(input, "followers");
              if (!followers?.length) {
                throw new IntegrationProviderSdkError(
                  "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
                );
              }
              output = await callAsana(
                client,
                "tasks",
                "addFollowersForTask",
                { data: { followers } },
                requiredAsanaString(input, "taskId", "taskGid"),
              );
              break;
            }
            case "asana:create-project":
              output = await callAsana(client, "projects", "createProject", {
                data: asanaData(input),
              });
              break;
            case "asana:get-project":
              output = await callAsana(
                client,
                "projects",
                "getProject",
                requiredAsanaString(input, "projectId", "projectGid"),
                asanaOptions(input),
              );
              break;
            case "asana:list-workspaces":
              output = await callAsana(
                client,
                "workspaces",
                "getWorkspaces",
                asanaOptions(input),
              );
              break;
            case "asana:create-section":
              output = await callAsana(
                client,
                "sections",
                "createSectionForProject",
                requiredAsanaString(input, "projectId", "projectGid"),
                { body: { data: asanaData(input) } },
              );
              break;
            case "asana:list-sections":
              output = await callAsana(
                client,
                "sections",
                "getSectionsForProject",
                requiredAsanaString(input, "projectId", "projectGid"),
                asanaOptions(input),
              );
              break;
            default:
              throw new IntegrationProviderSdkError(
                "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
              );
          }
          return { operationId: invocation.operationId, output };
        },
      );
    },
  };
}

export function getAsanaProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  return {
    operations: ASANA_OPERATION_IDS.length,
    operationIds: ASANA_OPERATION_IDS,
  };
}

type DropboxSdkClient = Record<
  string,
  (input?: Record<string, unknown>) => Promise<unknown>
>;
type DropboxClientFactory = (accessToken: string) => DropboxSdkClient;

export interface DropboxProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  /** Defaults to 25 MiB; package payloads stay well below Dropbox's 150 MiB single-upload limit. */
  maxFileBytes?: number;
  clientFactory?: DropboxClientFactory;
}

function createDropboxClient(accessToken: string): DropboxSdkClient {
  return new Dropbox({ accessToken }) as unknown as DropboxSdkClient;
}

const DROPBOX_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "dropbox",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

function dropboxPath(
  input: Readonly<Record<string, unknown>>,
  ...fields: readonly string[]
): string {
  for (const field of fields) {
    const value = input[field];
    if (value === "") return "";
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  throw new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

function optionalDropboxObject(
  input: Readonly<Record<string, unknown>>,
  field: string,
): Record<string, unknown> {
  const value = optionalVercelJson(input, field);
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value as Record<string, unknown>;
}

function dropboxFile(
  input: Readonly<Record<string, unknown>>,
  maximumBytes: number,
): Buffer {
  const raw = input.file;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const encoded = optionalVercelString(
    raw as Record<string, unknown>,
    "base64",
    "data",
    "content",
  );
  if (!encoded || !/^[A-Za-z0-9+/_=-]*$/u.test(encoded)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const data = Buffer.from(encoded, "base64");
  if (!data.byteLength || data.byteLength > maximumBytes) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return data;
}

function dropboxArgs(
  input: Readonly<Record<string, unknown>>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  // `options` is constrained to an object and merged only with the package's
  // chosen SDK method. It can never select a host, route, credential, or a
  // method outside the explicit action mapping below.
  return { ...optionalDropboxObject(input, "options"), ...defaults };
}

interface DropboxDownloadResponse {
  result?: {
    fileBinary?: Uint8Array;
    fileBlob?: { arrayBuffer(): Promise<ArrayBuffer>; type?: string };
    [key: string]: unknown;
  };
}

async function dropboxOutput(
  value: unknown,
  maximumBytes: number,
): Promise<unknown> {
  if (!value || typeof value !== "object" || !("result" in value)) {
    return value;
  }
  const result = (value as DropboxDownloadResponse).result;
  if (!result || typeof result !== "object") return result;
  const { fileBinary, fileBlob, ...metadata } = result;
  if (!fileBinary && !fileBlob) return result;
  const bytes = fileBinary
    ? Buffer.from(fileBinary)
    : Buffer.from(await fileBlob!.arrayBuffer());
  if (bytes.byteLength > maximumBytes) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  const data = bytes.toString("base64");
  return {
    ...metadata,
    file: {
      data,
      encoding: "base64",
      mimeType: fileBlob?.type || "application/octet-stream",
      byteLength: bytes.byteLength,
    },
  };
}

function callDropbox(
  client: DropboxSdkClient,
  method: string,
  input?: Record<string, unknown>,
): Promise<unknown> {
  const operation = client[method];
  if (typeof operation !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return operation(input);
}

/** All pinned Dropbox actions use Dropbox's official JavaScript SDK. */
export function createDropboxProviderSdk(
  config: DropboxProviderSdkConfig,
): IntegrationProviderSdk {
  const maximumFileBytes = config.maxFileBytes ?? 25 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maximumFileBytes) ||
    maximumFileBytes < 1_024 ||
    maximumFileBytes > 100 * 1024 * 1024
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const clientFactory = config.clientFactory ?? createDropboxClient;
  return {
    integrationId: "dropbox",
    operationIds: DROPBOX_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "dropbox" ||
        invocation.reference.integrationId !== "dropbox"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      if (!DROPBOX_OPERATION_IDS.includes(invocation.operationId)) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const input = invocation.input;
          const client = clientFactory(credential.accessToken);
          let output: unknown;
          switch (invocation.operationId) {
            case "dropbox:upload-file":
              output = await callDropbox(
                client,
                "filesUpload",
                dropboxArgs(input, {
                  path: dropboxPath(input, "path", "destinationPath"),
                  contents: dropboxFile(input, maximumFileBytes),
                }),
              );
              break;
            case "dropbox:download-file":
              output = await callDropbox(
                client,
                "filesDownload",
                dropboxArgs(input, { path: dropboxPath(input, "path") }),
              );
              break;
            case "dropbox:list-folder":
              output = await callDropbox(
                client,
                "filesListFolder",
                dropboxArgs(input, { path: dropboxPath(input, "path") }),
              );
              break;
            case "dropbox:create-folder":
              output = await callDropbox(
                client,
                "filesCreateFolderV2",
                dropboxArgs(input, { path: dropboxPath(input, "path") }),
              );
              break;
            case "dropbox:delete-file-folder":
              output = await callDropbox(
                client,
                "filesDeleteV2",
                dropboxArgs(input, { path: dropboxPath(input, "path") }),
              );
              break;
            case "dropbox:copy-file-folder":
              output = await callDropbox(
                client,
                "filesCopyV2",
                dropboxArgs(input, {
                  from_path: dropboxPath(input, "fromPath"),
                  to_path: dropboxPath(input, "toPath"),
                }),
              );
              break;
            case "dropbox:move-file-folder":
              output = await callDropbox(
                client,
                "filesMoveV2",
                dropboxArgs(input, {
                  from_path: dropboxPath(input, "fromPath"),
                  to_path: dropboxPath(input, "toPath"),
                }),
              );
              break;
            case "dropbox:get-metadata":
              output = await callDropbox(
                client,
                "filesGetMetadata",
                dropboxArgs(input, { path: dropboxPath(input, "path") }),
              );
              break;
            case "dropbox:create-shared-link":
              output = await callDropbox(
                client,
                "sharingCreateSharedLinkWithSettings",
                dropboxArgs(input, {
                  path: dropboxPath(input, "path"),
                  settings: optionalDropboxObject(input, "settings"),
                }),
              );
              break;
            case "dropbox:list-shared-links": {
              const path = optionalVercelString(input, "path");
              output = await callDropbox(
                client,
                "sharingListSharedLinks",
                dropboxArgs(input, {
                  ...(path ? { path } : {}),
                }),
              );
              break;
            }
            case "dropbox:search-files":
              output = await callDropbox(
                client,
                "filesSearchV2",
                dropboxArgs(input, {
                  query: requiredVercelString(input, "query"),
                }),
              );
              break;
            case "dropbox:list-revisions":
              output = await callDropbox(
                client,
                "filesListRevisions",
                dropboxArgs(input, { path: dropboxPath(input, "path") }),
              );
              break;
            case "dropbox:restore-file":
              output = await callDropbox(
                client,
                "filesRestore",
                dropboxArgs(input, {
                  path: dropboxPath(input, "path"),
                  rev: requiredVercelString(input, "rev", "revision"),
                }),
              );
              break;
            default:
              throw new IntegrationProviderSdkError(
                "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
              );
          }
          return {
            operationId: invocation.operationId,
            output: await dropboxOutput(output, maximumFileBytes),
          };
        },
      );
    },
  };
}

export function getDropboxProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  return {
    operations: DROPBOX_OPERATION_IDS.length,
    operationIds: DROPBOX_OPERATION_IDS,
  };
}

type MailgunSdkClient = Record<string, unknown>;
type MailgunClientFactory = (
  apiKey: string,
  apiUrl: string,
) => MailgunSdkClient;

export interface MailgunProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  /** Either Mailgun's US or EU API origin; action input cannot override it. */
  apiUrl?: "https://api.mailgun.net" | "https://api.eu.mailgun.net";
  clientFactory?: MailgunClientFactory;
}

function createMailgunClient(apiKey: string, apiUrl: string): MailgunSdkClient {
  return new Mailgun(FormData).client({
    username: "api",
    key: apiKey,
    url: apiUrl,
  }) as unknown as MailgunSdkClient;
}

const MAILGUN_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "mailgun",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface MailgunSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function mailgunRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): MailgunSdkRequest {
  return { path, arguments: arguments_ };
}

function mailgunRecipients(
  input: Readonly<Record<string, unknown>>,
  field: string,
): string[] | undefined {
  const value = optionalVercelString(input, field);
  return value
    ?.split(",")
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

function mailgunMessage(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const text = optionalVercelString(input, "text");
  const html = optionalVercelString(input, "html");
  if (!text && !html) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return definedVercelFields({
    from: requiredVercelString(input, "from"),
    to: mailgunRecipients(input, "to") ?? requiredVercelString(input, "to"),
    subject: requiredVercelString(input, "subject"),
    text,
    html,
    cc: mailgunRecipients(input, "cc"),
    bcc: mailgunRecipients(input, "bcc"),
    "o:tag": mailgunRecipients(input, "tags"),
  });
}

const MAILGUN_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => MailgunSdkRequest
  >
> = {
  "mailgun:send-message": (input) =>
    mailgunRequest(
      ["messages", "create"],
      requiredVercelString(input, "domain"),
      mailgunMessage(input),
    ),
  "mailgun:get-message": (input) =>
    mailgunRequest(
      ["messages", "retrieveStoredEmail"],
      requiredVercelString(input, "domain"),
      requiredVercelString(input, "messageKey"),
    ),
  "mailgun:list-messages": (input) =>
    mailgunRequest(
      ["events", "get"],
      requiredVercelString(input, "domain"),
      definedVercelFields({
        event: mailgunRecipients(input, "event"),
        limit: optionalVercelNumber(input, "limit"),
      }),
    ),
  "mailgun:create-mailing-list": (input) =>
    mailgunRequest(
      ["lists", "create"],
      definedVercelFields({
        address: requiredVercelString(input, "address"),
        name: optionalVercelString(input, "name"),
        description: optionalVercelString(input, "description"),
        access_level: optionalVercelString(input, "accessLevel"),
      }),
    ),
  "mailgun:get-mailing-list": (input) =>
    mailgunRequest(["lists", "get"], requiredVercelString(input, "address")),
  "mailgun:add-list-member": (input) =>
    mailgunRequest(
      ["lists", "members", "createMember"],
      requiredVercelString(input, "listAddress"),
      definedVercelFields({
        address: requiredVercelString(input, "address"),
        name: optionalVercelString(input, "name"),
        vars: optionalVercelJson(input, "vars"),
        subscribed: optionalVercelBoolean(input, "subscribed"),
      }),
    ),
  "mailgun:list-domains": () => mailgunRequest(["domains", "list"]),
  "mailgun:get-domain": (input) =>
    mailgunRequest(["domains", "get"], requiredVercelString(input, "domain")),
};

function assertMailgunOperationCoverage(): void {
  const expected = new Set(MAILGUN_OPERATION_IDS);
  const implemented = Object.keys(MAILGUN_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Mailgun provider SDK operation coverage is incomplete.");
  }
}

/** All pinned Mailgun actions use Mailgun's official Node SDK. */
export function createMailgunProviderSdk(
  config: MailgunProviderSdkConfig,
): IntegrationProviderSdk {
  assertMailgunOperationCoverage();
  const apiUrl = config.apiUrl ?? "https://api.mailgun.net";
  if (
    apiUrl !== "https://api.mailgun.net" &&
    apiUrl !== "https://api.eu.mailgun.net"
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const clientFactory = config.clientFactory ?? createMailgunClient;
  return {
    integrationId: "mailgun",
    operationIds: MAILGUN_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "mailgun" ||
        invocation.reference.integrationId !== "mailgun"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = MAILGUN_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await invokeSquareMethod(
            clientFactory(credential.apiKey, apiUrl),
            requestFactory(invocation.input),
          ),
        }),
      );
    },
  };
}

export function getMailgunProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertMailgunOperationCoverage();
  return {
    operations: MAILGUN_OPERATION_IDS.length,
    operationIds: MAILGUN_OPERATION_IDS,
  };
}

type IntercomSdkClient = Record<string, unknown>;
type IntercomClientFactory = (apiKey: string) => IntercomSdkClient;

export interface IntercomProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: IntercomClientFactory;
}

function createIntercomClient(apiKey: string): IntercomSdkClient {
  return new IntercomClient({ token: apiKey }) as unknown as IntercomSdkClient;
}

const INTERCOM_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "intercom",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface IntercomSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function intercomRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): IntercomSdkRequest {
  return { path, arguments: arguments_ };
}

function intercomFields(
  input: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): Record<string, unknown> {
  return definedVercelFields(
    Object.fromEntries(fields.map((field) => [field, input[field]])),
  );
}

function intercomJsonObject(
  input: Readonly<Record<string, unknown>>,
  field: string,
): Record<string, unknown> | undefined {
  const value = optionalVercelJson(input, field);
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value as Record<string, unknown>;
}

function intercomRequiredJsonArrayOrId(
  input: Readonly<Record<string, unknown>>,
  field: string,
): unknown[] {
  const value = requiredVercelString(input, field);
  const parsed = optionalVercelJson({ [field]: value }, field);
  if (Array.isArray(parsed)) return parsed;
  return [{ id: value }];
}

function intercomSearchRequest(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const query = intercomJsonObject(input, "query");
  if (!query) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const pagination = intercomFields(input, ["per_page", "starting_after"]);
  return definedVercelFields({
    query,
    pagination: Object.keys(pagination).length ? pagination : undefined,
  });
}

function intercomConversationPart(
  input: Readonly<Record<string, unknown>>,
  messageType: string,
): Record<string, unknown> {
  const body = intercomFields(input, [
    "type",
    "admin_id",
    "assignee_id",
    "body",
    "snoozed_until",
    "created_at",
  ]);
  const attachmentUrls = optionalVercelCsv(input, "attachment_urls");
  return definedVercelFields({
    message_type: messageType,
    type: body.type ?? "admin",
    ...body,
    attachment_urls: attachmentUrls,
  });
}

const INTERCOM_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => IntercomSdkRequest
  >
> = {
  "intercom:create-contact": (input) =>
    intercomRequest(
      ["contacts", "create"],
      definedVercelFields({
        ...intercomFields(input, [
          "role",
          "email",
          "external_id",
          "phone",
          "name",
          "avatar",
          "signed_up_at",
          "last_seen_at",
          "owner_id",
          "unsubscribed_from_emails",
          "company_id",
        ]),
        custom_attributes: intercomJsonObject(input, "custom_attributes"),
      }),
    ),
  "intercom:get-contact": (input) =>
    intercomRequest(["contacts", "find"], {
      contact_id: requiredVercelString(input, "contactId", "contact_id"),
    }),
  "intercom:update-contact": (input) =>
    intercomRequest(
      ["contacts", "update"],
      definedVercelFields({
        contact_id: requiredVercelString(input, "contactId", "contact_id"),
        ...intercomFields(input, [
          "role",
          "email",
          "external_id",
          "phone",
          "name",
          "avatar",
          "signed_up_at",
          "last_seen_at",
          "owner_id",
          "unsubscribed_from_emails",
          "company_id",
        ]),
        custom_attributes: intercomJsonObject(input, "custom_attributes"),
      }),
    ),
  "intercom:list-contacts": (input) =>
    intercomRequest(
      ["contacts", "list"],
      intercomFields(input, ["page", "per_page", "starting_after"]),
    ),
  "intercom:search-contacts": (input) =>
    intercomRequest(["contacts", "search"], intercomSearchRequest(input)),
  "intercom:delete-contact": (input) =>
    intercomRequest(["contacts", "delete"], {
      contact_id: requiredVercelString(input, "contactId", "contact_id"),
    }),
  "intercom:create-company": (input) =>
    intercomRequest(
      ["companies", "createOrUpdate"],
      definedVercelFields({
        ...intercomFields(input, [
          "company_id",
          "name",
          "website",
          "plan",
          "size",
          "industry",
          "monthly_spend",
          "remote_created_at",
        ]),
        custom_attributes: intercomJsonObject(input, "custom_attributes"),
      }),
    ),
  "intercom:get-company": (input) =>
    intercomRequest(["companies", "find"], {
      company_id: requiredVercelString(input, "companyId", "company_id"),
    }),
  "intercom:list-companies": (input) =>
    intercomRequest(
      ["companies", "list"],
      intercomFields(input, ["page", "per_page", "order"]),
    ),
  "intercom:get-conversation": (input) =>
    intercomRequest(
      ["conversations", "find"],
      definedVercelFields({
        conversation_id: requiredVercelString(
          input,
          "conversationId",
          "conversation_id",
        ),
        ...intercomFields(input, ["display_as", "include_translations"]),
      }),
    ),
  "intercom:list-conversations": (input) =>
    intercomRequest(
      ["conversations", "list"],
      intercomFields(input, ["per_page", "starting_after"]),
    ),
  "intercom:reply-to-conversation": (input) =>
    intercomRequest(["conversations", "reply"], {
      conversation_id: requiredVercelString(
        input,
        "conversationId",
        "conversation_id",
      ),
      body: intercomConversationPart(
        input,
        requiredVercelString(input, "message_type"),
      ),
    }),
  "intercom:search-conversations": (input) =>
    intercomRequest(["conversations", "search"], intercomSearchRequest(input)),
  "intercom:create-ticket": (input) =>
    intercomRequest(
      ["tickets", "create"],
      definedVercelFields({
        ticket_type_id: requiredVercelString(input, "ticket_type_id"),
        contacts: intercomRequiredJsonArrayOrId(input, "contacts"),
        ticket_attributes: intercomJsonObject(input, "ticket_attributes"),
        ...intercomFields(input, [
          "company_id",
          "created_at",
          "conversation_to_link_id",
        ]),
        skip_notifications: optionalVercelBoolean(
          input,
          "disable_notifications",
        ),
      }),
    ),
  "intercom:get-ticket": (input) =>
    intercomRequest(["tickets", "get"], {
      ticket_id: requiredVercelString(input, "ticketId", "ticket_id"),
    }),
  "intercom:update-ticket": (input) =>
    intercomRequest(
      ["tickets", "update"],
      definedVercelFields({
        ticket_id: requiredVercelString(input, "ticketId", "ticket_id"),
        ...intercomFields(input, [
          "open",
          "is_shared",
          "snoozed_until",
          "admin_id",
          "assignee_id",
        ]),
        ticket_attributes: intercomJsonObject(input, "ticket_attributes"),
      }),
    ),
  "intercom:create-message": (input) =>
    intercomRequest(
      ["messages", "create"],
      definedVercelFields({
        message_type: requiredVercelString(input, "message_type"),
        template: optionalVercelString(input, "template"),
        subject: optionalVercelString(input, "subject"),
        body: requiredVercelString(input, "body"),
        from: {
          type: requiredVercelString(input, "from_type"),
          id: requiredVercelString(input, "from_id"),
        },
        to: {
          type: requiredVercelString(input, "to_type"),
          id: requiredVercelString(input, "to_id"),
        },
        created_at: optionalVercelNumber(input, "created_at"),
      }),
    ),
  "intercom:list-admins": () => intercomRequest(["admins", "list"]),
  "intercom:close-conversation": (input) =>
    intercomRequest(["conversations", "reply"], {
      conversation_id: requiredVercelString(
        input,
        "conversationId",
        "conversation_id",
      ),
      body: intercomConversationPart(input, "close"),
    }),
  "intercom:open-conversation": (input) =>
    intercomRequest(["conversations", "reply"], {
      conversation_id: requiredVercelString(
        input,
        "conversationId",
        "conversation_id",
      ),
      body: intercomConversationPart(input, "open"),
    }),
  "intercom:snooze-conversation": (input) =>
    intercomRequest(["conversations", "reply"], {
      conversation_id: requiredVercelString(
        input,
        "conversationId",
        "conversation_id",
      ),
      body: intercomConversationPart(input, "snoozed"),
    }),
  "intercom:assign-conversation": (input) =>
    intercomRequest(["conversations", "reply"], {
      conversation_id: requiredVercelString(
        input,
        "conversationId",
        "conversation_id",
      ),
      body: intercomConversationPart(input, "assignment"),
    }),
  "intercom:list-tags": () => intercomRequest(["tags", "list"]),
  "intercom:create-tag": (input) =>
    intercomRequest(
      ["tags", "create"],
      definedVercelFields({
        name: requiredVercelString(input, "name"),
        id: optionalVercelString(input, "id"),
      }),
    ),
  "intercom:tag-contact": (input) =>
    intercomRequest(["tags", "tagContact"], {
      contact_id: requiredVercelString(input, "contactId", "contact_id"),
      id: requiredVercelString(input, "tagId", "tag_id"),
    }),
  "intercom:untag-contact": (input) =>
    intercomRequest(["tags", "untagContact"], {
      contact_id: requiredVercelString(input, "contactId", "contact_id"),
      tag_id: requiredVercelString(input, "tagId", "tag_id"),
    }),
  "intercom:tag-conversation": (input) =>
    intercomRequest(["tags", "tagConversation"], {
      conversation_id: requiredVercelString(
        input,
        "conversationId",
        "conversation_id",
      ),
      id: requiredVercelString(input, "tagId", "tag_id"),
      admin_id: requiredVercelString(input, "admin_id"),
    }),
  "intercom:create-note": (input) =>
    intercomRequest(
      ["notes", "create"],
      definedVercelFields({
        contact_id: requiredVercelString(input, "contactId", "contact_id"),
        body: requiredVercelString(input, "body"),
        admin_id: optionalVercelString(input, "admin_id"),
      }),
    ),
  "intercom:create-event": (input) =>
    intercomRequest(
      ["events", "create"],
      definedVercelFields({
        event_name: requiredVercelString(input, "event_name"),
        created_at:
          optionalVercelNumber(input, "created_at") ??
          Math.floor(Date.now() / 1_000),
        ...intercomFields(input, ["user_id", "email", "id"]),
        metadata: intercomJsonObject(input, "metadata"),
      }),
    ),
  "intercom:attach-contact-to-company": (input) =>
    intercomRequest(["companies", "attachContact"], {
      contact_id: requiredVercelString(input, "contactId", "contact_id"),
      id: requiredVercelString(input, "companyId", "company_id"),
    }),
  "intercom:detach-contact-from-company": (input) =>
    intercomRequest(["companies", "detachContact"], {
      contact_id: requiredVercelString(input, "contactId", "contact_id"),
      company_id: requiredVercelString(input, "companyId", "company_id"),
    }),
};

function assertIntercomOperationCoverage(): void {
  const expected = new Set(INTERCOM_OPERATION_IDS);
  const implemented = Object.keys(INTERCOM_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Intercom provider SDK operation coverage is incomplete.");
  }
}

/**
 * All pinned Intercom actions execute through Intercom's official SDK. Product
 * code never sees or transports the API token; the SDK is constructed only
 * inside the package's encrypted API-key runtime.
 */
export function createIntercomProviderSdk(
  config: IntercomProviderSdkConfig,
): IntegrationProviderSdk {
  assertIntercomOperationCoverage();
  const clientFactory = config.clientFactory ?? createIntercomClient;
  return {
    integrationId: "intercom",
    operationIds: INTERCOM_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "intercom" ||
        invocation.reference.integrationId !== "intercom"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        INTERCOM_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await invokeSquareMethod(
            clientFactory(credential.apiKey),
            requestFactory(invocation.input),
          ),
        }),
      );
    },
  };
}

export function getIntercomProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertIntercomOperationCoverage();
  return {
    operations: INTERCOM_OPERATION_IDS.length,
    operationIds: INTERCOM_OPERATION_IDS,
  };
}

interface LinearSdkResource {
  [method: string]: unknown;
}

interface LinearSdkClient extends LinearSdkResource {
  readonly viewer: Promise<unknown>;
  readonly client: {
    rawRequest(
      query: string,
      variables?: Record<string, unknown>,
    ): Promise<unknown>;
  };
}

type LinearClientFactory = (accessToken: string) => LinearSdkClient;

export interface LinearProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: LinearClientFactory;
}

function createLinearClient(accessToken: string): LinearSdkClient {
  return new LinearClient({ accessToken }) as unknown as LinearSdkClient;
}

const LINEAR_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "linear",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

const LINEAR_CREDENTIAL_PARAMETER_NAMES = new Set([
  "access_token",
  "api_key",
  "authorization",
  "credential",
  "headers",
  "oauth_credential",
  "refresh_token",
  "secret",
  "token",
]);

function linearOperationInput(
  input: Readonly<Record<string, unknown>>,
  excluded: readonly string[] = [],
): Record<string, unknown> {
  const excludedNames = new Set(excluded);
  const result: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(input)) {
    const normalizedName = toSnakeCase(name);
    if (
      excludedNames.has(name) ||
      LINEAR_CREDENTIAL_PARAMETER_NAMES.has(normalizedName) ||
      value === undefined ||
      value === ""
    ) {
      continue;
    }
    result[name] = value;
  }
  return result;
}

function requiredLinearString(
  input: Readonly<Record<string, unknown>>,
  name: string,
): string {
  const value = input[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value.trim();
}

function optionalLinearString(
  input: Readonly<Record<string, unknown>>,
  name: string,
): string | undefined {
  const value = input[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalLinearNumber(
  input: Readonly<Record<string, unknown>>,
  name: string,
): number | undefined {
  const value = input[name];
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function linearPageVariables(
  input: Readonly<Record<string, unknown>>,
  options: { includeArchived?: boolean } = {},
): Record<string, unknown> {
  const first = optionalLinearNumber(input, "first");
  const after = optionalLinearString(input, "after");
  return {
    first: first === undefined ? 50 : Math.max(1, Math.min(250, first)),
    ...(after ? { after } : {}),
    ...(options.includeArchived
      ? { includeArchived: input.includeArchived === true }
      : {}),
  };
}

function linearTeamFilter(
  input: Readonly<Record<string, unknown>>,
  name = "teamId",
): Record<string, unknown> | undefined {
  const id = optionalLinearString(input, name);
  return id ? { team: { id: { eq: id } } } : undefined;
}

async function invokeLinearMethod(
  client: LinearSdkResource,
  method: string,
  ...arguments_: unknown[]
): Promise<unknown> {
  const candidate = client[method];
  if (typeof candidate !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return candidate.apply(client, arguments_);
}

async function linearResource(
  client: LinearSdkClient,
  method: string,
  id: string,
): Promise<LinearSdkResource> {
  const resource = await invokeLinearMethod(client, method, id);
  if (!resource || typeof resource !== "object") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return resource as LinearSdkResource;
}

async function invokeLinearResourceMethod(
  resource: LinearSdkResource,
  method: string,
  ...arguments_: unknown[]
): Promise<unknown> {
  return invokeLinearMethod(resource, method, ...arguments_);
}

async function linearRawMutation(
  client: LinearSdkClient,
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  const response = await client.client.rawRequest(query, variables);
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data: unknown }).data;
  }
  return response;
}

type LinearOperationHandler = (
  client: LinearSdkClient,
  input: Readonly<Record<string, unknown>>,
) => Promise<unknown>;

function linearIssueFilter(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> | undefined {
  const filter: Record<string, unknown> = {};
  const teamId = optionalLinearString(input, "teamId");
  const projectId = optionalLinearString(input, "projectId");
  const assigneeId = optionalLinearString(input, "assigneeId");
  const stateId = optionalLinearString(input, "stateId");
  const priority = optionalLinearNumber(input, "priority");
  const createdAfter = optionalLinearString(input, "createdAfter");
  const updatedAfter = optionalLinearString(input, "updatedAfter");
  const labelIds = Array.isArray(input.labelIds)
    ? input.labelIds.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  if (teamId) filter.team = { id: { eq: teamId } };
  if (projectId) filter.project = { id: { eq: projectId } };
  if (assigneeId) filter.assignee = { id: { eq: assigneeId } };
  if (stateId) filter.state = { id: { eq: stateId } };
  if (priority !== undefined) filter.priority = { eq: priority };
  if (labelIds.length > 0) filter.labels = { some: { id: { in: labelIds } } };
  if (createdAfter) filter.createdAt = { gte: createdAfter };
  if (updatedAfter) filter.updatedAt = { gte: updatedAfter };
  return Object.keys(filter).length > 0 ? filter : undefined;
}

async function linearUpdateIssue(
  client: LinearSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const issueId = requiredLinearString(input, "issueId");
  const update = linearOperationInput(input, [
    "issueId",
    "addedLabelIds",
    "removedLabelIds",
  ]);
  let output: unknown = undefined;
  if (Object.keys(update).length > 0) {
    output = await invokeLinearMethod(client, "updateIssue", issueId, update);
  }
  for (const labelId of Array.isArray(input.addedLabelIds)
    ? input.addedLabelIds
    : []) {
    if (typeof labelId === "string" && labelId) {
      output = await invokeLinearMethod(
        client,
        "issueAddLabel",
        issueId,
        labelId,
      );
    }
  }
  for (const labelId of Array.isArray(input.removedLabelIds)
    ? input.removedLabelIds
    : []) {
    if (typeof labelId === "string" && labelId) {
      output = await invokeLinearMethod(
        client,
        "issueRemoveLabel",
        issueId,
        labelId,
      );
    }
  }
  if (output === undefined) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return output;
}

async function linearCreateAttachment(
  client: LinearSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const file = input.file;
  const fileUrl =
    file &&
    typeof file === "object" &&
    typeof (file as { url?: unknown }).url === "string"
      ? (file as { url: string }).url
      : undefined;
  const url = optionalLinearString(input, "url") ?? fileUrl;
  if (!url) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return invokeLinearMethod(
    client,
    "createAttachment",
    linearOperationInput({ ...input, url }, ["file"]),
  );
}

async function linearListProjects(
  client: LinearSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const result = await invokeLinearMethod(
    client,
    "projects",
    linearPageVariables(input, { includeArchived: true }),
  );
  const teamId = optionalLinearString(input, "teamId");
  if (!teamId || !result || typeof result !== "object") {
    return result;
  }
  const nodes = (result as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) {
    return result;
  }
  const filtered = await Promise.all(
    nodes.map(async (project) => {
      if (!project || typeof project !== "object") return undefined;
      const teams = await invokeLinearResourceMethod(
        project as LinearSdkResource,
        "teams",
      );
      const teamNodes =
        teams &&
        typeof teams === "object" &&
        Array.isArray((teams as { nodes?: unknown }).nodes)
          ? ((teams as { nodes: unknown[] }).nodes ?? [])
          : [];
      return teamNodes.some(
        (team) =>
          team &&
          typeof team === "object" &&
          (team as { id?: unknown }).id === teamId,
      )
        ? project
        : undefined;
    }),
  );
  return {
    ...(result as Record<string, unknown>),
    nodes: filtered.filter(Boolean),
  };
}

const LINEAR_OPERATION_HANDLERS: Readonly<
  Record<string, LinearOperationHandler>
> = {
  "linear:read-issues": (client, input) =>
    invokeLinearMethod(client, "issues", {
      ...linearPageVariables(input, { includeArchived: true }),
      ...(linearIssueFilter(input) ? { filter: linearIssueFilter(input) } : {}),
      ...(optionalLinearString(input, "orderBy")
        ? { orderBy: optionalLinearString(input, "orderBy") }
        : {}),
    }),
  "linear:get-issue": (client, input) =>
    invokeLinearMethod(client, "issue", requiredLinearString(input, "issueId")),
  "linear:create-issue": (client, input) =>
    invokeLinearMethod(client, "createIssue", linearOperationInput(input)),
  "linear:update-issue": linearUpdateIssue,
  "linear:archive-issue": (client, input) =>
    invokeLinearMethod(
      client,
      "archiveIssue",
      requiredLinearString(input, "issueId"),
    ),
  "linear:unarchive-issue": (client, input) =>
    invokeLinearMethod(
      client,
      "unarchiveIssue",
      requiredLinearString(input, "issueId"),
    ),
  "linear:delete-issue": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteIssue",
      requiredLinearString(input, "issueId"),
    ),
  "linear:search-issues": (client, input) => {
    const teamFilter = linearTeamFilter(input);
    return invokeLinearMethod(client, "issueSearch", {
      ...linearPageVariables(input, { includeArchived: true }),
      term: requiredLinearString(input, "query"),
      ...(teamFilter ? { filter: teamFilter } : {}),
    });
  },
  "linear:add-label-to-issue": (client, input) =>
    invokeLinearMethod(
      client,
      "issueAddLabel",
      requiredLinearString(input, "issueId"),
      requiredLinearString(input, "labelId"),
    ),
  "linear:remove-label-from-issue": (client, input) =>
    invokeLinearMethod(
      client,
      "issueRemoveLabel",
      requiredLinearString(input, "issueId"),
      requiredLinearString(input, "labelId"),
    ),
  "linear:create-comment": (client, input) =>
    invokeLinearMethod(client, "createComment", linearOperationInput(input)),
  "linear:update-comment": (client, input) =>
    invokeLinearMethod(
      client,
      "updateComment",
      requiredLinearString(input, "commentId"),
      linearOperationInput(input, ["commentId"]),
    ),
  "linear:delete-comment": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteComment",
      requiredLinearString(input, "commentId"),
    ),
  "linear:list-comments": async (client, input) =>
    invokeLinearResourceMethod(
      await linearResource(
        client,
        "issue",
        requiredLinearString(input, "issueId"),
      ),
      "comments",
      linearPageVariables(input),
    ),
  "linear:list-projects": linearListProjects,
  "linear:get-project": (client, input) =>
    invokeLinearMethod(
      client,
      "project",
      requiredLinearString(input, "projectId"),
    ),
  "linear:create-project": (client, input) =>
    invokeLinearMethod(client, "createProject", linearOperationInput(input)),
  "linear:update-project": (client, input) =>
    invokeLinearMethod(
      client,
      "updateProject",
      requiredLinearString(input, "projectId"),
      linearOperationInput(input, ["projectId"]),
    ),
  "linear:archive-project": (client, input) =>
    invokeLinearMethod(
      client,
      "archiveProject",
      requiredLinearString(input, "projectId"),
    ),
  "linear:list-users": (client, input) =>
    invokeLinearMethod(client, "users", {
      ...linearPageVariables(input),
      includeDisabled: input.includeDisabled === true,
    }),
  "linear:list-teams": (client, input) =>
    invokeLinearMethod(client, "teams", linearPageVariables(input)),
  "linear:get-viewer": async (client) => client.viewer,
  "linear:list-labels": (client, input) => {
    const filter = linearTeamFilter(input);
    return invokeLinearMethod(client, "issueLabels", {
      ...linearPageVariables(input),
      ...(filter ? { filter } : {}),
    });
  },
  "linear:create-label": (client, input) =>
    invokeLinearMethod(client, "createIssueLabel", linearOperationInput(input)),
  "linear:update-label": (client, input) =>
    invokeLinearMethod(
      client,
      "updateIssueLabel",
      requiredLinearString(input, "labelId"),
      linearOperationInput(input, ["labelId"]),
    ),
  // The generated SDK currently omits this legacy mutation. Keep the request
  // on the official SDK client rather than exposing a product-owned transport.
  "linear:archive-label": (client, input) =>
    linearRawMutation(
      client,
      "mutation($id: String!) { issueLabelArchive(id: $id) { success } }",
      { id: requiredLinearString(input, "labelId") },
    ),
  "linear:list-workflow-states": (client, input) => {
    const filter = linearTeamFilter(input);
    return invokeLinearMethod(client, "workflowStates", {
      ...linearPageVariables(input),
      ...(filter ? { filter } : {}),
    });
  },
  "linear:create-workflow-state": (client, input) =>
    invokeLinearMethod(
      client,
      "createWorkflowState",
      linearOperationInput(input),
    ),
  "linear:update-workflow-state": (client, input) =>
    invokeLinearMethod(
      client,
      "updateWorkflowState",
      requiredLinearString(input, "stateId"),
      linearOperationInput(input, ["stateId"]),
    ),
  "linear:list-cycles": (client, input) => {
    const filter = linearTeamFilter(input);
    return invokeLinearMethod(client, "cycles", {
      ...linearPageVariables(input),
      ...(filter ? { filter } : {}),
    });
  },
  "linear:get-cycle": (client, input) =>
    invokeLinearMethod(client, "cycle", requiredLinearString(input, "cycleId")),
  "linear:create-cycle": (client, input) =>
    invokeLinearMethod(client, "createCycle", linearOperationInput(input)),
  "linear:get-active-cycle": async (client, input) => {
    const team = await linearResource(
      client,
      "team",
      requiredLinearString(input, "teamId"),
    );
    return team.activeCycle;
  },
  "linear:create-attachment": linearCreateAttachment,
  "linear:list-attachments": async (client, input) =>
    invokeLinearResourceMethod(
      await linearResource(
        client,
        "issue",
        requiredLinearString(input, "issueId"),
      ),
      "attachments",
      linearPageVariables(input),
    ),
  "linear:update-attachment": (client, input) =>
    invokeLinearMethod(
      client,
      "updateAttachment",
      requiredLinearString(input, "attachmentId"),
      linearOperationInput(input, ["attachmentId"]),
    ),
  "linear:delete-attachment": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteAttachment",
      requiredLinearString(input, "attachmentId"),
    ),
  "linear:create-issue-relation": (client, input) =>
    invokeLinearMethod(
      client,
      "createIssueRelation",
      linearOperationInput(input),
    ),
  "linear:list-issue-relations": async (client, input) =>
    invokeLinearResourceMethod(
      await linearResource(
        client,
        "issue",
        requiredLinearString(input, "issueId"),
      ),
      "relations",
      linearPageVariables(input),
    ),
  "linear:delete-issue-relation": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteIssueRelation",
      requiredLinearString(input, "relationId"),
    ),
  "linear:create-favorite": (client, input) =>
    invokeLinearMethod(client, "createFavorite", linearOperationInput(input)),
  "linear:list-favorites": (client, input) =>
    invokeLinearMethod(client, "favorites", linearPageVariables(input)),
  "linear:create-project-update": (client, input) =>
    invokeLinearMethod(
      client,
      "createProjectUpdate",
      linearOperationInput(input),
    ),
  "linear:list-project-updates": async (client, input) =>
    invokeLinearResourceMethod(
      await linearResource(
        client,
        "project",
        requiredLinearString(input, "projectId"),
      ),
      "projectUpdates",
      linearPageVariables(input),
    ),
  "linear:list-notifications": (client, input) =>
    invokeLinearMethod(client, "notifications", linearPageVariables(input)),
  "linear:update-notification": (client, input) =>
    invokeLinearMethod(
      client,
      "updateNotification",
      requiredLinearString(input, "notificationId"),
      {
        readAt:
          input.readAt === undefined ? new Date().toISOString() : input.readAt,
      },
    ),
  "linear:create-customer": (client, input) =>
    invokeLinearMethod(client, "createCustomer", linearOperationInput(input)),
  "linear:list-customers": (client, input) =>
    invokeLinearMethod(
      client,
      "customers",
      linearPageVariables(input, { includeArchived: true }),
    ),
  "linear:create-customer-request": (client, input) =>
    invokeLinearMethod(client, "createCustomerNeed", {
      ...linearOperationInput(input),
      priority: optionalLinearNumber(input, "priority") ?? 0,
    }),
  "linear:update-customer-request": (client, input) =>
    invokeLinearMethod(
      client,
      "updateCustomerNeed",
      requiredLinearString(input, "customerNeedId"),
      linearOperationInput(input, ["customerNeedId"]),
    ),
  "linear:list-customer-requests": (client, input) =>
    invokeLinearMethod(
      client,
      "customerNeeds",
      linearPageVariables(input, { includeArchived: true }),
    ),
  "linear:get-customer": (client, input) =>
    invokeLinearMethod(
      client,
      "customer",
      requiredLinearString(input, "customerId"),
    ),
  "linear:update-customer": (client, input) =>
    invokeLinearMethod(
      client,
      "updateCustomer",
      requiredLinearString(input, "customerId"),
      linearOperationInput(input, ["customerId"]),
    ),
  "linear:delete-customer": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteCustomer",
      requiredLinearString(input, "customerId"),
    ),
  "linear:merge-customers": (client, input) =>
    invokeLinearMethod(
      client,
      "customerMerge",
      requiredLinearString(input, "sourceCustomerId"),
      requiredLinearString(input, "targetCustomerId"),
    ),
  "linear:create-customer-status": (client, input) =>
    invokeLinearMethod(
      client,
      "createCustomerStatus",
      linearOperationInput(input),
    ),
  "linear:update-customer-status": (client, input) =>
    invokeLinearMethod(
      client,
      "updateCustomerStatus",
      requiredLinearString(input, "statusId"),
      linearOperationInput(input, ["statusId"]),
    ),
  "linear:delete-customer-status": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteCustomerStatus",
      requiredLinearString(input, "statusId"),
    ),
  "linear:list-customer-statuses": (client, input) =>
    invokeLinearMethod(client, "customerStatuses", linearPageVariables(input)),
  "linear:create-customer-tier": (client, input) =>
    invokeLinearMethod(
      client,
      "createCustomerTier",
      linearOperationInput(input),
    ),
  "linear:update-customer-tier": (client, input) =>
    invokeLinearMethod(
      client,
      "updateCustomerTier",
      requiredLinearString(input, "tierId"),
      linearOperationInput(input, ["tierId"]),
    ),
  "linear:delete-customer-tier": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteCustomerTier",
      requiredLinearString(input, "tierId"),
    ),
  "linear:list-customer-tiers": (client, input) =>
    invokeLinearMethod(client, "customerTiers", linearPageVariables(input)),
  "linear:delete-project": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteProject",
      requiredLinearString(input, "projectId"),
    ),
  "linear:create-project-label": (client, input) =>
    invokeLinearMethod(
      client,
      "createProjectLabel",
      linearOperationInput(input),
    ),
  "linear:update-project-label": (client, input) =>
    invokeLinearMethod(
      client,
      "updateProjectLabel",
      requiredLinearString(input, "labelId"),
      linearOperationInput(input, ["labelId"]),
    ),
  "linear:delete-project-label": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteProjectLabel",
      requiredLinearString(input, "labelId"),
    ),
  "linear:list-project-labels": async (client, input) => {
    const projectId = optionalLinearString(input, "projectId");
    if (!projectId) {
      return invokeLinearMethod(
        client,
        "projectLabels",
        linearPageVariables(input),
      );
    }
    return invokeLinearResourceMethod(
      await linearResource(client, "project", projectId),
      "labels",
      linearPageVariables(input),
    );
  },
  "linear:add-label-to-project": (client, input) =>
    invokeLinearMethod(
      client,
      "projectAddLabel",
      requiredLinearString(input, "projectId"),
      requiredLinearString(input, "labelId"),
    ),
  "linear:remove-label-from-project": (client, input) =>
    invokeLinearMethod(
      client,
      "projectRemoveLabel",
      requiredLinearString(input, "projectId"),
      requiredLinearString(input, "labelId"),
    ),
  "linear:create-project-milestone": (client, input) =>
    invokeLinearMethod(
      client,
      "createProjectMilestone",
      linearOperationInput(input),
    ),
  "linear:update-project-milestone": (client, input) =>
    invokeLinearMethod(
      client,
      "updateProjectMilestone",
      requiredLinearString(input, "milestoneId"),
      linearOperationInput(input, ["milestoneId"]),
    ),
  "linear:delete-project-milestone": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteProjectMilestone",
      requiredLinearString(input, "milestoneId"),
    ),
  "linear:list-project-milestones": async (client, input) =>
    invokeLinearResourceMethod(
      await linearResource(
        client,
        "project",
        requiredLinearString(input, "projectId"),
      ),
      "projectMilestones",
      linearPageVariables(input),
    ),
  "linear:create-project-status": (client, input) =>
    invokeLinearMethod(
      client,
      "createProjectStatus",
      linearOperationInput(input),
    ),
  "linear:update-project-status": (client, input) =>
    invokeLinearMethod(
      client,
      "updateProjectStatus",
      requiredLinearString(input, "statusId"),
      linearOperationInput(input, ["statusId"]),
    ),
  // Like issueLabelArchive, this legacy delete mutation is not generated in
  // the current SDK; route it through the SDK's authenticated GraphQL client.
  "linear:delete-project-status": (client, input) =>
    linearRawMutation(
      client,
      "mutation($id: String!) { projectStatusDelete(id: $id) { success } }",
      { id: requiredLinearString(input, "statusId") },
    ),
  "linear:list-project-statuses": (client, input) =>
    invokeLinearMethod(client, "projectStatuses", linearPageVariables(input)),
};

function assertLinearOperationCoverage(): void {
  const expected = new Set(LINEAR_OPERATION_IDS);
  const implemented = Object.keys(LINEAR_OPERATION_HANDLERS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Linear provider SDK operation coverage is incomplete.");
  }
}

/**
 * All pinned Linear actions are executed through Linear's official TypeScript
 * SDK. Two legacy mutations that are absent from the generated SDK surface
 * use its authenticated GraphQL client, keeping credentials and transport
 * package-owned until Linear regenerates those operations.
 */
export function createLinearProviderSdk(
  config: LinearProviderSdkConfig,
): IntegrationProviderSdk {
  assertLinearOperationCoverage();
  const clientFactory = config.clientFactory ?? createLinearClient;
  return {
    integrationId: "linear",
    operationIds: LINEAR_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "linear" ||
        invocation.reference.integrationId !== "linear"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const handler = LINEAR_OPERATION_HANDLERS[invocation.operationId];
      if (!handler) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await handler(
            clientFactory(credential.accessToken),
            invocation.input,
          ),
        }),
      );
    },
  };
}

export function getLinearProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertLinearOperationCoverage();
  return {
    operations: LINEAR_OPERATION_IDS.length,
    operationIds: LINEAR_OPERATION_IDS,
  };
}

interface MailchimpSdkClient {
  setConfig(configuration: { apiKey: string; server: string }): void;
  [resource: string]: unknown;
}

interface MailchimpSdkResource {
  [method: string]: unknown;
}

type MailchimpClientFactory = (apiKey: string) => MailchimpSdkClient;

export interface MailchimpProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: MailchimpClientFactory;
}

function mailchimpServerFromApiKey(apiKey: string): string {
  const match = /-([a-z0-9]+)$/iu.exec(apiKey);
  if (!match) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return match[1].toLowerCase();
}

function createMailchimpClient(apiKey: string): MailchimpSdkClient {
  const MailchimpApiClient = mailchimpRequire(
    "@mailchimp/mailchimp_marketing/src/ApiClient",
  ) as new () => MailchimpSdkClient;
  const client = new MailchimpApiClient();
  client.setConfig({ apiKey, server: mailchimpServerFromApiKey(apiKey) });
  return client;
}

const MAILCHIMP_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "mailchimp",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

function requiredMailchimpString(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): string {
  for (const name of names) {
    const value = input[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  throw new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

function optionalMailchimpString(
  input: Readonly<Record<string, unknown>>,
  name: string,
): string | undefined {
  const value = input[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalMailchimpJson(
  input: Readonly<Record<string, unknown>>,
  name: string,
): unknown {
  const value = input[name];
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
}

function mailchimpOptions(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (const name of [
    "beforeSendTime",
    "count",
    "excludeFields",
    "fields",
    "offset",
    "sinceSendTime",
    "sortDir",
    "sortField",
    "status",
    "type",
  ]) {
    const value = input[name];
    if (value !== undefined && value !== "") options[name] = value;
  }
  return options;
}

async function invokeMailchimpMethod(
  client: MailchimpSdkClient,
  resource: string,
  method: string,
  arguments_: readonly unknown[],
): Promise<unknown> {
  const api = client[resource];
  if (!api || typeof api !== "object") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const candidate = (api as MailchimpSdkResource)[method];
  if (typeof candidate !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return candidate.apply(api, arguments_);
}

interface MailchimpOperationRequest {
  resource: string;
  method: string;
  arguments: readonly unknown[];
}

type MailchimpOperationRequestFactory = (
  input: Readonly<Record<string, unknown>>,
) => MailchimpOperationRequest;

function mailchimpRequest(
  resource: string,
  method: string,
  arguments_: readonly unknown[],
): MailchimpOperationRequest {
  return { resource, method, arguments: arguments_ };
}

function mailchimpMemberBody(
  input: Readonly<Record<string, unknown>>,
  options: { statusIfNew?: boolean } = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const emailAddress = optionalMailchimpString(input, "emailAddress");
  const status = optionalMailchimpString(input, "status");
  const statusIfNew = optionalMailchimpString(input, "statusIfNew");
  const mergeFields = optionalMailchimpJson(input, "mergeFields");
  const interests = optionalMailchimpJson(input, "interests");
  if (emailAddress) body.email_address = emailAddress;
  if (status) body.status = status;
  if (options.statusIfNew && statusIfNew) body.status_if_new = statusIfNew;
  if (mergeFields !== undefined) body.merge_fields = mergeFields;
  if (interests !== undefined) body.interests = interests;
  return body;
}

function mailchimpTagBody(
  input: Readonly<Record<string, unknown>>,
  status: "active" | "inactive",
): Record<string, unknown> {
  const tags = optionalMailchimpJson(input, "tags");
  const entries = Array.isArray(tags) ? tags : [];
  return {
    tags: entries.map((entry) =>
      typeof entry === "string"
        ? { name: entry, status }
        : entry && typeof entry === "object"
          ? { ...(entry as Record<string, unknown>), status }
          : entry,
    ),
  };
}

const MAILCHIMP_OPERATION_REQUESTS: Readonly<
  Record<string, MailchimpOperationRequestFactory>
> = {
  "mailchimp:get-audiences": (input) =>
    mailchimpRequest("lists", "getAllLists", [mailchimpOptions(input)]),
  "mailchimp:get-audience": (input) =>
    mailchimpRequest("lists", "getList", [
      requiredMailchimpString(input, "listId", "audienceId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:create-audience": (input) =>
    mailchimpRequest("lists", "createList", [
      {
        name: requiredMailchimpString(input, "audienceName", "name"),
        permission_reminder: requiredMailchimpString(
          input,
          "permissionReminder",
        ),
        email_type_option:
          input.emailTypeOption === "true" || input.emailTypeOption === true,
        ...(optionalMailchimpJson(input, "contact") !== undefined
          ? { contact: optionalMailchimpJson(input, "contact") }
          : {}),
        ...(optionalMailchimpJson(input, "campaignDefaults") !== undefined
          ? {
              campaign_defaults: optionalMailchimpJson(
                input,
                "campaignDefaults",
              ),
            }
          : {}),
      },
    ]),
  "mailchimp:update-audience": (input) =>
    mailchimpRequest("lists", "updateList", [
      requiredMailchimpString(input, "listId", "audienceId"),
      {
        ...(optionalMailchimpString(input, "audienceName")
          ? { name: optionalMailchimpString(input, "audienceName") }
          : {}),
        ...(optionalMailchimpString(input, "permissionReminder")
          ? {
              permission_reminder: optionalMailchimpString(
                input,
                "permissionReminder",
              ),
            }
          : {}),
        ...(input.emailTypeOption === undefined
          ? {}
          : {
              email_type_option:
                input.emailTypeOption === "true" ||
                input.emailTypeOption === true,
            }),
        ...(optionalMailchimpJson(input, "campaignDefaults") !== undefined
          ? {
              campaign_defaults: optionalMailchimpJson(
                input,
                "campaignDefaults",
              ),
            }
          : {}),
      },
    ]),
  "mailchimp:delete-audience": (input) =>
    mailchimpRequest("lists", "deleteList", [
      requiredMailchimpString(input, "listId", "audienceId"),
    ]),
  "mailchimp:get-members": (input) =>
    mailchimpRequest("lists", "getListMembersInfo", [
      requiredMailchimpString(input, "listId", "audienceId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:get-member": (input) =>
    mailchimpRequest("lists", "getListMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
      mailchimpOptions(input),
    ]),
  "mailchimp:add-member": (input) =>
    mailchimpRequest("lists", "addListMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      mailchimpMemberBody(input),
    ]),
  "mailchimp:add-or-update-member": (input) =>
    mailchimpRequest("lists", "setListMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
      mailchimpMemberBody(input, { statusIfNew: true }),
    ]),
  "mailchimp:update-member": (input) =>
    mailchimpRequest("lists", "updateListMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
      mailchimpMemberBody(input),
    ]),
  "mailchimp:delete-member": (input) =>
    mailchimpRequest("lists", "deleteListMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
    ]),
  "mailchimp:archive-member": (input) =>
    mailchimpRequest("lists", "deleteListMemberPermanent", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
    ]),
  "mailchimp:unarchive-member": (input) =>
    mailchimpRequest("lists", "updateListMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
      mailchimpMemberBody(input),
    ]),
  "mailchimp:get-campaigns": (input) =>
    mailchimpRequest("campaigns", "list", [mailchimpOptions(input)]),
  "mailchimp:get-campaign": (input) =>
    mailchimpRequest("campaigns", "get", [
      requiredMailchimpString(input, "campaignId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:create-campaign": (input) =>
    mailchimpRequest("campaigns", "create", [
      {
        type: requiredMailchimpString(input, "campaignType", "type"),
        ...(optionalMailchimpJson(input, "campaignSettings") !== undefined
          ? { settings: optionalMailchimpJson(input, "campaignSettings") }
          : {}),
        ...(optionalMailchimpJson(input, "recipients") !== undefined
          ? { recipients: optionalMailchimpJson(input, "recipients") }
          : {}),
      },
    ]),
  "mailchimp:update-campaign": (input) =>
    mailchimpRequest("campaigns", "update", [
      requiredMailchimpString(input, "campaignId"),
      {
        ...(optionalMailchimpJson(input, "campaignSettings") !== undefined
          ? { settings: optionalMailchimpJson(input, "campaignSettings") }
          : {}),
        ...(optionalMailchimpJson(input, "recipients") !== undefined
          ? { recipients: optionalMailchimpJson(input, "recipients") }
          : {}),
      },
    ]),
  "mailchimp:delete-campaign": (input) =>
    mailchimpRequest("campaigns", "remove", [
      requiredMailchimpString(input, "campaignId"),
    ]),
  "mailchimp:send-campaign": (input) =>
    mailchimpRequest("campaigns", "send", [
      requiredMailchimpString(input, "campaignId"),
    ]),
  "mailchimp:schedule-campaign": (input) =>
    mailchimpRequest("campaigns", "schedule", [
      requiredMailchimpString(input, "campaignId"),
      { schedule_time: requiredMailchimpString(input, "scheduleTime") },
    ]),
  "mailchimp:unschedule-campaign": (input) =>
    mailchimpRequest("campaigns", "unschedule", [
      requiredMailchimpString(input, "campaignId"),
    ]),
  "mailchimp:replicate-campaign": (input) =>
    mailchimpRequest("campaigns", "replicate", [
      requiredMailchimpString(input, "campaignId"),
    ]),
  "mailchimp:get-campaign-content": (input) =>
    mailchimpRequest("campaigns", "getContent", [
      requiredMailchimpString(input, "campaignId"),
    ]),
  "mailchimp:set-campaign-content": (input) =>
    mailchimpRequest("campaigns", "setContent", [
      requiredMailchimpString(input, "campaignId"),
      {
        ...(optionalMailchimpString(input, "html")
          ? { html: optionalMailchimpString(input, "html") }
          : {}),
        ...(optionalMailchimpString(input, "plainText")
          ? { plain_text: optionalMailchimpString(input, "plainText") }
          : {}),
        ...(optionalMailchimpString(input, "templateId")
          ? { template: { id: optionalMailchimpString(input, "templateId") } }
          : {}),
      },
    ]),
  "mailchimp:get-automations": (input) =>
    mailchimpRequest("automations", "list", [mailchimpOptions(input)]),
  "mailchimp:get-automation": (input) =>
    mailchimpRequest("automations", "get", [
      requiredMailchimpString(input, "workflowId", "automationId"),
    ]),
  "mailchimp:start-automation": (input) =>
    mailchimpRequest("automations", "startAllEmails", [
      requiredMailchimpString(input, "workflowId", "automationId"),
    ]),
  "mailchimp:pause-automation": (input) =>
    mailchimpRequest("automations", "pauseAllEmails", [
      requiredMailchimpString(input, "workflowId", "automationId"),
    ]),
  "mailchimp:add-subscriber-to-automation": (input) =>
    mailchimpRequest("automations", "addWorkflowEmailSubscriber", [
      requiredMailchimpString(input, "workflowId", "automationId"),
      requiredMailchimpString(input, "workflowEmailId", "emailId"),
      { email_address: requiredMailchimpString(input, "emailAddress") },
    ]),
  "mailchimp:get-templates": (input) =>
    mailchimpRequest("templates", "list", [mailchimpOptions(input)]),
  "mailchimp:get-template": (input) =>
    mailchimpRequest("templates", "getTemplate", [
      requiredMailchimpString(input, "templateId"),
    ]),
  "mailchimp:create-template": (input) =>
    mailchimpRequest("templates", "create", [
      {
        name: requiredMailchimpString(input, "templateName", "name"),
        html: requiredMailchimpString(input, "templateHtml", "html"),
      },
    ]),
  "mailchimp:update-template": (input) =>
    mailchimpRequest("templates", "updateTemplate", [
      requiredMailchimpString(input, "templateId"),
      {
        ...(optionalMailchimpString(input, "templateName")
          ? { name: optionalMailchimpString(input, "templateName") }
          : {}),
        ...(optionalMailchimpString(input, "templateHtml")
          ? { html: optionalMailchimpString(input, "templateHtml") }
          : {}),
      },
    ]),
  "mailchimp:delete-template": (input) =>
    mailchimpRequest("templates", "deleteTemplate", [
      requiredMailchimpString(input, "templateId"),
    ]),
  "mailchimp:get-campaign-reports": (input) =>
    mailchimpRequest("reports", "getAllCampaignReports", [
      mailchimpOptions(input),
    ]),
  "mailchimp:get-campaign-report": (input) =>
    mailchimpRequest("reports", "getCampaignReport", [
      requiredMailchimpString(input, "campaignId"),
    ]),
  "mailchimp:get-segments": (input) =>
    mailchimpRequest("lists", "listSegments", [
      requiredMailchimpString(input, "listId", "audienceId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:get-segment": (input) =>
    mailchimpRequest("lists", "getSegment", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "segmentId"),
    ]),
  "mailchimp:create-segment": (input) =>
    mailchimpRequest("lists", "createSegment", [
      requiredMailchimpString(input, "listId", "audienceId"),
      {
        name: requiredMailchimpString(input, "segmentName", "name"),
        ...(optionalMailchimpJson(input, "segmentOptions") !== undefined
          ? { options: optionalMailchimpJson(input, "segmentOptions") }
          : {}),
      },
    ]),
  "mailchimp:update-segment": (input) =>
    mailchimpRequest("lists", "updateSegment", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "segmentId"),
      {
        ...(optionalMailchimpString(input, "segmentName")
          ? { name: optionalMailchimpString(input, "segmentName") }
          : {}),
        ...(optionalMailchimpJson(input, "segmentOptions") !== undefined
          ? { options: optionalMailchimpJson(input, "segmentOptions") }
          : {}),
      },
    ]),
  "mailchimp:delete-segment": (input) =>
    mailchimpRequest("lists", "deleteSegment", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "segmentId"),
    ]),
  "mailchimp:get-segment-members": (input) =>
    mailchimpRequest("lists", "getSegmentMembersList", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "segmentId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:add-segment-member": (input) =>
    mailchimpRequest("lists", "createSegmentMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "segmentId"),
      { email_address: requiredMailchimpString(input, "emailAddress") },
    ]),
  "mailchimp:remove-segment-member": (input) =>
    mailchimpRequest("lists", "removeSegmentMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "segmentId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
    ]),
  "mailchimp:get-member-tags": (input) =>
    mailchimpRequest("lists", "getListMemberTags", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
    ]),
  "mailchimp:add-member-tags": (input) =>
    mailchimpRequest("lists", "updateListMemberTags", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
      mailchimpTagBody(input, "active"),
    ]),
  "mailchimp:remove-member-tags": (input) =>
    mailchimpRequest("lists", "updateListMemberTags", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
      mailchimpTagBody(input, "inactive"),
    ]),
  "mailchimp:get-merge-fields": (input) =>
    mailchimpRequest("lists", "getListMergeFields", [
      requiredMailchimpString(input, "listId", "audienceId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:get-merge-field": (input) =>
    mailchimpRequest("lists", "getListMergeField", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "mergeId"),
    ]),
  "mailchimp:create-merge-field": (input) =>
    mailchimpRequest("lists", "addListMergeField", [
      requiredMailchimpString(input, "listId", "audienceId"),
      {
        name: requiredMailchimpString(input, "mergeName", "name"),
        type: requiredMailchimpString(input, "mergeType", "type"),
      },
    ]),
  "mailchimp:update-merge-field": (input) =>
    mailchimpRequest("lists", "updateListMergeField", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "mergeId"),
      {
        ...(optionalMailchimpString(input, "mergeName")
          ? { name: optionalMailchimpString(input, "mergeName") }
          : {}),
      },
    ]),
  "mailchimp:delete-merge-field": (input) =>
    mailchimpRequest("lists", "deleteListMergeField", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "mergeId"),
    ]),
  "mailchimp:get-interest-categories": (input) =>
    mailchimpRequest("lists", "getListInterestCategories", [
      requiredMailchimpString(input, "listId", "audienceId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:get-interest-category": (input) =>
    mailchimpRequest("lists", "getInterestCategory", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
    ]),
  "mailchimp:create-interest-category": (input) =>
    mailchimpRequest("lists", "createListInterestCategory", [
      requiredMailchimpString(input, "listId", "audienceId"),
      {
        title: requiredMailchimpString(input, "interestCategoryTitle", "title"),
        type: requiredMailchimpString(input, "interestCategoryType", "type"),
      },
    ]),
  "mailchimp:update-interest-category": (input) =>
    mailchimpRequest("lists", "updateInterestCategory", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
      {
        ...(optionalMailchimpString(input, "interestCategoryTitle")
          ? { title: optionalMailchimpString(input, "interestCategoryTitle") }
          : {}),
      },
    ]),
  "mailchimp:delete-interest-category": (input) =>
    mailchimpRequest("lists", "deleteInterestCategory", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
    ]),
  "mailchimp:get-interests": (input) =>
    mailchimpRequest("lists", "listInterestCategoryInterests", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:get-interest": (input) =>
    mailchimpRequest("lists", "getInterestCategoryInterest", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
      requiredMailchimpString(input, "interestId"),
    ]),
  "mailchimp:create-interest": (input) =>
    mailchimpRequest("lists", "createInterestCategoryInterest", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
      { name: requiredMailchimpString(input, "interestName", "name") },
    ]),
  "mailchimp:update-interest": (input) =>
    mailchimpRequest("lists", "updateInterestCategoryInterest", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
      requiredMailchimpString(input, "interestId"),
      {
        ...(optionalMailchimpString(input, "interestName")
          ? { name: optionalMailchimpString(input, "interestName") }
          : {}),
      },
    ]),
  "mailchimp:delete-interest": (input) =>
    mailchimpRequest("lists", "deleteInterestCategoryInterest", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
      requiredMailchimpString(input, "interestId"),
    ]),
  "mailchimp:get-landing-pages": (input) =>
    mailchimpRequest("landingPages", "getAll", [mailchimpOptions(input)]),
  "mailchimp:get-landing-page": (input) =>
    mailchimpRequest("landingPages", "getPage", [
      requiredMailchimpString(input, "pageId", "landingPageId"),
    ]),
  "mailchimp:create-landing-page": (input) =>
    mailchimpRequest("landingPages", "create", [
      {
        type: requiredMailchimpString(input, "landingPageType", "type"),
        ...(optionalMailchimpString(input, "landingPageTitle")
          ? { title: optionalMailchimpString(input, "landingPageTitle") }
          : {}),
      },
    ]),
  "mailchimp:update-landing-page": (input) =>
    mailchimpRequest("landingPages", "updatePage", [
      requiredMailchimpString(input, "pageId", "landingPageId"),
      {
        ...(optionalMailchimpString(input, "landingPageTitle")
          ? { title: optionalMailchimpString(input, "landingPageTitle") }
          : {}),
      },
    ]),
  "mailchimp:delete-landing-page": (input) =>
    mailchimpRequest("landingPages", "deletePage", [
      requiredMailchimpString(input, "pageId", "landingPageId"),
    ]),
  "mailchimp:publish-landing-page": (input) =>
    mailchimpRequest("landingPages", "publishPage", [
      requiredMailchimpString(input, "pageId", "landingPageId"),
    ]),
  "mailchimp:unpublish-landing-page": (input) =>
    mailchimpRequest("landingPages", "unpublishPage", [
      requiredMailchimpString(input, "pageId", "landingPageId"),
    ]),
  "mailchimp:get-batch-operations": (input) =>
    mailchimpRequest("batches", "list", [mailchimpOptions(input)]),
  "mailchimp:get-batch-operation": (input) =>
    mailchimpRequest("batches", "status", [
      requiredMailchimpString(input, "batchId"),
    ]),
  "mailchimp:create-batch-operation": (input) =>
    mailchimpRequest("batches", "start", [
      { operations: optionalMailchimpJson(input, "operations") ?? [] },
    ]),
  "mailchimp:delete-batch-operation": (input) =>
    mailchimpRequest("batches", "deleteRequest", [
      requiredMailchimpString(input, "batchId"),
    ]),
};

function assertMailchimpOperationCoverage(): void {
  const expected = new Set(MAILCHIMP_OPERATION_IDS);
  const implemented = Object.keys(MAILCHIMP_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Mailchimp provider SDK operation coverage is incomplete.");
  }
}

/**
 * All pinned Mailchimp actions through Mailchimp's generated Marketing API
 * client. A fresh SDK client is created per invocation so API-key server
 * prefixes and credentials can never cross a connection boundary.
 */
export function createMailchimpProviderSdk(
  config: MailchimpProviderSdkConfig,
): IntegrationProviderSdk {
  assertMailchimpOperationCoverage();
  const clientFactory = config.clientFactory ?? createMailchimpClient;
  return {
    integrationId: "mailchimp",
    operationIds: MAILCHIMP_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "mailchimp" ||
        invocation.reference.integrationId !== "mailchimp"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        MAILCHIMP_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      const request = requestFactory(invocation.input);
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: (await invokeMailchimpMethod(
            clientFactory(credential.apiKey),
            request.resource,
            request.method,
            request.arguments,
          )) ?? { success: true },
        }),
      );
    },
  };
}

export function getMailchimpProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertMailchimpOperationCoverage();
  return {
    operations: MAILCHIMP_OPERATION_IDS.length,
    operationIds: MAILCHIMP_OPERATION_IDS,
  };
}

interface VercelSdkResource {
  [method: string]: unknown;
}

interface VercelSdkClient {
  [resource: string]: VercelSdkResource;
}

type VercelClientFactory = (apiKey: string) => VercelSdkClient;

export interface VercelProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: VercelClientFactory;
}

function createVercelClient(apiKey: string): VercelSdkClient {
  return new Vercel({ bearerToken: apiKey }) as unknown as VercelSdkClient;
}

const VERCEL_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "vercel",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

// @vercel/sdk v1.28.14 does not expose this endpoint. Keep it catalogue-only
// until the official SDK supports it instead of bypassing the SDK with REST.
const VERCEL_SDK_OPERATION_IDS = Object.freeze(
  VERCEL_OPERATION_IDS.filter(
    (operationId) => operationId !== "vercel:update-edge-config-items",
  ),
);

function requiredVercelString(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): string {
  for (const name of names) {
    const value = input[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  throw new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

function optionalVercelString(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): string | undefined {
  for (const name of names) {
    const value = input[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function optionalVercelNumber(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): number | undefined {
  for (const name of names) {
    const value = input[name];
    if (value === undefined || value === null || value === "") continue;
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return number;
  }
  return undefined;
}

function optionalVercelBoolean(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): boolean | undefined {
  for (const name of names) {
    const value = input[name];
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
  }
  return undefined;
}

function optionalVercelJson(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): unknown {
  for (const name of names) {
    const value = input[name];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
  }
  return undefined;
}

function optionalVercelCsv(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): string[] | undefined {
  for (const name of names) {
    const value = input[name];
    if (Array.isArray(value)) {
      const values = value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      );
      return values.length > 0
        ? values.map((entry) => entry.trim())
        : undefined;
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }
  return undefined;
}

function definedVercelFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

function vercelScope(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return definedVercelFields({
    teamId: optionalVercelString(input, "teamId"),
    slug: optionalVercelString(input, "teamSlug", "slug"),
  });
}

function vercelProjectSettings(
  input: Readonly<Record<string, unknown>>,
  name?: string,
): Record<string, unknown> {
  return definedVercelFields({
    name,
    framework: optionalVercelString(input, "framework"),
    buildCommand: optionalVercelString(input, "buildCommand"),
    outputDirectory: optionalVercelString(input, "outputDirectory"),
    installCommand: optionalVercelString(input, "installCommand"),
    rootDirectory: optionalVercelString(input, "rootDirectory"),
    nodeVersion: optionalVercelString(input, "nodeVersion"),
    devCommand: optionalVercelString(input, "devCommand"),
  });
}

function vercelDnsRecordBody(
  input: Readonly<Record<string, unknown>>,
  mode: "create" | "update",
): Record<string, unknown> {
  const update = mode === "update";
  const type = optionalVercelString(
    input,
    update ? "updateRecordType" : "recordType",
  )?.toUpperCase();
  const body: Record<string, unknown> = definedVercelFields({
    name: optionalVercelString(
      input,
      update ? "updateRecordName" : "recordName",
    ),
    type,
    ttl: optionalVercelNumber(input, update ? "updateRecordTtl" : "recordTtl"),
    comment: optionalVercelString(
      input,
      update ? "updateRecordComment" : "recordComment",
    ),
  });
  if (type === "SRV") {
    body.srv = definedVercelFields({
      target: optionalVercelString(
        input,
        update ? "updateSrvTarget" : "srvTarget",
      ),
      weight: optionalVercelNumber(
        input,
        update ? "updateSrvWeight" : "srvWeight",
      ),
      port: optionalVercelNumber(input, update ? "updateSrvPort" : "srvPort"),
      priority: optionalVercelNumber(
        input,
        update ? "updateSrvPriority" : "srvPriority",
      ),
    });
  } else if (type === "HTTPS") {
    body.https = definedVercelFields({
      target: optionalVercelString(
        input,
        update ? "updateHttpsTarget" : "httpsTarget",
      ),
      priority: optionalVercelNumber(
        input,
        update ? "updateHttpsPriority" : "httpsPriority",
      ),
      params: optionalVercelString(
        input,
        update ? "updateHttpsParams" : "httpsParams",
      ),
    });
  } else {
    const value = optionalVercelString(
      input,
      update ? "updateRecordValue" : "recordValue",
    );
    if (value) body.value = value;
    const mxPriority = optionalVercelNumber(
      input,
      update ? "updateRecordMxPriority" : "recordMxPriority",
    );
    if (mxPriority !== undefined) body.mxPriority = mxPriority;
  }
  if (mode === "create" && !body.name) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return body;
}

interface VercelSdkRequest {
  resource: string;
  method: string;
  arguments: readonly unknown[];
}

function vercelRequest(
  resource: string,
  method: string,
  request: Record<string, unknown>,
): VercelSdkRequest {
  return { resource, method, arguments: [request] };
}

function invokeVercelMethod(
  client: VercelSdkClient,
  request: VercelSdkRequest,
): Promise<unknown> {
  const resource = client[request.resource];
  const method = resource?.[request.method];
  if (typeof method !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return method.apply(resource, request.arguments) as Promise<unknown>;
}

function vercelDeploymentRequest(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return definedVercelFields({
    ...vercelScope(input),
    idOrUrl: requiredVercelString(input, "deploymentId", "idOrUrl"),
  });
}

function vercelProjectRequest(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return definedVercelFields({
    ...vercelScope(input),
    idOrName: requiredVercelString(input, "projectId", "idOrName"),
  });
}

function vercelDomainRequest(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return definedVercelFields({
    ...vercelScope(input),
    domain: requiredVercelString(input, "domainName", "domain"),
  });
}

function vercelCheckRequest(
  input: Readonly<Record<string, unknown>>,
  includeCheckId = false,
): Record<string, unknown> {
  return definedVercelFields({
    ...vercelScope(input),
    deploymentId: requiredVercelString(
      input,
      "checkDeploymentId",
      "deploymentId",
    ),
    ...(includeCheckId
      ? { checkId: requiredVercelString(input, "checkId") }
      : {}),
  });
}

const VERCEL_OPERATION_REQUESTS: Readonly<
  Record<string, (input: Readonly<Record<string, unknown>>) => VercelSdkRequest>
> = {
  "vercel:list-deployments": (input) =>
    vercelRequest(
      "deployments",
      "getDeployments",
      definedVercelFields({
        ...vercelScope(input),
        projectId: optionalVercelString(
          input,
          "deploymentsProjectId",
          "projectId",
        ),
        app: optionalVercelString(input, "deploymentsApp", "app"),
        target: optionalVercelString(input, "target"),
        state: optionalVercelString(input, "state"),
        since: optionalVercelNumber(input, "deploymentsSince", "since"),
        until: optionalVercelNumber(input, "deploymentsUntil", "until"),
        limit: optionalVercelNumber(input, "deploymentsLimit", "limit"),
      }),
    ),
  "vercel:get-deployment": (input) =>
    vercelRequest(
      "deployments",
      "getDeployment",
      definedVercelFields({
        ...vercelDeploymentRequest(input),
        withGitRepoInfo: optionalVercelString(input, "withGitRepoInfo"),
      }),
    ),
  "vercel:create-deployment": (input) =>
    vercelRequest(
      "deployments",
      "createDeployment",
      definedVercelFields({
        ...vercelScope(input),
        forceNew: optionalVercelString(input, "deploymentForceNew", "forceNew"),
        requestBody: definedVercelFields({
          name: requiredVercelString(input, "name", "projectName"),
          project: optionalVercelString(input, "project"),
          deploymentId: optionalVercelString(
            input,
            "redeployId",
            "deploymentId",
          ),
          target: optionalVercelString(input, "deployTarget", "target"),
          gitSource: optionalVercelJson(
            input,
            "deploymentGitSource",
            "gitSource",
          ),
        }),
      }),
    ),
  "vercel:cancel-deployment": (input) =>
    vercelRequest(
      "deployments",
      "cancelDeployment",
      definedVercelFields({
        ...vercelScope(input),
        id: requiredVercelString(input, "deploymentId", "id"),
      }),
    ),
  "vercel:delete-deployment": (input) =>
    vercelRequest(
      "deployments",
      "deleteDeployment",
      definedVercelFields({
        ...vercelScope(input),
        id: requiredVercelString(input, "deploymentId", "id"),
      }),
    ),
  "vercel:get-deployment-logs": (input) =>
    vercelRequest(
      "deployments",
      "getDeploymentEvents",
      definedVercelFields({
        ...vercelScope(input),
        idOrUrl: requiredVercelString(input, "deploymentId", "idOrUrl"),
        direction: optionalVercelString(input, "eventsDirection", "direction"),
        follow: optionalVercelNumber(input, "eventsFollow", "follow"),
        limit: optionalVercelNumber(input, "eventsLimit", "limit"),
        since: optionalVercelNumber(input, "eventsSince", "since"),
        until: optionalVercelNumber(input, "eventsUntil", "until"),
      }),
    ),
  "vercel:list-deployment-files": (input) =>
    vercelRequest(
      "deployments",
      "listDeploymentFiles",
      definedVercelFields({
        ...vercelScope(input),
        id: requiredVercelString(input, "deploymentId", "id"),
      }),
    ),
  "vercel:promote-deployment": (input) =>
    vercelRequest(
      "projects",
      "requestPromote",
      definedVercelFields({
        ...vercelScope(input),
        projectId: requiredVercelString(input, "projectId"),
        deploymentId: requiredVercelString(input, "deploymentId"),
      }),
    ),
  "vercel:list-projects": (input) =>
    vercelRequest(
      "projects",
      "getProjects",
      definedVercelFields({
        ...vercelScope(input),
        search: optionalVercelString(input, "search"),
        from: optionalVercelString(input, "projectsFrom", "from"),
      }),
    ),
  "vercel:get-project": (input) =>
    vercelRequest("projects", "getProject", vercelProjectRequest(input)),
  "vercel:create-project": (input) =>
    vercelRequest(
      "projects",
      "createProject",
      definedVercelFields({
        ...vercelScope(input),
        requestBody: vercelProjectSettings(
          input,
          requiredVercelString(input, "projectName", "name"),
        ),
      }),
    ),
  "vercel:update-project": (input) =>
    vercelRequest(
      "projects",
      "updateProject",
      definedVercelFields({
        ...vercelProjectRequest(input),
        requestBody: vercelProjectSettings(
          input,
          optionalVercelString(input, "updateProjectName", "name"),
        ),
      }),
    ),
  "vercel:delete-project": (input) =>
    vercelRequest("projects", "deleteProject", vercelProjectRequest(input)),
  "vercel:pause-project": (input) =>
    vercelRequest(
      "projects",
      "pauseProject",
      definedVercelFields({
        ...vercelScope(input),
        projectId: requiredVercelString(input, "projectId"),
      }),
    ),
  "vercel:unpause-project": (input) =>
    vercelRequest(
      "projects",
      "unpauseProject",
      definedVercelFields({
        ...vercelScope(input),
        projectId: requiredVercelString(input, "projectId"),
      }),
    ),
  "vercel:list-project-domains": (input) =>
    vercelRequest(
      "projects",
      "getProjectDomains",
      definedVercelFields({
        ...vercelProjectRequest(input),
        limit: optionalVercelNumber(input, "projectDomainsLimit", "limit"),
      }),
    ),
  "vercel:add-project-domain": (input) =>
    vercelRequest(
      "projects",
      "addProjectDomain",
      definedVercelFields({
        ...vercelProjectRequest(input),
        requestBody: definedVercelFields({
          name: requiredVercelString(input, "domainName", "domain"),
          redirect: optionalVercelString(
            input,
            "updateDomainRedirect",
            "redirect",
          ),
          redirectStatusCode: optionalVercelNumber(
            input,
            "updateDomainRedirectStatusCode",
            "redirectStatusCode",
          ),
          gitBranch: optionalVercelString(
            input,
            "updateDomainGitBranch",
            "gitBranch",
          ),
        }),
      }),
    ),
  "vercel:update-project-domain": (input) =>
    vercelRequest(
      "projects",
      "updateProjectDomain",
      definedVercelFields({
        ...vercelProjectRequest(input),
        domain: requiredVercelString(input, "domainName", "domain"),
        requestBody: definedVercelFields({
          redirect: optionalVercelString(
            input,
            "updateDomainRedirect",
            "redirect",
          ),
          redirectStatusCode: optionalVercelNumber(
            input,
            "updateDomainRedirectStatusCode",
            "redirectStatusCode",
          ),
          gitBranch: optionalVercelString(
            input,
            "updateDomainGitBranch",
            "gitBranch",
          ),
        }),
      }),
    ),
  "vercel:verify-project-domain": (input) =>
    vercelRequest(
      "projects",
      "verifyProjectDomain",
      definedVercelFields({
        ...vercelProjectRequest(input),
        domain: requiredVercelString(input, "domainName", "domain"),
      }),
    ),
  "vercel:remove-project-domain": (input) =>
    vercelRequest(
      "projects",
      "removeProjectDomain",
      definedVercelFields({
        ...vercelProjectRequest(input),
        domain: requiredVercelString(input, "domainName", "domain"),
      }),
    ),
  "vercel:get-environment-variables": (input) =>
    vercelRequest(
      "projects",
      "filterProjectEnvs",
      definedVercelFields({
        ...vercelProjectRequest(input),
        decrypt: optionalVercelBoolean(input, "envVarsDecrypt", "decrypt")
          ? "true"
          : undefined,
        gitBranch: optionalVercelString(input, "envVarsGitBranch", "gitBranch"),
      }),
    ),
  "vercel:create-environment-variable": (input) =>
    vercelRequest(
      "projects",
      "createProjectEnv",
      definedVercelFields({
        ...vercelProjectRequest(input),
        requestBody: definedVercelFields({
          key: requiredVercelString(input, "envKey", "key"),
          value: requiredVercelString(input, "envValue", "value"),
          target: optionalVercelCsv(input, "envTarget", "target"),
          type: optionalVercelString(input, "envType", "type") ?? "plain",
          gitBranch: optionalVercelString(input, "envGitBranch", "gitBranch"),
          comment: optionalVercelString(input, "envComment", "comment"),
        }),
      }),
    ),
  "vercel:update-environment-variable": (input) =>
    vercelRequest(
      "projects",
      "editProjectEnv",
      definedVercelFields({
        ...vercelProjectRequest(input),
        id: requiredVercelString(input, "envId", "id"),
        requestBody: definedVercelFields({
          key: optionalVercelString(input, "envKey", "key"),
          value: optionalVercelString(input, "envValue", "value"),
          target: optionalVercelCsv(input, "envTarget", "target"),
          type: optionalVercelString(input, "envType", "type"),
          gitBranch: optionalVercelString(input, "envGitBranch", "gitBranch"),
          comment: optionalVercelString(input, "envComment", "comment"),
        }),
      }),
    ),
  "vercel:delete-environment-variable": (input) =>
    vercelRequest(
      "projects",
      "removeProjectEnv",
      definedVercelFields({
        ...vercelProjectRequest(input),
        id: requiredVercelString(input, "envId", "id"),
      }),
    ),
  "vercel:list-domains": (input) =>
    vercelRequest(
      "domains",
      "getDomains",
      definedVercelFields({
        ...vercelScope(input),
        limit: optionalVercelNumber(input, "limit"),
        since: optionalVercelNumber(input, "since"),
        until: optionalVercelNumber(input, "until"),
      }),
    ),
  "vercel:get-domain": (input) =>
    vercelRequest("domains", "getDomain", vercelDomainRequest(input)),
  "vercel:add-domain": (input) =>
    vercelRequest(
      "domains",
      "createOrTransferDomain",
      definedVercelFields({
        ...vercelScope(input),
        requestBody: {
          name: requiredVercelString(input, "domainName", "domain"),
        },
      }),
    ),
  "vercel:delete-domain": (input) =>
    vercelRequest("domains", "deleteDomain", vercelDomainRequest(input)),
  "vercel:get-domain-config": (input) =>
    vercelRequest("domains", "getDomainConfig", vercelDomainRequest(input)),
  "vercel:list-dns-records": (input) =>
    vercelRequest(
      "dns",
      "getRecords",
      definedVercelFields({
        ...vercelDomainRequest(input),
        limit: optionalVercelString(input, "dnsRecordsLimit", "limit"),
      }),
    ),
  "vercel:create-dns-record": (input) =>
    vercelRequest(
      "dns",
      "createRecord",
      definedVercelFields({
        ...vercelDomainRequest(input),
        requestBody: vercelDnsRecordBody(input, "create"),
      }),
    ),
  "vercel:update-dns-record": (input) =>
    vercelRequest(
      "dns",
      "updateRecord",
      definedVercelFields({
        ...vercelScope(input),
        recordId: requiredVercelString(input, "recordId"),
        requestBody: vercelDnsRecordBody(input, "update"),
      }),
    ),
  "vercel:delete-dns-record": (input) =>
    vercelRequest(
      "dns",
      "removeRecord",
      definedVercelFields({
        ...vercelScope(input),
        recordId: requiredVercelString(input, "recordId"),
      }),
    ),
  "vercel:list-aliases": (input) =>
    vercelRequest(
      "aliases",
      "listAliases",
      definedVercelFields({
        ...vercelScope(input),
        projectId: optionalVercelString(input, "projectId"),
      }),
    ),
  "vercel:get-alias": (input) =>
    vercelRequest(
      "aliases",
      "getAlias",
      definedVercelFields({
        ...vercelScope(input),
        idOrAlias: requiredVercelString(input, "aliasId", "idOrAlias"),
      }),
    ),
  "vercel:create-alias": (input) =>
    vercelRequest(
      "aliases",
      "assignAlias",
      definedVercelFields({
        ...vercelScope(input),
        id: requiredVercelString(
          input,
          "aliasDeploymentId",
          "deploymentId",
          "id",
        ),
        requestBody: definedVercelFields({
          alias: requiredVercelString(input, "aliasName", "alias"),
          redirect: optionalVercelString(input, "aliasRedirect", "redirect"),
        }),
      }),
    ),
  "vercel:delete-alias": (input) =>
    vercelRequest(
      "aliases",
      "deleteAlias",
      definedVercelFields({
        ...vercelScope(input),
        aliasId: requiredVercelString(input, "aliasId"),
      }),
    ),
  "vercel:list-edge-configs": (input) =>
    vercelRequest("globalConfig", "getEdgeConfigs", vercelScope(input)),
  "vercel:get-edge-config": (input) =>
    vercelRequest(
      "globalConfig",
      "getEdgeConfig",
      definedVercelFields({
        ...vercelScope(input),
        edgeConfigId: requiredVercelString(input, "edgeConfigId"),
      }),
    ),
  "vercel:create-edge-config": (input) =>
    vercelRequest(
      "globalConfig",
      "createEdgeConfig",
      definedVercelFields({
        ...vercelScope(input),
        requestBody: {
          slug: requiredVercelString(input, "edgeConfigSlug", "slug"),
        },
      }),
    ),
  "vercel:get-edge-config-items": (input) =>
    vercelRequest(
      "globalConfig",
      "getEdgeConfigItems",
      definedVercelFields({
        ...vercelScope(input),
        edgeConfigId: requiredVercelString(input, "edgeConfigId"),
      }),
    ),
  "vercel:delete-edge-config": (input) =>
    vercelRequest(
      "globalConfig",
      "deleteEdgeConfig",
      definedVercelFields({
        ...vercelScope(input),
        edgeConfigId: requiredVercelString(input, "edgeConfigId"),
      }),
    ),
  "vercel:list-webhooks": (input) =>
    vercelRequest(
      "webhooks",
      "getWebhooks",
      definedVercelFields({
        ...vercelScope(input),
        projectId: optionalVercelString(input, "projectId"),
      }),
    ),
  "vercel:get-webhook": (input) =>
    vercelRequest(
      "webhooks",
      "getWebhook",
      definedVercelFields({
        ...vercelScope(input),
        id: requiredVercelString(input, "webhookId", "id"),
      }),
    ),
  "vercel:create-webhook": (input) =>
    vercelRequest(
      "webhooks",
      "createWebhook",
      definedVercelFields({
        ...vercelScope(input),
        requestBody: definedVercelFields({
          url: requiredVercelString(input, "webhookUrl", "url"),
          events: optionalVercelCsv(input, "webhookEvents", "events") ?? [],
          projectIds: optionalVercelCsv(
            input,
            "webhookProjectIds",
            "projectIds",
          ),
        }),
      }),
    ),
  "vercel:delete-webhook": (input) =>
    vercelRequest(
      "webhooks",
      "deleteWebhook",
      definedVercelFields({
        ...vercelScope(input),
        id: requiredVercelString(input, "webhookId", "id"),
      }),
    ),
  "vercel:list-checks": (input) =>
    vercelRequest("checks", "getAllChecks", vercelCheckRequest(input)),
  "vercel:get-check": (input) =>
    vercelRequest("checks", "getCheck", vercelCheckRequest(input, true)),
  "vercel:create-check": (input) =>
    vercelRequest(
      "checks",
      "createCheck",
      definedVercelFields({
        ...vercelCheckRequest(input),
        requestBody: definedVercelFields({
          name: requiredVercelString(input, "checkName", "name"),
          blocking:
            optionalVercelBoolean(input, "checkBlocking", "blocking") ?? false,
          path: optionalVercelString(input, "checkPath", "path"),
          detailsUrl: optionalVercelString(
            input,
            "checkDetailsUrl",
            "detailsUrl",
          ),
          externalId: optionalVercelString(
            input,
            "checkExternalId",
            "externalId",
          ),
          rerequestable: optionalVercelBoolean(
            input,
            "checkRerequestable",
            "rerequestable",
          ),
        }),
      }),
    ),
  "vercel:update-check": (input) =>
    vercelRequest(
      "checks",
      "updateCheck",
      definedVercelFields({
        ...vercelCheckRequest(input, true),
        requestBody: definedVercelFields({
          name: optionalVercelString(input, "checkName", "name"),
          status: optionalVercelString(input, "checkStatus", "status"),
          conclusion: optionalVercelString(
            input,
            "checkConclusion",
            "conclusion",
          ),
          path: optionalVercelString(input, "checkPath", "path"),
          detailsUrl: optionalVercelString(
            input,
            "checkDetailsUrl",
            "detailsUrl",
          ),
          externalId: optionalVercelString(
            input,
            "checkExternalId",
            "externalId",
          ),
          output: optionalVercelJson(input, "checkOutput", "output"),
        }),
      }),
    ),
  "vercel:rerequest-check": (input) =>
    vercelRequest(
      "checks",
      "rerequestCheck",
      definedVercelFields({
        ...vercelCheckRequest(input, true),
        autoUpdate: optionalVercelBoolean(
          input,
          "checkAutoUpdate",
          "autoUpdate",
        ),
      }),
    ),
  "vercel:list-teams": (input) =>
    vercelRequest(
      "teams",
      "getTeams",
      definedVercelFields({
        limit: optionalVercelNumber(input, "teamsLimit", "limit"),
        since: optionalVercelNumber(input, "teamsSince", "since"),
        until: optionalVercelNumber(input, "teamsUntil", "until"),
      }),
    ),
  "vercel:get-team": (input) =>
    vercelRequest(
      "teams",
      "getTeam",
      definedVercelFields({
        teamId: requiredVercelString(input, "teamIdParam", "teamId"),
        slug: optionalVercelString(input, "teamSlug", "slug"),
      }),
    ),
  "vercel:list-team-members": (input) =>
    vercelRequest(
      "teams",
      "getTeamMembers",
      definedVercelFields({
        teamId: requiredVercelString(input, "teamIdParam", "teamId"),
        slug: optionalVercelString(input, "teamSlug", "slug"),
        role: optionalVercelString(input, "memberRole", "role"),
        limit: optionalVercelNumber(input, "teamMembersLimit", "limit"),
        since: optionalVercelNumber(input, "teamMembersSince", "since"),
        until: optionalVercelNumber(input, "teamMembersUntil", "until"),
        search: optionalVercelString(input, "teamMembersSearch", "search"),
      }),
    ),
  "vercel:get-user": () => vercelRequest("user", "getAuthUser", {}),
};

function assertVercelOperationCoverage(): void {
  const expected = new Set(VERCEL_SDK_OPERATION_IDS);
  const implemented = Object.keys(VERCEL_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Vercel provider SDK operation coverage is incomplete.");
  }
}

/**
 * Executes Vercel actions exposed by Vercel's official generated TypeScript
 * SDK. Source actions missing from that SDK remain catalogue-only rather than
 * silently falling back to raw REST.
 */
export function createVercelProviderSdk(
  config: VercelProviderSdkConfig,
): IntegrationProviderSdk {
  assertVercelOperationCoverage();
  const clientFactory = config.clientFactory ?? createVercelClient;
  return {
    integrationId: "vercel",
    operationIds: VERCEL_SDK_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "vercel" ||
        invocation.reference.integrationId !== "vercel"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = VERCEL_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      const request = requestFactory(invocation.input);
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: (await invokeVercelMethod(
            clientFactory(credential.apiKey),
            request,
          )) ?? { success: true },
        }),
      );
    },
  };
}

export function getVercelProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertVercelOperationCoverage();
  return {
    operations: VERCEL_SDK_OPERATION_IDS.length,
    operationIds: VERCEL_SDK_OPERATION_IDS,
  };
}

type SquareSdkClient = Record<string, unknown>;
type SquareClientFactory = (apiKey: string) => SquareSdkClient;

export interface SquareProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: SquareClientFactory;
}

function createSquareClient(apiKey: string): SquareSdkClient {
  return new SquareClient({ token: apiKey }) as unknown as SquareSdkClient;
}

const SQUARE_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "square",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface SquareSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function squareRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): SquareSdkRequest {
  return { path, arguments: [request] };
}

function squareOptionalRecord(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): Record<string, unknown> | undefined {
  const value = optionalVercelJson(input, ...names);
  if (value === undefined) return undefined;
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value as Record<string, unknown>;
}

function squareOptionalStringArray(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): string[] | undefined {
  const value = names
    .map((name) => input[name])
    .find((candidate) => candidate !== undefined && candidate !== null);
  if (value === undefined) return undefined;
  if (typeof value === "string" && !value.trim().startsWith("[")) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  const parsed =
    typeof value === "string" ? optionalVercelJson({ value }, "value") : value;
  if (
    !Array.isArray(parsed) ||
    parsed.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return parsed.map((entry) => entry.trim());
}

function requiredSquareStringArray(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): string[] {
  const value = squareOptionalStringArray(input, ...names);
  if (!value?.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

function requiredSquareNumber(
  input: Readonly<Record<string, unknown>>,
  name: string,
): number {
  const value = optionalVercelNumber(input, name);
  if (value === undefined) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

function requiredSquareValue(
  input: Readonly<Record<string, unknown>>,
  name: string,
): unknown {
  const value = input[name];
  if (value === undefined || value === null || value === "") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

function requiredSquareMoney(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const amount = optionalVercelNumber(input, "amount");
  const currency = requiredVercelString(input, "currency");
  if (amount === undefined || !Number.isInteger(amount)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return { amount: BigInt(amount), currency };
}

function squareIdempotencyKey(
  input: Readonly<Record<string, unknown>>,
): string {
  return optionalVercelString(input, "idempotencyKey") ?? crypto.randomUUID();
}

function invokeSquareMethod(
  client: SquareSdkClient,
  request: SquareSdkRequest,
): Promise<unknown> {
  let target: unknown = client;
  for (const segment of request.path.slice(0, -1)) {
    if (!target || typeof target !== "object") {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
      );
    }
    target = (target as Record<string, unknown>)[segment];
  }
  const method =
    target && typeof target === "object"
      ? (target as Record<string, unknown>)[request.path.at(-1) ?? ""]
      : undefined;
  if (typeof method !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return method.apply(target, request.arguments) as Promise<unknown>;
}

function normalizeSquareOutput(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSquareOutput(entry, seen));
  }
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        normalizeSquareOutput(entry, seen),
      ]),
    );
  }
  return value;
}

const SQUARE_OPERATION_REQUESTS: Readonly<
  Record<string, (input: Readonly<Record<string, unknown>>) => SquareSdkRequest>
> = {
  "square:create-payment": (input) =>
    squareRequest(["payments", "create"], {
      sourceId: requiredVercelString(input, "sourceId"),
      idempotencyKey: squareIdempotencyKey(input),
      amountMoney: requiredSquareMoney(input),
      customerId: optionalVercelString(input, "customerId"),
      locationId: optionalVercelString(input, "locationId"),
      orderId: optionalVercelString(input, "orderId"),
      referenceId: optionalVercelString(input, "referenceId"),
      note: optionalVercelString(input, "note"),
      autocomplete: optionalVercelBoolean(input, "autocomplete"),
    }),
  "square:get-payment": (input) =>
    squareRequest(["payments", "get"], {
      paymentId: requiredVercelString(input, "paymentId"),
    }),
  "square:list-payments": (input) =>
    squareRequest(
      ["payments", "list"],
      definedVercelFields({
        locationId: optionalVercelString(input, "locationId"),
        beginTime: optionalVercelString(input, "beginTime"),
        endTime: optionalVercelString(input, "endTime"),
        limit: optionalVercelNumber(input, "limit"),
        cursor: optionalVercelString(input, "cursor"),
      }),
    ),
  "square:cancel-payment": (input) =>
    squareRequest(["payments", "cancel"], {
      paymentId: requiredVercelString(input, "paymentId"),
    }),
  "square:complete-payment": (input) =>
    squareRequest(
      ["payments", "complete"],
      definedVercelFields({
        paymentId: requiredVercelString(input, "paymentId"),
        versionToken: optionalVercelString(input, "versionToken"),
      }),
    ),
  "square:refund-payment": (input) =>
    squareRequest(
      ["refunds", "refundPayment"],
      definedVercelFields({
        idempotencyKey: squareIdempotencyKey(input),
        paymentId: requiredVercelString(input, "paymentId"),
        amountMoney: requiredSquareMoney(input),
        reason: optionalVercelString(input, "reason"),
      }),
    ),
  "square:get-refund": (input) =>
    squareRequest(["refunds", "get"], {
      refundId: requiredVercelString(input, "refundId"),
    }),
  "square:list-refunds": (input) =>
    squareRequest(
      ["refunds", "list"],
      definedVercelFields({
        locationId: optionalVercelString(input, "locationId"),
        status: optionalVercelString(input, "status"),
        beginTime: optionalVercelString(input, "beginTime"),
        endTime: optionalVercelString(input, "endTime"),
        limit: optionalVercelNumber(input, "limit"),
        cursor: optionalVercelString(input, "cursor"),
      }),
    ),
  "square:create-customer": (input) =>
    squareRequest(
      ["customers", "create"],
      definedVercelFields({
        idempotencyKey: squareIdempotencyKey(input),
        givenName: optionalVercelString(input, "givenName"),
        familyName: optionalVercelString(input, "familyName"),
        companyName: optionalVercelString(input, "companyName"),
        nickname: optionalVercelString(input, "nickname"),
        emailAddress: optionalVercelString(input, "emailAddress"),
        phoneNumber: optionalVercelString(input, "phoneNumber"),
        birthday: optionalVercelString(input, "birthday"),
        note: optionalVercelString(input, "note"),
        referenceId: optionalVercelString(input, "referenceId"),
        address: squareOptionalRecord(input, "address"),
      }),
    ),
  "square:get-customer": (input) =>
    squareRequest(["customers", "get"], {
      customerId: requiredVercelString(input, "customerId"),
    }),
  "square:list-customers": (input) =>
    squareRequest(
      ["customers", "list"],
      definedVercelFields({
        limit: optionalVercelNumber(input, "limit"),
        cursor: optionalVercelString(input, "cursor"),
        sortField: optionalVercelString(input, "sortField"),
        sortOrder: optionalVercelString(input, "sortOrder"),
      }),
    ),
  "square:search-customers": (input) =>
    squareRequest(
      ["customers", "search"],
      definedVercelFields({
        query: squareOptionalRecord(input, "query"),
        limit: optionalVercelNumber(input, "limit"),
        cursor: optionalVercelString(input, "cursor"),
      }),
    ),
  "square:update-customer": (input) =>
    squareRequest(
      ["customers", "update"],
      definedVercelFields({
        customerId: requiredVercelString(input, "customerId"),
        givenName: optionalVercelString(input, "givenName"),
        familyName: optionalVercelString(input, "familyName"),
        companyName: optionalVercelString(input, "companyName"),
        nickname: optionalVercelString(input, "nickname"),
        emailAddress: optionalVercelString(input, "emailAddress"),
        phoneNumber: optionalVercelString(input, "phoneNumber"),
        birthday: optionalVercelString(input, "birthday"),
        note: optionalVercelString(input, "note"),
        referenceId: optionalVercelString(input, "referenceId"),
        address: squareOptionalRecord(input, "address"),
      }),
    ),
  "square:delete-customer": (input) =>
    squareRequest(["customers", "delete"], {
      customerId: requiredVercelString(input, "customerId"),
    }),
  "square:list-locations": () => squareRequest(["locations", "list"]),
  "square:get-location": (input) =>
    squareRequest(["locations", "get"], {
      locationId: requiredVercelString(input, "locationId"),
    }),
  "square:create-order": (input) =>
    squareRequest(["orders", "create"], {
      order:
        squareOptionalRecord(input, "order") ??
        (requiredSquareValue(input, "order") as Record<string, unknown>),
      idempotencyKey: squareIdempotencyKey(input),
    }),
  "square:get-order": (input) =>
    squareRequest(["orders", "get"], {
      orderId: requiredVercelString(input, "orderId"),
    }),
  "square:search-orders": (input) =>
    squareRequest(
      ["orders", "search"],
      definedVercelFields({
        locationIds: squareOptionalStringArray(input, "locationIds"),
        query: squareOptionalRecord(input, "query"),
        limit: optionalVercelNumber(input, "limit"),
        cursor: optionalVercelString(input, "cursor"),
      }),
    ),
  "square:pay-order": (input) =>
    squareRequest(
      ["orders", "pay"],
      definedVercelFields({
        orderId: requiredVercelString(input, "orderId"),
        orderVersion: optionalVercelNumber(input, "orderVersion"),
        paymentIds: requiredSquareStringArray(input, "paymentIds"),
        idempotencyKey: squareIdempotencyKey(input),
      }),
    ),
  "square:create-invoice": (input) =>
    squareRequest(["invoices", "create"], {
      invoice:
        squareOptionalRecord(input, "invoice") ??
        (requiredSquareValue(input, "invoice") as Record<string, unknown>),
      idempotencyKey: squareIdempotencyKey(input),
    }),
  "square:get-invoice": (input) =>
    squareRequest(["invoices", "get"], {
      invoiceId: requiredVercelString(input, "invoiceId"),
    }),
  "square:list-invoices": (input) =>
    squareRequest(
      ["invoices", "list"],
      definedVercelFields({
        locationId: requiredVercelString(input, "locationId"),
        limit: optionalVercelNumber(input, "limit"),
        cursor: optionalVercelString(input, "cursor"),
      }),
    ),
  "square:search-invoices": (input) =>
    squareRequest(
      ["invoices", "search"],
      definedVercelFields({
        query: squareOptionalRecord(input, "query") ?? {
          filter: {
            locationIds: [requiredVercelString(input, "locationId")],
          },
        },
        limit: optionalVercelNumber(input, "limit"),
        cursor: optionalVercelString(input, "cursor"),
      }),
    ),
  "square:publish-invoice": (input) =>
    squareRequest(
      ["invoices", "publish"],
      definedVercelFields({
        invoiceId: requiredVercelString(input, "invoiceId"),
        version: requiredSquareNumber(input, "version"),
        idempotencyKey: squareIdempotencyKey(input),
      }),
    ),
  "square:cancel-invoice": (input) =>
    squareRequest(["invoices", "cancel"], {
      invoiceId: requiredVercelString(input, "invoiceId"),
      version: requiredSquareNumber(input, "version"),
    }),
  "square:delete-invoice": (input) =>
    squareRequest(
      ["invoices", "delete"],
      definedVercelFields({
        invoiceId: requiredVercelString(input, "invoiceId"),
        version: requiredSquareNumber(input, "version"),
      }),
    ),
  "square:upsert-catalog-object": (input) =>
    squareRequest(["catalog", "object", "upsert"], {
      object:
        squareOptionalRecord(input, "object") ??
        (requiredSquareValue(input, "object") as Record<string, unknown>),
      idempotencyKey: squareIdempotencyKey(input),
    }),
  "square:get-catalog-object": (input) =>
    squareRequest(
      ["catalog", "object", "get"],
      definedVercelFields({
        objectId: requiredVercelString(input, "objectId"),
        includeRelatedObjects: optionalVercelBoolean(
          input,
          "includeRelatedObjects",
        ),
      }),
    ),
  "square:list-catalog": (input) =>
    squareRequest(
      ["catalog", "list"],
      definedVercelFields({
        types: optionalVercelString(input, "types"),
        cursor: optionalVercelString(input, "cursor"),
      }),
    ),
  "square:search-catalog-objects": (input) =>
    squareRequest(
      ["catalog", "search"],
      definedVercelFields({
        objectTypes: squareOptionalStringArray(input, "objectTypes"),
        query: squareOptionalRecord(input, "query"),
        limit: optionalVercelNumber(input, "limit"),
        cursor: optionalVercelString(input, "cursor"),
      }),
    ),
  "square:create-catalog-image": (input) =>
    squareRequest(["catalog", "images", "create"], {
      request: definedVercelFields({
        idempotencyKey: squareIdempotencyKey(input),
        objectId: optionalVercelString(input, "objectId"),
        caption: optionalVercelString(input, "caption"),
      }),
      imageFile: requiredSquareValue(input, "file"),
    }),
  "square:delete-catalog-object": (input) =>
    squareRequest(["catalog", "object", "delete"], {
      objectId: requiredVercelString(input, "objectId"),
    }),
  "square:batch-retrieve-inventory-counts": (input) =>
    squareRequest(
      ["inventory", "batchGetCounts"],
      definedVercelFields({
        catalogObjectIds: squareOptionalStringArray(input, "catalogObjectIds"),
        locationIds: squareOptionalStringArray(input, "locationIds"),
        states: squareOptionalStringArray(input, "states"),
        updatedAfter: optionalVercelString(input, "updatedAfter"),
        limit: optionalVercelNumber(input, "limit"),
        cursor: optionalVercelString(input, "cursor"),
      }),
    ),
};

function assertSquareOperationCoverage(): void {
  const expected = new Set(SQUARE_OPERATION_IDS);
  const implemented = Object.keys(SQUARE_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Square provider SDK operation coverage is incomplete.");
  }
}

/** All pinned Square actions run through Square's official Node.js SDK. */
export function createSquareProviderSdk(
  config: SquareProviderSdkConfig,
): IntegrationProviderSdk {
  assertSquareOperationCoverage();
  const clientFactory = config.clientFactory ?? createSquareClient;
  return {
    integrationId: "square",
    operationIds: SQUARE_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "square" ||
        invocation.reference.integrationId !== "square"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = SQUARE_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      const request = requestFactory({
        ...invocation.input,
        ...(invocation.idempotencyKey
          ? { idempotencyKey: invocation.idempotencyKey }
          : {}),
      });
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: normalizeSquareOutput(
            await invokeSquareMethod(clientFactory(credential.apiKey), request),
          ),
        }),
      );
    },
  };
}

export function getSquareProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertSquareOperationCoverage();
  return {
    operations: SQUARE_OPERATION_IDS.length,
    operationIds: SQUARE_OPERATION_IDS,
  };
}

type GoogleCalendarSdkClient = Record<string, unknown>;
type GoogleCalendarClientFactory = (
  accessToken: string,
) => GoogleCalendarSdkClient;

export interface GoogleCalendarProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleCalendarClientFactory;
}

function createGoogleCalendarClient(
  accessToken: string,
): GoogleCalendarSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({
    version: "v3",
    auth,
  }) as unknown as GoogleCalendarSdkClient;
}

const GOOGLE_CALENDAR_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-calendar",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleCalendarSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleCalendarRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleCalendarSdkRequest {
  return { path, arguments: [definedVercelFields(request)] };
}

function googleCalendarId(input: Readonly<Record<string, unknown>>): string {
  return optionalVercelString(input, "calendarId") ?? "primary";
}

function googleCalendarDateTime(
  input: Readonly<Record<string, unknown>>,
  name: string,
  required: boolean,
): Record<string, unknown> | undefined {
  const value = optionalVercelString(input, name);
  if (!value) {
    if (required) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return { date: value };
  return definedVercelFields({
    dateTime: value,
    timeZone: optionalVercelString(input, "timeZone"),
  });
}

function googleCalendarRecurrence(
  input: Readonly<Record<string, unknown>>,
): string[] | undefined {
  const value = input.recurrence;
  if (value === undefined || value === null || value === "") return undefined;
  const recurrence = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/u)
      : undefined;
  if (
    !recurrence ||
    recurrence.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return recurrence.map((entry) => entry.trim());
}

function googleCalendarAttendees(
  input: Readonly<Record<string, unknown>>,
): Array<{ email: string }> | undefined {
  const attendees = squareOptionalStringArray(input, "attendees");
  return attendees?.map((email) => ({ email }));
}

function googleCalendarConferenceData(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> | undefined {
  if (!optionalVercelBoolean(input, "addGoogleMeet")) return undefined;
  return { createRequest: { requestId: crypto.randomUUID() } };
}

function googleCalendarEventBody(
  input: Readonly<Record<string, unknown>>,
  options: { requireSummary: boolean; requireTimes: boolean },
): Record<string, unknown> {
  const summary = optionalVercelString(input, "summary");
  if (options.requireSummary && !summary) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return definedVercelFields({
    summary,
    description: optionalVercelString(input, "description"),
    location: optionalVercelString(input, "location"),
    start: googleCalendarDateTime(input, "startDateTime", options.requireTimes),
    end: googleCalendarDateTime(input, "endDateTime", options.requireTimes),
    attendees: googleCalendarAttendees(input),
    recurrence: googleCalendarRecurrence(input),
    conferenceData: googleCalendarConferenceData(input),
  });
}

function googleCalendarScope(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const type = requiredVercelString(input, "scopeType");
  const value = optionalVercelString(input, "scopeValue");
  if (type !== "default" && !value) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return definedVercelFields({ type, value });
}

const GOOGLE_CALENDAR_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleCalendarSdkRequest
  >
> = {
  "google-calendar:create-event": (input) =>
    googleCalendarRequest(["events", "insert"], {
      calendarId: googleCalendarId(input),
      requestBody: googleCalendarEventBody(input, {
        requireSummary: true,
        requireTimes: true,
      }),
      sendUpdates: optionalVercelString(input, "sendUpdates"),
      conferenceDataVersion: optionalVercelBoolean(input, "addGoogleMeet")
        ? 1
        : undefined,
    }),
  "google-calendar:list-events": (input) =>
    googleCalendarRequest(["events", "list"], {
      calendarId: googleCalendarId(input),
      timeMin: optionalVercelString(input, "timeMin"),
      timeMax: optionalVercelString(input, "timeMax"),
      q: optionalVercelString(input, "q"),
      maxResults: optionalVercelNumber(input, "maxResults"),
      pageToken: optionalVercelString(input, "pageToken"),
      singleEvents: optionalVercelBoolean(input, "singleEvents") ?? true,
      orderBy: optionalVercelString(input, "orderBy") ?? "startTime",
      showDeleted: optionalVercelBoolean(input, "showDeleted"),
    }),
  "google-calendar:get-event": (input) =>
    googleCalendarRequest(["events", "get"], {
      calendarId: googleCalendarId(input),
      eventId: requiredVercelString(input, "eventId"),
    }),
  "google-calendar:update-event": (input) =>
    googleCalendarRequest(["events", "patch"], {
      calendarId: googleCalendarId(input),
      eventId: requiredVercelString(input, "eventId"),
      requestBody: googleCalendarEventBody(input, {
        requireSummary: false,
        requireTimes: false,
      }),
      sendUpdates: optionalVercelString(input, "sendUpdates"),
      conferenceDataVersion: optionalVercelBoolean(input, "addGoogleMeet")
        ? 1
        : undefined,
    }),
  "google-calendar:delete-event": (input) =>
    googleCalendarRequest(["events", "delete"], {
      calendarId: googleCalendarId(input),
      eventId: requiredVercelString(input, "eventId"),
      sendUpdates: optionalVercelString(input, "sendUpdates"),
    }),
  "google-calendar:move-event": (input) =>
    googleCalendarRequest(["events", "move"], {
      calendarId: googleCalendarId(input),
      eventId: requiredVercelString(input, "eventId"),
      destination: requiredVercelString(input, "destinationCalendarId"),
      sendUpdates: optionalVercelString(input, "sendUpdates"),
    }),
  "google-calendar:get-recurring-instances": (input) =>
    googleCalendarRequest(["events", "instances"], {
      calendarId: googleCalendarId(input),
      eventId: requiredVercelString(input, "eventId"),
      timeMin: optionalVercelString(input, "timeMin"),
      timeMax: optionalVercelString(input, "timeMax"),
      maxResults: optionalVercelNumber(input, "maxResults"),
      pageToken: optionalVercelString(input, "pageToken"),
      showDeleted: optionalVercelBoolean(input, "showDeleted"),
    }),
  "google-calendar:list-calendars": (input) =>
    googleCalendarRequest(["calendarList", "list"], {
      minAccessRole: optionalVercelString(input, "minAccessRole"),
      maxResults: optionalVercelNumber(input, "maxResults"),
      pageToken: optionalVercelString(input, "pageToken"),
      showDeleted: optionalVercelBoolean(input, "showDeleted"),
      showHidden: optionalVercelBoolean(input, "showHidden"),
    }),
  "google-calendar:quick-add-natural-language": (input) =>
    googleCalendarRequest(["events", "quickAdd"], {
      calendarId: googleCalendarId(input),
      text: requiredVercelString(input, "text"),
      sendUpdates: optionalVercelString(input, "sendUpdates"),
    }),
  "google-calendar:check-free-busy": (input) =>
    googleCalendarRequest(["freebusy", "query"], {
      requestBody: definedVercelFields({
        timeMin: requiredVercelString(input, "timeMin"),
        timeMax: requiredVercelString(input, "timeMax"),
        timeZone: optionalVercelString(input, "timeZone") ?? "UTC",
        items: requiredSquareStringArray(input, "calendarIds").map((id) => ({
          id,
        })),
      }),
    }),
  "google-calendar:create-calendar": (input) =>
    googleCalendarRequest(["calendars", "insert"], {
      requestBody: definedVercelFields({
        summary: requiredVercelString(input, "summary"),
        description: optionalVercelString(input, "description"),
        location: optionalVercelString(input, "location"),
        timeZone: optionalVercelString(input, "timeZone"),
      }),
    }),
  "google-calendar:update-calendar": (input) =>
    googleCalendarRequest(["calendars", "patch"], {
      calendarId: googleCalendarId(input),
      requestBody: definedVercelFields({
        summary: optionalVercelString(input, "summary"),
        description: optionalVercelString(input, "description"),
        location: optionalVercelString(input, "location"),
        timeZone: optionalVercelString(input, "timeZone"),
      }),
    }),
  "google-calendar:delete-calendar": (input) =>
    googleCalendarRequest(["calendars", "delete"], {
      calendarId: requiredVercelString(input, "calendarId"),
    }),
  "google-calendar:share-calendar": (input) =>
    googleCalendarRequest(["acl", "insert"], {
      calendarId: googleCalendarId(input),
      requestBody: {
        role: requiredVercelString(input, "role"),
        scope: googleCalendarScope(input),
      },
      sendNotifications: optionalVercelBoolean(input, "sendNotifications"),
    }),
  "google-calendar:update-sharing": (input) =>
    googleCalendarRequest(["acl", "patch"], {
      calendarId: googleCalendarId(input),
      ruleId: requiredVercelString(input, "ruleId"),
      requestBody: { role: requiredVercelString(input, "role") },
      sendNotifications: optionalVercelBoolean(input, "sendNotifications"),
    }),
  "google-calendar:list-sharing": (input) =>
    googleCalendarRequest(["acl", "list"], {
      calendarId: googleCalendarId(input),
      maxResults: optionalVercelNumber(input, "maxResults"),
      pageToken: optionalVercelString(input, "pageToken"),
      showDeleted: optionalVercelBoolean(input, "showDeleted"),
    }),
  "google-calendar:remove-sharing": (input) =>
    googleCalendarRequest(["acl", "delete"], {
      calendarId: googleCalendarId(input),
      ruleId: requiredVercelString(input, "ruleId"),
    }),
};

function assertGoogleCalendarOperationCoverage(): void {
  const expected = new Set(GOOGLE_CALENDAR_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_CALENDAR_OPERATION_REQUESTS);
  const requiredMultiCallOperations = new Set([
    "google-calendar:invite-attendees",
  ]);
  if (
    expected.size !== implemented.length + requiredMultiCallOperations.size ||
    implemented.some((operationId) => !expected.has(operationId)) ||
    [...requiredMultiCallOperations].some(
      (operationId) => !expected.has(operationId),
    )
  ) {
    throw new Error(
      "Google Calendar provider SDK operation coverage is incomplete.",
    );
  }
}

function googleCalendarResponseData(value: unknown): unknown {
  if (value && typeof value === "object" && "data" in value) {
    return (value as { data: unknown }).data;
  }
  return value;
}

async function invokeGoogleCalendarInvite(
  client: GoogleCalendarSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const calendarId = googleCalendarId(input);
  const eventId = requiredVercelString(input, "eventId");
  const requestedAttendees = googleCalendarAttendees(input) ?? [];
  if (!requestedAttendees.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const current = googleCalendarResponseData(
    await invokeSquareMethod(
      client,
      googleCalendarRequest(["events", "get"], { calendarId, eventId }),
    ),
  );
  const currentRecord =
    current && typeof current === "object"
      ? (current as Record<string, unknown>)
      : undefined;
  const existing =
    currentRecord && Array.isArray(currentRecord.attendees)
      ? currentRecord.attendees.filter(
          (attendee): attendee is { email: string } =>
            Boolean(
              attendee &&
              typeof attendee === "object" &&
              typeof attendee.email === "string",
            ),
        )
      : [];
  const attendees = optionalVercelBoolean(input, "replaceExisting")
    ? requestedAttendees
    : [
        ...existing,
        ...requestedAttendees.filter(
          (attendee) =>
            !existing.some(
              (currentAttendee) =>
                currentAttendee.email.toLowerCase() ===
                attendee.email.toLowerCase(),
            ),
        ),
      ];
  return invokeSquareMethod(
    client,
    googleCalendarRequest(["events", "patch"], {
      calendarId,
      eventId,
      requestBody: { attendees },
      sendUpdates: optionalVercelString(input, "sendUpdates") ?? "all",
    }),
  );
}

async function invokeGoogleCalendarQuickAdd(
  client: GoogleCalendarSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const result = await invokeSquareMethod(
    client,
    GOOGLE_CALENDAR_OPERATION_REQUESTS[
      "google-calendar:quick-add-natural-language"
    ](input),
  );
  const event = googleCalendarResponseData(result);
  const eventRecord =
    event && typeof event === "object"
      ? (event as Record<string, unknown>)
      : undefined;
  const attendees = googleCalendarAttendees(input);
  const eventId =
    typeof eventRecord?.id === "string" ? eventRecord.id : undefined;
  if (!attendees?.length || !eventId) return result;
  return invokeSquareMethod(
    client,
    googleCalendarRequest(["events", "patch"], {
      calendarId: googleCalendarId(input),
      eventId,
      requestBody: { attendees },
      sendUpdates: optionalVercelString(input, "sendUpdates"),
    }),
  );
}

/** All pinned Google Calendar actions use Google's official Node.js SDK. */
export function createGoogleCalendarProviderSdk(
  config: GoogleCalendarProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleCalendarOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleCalendarClient;
  return {
    integrationId: "google-calendar",
    operationIds: GOOGLE_CALENDAR_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-calendar" ||
        invocation.reference.integrationId !== "google-calendar"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_CALENDAR_OPERATION_REQUESTS[invocation.operationId];
      if (
        !requestFactory &&
        invocation.operationId !== "google-calendar:invite-attendees"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const client = clientFactory(credential.accessToken);
          const result =
            invocation.operationId === "google-calendar:invite-attendees"
              ? await invokeGoogleCalendarInvite(client, invocation.input)
              : invocation.operationId ===
                  "google-calendar:quick-add-natural-language"
                ? await invokeGoogleCalendarQuickAdd(client, invocation.input)
                : await invokeSquareMethod(
                    client,
                    requestFactory!(invocation.input),
                  );
          return {
            operationId: invocation.operationId,
            output: googleCalendarResponseData(result),
          };
        },
      );
    },
  };
}

export function getGoogleCalendarProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleCalendarOperationCoverage();
  return {
    operations: GOOGLE_CALENDAR_OPERATION_IDS.length,
    operationIds: GOOGLE_CALENDAR_OPERATION_IDS,
  };
}

type GoogleDriveSdkClient = Record<string, unknown>;
type GoogleDriveClientFactory = (accessToken: string) => GoogleDriveSdkClient;

export interface GoogleDriveProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleDriveClientFactory;
}

function createGoogleDriveClient(accessToken: string): GoogleDriveSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({
    version: "v3",
    auth,
  }) as unknown as GoogleDriveSdkClient;
}

const GOOGLE_DRIVE_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-drive",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleDriveSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleDriveRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleDriveSdkRequest {
  return { path, arguments: [definedVercelFields(request)] };
}

function googleDriveOptionalFolderId(
  input: Readonly<Record<string, unknown>>,
): string | undefined {
  return (
    optionalVercelString(input, "folderSelector") ??
    optionalVercelString(input, "folderId")
  );
}

function escapeGoogleDriveQuery(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function googleDriveListQuery(
  input: Readonly<Record<string, unknown>>,
): string {
  const conditions = ["trashed = false"];
  const folderId = googleDriveOptionalFolderId(input);
  if (folderId)
    conditions.push(`'${escapeGoogleDriveQuery(folderId)}' in parents`);
  const query = optionalVercelString(input, "query");
  if (query)
    conditions.push(`name contains '${escapeGoogleDriveQuery(query)}'`);
  return conditions.join(" and ");
}

function googleDriveSearchQuery(
  input: Readonly<Record<string, unknown>>,
): string {
  const query = optionalVercelString(input, "query");
  if (!query) return "trashed = false";
  return /\btrashed\s*=/u.test(query) ? query : `${query} and trashed = false`;
}

function googleDriveMediaBody(
  input: Readonly<Record<string, unknown>>,
): unknown {
  const value = input.file ?? input.content;
  if (value === undefined || value === null || value === "") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

function googleDriveResponseData(value: unknown): unknown {
  const data = googleCalendarResponseData(value);
  if (data instanceof ArrayBuffer) {
    return {
      content: Buffer.from(data).toString("base64"),
      encoding: "base64",
    };
  }
  if (ArrayBuffer.isView(data)) {
    return {
      content: Buffer.from(
        data.buffer,
        data.byteOffset,
        data.byteLength,
      ).toString("base64"),
      encoding: "base64",
    };
  }
  return data;
}

const GOOGLE_DRIVE_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleDriveSdkRequest
  >
> = {
  "google-drive:list-files": (input) =>
    googleDriveRequest(["files", "list"], {
      q: googleDriveListQuery(input),
      pageSize: optionalVercelNumber(input, "pageSize"),
      pageToken: optionalVercelString(input, "pageToken"),
      fields: "files(*),nextPageToken",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }),
  "google-drive:search-files": (input) =>
    googleDriveRequest(["files", "list"], {
      q: googleDriveSearchQuery(input),
      pageSize: optionalVercelNumber(input, "pageSize"),
      pageToken: optionalVercelString(input, "pageToken"),
      fields: "files(*),nextPageToken",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }),
  "google-drive:get-file-info": (input) =>
    googleDriveRequest(["files", "get"], {
      fileId: requiredVercelString(input, "fileId"),
      fields: "*",
      supportsAllDrives: true,
    }),
  "google-drive:get-file-content": (input) =>
    googleDriveRequest(["files", "get"], {
      fileId: requiredVercelString(input, "fileId"),
      alt: "media",
      responseType: "arraybuffer",
      supportsAllDrives: true,
    }),
  "google-drive:create-folder": (input) =>
    googleDriveRequest(["files", "create"], {
      requestBody: definedVercelFields({
        name: requiredVercelString(input, "fileName"),
        mimeType: "application/vnd.google-apps.folder",
        parents: googleDriveOptionalFolderId(input)
          ? [googleDriveOptionalFolderId(input)]
          : undefined,
      }),
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:create-file": (input) =>
    googleDriveRequest(["files", "create"], {
      requestBody: definedVercelFields({
        name: requiredVercelString(input, "fileName"),
        mimeType: optionalVercelString(input, "mimeType") ?? "text/plain",
        parents: googleDriveOptionalFolderId(input)
          ? [googleDriveOptionalFolderId(input)]
          : undefined,
      }),
      media: {
        mimeType: optionalVercelString(input, "mimeType") ?? "text/plain",
        body: googleDriveMediaBody(input),
      },
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:upload-file": (input) =>
    googleDriveRequest(["files", "create"], {
      requestBody: definedVercelFields({
        name: requiredVercelString(input, "fileName"),
        mimeType: optionalVercelString(input, "mimeType") ?? "text/plain",
        parents: googleDriveOptionalFolderId(input)
          ? [googleDriveOptionalFolderId(input)]
          : undefined,
      }),
      media: {
        mimeType: optionalVercelString(input, "mimeType") ?? "text/plain",
        body: googleDriveMediaBody(input),
      },
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:download-file": (input) =>
    googleDriveRequest(["files", "get"], {
      fileId: requiredVercelString(input, "fileId"),
      alt: "media",
      responseType: "arraybuffer",
      supportsAllDrives: true,
    }),
  "google-drive:copy-file": (input) =>
    googleDriveRequest(["files", "copy"], {
      fileId: requiredVercelString(input, "fileId"),
      requestBody: definedVercelFields({
        name: optionalVercelString(input, "newName"),
        parents: optionalVercelString(input, "destinationFolderId")
          ? [optionalVercelString(input, "destinationFolderId")]
          : undefined,
      }),
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:update-file": (input) =>
    googleDriveRequest(["files", "update"], {
      fileId: requiredVercelString(input, "fileId"),
      requestBody: definedVercelFields({
        name: optionalVercelString(input, "name"),
        description: optionalVercelString(input, "description"),
        starred: optionalVercelBoolean(input, "starred"),
      }),
      addParents: optionalVercelString(input, "addParents"),
      removeParents: optionalVercelString(input, "removeParents"),
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:move-to-trash": (input) =>
    googleDriveRequest(["files", "update"], {
      fileId: requiredVercelString(input, "fileId"),
      requestBody: { trashed: true },
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:restore-from-trash": (input) =>
    googleDriveRequest(["files", "update"], {
      fileId: requiredVercelString(input, "fileId"),
      requestBody: { trashed: false },
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:delete-permanently": (input) =>
    googleDriveRequest(["files", "delete"], {
      fileId: requiredVercelString(input, "fileId"),
      supportsAllDrives: true,
    }),
  "google-drive:share-file": (input) =>
    googleDriveRequest(
      ["permissions", "create"],
      (() => {
        const transferOwnership = optionalVercelBoolean(
          input,
          "transferOwnership",
        );
        return {
          fileId: requiredVercelString(input, "fileId"),
          requestBody: definedVercelFields({
            type: requiredVercelString(input, "type"),
            role: requiredVercelString(input, "role"),
            emailAddress: optionalVercelString(input, "email"),
            domain: optionalVercelString(input, "domain"),
          }),
          transferOwnership,
          moveToNewOwnersRoot: optionalVercelBoolean(
            input,
            "moveToNewOwnersRoot",
          ),
          sendNotificationEmail:
            transferOwnership === true
              ? true
              : optionalVercelBoolean(input, "sendNotification"),
          emailMessage: optionalVercelString(input, "emailMessage"),
          supportsAllDrives: true,
        };
      })(),
    ),
  "google-drive:remove-sharing": (input) =>
    googleDriveRequest(["permissions", "delete"], {
      fileId: requiredVercelString(input, "fileId"),
      permissionId: requiredVercelString(input, "permissionId"),
      supportsAllDrives: true,
    }),
  "google-drive:list-permissions": (input) =>
    googleDriveRequest(["permissions", "list"], {
      fileId: requiredVercelString(input, "fileId"),
      pageToken: optionalVercelString(input, "pageToken"),
      supportsAllDrives: true,
      fields: "nextPageToken,permissions(*)",
    }),
  "google-drive:export-file": (input) =>
    googleDriveRequest(["files", "export"], {
      fileId: requiredVercelString(input, "fileId"),
      mimeType: requiredVercelString(input, "mimeType"),
      responseType: "arraybuffer",
    }),
  "google-drive:list-revisions": (input) =>
    googleDriveRequest(["revisions", "list"], {
      fileId: requiredVercelString(input, "fileId"),
      pageSize: optionalVercelNumber(input, "pageSize"),
      pageToken: optionalVercelString(input, "pageToken"),
      fields: "nextPageToken,revisions(*)",
    }),
  "google-drive:get-revision": (input) =>
    googleDriveRequest(["revisions", "get"], {
      fileId: requiredVercelString(input, "fileId"),
      revisionId: requiredVercelString(input, "revisionId"),
      fields: "*",
    }),
  "google-drive:list-comments": (input) =>
    googleDriveRequest(["comments", "list"], {
      fileId: requiredVercelString(input, "fileId"),
      includeDeleted: optionalVercelBoolean(input, "includeDeleted"),
      pageSize: optionalVercelNumber(input, "pageSize"),
      startModifiedTime: optionalVercelString(input, "startModifiedTime"),
      pageToken: optionalVercelString(input, "pageToken"),
      fields: "nextPageToken,comments(*)",
    }),
  "google-drive:create-comment": (input) =>
    googleDriveRequest(["comments", "create"], {
      fileId: requiredVercelString(input, "fileId"),
      requestBody: definedVercelFields({
        content: requiredVercelString(input, "content"),
        anchor: optionalVercelString(input, "anchor"),
      }),
      fields: "*",
    }),
  "google-drive:delete-comment": (input) =>
    googleDriveRequest(["comments", "delete"], {
      fileId: requiredVercelString(input, "fileId"),
      commentId: requiredVercelString(input, "commentId"),
    }),
  "google-drive:get-drive-info": () =>
    googleDriveRequest(["about", "get"], { fields: "*" }),
};

function assertGoogleDriveOperationCoverage(): void {
  const expected = new Set(GOOGLE_DRIVE_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_DRIVE_OPERATION_REQUESTS);
  const specialOperations = new Set(["google-drive:move-file"]);
  if (
    expected.size !== implemented.length + specialOperations.size ||
    implemented.some((operationId) => !expected.has(operationId)) ||
    [...specialOperations].some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Drive provider SDK operation coverage is incomplete.",
    );
  }
}

async function invokeGoogleDriveMove(
  client: GoogleDriveSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const fileId = requiredVercelString(input, "fileId");
  const destinationFolderId = requiredVercelString(
    input,
    "destinationFolderId",
  );
  const existing = googleDriveResponseData(
    await invokeSquareMethod(
      client,
      googleDriveRequest(["files", "get"], {
        fileId,
        fields: "parents",
        supportsAllDrives: true,
      }),
    ),
  );
  const existingRecord =
    existing && typeof existing === "object"
      ? (existing as Record<string, unknown>)
      : undefined;
  const removeParents =
    optionalVercelBoolean(input, "removeFromCurrent") === false
      ? undefined
      : Array.isArray(existingRecord?.parents)
        ? existingRecord.parents
            .filter((parent): parent is string => typeof parent === "string")
            .join(",")
        : undefined;
  return invokeSquareMethod(
    client,
    googleDriveRequest(["files", "update"], {
      fileId,
      addParents: destinationFolderId,
      removeParents,
      requestBody: {},
      supportsAllDrives: true,
      fields: "*",
    }),
  );
}

/** All pinned Google Drive actions use Google's official Node.js SDK. */
export function createGoogleDriveProviderSdk(
  config: GoogleDriveProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleDriveOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleDriveClient;
  return {
    integrationId: "google-drive",
    operationIds: GOOGLE_DRIVE_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-drive" ||
        invocation.reference.integrationId !== "google-drive"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_DRIVE_OPERATION_REQUESTS[invocation.operationId];
      if (
        !requestFactory &&
        invocation.operationId !== "google-drive:move-file"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const client = clientFactory(credential.accessToken);
          const result =
            invocation.operationId === "google-drive:move-file"
              ? await invokeGoogleDriveMove(client, invocation.input)
              : await invokeSquareMethod(
                  client,
                  requestFactory!(invocation.input),
                );
          return {
            operationId: invocation.operationId,
            output: googleDriveResponseData(result),
          };
        },
      );
    },
  };
}

export function getGoogleDriveProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleDriveOperationCoverage();
  return {
    operations: GOOGLE_DRIVE_OPERATION_IDS.length,
    operationIds: GOOGLE_DRIVE_OPERATION_IDS,
  };
}

type GoogleSheetsSdkClient = Record<string, unknown>;
type GoogleSheetsClientFactory = (accessToken: string) => GoogleSheetsSdkClient;

export interface GoogleSheetsProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleSheetsClientFactory;
}

function createGoogleSheetsClient(accessToken: string): GoogleSheetsSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

const GOOGLE_SHEETS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-sheets",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleSheetsSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleSheetsRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleSheetsSdkRequest {
  return { path, arguments: [definedVercelFields(request)] };
}

function googleSheetsRange(
  input: Readonly<Record<string, unknown>>,
  fallback: string,
): string {
  const range = optionalVercelString(input, "range");
  if (range) return range;
  const sheetName = optionalVercelString(input, "sheetName");
  const cellRange = optionalVercelString(input, "cellRange");
  if (sheetName && cellRange) return `${sheetName}!${cellRange}`;
  if (sheetName) return sheetName;
  return fallback;
}

function googleSheetsValues(
  input: Readonly<Record<string, unknown>>,
): unknown[][] {
  const rawValues = requiredSquareValue(input, "values");
  if (!Array.isArray(rawValues)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  if (
    rawValues.length > 0 &&
    rawValues[0] &&
    typeof rawValues[0] === "object" &&
    !Array.isArray(rawValues[0])
  ) {
    const records = rawValues as Array<Record<string, unknown>>;
    const headers = [
      ...new Set(records.flatMap((record) => Object.keys(record))),
    ];
    return [
      headers,
      ...records.map((record) =>
        headers.map((header) => {
          const value = record[header];
          return value && typeof value === "object"
            ? JSON.stringify(value)
            : (value ?? "");
        }),
      ),
    ];
  }
  if (rawValues.some((row) => !Array.isArray(row))) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return rawValues as unknown[][];
}

function googleSheetsValueRange(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    majorDimension: optionalVercelString(input, "majorDimension") ?? "ROWS",
    values: googleSheetsValues(input),
  };
}

const GOOGLE_SHEETS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleSheetsSdkRequest
  >
> = {
  "google-sheets:read-data": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "get"], {
      spreadsheetId: requiredVercelString(input, "spreadsheetId"),
      range: googleSheetsRange(input, "A1:Z1000"),
    }),
  "google-sheets:write-data": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "update"], {
      spreadsheetId: requiredVercelString(input, "spreadsheetId"),
      range: googleSheetsRange(input, "Sheet1!A2"),
      valueInputOption:
        optionalVercelString(input, "valueInputOption") ?? "USER_ENTERED",
      includeValuesInResponse: optionalVercelBoolean(
        input,
        "includeValuesInResponse",
      ),
      responseValueRenderOption: optionalVercelString(
        input,
        "responseValueRenderOption",
      ),
      requestBody: googleSheetsValueRange(input),
    }),
  "google-sheets:update-data": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "update"], {
      spreadsheetId: requiredVercelString(input, "spreadsheetId"),
      range: googleSheetsRange(input, "Sheet1!A2"),
      valueInputOption:
        optionalVercelString(input, "valueInputOption") ?? "USER_ENTERED",
      includeValuesInResponse: optionalVercelBoolean(
        input,
        "includeValuesInResponse",
      ),
      responseValueRenderOption: optionalVercelString(
        input,
        "responseValueRenderOption",
      ),
      requestBody: googleSheetsValueRange(input),
    }),
  "google-sheets:append-data": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "append"], {
      spreadsheetId: requiredVercelString(input, "spreadsheetId"),
      range: googleSheetsRange(input, "Sheet1!A1"),
      valueInputOption:
        optionalVercelString(input, "valueInputOption") ?? "USER_ENTERED",
      insertDataOption: optionalVercelString(input, "insertDataOption"),
      includeValuesInResponse: optionalVercelBoolean(
        input,
        "includeValuesInResponse",
      ),
      responseValueRenderOption: optionalVercelString(
        input,
        "responseValueRenderOption",
      ),
      requestBody: googleSheetsValueRange(input),
    }),
  "google-sheets:clear-data": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "clear"], {
      spreadsheetId: requiredVercelString(input, "spreadsheetId"),
      range: googleSheetsRange(input, "Sheet1"),
      requestBody: {},
    }),
  "google-sheets:get-spreadsheet-info": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "get"], {
      spreadsheetId: requiredVercelString(input, "spreadsheetId"),
      includeGridData: optionalVercelBoolean(input, "includeGridData"),
    }),
  "google-sheets:create-spreadsheet": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "create"], {
      requestBody: definedVercelFields({
        properties: definedVercelFields({
          title: requiredVercelString(input, "title"),
          locale: optionalVercelString(input, "locale"),
          timeZone: optionalVercelString(input, "timeZone"),
        }),
        sheets: squareOptionalStringArray(input, "sheetTitles")?.map(
          (title) => ({
            properties: { title },
          }),
        ),
      }),
    }),
  "google-sheets:batch-read": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "batchGet"], {
      spreadsheetId: requiredVercelString(input, "spreadsheetId"),
      ranges: requiredSquareStringArray(input, "ranges"),
      majorDimension: optionalVercelString(input, "majorDimension"),
      valueRenderOption: optionalVercelString(input, "valueRenderOption"),
      dateTimeRenderOption: optionalVercelString(input, "dateTimeRenderOption"),
    }),
  "google-sheets:batch-update": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "batchUpdate"], {
      spreadsheetId: requiredVercelString(input, "spreadsheetId"),
      requestBody: definedVercelFields({
        data: requiredSquareValue(input, "data"),
        valueInputOption:
          optionalVercelString(input, "valueInputOption") ?? "USER_ENTERED",
        includeValuesInResponse: optionalVercelBoolean(
          input,
          "includeValuesInResponse",
        ),
        responseValueRenderOption: optionalVercelString(
          input,
          "responseValueRenderOption",
        ),
      }),
    }),
  "google-sheets:batch-clear": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "batchClear"], {
      spreadsheetId: requiredVercelString(input, "spreadsheetId"),
      requestBody: { ranges: requiredSquareStringArray(input, "ranges") },
    }),
  "google-sheets:copy-sheet": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "sheets", "copyTo"], {
      spreadsheetId: requiredVercelString(input, "sourceSpreadsheetId"),
      sheetId: requiredSquareNumber(input, "sheetId"),
      requestBody: {
        destinationSpreadsheetId: requiredVercelString(
          input,
          "destinationSpreadsheetId",
        ),
      },
    }),
  "google-sheets:delete-rows": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "batchUpdate"], {
      spreadsheetId: requiredVercelString(input, "spreadsheetId"),
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: requiredSquareNumber(input, "sheetId"),
                dimension: "ROWS",
                startIndex: requiredSquareNumber(input, "startIndex"),
                endIndex: requiredSquareNumber(input, "endIndex"),
              },
            },
          },
        ],
      },
    }),
  "google-sheets:delete-sheet": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "batchUpdate"], {
      spreadsheetId: requiredVercelString(input, "spreadsheetId"),
      requestBody: {
        requests: [
          { deleteSheet: { sheetId: requiredSquareNumber(input, "sheetId") } },
        ],
      },
    }),
  "google-sheets:delete-spreadsheet": (input) =>
    googleSheetsRequest(["drive", "files", "delete"], {
      fileId: requiredVercelString(input, "spreadsheetId"),
    }),
};

function assertGoogleSheetsOperationCoverage(): void {
  const expected = new Set(GOOGLE_SHEETS_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_SHEETS_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Sheets provider SDK operation coverage is incomplete.",
    );
  }
}

/** All pinned Google Sheets actions use Google's official Node.js SDK. */
export function createGoogleSheetsProviderSdk(
  config: GoogleSheetsProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleSheetsOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleSheetsClient;
  return {
    integrationId: "google-sheets",
    operationIds: GOOGLE_SHEETS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-sheets" ||
        invocation.reference.integrationId !== "google-sheets"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_SHEETS_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: googleCalendarResponseData(
            await invokeSquareMethod(
              clientFactory(credential.accessToken),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getGoogleSheetsProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleSheetsOperationCoverage();
  return {
    operations: GOOGLE_SHEETS_OPERATION_IDS.length,
    operationIds: GOOGLE_SHEETS_OPERATION_IDS,
  };
}

type GoogleDocsSdkClient = Record<string, unknown>;
type GoogleDocsClientFactory = (accessToken: string) => GoogleDocsSdkClient;

export interface GoogleDocsProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleDocsClientFactory;
}

function createGoogleDocsClient(accessToken: string): GoogleDocsSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return {
    docs: google.docs({ version: "v1", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

const GOOGLE_DOCS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-docs",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleDocsSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleDocsRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleDocsSdkRequest {
  return { path, arguments: [definedVercelFields(request)] };
}

function googleDocsId(input: Readonly<Record<string, unknown>>): string {
  return (
    optionalVercelString(input, "documentId") ??
    requiredVercelString(input, "manualDocumentId")
  );
}

function googleDocsRange(
  input: Readonly<Record<string, unknown>>,
): Record<string, number> {
  const startIndex = requiredSquareNumber(input, "startIndex");
  const endIndex = requiredSquareNumber(input, "endIndex");
  if (endIndex <= startIndex) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return { startIndex, endIndex };
}

function googleDocsLocation(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const index = optionalVercelNumber(input, "index");
  return index !== undefined && index >= 1
    ? { location: { index } }
    : { endOfSegmentLocation: {} };
}

function googleDocsBatchRequest(
  input: Readonly<Record<string, unknown>>,
  request: Record<string, unknown>,
): GoogleDocsSdkRequest {
  return googleDocsRequest(["docs", "documents", "batchUpdate"], {
    documentId: googleDocsId(input),
    requestBody: { requests: [request] },
  });
}

const GOOGLE_DOCS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleDocsSdkRequest
  >
> = {
  "google-docs:read-document": (input) =>
    googleDocsRequest(["docs", "documents", "get"], {
      documentId: googleDocsId(input),
    }),
  "google-docs:write-to-document": (input) =>
    googleDocsBatchRequest(input, {
      insertText: {
        endOfSegmentLocation: {},
        text: requiredVercelString(input, "content"),
      },
    }),
  "google-docs:insert-text": (input) =>
    googleDocsBatchRequest(input, {
      insertText: {
        ...googleDocsLocation(input),
        text: requiredVercelString(input, "text"),
      },
    }),
  "google-docs:find-replace-text": (input) =>
    googleDocsBatchRequest(input, {
      replaceAllText: {
        containsText: {
          text: requiredVercelString(input, "searchText"),
          matchCase: optionalVercelBoolean(input, "matchCase") ?? false,
        },
        replaceText: optionalVercelString(input, "replaceText") ?? "",
      },
    }),
  "google-docs:insert-table": (input) =>
    googleDocsBatchRequest(input, {
      insertTable: {
        ...googleDocsLocation(input),
        rows: requiredSquareNumber(input, "rows"),
        columns: requiredSquareNumber(input, "columns"),
      },
    }),
  "google-docs:insert-image": (input) => {
    const width = optionalVercelNumber(input, "width");
    const height = optionalVercelNumber(input, "height");
    return googleDocsBatchRequest(input, {
      insertInlineImage: definedVercelFields({
        ...googleDocsLocation(input),
        uri: requiredVercelString(input, "imageUrl"),
        objectSize:
          width === undefined && height === undefined
            ? undefined
            : definedVercelFields({
                width:
                  width === undefined
                    ? undefined
                    : { magnitude: width, unit: "PT" },
                height:
                  height === undefined
                    ? undefined
                    : { magnitude: height, unit: "PT" },
              }),
      }),
    });
  },
  "google-docs:insert-page-break": (input) =>
    googleDocsBatchRequest(input, {
      insertPageBreak: googleDocsLocation(input),
    }),
  "google-docs:apply-text-style": (input) => {
    const bold = optionalVercelBoolean(input, "bold");
    const italic = optionalVercelBoolean(input, "italic");
    const underline = optionalVercelBoolean(input, "underline");
    const fontSize = optionalVercelNumber(input, "fontSize");
    const fields = [
      bold === undefined ? undefined : "bold",
      italic === undefined ? undefined : "italic",
      underline === undefined ? undefined : "underline",
      fontSize === undefined ? undefined : "fontSize",
    ].filter((field): field is string => Boolean(field));
    if (!fields.length) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleDocsBatchRequest(input, {
      updateTextStyle: {
        range: googleDocsRange(input),
        textStyle: definedVercelFields({
          bold,
          italic,
          underline,
          fontSize:
            fontSize === undefined
              ? undefined
              : { magnitude: fontSize, unit: "PT" },
        }),
        fields: fields.join(","),
      },
    });
  },
  "google-docs:apply-paragraph-style": (input) => {
    const namedStyleType = optionalVercelString(input, "namedStyleType");
    const alignment = optionalVercelString(input, "alignment");
    const fields = [
      namedStyleType === undefined ? undefined : "namedStyleType",
      alignment === undefined ? undefined : "alignment",
    ].filter((field): field is string => Boolean(field));
    if (!fields.length) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleDocsBatchRequest(input, {
      updateParagraphStyle: {
        range: googleDocsRange(input),
        paragraphStyle: definedVercelFields({ namedStyleType, alignment }),
        fields: fields.join(","),
      },
    });
  },
  "google-docs:create-bullets": (input) =>
    googleDocsBatchRequest(input, {
      createParagraphBullets: {
        range: googleDocsRange(input),
        bulletPreset:
          optionalVercelString(input, "bulletPreset") ??
          "BULLET_DISC_CIRCLE_SQUARE",
      },
    }),
  "google-docs:delete-bullets": (input) =>
    googleDocsBatchRequest(input, {
      deleteParagraphBullets: { range: googleDocsRange(input) },
    }),
  "google-docs:delete-content-range": (input) =>
    googleDocsBatchRequest(input, {
      deleteContentRange: { range: googleDocsRange(input) },
    }),
  "google-docs:create-named-range": (input) =>
    googleDocsBatchRequest(input, {
      createNamedRange: {
        name: requiredVercelString(input, "name"),
        range: googleDocsRange(input),
      },
    }),
  "google-docs:delete-named-range": (input) => {
    const namedRangeId = optionalVercelString(input, "namedRangeId");
    const name = optionalVercelString(input, "namedRangeName");
    if ((!namedRangeId && !name) || (namedRangeId && name)) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleDocsBatchRequest(input, {
      deleteNamedRange: namedRangeId ? { namedRangeId } : { name },
    });
  },
};

function assertGoogleDocsOperationCoverage(): void {
  const expected = new Set(GOOGLE_DOCS_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_DOCS_OPERATION_REQUESTS);
  const specialOperations = new Set(["google-docs:create-document"]);
  if (
    expected.size !== implemented.length + specialOperations.size ||
    implemented.some((operationId) => !expected.has(operationId)) ||
    [...specialOperations].some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Docs provider SDK operation coverage is incomplete.",
    );
  }
}

async function invokeGoogleDocsCreate(
  client: GoogleDocsSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const title = requiredVercelString(input, "title");
  const folderId =
    optionalVercelString(input, "folderSelector") ??
    optionalVercelString(input, "folderId");
  const created = await invokeSquareMethod(
    client,
    googleDocsRequest(["drive", "files", "create"], {
      requestBody: definedVercelFields({
        name: title,
        mimeType: "application/vnd.google-apps.document",
        parents: folderId ? [folderId] : undefined,
      }),
      supportsAllDrives: true,
      fields: "id,name,mimeType,createdTime,modifiedTime,webViewLink",
    }),
  );
  const document = googleCalendarResponseData(created);
  const record =
    document && typeof document === "object"
      ? (document as Record<string, unknown>)
      : undefined;
  const documentId = typeof record?.id === "string" ? record.id : undefined;
  if (!documentId) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const content = optionalVercelString(input, "content");
  if (!content) return created;
  return invokeSquareMethod(
    client,
    googleDocsRequest(["docs", "documents", "batchUpdate"], {
      documentId,
      requestBody: {
        requests: [{ insertText: { endOfSegmentLocation: {}, text: content } }],
      },
    }),
  );
}

/** All pinned Google Docs actions use Google's official Node.js SDK. */
export function createGoogleDocsProviderSdk(
  config: GoogleDocsProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleDocsOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleDocsClient;
  return {
    integrationId: "google-docs",
    operationIds: GOOGLE_DOCS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-docs" ||
        invocation.reference.integrationId !== "google-docs"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_DOCS_OPERATION_REQUESTS[invocation.operationId];
      if (
        !requestFactory &&
        invocation.operationId !== "google-docs:create-document"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const client = clientFactory(credential.accessToken);
          const output =
            invocation.operationId === "google-docs:create-document"
              ? await invokeGoogleDocsCreate(client, invocation.input)
              : await invokeSquareMethod(
                  client,
                  requestFactory!(invocation.input),
                );
          return {
            operationId: invocation.operationId,
            output: googleCalendarResponseData(output),
          };
        },
      );
    },
  };
}

export function getGoogleDocsProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleDocsOperationCoverage();
  return {
    operations: GOOGLE_DOCS_OPERATION_IDS.length,
    operationIds: GOOGLE_DOCS_OPERATION_IDS,
  };
}

type GoogleFormsSdkClient = Record<string, unknown>;
type GoogleFormsClientFactory = (accessToken: string) => GoogleFormsSdkClient;

export interface GoogleFormsProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleFormsClientFactory;
}

function createGoogleFormsClient(accessToken: string): GoogleFormsSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return { forms: google.forms({ version: "v1", auth }) };
}

const GOOGLE_FORMS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-forms",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleFormsSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleFormsRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleFormsSdkRequest {
  return { path, arguments: [definedVercelFields(request)] };
}

function googleFormsRequests(
  input: Readonly<Record<string, unknown>>,
): readonly unknown[] {
  const requests = input.requests;
  if (
    !Array.isArray(requests) ||
    !requests.length ||
    requests.length > 100 ||
    requests.some(
      (request) =>
        !request || typeof request !== "object" || Array.isArray(request),
    )
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return requests;
}

function googleFormsEventType(
  input: Readonly<Record<string, unknown>>,
): "SCHEMA" | "RESPONSES" {
  const eventType = requiredVercelString(input, "eventType");
  if (eventType !== "SCHEMA" && eventType !== "RESPONSES") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return eventType;
}

function googleFormsWatchId(
  input: Readonly<Record<string, unknown>>,
): string | undefined {
  const watchId = optionalVercelString(input, "watchId");
  if (
    watchId !== undefined &&
    (!/^[a-z0-9-]{4,63}$/u.test(watchId) || watchId.startsWith("-"))
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return watchId;
}

const GOOGLE_FORMS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleFormsSdkRequest
  >
> = {
  "google-forms:get-responses": (input) => {
    const formId = requiredVercelString(input, "formId");
    const responseId = optionalVercelString(input, "responseId");
    return responseId
      ? googleFormsRequest(["forms", "forms", "responses", "get"], {
          formId,
          responseId,
        })
      : googleFormsRequest(["forms", "forms", "responses", "list"], {
          formId,
          pageSize: optionalVercelNumber(input, "pageSize"),
          pageToken: optionalVercelString(input, "pageToken"),
          filter: optionalVercelString(input, "filter"),
        });
  },
  "google-forms:get-form": (input) =>
    googleFormsRequest(["forms", "forms", "get"], {
      formId: requiredVercelString(input, "formId"),
    }),
  "google-forms:create-form": (input) =>
    googleFormsRequest(["forms", "forms", "create"], {
      unpublished: optionalVercelBoolean(input, "unpublished"),
      requestBody: {
        info: definedVercelFields({
          title: requiredVercelString(input, "title"),
          documentTitle: optionalVercelString(input, "documentTitle"),
        }),
      },
    }),
  "google-forms:batch-update": (input) =>
    googleFormsRequest(["forms", "forms", "batchUpdate"], {
      formId: requiredVercelString(input, "formId"),
      requestBody: {
        requests: googleFormsRequests(input),
        includeFormInResponse:
          optionalVercelBoolean(input, "includeFormInResponse") ?? false,
      },
    }),
  "google-forms:set-publish-settings": (input) => {
    const isPublished = optionalVercelBoolean(input, "isPublished");
    if (isPublished === undefined) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleFormsRequest(["forms", "forms", "setPublishSettings"], {
      formId: requiredVercelString(input, "formId"),
      requestBody: {
        publishSettings: {
          publishState: definedVercelFields({
            isPublished,
            isAcceptingResponses: optionalVercelBoolean(
              input,
              "isAcceptingResponses",
            ),
          }),
        },
        updateMask: "publishState",
      },
    });
  },
  "google-forms:create-watch": (input) =>
    googleFormsRequest(["forms", "forms", "watches", "create"], {
      formId: requiredVercelString(input, "formId"),
      requestBody: definedVercelFields({
        watchId: googleFormsWatchId(input),
        watch: {
          target: {
            topic: { topicName: requiredVercelString(input, "topicName") },
          },
          eventType: googleFormsEventType(input),
        },
      }),
    }),
  "google-forms:list-watches": (input) =>
    googleFormsRequest(["forms", "forms", "watches", "list"], {
      formId: requiredVercelString(input, "formId"),
    }),
  "google-forms:delete-watch": (input) =>
    googleFormsRequest(["forms", "forms", "watches", "delete"], {
      formId: requiredVercelString(input, "formId"),
      watchId: requiredVercelString(input, "watchId"),
    }),
  "google-forms:renew-watch": (input) =>
    googleFormsRequest(["forms", "forms", "watches", "renew"], {
      formId: requiredVercelString(input, "formId"),
      watchId: requiredVercelString(input, "watchId"),
      requestBody: {},
    }),
};

function assertGoogleFormsOperationCoverage(): void {
  const expected = new Set(GOOGLE_FORMS_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_FORMS_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Forms provider SDK operation coverage is incomplete.",
    );
  }
}

/** All pinned Google Forms actions use Google's official Node.js SDK. */
export function createGoogleFormsProviderSdk(
  config: GoogleFormsProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleFormsOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleFormsClient;
  return {
    integrationId: "google-forms",
    operationIds: GOOGLE_FORMS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-forms" ||
        invocation.reference.integrationId !== "google-forms"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_FORMS_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: googleCalendarResponseData(
            await invokeSquareMethod(
              clientFactory(credential.accessToken),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getGoogleFormsProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleFormsOperationCoverage();
  return {
    operations: GOOGLE_FORMS_OPERATION_IDS.length,
    operationIds: GOOGLE_FORMS_OPERATION_IDS,
  };
}

type GoogleTasksSdkClient = Record<string, unknown>;
type GoogleTasksClientFactory = (accessToken: string) => GoogleTasksSdkClient;

export interface GoogleTasksProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleTasksClientFactory;
}

function createGoogleTasksClient(accessToken: string): GoogleTasksSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return { tasks: google.tasks({ version: "v1", auth }) };
}

const GOOGLE_TASKS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-tasks",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleTasksSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleTasksRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleTasksSdkRequest {
  return { path, arguments: [definedVercelFields(request)] };
}

function googleTasksTasklist(input: Readonly<Record<string, unknown>>): string {
  return optionalVercelString(input, "taskListId") ?? "@default";
}

function googleTasksStatus(
  input: Readonly<Record<string, unknown>>,
): "needsAction" | "completed" | undefined {
  const status = optionalVercelString(input, "status");
  if (
    status !== undefined &&
    status !== "needsAction" &&
    status !== "completed"
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return status;
}

function googleTasksBody(
  input: Readonly<Record<string, unknown>>,
  requireTitle: boolean,
): Record<string, unknown> {
  const title = optionalVercelString(input, "title");
  if (requireTitle && !title) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const body = definedVercelFields({
    title,
    notes: optionalVercelString(input, "notes"),
    due: optionalVercelString(input, "due"),
    status: googleTasksStatus(input),
  });
  if (!requireTitle && !Object.keys(body).length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return body;
}

const GOOGLE_TASKS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleTasksSdkRequest
  >
> = {
  "google-tasks:create-task": (input) =>
    googleTasksRequest(["tasks", "tasks", "insert"], {
      tasklist: googleTasksTasklist(input),
      parent: optionalVercelString(input, "parent"),
      previous: optionalVercelString(input, "previous"),
      requestBody: googleTasksBody(input, true),
    }),
  "google-tasks:list-tasks": (input) =>
    googleTasksRequest(["tasks", "tasks", "list"], {
      tasklist: googleTasksTasklist(input),
      maxResults: optionalVercelNumber(input, "maxResults"),
      pageToken: optionalVercelString(input, "pageToken"),
      showCompleted: optionalVercelBoolean(input, "showCompleted"),
      showDeleted: optionalVercelBoolean(input, "showDeleted"),
      showHidden: optionalVercelBoolean(input, "showHidden"),
      dueMin: optionalVercelString(input, "dueMin"),
      dueMax: optionalVercelString(input, "dueMax"),
      completedMin: optionalVercelString(input, "completedMin"),
      completedMax: optionalVercelString(input, "completedMax"),
      updatedMin: optionalVercelString(input, "updatedMin"),
    }),
  "google-tasks:get-task": (input) =>
    googleTasksRequest(["tasks", "tasks", "get"], {
      tasklist: googleTasksTasklist(input),
      task: requiredVercelString(input, "taskId"),
    }),
  "google-tasks:update-task": (input) =>
    googleTasksRequest(["tasks", "tasks", "update"], {
      tasklist: googleTasksTasklist(input),
      task: requiredVercelString(input, "taskId"),
      requestBody: googleTasksBody(input, false),
    }),
  "google-tasks:delete-task": (input) =>
    googleTasksRequest(["tasks", "tasks", "delete"], {
      tasklist: googleTasksTasklist(input),
      task: requiredVercelString(input, "taskId"),
    }),
  "google-tasks:list-task-lists": (input) =>
    googleTasksRequest(["tasks", "tasklists", "list"], {
      maxResults: optionalVercelNumber(input, "maxResults"),
      pageToken: optionalVercelString(input, "pageToken"),
    }),
};

function assertGoogleTasksOperationCoverage(): void {
  const expected = new Set(GOOGLE_TASKS_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_TASKS_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Tasks provider SDK operation coverage is incomplete.",
    );
  }
}

/** All pinned Google Tasks actions use Google's official Node.js SDK. */
export function createGoogleTasksProviderSdk(
  config: GoogleTasksProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleTasksOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleTasksClient;
  return {
    integrationId: "google-tasks",
    operationIds: GOOGLE_TASKS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-tasks" ||
        invocation.reference.integrationId !== "google-tasks"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_TASKS_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: googleCalendarResponseData(
            await invokeSquareMethod(
              clientFactory(credential.accessToken),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getGoogleTasksProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleTasksOperationCoverage();
  return {
    operations: GOOGLE_TASKS_OPERATION_IDS.length,
    operationIds: GOOGLE_TASKS_OPERATION_IDS,
  };
}

type GoogleContactsSdkClient = Record<string, unknown>;
type GoogleContactsClientFactory = (
  accessToken: string,
) => GoogleContactsSdkClient;

export interface GoogleContactsProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleContactsClientFactory;
}

function createGoogleContactsClient(
  accessToken: string,
): GoogleContactsSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return { people: google.people({ version: "v1", auth }) };
}

const GOOGLE_CONTACTS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-contacts",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

const GOOGLE_CONTACTS_PERSON_FIELDS =
  "names,emailAddresses,phoneNumbers,organizations,addresses,biographies,urls,photos,metadata";

interface GoogleContactsSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleContactsRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleContactsSdkRequest {
  return { path, arguments: [definedVercelFields(request)] };
}

function googleContactsPerson(
  input: Readonly<Record<string, unknown>>,
  includeConcurrencyControl: boolean,
): { person: Record<string, unknown>; updateFields: string[] } {
  const givenName = optionalVercelString(input, "givenName");
  const familyName = optionalVercelString(input, "familyName");
  const email = optionalVercelString(input, "email");
  const phone = optionalVercelString(input, "phone");
  const organization = optionalVercelString(input, "organization");
  const jobTitle = optionalVercelString(input, "jobTitle");
  const notes = optionalVercelString(input, "notes");
  const updateFields = [
    givenName || familyName ? "names" : undefined,
    email ? "emailAddresses" : undefined,
    phone ? "phoneNumbers" : undefined,
    organization || jobTitle ? "organizations" : undefined,
    notes ? "biographies" : undefined,
  ].filter((field): field is string => Boolean(field));
  const etag = includeConcurrencyControl
    ? requiredVercelString(input, "etag")
    : undefined;
  return {
    updateFields,
    person: definedVercelFields({
      etag,
      metadata: etag ? { sources: [{ type: "CONTACT", etag }] } : undefined,
      names:
        givenName || familyName
          ? [definedVercelFields({ givenName, familyName })]
          : undefined,
      emailAddresses: email
        ? [
            {
              value: email,
              type: optionalVercelString(input, "emailType") ?? "other",
            },
          ]
        : undefined,
      phoneNumbers: phone
        ? [
            {
              value: phone,
              type: optionalVercelString(input, "phoneType") ?? "mobile",
            },
          ]
        : undefined,
      organizations:
        organization || jobTitle
          ? [definedVercelFields({ name: organization, title: jobTitle })]
          : undefined,
      biographies: notes
        ? [{ value: notes, contentType: "TEXT_PLAIN" }]
        : undefined,
    }),
  };
}

const GOOGLE_CONTACTS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleContactsSdkRequest
  >
> = {
  "google-contacts:create-contact": (input) => {
    const { person } = googleContactsPerson(input, false);
    if (!Array.isArray(person.names)) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleContactsRequest(["people", "people", "createContact"], {
      personFields: GOOGLE_CONTACTS_PERSON_FIELDS,
      requestBody: person,
    });
  },
  "google-contacts:get-contact": (input) =>
    googleContactsRequest(["people", "people", "get"], {
      resourceName: requiredVercelString(input, "resourceName"),
      personFields: GOOGLE_CONTACTS_PERSON_FIELDS,
    }),
  "google-contacts:list-contacts": (input) =>
    googleContactsRequest(["people", "people", "connections", "list"], {
      resourceName: "people/me",
      personFields: GOOGLE_CONTACTS_PERSON_FIELDS,
      pageSize: optionalVercelNumber(input, "pageSize"),
      pageToken: optionalVercelString(input, "pageToken"),
      sortOrder: optionalVercelString(input, "sortOrder"),
    }),
  "google-contacts:search-contacts": (input) =>
    googleContactsRequest(["people", "people", "searchContacts"], {
      query: requiredVercelString(input, "query"),
      readMask: GOOGLE_CONTACTS_PERSON_FIELDS,
      pageSize: optionalVercelNumber(input, "pageSize"),
    }),
  "google-contacts:update-contact": (input) => {
    const { person, updateFields } = googleContactsPerson(input, true);
    if (!updateFields.length) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleContactsRequest(["people", "people", "updateContact"], {
      resourceName: requiredVercelString(input, "resourceName"),
      updatePersonFields: updateFields.join(","),
      personFields: GOOGLE_CONTACTS_PERSON_FIELDS,
      requestBody: person,
    });
  },
  "google-contacts:delete-contact": (input) =>
    googleContactsRequest(["people", "people", "deleteContact"], {
      resourceName: requiredVercelString(input, "resourceName"),
    }),
};

function assertGoogleContactsOperationCoverage(): void {
  const expected = new Set(GOOGLE_CONTACTS_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_CONTACTS_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Contacts provider SDK operation coverage is incomplete.",
    );
  }
}

/** All pinned Google Contacts actions use Google's official Node.js SDK. */
export function createGoogleContactsProviderSdk(
  config: GoogleContactsProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleContactsOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleContactsClient;
  return {
    integrationId: "google-contacts",
    operationIds: GOOGLE_CONTACTS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-contacts" ||
        invocation.reference.integrationId !== "google-contacts"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_CONTACTS_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: googleCalendarResponseData(
            await invokeSquareMethod(
              clientFactory(credential.accessToken),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getGoogleContactsProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleContactsOperationCoverage();
  return {
    operations: GOOGLE_CONTACTS_OPERATION_IDS.length,
    operationIds: GOOGLE_CONTACTS_OPERATION_IDS,
  };
}

type GoogleBooksSdkClient = Record<string, unknown>;
type GoogleBooksClientFactory = (apiKey: string) => GoogleBooksSdkClient;

export interface GoogleBooksProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: GoogleBooksClientFactory;
}

function createGoogleBooksClient(apiKey: string): GoogleBooksSdkClient {
  return { books: google.books({ version: "v1", auth: apiKey }) };
}

const GOOGLE_BOOKS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-books",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleBooksSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleBooksRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleBooksSdkRequest {
  return { path, arguments: [definedVercelFields(request)] };
}

const GOOGLE_BOOKS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleBooksSdkRequest
  >
> = {
  "google-books:search-volumes": (input) =>
    googleBooksRequest(["books", "volumes", "list"], {
      q: requiredVercelString(input, "query"),
      filter: optionalVercelString(input, "filter"),
      printType: optionalVercelString(input, "printType"),
      orderBy: optionalVercelString(input, "orderBy"),
      startIndex: optionalVercelNumber(input, "startIndex"),
      maxResults: optionalVercelNumber(input, "maxResults"),
      langRestrict: optionalVercelString(input, "langRestrict"),
    }),
  "google-books:get-volume-details": (input) =>
    googleBooksRequest(["books", "volumes", "get"], {
      volumeId: requiredVercelString(input, "volumeId"),
      projection: optionalVercelString(input, "projection"),
    }),
};

function assertGoogleBooksOperationCoverage(): void {
  const expected = new Set(GOOGLE_BOOKS_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_BOOKS_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Books provider SDK operation coverage is incomplete.",
    );
  }
}

/** All pinned Google Books actions use Google's official Node.js SDK. */
export function createGoogleBooksProviderSdk(
  config: GoogleBooksProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleBooksOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleBooksClient;
  return {
    integrationId: "google-books",
    operationIds: GOOGLE_BOOKS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-books" ||
        invocation.reference.integrationId !== "google-books"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_BOOKS_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: googleCalendarResponseData(
            await invokeSquareMethod(
              clientFactory(credential.apiKey),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getGoogleBooksProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleBooksOperationCoverage();
  return {
    operations: GOOGLE_BOOKS_OPERATION_IDS.length,
    operationIds: GOOGLE_BOOKS_OPERATION_IDS,
  };
}

type GoogleMeetSdkClient = Record<string, unknown>;
type GoogleMeetClientFactory = (accessToken: string) => GoogleMeetSdkClient;

export interface GoogleMeetProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleMeetClientFactory;
}

function createGoogleMeetClient(accessToken: string): GoogleMeetSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return { meet: google.meet({ version: "v2", auth }) };
}

const GOOGLE_MEET_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-meet",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleMeetSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleMeetRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleMeetSdkRequest {
  return { path, arguments: [definedVercelFields(request)] };
}

function googleMeetSpaceName(input: Readonly<Record<string, unknown>>): string {
  const value = requiredVercelString(input, "spaceName");
  return value.startsWith("spaces/") ? value : `spaces/${value}`;
}

function googleMeetConferenceName(
  input: Readonly<Record<string, unknown>>,
): string {
  const value = requiredVercelString(input, "conferenceName");
  return value.startsWith("conferenceRecords/")
    ? value
    : `conferenceRecords/${value}`;
}

const GOOGLE_MEET_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleMeetSdkRequest
  >
> = {
  "google-meet:create-space": (input) =>
    googleMeetRequest(["meet", "spaces", "create"], {
      requestBody: definedVercelFields({
        config:
          optionalVercelString(input, "accessType") ||
          optionalVercelString(input, "entryPointAccess")
            ? definedVercelFields({
                accessType: optionalVercelString(input, "accessType"),
                entryPointAccess: optionalVercelString(
                  input,
                  "entryPointAccess",
                ),
              })
            : undefined,
      }),
    }),
  "google-meet:get-space": (input) =>
    googleMeetRequest(["meet", "spaces", "get"], {
      name: googleMeetSpaceName(input),
    }),
  "google-meet:end-conference": (input) =>
    googleMeetRequest(["meet", "spaces", "endActiveConference"], {
      name: googleMeetSpaceName(input),
      requestBody: {},
    }),
  "google-meet:list-conference-records": (input) =>
    googleMeetRequest(["meet", "conferenceRecords", "list"], {
      filter: optionalVercelString(input, "filter"),
      pageSize: optionalVercelNumber(input, "pageSize"),
      pageToken: optionalVercelString(input, "pageToken"),
    }),
  "google-meet:get-conference-record": (input) =>
    googleMeetRequest(["meet", "conferenceRecords", "get"], {
      name: googleMeetConferenceName(input),
    }),
  "google-meet:list-participants": (input) =>
    googleMeetRequest(["meet", "conferenceRecords", "participants", "list"], {
      parent: googleMeetConferenceName(input),
      filter: optionalVercelString(input, "filter"),
      pageSize: optionalVercelNumber(input, "pageSize"),
      pageToken: optionalVercelString(input, "pageToken"),
    }),
};

function assertGoogleMeetOperationCoverage(): void {
  const expected = new Set(GOOGLE_MEET_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_MEET_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Meet provider SDK operation coverage is incomplete.",
    );
  }
}

/** All pinned Google Meet actions use Google's official Node.js SDK. */
export function createGoogleMeetProviderSdk(
  config: GoogleMeetProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleMeetOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleMeetClient;
  return {
    integrationId: "google-meet",
    operationIds: GOOGLE_MEET_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-meet" ||
        invocation.reference.integrationId !== "google-meet"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_MEET_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: googleCalendarResponseData(
            await invokeSquareMethod(
              clientFactory(credential.accessToken),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getGoogleMeetProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleMeetOperationCoverage();
  return {
    operations: GOOGLE_MEET_OPERATION_IDS.length,
    operationIds: GOOGLE_MEET_OPERATION_IDS,
  };
}

type GoogleGroupsSdkClient = Record<string, unknown>;
type GoogleGroupsClientFactory = (accessToken: string) => GoogleGroupsSdkClient;

export interface GoogleGroupsProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleGroupsClientFactory;
}

function createGoogleGroupsClient(accessToken: string): GoogleGroupsSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return {
    admin: google.admin({ version: "directory_v1", auth }),
    groupssettings: google.groupssettings({ version: "v1", auth }),
  };
}

const GOOGLE_GROUPS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-groups",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleGroupsSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleGroupsRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleGroupsSdkRequest {
  return { path, arguments: [definedVercelFields(request)] };
}

function googleGroupsKey(input: Readonly<Record<string, unknown>>): string {
  return requiredVercelString(input, "groupKey");
}

function googleGroupsMemberKey(
  input: Readonly<Record<string, unknown>>,
): string {
  return requiredVercelString(input, "memberKey");
}

function googleGroupsRole(
  input: Readonly<Record<string, unknown>>,
  defaultRole?: "MEMBER",
): "MEMBER" | "MANAGER" | "OWNER" {
  const role = optionalVercelString(input, "role") ?? defaultRole;
  if (role !== "MEMBER" && role !== "MANAGER" && role !== "OWNER") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return role;
}

const GOOGLE_GROUPS_SETTINGS_FIELDS = [
  "name",
  "description",
  "whoCanJoin",
  "whoCanViewMembership",
  "whoCanViewGroup",
  "whoCanPostMessage",
  "allowExternalMembers",
  "allowWebPosting",
  "primaryLanguage",
  "isArchived",
  "archiveOnly",
  "messageModerationLevel",
  "spamModerationLevel",
  "replyTo",
  "customReplyTo",
  "includeCustomFooter",
  "customFooterText",
  "sendMessageDenyNotification",
  "defaultMessageDenyNotificationText",
  "membersCanPostAsTheGroup",
  "includeInGlobalAddressList",
  "whoCanLeaveGroup",
  "whoCanContactOwner",
  "favoriteRepliesOnTop",
  "whoCanApproveMembers",
  "whoCanBanUsers",
  "whoCanModerateMembers",
  "whoCanModerateContent",
  "whoCanAssistContent",
  "enableCollaborativeInbox",
  "whoCanDiscoverGroup",
  "defaultSender",
] as const;

function googleGroupsSettingsBody(
  input: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const entries = GOOGLE_GROUPS_SETTINGS_FIELDS.flatMap((field) => {
    const value = input[field];
    return typeof value === "string" && value.length > 0
      ? ([[field, value]] as const)
      : [];
  });
  return Object.fromEntries(entries);
}

const GOOGLE_GROUPS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleGroupsSdkRequest
  >
> = {
  "google-groups:list-groups": (input) => {
    const domain = optionalVercelString(input, "domain");
    return googleGroupsRequest(["admin", "groups", "list"], {
      customer: domain
        ? undefined
        : (optionalVercelString(input, "customer") ?? "my_customer"),
      domain,
      maxResults: optionalVercelNumber(input, "maxResults"),
      pageToken: optionalVercelString(input, "pageToken"),
      query: optionalVercelString(input, "query"),
    });
  },
  "google-groups:get-group": (input) =>
    googleGroupsRequest(["admin", "groups", "get"], {
      groupKey: googleGroupsKey(input),
    }),
  "google-groups:create-group": (input) =>
    googleGroupsRequest(["admin", "groups", "insert"], {
      requestBody: definedVercelFields({
        email: requiredVercelString(input, "email"),
        name: requiredVercelString(input, "name"),
        description: optionalVercelString(input, "description"),
      }),
    }),
  "google-groups:update-group": (input) => {
    const requestBody = definedVercelFields({
      name: optionalVercelString(input, "name"),
      description: optionalVercelString(input, "description"),
      email: optionalVercelString(input, "email"),
    });
    if (!Object.keys(requestBody).length) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleGroupsRequest(["admin", "groups", "patch"], {
      groupKey: googleGroupsKey(input),
      requestBody,
    });
  },
  "google-groups:delete-group": (input) =>
    googleGroupsRequest(["admin", "groups", "delete"], {
      groupKey: googleGroupsKey(input),
    }),
  "google-groups:list-members": (input) =>
    googleGroupsRequest(["admin", "members", "list"], {
      groupKey: googleGroupsKey(input),
      maxResults: optionalVercelNumber(input, "maxResults"),
      pageToken: optionalVercelString(input, "pageToken"),
      roles: optionalVercelString(input, "roles"),
    }),
  "google-groups:get-member": (input) =>
    googleGroupsRequest(["admin", "members", "get"], {
      groupKey: googleGroupsKey(input),
      memberKey: googleGroupsMemberKey(input),
    }),
  "google-groups:add-member": (input) =>
    googleGroupsRequest(["admin", "members", "insert"], {
      groupKey: googleGroupsKey(input),
      requestBody: {
        email: requiredVercelString(input, "email"),
        role: googleGroupsRole(input, "MEMBER"),
      },
    }),
  "google-groups:update-member-role": (input) =>
    googleGroupsRequest(["admin", "members", "update"], {
      groupKey: googleGroupsKey(input),
      memberKey: googleGroupsMemberKey(input),
      requestBody: { role: googleGroupsRole(input) },
    }),
  "google-groups:remove-member": (input) =>
    googleGroupsRequest(["admin", "members", "delete"], {
      groupKey: googleGroupsKey(input),
      memberKey: googleGroupsMemberKey(input),
    }),
  "google-groups:check-membership": (input) =>
    googleGroupsRequest(["admin", "members", "hasMember"], {
      groupKey: googleGroupsKey(input),
      memberKey: googleGroupsMemberKey(input),
    }),
  "google-groups:list-aliases": (input) =>
    googleGroupsRequest(["admin", "groups", "aliases", "list"], {
      groupKey: googleGroupsKey(input),
    }),
  "google-groups:add-alias": (input) =>
    googleGroupsRequest(["admin", "groups", "aliases", "insert"], {
      groupKey: googleGroupsKey(input),
      requestBody: { alias: requiredVercelString(input, "alias") },
    }),
  "google-groups:remove-alias": (input) =>
    googleGroupsRequest(["admin", "groups", "aliases", "delete"], {
      groupKey: googleGroupsKey(input),
      alias: requiredVercelString(input, "alias"),
    }),
  "google-groups:get-settings": (input) =>
    googleGroupsRequest(["groupssettings", "groups", "get"], {
      groupUniqueId: requiredVercelString(input, "groupEmail"),
    }),
  "google-groups:update-settings": (input) =>
    googleGroupsRequest(["groupssettings", "groups", "update"], {
      groupUniqueId: requiredVercelString(input, "groupEmail"),
      requestBody: googleGroupsSettingsBody(input),
    }),
};

function assertGoogleGroupsOperationCoverage(): void {
  const expected = new Set(GOOGLE_GROUPS_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_GROUPS_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Groups provider SDK operation coverage is incomplete.",
    );
  }
}

/** All pinned Google Groups actions use Google's official Node.js SDK. */
export function createGoogleGroupsProviderSdk(
  config: GoogleGroupsProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleGroupsOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleGroupsClient;
  return {
    integrationId: "google-groups",
    operationIds: GOOGLE_GROUPS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-groups" ||
        invocation.reference.integrationId !== "google-groups"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_GROUPS_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: googleCalendarResponseData(
            await invokeSquareMethod(
              clientFactory(credential.accessToken),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getGoogleGroupsProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleGroupsOperationCoverage();
  return {
    operations: GOOGLE_GROUPS_OPERATION_IDS.length,
    operationIds: GOOGLE_GROUPS_OPERATION_IDS,
  };
}

type GmailSdkClient = Record<string, unknown>;
type GmailClientFactory = (accessToken: string) => GmailSdkClient;

export interface GmailProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GmailClientFactory;
  /** Source email files must resolve to this portable in-memory shape. */
  maxAttachmentBytes?: number;
}

function createGmailClient(accessToken: string): GmailSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return { gmail: google.gmail({ version: "v1", auth }) };
}

const GMAIL_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "gmail",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GmailSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function gmailRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GmailSdkRequest {
  return { path, arguments: [definedVercelFields(request)] };
}

function gmailHeader(value: string): string {
  return value.replace(/[\r\n]+/gu, " ");
}

function gmailSubject(value: string): string {
  const normalized = gmailHeader(value);
  return /^[\x00-\x7F]*$/u.test(normalized)
    ? normalized
    : `=?UTF-8?B?${Buffer.from(normalized, "utf8").toString("base64")}?=`;
}

interface GmailAttachment {
  filename: string;
  mimeType: string;
  content: Buffer;
}

interface GmailReplyHeaders {
  inReplyTo?: string;
  references?: string;
}

function gmailAttachments(
  input: Readonly<Record<string, unknown>>,
  maximumBytes: number,
): GmailAttachment[] {
  const rawAttachments = input.attachments;
  if (rawAttachments === undefined) return [];
  if (!Array.isArray(rawAttachments)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  let totalBytes = 0;
  return rawAttachments.map((rawAttachment) => {
    if (!rawAttachment || typeof rawAttachment !== "object") {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    const attachment = rawAttachment as Record<string, unknown>;
    const filename =
      optionalVercelString(attachment, "filename") ??
      requiredVercelString(attachment, "name");
    const data =
      optionalVercelString(attachment, "data") ??
      requiredVercelString(attachment, "content");
    if (!/^[A-Za-z0-9+/_=-]*$/u.test(data)) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    const content = Buffer.from(data, "base64");
    totalBytes += content.byteLength;
    if (totalBytes > maximumBytes) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return {
      filename: gmailHeader(filename),
      mimeType:
        optionalVercelString(attachment, "mimeType") ??
        optionalVercelString(attachment, "contentType") ??
        "application/octet-stream",
      content,
    };
  });
}

function gmailBase64Lines(value: Buffer | string): string[] {
  return value.toString("base64").match(/.{1,76}/gu) ?? [""];
}

function gmailEscapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function gmailPlainTextFallback(value: string): string {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/\s{2,}/gu, " ")
    .trim();
}

function gmailBodyAlternatives(
  body: string,
  contentType: "text" | "html",
): { plain: string; html: string } {
  if (contentType === "html") {
    return { plain: gmailPlainTextFallback(body) || body, html: body };
  }
  return {
    plain: body,
    html: `<!DOCTYPE html><html><body>${gmailEscapeHtml(body).replace(/\r?\n/gu, "<br>")}</body></html>`,
  };
}

function gmailAlternativeParts(
  body: string,
  contentType: "text" | "html",
  boundary: string,
): string[] {
  const { plain, html } = gmailBodyAlternatives(body, contentType);
  return [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    ...gmailBase64Lines(plain),
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    ...gmailBase64Lines(html),
    "",
    `--${boundary}--`,
  ];
}

function gmailRawMessage(
  input: Readonly<Record<string, unknown>>,
  maximumAttachmentBytes: number,
  replyHeaders: GmailReplyHeaders = {},
): string {
  const contentType = optionalVercelString(input, "contentType") ?? "text";
  if (contentType !== "text" && contentType !== "html") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const attachments = gmailAttachments(input, maximumAttachmentBytes);
  const body = requiredVercelString(input, "body");
  const lines = [`To: ${gmailHeader(requiredVercelString(input, "to"))}`];
  const cc = optionalVercelString(input, "cc");
  const bcc = optionalVercelString(input, "bcc");
  if (cc) lines.push(`Cc: ${gmailHeader(cc)}`);
  if (bcc) lines.push(`Bcc: ${gmailHeader(bcc)}`);
  lines.push(
    `Subject: ${gmailSubject(optionalVercelString(input, "subject") ?? "")}`,
  );
  if (replyHeaders.inReplyTo) {
    const inReplyTo = gmailHeader(replyHeaders.inReplyTo);
    lines.push(`In-Reply-To: ${inReplyTo}`);
    lines.push(
      `References: ${replyHeaders.references ? `${gmailHeader(replyHeaders.references)} ${inReplyTo}` : inReplyTo}`,
    );
  }
  lines.push("MIME-Version: 1.0");
  if (attachments.length) {
    const mixedBoundary = `oppulence_mixed_${crypto.randomUUID().replace(/-/gu, "")}`;
    const alternativeBoundary = `oppulence_alt_${crypto.randomUUID().replace(/-/gu, "")}`;
    lines.push(
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      "",
    );
    lines.push(
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
      "",
      ...gmailAlternativeParts(body, contentType, alternativeBoundary),
      "",
    );
    for (const attachment of attachments) {
      lines.push(
        `--${mixedBoundary}`,
        `Content-Type: ${gmailHeader(attachment.mimeType)}`,
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
        "Content-Transfer-Encoding: base64",
        "",
        ...gmailBase64Lines(attachment.content),
        "",
      );
    }
    lines.push(`--${mixedBoundary}--`);
  } else {
    const alternativeBoundary = `oppulence_alt_${crypto.randomUUID().replace(/-/gu, "")}`;
    lines.push(
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
      "",
      ...gmailAlternativeParts(body, contentType, alternativeBoundary),
    );
  }
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

function gmailLabelIds(
  input: Readonly<Record<string, unknown>>,
  field: "addLabelIds" | "removeLabelIds" | "labelIds",
): string[] | undefined {
  const value = optionalVercelString(input, field);
  if (!value) return undefined;
  const labelIds = value
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  if (!labelIds.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return labelIds;
}

const GMAIL_OPERATION_REQUESTS: Readonly<
  Record<string, (input: Readonly<Record<string, unknown>>) => GmailSdkRequest>
> = {
  "gmail:search-email": (input) =>
    gmailRequest(["gmail", "users", "messages", "list"], {
      userId: "me",
      q: requiredVercelString(input, "query"),
      maxResults: optionalVercelNumber(input, "maxResults"),
    }),
  "gmail:move-email": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredVercelString(input, "messageId"),
      requestBody: definedVercelFields({
        addLabelIds: gmailLabelIds(input, "addLabelIds"),
        removeLabelIds: gmailLabelIds(input, "removeLabelIds"),
      }),
    }),
  "gmail:mark-as-read": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredVercelString(input, "messageId"),
      requestBody: { removeLabelIds: ["UNREAD"] },
    }),
  "gmail:mark-as-unread": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredVercelString(input, "messageId"),
      requestBody: { addLabelIds: ["UNREAD"] },
    }),
  "gmail:archive-email": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredVercelString(input, "messageId"),
      requestBody: { removeLabelIds: ["INBOX"] },
    }),
  "gmail:unarchive-email": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredVercelString(input, "messageId"),
      requestBody: { addLabelIds: ["INBOX"] },
    }),
  "gmail:delete-email": (input) =>
    gmailRequest(["gmail", "users", "messages", "trash"], {
      userId: "me",
      id: requiredVercelString(input, "messageId"),
    }),
  "gmail:add-label": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredVercelString(input, "messageId"),
      requestBody: { addLabelIds: gmailLabelIds(input, "labelIds") },
    }),
  "gmail:remove-label": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredVercelString(input, "messageId"),
      requestBody: { removeLabelIds: gmailLabelIds(input, "labelIds") },
    }),
};

function assertGmailOperationCoverage(): void {
  const specialOperations = new Set([
    "gmail:send-email",
    "gmail:read-email",
    "gmail:draft-email",
    "gmail:edit-draft",
  ]);
  const expected = new Set(GMAIL_OPERATION_IDS);
  const implemented = Object.keys(GMAIL_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length + specialOperations.size ||
    implemented.some((operationId) => !expected.has(operationId)) ||
    [...specialOperations].some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Gmail provider SDK operation coverage is incomplete.");
  }
}

function gmailResponseRecord(value: unknown): Record<string, unknown> {
  const response = googleCalendarResponseData(value);
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return {};
  }
  return response as Record<string, unknown>;
}

function gmailHeaderValue(headers: unknown, name: string): string | undefined {
  if (!Array.isArray(headers)) return undefined;
  for (const rawHeader of headers) {
    if (!rawHeader || typeof rawHeader !== "object") continue;
    const header = rawHeader as Record<string, unknown>;
    if (
      typeof header.name === "string" &&
      header.name.toLowerCase() === name.toLowerCase() &&
      typeof header.value === "string"
    ) {
      return header.value;
    }
  }
  return undefined;
}

function gmailPartBody(
  rawPart: unknown,
  preferredMimeType?: "text/plain" | "text/html",
): string | undefined {
  if (!rawPart || typeof rawPart !== "object") return undefined;
  const part = rawPart as Record<string, unknown>;
  if (
    (!preferredMimeType || part.mimeType === preferredMimeType) &&
    part.body &&
    typeof part.body === "object" &&
    typeof (part.body as Record<string, unknown>).data === "string"
  ) {
    const data = (part.body as Record<string, unknown>).data as string;
    if (/^[A-Za-z0-9_-]*={0,2}$/u.test(data)) {
      return Buffer.from(data, "base64url").toString("utf8");
    }
  }
  if (!Array.isArray(part.parts)) return undefined;
  for (const nestedPart of part.parts) {
    const body = gmailPartBody(nestedPart, preferredMimeType);
    if (body !== undefined) return body;
  }
  return undefined;
}

interface GmailReadAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

function gmailReadAttachmentsFromPart(rawPart: unknown): GmailReadAttachment[] {
  if (!rawPart || typeof rawPart !== "object") return [];
  const part = rawPart as Record<string, unknown>;
  const body =
    part.body && typeof part.body === "object"
      ? (part.body as Record<string, unknown>)
      : {};
  const attachments: GmailReadAttachment[] = [];
  if (
    typeof body.attachmentId === "string" &&
    typeof part.filename === "string" &&
    part.filename
  ) {
    attachments.push({
      attachmentId: body.attachmentId,
      filename: part.filename,
      mimeType:
        typeof part.mimeType === "string"
          ? part.mimeType
          : "application/octet-stream",
      size: typeof body.size === "number" ? body.size : 0,
    });
  }
  if (Array.isArray(part.parts)) {
    attachments.push(
      ...part.parts.flatMap((nestedPart) =>
        gmailReadAttachmentsFromPart(nestedPart),
      ),
    );
  }
  return attachments;
}

async function gmailDownloadReadAttachments(
  client: GmailSdkClient,
  messageId: string,
  attachments: readonly GmailReadAttachment[],
  maximumBytes: number,
): Promise<
  Array<{ name: string; data: string; mimeType: string; size: number }>
> {
  const downloaded: Array<{
    name: string;
    data: string;
    mimeType: string;
    size: number;
  }> = [];
  let totalBytes = 0;
  for (const attachment of attachments) {
    if (attachment.size > maximumBytes - totalBytes) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    try {
      const response = await invokeSquareMethod(
        client,
        gmailRequest(["gmail", "users", "messages", "attachments", "get"], {
          userId: "me",
          messageId,
          id: attachment.attachmentId,
        }),
      );
      const data = gmailResponseRecord(response);
      if (
        typeof data.data !== "string" ||
        !/^[A-Za-z0-9_-]*={0,2}$/u.test(data.data)
      ) {
        continue;
      }
      const bytes = Buffer.from(data.data, "base64url");
      totalBytes += bytes.byteLength;
      if (totalBytes > maximumBytes) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      downloaded.push({
        name: attachment.filename,
        data: bytes.toString("base64"),
        mimeType: attachment.mimeType,
        size: bytes.byteLength,
      });
    } catch (error) {
      if (error instanceof IntegrationProviderSdkError) throw error;
      // Preserve the source behavior: one unreadable attachment does not make
      // the whole message unavailable.
    }
  }
  return downloaded;
}

async function gmailFormatReadMessage(
  client: GmailSdkClient,
  value: unknown,
  includeAttachments: boolean,
  maximumAttachmentBytes: number,
): Promise<Record<string, unknown>> {
  const message = gmailResponseRecord(value);
  const payload = gmailResponseRecord(message.payload);
  const attachmentInfo = gmailReadAttachmentsFromPart(payload);
  const messageId = typeof message.id === "string" ? message.id : "";
  const attachments =
    includeAttachments && messageId
      ? await gmailDownloadReadAttachments(
          client,
          messageId,
          attachmentInfo,
          maximumAttachmentBytes,
        )
      : [];
  return {
    id: messageId || undefined,
    threadId:
      typeof message.threadId === "string" ? message.threadId : undefined,
    labelIds: Array.isArray(message.labelIds) ? message.labelIds : [],
    from: gmailHeaderValue(payload.headers, "from"),
    to: gmailHeaderValue(payload.headers, "to"),
    subject: gmailHeaderValue(payload.headers, "subject"),
    date: gmailHeaderValue(payload.headers, "date"),
    body:
      gmailPartBody(payload, "text/plain") ??
      gmailPartBody(payload, "text/html") ??
      "",
    hasAttachments: attachmentInfo.length > 0,
    attachmentCount: attachmentInfo.length,
    attachments,
  };
}

function gmailReadMaxResults(input: Readonly<Record<string, unknown>>): number {
  const requested = optionalVercelNumber(input, "maxResults") ?? 1;
  if (!Number.isFinite(requested) || requested < 1) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return Math.min(Math.trunc(requested), 10);
}

function gmailReadQuery(input: Readonly<Record<string, unknown>>): string {
  const folder = optionalVercelString(input, "folder");
  const unreadOnly = optionalVercelBoolean(input, "unreadOnly");
  const terms = [
    unreadOnly ? "is:unread" : undefined,
    folder
      ? ["INBOX", "SENT", "DRAFT", "TRASH", "SPAM"].includes(folder)
        ? `in:${folder.toLowerCase()}`
        : `label:${folder}`
      : "in:inbox",
  ].filter((term): term is string => Boolean(term));
  return terms.join(" ");
}

async function gmailReplyHeaders(
  client: GmailSdkClient,
  messageId: string,
): Promise<GmailReplyHeaders & { threadId?: string }> {
  try {
    const response = await invokeSquareMethod(
      client,
      gmailRequest(["gmail", "users", "messages", "get"], {
        userId: "me",
        id: messageId,
        format: "metadata",
        metadataHeaders: ["Message-ID", "References", "Subject"],
      }),
    );
    const message = gmailResponseRecord(response);
    const payload = gmailResponseRecord(message.payload);
    return {
      inReplyTo: gmailHeaderValue(payload.headers, "message-id"),
      references: gmailHeaderValue(payload.headers, "references"),
      threadId:
        typeof message.threadId === "string" ? message.threadId : undefined,
    };
  } catch {
    // A reply still sends when Gmail refuses metadata access for an otherwise
    // sendable message, matching the pinned source's best-effort threading.
    return {};
  }
}

async function executeGmailSpecialOperation(
  client: GmailSdkClient,
  operationId: string,
  input: Readonly<Record<string, unknown>>,
  maximumAttachmentBytes: number,
): Promise<unknown> {
  if (operationId === "gmail:read-email") {
    const messageId = optionalVercelString(input, "messageId");
    if (messageId) {
      const result = await invokeSquareMethod(
        client,
        gmailRequest(["gmail", "users", "messages", "get"], {
          userId: "me",
          id: messageId,
          format: "full",
        }),
      );
      return gmailFormatReadMessage(
        client,
        result,
        optionalVercelBoolean(input, "includeAttachments") ?? false,
        maximumAttachmentBytes,
      );
    }
    const maxResults = gmailReadMaxResults(input);
    const listed = await invokeSquareMethod(
      client,
      gmailRequest(["gmail", "users", "messages", "list"], {
        userId: "me",
        q: gmailReadQuery(input),
        maxResults,
      }),
    );
    const list = gmailResponseRecord(listed);
    const messages = Array.isArray(list.messages)
      ? list.messages
          .filter(
            (message): message is Record<string, unknown> =>
              Boolean(message) && typeof message === "object",
          )
          .slice(0, maxResults)
      : [];
    if (!messages.length) return { results: [], attachments: [] };
    const detailed = await Promise.all(
      messages.map(async (message) => {
        if (typeof message.id !== "string" || !message.id) return undefined;
        const result = await invokeSquareMethod(
          client,
          gmailRequest(["gmail", "users", "messages", "get"], {
            userId: "me",
            id: message.id,
            format: "full",
          }),
        );
        return gmailFormatReadMessage(
          client,
          result,
          optionalVercelBoolean(input, "includeAttachments") ?? false,
          maximumAttachmentBytes,
        );
      }),
    );
    const results = detailed.filter(
      (message): message is Record<string, unknown> => message !== undefined,
    );
    if (maxResults === 1) {
      return results.at(0) ?? { results: [], attachments: [] };
    }
    return {
      results: results.map((message) => ({
        id: message.id,
        threadId: message.threadId,
        subject: message.subject,
        from: message.from,
        to: message.to,
        date: message.date,
      })),
      attachments: results.flatMap((message) =>
        Array.isArray(message.attachments) ? message.attachments : [],
      ),
    };
  }
  const replyToMessageId = optionalVercelString(input, "replyToMessageId");
  const replyHeaders = replyToMessageId
    ? await gmailReplyHeaders(client, replyToMessageId)
    : {};
  const raw = gmailRawMessage(input, maximumAttachmentBytes, replyHeaders);
  const threadId =
    optionalVercelString(input, "threadId") ?? replyHeaders.threadId;
  const message = definedVercelFields({ raw, threadId });
  if (operationId === "gmail:send-email") {
    return invokeSquareMethod(
      client,
      gmailRequest(["gmail", "users", "messages", "send"], {
        userId: "me",
        requestBody: message,
      }),
    );
  }
  const requestBody = { message };
  return invokeSquareMethod(
    client,
    gmailRequest(
      operationId === "gmail:draft-email"
        ? ["gmail", "users", "drafts", "create"]
        : ["gmail", "users", "drafts", "update"],
      definedVercelFields({
        userId: "me",
        id:
          operationId === "gmail:edit-draft"
            ? requiredVercelString(input, "draftId")
            : undefined,
        requestBody,
      }),
    ),
  );
}

/** All pinned Gmail actions use Google's official Node.js SDK. */
export function createGmailProviderSdk(
  config: GmailProviderSdkConfig,
): IntegrationProviderSdk {
  assertGmailOperationCoverage();
  const clientFactory = config.clientFactory ?? createGmailClient;
  const maximumAttachmentBytes = config.maxAttachmentBytes ?? 25 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maximumAttachmentBytes) ||
    maximumAttachmentBytes < 1 ||
    maximumAttachmentBytes > 40 * 1024 * 1024
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return {
    integrationId: "gmail",
    operationIds: GMAIL_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "gmail" ||
        invocation.reference.integrationId !== "gmail"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = GMAIL_OPERATION_REQUESTS[invocation.operationId];
      if (
        !requestFactory &&
        ![
          "gmail:send-email",
          "gmail:read-email",
          "gmail:draft-email",
          "gmail:edit-draft",
        ].includes(invocation.operationId)
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const client = clientFactory(credential.accessToken);
          const result = requestFactory
            ? await invokeSquareMethod(client, requestFactory(invocation.input))
            : await executeGmailSpecialOperation(
                client,
                invocation.operationId,
                invocation.input,
                maximumAttachmentBytes,
              );
          return {
            operationId: invocation.operationId,
            output: googleCalendarResponseData(result),
          };
        },
      );
    },
  };
}

export function getGmailProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGmailOperationCoverage();
  return {
    operations: GMAIL_OPERATION_IDS.length,
    operationIds: GMAIL_OPERATION_IDS,
  };
}

type GoogleSlidesSdkClient = Record<string, unknown>;
type GoogleSlidesClientFactory = (accessToken: string) => GoogleSlidesSdkClient;

export interface GoogleSlidesProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleSlidesClientFactory;
  /**
   * Optional product-owned file persistence seam. The package downloads and
   * bounds export bytes; the product may retain them in its own file model.
   */
  exportSink?(input: {
    bytes: Uint8Array;
    mimeType: string;
    presentationId: string;
  }): Promise<unknown>;
  /** Bounds an encoded export so the execution route never serializes an unlimited file. */
  maxExportBytes?: number;
}

function createGoogleSlidesClient(accessToken: string): GoogleSlidesSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return {
    slides: google.slides({ version: "v1", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

const GOOGLE_SLIDES_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-slides",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleSlidesSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleSlidesRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleSlidesSdkRequest {
  return { path, arguments: [definedVercelFields(request)] };
}

function requiredGoogleSlidesRecord(
  input: Readonly<Record<string, unknown>>,
  field: string,
): Record<string, unknown> {
  const value = input[field];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value as Record<string, unknown>;
}

function googleSlidesPresentationId(
  input: Readonly<Record<string, unknown>>,
): string {
  return requiredVercelString(input, "presentationId");
}

function googleSlidesBatchUpdateRequest(
  input: Readonly<Record<string, unknown>>,
  requestName?: string,
): GoogleSlidesSdkRequest {
  const requestBody = requestName
    ? {
        requests: [
          { [requestName]: requiredGoogleSlidesRecord(input, "request") },
        ],
      }
    : { requests: requiredSquareValue(input, "requests") };
  if (!Array.isArray(requestBody.requests) || !requestBody.requests.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return googleSlidesRequest(["slides", "presentations", "batchUpdate"], {
    presentationId: googleSlidesPresentationId(input),
    requestBody,
  });
}

const GOOGLE_SLIDES_BATCH_REQUEST_NAMES: Readonly<Record<string, string>> = {
  "google-slides:replace-all-text": "replaceAllText",
  "google-slides:replace-all-shapes-with-image": "replaceAllShapesWithImage",
  "google-slides:replace-image": "replaceImage",
  "google-slides:update-image-properties": "updateImageProperties",
  "google-slides:add-slide": "createSlide",
  "google-slides:add-image": "createImage",
  "google-slides:delete-object": "deleteObject",
  "google-slides:duplicate-object": "duplicateObject",
  "google-slides:reorder-slides": "updateSlidesPosition",
  "google-slides:create-table": "createTable",
  "google-slides:create-shape": "createShape",
  "google-slides:create-line": "createLine",
  "google-slides:insert-text": "insertText",
  "google-slides:delete-text": "deleteText",
  "google-slides:update-text-style": "updateTextStyle",
  "google-slides:update-paragraph-style": "updateParagraphStyle",
  "google-slides:create-paragraph-bullets": "createParagraphBullets",
  "google-slides:delete-paragraph-bullets": "deleteParagraphBullets",
  "google-slides:update-shape-properties": "updateShapeProperties",
  "google-slides:update-page-properties": "updatePageProperties",
  "google-slides:update-slide-properties": "updateSlideProperties",
  "google-slides:update-alt-text": "updatePageElementAltText",
  "google-slides:update-element-transform": "updatePageElementTransform",
  "google-slides:update-z-order": "updatePageElementsZOrder",
  "google-slides:group-objects": "groupObjects",
  "google-slides:ungroup-objects": "ungroupObjects",
  "google-slides:update-line-properties": "updateLineProperties",
  "google-slides:update-line-category": "updateLineCategory",
  "google-slides:reroute-line": "rerouteLine",
  "google-slides:insert-table-rows": "insertTableRows",
  "google-slides:insert-table-columns": "insertTableColumns",
  "google-slides:delete-table-row": "deleteTableRow",
  "google-slides:delete-table-column": "deleteTableColumn",
  "google-slides:merge-table-cells": "mergeTableCells",
  "google-slides:unmerge-table-cells": "unmergeTableCells",
  "google-slides:update-table-cell-properties": "updateTableCellProperties",
  "google-slides:update-table-border-properties": "updateTableBorderProperties",
  "google-slides:update-table-column-properties": "updateTableColumnProperties",
  "google-slides:update-table-row-properties": "updateTableRowProperties",
  "google-slides:embed-sheets-chart": "createSheetsChart",
  "google-slides:refresh-sheets-chart": "refreshSheetsChart",
  "google-slides:replace-all-shapes-with-sheets-chart":
    "replaceAllShapesWithSheetsChart",
  "google-slides:embed-video": "createVideo",
  "google-slides:update-video-properties": "updateVideoProperties",
};

const GOOGLE_SLIDES_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleSlidesSdkRequest
  >
> = {
  "google-slides:read-presentation": (input) =>
    googleSlidesRequest(["slides", "presentations", "get"], {
      presentationId: googleSlidesPresentationId(input),
      fields: optionalVercelString(input, "fields"),
    }),
  "google-slides:write-to-presentation": (input) =>
    googleSlidesBatchUpdateRequest(input),
  "google-slides:create-presentation": (input) =>
    googleSlidesRequest(["slides", "presentations", "create"], {
      requestBody: definedVercelFields({
        title: requiredVercelString(input, "title"),
      }),
    }),
  "google-slides:copy-presentation": (input) =>
    googleSlidesRequest(["drive", "files", "copy"], {
      fileId:
        optionalVercelString(input, "sourcePresentationId") ??
        googleSlidesPresentationId(input),
      supportsAllDrives: optionalVercelBoolean(input, "supportsAllDrives"),
      requestBody: definedVercelFields({
        name: requiredVercelString(input, "title"),
        parents: optionalVercelString(input, "destinationFolderId")
          ? [optionalVercelString(input, "destinationFolderId")]
          : undefined,
      }),
    }),
  "google-slides:export-presentation": (input) =>
    googleSlidesRequest(["drive", "files", "export"], {
      fileId: googleSlidesPresentationId(input),
      mimeType: requiredVercelString(input, "mimeType"),
      responseType: "arraybuffer",
    }),
  "google-slides:batch-update-raw": (input) =>
    googleSlidesBatchUpdateRequest(input),
  "google-slides:get-thumbnail": (input) =>
    googleSlidesRequest(["slides", "presentations", "pages", "getThumbnail"], {
      presentationId: googleSlidesPresentationId(input),
      pageObjectId: requiredVercelString(input, "pageObjectId"),
      "thumbnailProperties.mimeType": optionalVercelString(input, "mimeType"),
      "thumbnailProperties.thumbnailSize": optionalVercelString(
        input,
        "thumbnailSize",
      ),
    }),
  "google-slides:get-page": (input) =>
    googleSlidesRequest(["slides", "presentations", "pages", "get"], {
      presentationId: googleSlidesPresentationId(input),
      pageObjectId: requiredVercelString(input, "pageObjectId"),
    }),
  ...Object.fromEntries(
    Object.entries(GOOGLE_SLIDES_BATCH_REQUEST_NAMES).map(
      ([operationId, requestName]) => [
        operationId,
        (input: Readonly<Record<string, unknown>>) =>
          googleSlidesBatchUpdateRequest(input, requestName),
      ],
    ),
  ),
};

function assertGoogleSlidesOperationCoverage(): void {
  const expected = new Set(GOOGLE_SLIDES_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_SLIDES_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Slides provider SDK operation coverage is incomplete.",
    );
  }
}

function googleSlidesExportOutput(
  value: unknown,
  maximumBytes: number,
): Uint8Array | unknown {
  const data = googleCalendarResponseData(value);
  if (!data || typeof data !== "object" || !("byteLength" in data)) {
    return data;
  }
  const bytes = new Uint8Array(data as ArrayBufferLike);
  if (bytes.byteLength > maximumBytes) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return bytes;
}

/**
 * All pinned Slides actions route through Google's official client. Batch
 * actions accept the documented Google Slides Request body in `input.request`;
 * this keeps the package responsible for OAuth, client construction, and
 * atomic execution while products retain only business-level request data.
 */
export function createGoogleSlidesProviderSdk(
  config: GoogleSlidesProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleSlidesOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleSlidesClient;
  const maximumExportBytes = config.maxExportBytes ?? 25 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maximumExportBytes) ||
    maximumExportBytes < 1 ||
    maximumExportBytes > 100 * 1024 * 1024
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return {
    integrationId: "google-slides",
    operationIds: GOOGLE_SLIDES_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-slides" ||
        invocation.reference.integrationId !== "google-slides"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_SLIDES_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const result = await invokeSquareMethod(
            clientFactory(credential.accessToken),
            requestFactory(invocation.input),
          );
          if (invocation.operationId === "google-slides:export-presentation") {
            const exported = googleSlidesExportOutput(
              result,
              maximumExportBytes,
            );
            const mimeType = requiredVercelString(invocation.input, "mimeType");
            const output =
              exported instanceof Uint8Array
                ? config.exportSink
                  ? await config.exportSink({
                      bytes: exported,
                      mimeType,
                      presentationId: googleSlidesPresentationId(
                        invocation.input,
                      ),
                    })
                  : {
                      encoding: "base64",
                      mimeType,
                      data: Buffer.from(exported).toString("base64"),
                    }
                : exported;
            return { operationId: invocation.operationId, output };
          }
          return {
            operationId: invocation.operationId,
            output: googleCalendarResponseData(result),
          };
        },
      );
    },
  };
}

export function getGoogleSlidesProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleSlidesOperationCoverage();
  return {
    operations: GOOGLE_SLIDES_OPERATION_IDS.length,
    operationIds: GOOGLE_SLIDES_OPERATION_IDS,
  };
}

type YouTubeSdkClient = Record<string, unknown>;
type YouTubeClientFactory = (apiKey: string) => YouTubeSdkClient;

export interface YouTubeProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: YouTubeClientFactory;
}

function createYouTubeClient(apiKey: string): YouTubeSdkClient {
  return { youtube: google.youtube({ version: "v3", auth: apiKey }) };
}

const YOUTUBE_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "youtube",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface YouTubeSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function youTubeRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): YouTubeSdkRequest {
  return { path, arguments: [definedVercelFields(request)] };
}

function youTubeParts(
  input: Readonly<Record<string, unknown>>,
  fallback: string,
): string {
  return optionalVercelString(input, "part") ?? fallback;
}

const YOUTUBE_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => YouTubeSdkRequest
  >
> = {
  "youtube:search-videos": (input) =>
    youTubeRequest(["youtube", "search", "list"], {
      part: youTubeParts(input, "snippet"),
      q: requiredVercelString(input, "query"),
      type: "video",
      channelId: optionalVercelString(input, "channelId"),
      channelType: optionalVercelString(input, "channelType"),
      eventType: optionalVercelString(input, "eventType"),
      location: optionalVercelString(input, "location"),
      locationRadius: optionalVercelString(input, "locationRadius"),
      maxResults: optionalVercelNumber(input, "maxResults"),
      order: optionalVercelString(input, "order"),
      pageToken: optionalVercelString(input, "pageToken"),
      publishedAfter: optionalVercelString(input, "publishedAfter"),
      publishedBefore: optionalVercelString(input, "publishedBefore"),
      regionCode: optionalVercelString(input, "regionCode"),
      relevanceLanguage: optionalVercelString(input, "relevanceLanguage"),
      safeSearch: optionalVercelString(input, "safeSearch"),
      videoCaption: optionalVercelString(input, "videoCaption"),
      videoCategoryId: optionalVercelString(input, "videoCategoryId"),
      videoDefinition: optionalVercelString(input, "videoDefinition"),
      videoDimension: optionalVercelString(input, "videoDimension"),
      videoDuration: optionalVercelString(input, "videoDuration"),
      videoEmbeddable: optionalVercelString(input, "videoEmbeddable"),
      videoLicense: optionalVercelString(input, "videoLicense"),
      videoSyndicated: optionalVercelString(input, "videoSyndicated"),
      videoType: optionalVercelString(input, "videoType"),
    }),
  "youtube:get-trending-videos": (input) =>
    youTubeRequest(["youtube", "videos", "list"], {
      part: youTubeParts(input, "snippet,contentDetails,statistics"),
      chart: "mostPopular",
      regionCode: optionalVercelString(input, "regionCode"),
      videoCategoryId: optionalVercelString(input, "videoCategoryId"),
      maxResults: optionalVercelNumber(input, "maxResults"),
      pageToken: optionalVercelString(input, "pageToken"),
    }),
  "youtube:get-video-details": (input) =>
    youTubeRequest(["youtube", "videos", "list"], {
      part: youTubeParts(
        input,
        "snippet,contentDetails,statistics,status,liveStreamingDetails",
      ),
      id: requiredVercelString(input, "videoId"),
    }),
  "youtube:get-video-categories": (input) =>
    youTubeRequest(["youtube", "videoCategories", "list"], {
      part: youTubeParts(input, "snippet"),
      regionCode: optionalVercelString(input, "regionCode"),
      hl: optionalVercelString(input, "hl"),
    }),
  "youtube:get-channel-info": (input) => {
    const channelId = optionalVercelString(input, "channelId");
    const forHandle = optionalVercelString(input, "handle");
    const forUsername = optionalVercelString(input, "username");
    if (!channelId && !forHandle && !forUsername) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return youTubeRequest(["youtube", "channels", "list"], {
      part: youTubeParts(
        input,
        "snippet,contentDetails,statistics,brandingSettings",
      ),
      id: channelId,
      forHandle,
      forUsername,
      maxResults: optionalVercelNumber(input, "maxResults"),
    });
  },
  "youtube:get-channel-videos": (input) =>
    youTubeRequest(["youtube", "search", "list"], {
      part: youTubeParts(input, "snippet"),
      channelId: requiredVercelString(input, "channelId"),
      type: "video",
      maxResults: optionalVercelNumber(input, "maxResults"),
      order: optionalVercelString(input, "order") ?? "date",
      pageToken: optionalVercelString(input, "pageToken"),
      publishedAfter: optionalVercelString(input, "publishedAfter"),
      publishedBefore: optionalVercelString(input, "publishedBefore"),
    }),
  "youtube:get-channel-playlists": (input) =>
    youTubeRequest(["youtube", "playlists", "list"], {
      part: youTubeParts(input, "snippet,contentDetails"),
      channelId: requiredVercelString(input, "channelId"),
      maxResults: optionalVercelNumber(input, "maxResults"),
      pageToken: optionalVercelString(input, "pageToken"),
    }),
  "youtube:get-playlist-items": (input) =>
    youTubeRequest(["youtube", "playlistItems", "list"], {
      part: youTubeParts(input, "snippet,contentDetails,status"),
      playlistId: requiredVercelString(input, "playlistId"),
      maxResults: optionalVercelNumber(input, "maxResults"),
      pageToken: optionalVercelString(input, "pageToken"),
      videoId: optionalVercelString(input, "videoId"),
    }),
  "youtube:get-video-comments": (input) =>
    youTubeRequest(["youtube", "commentThreads", "list"], {
      part: youTubeParts(input, "snippet,replies"),
      videoId: requiredVercelString(input, "videoId"),
      maxResults: optionalVercelNumber(input, "maxResults"),
      order: optionalVercelString(input, "order"),
      pageToken: optionalVercelString(input, "pageToken"),
      searchTerms: optionalVercelString(input, "searchTerms"),
      textFormat: optionalVercelString(input, "textFormat"),
    }),
};

function assertYouTubeOperationCoverage(): void {
  const expected = new Set(YOUTUBE_OPERATION_IDS);
  const implemented = Object.keys(YOUTUBE_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("YouTube provider SDK operation coverage is incomplete.");
  }
}

/** All pinned YouTube actions use Google's official Node.js SDK. */
export function createYouTubeProviderSdk(
  config: YouTubeProviderSdkConfig,
): IntegrationProviderSdk {
  assertYouTubeOperationCoverage();
  const clientFactory = config.clientFactory ?? createYouTubeClient;
  return {
    integrationId: "youtube",
    operationIds: YOUTUBE_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "youtube" ||
        invocation.reference.integrationId !== "youtube"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = YOUTUBE_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: googleCalendarResponseData(
            await invokeSquareMethod(
              clientFactory(credential.apiKey),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getYouTubeProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertYouTubeOperationCoverage();
  return {
    operations: YOUTUBE_OPERATION_IDS.length,
    operationIds: YOUTUBE_OPERATION_IDS,
  };
}

type ResendSdkClient = Record<string, unknown>;
type ResendClientFactory = (apiKey: string) => ResendSdkClient;

export interface ResendProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: ResendClientFactory;
}

function createResendClient(apiKey: string): ResendSdkClient {
  return { resend: new Resend(apiKey) };
}

const RESEND_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "resend",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface ResendSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function resendRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): ResendSdkRequest {
  return { path, arguments: arguments_ };
}

function resendStringList(
  input: Readonly<Record<string, unknown>>,
  field: string,
): string[] | undefined {
  const value = optionalVercelString(input, field);
  if (!value) return undefined;
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!entries.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return entries;
}

function resendTags(
  input: Readonly<Record<string, unknown>>,
): Array<{ name: string; value: string }> | undefined {
  const tags = optionalVercelString(input, "tags");
  if (!tags) return undefined;
  const parsed = tags.split(",").map((entry) => {
    const [name, ...value] = entry.trim().split(":");
    if (!name || !value.length || !value.join(":").trim()) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return { name, value: value.join(":").trim() };
  });
  return parsed.length ? parsed : undefined;
}

function resendContactSelector(
  input: Readonly<Record<string, unknown>>,
): { id: string } | { email: string } {
  const contactId = requiredVercelString(input, "contactId");
  return contactId.includes("@") ? { email: contactId } : { id: contactId };
}

function resendEmailPayload(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const contentType = optionalVercelString(input, "contentType") ?? "text";
  if (contentType !== "text" && contentType !== "html") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const body = requiredVercelString(input, "body");
  return definedVercelFields({
    from: requiredVercelString(input, "fromAddress"),
    to: resendStringList(input, "to") ?? requiredVercelString(input, "to"),
    subject: requiredVercelString(input, "subject"),
    text: contentType === "text" ? body : undefined,
    html: contentType === "html" ? body : undefined,
    cc: resendStringList(input, "cc"),
    bcc: resendStringList(input, "bcc"),
    replyTo: resendStringList(input, "replyTo"),
    scheduledAt: optionalVercelString(input, "scheduledAt"),
    tags: resendTags(input),
  });
}

const RESEND_OPERATION_REQUESTS: Readonly<
  Record<string, (input: Readonly<Record<string, unknown>>) => ResendSdkRequest>
> = {
  "resend:send-email": (input) =>
    resendRequest(["resend", "emails", "send"], resendEmailPayload(input)),
  "resend:get-email": (input) =>
    resendRequest(
      ["resend", "emails", "get"],
      requiredVercelString(input, "emailId"),
    ),
  "resend:cancel-email": (input) =>
    resendRequest(
      ["resend", "emails", "cancel"],
      requiredVercelString(input, "cancelEmailId"),
    ),
  "resend:create-contact": (input) =>
    resendRequest(
      ["resend", "contacts", "create"],
      definedVercelFields({
        email: requiredVercelString(input, "email"),
        firstName: optionalVercelString(input, "firstName"),
        lastName: optionalVercelString(input, "lastName"),
        unsubscribed: optionalVercelBoolean(input, "unsubscribed"),
      }),
    ),
  "resend:list-contacts": (input) =>
    resendRequest(
      ["resend", "contacts", "list"],
      definedVercelFields({
        limit: optionalVercelNumber(input, "limit"),
        after: optionalVercelString(input, "after"),
        before: optionalVercelString(input, "before"),
      }),
    ),
  "resend:get-contact": (input) =>
    resendRequest(
      ["resend", "contacts", "get"],
      requiredVercelString(input, "contactId"),
    ),
  "resend:update-contact": (input) => {
    const update = definedVercelFields({
      ...resendContactSelector(input),
      firstName: optionalVercelString(input, "firstName"),
      lastName: optionalVercelString(input, "lastName"),
      unsubscribed: optionalVercelBoolean(input, "unsubscribed"),
    });
    if (Object.keys(update).length === 1) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return resendRequest(["resend", "contacts", "update"], update);
  },
  "resend:delete-contact": (input) =>
    resendRequest(
      ["resend", "contacts", "remove"],
      resendContactSelector(input),
    ),
  "resend:create-audience": (input) =>
    resendRequest(["resend", "audiences", "create"], {
      name: requiredVercelString(input, "audienceName"),
    }),
  "resend:get-audience": (input) =>
    resendRequest(
      ["resend", "audiences", "get"],
      requiredVercelString(input, "audienceId"),
    ),
  "resend:list-audiences": (input) =>
    resendRequest(
      ["resend", "audiences", "list"],
      definedVercelFields({
        limit: optionalVercelNumber(input, "limit"),
        after: optionalVercelString(input, "after"),
        before: optionalVercelString(input, "before"),
      }),
    ),
  "resend:delete-audience": (input) =>
    resendRequest(
      ["resend", "audiences", "remove"],
      requiredVercelString(input, "audienceId"),
    ),
  "resend:create-broadcast": (input) => {
    const html = optionalVercelString(input, "broadcastHtml");
    const text = optionalVercelString(input, "broadcastText");
    if (!html && !text) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return resendRequest(
      ["resend", "broadcasts", "create"],
      definedVercelFields({
        audienceId: requiredVercelString(input, "audienceId"),
        from: requiredVercelString(input, "broadcastFrom"),
        subject: requiredVercelString(input, "broadcastSubject"),
        html,
        text,
        replyTo: resendStringList(input, "broadcastReplyTo"),
        name: optionalVercelString(input, "broadcastName"),
        previewText: optionalVercelString(input, "broadcastPreviewText"),
      }),
    );
  },
  "resend:send-broadcast": (input) =>
    resendRequest(
      ["resend", "broadcasts", "send"],
      requiredVercelString(input, "broadcastId"),
      definedVercelFields({
        scheduledAt: optionalVercelString(input, "broadcastScheduledAt"),
      }),
    ),
  "resend:get-broadcast": (input) =>
    resendRequest(
      ["resend", "broadcasts", "get"],
      requiredVercelString(input, "broadcastId"),
    ),
  "resend:list-domains": (input) =>
    resendRequest(
      ["resend", "domains", "list"],
      definedVercelFields({
        limit: optionalVercelNumber(input, "limit"),
        after: optionalVercelString(input, "after"),
        before: optionalVercelString(input, "before"),
      }),
    ),
};

function resendResponseData(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const response = value as Record<string, unknown>;
  return response.error ? response : (response.data ?? response);
}

function assertResendOperationCoverage(): void {
  const expected = new Set(RESEND_OPERATION_IDS);
  const implemented = Object.keys(RESEND_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Resend provider SDK operation coverage is incomplete.");
  }
}

/** All pinned Resend actions use the vendor's official Node.js SDK. */
export function createResendProviderSdk(
  config: ResendProviderSdkConfig,
): IntegrationProviderSdk {
  assertResendOperationCoverage();
  const clientFactory = config.clientFactory ?? createResendClient;
  return {
    integrationId: "resend",
    operationIds: RESEND_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "resend" ||
        invocation.reference.integrationId !== "resend"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = RESEND_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: resendResponseData(
            await invokeSquareMethod(
              clientFactory(credential.apiKey),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getResendProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertResendOperationCoverage();
  return {
    operations: RESEND_OPERATION_IDS.length,
    operationIds: RESEND_OPERATION_IDS,
  };
}

function extraOperationIds(integrationId: string): readonly string[] {
  return Object.freeze(
    INTEGRATION_CATALOGUE.find(
      (integration) => integration.id === integrationId,
    )?.operations.map((operation) => operation.id) ?? [],
  );
}

function requiredExtraString(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): string {
  return requiredVercelString(input, ...names);
}

function requiredExtraRecord(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): Record<string, unknown> {
  const record = squareOptionalRecord(input, ...names);
  if (!record) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return record;
}

function checkedProviderInvocation(
  rawInput: ProviderSdkInvocation,
  integrationId: string,
): ProviderSdkInvocation {
  const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  if (
    parsed.data.integrationId !== integrationId ||
    parsed.data.reference.integrationId !== integrationId
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    );
  }
  return parsed.data;
}

type BrexSdkClient = Record<string, unknown>;
type BrexClientFactory = (apiKey: string) => BrexSdkClient;

export interface BrexProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: BrexClientFactory;
}

function createBrexClient(apiKey: string): BrexSdkClient {
  return new Brex({ token: apiKey }) as unknown as BrexSdkClient;
}

const BREX_SDK_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "brex",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

function brexOptions(
  invocation: ProviderSdkInvocation,
): Record<string, string> | undefined {
  return invocation.idempotencyKey
    ? { idempotencyKey: invocation.idempotencyKey }
    : undefined;
}

function brexList(
  path: readonly string[],
  input: Readonly<Record<string, unknown>>,
): SquareSdkRequest {
  return { path, arguments: [squareOptionalRecord(input, "query")] };
}

function brexGet(
  path: readonly string[],
  input: Readonly<Record<string, unknown>>,
  ...identifierNames: readonly string[]
): SquareSdkRequest {
  return {
    path,
    arguments: [requiredExtraString(input, ...identifierNames)],
  };
}

function brexWrite(
  path: readonly string[],
  input: Readonly<Record<string, unknown>>,
  invocation: ProviderSdkInvocation,
  identifierNames?: readonly string[],
): SquareSdkRequest {
  const options = brexOptions(invocation);
  const body = requiredExtraRecord(input, "body");
  return {
    path,
    arguments: identifierNames
      ? [requiredExtraString(input, ...identifierNames), body, options]
      : [body, options],
  };
}

const BREX_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (
      input: Readonly<Record<string, unknown>>,
      invocation: ProviderSdkInvocation,
    ) => SquareSdkRequest
  >
> = {
  "brex:list-expenses": (input) => brexList(["expenses", "list"], input),
  "brex:get-expense": (input) =>
    brexGet(["expenses", "get"], input, "expenseId", "id"),
  "brex:update-expense-memo": (input, invocation) =>
    brexWrite(["cardExpenses", "update"], input, invocation, [
      "expenseId",
      "id",
    ]),
  "brex:upload-receipt": (input, invocation) => ({
    path: ["receipts", "upload"],
    arguments: [
      requiredExtraString(input, "expenseId", "id"),
      requiredExtraRecord(input, "body"),
      brexOptions(invocation),
    ],
  }),
  "brex:match-receipt": (input, invocation) =>
    brexWrite(["receipts", "match"], input, invocation),
  "brex:list-card-transactions": (input) =>
    brexList(["transactions", "listPrimaryCard"], input),
  "brex:list-cash-transactions": (input) => ({
    path: ["transactions", "listCash"],
    arguments: [
      requiredExtraString(input, "cashAccountId", "accountId"),
      squareOptionalRecord(input, "query"),
    ],
  }),
  "brex:list-card-accounts": () => ({
    path: ["accounts", "listCard"],
    arguments: [],
  }),
  "brex:list-cash-accounts": () => ({
    path: ["accounts", "list"],
    arguments: [],
  }),
  "brex:get-cash-account": (input) => {
    const id = optionalVercelString(input, "cashAccountId", "accountId");
    return id
      ? { path: ["accounts", "get"], arguments: [id] }
      : { path: ["accounts", "getPrimary"], arguments: [] };
  },
  "brex:list-card-statements": (input) =>
    brexList(["accounts", "listPrimaryCardStatements"], input),
  "brex:list-cash-statements": (input) => ({
    path: ["accounts", "listCashStatements"],
    arguments: [
      requiredExtraString(input, "cashAccountId", "accountId"),
      squareOptionalRecord(input, "query"),
    ],
  }),
  "brex:list-users": (input) => brexList(["users", "list"], input),
  "brex:get-user": (input) => brexGet(["users", "get"], input, "userId", "id"),
  "brex:get-current-user": () => ({
    path: ["users", "getMe"],
    arguments: [],
  }),
  "brex:list-departments": (input) => brexList(["departments", "list"], input),
  "brex:list-locations": (input) => brexList(["locations", "list"], input),
  "brex:list-titles": (input) => brexList(["titles", "list"], input),
  "brex:list-cards": (input) => brexList(["cards", "list"], input),
  "brex:get-company": () => ({ path: ["companies", "get"], arguments: [] }),
  "brex:list-budgets": (input) => brexList(["budgets", "list"], input),
  "brex:get-budget": (input) =>
    brexGet(["budgets", "get"], input, "budgetId", "id"),
  "brex:create-budget": (input, invocation) =>
    brexWrite(["budgets", "create"], input, invocation),
  "brex:archive-budget": (input, invocation) => ({
    path: ["budgets", "archive"],
    arguments: [
      requiredExtraString(input, "budgetId", "id"),
      brexOptions(invocation),
    ],
  }),
  "brex:list-spend-limits": (input) => brexList(["spendLimits", "list"], input),
  "brex:get-spend-limit": (input) =>
    brexGet(["spendLimits", "get"], input, "spendLimitId", "id"),
  "brex:create-spend-limit": (input, invocation) =>
    brexWrite(["spendLimits", "create"], input, invocation),
  "brex:list-vendors": (input) => brexList(["vendors", "list"], input),
  "brex:get-vendor": (input) =>
    brexGet(["vendors", "get"], input, "vendorId", "id"),
  "brex:create-vendor": (input, invocation) =>
    brexWrite(["vendors", "create"], input, invocation),
  "brex:update-vendor": (input, invocation) =>
    brexWrite(["vendors", "update"], input, invocation, ["vendorId", "id"]),
  "brex:list-transfers": (input) => brexList(["transfers", "list"], input),
  "brex:get-transfer": (input) =>
    brexGet(["transfers", "get"], input, "transferId", "id"),
  "brex:create-transfer": (input, invocation) =>
    brexWrite(["transfers", "create"], input, invocation),
};

function assertBrexOperationCoverage(): void {
  const expected = new Set(BREX_SDK_OPERATION_IDS);
  const implemented = Object.keys(BREX_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Brex provider SDK operation coverage is incomplete.");
  }
}

/** Every pinned Brex action runs through the typed Brex SDK. */
export function createBrexProviderSdk(
  config: BrexProviderSdkConfig,
): IntegrationProviderSdk {
  assertBrexOperationCoverage();
  const clientFactory = config.clientFactory ?? createBrexClient;
  return {
    integrationId: "brex",
    operationIds: BREX_SDK_OPERATION_IDS,
    async execute(rawInput) {
      const invocation = checkedProviderInvocation(rawInput, "brex");
      const requestFactory = BREX_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: normalizeSquareOutput(
            await invokeSquareMethod(
              clientFactory(credential.apiKey),
              requestFactory(invocation.input, invocation),
            ),
          ),
        }),
      );
    },
  };
}

export function getBrexProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertBrexOperationCoverage();
  return {
    operations: BREX_SDK_OPERATION_IDS.length,
    operationIds: BREX_SDK_OPERATION_IDS,
  };
}

type QuickBooksSdkClient = Record<string, unknown>;

export interface QuickBooksProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientId: string;
  clientSecret: string;
  sandbox?: boolean;
  /** Reads the authorized realm ID from the product's durable connection record. */
  companyId:
    | string
    | ((reference: IntegrationCredentialReference) => Promise<string>);
  clientFactory?: (input: {
    clientId: string;
    clientSecret: string;
    accessToken: string;
    refreshToken?: string;
    companyId: string;
    sandbox: boolean;
  }) => QuickBooksSdkClient;
}

function createQuickBooksClient(input: {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken?: string;
  companyId: string;
  sandbox: boolean;
}): QuickBooksSdkClient {
  const QuickBooks = quickBooksRequire("node-quickbooks") as new (
    consumerKey: string,
    consumerSecret: string,
    oauthToken: string,
    oauthTokenSecret: false,
    realmId: string,
    useSandbox: boolean,
    debug?: boolean,
    minorversion?: string | null,
    oauthversion?: string,
    refreshToken?: string,
  ) => QuickBooksSdkClient;
  return new QuickBooks(
    input.clientId,
    input.clientSecret,
    input.accessToken,
    false,
    input.companyId,
    input.sandbox,
    false,
    null,
    "2.0",
    input.refreshToken,
  ) as unknown as QuickBooksSdkClient;
}

const QUICKBOOKS_SDK_OPERATION_IDS = extraOperationIds("quickbooks");

function quickBooksCall(
  client: QuickBooksSdkClient,
  method: string,
  args: readonly unknown[],
): Promise<unknown> {
  const candidate = client[method];
  if (typeof candidate !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return new Promise((resolve, reject) => {
    const callback = (error: unknown, value: unknown) => {
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };
    try {
      candidate.apply(client, [...args, callback]);
    } catch (error) {
      reject(error);
    }
  });
}

function quickBooksQuery(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return squareOptionalRecord(input, "query", "criteria") ?? {};
}

const QUICKBOOKS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => {
      method: string;
      args: readonly unknown[];
    }
  >
> = {
  "quickbooks:list-accounts": (input) => ({
    method: "findAccounts",
    args: [quickBooksQuery(input)],
  }),
  "quickbooks:list-customers": (input) => ({
    method: "findCustomers",
    args: [quickBooksQuery(input)],
  }),
  "quickbooks:list-invoices": (input) => ({
    method: "findInvoices",
    args: [quickBooksQuery(input)],
  }),
  "quickbooks:list-payments": (input) => ({
    method: "findPayments",
    args: [quickBooksQuery(input)],
  }),
  "quickbooks:get-company-info": (input) => ({
    method: "findCompanyInfos",
    args: [quickBooksQuery(input)],
  }),
  "quickbooks:create-invoice": (input) => ({
    method: "createInvoice",
    args: [requiredExtraRecord(input, "invoice", "body")],
  }),
};

function assertQuickBooksOperationCoverage(): void {
  const expected = new Set(QUICKBOOKS_SDK_OPERATION_IDS);
  const implemented = Object.keys(QUICKBOOKS_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "QuickBooks provider SDK operation coverage is incomplete.",
    );
  }
}

/** QuickBooks Online actions use the maintained typed Node SDK. */
export function createQuickBooksProviderSdk(
  config: QuickBooksProviderSdkConfig,
): IntegrationProviderSdk {
  assertQuickBooksOperationCoverage();
  const clientFactory = config.clientFactory ?? createQuickBooksClient;
  return {
    integrationId: "quickbooks",
    operationIds: QUICKBOOKS_SDK_OPERATION_IDS,
    async execute(rawInput) {
      const invocation = checkedProviderInvocation(rawInput, "quickbooks");
      const request = QUICKBOOKS_OPERATION_REQUESTS[invocation.operationId];
      if (!request) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      const companyId =
        typeof config.companyId === "string"
          ? config.companyId
          : await config.companyId(invocation.reference);
      if (!companyId) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await quickBooksCall(
            clientFactory({
              clientId: config.clientId,
              clientSecret: config.clientSecret,
              accessToken: credential.accessToken,
              refreshToken: credential.refreshToken,
              companyId,
              sandbox: config.sandbox ?? false,
            }),
            request(invocation.input).method,
            request(invocation.input).args,
          ),
        }),
      );
    },
  };
}

export function getQuickBooksProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertQuickBooksOperationCoverage();
  return {
    operations: QUICKBOOKS_SDK_OPERATION_IDS.length,
    operationIds: QUICKBOOKS_SDK_OPERATION_IDS,
  };
}

type XeroSdkClient = {
  initialize(): Promise<unknown>;
  setTokenSet(token: Record<string, unknown>): void;
  accountingApi: Record<string, (...args: unknown[]) => Promise<unknown>>;
};

export interface XeroProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientId: string;
  clientSecret: string;
  /** Reads the selected tenant ID from the product's durable connection record. */
  tenantId:
    | string
    | ((reference: IntegrationCredentialReference) => Promise<string>);
  clientFactory?: (input: {
    clientId: string;
    clientSecret: string;
    accessToken: string;
    refreshToken?: string;
  }) => Promise<XeroSdkClient>;
}

async function createXeroSdkClient(input: {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken?: string;
}): Promise<XeroSdkClient> {
  const client = new XeroClient({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    scopes: ["offline_access"],
  });
  await client.initialize();
  client.setTokenSet({
    access_token: input.accessToken,
    ...(input.refreshToken ? { refresh_token: input.refreshToken } : {}),
  });
  return client as unknown as XeroSdkClient;
}

const XERO_SDK_OPERATION_IDS = extraOperationIds("xero");

function xeroDate(
  input: Readonly<Record<string, unknown>>,
  name: string,
): Date | undefined {
  const value = optionalVercelString(input, name);
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return parsed;
}

const XERO_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (
      tenantId: string,
      input: Readonly<Record<string, unknown>>,
      invocation: ProviderSdkInvocation,
    ) => { method: string; args: readonly unknown[] }
  >
> = {
  "xero:list-organizations": (tenantId) => ({
    method: "getOrganisations",
    args: [tenantId],
  }),
  "xero:list-accounts": (tenantId, input) => ({
    method: "getAccounts",
    args: [
      tenantId,
      xeroDate(input, "ifModifiedSince"),
      optionalVercelString(input, "where"),
      optionalVercelString(input, "order"),
    ],
  }),
  "xero:list-contacts": (tenantId, input) => ({
    method: "getContacts",
    args: [
      tenantId,
      xeroDate(input, "ifModifiedSince"),
      optionalVercelString(input, "where"),
      optionalVercelString(input, "order"),
      undefined,
      optionalVercelNumber(input, "page"),
      optionalVercelBoolean(input, "includeArchived"),
      optionalVercelBoolean(input, "summaryOnly"),
      optionalVercelString(input, "searchTerm"),
      optionalVercelNumber(input, "pageSize"),
    ],
  }),
  "xero:list-invoices": (tenantId, input) => ({
    method: "getInvoices",
    args: [
      tenantId,
      xeroDate(input, "ifModifiedSince"),
      optionalVercelString(input, "where"),
      optionalVercelString(input, "order"),
      undefined,
      undefined,
      undefined,
      undefined,
      optionalVercelNumber(input, "page"),
      optionalVercelBoolean(input, "includeArchived"),
      optionalVercelBoolean(input, "createdByMyApp"),
      optionalVercelNumber(input, "unitdp"),
      optionalVercelBoolean(input, "summaryOnly"),
      optionalVercelNumber(input, "pageSize"),
      optionalVercelString(input, "searchTerm"),
    ],
  }),
  "xero:list-bank-transactions": (tenantId, input) => ({
    method: "getBankTransactions",
    args: [
      tenantId,
      xeroDate(input, "ifModifiedSince"),
      optionalVercelString(input, "where"),
      optionalVercelString(input, "order"),
      optionalVercelNumber(input, "page"),
      optionalVercelNumber(input, "unitdp"),
      optionalVercelNumber(input, "pageSize"),
    ],
  }),
  "xero:create-invoices": (tenantId, input, invocation) => ({
    method: "createInvoices",
    args: [
      tenantId,
      requiredExtraRecord(input, "invoices", "body"),
      optionalVercelBoolean(input, "summarizeErrors"),
      optionalVercelNumber(input, "unitdp"),
      invocation.idempotencyKey,
    ],
  }),
};

function assertXeroOperationCoverage(): void {
  const expected = new Set(XERO_SDK_OPERATION_IDS);
  const implemented = Object.keys(XERO_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Xero provider SDK operation coverage is incomplete.");
  }
}

/** Xero accounting actions use Xero's official Node SDK. */
export function createXeroProviderSdk(
  config: XeroProviderSdkConfig,
): IntegrationProviderSdk {
  assertXeroOperationCoverage();
  const clientFactory = config.clientFactory ?? createXeroSdkClient;
  return {
    integrationId: "xero",
    operationIds: XERO_SDK_OPERATION_IDS,
    async execute(rawInput) {
      const invocation = checkedProviderInvocation(rawInput, "xero");
      const requestFactory = XERO_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      const tenantId =
        typeof config.tenantId === "string"
          ? config.tenantId
          : await config.tenantId(invocation.reference);
      if (!tenantId) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const client = await clientFactory({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            accessToken: credential.accessToken,
            refreshToken: credential.refreshToken,
          });
          const request = requestFactory(
            tenantId,
            invocation.input,
            invocation,
          );
          const method = client.accountingApi[request.method];
          if (typeof method !== "function") {
            throw new IntegrationProviderSdkError(
              "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
            );
          }
          return {
            operationId: invocation.operationId,
            output: await method(...request.args),
          };
        },
      );
    },
  };
}

export function getXeroProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertXeroOperationCoverage();
  return {
    operations: XERO_SDK_OPERATION_IDS.length,
    operationIds: XERO_SDK_OPERATION_IDS,
  };
}

type PlaidSdkClient = {
  accountsGet(input: { access_token: string }): Promise<{ data: unknown }>;
  accountsBalanceGet(input: {
    access_token: string;
  }): Promise<{ data: unknown }>;
  transactionsSync(input: {
    access_token: string;
    cursor?: string;
  }): Promise<{ data: unknown }>;
  itemGet(input: { access_token: string }): Promise<{ data: unknown }>;
};

export interface PlaidProviderSdkConfig {
  connectionLinkRuntime: Pick<
    IntegrationConnectionLinkRuntime,
    "withPlaidCredential"
  >;
  clientId: string;
  secret: string;
  environment?: "sandbox" | "development" | "production";
  clientFactory?: (input: {
    clientId: string;
    secret: string;
    environment: "sandbox" | "development" | "production";
  }) => PlaidSdkClient;
}

function createPlaidSdkClient(input: {
  clientId: string;
  secret: string;
  environment: "sandbox" | "development" | "production";
}): PlaidSdkClient {
  return new PlaidApi(
    new PlaidConfiguration({
      basePath: PlaidEnvironments[input.environment],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": input.clientId,
          "PLAID-SECRET": input.secret,
        },
      },
    }),
  ) as unknown as PlaidSdkClient;
}

const PLAID_SDK_OPERATION_IDS = extraOperationIds("plaid");

const PLAID_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (
      client: PlaidSdkClient,
      accessToken: string,
      input: Readonly<Record<string, unknown>>,
    ) => Promise<unknown>
  >
> = {
  "plaid:get-accounts": async (client, accessToken) =>
    (await client.accountsGet({ access_token: accessToken })).data,
  "plaid:get-balances": async (client, accessToken) =>
    (await client.accountsBalanceGet({ access_token: accessToken })).data,
  "plaid:sync-transactions": async (client, accessToken, input) =>
    (
      await client.transactionsSync({
        access_token: accessToken,
        ...(optionalVercelString(input, "cursor")
          ? { cursor: optionalVercelString(input, "cursor") }
          : {}),
      })
    ).data,
  "plaid:get-item": async (client, accessToken) =>
    (await client.itemGet({ access_token: accessToken })).data,
};

function assertPlaidOperationCoverage(): void {
  const expected = new Set(PLAID_SDK_OPERATION_IDS);
  const implemented = Object.keys(PLAID_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Plaid provider SDK operation coverage is incomplete.");
  }
}

/** Plaid Item actions use the official SDK and a Link-owned encrypted token. */
export function createPlaidProviderSdk(
  config: PlaidProviderSdkConfig,
): IntegrationProviderSdk {
  assertPlaidOperationCoverage();
  const clientFactory = config.clientFactory ?? createPlaidSdkClient;
  return {
    integrationId: "plaid",
    operationIds: PLAID_SDK_OPERATION_IDS,
    async execute(rawInput) {
      const invocation = checkedProviderInvocation(rawInput, "plaid");
      const request = PLAID_OPERATION_REQUESTS[invocation.operationId];
      if (!request) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.connectionLinkRuntime.withPlaidCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await request(
            clientFactory({
              clientId: config.clientId,
              secret: config.secret,
              environment: config.environment ?? "production",
            }),
            credential.accessToken,
            invocation.input,
          ),
        }),
      );
    },
  };
}

export function getPlaidProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertPlaidOperationCoverage();
  return {
    operations: PLAID_SDK_OPERATION_IDS.length,
    operationIds: PLAID_SDK_OPERATION_IDS,
  };
}

type MergeSdkClient = {
  accountsList(input: Record<string, unknown>): Promise<unknown>;
  invoicesList(input: Record<string, unknown>): Promise<unknown>;
  transactionsList(input: Record<string, unknown>): Promise<unknown>;
  companyInfoList(input: Record<string, unknown>): Promise<unknown>;
  balanceSheetsList(input: Record<string, unknown>): Promise<unknown>;
  syncStatusResyncCreate(): Promise<unknown>;
};

export interface MergeProviderSdkConfig {
  connectionLinkRuntime: Pick<
    IntegrationConnectionLinkRuntime,
    "withMergeCredential"
  >;
  apiKey: string;
  clientFactory?: (input: {
    apiKey: string;
    accountToken: string;
  }) => MergeSdkClient;
}

function createMergeSdkClient(input: {
  apiKey: string;
  accountToken: string;
}): MergeSdkClient {
  const configuration = new Merge.Configuration({
    apiKey: input.apiKey,
    accessToken: input.accountToken,
  });
  return {
    accountsList: (request) =>
      new Merge.Accounting.AccountsApi(configuration).accountsList(request),
    invoicesList: (request) =>
      new Merge.Accounting.InvoicesApi(configuration).invoicesList(request),
    transactionsList: (request) =>
      new Merge.Accounting.TransactionsApi(configuration).transactionsList(
        request,
      ),
    companyInfoList: (request) =>
      new Merge.Accounting.CompanyInfoApi(configuration).companyInfoList(
        request,
      ),
    balanceSheetsList: (request) =>
      new Merge.Accounting.BalanceSheetsApi(configuration).balanceSheetsList(
        request,
      ),
    syncStatusResyncCreate: () =>
      new Merge.Accounting.ForceResyncApi(
        configuration,
      ).syncStatusResyncCreate(),
  };
}

const MERGE_SDK_OPERATION_IDS = extraOperationIds("merge");

function mergeListRequest(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const query = squareOptionalRecord(input, "query") ?? {};
  const pageSize = optionalVercelNumber(input, "pageSize");
  const cursor = optionalVercelString(input, "cursor");
  return definedVercelFields({
    ...query,
    pageSize,
    cursor,
  });
}

const MERGE_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (
      client: MergeSdkClient,
      input: Readonly<Record<string, unknown>>,
    ) => Promise<unknown>
  >
> = {
  "merge:list-accounts": (client, input) =>
    client.accountsList(mergeListRequest(input)),
  "merge:list-invoices": (client, input) =>
    client.invoicesList(mergeListRequest(input)),
  "merge:list-transactions": (client, input) =>
    client.transactionsList(mergeListRequest(input)),
  "merge:list-company-info": (client, input) =>
    client.companyInfoList(mergeListRequest(input)),
  "merge:list-balance-sheets": (client, input) =>
    client.balanceSheetsList(mergeListRequest(input)),
  "merge:resync": (client) => client.syncStatusResyncCreate(),
};

function assertMergeOperationCoverage(): void {
  const expected = new Set(MERGE_SDK_OPERATION_IDS);
  const implemented = Object.keys(MERGE_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Merge provider SDK operation coverage is incomplete.");
  }
}

/** Merge Accounting actions use Merge's TypeScript SDK and a Link account token. */
export function createMergeProviderSdk(
  config: MergeProviderSdkConfig,
): IntegrationProviderSdk {
  assertMergeOperationCoverage();
  const clientFactory = config.clientFactory ?? createMergeSdkClient;
  return {
    integrationId: "merge",
    operationIds: MERGE_SDK_OPERATION_IDS,
    async execute(rawInput) {
      const invocation = checkedProviderInvocation(rawInput, "merge");
      const request = MERGE_OPERATION_REQUESTS[invocation.operationId];
      if (!request) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.connectionLinkRuntime.withMergeCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await request(
            clientFactory({
              apiKey: config.apiKey,
              accountToken: credential.accountToken,
            }),
            invocation.input,
          ),
        }),
      );
    },
  };
}

export function getMergeProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertMergeOperationCoverage();
  return {
    operations: MERGE_SDK_OPERATION_IDS.length,
    operationIds: MERGE_SDK_OPERATION_IDS,
  };
}
