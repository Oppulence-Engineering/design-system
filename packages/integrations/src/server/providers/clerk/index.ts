import { createRequire } from "node:module";
import { createHmac, timingSafeEqual } from "node:crypto";

import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import type {
  IntegrationTriggerConnection,
  IntegrationWebhookTriggerSource,
} from "../../triggers";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";

const clerkRequire = createRequire(import.meta.url);

function pagination(input: VendorInput): Record<string, unknown> {
  return definedFields({
    limit: optionalInputNumber(input, "limit"),
    offset: optionalInputNumber(input, "offset"),
    query: optionalInputString(input, "query", "search"),
  });
}

function userId(input: VendorInput): string {
  return requiredInputString(input, "userId", "id");
}

function organizationId(input: VendorInput): string {
  return requiredInputString(input, "organizationId", "orgId");
}

const CLERK_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "clerk:list-users": {
    path: ["users", "getUserList"],
    params: (input) => [pagination(input)],
  },
  "clerk:get-user": {
    path: ["users", "getUser"],
    params: (input) => [userId(input)],
  },
  "clerk:create-user": {
    path: ["users", "createUser"],
    params: (input) => [
      definedFields({
        emailAddress: optionalInputStringArray(input, "emailAddress", "email"),
        phoneNumber: optionalInputStringArray(input, "phoneNumber"),
        username: optionalInputString(input, "username"),
        password: optionalInputString(input, "password"),
        firstName: optionalInputString(input, "firstName"),
        lastName: optionalInputString(input, "lastName"),
        publicMetadata: optionalInputRecord(input, "publicMetadata"),
        privateMetadata: optionalInputRecord(input, "privateMetadata"),
      }),
    ],
  },
  "clerk:update-user": {
    path: ["users", "updateUser"],
    params: (input) => [
      userId(input),
      definedFields({
        firstName: optionalInputString(input, "firstName"),
        lastName: optionalInputString(input, "lastName"),
        username: optionalInputString(input, "username"),
        publicMetadata: optionalInputRecord(input, "publicMetadata"),
        privateMetadata: optionalInputRecord(input, "privateMetadata"),
      }),
    ],
  },
  "clerk:delete-user": {
    path: ["users", "deleteUser"],
    params: (input) => [userId(input)],
    output: (_v, input) => ({ userId: userId(input), deleted: true }),
  },
  "clerk:ban-user": {
    path: ["users", "banUser"],
    params: (input) => [userId(input)],
  },
  "clerk:unban-user": {
    path: ["users", "unbanUser"],
    params: (input) => [userId(input)],
  },
  "clerk:lock-user": {
    path: ["users", "lockUser"],
    params: (input) => [userId(input)],
  },
  "clerk:unlock-user": {
    path: ["users", "unlockUser"],
    params: (input) => [userId(input)],
  },
  "clerk:get-user-oauth-token": {
    path: ["users", "getUserOauthAccessToken"],
    params: (input) => [userId(input), requiredInputString(input, "provider")],
  },
  "clerk:list-organizations": {
    path: ["organizations", "getOrganizationList"],
    params: (input) => [pagination(input)],
  },
  "clerk:get-organization": {
    path: ["organizations", "getOrganization"],
    params: (input) => [{ organizationId: organizationId(input) }],
  },
  "clerk:create-organization": {
    path: ["organizations", "createOrganization"],
    params: (input) => [
      definedFields({
        name: requiredInputString(input, "name"),
        slug: optionalInputString(input, "slug"),
        createdBy: optionalInputString(input, "createdBy"),
        publicMetadata: optionalInputRecord(input, "publicMetadata"),
      }),
    ],
  },
  "clerk:update-organization": {
    path: ["organizations", "updateOrganization"],
    params: (input) => [
      organizationId(input),
      definedFields({
        name: optionalInputString(input, "name"),
        slug: optionalInputString(input, "slug"),
        publicMetadata: optionalInputRecord(input, "publicMetadata"),
      }),
    ],
  },
  "clerk:delete-organization": {
    path: ["organizations", "deleteOrganization"],
    params: (input) => [organizationId(input)],
    output: (_v, input) => ({
      organizationId: organizationId(input),
      deleted: true,
    }),
  },
  "clerk:list-organization-memberships": {
    path: ["organizations", "getOrganizationMembershipList"],
    params: (input) => [
      { organizationId: organizationId(input), ...pagination(input) },
    ],
  },
  "clerk:add-organization-member": {
    path: ["organizations", "createOrganizationMembership"],
    params: (input) => [
      {
        organizationId: organizationId(input),
        userId: userId(input),
        role: requiredInputString(input, "role"),
      },
    ],
  },
  "clerk:update-organization-membership": {
    path: ["organizations", "updateOrganizationMembership"],
    params: (input) => [
      {
        organizationId: organizationId(input),
        userId: userId(input),
        role: requiredInputString(input, "role"),
      },
    ],
  },
  "clerk:remove-organization-member": {
    path: ["organizations", "deleteOrganizationMembership"],
    params: (input) => [
      { organizationId: organizationId(input), userId: userId(input) },
    ],
    output: (_v, input) => ({
      organizationId: organizationId(input),
      userId: userId(input),
      removed: true,
    }),
  },
  "clerk:create-organization-invitation": {
    path: ["organizations", "createOrganizationInvitation"],
    params: (input) => [
      definedFields({
        organizationId: organizationId(input),
        emailAddress: requiredInputString(input, "emailAddress", "email"),
        role: requiredInputString(input, "role"),
        inviterUserId: optionalInputString(input, "inviterUserId"),
        redirectUrl: optionalInputString(input, "redirectUrl"),
      }),
    ],
  },
  "clerk:list-organization-invitations": {
    path: ["organizations", "getOrganizationInvitationList"],
    params: (input) => [
      { organizationId: organizationId(input), ...pagination(input) },
    ],
  },
  "clerk:list-sessions": {
    path: ["sessions", "getSessionList"],
    params: (input) => [
      definedFields({
        userId: optionalInputString(input, "userId"),
        status: optionalInputString(input, "status"),
        ...pagination(input),
      }),
    ],
  },
  "clerk:get-session": {
    path: ["sessions", "getSession"],
    params: (input) => [requiredInputString(input, "sessionId", "id")],
  },
  "clerk:revoke-session": {
    path: ["sessions", "revokeSession"],
    params: (input) => [requiredInputString(input, "sessionId", "id")],
  },
  "clerk:list-allowlist-identifiers": {
    path: ["allowlistIdentifiers", "getAllowlistIdentifierList"],
  },
  "clerk:create-allowlist-identifier": {
    path: ["allowlistIdentifiers", "createAllowlistIdentifier"],
    params: (input) => [
      {
        identifier: requiredInputString(input, "identifier"),
        notify: input.notify === true,
      },
    ],
  },
  "clerk:delete-allowlist-identifier": {
    path: ["allowlistIdentifiers", "deleteAllowlistIdentifier"],
    params: (input) => [requiredInputString(input, "identifierId", "id")],
    output: (_v, input) => ({
      identifierId: requiredInputString(input, "identifierId", "id"),
      deleted: true,
    }),
  },
  "clerk:list-blocklist-identifiers": {
    path: ["blocklistIdentifiers", "getBlocklistIdentifierList"],
  },
  "clerk:create-blocklist-identifier": {
    path: ["blocklistIdentifiers", "createBlocklistIdentifier"],
    params: (input) => [
      { identifier: requiredInputString(input, "identifier") },
    ],
  },
  "clerk:delete-blocklist-identifier": {
    path: ["blocklistIdentifiers", "deleteBlocklistIdentifier"],
    params: (input) => [requiredInputString(input, "identifierId", "id")],
    output: (_v, input) => ({
      identifierId: requiredInputString(input, "identifierId", "id"),
      deleted: true,
    }),
  },
  "clerk:list-jwt-templates": { path: ["jwtTemplates", "list"] },
  "clerk:get-jwt-template": {
    path: ["jwtTemplates", "get"],
    params: (input) => [requiredInputString(input, "templateId", "id")],
  },
  "clerk:create-actor-token": {
    path: ["actorTokens", "createActorToken"],
    params: (input) => [
      definedFields({
        userId: userId(input),
        actor: optionalInputRecord(input, "actor") ?? {},
        expiresInSeconds: optionalInputNumber(input, "expiresInSeconds"),
      }),
    ],
  },
  "clerk:revoke-actor-token": {
    path: ["actorTokens", "revokeActorToken"],
    params: (input) => [requiredInputString(input, "actorTokenId", "id")],
  },
};

