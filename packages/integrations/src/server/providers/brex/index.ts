import { Brex } from "brex";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationApiKeyRuntime } from "../../runtime/api-key";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type {
  IntegrationProviderSdk,
  ProviderSdkInvocation,
} from "../../core/provider-sdk";
import {
  checkedProviderInvocation,
  invokeSdkMethod,
  normalizeSdkOutput,
  optionalInputRecord,
  optionalInputString,
  requiredInputRecord,
  requiredInputString,
} from "../shared/sdk";
import type { SdkMethodRequest } from "../shared/sdk";

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
): SdkMethodRequest {
  return { path, arguments: [optionalInputRecord(input, "query")] };
}

function brexGet(
  path: readonly string[],
  input: Readonly<Record<string, unknown>>,
  ...identifierNames: readonly string[]
): SdkMethodRequest {
  return {
    path,
    arguments: [requiredInputString(input, ...identifierNames)],
  };
}

function brexWrite(
  path: readonly string[],
  input: Readonly<Record<string, unknown>>,
  invocation: ProviderSdkInvocation,
  identifierNames?: readonly string[],
): SdkMethodRequest {
  const options = brexOptions(invocation);
  const body = requiredInputRecord(input, "body");
  return {
    path,
    arguments: identifierNames
      ? [requiredInputString(input, ...identifierNames), body, options]
      : [body, options],
  };
}

const BREX_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (
      input: Readonly<Record<string, unknown>>,
      invocation: ProviderSdkInvocation,
    ) => SdkMethodRequest
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
      requiredInputString(input, "expenseId", "id"),
      requiredInputRecord(input, "body"),
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
      requiredInputString(input, "cashAccountId", "accountId"),
      optionalInputRecord(input, "query"),
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
    const id = optionalInputString(input, "cashAccountId", "accountId");
    return id
      ? { path: ["accounts", "get"], arguments: [id] }
      : { path: ["accounts", "getPrimary"], arguments: [] };
  },
  "brex:list-card-statements": (input) =>
    brexList(["accounts", "listPrimaryCardStatements"], input),
  "brex:list-cash-statements": (input) => ({
    path: ["accounts", "listCashStatements"],
    arguments: [
      requiredInputString(input, "cashAccountId", "accountId"),
      optionalInputRecord(input, "query"),
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
      requiredInputString(input, "budgetId", "id"),
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
          output: normalizeSdkOutput(
            await invokeSdkMethod(
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
