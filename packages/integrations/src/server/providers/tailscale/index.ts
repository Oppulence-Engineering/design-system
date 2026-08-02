import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

const NoSdkNote =
  "publishes no maintained first-party Node SDK; its HTTP API is the supported integration surface.";

// ---------------------------------------------------------------- Tailscale

/**
 * A tailnet is addressed by its organization name ("example.com"), and "-" is
 * the documented alias for the tailnet the credential itself belongs to.
 */
const TailscaleTailnet = z
  .string()
  .min(1)
  .max(253)
  .regex(/^(-|[A-Za-z0-9.@-]+)$/u)
  .default("-");

/** Device, user, and key identifiers are opaque alphanumeric strings. */
const TailscaleId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/u);

/** An ACL tag is always written "tag:<name>". */
const TailscaleTag = z
  .string()
  .min(5)
  .max(128)
  .regex(/^tag:[A-Za-z0-9-]+$/u);

/** A CIDR block, bounded to the longest an IPv6 prefix can spell. */
const TailscaleRoute = z.string().min(1).max(64);

const TAILSCALE_ACTIONS: readonly RestAction<any>[] = [
  // ---------------------------------------------------------------- devices
  {
    action: "list-devices",
    name: "List Devices",
    description: "Lists the devices in a tailnet.",
    method: "GET",
    url: (i) =>
      `/api/v2/tailnet/${restSegment(i.tailnet)}/devices${restQuery({
        fields: i.fields,
      })}`,
    input: z
      .object({
        tailnet: TailscaleTailnet,
        fields: z.enum(["default", "all"]).optional(),
      })
      .strict(),
  },
  {
    action: "get-device",
    name: "Get Device",
    description: "Reads one device.",
    method: "GET",
    url: (i) =>
      `/api/v2/device/${restSegment(i.deviceId)}${restQuery({
        fields: i.fields,
      })}`,
    input: z
      .object({
        deviceId: TailscaleId,
        fields: z.enum(["default", "all"]).optional(),
      })
      .strict(),
  },
  {
    action: "delete-device",
    name: "Delete Device",
    description: "Removes a device from the tailnet.",
    method: "DELETE",
    url: (i) => `/api/v2/device/${restSegment(i.deviceId)}`,
    input: z.object({ deviceId: TailscaleId }).strict(),
    // Tailscale answers these mutations with 200 and no document.
    emptyResponse: "optional",
  },
  {
    action: "authorize-device",
    name: "Authorize Device",
    description: "Authorizes or deauthorizes a device on the tailnet.",
    method: "POST",
    url: (i) => `/api/v2/device/${restSegment(i.deviceId)}/authorized`,
    input: z
      .object({
        deviceId: TailscaleId,
        // Explicit rather than implied: omitting it must not deauthorize.
        authorized: z.boolean(),
      })
      .strict(),
    body: (i) => ({ authorized: i.authorized }),
    emptyResponse: "optional",
  },
  {
    action: "set-device-tags",
    name: "Set Device Tags",
    description: "Replaces the full set of ACL tags on a device.",
    method: "POST",
    url: (i) => `/api/v2/device/${restSegment(i.deviceId)}/tags`,
    input: z
      .object({
        deviceId: TailscaleId,
        // A replacement, not a merge: an empty array clears every tag.
        tags: z.array(TailscaleTag).max(256),
      })
      .strict(),
    body: (i) => ({ tags: i.tags }),
    emptyResponse: "optional",
  },
  {
    action: "get-device-routes",
    name: "Get Device Routes",
    description: "Reads the subnet routes a device advertises and serves.",
    method: "GET",
    url: (i) => `/api/v2/device/${restSegment(i.deviceId)}/routes`,
    input: z.object({ deviceId: TailscaleId }).strict(),
  },
  {
    action: "set-device-routes",
    name: "Set Device Routes",
    description: "Replaces the set of subnet routes enabled for a device.",
    method: "POST",
    url: (i) => `/api/v2/device/${restSegment(i.deviceId)}/routes`,
    input: z
      .object({
        deviceId: TailscaleId,
        // A replacement: an empty array disables every advertised route.
        routes: z.array(TailscaleRoute).max(256),
      })
      .strict(),
    body: (i) => ({ routes: i.routes }),
  },
  {
    action: "update-device-key",
    name: "Update Device Key",
    description: "Turns key expiry on or off for a device.",
    method: "POST",
    url: (i) => `/api/v2/device/${restSegment(i.deviceId)}/key`,
    input: z
      .object({ deviceId: TailscaleId, keyExpiryDisabled: z.boolean() })
      .strict(),
    body: (i) => ({ keyExpiryDisabled: i.keyExpiryDisabled }),
    emptyResponse: "optional",
  },
  {
    action: "expire-device-key",
    name: "Expire Device Key",
    description: "Expires a device's node key, forcing it to reauthenticate.",
    method: "POST",
    url: (i) => `/api/v2/device/${restSegment(i.deviceId)}/expire`,
    input: z.object({ deviceId: TailscaleId }).strict(),
    emptyResponse: "optional",
  },

  // -------------------------------------------------------------------- DNS
  {
    action: "list-dns-nameservers",
    name: "List DNS Nameservers",
    description: "Reads the tailnet's global DNS nameservers.",
    method: "GET",
    url: (i) => `/api/v2/tailnet/${restSegment(i.tailnet)}/dns/nameservers`,
    input: z.object({ tailnet: TailscaleTailnet }).strict(),
  },
  {
    action: "set-dns-nameservers",
    name: "Set DNS Nameservers",
    description: "Replaces the tailnet's global DNS nameservers.",
    method: "POST",
    url: (i) => `/api/v2/tailnet/${restSegment(i.tailnet)}/dns/nameservers`,
    input: z
      .object({
        tailnet: TailscaleTailnet,
        // A replacement: an empty array removes every global nameserver.
        dns: z.array(z.string().min(1).max(253)).max(64),
      })
      .strict(),
    body: (i) => ({ dns: i.dns }),
  },
  {
    action: "get-dns-preferences",
    name: "Get DNS Preferences",
    description: "Reads whether MagicDNS is enabled for the tailnet.",
    method: "GET",
    url: (i) => `/api/v2/tailnet/${restSegment(i.tailnet)}/dns/preferences`,
    input: z.object({ tailnet: TailscaleTailnet }).strict(),
  },
  {
    action: "set-dns-preferences",
    name: "Set DNS Preferences",
    description: "Turns MagicDNS on or off for the tailnet.",
    method: "POST",
    url: (i) => `/api/v2/tailnet/${restSegment(i.tailnet)}/dns/preferences`,
    input: z
      .object({ tailnet: TailscaleTailnet, magicDNS: z.boolean() })
      .strict(),
    body: (i) => ({ magicDNS: i.magicDNS }),
  },
  {
    action: "get-dns-search-paths",
    name: "Get DNS Search Paths",
    description: "Reads the tailnet's DNS search domains.",
    method: "GET",
    url: (i) => `/api/v2/tailnet/${restSegment(i.tailnet)}/dns/searchpaths`,
    input: z.object({ tailnet: TailscaleTailnet }).strict(),
  },
  {
    action: "set-dns-search-paths",
    name: "Set DNS Search Paths",
    description: "Replaces the tailnet's DNS search domains.",
    method: "POST",
    url: (i) => `/api/v2/tailnet/${restSegment(i.tailnet)}/dns/searchpaths`,
    input: z
      .object({
        tailnet: TailscaleTailnet,
        // A replacement: an empty array clears every search domain.
        searchPaths: z.array(z.string().min(1).max(253)).max(64),
      })
      .strict(),
    body: (i) => ({ searchPaths: i.searchPaths }),
  },

  // ------------------------------------------------------------------ users
  {
    action: "list-users",
    name: "List Users",
    description: "Lists the users of a tailnet.",
    method: "GET",
    url: (i) =>
      `/api/v2/tailnet/${restSegment(i.tailnet)}/users${restQuery({
        type: i.type,
        role: i.role,
      })}`,
    input: z
      .object({
        tailnet: TailscaleTailnet,
        type: z.enum(["member", "shared", "external", "invited"]).optional(),
        role: z.string().max(64).optional(),
      })
      .strict(),
  },
  {
    action: "suspend-user",
    name: "Suspend User",
    description: "Suspends a user from the tailnet.",
    method: "POST",
    url: (i) => `/api/v2/users/${restSegment(i.userId)}/suspend`,
    input: z.object({ userId: TailscaleId }).strict(),
    emptyResponse: "optional",
  },
  {
    action: "delete-user",
    name: "Delete User",
    description: "Deletes a user from the tailnet.",
    method: "POST",
    // The users API spells every lifecycle change as an action sub-path,
    // including deletion, rather than as an HTTP DELETE on the user.
    url: (i) => `/api/v2/users/${restSegment(i.userId)}/delete`,
    input: z.object({ userId: TailscaleId }).strict(),
    emptyResponse: "optional",
  },

  // --------------------------------------------------------------- auth keys
  {
    action: "create-auth-key",
    name: "Create Auth Key",
    description: "Creates a tailnet auth key.",
    method: "POST",
    url: (i) => `/api/v2/tailnet/${restSegment(i.tailnet)}/keys`,
    input: z
      .object({
        tailnet: TailscaleTailnet,
        reusable: z.boolean().optional(),
        ephemeral: z.boolean().optional(),
        preauthorized: z.boolean().optional(),
        tags: z.array(TailscaleTag).max(256).optional(),
        // Tailscale caps auth key lifetime at 90 days.
        expirySeconds: z
          .number()
          .int()
          .min(1)
          .max(90 * 24 * 60 * 60)
          .optional(),
        description: z.string().max(500).optional(),
      })
      .strict(),
    body: (i) => ({
      capabilities: {
        devices: {
          create: {
            reusable: i.reusable ?? false,
            ephemeral: i.ephemeral ?? false,
            preauthorized: i.preauthorized ?? false,
            ...(i.tags ? { tags: i.tags } : {}),
          },
        },
      },
      ...(i.expirySeconds !== undefined
        ? { expirySeconds: i.expirySeconds }
        : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
    }),
  },
  {
    action: "list-auth-keys",
    name: "List Auth Keys",
    description: "Lists the tailnet's auth keys and API access tokens.",
    method: "GET",
    url: (i) =>
      `/api/v2/tailnet/${restSegment(i.tailnet)}/keys${restQuery({
        all: i.all,
      })}`,
    input: z
      .object({ tailnet: TailscaleTailnet, all: z.boolean().optional() })
      .strict(),
  },
  {
    action: "get-auth-key",
    name: "Get Auth Key",
    description: "Reads one auth key's capabilities and expiry.",
    method: "GET",
    url: (i) =>
      `/api/v2/tailnet/${restSegment(i.tailnet)}/keys/${restSegment(i.keyId)}`,
    input: z.object({ tailnet: TailscaleTailnet, keyId: TailscaleId }).strict(),
  },
  {
    action: "delete-auth-key",
    name: "Delete Auth Key",
    description: "Revokes one auth key.",
    method: "DELETE",
    url: (i) =>
      `/api/v2/tailnet/${restSegment(i.tailnet)}/keys/${restSegment(i.keyId)}`,
    input: z.object({ tailnet: TailscaleTailnet, keyId: TailscaleId }).strict(),
    emptyResponse: "optional",
  },

  // -------------------------------------------------------------------- ACL
  {
    action: "get-acl",
    name: "Get ACL",
    description: "Reads the tailnet policy file.",
    method: "GET",
    url: (i) => `/api/v2/tailnet/${restSegment(i.tailnet)}/acl`,
    input: z
      .object({
        tailnet: TailscaleTailnet,
        // HuJSON preserves the comments an operator wrote in the policy.
        format: z.enum(["json", "hujson"]).optional(),
      })
      .strict(),
    headers: (i) => ({
      accept: i.format === "hujson" ? "application/hujson" : "application/json",
    }),
  },
  {
    action: "set-acl",
    name: "Set ACL",
    description: "Replaces the tailnet policy file.",
    method: "POST",
    url: (i) => `/api/v2/tailnet/${restSegment(i.tailnet)}/acl`,
    input: z
      .object({
        tailnet: TailscaleTailnet,
        // One or the other: a parsed policy, or HuJSON that keeps comments.
        policy: z.record(z.string(), z.unknown()).optional(),
        policyHujson: z
          .string()
          .min(1)
          .max(512 * 1024)
          .optional(),
        /**
         * The ETag of the policy this write is based on. Supplying it makes an
         * overwrite fail rather than silently discard a concurrent edit — this
         * call replaces every rule in the tailnet.
         */
        ifMatch: z.string().max(256).optional(),
      })
      .strict()
      .refine(
        (i) => Boolean(i.policy) !== Boolean(i.policyHujson),
        "Supply exactly one of policy or policyHujson.",
      ),
    body: (i) => i.policyHujson ?? i.policy,
    headers: (i) => ({
      "content-type": i.policyHujson
        ? "application/hujson"
        : "application/json",
      ...(i.ifMatch ? { "If-Match": i.ifMatch } : {}),
    }),
  },
];

export function createTailscalePack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "tailscale",
    sdkReview: `Tailscale ${NoSdkNote} The tailscale/tailscale-client-go package is Go, not Node.`,
    transportKind: "api_key",
    actions: TAILSCALE_ACTIONS,
  });
}
