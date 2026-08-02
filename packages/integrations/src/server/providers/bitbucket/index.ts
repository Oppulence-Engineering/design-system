import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from bitbucket's published OpenAPI document:
 * https://api.bitbucket.com/swagger.json
 *
 * This provider is outside the pinned source, so its action table is its own
 * coverage. The table is the shallowest CRUD operations the document declares,
 * capped at 22 — a vendor's top-level resources, not everything it serves.
 */
const SPEC_NOTE =
  "bitbucket publishes no maintained Node SDK; its OpenAPI document at https://api.bitbucket.com/swagger.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "get-repository",
    name: "Get Repository",
    description: "List repositories in a workspace",
    method: "GET",
    url: (i) =>
      `/2.0/repositories/${restSegment(i.workspace)}${restQuery({ role: i.role, q: i.q, sort: i.sort })}`,
    input: z
      .object({
        workspace: z.string().max(4_000),
        role: z.enum(["admin", "contributor", "member", "owner"]).optional(),
        q: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-repository",
    name: "Create Repository",
    description: "Create a repository",
    method: "POST",
    url: (i) =>
      `/2.0/repositories/${restSegment(i.workspace)}/${restSegment(i.repoSlug)}`,
    input: z
      .object({
        repoSlug: z.string().max(4_000),
        workspace: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "update-repository",
    name: "Update Repository",
    description: "Update a repository",
    method: "PUT",
    url: (i) =>
      `/2.0/repositories/${restSegment(i.workspace)}/${restSegment(i.repoSlug)}`,
    input: z
      .object({
        repoSlug: z.string().max(4_000),
        workspace: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "delete-repository",
    name: "Delete Repository",
    description: "Delete a repository",
    method: "DELETE",
    url: (i) =>
      `/2.0/repositories/${restSegment(i.workspace)}/${restSegment(i.repoSlug)}${restQuery({ redirect_to: i.redirectTo })}`,
    input: z
      .object({
        repoSlug: z.string().max(4_000),
        workspace: z.string().max(4_000),
        redirectTo: z.string().max(4_000).optional(),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-branch-restrictions",
    name: "List Branch Restrictions",
    description: "List branch restrictions",
    method: "GET",
    url: (i) =>
      `/2.0/repositories/${restSegment(i.workspace)}/${restSegment(i.repoSlug)}/branch-restrictions${restQuery({ kind: i.kind, pattern: i.pattern })}`,
    input: z
      .object({
        repoSlug: z.string().max(4_000),
        workspace: z.string().max(4_000),
        kind: z.string().max(4_000).optional(),
        pattern: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-workspace",
    name: "Get Workspace",
    description: "Get a workspace",
    method: "GET",
    url: (i) => `/2.0/workspaces/${restSegment(i.workspace)}`,
    input: z
      .object({
        workspace: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "list-hooks",
    name: "List Hooks",
    description: "List webhooks for a workspace",
    method: "GET",
    url: (i) => `/2.0/workspaces/${restSegment(i.workspace)}/hooks`,
    input: z
      .object({
        workspace: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "create-hook",
    name: "Create Hook",
    description: "Create a webhook for a workspace",
    method: "POST",
    url: (i) => `/2.0/workspaces/${restSegment(i.workspace)}/hooks`,
    input: z
      .object({
        workspace: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "get-hook",
    name: "Get Hook",
    description: "Get a webhook for a workspace",
    method: "GET",
    url: (i) =>
      `/2.0/workspaces/${restSegment(i.workspace)}/hooks/${restSegment(i.uid)}`,
    input: z
      .object({
        uid: z.string().max(4_000),
        workspace: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "update-hook",
    name: "Update Hook",
    description: "Update a webhook for a workspace",
    method: "PUT",
    url: (i) =>
      `/2.0/workspaces/${restSegment(i.workspace)}/hooks/${restSegment(i.uid)}`,
    input: z
      .object({
        uid: z.string().max(4_000),
        workspace: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "create-snippet",
    name: "Create Snippet",
    description: "Create a snippet",
    method: "POST",
    url: "/2.0/snippets",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "get-snippet",
    name: "Get Snippet",
    description: "List snippets in a workspace",
    method: "GET",
    url: (i) =>
      `/2.0/snippets/${restSegment(i.workspace)}${restQuery({ role: i.role })}`,
    input: z
      .object({
        workspace: z.string().max(4_000),
        role: z.enum(["owner", "contributor", "member"]).optional(),
      })
      .strict(),
  },
  {
    action: "update-snippet",
    name: "Update Snippet",
    description: "Update a snippet",
    method: "PUT",
    url: (i) =>
      `/2.0/snippets/${restSegment(i.workspace)}/${restSegment(i.encodedId)}`,
    input: z
      .object({
        encodedId: z.string().max(4_000),
        workspace: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "delete-snippet",
    name: "Delete Snippet",
    description: "Delete a snippet",
    method: "DELETE",
    url: (i) =>
      `/2.0/snippets/${restSegment(i.workspace)}/${restSegment(i.encodedId)}`,
    input: z
      .object({
        encodedId: z.string().max(4_000),
        workspace: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "get-file",
    name: "Get File",
    description: "Get a snippet's raw file",
    method: "GET",
    url: (i) =>
      `/2.0/snippets/${restSegment(i.workspace)}/${restSegment(i.encodedId)}/${restSegment(i.nodeId)}/files/${restSegment(i.path)}`,
    input: z
      .object({
        encodedId: z.string().max(4_000),
        nodeId: z.string().max(4_000),
        path: z.string().max(4_000),
        workspace: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "list-user",
    name: "List User",
    description: "Get current user",
    method: "GET",
    url: "/2.0/user",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "list-emails",
    name: "List Emails",
    description: "List email addresses for current user",
    method: "GET",
    url: "/2.0/user/emails",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "get-email",
    name: "Get Email",
    description: "Get an email address for current user",
    method: "GET",
    url: (i) => `/2.0/user/emails/${restSegment(i.email)}`,
    input: z
      .object({
        email: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "list-workspaces",
    name: "List Workspaces",
    description: "List workspaces for the current user",
    method: "GET",
    url: (i) =>
      `/2.0/user/workspaces${restQuery({ sort: i.sort, administrator: i.administrator })}`,
    input: z
      .object({
        sort: z.string().max(4_000).optional(),
        administrator: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "list-permission",
    name: "List Permission",
    description: "Get user permission on a workspace",
    method: "GET",
    url: (i) => `/2.0/user/workspaces/${restSegment(i.workspace)}/permission`,
    input: z
      .object({
        workspace: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "update-addon",
    name: "Update Addon",
    description: "Update an installed app",
    method: "PUT",
    url: "/2.0/addon",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "delete-addon",
    name: "Delete Addon",
    description: "Delete an app",
    method: "DELETE",
    url: "/2.0/addon",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
    emptyResponse: "optional",
  },
];

export function createBitbucketPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "bitbucket",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    beyondBaseline: true,
    actions: ACTIONS,
  });
}
