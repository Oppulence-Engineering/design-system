import { SquareClient } from "square";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationApiKeyRuntime } from "../api-key-runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  normalizeSdkOutput,
  optionalInputBoolean,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputNumber,
  requiredInputString,
  requiredInputStringArray,
  requiredInputValue,
} from "./shared";
import type { SdkMethodRequest } from "./shared";

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

function squareRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): SdkMethodRequest {
  return { path, arguments: [request] };
}

function requiredSquareMoney(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const amount = optionalInputNumber(input, "amount");
  const currency = requiredInputString(input, "currency");
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
  return optionalInputString(input, "idempotencyKey") ?? crypto.randomUUID();
}

const SQUARE_OPERATION_REQUESTS: Readonly<
  Record<string, (input: Readonly<Record<string, unknown>>) => SdkMethodRequest>
> = {
  "square:create-payment": (input) =>
    squareRequest(["payments", "create"], {
      sourceId: requiredInputString(input, "sourceId"),
      idempotencyKey: squareIdempotencyKey(input),
      amountMoney: requiredSquareMoney(input),
      customerId: optionalInputString(input, "customerId"),
      locationId: optionalInputString(input, "locationId"),
      orderId: optionalInputString(input, "orderId"),
      referenceId: optionalInputString(input, "referenceId"),
      note: optionalInputString(input, "note"),
      autocomplete: optionalInputBoolean(input, "autocomplete"),
    }),
  "square:get-payment": (input) =>
    squareRequest(["payments", "get"], {
      paymentId: requiredInputString(input, "paymentId"),
    }),
  "square:list-payments": (input) =>
    squareRequest(
      ["payments", "list"],
      definedFields({
        locationId: optionalInputString(input, "locationId"),
        beginTime: optionalInputString(input, "beginTime"),
        endTime: optionalInputString(input, "endTime"),
        limit: optionalInputNumber(input, "limit"),
        cursor: optionalInputString(input, "cursor"),
      }),
    ),
  "square:cancel-payment": (input) =>
    squareRequest(["payments", "cancel"], {
      paymentId: requiredInputString(input, "paymentId"),
    }),
  "square:complete-payment": (input) =>
    squareRequest(
      ["payments", "complete"],
      definedFields({
        paymentId: requiredInputString(input, "paymentId"),
        versionToken: optionalInputString(input, "versionToken"),
      }),
    ),
  "square:refund-payment": (input) =>
    squareRequest(
      ["refunds", "refundPayment"],
      definedFields({
        idempotencyKey: squareIdempotencyKey(input),
        paymentId: requiredInputString(input, "paymentId"),
        amountMoney: requiredSquareMoney(input),
        reason: optionalInputString(input, "reason"),
      }),
    ),
  "square:get-refund": (input) =>
    squareRequest(["refunds", "get"], {
      refundId: requiredInputString(input, "refundId"),
    }),
  "square:list-refunds": (input) =>
    squareRequest(
      ["refunds", "list"],
      definedFields({
        locationId: optionalInputString(input, "locationId"),
        status: optionalInputString(input, "status"),
        beginTime: optionalInputString(input, "beginTime"),
        endTime: optionalInputString(input, "endTime"),
        limit: optionalInputNumber(input, "limit"),
        cursor: optionalInputString(input, "cursor"),
      }),
    ),
  "square:create-customer": (input) =>
    squareRequest(
      ["customers", "create"],
      definedFields({
        idempotencyKey: squareIdempotencyKey(input),
        givenName: optionalInputString(input, "givenName"),
        familyName: optionalInputString(input, "familyName"),
        companyName: optionalInputString(input, "companyName"),
        nickname: optionalInputString(input, "nickname"),
        emailAddress: optionalInputString(input, "emailAddress"),
        phoneNumber: optionalInputString(input, "phoneNumber"),
        birthday: optionalInputString(input, "birthday"),
        note: optionalInputString(input, "note"),
        referenceId: optionalInputString(input, "referenceId"),
        address: optionalInputRecord(input, "address"),
      }),
    ),
  "square:get-customer": (input) =>
    squareRequest(["customers", "get"], {
      customerId: requiredInputString(input, "customerId"),
    }),
  "square:list-customers": (input) =>
    squareRequest(
      ["customers", "list"],
      definedFields({
        limit: optionalInputNumber(input, "limit"),
        cursor: optionalInputString(input, "cursor"),
        sortField: optionalInputString(input, "sortField"),
        sortOrder: optionalInputString(input, "sortOrder"),
      }),
    ),
  "square:search-customers": (input) =>
    squareRequest(
      ["customers", "search"],
      definedFields({
        query: optionalInputRecord(input, "query"),
        limit: optionalInputNumber(input, "limit"),
        cursor: optionalInputString(input, "cursor"),
      }),
    ),
  "square:update-customer": (input) =>
    squareRequest(
      ["customers", "update"],
      definedFields({
        customerId: requiredInputString(input, "customerId"),
        givenName: optionalInputString(input, "givenName"),
        familyName: optionalInputString(input, "familyName"),
        companyName: optionalInputString(input, "companyName"),
        nickname: optionalInputString(input, "nickname"),
        emailAddress: optionalInputString(input, "emailAddress"),
        phoneNumber: optionalInputString(input, "phoneNumber"),
        birthday: optionalInputString(input, "birthday"),
        note: optionalInputString(input, "note"),
        referenceId: optionalInputString(input, "referenceId"),
        address: optionalInputRecord(input, "address"),
      }),
    ),
  "square:delete-customer": (input) =>
    squareRequest(["customers", "delete"], {
      customerId: requiredInputString(input, "customerId"),
    }),
  "square:list-locations": () => squareRequest(["locations", "list"]),
  "square:get-location": (input) =>
    squareRequest(["locations", "get"], {
      locationId: requiredInputString(input, "locationId"),
    }),
  "square:create-order": (input) =>
    squareRequest(["orders", "create"], {
      order:
        optionalInputRecord(input, "order") ??
        (requiredInputValue(input, "order") as Record<string, unknown>),
      idempotencyKey: squareIdempotencyKey(input),
    }),
  "square:get-order": (input) =>
    squareRequest(["orders", "get"], {
      orderId: requiredInputString(input, "orderId"),
    }),
  "square:search-orders": (input) =>
    squareRequest(
      ["orders", "search"],
      definedFields({
        locationIds: optionalInputStringArray(input, "locationIds"),
        query: optionalInputRecord(input, "query"),
        limit: optionalInputNumber(input, "limit"),
        cursor: optionalInputString(input, "cursor"),
      }),
    ),
  "square:pay-order": (input) =>
    squareRequest(
      ["orders", "pay"],
      definedFields({
        orderId: requiredInputString(input, "orderId"),
        orderVersion: optionalInputNumber(input, "orderVersion"),
        paymentIds: requiredInputStringArray(input, "paymentIds"),
        idempotencyKey: squareIdempotencyKey(input),
      }),
    ),
  "square:create-invoice": (input) =>
    squareRequest(["invoices", "create"], {
      invoice:
        optionalInputRecord(input, "invoice") ??
        (requiredInputValue(input, "invoice") as Record<string, unknown>),
      idempotencyKey: squareIdempotencyKey(input),
    }),
  "square:get-invoice": (input) =>
    squareRequest(["invoices", "get"], {
      invoiceId: requiredInputString(input, "invoiceId"),
    }),
  "square:list-invoices": (input) =>
    squareRequest(
      ["invoices", "list"],
      definedFields({
        locationId: requiredInputString(input, "locationId"),
        limit: optionalInputNumber(input, "limit"),
        cursor: optionalInputString(input, "cursor"),
      }),
    ),
  "square:search-invoices": (input) =>
    squareRequest(
      ["invoices", "search"],
      definedFields({
        query: optionalInputRecord(input, "query") ?? {
          filter: {
            locationIds: [requiredInputString(input, "locationId")],
          },
        },
        limit: optionalInputNumber(input, "limit"),
        cursor: optionalInputString(input, "cursor"),
      }),
    ),
  "square:publish-invoice": (input) =>
    squareRequest(
      ["invoices", "publish"],
      definedFields({
        invoiceId: requiredInputString(input, "invoiceId"),
        version: requiredInputNumber(input, "version"),
        idempotencyKey: squareIdempotencyKey(input),
      }),
    ),
  "square:cancel-invoice": (input) =>
    squareRequest(["invoices", "cancel"], {
      invoiceId: requiredInputString(input, "invoiceId"),
      version: requiredInputNumber(input, "version"),
    }),
  "square:delete-invoice": (input) =>
    squareRequest(
      ["invoices", "delete"],
      definedFields({
        invoiceId: requiredInputString(input, "invoiceId"),
        version: requiredInputNumber(input, "version"),
      }),
    ),
  "square:upsert-catalog-object": (input) =>
    squareRequest(["catalog", "object", "upsert"], {
      object:
        optionalInputRecord(input, "object") ??
        (requiredInputValue(input, "object") as Record<string, unknown>),
      idempotencyKey: squareIdempotencyKey(input),
    }),
  "square:get-catalog-object": (input) =>
    squareRequest(
      ["catalog", "object", "get"],
      definedFields({
        objectId: requiredInputString(input, "objectId"),
        includeRelatedObjects: optionalInputBoolean(
          input,
          "includeRelatedObjects",
        ),
      }),
    ),
  "square:list-catalog": (input) =>
    squareRequest(
      ["catalog", "list"],
      definedFields({
        types: optionalInputString(input, "types"),
        cursor: optionalInputString(input, "cursor"),
      }),
    ),
  "square:search-catalog-objects": (input) =>
    squareRequest(
      ["catalog", "search"],
      definedFields({
        objectTypes: optionalInputStringArray(input, "objectTypes"),
        query: optionalInputRecord(input, "query"),
        limit: optionalInputNumber(input, "limit"),
        cursor: optionalInputString(input, "cursor"),
      }),
    ),
  "square:create-catalog-image": (input) =>
    squareRequest(["catalog", "images", "create"], {
      request: definedFields({
        idempotencyKey: squareIdempotencyKey(input),
        objectId: optionalInputString(input, "objectId"),
        caption: optionalInputString(input, "caption"),
      }),
      imageFile: requiredInputValue(input, "file"),
    }),
  "square:delete-catalog-object": (input) =>
    squareRequest(["catalog", "object", "delete"], {
      objectId: requiredInputString(input, "objectId"),
    }),
  "square:batch-retrieve-inventory-counts": (input) =>
    squareRequest(
      ["inventory", "batchGetCounts"],
      definedFields({
        catalogObjectIds: optionalInputStringArray(input, "catalogObjectIds"),
        locationIds: optionalInputStringArray(input, "locationIds"),
        states: optionalInputStringArray(input, "states"),
        updatedAfter: optionalInputString(input, "updatedAfter"),
        limit: optionalInputNumber(input, "limit"),
        cursor: optionalInputString(input, "cursor"),
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
          output: normalizeSdkOutput(
            await invokeSdkMethod(clientFactory(credential.apiKey), request),
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
