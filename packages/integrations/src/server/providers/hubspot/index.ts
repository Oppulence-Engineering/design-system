import { Client as HubSpotClient } from "@hubspot/api-client";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import {
  ProviderSdkInvocationSchema,
  optionalStringValue,
  requireStringValue,
} from "../shared/sdk";

interface HubSpotApiRequest {
  method: string;
  path: string;
  body?: unknown;
  qs?: Record<string, string>;
}

interface HubSpotApiResponse {
  ok: boolean;
  json(): Promise<unknown>;
}

interface HubSpotApiClient {
  setAccessToken(accessToken: string): void;
  apiRequest(request: HubSpotApiRequest): Promise<HubSpotApiResponse>;
}

type HubSpotClientFactory = () => HubSpotApiClient;

export interface HubSpotProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: HubSpotClientFactory;
}

function createHubSpotClient(): HubSpotApiClient {
  return new HubSpotClient() as unknown as HubSpotApiClient;
}

const HUBSPOT_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "hubspot",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

function hubSpotPathSegment(value: unknown): string {
  return encodeURIComponent(
    requireStringValue(value, "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID"),
  );
}

function hubSpotInputString(
  input: Readonly<Record<string, unknown>>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = optionalStringValue(input[key]);
    if (value) {
      return value;
    }
  }
  throw new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

function parseHubSpotJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
}

function hubSpotQuery(
  input: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): Record<string, string> | undefined {
  const query = Object.fromEntries(
    keys.flatMap((key) => {
      const value = input[key];
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return [[key, String(value)]];
      }
      if (
        Array.isArray(value) &&
        value.every((entry) => typeof entry === "string")
      ) {
        return [[key, value.join(",")]];
      }
      return [];
    }),
  );
  return Object.keys(query).length ? query : undefined;
}

function hubSpotObjectReadRequest(
  objectType: string,
  idKey: string,
  input: Readonly<Record<string, unknown>>,
): HubSpotApiRequest {
  const id = optionalStringValue(input[idKey]) ?? optionalStringValue(input.id);
  const query = hubSpotQuery(input, [
    "limit",
    "after",
    "properties",
    "associations",
    "archived",
    "idProperty",
  ]);
  return {
    method: "GET",
    path: id
      ? `/crm/v3/objects/${objectType}/${hubSpotPathSegment(id)}`
      : `/crm/v3/objects/${objectType}`,
    qs: query,
  };
}

function hubSpotObjectCreateRequest(
  objectType: string,
  input: Readonly<Record<string, unknown>>,
): HubSpotApiRequest {
  const body: Record<string, unknown> = {
    properties: parseHubSpotJson(input.properties),
  };
  const associations = parseHubSpotJson(input.associations);
  if (Array.isArray(associations) && associations.length) {
    body.associations = associations;
  }
  return {
    method: "POST",
    path: `/crm/v3/objects/${objectType}`,
    body,
  };
}

function hubSpotObjectUpdateRequest(
  objectType: string,
  idKey: string,
  input: Readonly<Record<string, unknown>>,
): HubSpotApiRequest {
  return {
    method: "PATCH",
    path: `/crm/v3/objects/${objectType}/${hubSpotPathSegment(
      hubSpotInputString(input, idKey, "id"),
    )}`,
    qs: hubSpotQuery(input, ["idProperty"]),
    body: { properties: parseHubSpotJson(input.properties) },
  };
}

function hubSpotObjectDeleteRequest(
  objectType: string,
  idKey: string,
  input: Readonly<Record<string, unknown>>,
): HubSpotApiRequest {
  return {
    method: "DELETE",
    path: `/crm/v3/objects/${objectType}/${hubSpotPathSegment(
      hubSpotInputString(input, idKey, "id"),
    )}`,
  };
}

