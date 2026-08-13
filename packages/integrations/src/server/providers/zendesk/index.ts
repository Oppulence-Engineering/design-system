import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import { requireOptionalSdk } from "../shared/optional-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  requiredInputNumber,
  requiredInputRecord,
  requiredInputString,
  requiredInputStringArray,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  requiredVendorField,
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

// ------------------------------------------------------------------ Zendesk

/** Zendesk object IDs are numeric. */
function zendeskId(input: VendorInput, ...names: string[]): number {
  const value = requiredInputNumber(input, names[0]);
  if (!Number.isSafeInteger(value) || value < 1) throw invocationError();
  return value;
}

function zendeskIds(input: VendorInput, ...names: string[]): number[] {
  const values = requiredInputStringArray(input, ...names).map(Number);
  if (values.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw invocationError();
  }
  if (values.length === 0 || values.length > 100) throw invocationError();
  return values;
}

const ZENDESK_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "zendesk:get-tickets": { path: ["tickets", "list"] },
  "zendesk:get-ticket": {
    path: ["tickets", "show"],
    params: (i) => [zendeskId(i, "ticketId")],
  },
  "zendesk:create-ticket": {
    path: ["tickets", "create"],
    params: (i) => [{ ticket: requiredInputRecord(i, "ticket", "fields") }],
  },
  "zendesk:create-tickets-bulk": {
    path: ["tickets", "createMany"],
    params: (i) => [{ tickets: i.tickets ?? [] }],
  },
  "zendesk:update-ticket": {
    path: ["tickets", "update"],
    params: (i) => [
      zendeskId(i, "ticketId"),
      { ticket: requiredInputRecord(i, "ticket", "fields") },
    ],
  },
  "zendesk:update-tickets-bulk": {
    path: ["tickets", "updateMany"],
    params: (i) => [zendeskIds(i, "ticketIds"), { tickets: i.tickets ?? [] }],
  },
  "zendesk:delete-ticket": {
    path: ["tickets", "delete"],
    params: (i) => [zendeskId(i, "ticketId")],
    output: (_v, i) => ({ ticketId: zendeskId(i, "ticketId"), deleted: true }),
  },
  "zendesk:merge-tickets": {
    path: ["tickets", "merge"],
    params: (i) => [
      zendeskId(i, "ticketId"),
      definedFields({
        ids: zendeskIds(i, "sourceTicketIds", "ids"),
        target_comment: optionalInputString(i, "targetComment"),
        source_comment: optionalInputString(i, "sourceComment"),
      }),
    ],
  },
  "zendesk:get-users": { path: ["users", "list"] },
  "zendesk:get-user": {
    path: ["users", "show"],
    params: (i) => [zendeskId(i, "userId")],
  },
  "zendesk:get-current-user": { path: ["users", "me"] },
  "zendesk:search-users": {
    path: ["users", "search"],
    params: (i) => [{ query: requiredInputString(i, "query", "search") }],
  },
  "zendesk:create-user": {
    path: ["users", "create"],
    params: (i) => [{ user: requiredInputRecord(i, "user", "fields") }],
  },
  "zendesk:create-users-bulk": {
    path: ["users", "createMany"],
    params: (i) => [{ users: i.users ?? [] }],
  },
  "zendesk:update-user": {
    path: ["users", "update"],
    params: (i) => [
      zendeskId(i, "userId"),
      { user: requiredInputRecord(i, "user", "fields") },
    ],
  },
  "zendesk:update-users-bulk": {
    path: ["users", "updateMany"],
    params: (i) => [zendeskIds(i, "userIds"), { users: i.users ?? [] }],
  },
  "zendesk:delete-user": {
    path: ["users", "delete"],
    params: (i) => [zendeskId(i, "userId")],
    output: (_v, i) => ({ userId: zendeskId(i, "userId"), deleted: true }),
  },
  "zendesk:get-organizations": { path: ["organizations", "list"] },
  "zendesk:get-organization": {
    path: ["organizations", "show"],
    params: (i) => [zendeskId(i, "organizationId")],
  },
  "zendesk:autocomplete-organizations": {
    path: ["organizations", "autocomplete"],
    params: (i) => [{ name: requiredInputString(i, "name", "query") }],
  },
  "zendesk:create-organization": {
    path: ["organizations", "create"],
    params: (i) => [
      { organization: requiredInputRecord(i, "organization", "fields") },
    ],
  },
  "zendesk:create-organizations-bulk": {
    path: ["organizations", "createMany"],
    params: (i) => [{ organizations: i.organizations ?? [] }],
  },
  "zendesk:update-organization": {
    path: ["organizations", "update"],
    params: (i) => [
      zendeskId(i, "organizationId"),
      { organization: requiredInputRecord(i, "organization", "fields") },
    ],
  },
  "zendesk:delete-organization": {
    path: ["organizations", "delete"],
    params: (i) => [zendeskId(i, "organizationId")],
    output: (_v, i) => ({
      organizationId: zendeskId(i, "organizationId"),
      deleted: true,
    }),
  },
  "zendesk:search": {
    path: ["search", "query"],
    params: (i) => [requiredInputString(i, "query", "search")],
  },
  "zendesk:search-count": {
    path: ["search", "showResultsCount"],
    params: (i) => [requiredInputString(i, "query", "search")],
  },
};

/**
 * Zendesk is per-subdomain, so the account host comes from the connection.
 * node-zendesk authenticates with an email plus an API token.
 */
export const createZendeskClient: VendorClientFactory = (credential) => {
  const { createClient } = requireOptionalSdk("node-zendesk") as {
    createClient(config: Record<string, unknown>): SdkMethodTarget;
  };
  return createClient({
    subdomain: requiredVendorField(credential, "subdomain"),
    username: requiredVendorField(credential, "email"),
    token: vendorToken(credential),
  });
};

export function createZendeskPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "zendesk",
    driver: "node-zendesk@6.0.1",
    transportKind: "api_key",
    operations: ZENDESK_OPERATIONS,
    clientFactory: options.clientFactory ?? createZendeskClient,
  });
}
