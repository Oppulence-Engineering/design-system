import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from LaunchDarkly's published OpenAPI document:
 * https://app.launchdarkly.com/api/v2/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "LaunchDarkly publishes no maintained Node SDK; its OpenAPI document at https://app.launchdarkly.com/api/v2/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-flags",
    name: "List Flags",
    description: "List feature flags in a LaunchDarkly project.",
    method: "GET",
    url: (i) =>
      `/api/v2/flags/${restSegment(i.projectKey)}/${restSegment(i.featureFlagKey)}/dependent-flags`,
    input: z
      .object({
        projectKey: z.string().max(4_000),
        featureFlagKey: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "get-flag",
    name: "Get Flag",
    description:
      "Get a single feature flag by key from a LaunchDarkly project.",
    method: "GET",
    url: (i) =>
      `/api/v2/flags/${restSegment(i.projectKey)}${restQuery({ env: i.env, tag: i.tag, limit: i.limit, offset: i.offset, archived: i.archived, summary: i.summary, filter: i.filter, sort: i.sort, compare: i.compare, expand: i.expand })}`,
    input: z
      .object({
        projectKey: z.string().max(4_000),
        env: z.string().max(4_000).optional(),
        tag: z.string().max(4_000).optional(),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        offset: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        archived: z.boolean().optional(),
        summary: z.boolean().optional(),
        filter: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
        compare: z.boolean().optional(),
        expand: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-flag",
    name: "Create Flag",
    description: "Create a new feature flag in a LaunchDarkly project.",
    method: "POST",
    url: (i) =>
      `/api/v2/flags/${restSegment(i.projectKey)}/${restSegment(i.featureFlagKey)}/copy`,
    input: z
      .object({
        projectKey: z.string().max(4_000),
        featureFlagKey: z.string().max(4_000),
        source: SpecObject,
        target: SpecObject,
        comment: z.string().max(4_000).optional(),
        includedActions: SpecArray.optional(),
        excludedActions: SpecArray.optional(),
      })
      .strict(),
    body: (i) => ({
      source: i.source,
      target: i.target,
      ...(i.comment !== undefined ? { comment: i.comment } : {}),
      ...(i.includedActions !== undefined
        ? { includedActions: i.includedActions }
        : {}),
      ...(i.excludedActions !== undefined
        ? { excludedActions: i.excludedActions }
        : {}),
    }),
  },
  {
    action: "update-flag",
    name: "Update Flag",
    description:
      "Update feature flag metadata (name, description, tags, temporary, archived) using semantic patch.",
    method: "POST",
    url: (i) =>
      `/api/v2/flags/${restSegment(i.projectKey)}${restQuery({ clone: i.clone })}`,
    input: z
      .object({
        projectKey: z.string().max(4_000),
        clone: z.string().max(4_000).optional(),
        name: z.string().max(4_000),
        key: z.string().max(4_000),
        description: z.string().max(4_000).optional(),
        includeInSnippet: z.boolean().optional(),
        clientSideAvailability: SpecObject.optional(),
        variations: SpecArray.optional(),
        temporary: z.boolean().optional(),
        tags: SpecArray.optional(),
        customProperties: SpecObject.optional(),
        defaults: SpecObject.optional(),
        purpose: z.enum(["migration", "holdout"]).optional(),
        migrationSettings: SpecObject.optional(),
        maintainerId: z.string().max(4_000).optional(),
        maintainerTeamKey: z.string().max(4_000).optional(),
        initialPrerequisites: SpecArray.optional(),
        isFlagOn: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      key: i.key,
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.includeInSnippet !== undefined
        ? { includeInSnippet: i.includeInSnippet }
        : {}),
      ...(i.clientSideAvailability !== undefined
        ? { clientSideAvailability: i.clientSideAvailability }
        : {}),
      ...(i.variations !== undefined ? { variations: i.variations } : {}),
      ...(i.temporary !== undefined ? { temporary: i.temporary } : {}),
      ...(i.tags !== undefined ? { tags: i.tags } : {}),
      ...(i.customProperties !== undefined
        ? { customProperties: i.customProperties }
        : {}),
      ...(i.defaults !== undefined ? { defaults: i.defaults } : {}),
      ...(i.purpose !== undefined ? { purpose: i.purpose } : {}),
      ...(i.migrationSettings !== undefined
        ? { migrationSettings: i.migrationSettings }
        : {}),
      ...(i.maintainerId !== undefined ? { maintainerId: i.maintainerId } : {}),
      ...(i.maintainerTeamKey !== undefined
        ? { maintainerTeamKey: i.maintainerTeamKey }
        : {}),
      ...(i.initialPrerequisites !== undefined
        ? { initialPrerequisites: i.initialPrerequisites }
        : {}),
      ...(i.isFlagOn !== undefined ? { isFlagOn: i.isFlagOn } : {}),
    }),
  },
  {
    action: "delete-flag",
    name: "Delete Flag",
    description: "Delete a feature flag from a LaunchDarkly project.",
    method: "DELETE",
    url: (i) =>
      `/api/v2/flags/${restSegment(i.projectKey)}/${restSegment(i.featureFlagKey)}`,
    input: z
      .object({
        projectKey: z.string().max(4_000),
        featureFlagKey: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "get-flag-status",
    name: "Get Flag Status",
    description:
      "Get the status of a feature flag across environments (active, inactive, launched, etc.).",
    method: "GET",
    url: (i) =>
      `/api/v2/engineering-insights/charts/flags/status${restQuery({ projectKey: i.projectKey, environmentKey: i.environmentKey, applicationKey: i.applicationKey })}`,
    input: z
      .object({
        projectKey: z.string().max(4_000),
        environmentKey: z.string().max(4_000),
        applicationKey: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-projects",
    name: "List Projects",
    description: "List all projects in your LaunchDarkly account.",
    method: "GET",
    url: (i) =>
      `/api/v2/projects${restQuery({ limit: i.limit, offset: i.offset, filter: i.filter, sort: i.sort, expand: i.expand })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        offset: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filter: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
        expand: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-environments",
    name: "List Environments",
    description: "List environments in a LaunchDarkly project.",
    method: "GET",
    url: (i) =>
      `/api/v2/projects/${restSegment(i.projectKey)}/environments${restQuery({ limit: i.limit, offset: i.offset, filter: i.filter, sort: i.sort })}`,
    input: z
      .object({
        projectKey: z.string().max(4_000),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        offset: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filter: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-members",
    name: "List Members",
    description: "List account members in your LaunchDarkly organization.",
    method: "GET",
    url: (i) =>
      `/api/v2/members${restQuery({ limit: i.limit, offset: i.offset, filter: i.filter, expand: i.expand, sort: i.sort })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        offset: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filter: z.string().max(4_000).optional(),
        expand: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
      })
      .strict(),
  },
];

export function createLaunchdarklyPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "launchdarkly",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "toggle-flag":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "list-segments":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-audit-log":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
