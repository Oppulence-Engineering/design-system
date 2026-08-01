import * as Merge from "@mergeapi/merge-sdk-typescript";
import type { IntegrationConnectionLinkRuntime } from "../connection-link";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import {
  catalogueOperationIds,
  checkedProviderInvocation,
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
} from "./shared";

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

const MERGE_SDK_OPERATION_IDS = catalogueOperationIds("merge");

function mergeListRequest(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const query = optionalInputRecord(input, "query") ?? {};
  const pageSize = optionalInputNumber(input, "pageSize");
  const cursor = optionalInputString(input, "cursor");
  return definedFields({
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
