import { XeroClient } from "xero-node";
import type { IntegrationCredentialReference } from "../credentials";
import type { IntegrationOAuthRuntime } from "../runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type {
  IntegrationProviderSdk,
  ProviderSdkInvocation,
} from "../provider-sdk";
import {
  catalogueOperationIds,
  checkedProviderInvocation,
  optionalInputBoolean,
  optionalInputNumber,
  optionalInputString,
  requiredInputRecord,
} from "./shared";

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

const XERO_SDK_OPERATION_IDS = catalogueOperationIds("xero");

function xeroDate(
  input: Readonly<Record<string, unknown>>,
  name: string,
): Date | undefined {
  const value = optionalInputString(input, name);
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
      optionalInputString(input, "where"),
      optionalInputString(input, "order"),
    ],
  }),
  "xero:list-contacts": (tenantId, input) => ({
    method: "getContacts",
    args: [
      tenantId,
      xeroDate(input, "ifModifiedSince"),
      optionalInputString(input, "where"),
      optionalInputString(input, "order"),
      undefined,
      optionalInputNumber(input, "page"),
      optionalInputBoolean(input, "includeArchived"),
      optionalInputBoolean(input, "summaryOnly"),
      optionalInputString(input, "searchTerm"),
      optionalInputNumber(input, "pageSize"),
    ],
  }),
  "xero:list-invoices": (tenantId, input) => ({
    method: "getInvoices",
    args: [
      tenantId,
      xeroDate(input, "ifModifiedSince"),
      optionalInputString(input, "where"),
      optionalInputString(input, "order"),
      undefined,
      undefined,
      undefined,
      undefined,
      optionalInputNumber(input, "page"),
      optionalInputBoolean(input, "includeArchived"),
      optionalInputBoolean(input, "createdByMyApp"),
      optionalInputNumber(input, "unitdp"),
      optionalInputBoolean(input, "summaryOnly"),
      optionalInputNumber(input, "pageSize"),
      optionalInputString(input, "searchTerm"),
    ],
  }),
  "xero:list-bank-transactions": (tenantId, input) => ({
    method: "getBankTransactions",
    args: [
      tenantId,
      xeroDate(input, "ifModifiedSince"),
      optionalInputString(input, "where"),
      optionalInputString(input, "order"),
      optionalInputNumber(input, "page"),
      optionalInputNumber(input, "unitdp"),
      optionalInputNumber(input, "pageSize"),
    ],
  }),
  "xero:create-invoices": (tenantId, input, invocation) => ({
    method: "createInvoices",
    args: [
      tenantId,
      requiredInputRecord(input, "invoices", "body"),
      optionalInputBoolean(input, "summarizeErrors"),
      optionalInputNumber(input, "unitdp"),
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
