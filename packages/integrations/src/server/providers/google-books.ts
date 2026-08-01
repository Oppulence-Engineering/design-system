import { google } from "googleapis";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationApiKeyRuntime } from "../api-key-runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
  sdkResponseData,
} from "./shared";

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
  return { path, arguments: [definedFields(request)] };
}

const GOOGLE_BOOKS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleBooksSdkRequest
  >
> = {
  "google-books:search-volumes": (input) =>
    googleBooksRequest(["books", "volumes", "list"], {
      q: requiredInputString(input, "query"),
      filter: optionalInputString(input, "filter"),
      printType: optionalInputString(input, "printType"),
      orderBy: optionalInputString(input, "orderBy"),
      startIndex: optionalInputNumber(input, "startIndex"),
      maxResults: optionalInputNumber(input, "maxResults"),
      langRestrict: optionalInputString(input, "langRestrict"),
    }),
  "google-books:get-volume-details": (input) =>
    googleBooksRequest(["books", "volumes", "get"], {
      volumeId: requiredInputString(input, "volumeId"),
      projection: optionalInputString(input, "projection"),
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
          output: sdkResponseData(
            await invokeSdkMethod(
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
