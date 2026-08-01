import { google } from "googleapis";

import { IntegrationProviderSdkError } from "../../provider-sdk";
import type { IntegrationProviderPack } from "../../provider-pack";
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
} from "../shared";
import {
  createVendorPack,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "./client";

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

// -------------------------------------------------------------- Google Vault

/** A Vault matter, hold, or export ID is a path segment. */
function vaultId(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(value)) throw invocationError();
  return value;
}

const VAULT_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "google-vault:create-matter": {
    path: ["matters", "create"],
    params: (i) => [
      {
        requestBody: definedFields({
          name: requiredInputString(i, "name"),
          description: optionalInputString(i, "description"),
        }),
      },
    ],
    output: googleOutput,
  },
  "google-vault:list-matters": {
    path: ["matters", "list"],
    params: (i) => [
      definedFields({
        pageSize: optionalInputNumber(i, "limit", "pageSize"),
        pageToken: optionalInputString(i, "cursor", "pageToken"),
        state: optionalInputString(i, "state"),
        view: optionalInputString(i, "view"),
      }),
    ],
    output: googleOutput,
  },
  "google-vault:update-matter": {
    path: ["matters", "update"],
    params: (i) => [
      {
        matterId: vaultId(i, "matterId"),
        requestBody: definedFields({
          name: optionalInputString(i, "name"),
          description: optionalInputString(i, "description"),
        }),
      },
    ],
    output: googleOutput,
  },
  "google-vault:close-matter": {
    path: ["matters", "close"],
    params: (i) => [{ matterId: vaultId(i, "matterId") }],
    output: googleOutput,
  },
  "google-vault:reopen-matter": {
    path: ["matters", "reopen"],
    params: (i) => [{ matterId: vaultId(i, "matterId") }],
    output: googleOutput,
  },
  "google-vault:delete-matter": {
    path: ["matters", "delete"],
    params: (i) => [{ matterId: vaultId(i, "matterId") }],
    output: (_v, i) => ({ matterId: vaultId(i, "matterId"), deleted: true }),
  },
  "google-vault:undelete-matter": {
    path: ["matters", "undelete"],
    params: (i) => [{ matterId: vaultId(i, "matterId") }],
    output: googleOutput,
  },
  "google-vault:add-matter-collaborator": {
    path: ["matters", "addPermissions"],
    params: (i) => [
      {
        matterId: vaultId(i, "matterId"),
        requestBody: {
          matterPermission: {
            accountId: requiredInputString(i, "accountId"),
            role: optionalInputString(i, "role") ?? "COLLABORATOR",
          },
          sendEmails: i.sendEmails === true,
        },
      },
    ],
    output: googleOutput,
  },
  "google-vault:remove-matter-collaborator": {
    path: ["matters", "removePermissions"],
    params: (i) => [
      {
        matterId: vaultId(i, "matterId"),
        requestBody: { accountId: requiredInputString(i, "accountId") },
      },
    ],
    output: (_v, i) => ({
      matterId: vaultId(i, "matterId"),
      accountId: requiredInputString(i, "accountId"),
      removed: true,
    }),
  },
  "google-vault:create-hold": {
    path: ["matters", "holds", "create"],
    params: (i) => [
      {
        matterId: vaultId(i, "matterId"),
        requestBody: definedFields({
          name: requiredInputString(i, "name"),
          corpus: requiredInputString(i, "corpus"),
          query: optionalInputRecord(i, "query"),
          accounts: optionalInputStringArray(i, "accountIds")?.map(
            (accountId) => ({ accountId }),
          ),
        }),
      },
    ],
    output: googleOutput,
  },
  "google-vault:list-holds": {
    path: ["matters", "holds", "list"],
    params: (i) => [
      definedFields({
        matterId: vaultId(i, "matterId"),
        pageSize: optionalInputNumber(i, "limit", "pageSize"),
        pageToken: optionalInputString(i, "cursor", "pageToken"),
      }),
    ],
    output: googleOutput,
  },
  "google-vault:update-hold": {
    path: ["matters", "holds", "update"],
    params: (i) => [
      {
        matterId: vaultId(i, "matterId"),
        holdId: vaultId(i, "holdId"),
        requestBody: definedFields({
          name: optionalInputString(i, "name"),
          query: optionalInputRecord(i, "query"),
        }),
      },
    ],
    output: googleOutput,
  },
  "google-vault:delete-hold": {
    path: ["matters", "holds", "delete"],
    params: (i) => [
      { matterId: vaultId(i, "matterId"), holdId: vaultId(i, "holdId") },
    ],
    output: (_v, i) => ({ holdId: vaultId(i, "holdId"), deleted: true }),
  },
  "google-vault:add-held-accounts": {
    path: ["matters", "holds", "addHeldAccounts"],
    params: (i) => [
      {
        matterId: vaultId(i, "matterId"),
        holdId: vaultId(i, "holdId"),
        requestBody: { emails: requiredInputStringArray(i, "emails") },
      },
    ],
    output: googleOutput,
  },
  "google-vault:remove-held-accounts": {
    path: ["matters", "holds", "removeHeldAccounts"],
    params: (i) => [
      {
        matterId: vaultId(i, "matterId"),
        holdId: vaultId(i, "holdId"),
        requestBody: { accountIds: requiredInputStringArray(i, "accountIds") },
      },
    ],
    output: googleOutput,
  },
  "google-vault:create-export": {
    path: ["matters", "exports", "create"],
    params: (i) => [
      {
        matterId: vaultId(i, "matterId"),
        requestBody: definedFields({
          name: requiredInputString(i, "name"),
          query: requiredInputRecord(i, "query"),
          exportOptions: optionalInputRecord(i, "exportOptions"),
        }),
      },
    ],
    output: googleOutput,
  },
  "google-vault:list-exports": {
    path: ["matters", "exports", "list"],
    params: (i) => [
      definedFields({
        matterId: vaultId(i, "matterId"),
        pageSize: optionalInputNumber(i, "limit", "pageSize"),
        pageToken: optionalInputString(i, "cursor", "pageToken"),
      }),
    ],
    output: googleOutput,
  },
  "google-vault:delete-export": {
    path: ["matters", "exports", "delete"],
    params: (i) => [
      { matterId: vaultId(i, "matterId"), exportId: vaultId(i, "exportId") },
    ],
    output: (_v, i) => ({ exportId: vaultId(i, "exportId"), deleted: true }),
  },
  "google-vault:download-export-file": {
    path: ["matters", "exports", "get"],
    params: (i) => [
      { matterId: vaultId(i, "matterId"), exportId: vaultId(i, "exportId") },
    ],
    // Vault does not stream export bytes over this API: it reports the Cloud
    // Storage objects the export was written to, which the caller then reads.
    output: (value) => {
      const record = sdkResponseData(value) as {
        cloudStorageSink?: unknown;
        status?: unknown;
        name?: unknown;
      };
      return {
        name: record?.name,
        status: record?.status,
        cloudStorageSink: record?.cloudStorageSink,
      };
    },
  },
  "google-vault:create-saved-query": {
    path: ["matters", "savedQueries", "create"],
    params: (i) => [
      {
        matterId: vaultId(i, "matterId"),
        requestBody: {
          displayName: requiredInputString(i, "name", "displayName"),
          query: requiredInputRecord(i, "query"),
        },
      },
    ],
    output: googleOutput,
  },
  "google-vault:list-saved-queries": {
    path: ["matters", "savedQueries", "list"],
    params: (i) => [
      definedFields({
        matterId: vaultId(i, "matterId"),
        pageSize: optionalInputNumber(i, "limit", "pageSize"),
        pageToken: optionalInputString(i, "cursor", "pageToken"),
      }),
    ],
    output: googleOutput,
  },
  "google-vault:delete-saved-query": {
    path: ["matters", "savedQueries", "delete"],
    params: (i) => [
      {
        matterId: vaultId(i, "matterId"),
        savedQueryId: vaultId(i, "savedQueryId"),
      },
    ],
    output: (_v, i) => ({
      savedQueryId: vaultId(i, "savedQueryId"),
      deleted: true,
    }),
  },
};

