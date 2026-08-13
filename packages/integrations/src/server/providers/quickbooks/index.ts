import type { IntegrationCredentialReference } from "../../transport/credentials";
import { requireOptionalSdk } from "../shared/optional-sdk";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import {
  catalogueOperationIds,
  checkedProviderInvocation,
  optionalInputRecord,
  requiredInputRecord,
} from "../shared/sdk";


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
  const QuickBooks = requireOptionalSdk("node-quickbooks") as new (
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

const QUICKBOOKS_SDK_OPERATION_IDS = catalogueOperationIds("quickbooks");

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
  return optionalInputRecord(input, "query", "criteria") ?? {};
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
    args: [requiredInputRecord(input, "invoice", "body")],
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
