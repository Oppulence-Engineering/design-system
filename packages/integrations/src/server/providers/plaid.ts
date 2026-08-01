import {
  Configuration as PlaidConfiguration,
  PlaidApi,
  PlaidEnvironments,
} from "plaid";
import type { IntegrationConnectionLinkRuntime } from "../connection-link";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import {
  catalogueOperationIds,
  checkedProviderInvocation,
  optionalInputString,
} from "./shared";

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

const PLAID_SDK_OPERATION_IDS = catalogueOperationIds("plaid");

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
        ...(optionalInputString(input, "cursor")
          ? { cursor: optionalInputString(input, "cursor") }
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