function hubSpotObjectSearchRequest(
  objectType: string,
  input: Readonly<Record<string, unknown>>,
): HubSpotApiRequest {
  const body: Record<string, unknown> = {};
  for (const key of ["filterGroups", "sorts", "properties"]) {
    const value = parseHubSpotJson(input[key]);
    if (Array.isArray(value) && value.length) {
      body[key] = value;
    }
  }
  for (const key of ["query", "limit", "after"]) {
    if (input[key] !== undefined) {
      body[key] = input[key];
    }
  }
  return {
    method: "POST",
    path: `/crm/v3/objects/${objectType}/search`,
    body,
  };
}

function hubSpotMembershipBody(
  input: Readonly<Record<string, unknown>>,
): string[] {
  const value = parseHubSpotJson(input.recordIds);
  const ids = Array.isArray(value)
    ? value.map((entry) => String(entry).trim()).filter(Boolean)
    : typeof value === "string"
      ? value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];
  if (!ids.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return ids;
}

type HubSpotOperationRequestFactory = (
  input: Readonly<Record<string, unknown>>,
) => HubSpotApiRequest;

const HUBSPOT_OPERATION_REQUESTS: Readonly<
  Record<string, HubSpotOperationRequestFactory>
> = {
  "hubspot:get-contacts": (input) =>
    hubSpotObjectReadRequest("contacts", "contactId", input),
  "hubspot:create-contact": (input) =>
    hubSpotObjectCreateRequest("contacts", input),
  "hubspot:update-contact": (input) =>
    hubSpotObjectUpdateRequest("contacts", "contactId", input),
  "hubspot:search-contacts": (input) =>
    hubSpotObjectSearchRequest("contacts", input),
  "hubspot:delete-contact": (input) =>
    hubSpotObjectDeleteRequest("contacts", "contactId", input),
  "hubspot:get-companies": (input) =>
    hubSpotObjectReadRequest("companies", "companyId", input),
  "hubspot:create-company": (input) =>
    hubSpotObjectCreateRequest("companies", input),
  "hubspot:update-company": (input) =>
    hubSpotObjectUpdateRequest("companies", "companyId", input),
  "hubspot:search-companies": (input) =>
    hubSpotObjectSearchRequest("companies", input),
  "hubspot:delete-company": (input) =>
    hubSpotObjectDeleteRequest("companies", "companyId", input),
  "hubspot:get-deals": (input) =>
    hubSpotObjectReadRequest("deals", "dealId", input),
  "hubspot:create-deal": (input) => hubSpotObjectCreateRequest("deals", input),
  "hubspot:update-deal": (input) =>
    hubSpotObjectUpdateRequest("deals", "dealId", input),
  "hubspot:search-deals": (input) => hubSpotObjectSearchRequest("deals", input),
  "hubspot:delete-deal": (input) =>
    hubSpotObjectDeleteRequest("deals", "dealId", input),
  "hubspot:get-tickets": (input) =>
    hubSpotObjectReadRequest("tickets", "ticketId", input),
  "hubspot:create-ticket": (input) =>
    hubSpotObjectCreateRequest("tickets", input),
  "hubspot:update-ticket": (input) =>
    hubSpotObjectUpdateRequest("tickets", "ticketId", input),
  "hubspot:search-tickets": (input) =>
    hubSpotObjectSearchRequest("tickets", input),
  "hubspot:delete-ticket": (input) =>
    hubSpotObjectDeleteRequest("tickets", "ticketId", input),
  "hubspot:get-notes": (input) =>
    hubSpotObjectReadRequest("notes", "noteId", input),
  "hubspot:create-note": (input) => hubSpotObjectCreateRequest("notes", input),
  "hubspot:search-notes": (input) => hubSpotObjectSearchRequest("notes", input),
  "hubspot:get-emails": (input) =>
    hubSpotObjectReadRequest("emails", "emailId", input),
  "hubspot:create-email": (input) =>
    hubSpotObjectCreateRequest("emails", input),
  "hubspot:search-emails": (input) =>
    hubSpotObjectSearchRequest("emails", input),
  "hubspot:get-properties": (input) => {
    const objectType = hubSpotPathSegment(
      hubSpotInputString(input, "objectType"),
    );
    const propertyName = optionalStringValue(input.propertyName);
    return {
      method: "GET",
      path: `/crm/v3/properties/${objectType}${
        propertyName ? `/${hubSpotPathSegment(propertyName)}` : ""
      }`,
      qs: hubSpotQuery(input, ["archived"]),
    };
  },
  "hubspot:list-associations": (input) => ({
    method: "GET",
    path: `/crm/v4/objects/${hubSpotPathSegment(
      hubSpotInputString(input, "objectType"),
    )}/${hubSpotPathSegment(hubSpotInputString(input, "objectId", "id"))}/associations/${hubSpotPathSegment(
      hubSpotInputString(input, "toObjectType"),
    )}`,
    qs: hubSpotQuery(input, ["limit", "after"]),
  }),
  "hubspot:create-association": (input) => {
    const objectType = hubSpotPathSegment(
      hubSpotInputString(input, "objectType"),
    );
    const objectId = hubSpotPathSegment(
      hubSpotInputString(input, "objectId", "id"),
    );
    const toObjectType = hubSpotPathSegment(
      hubSpotInputString(input, "toObjectType"),
    );
    const toObjectId = hubSpotPathSegment(
      hubSpotInputString(input, "toObjectId"),
    );
    const associationTypeId = input.associationTypeId;
    return {
      method: "PUT",
      path:
        associationTypeId === undefined || associationTypeId === null
          ? `/crm/v4/objects/${objectType}/${objectId}/associations/default/${toObjectType}/${toObjectId}`
          : `/crm/v4/objects/${objectType}/${objectId}/associations/${toObjectType}/${toObjectId}`,
      body:
        associationTypeId === undefined || associationTypeId === null
          ? undefined
          : [
              {
                associationCategory:
                  optionalStringValue(input.associationCategory) ??
                  "HUBSPOT_DEFINED",
                associationTypeId,
              },
            ],
    };
  },
  "hubspot:delete-association": (input) => ({
    method: "DELETE",
    path: `/crm/v4/objects/${hubSpotPathSegment(
      hubSpotInputString(input, "objectType"),
    )}/${hubSpotPathSegment(hubSpotInputString(input, "objectId", "id"))}/associations/${hubSpotPathSegment(
      hubSpotInputString(input, "toObjectType"),
    )}/${hubSpotPathSegment(hubSpotInputString(input, "toObjectId"))}`,
  }),
  "hubspot:get-association-labels": (input) => ({
    method: "GET",
    path: `/crm/v4/associations/${hubSpotPathSegment(
      hubSpotInputString(input, "objectType"),
    )}/${hubSpotPathSegment(hubSpotInputString(input, "toObjectType"))}/labels`,
  }),
  "hubspot:get-line-items": (input) =>
    hubSpotObjectReadRequest("line_items", "lineItemId", input),
  "hubspot:create-line-item": (input) =>
    hubSpotObjectCreateRequest("line_items", input),
  "hubspot:update-line-item": (input) =>
    hubSpotObjectUpdateRequest("line_items", "lineItemId", input),
  "hubspot:search-line-items": (input) =>
    hubSpotObjectSearchRequest("line_items", input),
  "hubspot:delete-line-item": (input) =>
    hubSpotObjectDeleteRequest("line_items", "lineItemId", input),
  "hubspot:get-quotes": (input) =>
    hubSpotObjectReadRequest("quotes", "quoteId", input),
  "hubspot:search-quotes": (input) =>
    hubSpotObjectSearchRequest("quotes", input),
  "hubspot:get-appointments": (input) =>
    hubSpotObjectReadRequest("appointments", "appointmentId", input),
  "hubspot:create-appointment": (input) =>
    hubSpotObjectCreateRequest("appointments", input),
  "hubspot:update-appointment": (input) =>
    hubSpotObjectUpdateRequest("appointments", "appointmentId", input),
  "hubspot:get-carts": (input) =>
    hubSpotObjectReadRequest("carts", "cartId", input),
  "hubspot:list-owners": (input) => ({
    method: "GET",
    path: "/crm/v3/owners",
    qs: hubSpotQuery(input, ["limit", "after", "email"]),
  }),
  "hubspot:get-marketing-events": (input) => {
    const eventId =
      optionalStringValue(input.eventId) ?? optionalStringValue(input.id);
    return {
      method: "GET",
      path: eventId
        ? `/marketing/v3/marketing-events/${hubSpotPathSegment(eventId)}`
        : "/marketing/v3/marketing-events",
      qs: eventId ? undefined : hubSpotQuery(input, ["limit", "after"]),
    };
  },
  "hubspot:get-lists": (input) => {
    const listId =
      optionalStringValue(input.listId) ?? optionalStringValue(input.id);
    return listId
      ? {
          method: "GET",
          path: `/crm/v3/lists/${hubSpotPathSegment(listId)}`,
        }
      : {
          method: "POST",
          path: "/crm/v3/lists/search",
          body: {
            offset: typeof input.offset === "number" ? input.offset : 0,
            ...(optionalStringValue(input.query) ? { query: input.query } : {}),
            ...(typeof input.count === "number" ? { count: input.count } : {}),
          },
        };
  },
  "hubspot:create-list": (input) => ({
    method: "POST",
    path: "/crm/v3/lists",
    body: {
      name: input.name,
      objectTypeId: input.objectTypeId,
      processingType: input.processingType,
    },
  }),
  "hubspot:get-list-members": (input) => ({
    method: "GET",
    path: `/crm/v3/lists/${hubSpotPathSegment(
      hubSpotInputString(input, "listId", "id"),
    )}/memberships`,
    qs: hubSpotQuery(input, ["limit", "after"]),
  }),
  "hubspot:add-list-members": (input) => ({
    method: "PUT",
    path: `/crm/v3/lists/${hubSpotPathSegment(
      hubSpotInputString(input, "listId", "id"),
    )}/memberships/add`,
    body: hubSpotMembershipBody(input),
  }),
  "hubspot:remove-list-members": (input) => ({
    method: "PUT",
    path: `/crm/v3/lists/${hubSpotPathSegment(
      hubSpotInputString(input, "listId", "id"),
    )}/memberships/remove`,
    body: hubSpotMembershipBody(input),
  }),
  "hubspot:get-users": (input) => ({
    method: "GET",
    path: "/crm/v3/objects/users",
    qs: hubSpotQuery(input, ["limit", "after", "properties"]),
  }),
};

