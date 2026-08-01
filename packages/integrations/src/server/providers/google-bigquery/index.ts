import { google } from "googleapis";

import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputRecord,
  requiredInputString,
  requiredInputStringArray,
  sdkResponseData,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/** googleapis wraps every response in a `data` envelope. */
const googleOutput = (value: unknown): unknown => sdkResponseData(value);

function googleClient(
  service: "vault" | "bigquery" | "translate",
  version: string,
): VendorClientFactory {
  return (credential) => {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: vendorToken(credential) });
    const factory = google[service] as (options: {
      version: string;
      auth: unknown;
    }) => unknown;
    return factory({ version, auth }) as SdkMethodTarget;
  };
}

// ----------------------------------------------------------- Google BigQuery

/** A BigQuery dataset or table ID is a path segment. */
function bigQueryId(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (!/^[A-Za-z0-9_]{1,1024}$/u.test(value)) throw invocationError();
  return value;
}

/** The project a request runs against comes from the connection, not input. */
function bigQueryProject(input: VendorInput): string {
  const value = requiredInputString(input, "projectId", "project");
  if (!/^[a-z][a-z0-9-]{4,29}$/u.test(value)) throw invocationError();
  return value;
}

const BIGQUERY_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "google-bigquery:run-query": {
    path: ["jobs", "query"],
    params: (i) => [
      {
        projectId: bigQueryProject(i),
        requestBody: definedFields({
          query: requiredInputString(i, "query", "sql"),
          useLegacySql: false,
          maxResults: optionalInputNumber(i, "limit", "maxResults"),
          // Named parameters are how a caller passes values safely.
          queryParameters: i.parameters ?? i.queryParameters,
          parameterMode: i.parameters ? "NAMED" : undefined,
          dryRun: i.dryRun === true ? true : undefined,
        }),
      },
    ],
    output: googleOutput,
  },
  "google-bigquery:get-query-results": {
    path: ["jobs", "getQueryResults"],
    params: (i) => [
      definedFields({
        projectId: bigQueryProject(i),
        jobId: requiredInputString(i, "jobId"),
        pageToken: optionalInputString(i, "cursor", "pageToken"),
        maxResults: optionalInputNumber(i, "limit", "maxResults"),
      }),
    ],
    output: googleOutput,
  },
  "google-bigquery:list-datasets": {
    path: ["datasets", "list"],
    params: (i) => [
      definedFields({
        projectId: bigQueryProject(i),
        maxResults: optionalInputNumber(i, "limit", "maxResults"),
        pageToken: optionalInputString(i, "cursor", "pageToken"),
      }),
    ],
    output: googleOutput,
  },
  "google-bigquery:create-dataset": {
    path: ["datasets", "insert"],
    params: (i) => [
      {
        projectId: bigQueryProject(i),
        requestBody: definedFields({
          datasetReference: {
            projectId: bigQueryProject(i),
            datasetId: bigQueryId(i, "datasetId"),
          },
          location: optionalInputString(i, "location"),
          description: optionalInputString(i, "description"),
        }),
      },
    ],
    output: googleOutput,
  },
  "google-bigquery:delete-dataset": {
    path: ["datasets", "delete"],
    params: (i) => [
      {
        projectId: bigQueryProject(i),
        datasetId: bigQueryId(i, "datasetId"),
        deleteContents: i.deleteContents === true,
      },
    ],
    output: (_v, i) => ({
      datasetId: bigQueryId(i, "datasetId"),
      deleted: true,
    }),
  },
  "google-bigquery:list-tables": {
    path: ["tables", "list"],
    params: (i) => [
      definedFields({
        projectId: bigQueryProject(i),
        datasetId: bigQueryId(i, "datasetId"),
        maxResults: optionalInputNumber(i, "limit", "maxResults"),
        pageToken: optionalInputString(i, "cursor", "pageToken"),
      }),
    ],
    output: googleOutput,
  },
  "google-bigquery:get-table": {
    path: ["tables", "get"],
    params: (i) => [
      {
        projectId: bigQueryProject(i),
        datasetId: bigQueryId(i, "datasetId"),
        tableId: bigQueryId(i, "tableId"),
      },
    ],
    output: googleOutput,
  },
  "google-bigquery:create-table": {
    path: ["tables", "insert"],
    params: (i) => [
      {
        projectId: bigQueryProject(i),
        datasetId: bigQueryId(i, "datasetId"),
        requestBody: definedFields({
          tableReference: {
            projectId: bigQueryProject(i),
            datasetId: bigQueryId(i, "datasetId"),
            tableId: bigQueryId(i, "tableId"),
          },
          schema: optionalInputRecord(i, "schema"),
          description: optionalInputString(i, "description"),
        }),
      },
    ],
    output: googleOutput,
  },
  "google-bigquery:delete-table": {
    path: ["tables", "delete"],
    params: (i) => [
      {
        projectId: bigQueryProject(i),
        datasetId: bigQueryId(i, "datasetId"),
        tableId: bigQueryId(i, "tableId"),
      },
    ],
    output: (_v, i) => ({ tableId: bigQueryId(i, "tableId"), deleted: true }),
  },
  "google-bigquery:list-table-data": {
    path: ["tabledata", "list"],
    params: (i) => [
      definedFields({
        projectId: bigQueryProject(i),
        datasetId: bigQueryId(i, "datasetId"),
        tableId: bigQueryId(i, "tableId"),
        maxResults: optionalInputNumber(i, "limit", "maxResults"),
        pageToken: optionalInputString(i, "cursor", "pageToken"),
      }),
    ],
    output: googleOutput,
  },
  "google-bigquery:insert-rows": {
    path: ["tabledata", "insertAll"],
    params: (i) => [
      {
        projectId: bigQueryProject(i),
        datasetId: bigQueryId(i, "datasetId"),
        tableId: bigQueryId(i, "tableId"),
        requestBody: {
          rows: (Array.isArray(i.rows) ? i.rows : []).map((json) => ({ json })),
          skipInvalidRows: i.skipInvalidRows === true,
        },
      },
    ],
    output: googleOutput,
  },
};

export function createGoogleBigQueryPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "google-bigquery",
    driver: "googleapis bigquery v2",
    transportKind: "oauth2",
    operations: BIGQUERY_OPERATIONS,
    clientFactory: options.clientFactory ?? googleClient("bigquery", "v2"),
  });
}
