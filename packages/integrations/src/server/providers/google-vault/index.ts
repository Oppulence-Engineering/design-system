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
