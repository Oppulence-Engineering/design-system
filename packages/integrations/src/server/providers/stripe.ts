import Stripe from "stripe";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationApiKeyRuntime } from "../api-key-runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type {
  IntegrationProviderSdk,
  ProviderSdkInvocation,
} from "../provider-sdk";
import {
  ProviderSdkInvocationSchema,
  asInputRecord,
  requireStringValue,
} from "./shared";

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

function withId(input: Readonly<Record<string, unknown>>): {
  id: string;
  rest: Record<string, unknown>;
} {
  const rest = asInputRecord(input);
  const id = requireStringValue(
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
