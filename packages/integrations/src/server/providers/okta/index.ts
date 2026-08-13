import type { IntegrationProviderPack } from "../../core/provider-pack";
import { requireOptionalSdk } from "../shared/optional-sdk";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  requiredInputString,
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

function userId(input: VendorInput): string {
  return requiredInputString(input, "userId", "id", "login");
}

function groupId(input: VendorInput): string {
  return requiredInputString(input, "groupId", "id");
}

function listQuery(input: VendorInput): Record<string, unknown> {
  return definedFields({
    q: optionalInputString(input, "query", "search"),
    filter: optionalInputString(input, "filter"),
    limit: optionalInputNumber(input, "limit"),
    after: optionalInputString(input, "after", "cursor"),
  });
}

/**
 * The Okta SDK returns a paged async collection for list endpoints. Collect it
 * so a product receives a value rather than an iterator it cannot serialise,
 * bounded so a large directory cannot exhaust memory.
 */
async function collect(value: unknown, limit = 200): Promise<unknown> {
  if (!value || typeof value !== "object") return value;
  const iterable = value as AsyncIterable<unknown>;
  if (typeof iterable[Symbol.asyncIterator] !== "function") return value;
  const items: unknown[] = [];
  for await (const item of iterable) {
    items.push(item);
    if (items.length >= limit) break;
  }
  return { items, count: items.length, truncated: items.length >= limit };
}

const OKTA_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "okta:list-users": {
    path: ["userApi", "listUsers"],
    params: (input) => [listQuery(input)],
    output: (value) => collect(value),
  },
  "okta:get-user": {
    path: ["userApi", "getUser"],
    params: (input) => [{ userId: userId(input) }],
  },
  "okta:create-user": {
    path: ["userApi", "createUser"],
    params: (input) => [
      {
        body: {
          profile: definedFields({
            firstName: requiredInputString(input, "firstName"),
            lastName: requiredInputString(input, "lastName"),
            email: requiredInputString(input, "email"),
            login:
              optionalInputString(input, "login") ??
              requiredInputString(input, "email"),
            mobilePhone: optionalInputString(input, "mobilePhone"),
          }),
          ...(optionalInputString(input, "password")
            ? {
                credentials: {
                  password: { value: optionalInputString(input, "password") },
                },
              }
            : {}),
        },
        activate: input.activate !== false,
      },
    ],
  },
  "okta:update-user": {
    path: ["userApi", "updateUser"],
    params: (input) => [
      {
        userId: userId(input),
        user: {
          profile: optionalInputRecord(input, "profile", "fields") ?? {},
        },
      },
    ],
  },
  "okta:activate-user": {
    path: ["userApi", "activateUser"],
    params: (input) => [
      { userId: userId(input), sendEmail: input.sendEmail !== false },
    ],
  },
  "okta:deactivate-user": {
    path: ["userApi", "deactivateUser"],
    params: (input) => [
      { userId: userId(input), sendEmail: input.sendEmail === true },
    ],
    output: (_v, input) => ({ userId: userId(input), status: "DEPROVISIONED" }),
  },
  "okta:suspend-user": {
    path: ["userApi", "suspendUser"],
    params: (input) => [{ userId: userId(input) }],
    output: (_v, input) => ({ userId: userId(input), status: "SUSPENDED" }),
  },
  "okta:unsuspend-user": {
    path: ["userApi", "unsuspendUser"],
    params: (input) => [{ userId: userId(input) }],
    output: (_v, input) => ({ userId: userId(input), status: "ACTIVE" }),
  },
  "okta:reset-password": {
    path: ["userApi", "resetPassword"],
    params: (input) => [
      { userId: userId(input), sendEmail: input.sendEmail !== false },
    ],
  },
  "okta:delete-user": {
    path: ["userApi", "deleteUser"],
    params: (input) => [{ userId: userId(input) }],
    output: (_v, input) => ({ userId: userId(input), deleted: true }),
  },
  "okta:list-groups": {
    path: ["groupApi", "listGroups"],
    params: (input) => [listQuery(input)],
    output: (value) => collect(value),
  },
  "okta:get-group": {
    path: ["groupApi", "getGroup"],
    params: (input) => [{ groupId: groupId(input) }],
  },
  "okta:create-group": {
    path: ["groupApi", "createGroup"],
    params: (input) => [
      {
        group: {
          profile: {
            name: requiredInputString(input, "name"),
            description: optionalInputString(input, "description") ?? "",
          },
        },
      },
    ],
  },
  "okta:update-group": {
    path: ["groupApi", "replaceGroup"],
    params: (input) => [
      {
        groupId: groupId(input),
        group: {
          profile: {
            name: requiredInputString(input, "name"),
            description: optionalInputString(input, "description") ?? "",
          },
        },
      },
    ],
  },
  "okta:delete-group": {
    path: ["groupApi", "deleteGroup"],
    params: (input) => [{ groupId: groupId(input) }],
    output: (_v, input) => ({ groupId: groupId(input), deleted: true }),
  },
  "okta:add-user-to-group": {
    path: ["groupApi", "assignUserToGroup"],
    params: (input) => [{ groupId: groupId(input), userId: userId(input) }],
    output: (_v, input) => ({
      groupId: groupId(input),
      userId: userId(input),
      member: true,
    }),
  },
  "okta:remove-user-from-group": {
    path: ["groupApi", "unassignUserFromGroup"],
    params: (input) => [{ groupId: groupId(input), userId: userId(input) }],
    output: (_v, input) => ({
      groupId: groupId(input),
      userId: userId(input),
      member: false,
    }),
  },
  "okta:list-group-members": {
    path: ["groupApi", "listGroupUsers"],
    params: (input) => [{ groupId: groupId(input), ...listQuery(input) }],
    output: (value) => collect(value),
  },
};

/**
 * Okta is per-tenant, so the org URL comes from the connection rather than a
 * fixed vendor host. It is a non-secret deployment value, kept in the
 * credential envelope beside the API token.
 */
export const createOktaClient: VendorClientFactory = (credential) => {
  const { Client } = requireOptionalSdk("@okta/okta-sdk-nodejs") as {
    Client: new (config: Record<string, unknown>) => SdkMethodTarget;
  };
  const orgUrl = requiredVendorField(credential, "orgUrl");
  return new Client({
    orgUrl,
    token: vendorToken(credential),
    authorizationMode: "SSWS",
  });
};

export function createOktaPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "okta",
    driver: "@okta/okta-sdk-nodejs@8.1.0",
    transportKind: "api_key",
    operations: OKTA_OPERATIONS,
    clientFactory: options.clientFactory ?? createOktaClient,
  });
}
