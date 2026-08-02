import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

const NoSdkNote =
  "publishes no maintained first-party Node SDK for its management API; posthog-node is an ingestion client only, so the HTTP API is the supported surface for these actions.";

// ------------------------------------------------------------------ PostHog

/**
 * PostHog identifiers are integers on most resources and UUIDs on persons and
 * recordings, so both spellings pass. `restSegment` accepts either.
 */
const PostHogId = z.union([
  z.number().int().min(0),
  z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/u),
]);

const PostHogLimit = z.number().int().min(1).max(1_000).optional();
const PostHogOffset = z.number().int().min(0).max(1_000_000).optional();

/**
 * Every project-scoped route is the same prefix. PostHog is Django REST
 * Framework underneath, so the trailing slash is required — without it the
 * API answers a redirect rather than the resource.
 */
function projectPath(projectId: unknown, resource: string): string {
  return `/api/projects/${restSegment(projectId)}/${resource}/`;
}

const POSTHOG_ACTIONS: readonly RestAction<any>[] = [
  // ---------------------------------------------------------------- persons
  {
    action: "list-persons",
    name: "List Persons",
    description: "Lists the persons in a project.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "persons")}${restQuery({
        search: i.search,
        distinct_id: i.distinctId,
        email: i.email,
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        projectId: PostHogId,
        search: z.string().max(512).optional(),
        distinctId: z.string().max(512).optional(),
        email: z.string().max(320).optional(),
        limit: PostHogLimit,
        offset: PostHogOffset,
      })
      .strict(),
  },
  {
    action: "get-person",
    name: "Get Person",
    description: "Reads one person.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "persons")}${restSegment(i.personId)}/`,
    input: z.object({ projectId: PostHogId, personId: PostHogId }).strict(),
  },
  {
    action: "delete-person",
    name: "Delete Person",
    description: "Deletes a person, and optionally the events they produced.",
    method: "DELETE",
    url: (i) =>
      `${projectPath(i.projectId, "persons")}${restSegment(
        i.personId,
      )}/${restQuery({ delete_events: i.deleteEvents })}`,
    input: z
      .object({
        projectId: PostHogId,
        personId: PostHogId,
        // Explicit rather than implied: deleting the person's events is a
        // separate, irreversible consequence and must be asked for.
        deleteEvents: z.boolean().optional(),
      })
      .strict(),
    emptyResponse: "optional",
  },

  // ------------------------------------------------------------------ query
  {
    action: "run-query-hogql",
    name: "Run Query (HogQL)",
    description: "Runs a HogQL query against the project's data.",
    method: "POST",
    url: (i) => projectPath(i.projectId, "query"),
    input: z
      .object({
        projectId: PostHogId,
        query: z.string().min(1).max(100_000),
        // Named parameters, which is how a HogQL query avoids interpolation.
        values: z.record(z.string(), z.unknown()).optional(),
        refresh: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      query: {
        kind: "HogQLQuery",
        query: i.query,
        ...(i.values ? { values: i.values } : {}),
      },
      ...(i.refresh !== undefined ? { refresh: i.refresh } : {}),
    }),
    // A query result is larger than a config document; this is the lane's
    // ceiling, so a wider result set needs a LIMIT in the query itself.
    maxResponseBytes: 1024 * 1024,
  },

  // --------------------------------------------------------------- insights
  {
    action: "list-insights",
    name: "List Insights",
    description: "Lists the saved insights in a project.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "insights")}${restQuery({
        search: i.search,
        short_id: i.shortId,
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        projectId: PostHogId,
        search: z.string().max(512).optional(),
        shortId: z.string().max(64).optional(),
        limit: PostHogLimit,
        offset: PostHogOffset,
      })
      .strict(),
  },
  {
    action: "get-insight",
    name: "Get Insight",
    description: "Reads one saved insight.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "insights")}${restSegment(i.insightId)}/`,
    input: z.object({ projectId: PostHogId, insightId: PostHogId }).strict(),
  },
  {
    action: "create-insight",
    name: "Create Insight",
    description: "Saves a new insight.",
    method: "POST",
    url: (i) => projectPath(i.projectId, "insights"),
    input: z
      .object({
        projectId: PostHogId,
        name: z.string().min(1).max(512),
        // The query node's shape is PostHog's own schema union.
        query: z.record(z.string(), z.unknown()).optional(),
        description: z.string().max(4_000).optional(),
        favorited: z.boolean().optional(),
        tags: z.array(z.string().max(128)).max(64).optional(),
        dashboards: z.array(PostHogId).max(64).optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      ...(i.query ? { query: i.query } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.favorited !== undefined ? { favorited: i.favorited } : {}),
      ...(i.tags ? { tags: i.tags } : {}),
      ...(i.dashboards ? { dashboards: i.dashboards } : {}),
    }),
  },
  {
    action: "update-insight",
    name: "Update Insight",
    description: "Changes the supplied fields of a saved insight.",
    method: "PATCH",
    url: (i) =>
      `${projectPath(i.projectId, "insights")}${restSegment(i.insightId)}/`,
    input: z
      .object({
        projectId: PostHogId,
        insightId: PostHogId,
        name: z.string().min(1).max(512).optional(),
        query: z.record(z.string(), z.unknown()).optional(),
        description: z.string().max(4_000).optional(),
        favorited: z.boolean().optional(),
        tags: z.array(z.string().max(128)).max(64).optional(),
        dashboards: z.array(PostHogId).max(64).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.query ? { query: i.query } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.favorited !== undefined ? { favorited: i.favorited } : {}),
      ...(i.tags ? { tags: i.tags } : {}),
      ...(i.dashboards ? { dashboards: i.dashboards } : {}),
    }),
  },

  // ------------------------------------------------------------- dashboards
  {
    action: "list-dashboards",
    name: "List Dashboards",
    description: "Lists the dashboards in a project.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "dashboards")}${restQuery({
        search: i.search,
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        projectId: PostHogId,
        search: z.string().max(512).optional(),
        limit: PostHogLimit,
        offset: PostHogOffset,
      })
      .strict(),
  },
  {
    action: "get-dashboard",
    name: "Get Dashboard",
    description: "Reads one dashboard and its tiles.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "dashboards")}${restSegment(i.dashboardId)}/`,
    input: z.object({ projectId: PostHogId, dashboardId: PostHogId }).strict(),
  },
  {
    action: "create-dashboard",
    name: "Create Dashboard",
    description: "Creates a dashboard.",
    method: "POST",
    url: (i) => projectPath(i.projectId, "dashboards"),
    input: z
      .object({
        projectId: PostHogId,
        name: z.string().min(1).max(512),
        description: z.string().max(4_000).optional(),
        pinned: z.boolean().optional(),
        tags: z.array(z.string().max(128)).max(64).optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.pinned !== undefined ? { pinned: i.pinned } : {}),
      ...(i.tags ? { tags: i.tags } : {}),
    }),
  },

  // ---------------------------------------------------------------- actions
  {
    action: "list-actions",
    name: "List Actions",
    description: "Lists the actions defined in a project.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "actions")}${restQuery({
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        projectId: PostHogId,
        limit: PostHogLimit,
        offset: PostHogOffset,
      })
      .strict(),
  },

  // ---------------------------------------------------------------- cohorts
  {
    action: "list-cohorts",
    name: "List Cohorts",
    description: "Lists the cohorts in a project.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "cohorts")}${restQuery({
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        projectId: PostHogId,
        limit: PostHogLimit,
        offset: PostHogOffset,
      })
      .strict(),
  },
  {
    action: "get-cohort",
    name: "Get Cohort",
    description: "Reads one cohort.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "cohorts")}${restSegment(i.cohortId)}/`,
    input: z.object({ projectId: PostHogId, cohortId: PostHogId }).strict(),
  },
  {
    action: "create-cohort",
    name: "Create Cohort",
    description: "Creates a cohort from a filter definition.",
    method: "POST",
    url: (i) => projectPath(i.projectId, "cohorts"),
    input: z
      .object({
        projectId: PostHogId,
        name: z.string().min(1).max(512),
        // PostHog's own nested property-group grammar.
        filters: z.record(z.string(), z.unknown()).optional(),
        description: z.string().max(4_000).optional(),
        isStatic: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      ...(i.filters ? { filters: i.filters } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.isStatic !== undefined ? { is_static: i.isStatic } : {}),
    }),
  },
  {
    action: "update-cohort",
    name: "Update Cohort",
    description: "Changes the supplied fields of a cohort.",
    method: "PATCH",
    url: (i) =>
      `${projectPath(i.projectId, "cohorts")}${restSegment(i.cohortId)}/`,
    input: z
      .object({
        projectId: PostHogId,
        cohortId: PostHogId,
        name: z.string().min(1).max(512).optional(),
        filters: z.record(z.string(), z.unknown()).optional(),
        description: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.filters ? { filters: i.filters } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
    }),
  },

  // ------------------------------------------------------------ annotations
  {
    action: "list-annotations",
    name: "List Annotations",
    description: "Lists the annotations in a project.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "annotations")}${restQuery({
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        projectId: PostHogId,
        limit: PostHogLimit,
        offset: PostHogOffset,
      })
      .strict(),
  },
  {
    action: "create-annotation",
    name: "Create Annotation",
    description: "Adds an annotation at a point in time.",
    method: "POST",
    url: (i) => projectPath(i.projectId, "annotations"),
    input: z
      .object({
        projectId: PostHogId,
        content: z.string().min(1).max(4_000),
        dateMarker: z.string().max(64).optional(),
        scope: z.enum(["dashboard_item", "project", "organization"]).optional(),
        dashboardItem: PostHogId.optional(),
      })
      .strict(),
    body: (i) => ({
      content: i.content,
      ...(i.dateMarker !== undefined ? { date_marker: i.dateMarker } : {}),
      ...(i.scope !== undefined ? { scope: i.scope } : {}),
      ...(i.dashboardItem !== undefined
        ? { dashboard_item: i.dashboardItem }
        : {}),
    }),
  },

  // ---------------------------------------------------------- feature flags
  {
    action: "list-feature-flags",
    name: "List Feature Flags",
    description: "Lists the feature flags in a project.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "feature_flags")}${restQuery({
        search: i.search,
        active: i.active,
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        projectId: PostHogId,
        search: z.string().max(512).optional(),
        active: z.boolean().optional(),
        limit: PostHogLimit,
        offset: PostHogOffset,
      })
      .strict(),
  },
  {
    action: "get-feature-flag",
    name: "Get Feature Flag",
    description: "Reads one feature flag.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "feature_flags")}${restSegment(i.flagId)}/`,
    input: z.object({ projectId: PostHogId, flagId: PostHogId }).strict(),
  },
  {
    action: "create-feature-flag",
    name: "Create Feature Flag",
    description: "Creates a feature flag.",
    method: "POST",
    url: (i) => projectPath(i.projectId, "feature_flags"),
    input: z
      .object({
        projectId: PostHogId,
        key: z.string().min(1).max(256),
        name: z.string().max(512).optional(),
        // PostHog's release-condition grammar: { groups: [...] }.
        filters: z.record(z.string(), z.unknown()).optional(),
        // A new flag is inactive unless the caller says otherwise, so an
        // omitted argument cannot switch a flag on for every user.
        active: z.boolean().optional(),
        ensureExperienceContinuity: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      key: i.key,
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.filters ? { filters: i.filters } : {}),
      active: i.active ?? false,
      ...(i.ensureExperienceContinuity !== undefined
        ? { ensure_experience_continuity: i.ensureExperienceContinuity }
        : {}),
    }),
  },
  {
    action: "update-feature-flag",
    name: "Update Feature Flag",
    description: "Changes the supplied fields of a feature flag.",
    method: "PATCH",
    url: (i) =>
      `${projectPath(i.projectId, "feature_flags")}${restSegment(i.flagId)}/`,
    input: z
      .object({
        projectId: PostHogId,
        flagId: PostHogId,
        key: z.string().min(1).max(256).optional(),
        name: z.string().max(512).optional(),
        filters: z.record(z.string(), z.unknown()).optional(),
        active: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.key !== undefined ? { key: i.key } : {}),
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.filters ? { filters: i.filters } : {}),
      ...(i.active !== undefined ? { active: i.active } : {}),
    }),
  },

  // ------------------------------------------------------------ experiments
  {
    action: "list-experiments",
    name: "List Experiments",
    description: "Lists the experiments in a project.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "experiments")}${restQuery({
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        projectId: PostHogId,
        limit: PostHogLimit,
        offset: PostHogOffset,
      })
      .strict(),
  },
  {
    action: "get-experiment",
    name: "Get Experiment",
    description: "Reads one experiment.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "experiments")}${restSegment(
        i.experimentId,
      )}/`,
    input: z.object({ projectId: PostHogId, experimentId: PostHogId }).strict(),
  },
  {
    action: "create-experiment",
    name: "Create Experiment",
    description: "Creates an experiment over a feature flag.",
    method: "POST",
    url: (i) => projectPath(i.projectId, "experiments"),
    input: z
      .object({
        projectId: PostHogId,
        name: z.string().min(1).max(512),
        featureFlagKey: z.string().min(1).max(256),
        description: z.string().max(4_000).optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
        filters: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      feature_flag_key: i.featureFlagKey,
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.parameters ? { parameters: i.parameters } : {}),
      ...(i.filters ? { filters: i.filters } : {}),
    }),
  },
  {
    action: "update-experiment",
    name: "Update Experiment",
    description: "Changes the supplied fields of an experiment.",
    method: "PATCH",
    url: (i) =>
      `${projectPath(i.projectId, "experiments")}${restSegment(
        i.experimentId,
      )}/`,
    input: z
      .object({
        projectId: PostHogId,
        experimentId: PostHogId,
        name: z.string().min(1).max(512).optional(),
        description: z.string().max(4_000).optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
        filters: z.record(z.string(), z.unknown()).optional(),
        // Setting the end date is how an experiment is concluded.
        endDate: z.string().max(64).optional(),
        archived: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.parameters ? { parameters: i.parameters } : {}),
      ...(i.filters ? { filters: i.filters } : {}),
      ...(i.endDate !== undefined ? { end_date: i.endDate } : {}),
      ...(i.archived !== undefined ? { archived: i.archived } : {}),
    }),
  },

  // ---------------------------------------------------------------- surveys
  {
    action: "list-surveys",
    name: "List Surveys",
    description: "Lists the surveys in a project.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "surveys")}${restQuery({
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        projectId: PostHogId,
        limit: PostHogLimit,
        offset: PostHogOffset,
      })
      .strict(),
  },
  {
    action: "get-survey",
    name: "Get Survey",
    description: "Reads one survey.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "surveys")}${restSegment(i.surveyId)}/`,
    input: z.object({ projectId: PostHogId, surveyId: PostHogId }).strict(),
  },
  {
    action: "create-survey",
    name: "Create Survey",
    description: "Creates a survey.",
    method: "POST",
    url: (i) => projectPath(i.projectId, "surveys"),
    input: z
      .object({
        projectId: PostHogId,
        name: z.string().min(1).max(512),
        type: z.enum(["popover", "widget", "api", "external_survey"]),
        questions: z.array(z.record(z.string(), z.unknown())).max(64),
        description: z.string().max(4_000).optional(),
        conditions: z.record(z.string(), z.unknown()).optional(),
        linkedFlagId: PostHogId.optional(),
        targetingFlagFilters: z.record(z.string(), z.unknown()).optional(),
        // A survey is a draft until it carries a start date, so shipping one
        // to real users has to be asked for rather than defaulted into.
        startDate: z.string().max(64).optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      type: i.type,
      questions: i.questions,
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.conditions ? { conditions: i.conditions } : {}),
      ...(i.linkedFlagId !== undefined
        ? { linked_flag_id: i.linkedFlagId }
        : {}),
      ...(i.targetingFlagFilters
        ? { targeting_flag_filters: i.targetingFlagFilters }
        : {}),
      ...(i.startDate !== undefined ? { start_date: i.startDate } : {}),
    }),
  },
  {
    action: "update-survey",
    name: "Update Survey",
    description: "Changes the supplied fields of a survey.",
    method: "PATCH",
    url: (i) =>
      `${projectPath(i.projectId, "surveys")}${restSegment(i.surveyId)}/`,
    input: z
      .object({
        projectId: PostHogId,
        surveyId: PostHogId,
        name: z.string().min(1).max(512).optional(),
        description: z.string().max(4_000).optional(),
        questions: z
          .array(z.record(z.string(), z.unknown()))
          .max(64)
          .optional(),
        conditions: z.record(z.string(), z.unknown()).optional(),
        startDate: z.string().max(64).optional(),
        // Setting the end date is how a running survey is stopped.
        endDate: z.string().max(64).optional(),
        archived: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.questions ? { questions: i.questions } : {}),
      ...(i.conditions ? { conditions: i.conditions } : {}),
      ...(i.startDate !== undefined ? { start_date: i.startDate } : {}),
      ...(i.endDate !== undefined ? { end_date: i.endDate } : {}),
      ...(i.archived !== undefined ? { archived: i.archived } : {}),
    }),
  },

  // ------------------------------------------------------ session recordings
  {
    action: "list-session-recordings",
    name: "List Session Recordings",
    description: "Lists session recordings in a project.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "session_recordings")}${restQuery({
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        projectId: PostHogId,
        limit: PostHogLimit,
        offset: PostHogOffset,
      })
      .strict(),
  },
  {
    action: "get-session-recording",
    name: "Get Session Recording",
    description: "Reads one session recording's metadata.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "session_recordings")}${restSegment(
        i.recordingId,
      )}/`,
    input: z.object({ projectId: PostHogId, recordingId: PostHogId }).strict(),
  },
  {
    action: "list-recording-playlists",
    name: "List Recording Playlists",
    description: "Lists session recording playlists in a project.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "session_recording_playlists")}${restQuery({
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        projectId: PostHogId,
        limit: PostHogLimit,
        offset: PostHogOffset,
      })
      .strict(),
  },

  // ------------------------------------------------------------ definitions
  {
    action: "list-event-definitions",
    name: "List Event Definitions",
    description: "Lists the event definitions in a project.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "event_definitions")}${restQuery({
        search: i.search,
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        projectId: PostHogId,
        search: z.string().max(512).optional(),
        limit: PostHogLimit,
        offset: PostHogOffset,
      })
      .strict(),
  },
  {
    action: "get-event-definition",
    name: "Get Event Definition",
    description: "Reads one event definition.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "event_definitions")}${restSegment(
        i.definitionId,
      )}/`,
    input: z.object({ projectId: PostHogId, definitionId: PostHogId }).strict(),
  },
  {
    action: "update-event-definition",
    name: "Update Event Definition",
    description: "Changes an event definition's description or tags.",
    method: "PATCH",
    url: (i) =>
      `${projectPath(i.projectId, "event_definitions")}${restSegment(
        i.definitionId,
      )}/`,
    input: z
      .object({
        projectId: PostHogId,
        definitionId: PostHogId,
        description: z.string().max(4_000).optional(),
        tags: z.array(z.string().max(128)).max(64).optional(),
        verified: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.tags ? { tags: i.tags } : {}),
      ...(i.verified !== undefined ? { verified: i.verified } : {}),
    }),
  },
  {
    action: "list-property-definitions",
    name: "List Property Definitions",
    description: "Lists the property definitions in a project.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "property_definitions")}${restQuery({
        search: i.search,
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        projectId: PostHogId,
        search: z.string().max(512).optional(),
        limit: PostHogLimit,
        offset: PostHogOffset,
      })
      .strict(),
  },
  {
    action: "get-property-definition",
    name: "Get Property Definition",
    description: "Reads one property definition.",
    method: "GET",
    url: (i) =>
      `${projectPath(i.projectId, "property_definitions")}${restSegment(
        i.definitionId,
      )}/`,
    input: z.object({ projectId: PostHogId, definitionId: PostHogId }).strict(),
  },
  {
    action: "update-property-definition",
    name: "Update Property Definition",
    description: "Changes a property definition's description or tags.",
    method: "PATCH",
    url: (i) =>
      `${projectPath(i.projectId, "property_definitions")}${restSegment(
        i.definitionId,
      )}/`,
    input: z
      .object({
        projectId: PostHogId,
        definitionId: PostHogId,
        description: z.string().max(4_000).optional(),
        tags: z.array(z.string().max(128)).max(64).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.tags ? { tags: i.tags } : {}),
    }),
  },

  // ------------------------------------------------ projects, organizations
  {
    action: "list-projects",
    name: "List Projects",
    description: "Lists the projects the credential can reach.",
    method: "GET",
    url: "/api/projects/",
    input: z.object({}).strict(),
  },
  {
    action: "get-project",
    name: "Get Project",
    description: "Reads one project.",
    method: "GET",
    url: (i) => `/api/projects/${restSegment(i.projectId)}/`,
    input: z.object({ projectId: PostHogId }).strict(),
  },
  {
    action: "list-organizations",
    name: "List Organizations",
    description: "Lists the organizations the credential can reach.",
    method: "GET",
    url: "/api/organizations/",
    input: z.object({}).strict(),
  },
  {
    action: "get-organization",
    name: "Get Organization",
    description: "Reads one organization.",
    method: "GET",
    url: (i) => `/api/organizations/${restSegment(i.organizationId)}/`,
    input: z.object({ organizationId: PostHogId }).strict(),
  },
];

export function createPostHogPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "posthog",
    sdkReview: `PostHog ${NoSdkNote}`,
    transportKind: "api_key",
    actions: POSTHOG_ACTIONS,
    deferrals: {
      "capture-event":
        "Ingestion lives on us.i.posthog.com and authenticates with the project API key rather than the personal API key this connection holds; this lane resolves every action against one host with one credential.",
      "batch-events":
        "Ingestion lives on us.i.posthog.com and authenticates with the project API key rather than the personal API key this connection holds; this lane resolves every action against one host with one credential.",
      "evaluate-flags":
        "Flag evaluation is served by the ingestion host with the project API key, not by the management API this connection authenticates against.",
      "delete-feature-flag":
        "PostHog soft-deletes feature flags, and it is not settled here whether the supported spelling is DELETE on the detail route or a PATCH setting deleted. Left unmapped rather than guessed, because a wrong verb here would report as executable while silently not deleting.",
      "delete-survey":
        "Same soft-delete question as feature flags: unverified whether DELETE on the detail route is served or whether archival via PATCH is the supported path.",
    },
  });
}
