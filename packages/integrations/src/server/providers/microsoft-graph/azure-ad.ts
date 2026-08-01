import type { IntegrationProviderPack } from "../../provider-pack";
import type { IntegrationOAuthRuntime } from "../../runtime";
import type { IntegrationProviderSdk } from "../../provider-sdk";
import {
  definedFields,
  optionalInputBoolean,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
} from "../shared";
import {
  createMicrosoftGraphPack,
  createMicrosoftGraphProviderSdk,
  graphSegment,
  type MicrosoftGraphClientFactory,
  type MicrosoftGraphOperation,
} from "./client";
import { graphCollectionQuery, graphEntityQuery } from "./query";

type GraphInput = Readonly<Record<string, unknown>>;

/** Graph requires the absolute directoryObjects URL for a membership $ref. */
const DIRECTORY_OBJECT_BASE =
  "https://graph.microsoft.com/v1.0/directoryObjects";

function userBody(input: GraphInput, mode: "create" | "update"): unknown {
  const password = optionalInputString(input, "password");
  const body = definedFields({
    accountEnabled: optionalInputBoolean(input, "accountEnabled"),
    displayName: optionalInputString(input, "displayName"),
    mailNickname: optionalInputString(input, "mailNickname"),
    userPrincipalName: optionalInputString(input, "userPrincipalName"),
    givenName: optionalInputString(input, "givenName"),
    surname: optionalInputString(input, "surname"),
    jobTitle: optionalInputString(input, "jobTitle"),
    department: optionalInputString(input, "department"),
    officeLocation: optionalInputString(input, "officeLocation"),
    mobilePhone: optionalInputString(input, "mobilePhone"),
    usageLocation: optionalInputString(input, "usageLocation"),
    ...(password
      ? {
          passwordProfile: {
            password,
            forceChangePasswordNextSignIn:
              optionalInputBoolean(input, "forceChangePasswordNextSignIn") ??
              true,
          },
        }
      : {}),
  });
  if (mode === "create") {
    // Graph rejects a create that omits these, so fail before the round trip.
    return {
      accountEnabled: body.accountEnabled ?? true,
      displayName: requiredInputString(input, "displayName"),
      mailNickname: requiredInputString(input, "mailNickname"),
      userPrincipalName: requiredInputString(input, "userPrincipalName"),
      ...body,
    };
  }
  return body;
}

function groupBody(input: GraphInput, mode: "create" | "update"): unknown {
  const body = definedFields({
    displayName: optionalInputString(input, "displayName"),
    description: optionalInputString(input, "description"),
    mailNickname: optionalInputString(input, "mailNickname"),
    visibility: optionalInputString(input, "visibility"),
    groupTypes: optionalInputStringArray(input, "groupTypes"),
    mailEnabled: optionalInputBoolean(input, "mailEnabled"),
    securityEnabled: optionalInputBoolean(input, "securityEnabled"),
  });
  if (mode === "create") {
    return {
      displayName: requiredInputString(input, "displayName"),
      mailNickname: requiredInputString(input, "mailNickname"),
      mailEnabled: body.mailEnabled ?? false,
      securityEnabled: body.securityEnabled ?? true,
      ...body,
    };
  }
  return body;
}

const AZURE_AD_OPERATIONS: Readonly<Record<string, MicrosoftGraphOperation>> = {
  "azure-ad:list-users": {
    method: "GET",
    path: () => "/users",
    query: graphCollectionQuery,
  },
  "azure-ad:get-user": {
    method: "GET",
    path: (input) => `/users/${graphSegment(input, "userId", "id")}`,
    query: graphEntityQuery,
  },
  "azure-ad:create-user": {
    method: "POST",
    path: () => "/users",
    body: (input) => userBody(input, "create"),
  },
  "azure-ad:update-user": {
    method: "PATCH",
    path: (input) => `/users/${graphSegment(input, "userId", "id")}`,
    body: (input) => userBody(input, "update"),
  },
  "azure-ad:delete-user": {
    method: "DELETE",
    path: (input) => `/users/${graphSegment(input, "userId", "id")}`,
  },
  "azure-ad:list-groups": {
    method: "GET",
    path: () => "/groups",
    query: graphCollectionQuery,
  },
  "azure-ad:get-group": {
    method: "GET",
    path: (input) => `/groups/${graphSegment(input, "groupId", "id")}`,
    query: graphEntityQuery,
  },
  "azure-ad:create-group": {
    method: "POST",
    path: () => "/groups",
    body: (input) => groupBody(input, "create"),
  },
  "azure-ad:update-group": {
    method: "PATCH",
    path: (input) => `/groups/${graphSegment(input, "groupId", "id")}`,
    body: (input) => groupBody(input, "update"),
  },
  "azure-ad:delete-group": {
    method: "DELETE",
    path: (input) => `/groups/${graphSegment(input, "groupId", "id")}`,
  },
  "azure-ad:list-group-members": {
    method: "GET",
    path: (input) => `/groups/${graphSegment(input, "groupId", "id")}/members`,
    query: graphCollectionQuery,
  },
  "azure-ad:add-group-member": {
    method: "POST",
    path: (input) =>
      `/groups/${graphSegment(input, "groupId", "id")}/members/$ref`,
    body: (input) => ({
      "@odata.id": `${DIRECTORY_OBJECT_BASE}/${graphSegment(input, "memberId", "userId")}`,
    }),
    // A $ref write returns 204 with no body.
    output: (_value, input) => ({
      groupId: requiredInputString(input, "groupId", "id"),
      memberId: requiredInputString(input, "memberId", "userId"),
      added: true,
    }),
  },
  "azure-ad:remove-group-member": {
    method: "DELETE",
    path: (input) =>
      `/groups/${graphSegment(input, "groupId", "id")}/members/${graphSegment(input, "memberId", "userId")}/$ref`,
    output: (_value, input) => ({
      groupId: requiredInputString(input, "groupId", "id"),
      memberId: requiredInputString(input, "memberId", "userId"),
      removed: true,
    }),
  },
};

export interface AzureAdProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: MicrosoftGraphClientFactory;
}

/** Executes the pinned Azure AD directory actions through Microsoft Graph. */
export function createAzureAdProviderSdk(
  config: AzureAdProviderSdkConfig,
): IntegrationProviderSdk {
  return createMicrosoftGraphProviderSdk({
    integrationId: "azure-ad",
    operations: AZURE_AD_OPERATIONS,
    oauthRuntime: config.oauthRuntime,
    ...(config.clientFactory ? { clientFactory: config.clientFactory } : {}),
  });
}

export function createAzureAdPack(): IntegrationProviderPack {
  return createMicrosoftGraphPack({
    integrationId: "azure-ad",
    operations: AZURE_AD_OPERATIONS,
    triggerCoverage: [],
  });
}

export function getAzureAdProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  const operationIds = Object.keys(AZURE_AD_OPERATIONS);
  return { operations: operationIds.length, operationIds };
}