function assertHubSpotOperationCoverage(): void {
  const expected = new Set(HUBSPOT_OPERATION_IDS);
  const implemented = Object.keys(HUBSPOT_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("HubSpot provider SDK operation coverage is incomplete.");
  }
}

async function readHubSpotResponse(
  response: HubSpotApiResponse,
): Promise<unknown> {
  if (!response.ok) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  try {
    return await response.json();
  } catch {
    return { success: true };
  }
}

/**
 * Every HubSpot action in the pinned Sim Studio catalogue, routed through the
 * maintained HubSpot Node client. The client receives an OAuth access token
 * only inside the integration package's encrypted credential callback.
 */
export function createHubSpotProviderSdk(
  config: HubSpotProviderSdkConfig,
): IntegrationProviderSdk {
  assertHubSpotOperationCoverage();
  const clientFactory = config.clientFactory ?? createHubSpotClient;
  return {
    integrationId: "hubspot",
    operationIds: HUBSPOT_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "hubspot" ||
        invocation.reference.integrationId !== "hubspot"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = HUBSPOT_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      const request = requestFactory(invocation.input);
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const client = clientFactory();
          client.setAccessToken(credential.accessToken);
          return {
            operationId: invocation.operationId,
            output: await readHubSpotResponse(await client.apiRequest(request)),
          };
        },
      );
    },
  };
}

export function getHubSpotProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertHubSpotOperationCoverage();
  return {
    operations: HUBSPOT_OPERATION_IDS.length,
    operationIds: HUBSPOT_OPERATION_IDS,
  };
}
