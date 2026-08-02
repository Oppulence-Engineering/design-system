import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Mapped from incident.io's published Swagger 2.0 document at
 * https://api.incident.io/v1/openapi.json — paths, methods, required fields,
 * and enums below are the vendor's own, not recalled.
 *
 * The document mixes v1 and v2 paths. v2 is used wherever it exists; the three
 * configuration lists that only ship a v1 path say so at the action.
 */
const SpecNote =
  "incident.io publishes no maintained Node SDK, and its Swagger 2.0 document is the supported description of the HTTP API.";

/** Every incident.io identifier is an opaque ULID-style string. */
const IncidentIoId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/u);

/** The spec's page_size/after keyset pagination, shared by the list actions. */
const PageSize = z.number().int().min(1).max(250).optional();
const After = IncidentIoId.optional();

/** An RFC3339 timestamp, as every date field in this spec is. */
const Timestamp = z.string().min(1).max(64);

/** Free-form only where the spec's own schema is a nested vendor grammar. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecObjectArray = z.array(SpecObject).max(200);

const INCIDENT_IO_ACTIONS: readonly RestAction<any>[] = [
  // -------------------------------------------------------------- incidents
  {
    action: "list-incidents",
    name: "List Incidents",
    description: "Lists incidents, newest first.",
    method: "GET",
    url: (i) =>
      `/v2/incidents${restQuery({ page_size: i.pageSize, after: i.after })}`,
    // The spec's other filters are map-typed (status[one_of][]=…), a nested
    // grammar this lane's flat query builder cannot express, so only the
    // documented pagination is offered here.
    input: z.object({ pageSize: PageSize, after: After }).strict(),
  },
  {
    action: "show-incident",
    name: "Show Incident",
    description: "Reads one incident.",
    method: "GET",
    url: (i) => `/v2/incidents/${restSegment(i.incidentId)}`,
    input: z.object({ incidentId: IncidentIoId }).strict(),
  },
  {
    action: "create-incident",
    name: "Create Incident",
    description: "Declares an incident.",
    method: "POST",
    url: "/v2/incidents",
    input: z
      .object({
        // Both required by the spec. The idempotency key is what stops a
        // retried call declaring a second incident.
        idempotencyKey: z.string().min(1).max(256),
        visibility: z.enum(["public", "private"]),
        name: z.string().max(2_048).optional(),
        summary: z.string().max(10_000).optional(),
        mode: z
          .enum(["standard", "retrospective", "test", "tutorial"])
          .optional(),
        severityId: IncidentIoId.optional(),
        incidentTypeId: IncidentIoId.optional(),
        incidentStatusId: IncidentIoId.optional(),
        slackTeamId: z.string().max(64).optional(),
        slackChannelNameOverride: z.string().max(80).optional(),
        customFieldEntries: SpecObjectArray.optional(),
        incidentRoleAssignments: SpecObjectArray.optional(),
        incidentTimestampValues: SpecObjectArray.optional(),
      })
      .strict(),
    body: (i) => ({
      idempotency_key: i.idempotencyKey,
      visibility: i.visibility,
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.summary !== undefined ? { summary: i.summary } : {}),
      ...(i.mode !== undefined ? { mode: i.mode } : {}),
      ...(i.severityId !== undefined ? { severity_id: i.severityId } : {}),
      ...(i.incidentTypeId !== undefined
        ? { incident_type_id: i.incidentTypeId }
        : {}),
      ...(i.incidentStatusId !== undefined
        ? { incident_status_id: i.incidentStatusId }
        : {}),
      ...(i.slackTeamId !== undefined ? { slack_team_id: i.slackTeamId } : {}),
      ...(i.slackChannelNameOverride !== undefined
        ? { slack_channel_name_override: i.slackChannelNameOverride }
        : {}),
      ...(i.customFieldEntries
        ? { custom_field_entries: i.customFieldEntries }
        : {}),
      ...(i.incidentRoleAssignments
        ? { incident_role_assignments: i.incidentRoleAssignments }
        : {}),
      ...(i.incidentTimestampValues
        ? { incident_timestamp_values: i.incidentTimestampValues }
        : {}),
    }),
  },
  {
    action: "update-incident",
    name: "Update Incident",
    description: "Edits an incident's fields.",
    method: "POST",
    // Not a PUT on the resource: the spec spells the edit as an action path.
    url: (i) => `/v2/incidents/${restSegment(i.incidentId)}/actions/edit`,
    input: z
      .object({
        incidentId: IncidentIoId,
        incident: SpecObject,
        // Required by the spec, so whether the channel is notified is stated
        // rather than defaulted.
        notifyIncidentChannel: z.boolean(),
      })
      .strict(),
    body: (i) => ({
      incident: i.incident,
      notify_incident_channel: i.notifyIncidentChannel,
    }),
  },
  {
    action: "list-incident-updates",
    name: "List Incident Updates",
    description: "Lists the updates posted against incidents.",
    method: "GET",
    url: (i) =>
      `/v2/incident_updates${restQuery({
        incident_id: i.incidentId,
        page_size: i.pageSize,
        after: i.after,
      })}`,
    input: z
      .object({
        incidentId: IncidentIoId.optional(),
        pageSize: PageSize,
        after: After,
      })
      .strict(),
  },

  // ---------------------------------------------------- actions, follow-ups
  {
    action: "list-actions",
    name: "List Actions",
    description: "Lists incident actions.",
    method: "GET",
    url: (i) =>
      `/v2/actions${restQuery({
        incident_id: i.incidentId,
        incident_mode: i.incidentMode,
      })}`,
    input: z
      .object({
        incidentId: IncidentIoId.optional(),
        incidentMode: z
          .enum(["standard", "retrospective", "test", "tutorial"])
          .optional(),
      })
      .strict(),
  },
  {
    action: "show-action",
    name: "Show Action",
    description: "Reads one incident action.",
    method: "GET",
    url: (i) => `/v2/actions/${restSegment(i.actionId)}`,
    input: z.object({ actionId: IncidentIoId }).strict(),
  },
  {
    action: "list-follow-ups",
    name: "List Follow-ups",
    description: "Lists incident follow-ups.",
    method: "GET",
    url: (i) =>
      `/v2/follow_ups${restQuery({
        incident_id: i.incidentId,
        incident_mode: i.incidentMode,
      })}`,
    input: z
      .object({
        incidentId: IncidentIoId.optional(),
        incidentMode: z
          .enum(["standard", "retrospective", "test", "tutorial"])
          .optional(),
      })
      .strict(),
  },
  {
    action: "show-follow-up",
    name: "Show Follow-up",
    description: "Reads one follow-up.",
    method: "GET",
    url: (i) => `/v2/follow_ups/${restSegment(i.followUpId)}`,
    input: z.object({ followUpId: IncidentIoId }).strict(),
  },

  // ------------------------------------------------------------------ users
  {
    action: "list-users",
    name: "List Users",
    description: "Lists users, optionally by email or Slack ID.",
    method: "GET",
    url: (i) =>
      `/v2/users${restQuery({
        email: i.email,
        slack_user_id: i.slackUserId,
        page_size: i.pageSize,
        after: i.after,
      })}`,
    input: z
      .object({
        email: z.string().email().max(320).optional(),
        slackUserId: z.string().max(64).optional(),
        pageSize: PageSize,
        after: After,
      })
      .strict(),
  },
  {
    action: "show-user",
    name: "Show User",
    description: "Reads one user.",
    method: "GET",
    url: (i) => `/v2/users/${restSegment(i.userId)}`,
    input: z.object({ userId: IncidentIoId }).strict(),
  },

  // -------------------------------------------------------------- workflows
  {
    action: "list-workflows",
    name: "List Workflows",
    description: "Lists workflows.",
    method: "GET",
    url: "/v2/workflows",
    input: z.object({}).strict(),
  },
  {
    action: "show-workflow",
    name: "Show Workflow",
    description: "Reads one workflow.",
    method: "GET",
    url: (i) => `/v2/workflows/${restSegment(i.workflowId)}`,
    input: z.object({ workflowId: IncidentIoId }).strict(),
  },
  {
    action: "create-workflow",
    name: "Create Workflow",
    description: "Creates a workflow.",
    method: "POST",
    url: "/v2/workflows",
    // The spec marks all of these required, including the booleans: a workflow
    // cannot be created with its blast radius left implicit.
    input: z
      .object({
        name: z.string().min(1).max(512),
        trigger: z.string().min(1).max(128),
        onceFor: z.array(z.string().max(256)).max(64),
        conditionGroups: SpecObjectArray,
        steps: SpecObjectArray,
        expressions: SpecObjectArray,
        includePrivateIncidents: z.boolean(),
        continueOnStepError: z.boolean(),
        runsOnIncidents: z.string().min(1).max(64),
        runsOnIncidentModes: z.array(z.string().max(64)).max(16),
        state: z.string().max(64).optional(),
        folder: z.string().max(256).optional(),
        shortform: z.string().max(256).optional(),
        delay: SpecObject.optional(),
        annotations: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      trigger: i.trigger,
      once_for: i.onceFor,
      condition_groups: i.conditionGroups,
      steps: i.steps,
      expressions: i.expressions,
      include_private_incidents: i.includePrivateIncidents,
      continue_on_step_error: i.continueOnStepError,
      runs_on_incidents: i.runsOnIncidents,
      runs_on_incident_modes: i.runsOnIncidentModes,
      ...(i.state !== undefined ? { state: i.state } : {}),
      ...(i.folder !== undefined ? { folder: i.folder } : {}),
      ...(i.shortform !== undefined ? { shortform: i.shortform } : {}),
      ...(i.delay ? { delay: i.delay } : {}),
      ...(i.annotations ? { annotations: i.annotations } : {}),
    }),
  },
  {
    action: "update-workflow",
    name: "Update Workflow",
    description: "Replaces a workflow's definition.",
    method: "PUT",
    url: (i) => `/v2/workflows/${restSegment(i.workflowId)}`,
    // A PUT: the spec requires the whole definition, so a partial call would
    // silently drop the fields it omits.
    input: z
      .object({
        workflowId: IncidentIoId,
        name: z.string().min(1).max(512),
        onceFor: z.array(z.string().max(256)).max(64),
        conditionGroups: SpecObjectArray,
        steps: SpecObjectArray,
        expressions: SpecObjectArray,
        includePrivateIncidents: z.boolean(),
        continueOnStepError: z.boolean(),
        runsOnIncidents: z.string().min(1).max(64),
        runsOnIncidentModes: z.array(z.string().max(64)).max(16),
        state: z.string().max(64).optional(),
        folder: z.string().max(256).optional(),
        shortform: z.string().max(256).optional(),
        delay: SpecObject.optional(),
        annotations: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      once_for: i.onceFor,
      condition_groups: i.conditionGroups,
      steps: i.steps,
      expressions: i.expressions,
      include_private_incidents: i.includePrivateIncidents,
      continue_on_step_error: i.continueOnStepError,
      runs_on_incidents: i.runsOnIncidents,
      runs_on_incident_modes: i.runsOnIncidentModes,
      ...(i.state !== undefined ? { state: i.state } : {}),
      ...(i.folder !== undefined ? { folder: i.folder } : {}),
      ...(i.shortform !== undefined ? { shortform: i.shortform } : {}),
      ...(i.delay ? { delay: i.delay } : {}),
      ...(i.annotations ? { annotations: i.annotations } : {}),
    }),
  },
  {
    action: "delete-workflow",
    name: "Delete Workflow",
    description: "Deletes one workflow.",
    method: "DELETE",
    url: (i) => `/v2/workflows/${restSegment(i.workflowId)}`,
    input: z.object({ workflowId: IncidentIoId }).strict(),
    emptyResponse: "optional",
  },

  // -------------------------------------------------------------- schedules
  {
    action: "list-schedules",
    name: "List Schedules",
    description: "Lists on-call schedules.",
    method: "GET",
    url: (i) =>
      `/v2/schedules${restQuery({ page_size: i.pageSize, after: i.after })}`,
    input: z.object({ pageSize: PageSize, after: After }).strict(),
  },
  {
    action: "show-schedule",
    name: "Show Schedule",
    description: "Reads one schedule.",
    method: "GET",
    url: (i) => `/v2/schedules/${restSegment(i.scheduleId)}`,
    input: z.object({ scheduleId: IncidentIoId }).strict(),
  },
  {
    action: "create-schedule",
    name: "Create Schedule",
    description: "Creates an on-call schedule.",
    method: "POST",
    url: "/v2/schedules",
    input: z.object({ schedule: SpecObject }).strict(),
    body: (i) => ({ schedule: i.schedule }),
  },
  {
    action: "update-schedule",
    name: "Update Schedule",
    description: "Replaces a schedule's definition.",
    method: "PUT",
    url: (i) => `/v2/schedules/${restSegment(i.scheduleId)}`,
    input: z
      .object({ scheduleId: IncidentIoId, schedule: SpecObject })
      .strict(),
    body: (i) => ({ schedule: i.schedule }),
  },
  {
    action: "delete-schedule",
    name: "Delete Schedule",
    description: "Deletes one schedule.",
    method: "DELETE",
    url: (i) => `/v2/schedules/${restSegment(i.scheduleId)}`,
    input: z.object({ scheduleId: IncidentIoId }).strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-schedule-entries",
    name: "List Schedule Entries",
    description: "Lists who is on call for a schedule over a window.",
    method: "GET",
    url: (i) =>
      `/v2/schedule_entries${restQuery({
        schedule_id: i.scheduleId,
        entry_window_start: i.entryWindowStart,
        entry_window_end: i.entryWindowEnd,
      })}`,
    // schedule_id is the one query parameter the spec marks required.
    input: z
      .object({
        scheduleId: IncidentIoId,
        entryWindowStart: Timestamp.optional(),
        entryWindowEnd: Timestamp.optional(),
      })
      .strict(),
  },
  {
    action: "create-schedule-override",
    name: "Create Schedule Override",
    description: "Overrides who is on call for part of a schedule.",
    method: "POST",
    url: "/v2/schedule_overrides",
    input: z
      .object({
        scheduleId: IncidentIoId,
        rotationId: IncidentIoId,
        layerId: IncidentIoId,
        user: SpecObject,
        startAt: Timestamp,
        endAt: Timestamp,
      })
      .strict(),
    body: (i) => ({
      schedule_id: i.scheduleId,
      rotation_id: i.rotationId,
      layer_id: i.layerId,
      user: i.user,
      start_at: i.startAt,
      end_at: i.endAt,
    }),
  },

  // -------------------------------------------------------- escalation paths
  {
    action: "create-escalation-path",
    name: "Create Escalation Path",
    description: "Creates an escalation path.",
    method: "POST",
    url: "/v2/escalation_paths",
    input: z
      .object({
        name: z.string().min(1).max(512),
        path: SpecObjectArray,
        workingHours: SpecObjectArray.optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      path: i.path,
      ...(i.workingHours ? { working_hours: i.workingHours } : {}),
    }),
  },
  {
    action: "show-escalation-path",
    name: "Show Escalation Path",
    description: "Reads one escalation path.",
    method: "GET",
    url: (i) => `/v2/escalation_paths/${restSegment(i.escalationPathId)}`,
    input: z.object({ escalationPathId: IncidentIoId }).strict(),
  },
  {
    action: "update-escalation-path",
    name: "Update Escalation Path",
    description: "Replaces an escalation path's definition.",
    method: "PUT",
    url: (i) => `/v2/escalation_paths/${restSegment(i.escalationPathId)}`,
    input: z
      .object({
        escalationPathId: IncidentIoId,
        name: z.string().min(1).max(512),
        path: SpecObjectArray,
        workingHours: SpecObjectArray.optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      path: i.path,
      ...(i.workingHours ? { working_hours: i.workingHours } : {}),
    }),
  },
  {
    action: "delete-escalation-path",
    name: "Delete Escalation Path",
    description: "Deletes one escalation path.",
    method: "DELETE",
    url: (i) => `/v2/escalation_paths/${restSegment(i.escalationPathId)}`,
    input: z.object({ escalationPathId: IncidentIoId }).strict(),
    emptyResponse: "optional",
  },

  // ----------------------------------------------------------- custom fields
  {
    action: "list-custom-fields",
    name: "List Custom Fields",
    description: "Lists the custom fields defined on incidents.",
    method: "GET",
    url: "/v2/custom_fields",
    input: z.object({}).strict(),
  },
  {
    action: "show-custom-field",
    name: "Show Custom Field",
    description: "Reads one custom field.",
    method: "GET",
    url: (i) => `/v2/custom_fields/${restSegment(i.customFieldId)}`,
    input: z.object({ customFieldId: IncidentIoId }).strict(),
  },
  {
    action: "create-custom-field",
    name: "Create Custom Field",
    description: "Defines a custom field.",
    method: "POST",
    url: "/v2/custom_fields",
    input: z
      .object({
        name: z.string().min(1).max(256),
        description: z.string().max(2_048),
        fieldType: z.string().min(1).max(64),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      description: i.description,
      field_type: i.fieldType,
    }),
  },
  {
    action: "update-custom-field",
    name: "Update Custom Field",
    description: "Renames a custom field or changes its description.",
    method: "PUT",
    url: (i) => `/v2/custom_fields/${restSegment(i.customFieldId)}`,
    input: z
      .object({
        customFieldId: IncidentIoId,
        name: z.string().min(1).max(256),
        description: z.string().max(2_048),
      })
      .strict(),
    body: (i) => ({ name: i.name, description: i.description }),
  },
  {
    action: "delete-custom-field",
    name: "Delete Custom Field",
    description: "Deletes one custom field.",
    method: "DELETE",
    url: (i) => `/v2/custom_fields/${restSegment(i.customFieldId)}`,
    input: z.object({ customFieldId: IncidentIoId }).strict(),
    emptyResponse: "optional",
  },

  // ---------------------------------------------------------- incident roles
  {
    action: "list-incident-roles",
    name: "List Incident Roles",
    description: "Lists incident roles.",
    method: "GET",
    url: "/v2/incident_roles",
    input: z.object({}).strict(),
  },
  {
    action: "show-incident-role",
    name: "Show Incident Role",
    description: "Reads one incident role.",
    method: "GET",
    url: (i) => `/v2/incident_roles/${restSegment(i.incidentRoleId)}`,
    input: z.object({ incidentRoleId: IncidentIoId }).strict(),
  },
  {
    action: "create-incident-role",
    name: "Create Incident Role",
    description: "Defines an incident role.",
    method: "POST",
    url: "/v2/incident_roles",
    input: z
      .object({
        name: z.string().min(1).max(256),
        shortform: z.string().min(1).max(64),
        description: z.string().max(2_048),
        instructions: z.string().max(4_000),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      shortform: i.shortform,
      description: i.description,
      instructions: i.instructions,
    }),
  },
  {
    action: "update-incident-role",
    name: "Update Incident Role",
    description: "Replaces an incident role's definition.",
    method: "PUT",
    url: (i) => `/v2/incident_roles/${restSegment(i.incidentRoleId)}`,
    input: z
      .object({
        incidentRoleId: IncidentIoId,
        name: z.string().min(1).max(256),
        shortform: z.string().min(1).max(64),
        description: z.string().max(2_048),
        instructions: z.string().max(4_000),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      shortform: i.shortform,
      description: i.description,
      instructions: i.instructions,
    }),
  },
  {
    action: "delete-incident-role",
    name: "Delete Incident Role",
    description: "Deletes one incident role.",
    method: "DELETE",
    url: (i) => `/v2/incident_roles/${restSegment(i.incidentRoleId)}`,
    input: z.object({ incidentRoleId: IncidentIoId }).strict(),
    emptyResponse: "optional",
  },

  // ------------------------------------------------------------- timestamps
  {
    action: "list-incident-timestamps",
    name: "List Incident Timestamps",
    description: "Lists the timestamps recorded against incidents.",
    method: "GET",
    url: "/v2/incident_timestamps",
    input: z.object({}).strict(),
  },
  {
    action: "show-incident-timestamp",
    name: "Show Incident Timestamp",
    description: "Reads one incident timestamp.",
    method: "GET",
    url: (i) => `/v2/incident_timestamps/${restSegment(i.timestampId)}`,
    input: z.object({ timestampId: IncidentIoId }).strict(),
  },

  // ----------------------------------------------------- v1-only catalogues
  {
    // The spec ships no v2 path for these three, so v1 is the current one.
    action: "list-severities",
    name: "List Severities",
    description: "Lists the configured severities.",
    method: "GET",
    url: "/v1/severities",
    input: z.object({}).strict(),
  },
  {
    action: "list-incident-statuses",
    name: "List Incident Statuses",
    description: "Lists the configured incident statuses.",
    method: "GET",
    url: "/v1/incident_statuses",
    input: z.object({}).strict(),
  },
  {
    action: "list-incident-types",
    name: "List Incident Types",
    description: "Lists the configured incident types.",
    method: "GET",
    url: "/v1/incident_types",
    input: z.object({}).strict(),
  },
];

export function createIncidentIoPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "incident-io",
    sdkReview: SpecNote,
    transportKind: "api_key",
    actions: INCIDENT_IO_ACTIONS,
    deferrals: {
      "list-escalations":
        "The published Swagger document declares no /escalations path; only escalation_paths exists. Mapping one would mean inventing a route the vendor's own description does not contain.",
      "create-escalation":
        "The published Swagger document declares no /escalations path; only escalation_paths exists.",
      "show-escalation":
        "The published Swagger document declares no /escalations path; only escalation_paths exists.",
      "list-escalation-paths":
        "The published Swagger document declares create, show, update, and destroy for escalation_paths but no list path.",
    },
  });
}