export function createGoogleVaultPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "google-vault",
    driver: "googleapis vault v1",
    transportKind: "oauth2",
    operations: VAULT_OPERATIONS,
    clientFactory: options.clientFactory ?? googleClient("vault", "v1"),
  });
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

// ---------------------------------------------------------- Google Translate

const TRANSLATE_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "google-translate:translate-text": {
    path: ["translations", "translate"],
    params: (i) => [
      {
        requestBody: definedFields({
          q: requiredInputStringArray(i, "text", "q"),
          target: requiredInputString(i, "target", "targetLanguage"),
          source: optionalInputString(i, "source", "sourceLanguage"),
          format: optionalInputString(i, "format") ?? "text",
        }),
      },
    ],
    output: googleOutput,
  },
  "google-translate:detect-language": {
    path: ["detections", "detect"],
    params: (i) => [
      { requestBody: { q: requiredInputStringArray(i, "text", "q") } },
    ],
    output: googleOutput,
  },
};

/**
 * The Translation API authenticates with an API key rather than a user token,
 * so the key is the credential and there is no per-tenant host.
 */
const createGoogleTranslateClient: VendorClientFactory = (credential) => {
  const factory = google.translate as (options: {
    version: string;
    auth: string;
  }) => unknown;
  return factory({
    version: "v2",
    auth: vendorToken(credential),
  }) as SdkMethodTarget;
};

export function createGoogleTranslatePack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "google-translate",
    driver: "googleapis translate v2",
    transportKind: "api_key",
    operations: TRANSLATE_OPERATIONS,
    clientFactory: options.clientFactory ?? createGoogleTranslateClient,
  });
}