/**
 * Clerk's backend SDK authenticates with a secret key. The source lists the
 * provider as `none` because there is no OAuth app to register; the secret
 * still lives in the encrypted envelope.
 */
export const createClerkClient: VendorClientFactory = (credential) => {
  const { createClerkClient: create } = clerkRequire("@clerk/backend") as {
    createClerkClient(config: { secretKey: string }): SdkMethodTarget;
  };
  return create({ secretKey: vendorToken(credential) });
};

/**
 * Clerk signs webhooks with Svix: the signature covers `id.timestamp.body`
 * and the header may carry several space-separated versioned signatures.
 */
function verifyClerkSignature(input: {
  rawBody: Uint8Array;
  headers: Headers;
  secret: string;
}): boolean {
  const id = input.headers.get("svix-id");
  const timestamp = input.headers.get("svix-timestamp");
  const signature = input.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return false;

  // Reject a replay of an old delivery.
  const age = Math.abs(Date.now() / 1_000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const secret = input.secret.startsWith("whsec_")
    ? input.secret.slice(6)
    : input.secret;
  const expected = createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`${id}.${timestamp}.${new TextDecoder().decode(input.rawBody)}`)
    .digest("base64");

  return signature.split(" ").some((entry) => {
    const value = entry.includes(",") ? entry.split(",")[1] : entry;
    const a = Buffer.from(value ?? "", "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/** Source trigger ID to the Clerk event type it models. */
const CLERK_TRIGGER_EVENTS: Readonly<Record<string, readonly string[]>> = {
  "clerk:clerk-user-created": ["user.created"],
  "clerk:clerk-user-updated": ["user.updated"],
  "clerk:clerk-user-deleted": ["user.deleted"],
  "clerk:clerk-session-created": ["session.created"],
  "clerk:clerk-session-ended": ["session.ended"],
  "clerk:clerk-session-removed": ["session.removed"],
  "clerk:clerk-session-revoked": ["session.revoked"],
  "clerk:clerk-organization-created": ["organization.created"],
  "clerk:clerk-organization-updated": ["organization.updated"],
  "clerk:clerk-organization-deleted": ["organization.deleted"],
  "clerk:clerk-organization-membership-created": [
    "organizationMembership.created",
  ],
  "clerk:clerk-organization-membership-updated": [
    "organizationMembership.updated",
  ],
  "clerk:clerk-organization-membership-deleted": [
    "organizationMembership.deleted",
  ],
  "clerk:clerk-webhook": [],
};

export interface ClerkWebhookTriggerConfig {
  /** Signing secret from the Clerk dashboard, in `whsec_` form. */
  signingSecret: string;
  resolveConnection(input: {
    eventType: string;
  }): Promise<IntegrationTriggerConnection | undefined>;
}

/**
 * Builds every Clerk webhook trigger source. Each verifies the shared Svix
 * signature and then accepts only the event its own trigger models.
 */
export function createClerkWebhookTriggerSources(
  config: ClerkWebhookTriggerConfig,
): readonly IntegrationWebhookTriggerSource[] {
  return Object.entries(CLERK_TRIGGER_EVENTS).map(([triggerId, accepted]) => ({
    kind: "webhook" as const,
    integrationId: "clerk",
    triggerId,
    async verify({ rawBody, headers }) {
      if (
        !verifyClerkSignature({
          rawBody,
          headers,
          secret: config.signingSecret,
        })
      ) {
        return undefined;
      }
      let payload: Record<string, unknown> | undefined;
      try {
        payload = JSON.parse(new TextDecoder().decode(rawBody)) as Record<
          string,
          unknown
        >;
      } catch {
        return undefined;
      }
      const eventType =
        typeof payload?.type === "string" ? payload.type : undefined;
      if (!eventType) return undefined;
      if (accepted.length > 0 && !accepted.includes(eventType)) {
        return undefined;
      }
      const connection = await config.resolveConnection({ eventType });
      if (!connection) return undefined;
      const data = payload.data as Record<string, unknown> | undefined;
      return {
        connection,
        events: [
          {
            providerEvent: eventType,
            ...(typeof data?.id === "string" ? { externalId: data.id } : {}),
            data: { id: data?.id, object: data?.object },
          },
        ],
      };
    },
  }));
}

export function createClerkPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  const baseline = SIMSTUDIO_BASELINE.integrations.find(
    (integration) => integration.id === "clerk",
  );
  return createVendorPack({
    integrationId: "clerk",
    driver: "@clerk/backend@3.15.0",
    transportKind: "api_key",
    operations: CLERK_OPERATIONS,
    clientFactory: options.clientFactory ?? createClerkClient,
    triggerCoverage: (baseline?.triggers ?? []).map((trigger) => ({
      sourceTriggerId: trigger.id,
      kind: "webhook" as const,
      disposition: "supported" as const,
    })),
  });
}
