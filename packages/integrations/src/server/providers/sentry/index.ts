import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Sentry's published OpenAPI document:
 * https://raw.githubusercontent.com/getsentry/sentry-api-schema/main/openapi-derefed.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Sentry publishes no maintained Node SDK; its OpenAPI document at https://raw.githubusercontent.com/getsentry/sentry-api-schema/main/openapi-derefed.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-issues",
    name: "List Issues",
    description:
      "List issues from Sentry for a specific organization and optionally a specific project. Returns issue details including status, error counts, and last seen timestamps.",
    method: "GET",
    url: (i) =>
      `/api/0/organizations/${restSegment(i.organizationIdOrSlug)}/issues/${restQuery({ environment: i.environment, project: i.project, statsPeriod: i.statsPeriod, start: i.start, end: i.end, groupStatsPeriod: i.groupStatsPeriod, shortIdLookup: i.shortIdLookup, query: i.query, viewId: i.viewId, sort: i.sort, limit: i.limit, expand: i.expand, collapse: i.collapse, cursor: i.cursor })}`,
    input: z
      .object({
        organizationIdOrSlug: z.string().max(4_000),
        environment: SpecArray.optional(),
        project: SpecArray.optional(),
        statsPeriod: z.string().max(4_000).optional(),
        start: z.string().max(4_000).optional(),
        end: z.string().max(4_000).optional(),
        groupStatsPeriod: z.enum(["", "14d", "24h", "auto"]).optional(),
        shortIdLookup: z.enum(["0", "1"]).optional(),
        query: z.string().max(4_000).optional(),
        viewId: z.string().max(4_000).optional(),
        sort: z
          .enum([
            "date",
            "freq",
            "inbox",
            "new",
            "recommended",
            "trends",
            "user",
          ])
          .optional(),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        expand: SpecArray.optional(),
        collapse: SpecArray.optional(),
        cursor: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-issue",
    name: "Get Issue",
    description:
      "Retrieve detailed information about a specific Sentry issue by its ID. Returns complete issue details including metadata, tags, and statistics.",
    method: "GET",
    url: (i) =>
      `/api/0/organizations/${restSegment(i.organizationIdOrSlug)}/issues/${restSegment(i.issueId)}/${restQuery({ environment: i.environment, expand: i.expand, collapse: i.collapse })}`,
    input: z
      .object({
        organizationIdOrSlug: z.string().max(4_000),
        issueId: z.string().max(4_000),
        environment: SpecArray.optional(),
        expand: SpecArray.optional(),
        collapse: SpecArray.optional(),
      })
      .strict(),
  },
  {
    action: "update-issue",
    name: "Update Issue",
    description:
      "Update a Sentry issue by changing its status, assignment, bookmark state, or other properties. Returns the updated issue details.",
    method: "PUT",
    url: (i) =>
      `/api/0/organizations/${restSegment(i.organizationIdOrSlug)}/issues/${restSegment(i.issueId)}/`,
    input: z
      .object({
        organizationIdOrSlug: z.string().max(4_000),
        issueId: z.string().max(4_000),
        inbox: z.boolean(),
        status: z.enum([
          "resolved",
          "unresolved",
          "ignored",
          "resolvedInNextRelease",
          "muted",
        ]),
        statusDetails: SpecObject,
        substatus: z.string().max(4_000),
        hasSeen: z.boolean(),
        isBookmarked: z.boolean(),
        isPublic: z.boolean(),
        isSubscribed: z.boolean(),
        merge: z.boolean(),
        discard: z.boolean(),
        assignedTo: z.string().max(4_000),
        priority: z.enum(["low", "medium", "high"]),
      })
      .strict(),
    body: (i) => ({
      inbox: i.inbox,
      status: i.status,
      statusDetails: i.statusDetails,
      substatus: i.substatus,
      hasSeen: i.hasSeen,
      isBookmarked: i.isBookmarked,
      isPublic: i.isPublic,
      isSubscribed: i.isSubscribed,
      merge: i.merge,
      discard: i.discard,
      assignedTo: i.assignedTo,
      priority: i.priority,
    }),
  },
  {
    action: "list-projects",
    name: "List Projects",
    description:
      "List all projects in a Sentry organization. Returns project details including name, platform, teams, and configuration.",
    method: "GET",
    url: (i) =>
      `/api/0/organizations/${restSegment(i.organizationIdOrSlug)}/projects/${restQuery({ cursor: i.cursor, per_page: i.perPage, query: i.query })}`,
    input: z
      .object({
        organizationIdOrSlug: z.string().max(4_000),
        cursor: z.string().max(4_000).optional(),
        perPage: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        query: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-project",
    name: "Get Project",
    description:
      "Retrieve detailed information about a specific Sentry project by its slug. Returns complete project details including teams, features, and configuration.",
    method: "GET",
    url: (i) =>
      `/api/0/projects/${restSegment(i.organizationIdOrSlug)}/${restSegment(i.projectIdOrSlug)}/`,
    input: z
      .object({
        organizationIdOrSlug: z.string().max(4_000),
        projectIdOrSlug: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "create-project",
    name: "Create Project",
    description:
      "Create a new Sentry project in an organization. Requires a team to associate the project with. Returns the created project details.",
    method: "POST",
    url: (i) =>
      `/api/0/organizations/${restSegment(i.organizationIdOrSlug)}/projects/`,
    input: z
      .object({
        organizationIdOrSlug: z.string().max(4_000),
        name: z.string().max(4_000),
        slug: z.string().max(4_000).optional(),
        platform: z.string().max(4_000).optional(),
        defaultRules: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      ...(i.slug !== undefined ? { slug: i.slug } : {}),
      ...(i.platform !== undefined ? { platform: i.platform } : {}),
      ...(i.defaultRules !== undefined
        ? { default_rules: i.defaultRules }
        : {}),
    }),
  },
  {
    action: "update-project",
    name: "Update Project",
    description:
      "Update a Sentry project by changing its name, slug, platform, or other settings. Returns the updated project details.",
    method: "PUT",
    url: (i) =>
      `/api/0/projects/${restSegment(i.organizationIdOrSlug)}/${restSegment(i.projectIdOrSlug)}/`,
    input: z
      .object({
        organizationIdOrSlug: z.string().max(4_000),
        projectIdOrSlug: z.string().max(4_000),
        isBookmarked: z.boolean().optional(),
        name: z.string().max(4_000).optional(),
        slug: z.string().max(4_000).optional(),
        platform: z.string().max(4_000).optional(),
        subjectPrefix: z.string().max(4_000).optional(),
        subjectTemplate: z.string().max(4_000).optional(),
        resolveAge: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        highlightContext: SpecObject.optional(),
        highlightTags: SpecArray.optional(),
        enableAutoReleaseCreation: z.boolean().optional(),
        scmSourceContextEnabled: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.isBookmarked !== undefined ? { isBookmarked: i.isBookmarked } : {}),
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.slug !== undefined ? { slug: i.slug } : {}),
      ...(i.platform !== undefined ? { platform: i.platform } : {}),
      ...(i.subjectPrefix !== undefined
        ? { subjectPrefix: i.subjectPrefix }
        : {}),
      ...(i.subjectTemplate !== undefined
        ? { subjectTemplate: i.subjectTemplate }
        : {}),
      ...(i.resolveAge !== undefined ? { resolveAge: i.resolveAge } : {}),
      ...(i.highlightContext !== undefined
        ? { highlightContext: i.highlightContext }
        : {}),
      ...(i.highlightTags !== undefined
        ? { highlightTags: i.highlightTags }
        : {}),
      ...(i.enableAutoReleaseCreation !== undefined
        ? { enableAutoReleaseCreation: i.enableAutoReleaseCreation }
        : {}),
      ...(i.scmSourceContextEnabled !== undefined
        ? { scmSourceContextEnabled: i.scmSourceContextEnabled }
        : {}),
    }),
  },
  {
    action: "list-teams",
    name: "List Teams",
    description:
      "List all teams in a Sentry organization. Useful for discovering the team slug required when creating a project. Returns team details including slug, name, member count, and associated projects.",
    method: "GET",
    url: (i) =>
      `/api/0/organizations/${restSegment(i.organizationIdOrSlug)}/teams/${restQuery({ detailed: i.detailed, cursor: i.cursor, per_page: i.perPage, query: i.query })}`,
    input: z
      .object({
        organizationIdOrSlug: z.string().max(4_000),
        detailed: z.string().max(4_000).optional(),
        cursor: z.string().max(4_000).optional(),
        perPage: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        query: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-events",
    name: "List Events",
    description:
      "List events from a Sentry project. Can be filtered by issue ID, query, or time period. Returns event details including context, tags, and user information.",
    method: "GET",
    url: (i) =>
      `/api/0/organizations/${restSegment(i.organizationIdOrSlug)}/events/${restQuery({ field: i.field, dataset: i.dataset, end: i.end, environment: i.environment, project: i.project, start: i.start, statsPeriod: i.statsPeriod, per_page: i.perPage, query: i.query, sort: i.sort, allowAggregateConditions: i.allowAggregateConditions, cursor: i.cursor })}`,
    input: z
      .object({
        organizationIdOrSlug: z.string().max(4_000),
        field: SpecArray,
        dataset: z.enum([
          "errors",
          "logs",
          "profile_functions",
          "spans",
          "tracemetrics",
          "uptime_results",
        ]),
        end: z.string().max(4_000).optional(),
        environment: SpecArray.optional(),
        project: SpecArray.optional(),
        start: z.string().max(4_000).optional(),
        statsPeriod: z.string().max(4_000).optional(),
        perPage: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        query: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
        allowAggregateConditions: z.boolean().optional(),
        cursor: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-event",
    name: "Get Event",
    description:
      "Retrieve detailed information about a specific Sentry event by its ID. Returns complete event details including stack traces, breadcrumbs, context, and user information.",
    method: "GET",
    url: (i) =>
      `/api/0/projects/${restSegment(i.organizationIdOrSlug)}/${restSegment(i.projectIdOrSlug)}/events/${restSegment(i.eventId)}/${restQuery({ environment: i.environment })}`,
    input: z
      .object({
        organizationIdOrSlug: z.string().max(4_000),
        projectIdOrSlug: z.string().max(4_000),
        eventId: z.string().max(4_000),
        environment: SpecArray.optional(),
      })
      .strict(),
  },
  {
    action: "list-releases",
    name: "List Releases",
    description:
      "List releases for a Sentry organization or project. Returns release details including version, commits, deploy information, and associated projects.",
    method: "GET",
    url: (i) =>
      `/api/0/organizations/${restSegment(i.organizationIdOrSlug)}/releases/${restQuery({ project: i.project, environment: i.environment, query: i.query, per_page: i.perPage, cursor: i.cursor })}`,
    input: z
      .object({
        organizationIdOrSlug: z.string().max(4_000),
        project: SpecArray.optional(),
        environment: SpecArray.optional(),
        query: z.string().max(4_000).optional(),
        perPage: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        cursor: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-release",
    name: "Create Release",
    description:
      "Create a new release in Sentry. A release is a version of your code deployed to an environment. Can include commit information and associated projects. Returns the created release details.",
    method: "POST",
    url: (i) =>
      `/api/0/organizations/${restSegment(i.organizationIdOrSlug)}/releases/`,
    input: z
      .object({
        organizationIdOrSlug: z.string().max(4_000),
        version: z.string().max(4_000),
        projects: SpecArray,
        ref: z.string().max(4_000).optional(),
        url: z.string().max(4_000).optional(),
        dateReleased: z.string().max(4_000).optional(),
        commits: SpecArray.optional(),
        status: z.string().max(4_000).optional(),
        owner: z.string().max(4_000).optional(),
        headCommits: SpecArray.optional(),
        refs: SpecArray.optional(),
      })
      .strict(),
    body: (i) => ({
      version: i.version,
      projects: i.projects,
      ...(i.ref !== undefined ? { ref: i.ref } : {}),
      ...(i.url !== undefined ? { url: i.url } : {}),
      ...(i.dateReleased !== undefined ? { dateReleased: i.dateReleased } : {}),
      ...(i.commits !== undefined ? { commits: i.commits } : {}),
      ...(i.status !== undefined ? { status: i.status } : {}),
      ...(i.owner !== undefined ? { owner: i.owner } : {}),
      ...(i.headCommits !== undefined ? { headCommits: i.headCommits } : {}),
      ...(i.refs !== undefined ? { refs: i.refs } : {}),
    }),
  },
  {
    action: "create-deploy",
    name: "Create Deploy",
    description:
      "Create a deploy record for a Sentry release in a specific environment. Deploys track when and where releases are deployed. Returns the created deploy details.",
    method: "POST",
    url: (i) =>
      `/api/0/organizations/${restSegment(i.organizationIdOrSlug)}/releases/${restSegment(i.version)}/deploys/`,
    input: z
      .object({
        organizationIdOrSlug: z.string().max(4_000),
        version: z.string().max(4_000),
        environment: z.string().max(4_000),
        name: z.string().max(4_000).optional(),
        url: z.string().max(4_000).optional(),
        dateStarted: z.string().max(4_000).optional(),
        dateFinished: z.string().max(4_000).optional(),
        projects: SpecArray.optional(),
      })
      .strict(),
    body: (i) => ({
      environment: i.environment,
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.url !== undefined ? { url: i.url } : {}),
      ...(i.dateStarted !== undefined ? { dateStarted: i.dateStarted } : {}),
      ...(i.dateFinished !== undefined ? { dateFinished: i.dateFinished } : {}),
      ...(i.projects !== undefined ? { projects: i.projects } : {}),
    }),
  },
];

export function createSentryPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "sentry",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
  });
}
