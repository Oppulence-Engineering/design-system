import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  RestEmailSchema,
  type RestAction,
} from "../shared/rest";

const NoSdkNote =
  "publishes no maintained first-party Node SDK; its HTTP API is the supported integration surface.";

// ---------------------------------------------------------------- PagerDuty

const PagerDutyId = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[A-Z0-9]+$/u);

/** Every PagerDuty write needs the acting user's email in a header. */
function fromHeader(i: { from?: string }): Record<string, string> {
  return i.from ? { From: i.from } : {};
}

const PAGERDUTY_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-incidents",
    name: "List Incidents",
    description: "Lists incidents, optionally filtered.",
    method: "GET",
    url: (i) =>
      `/incidents${restQuery({
        statuses: i.statuses,
        "service_ids[]": i.serviceIds,
        urgencies: i.urgencies,
        since: i.since,
        until: i.until,
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        statuses: z
          .array(z.enum(["triggered", "acknowledged", "resolved"]))
          .max(3)
          .optional(),
        serviceIds: z.array(PagerDutyId).max(50).optional(),
        urgencies: z
          .array(z.enum(["high", "low"]))
          .max(2)
          .optional(),
        since: z.string().max(64).optional(),
        until: z.string().max(64).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .strict(),
  },
  {
    action: "get-incident",
    name: "Get Incident",
    description: "Reads one incident.",
    method: "GET",
    url: (i) => `/incidents/${restSegment(i.incidentId)}`,
    input: z.object({ incidentId: PagerDutyId }).strict(),
  },
  {
    action: "create-incident",
    name: "Create Incident",
    description: "Creates an incident on a service.",
    method: "POST",
    url: "/incidents",
    input: z
      .object({
        from: RestEmailSchema,
        serviceId: PagerDutyId,
        title: z.string().min(1).max(1_024),
        urgency: z.enum(["high", "low"]).optional(),
        body: z.string().max(10_000).optional(),
        escalationPolicyId: PagerDutyId.optional(),
      })
      .strict(),
    body: (i) => ({
      incident: {
        type: "incident",
        title: i.title,
        service: { id: i.serviceId, type: "service_reference" },
        ...(i.urgency ? { urgency: i.urgency } : {}),
        ...(i.body ? { body: { type: "incident_body", details: i.body } } : {}),
        ...(i.escalationPolicyId
          ? {
              escalation_policy: {
                id: i.escalationPolicyId,
                type: "escalation_policy_reference",
              },
            }
          : {}),
      },
    }),
    headers: fromHeader,
  },
  {
    action: "update-incident",
    name: "Update Incident",
    description: "Changes an incident's status, urgency, or assignment.",
    method: "PUT",
    url: (i) => `/incidents/${restSegment(i.incidentId)}`,
    input: z
      .object({
        from: RestEmailSchema,
        incidentId: PagerDutyId,
        status: z.enum(["acknowledged", "resolved"]).optional(),
        urgency: z.enum(["high", "low"]).optional(),
        resolution: z.string().max(10_000).optional(),
        escalationLevel: z.number().int().min(1).max(10).optional(),
      })
      .strict(),
    body: (i) => ({
      incident: {
        type: "incident_reference",
        ...(i.status ? { status: i.status } : {}),
        ...(i.urgency ? { urgency: i.urgency } : {}),
        ...(i.resolution ? { resolution: i.resolution } : {}),
        ...(i.escalationLevel ? { escalation_level: i.escalationLevel } : {}),
      },
    }),
    headers: fromHeader,
  },
  {
    action: "snooze-incident",
    name: "Snooze Incident",
    description: "Silences an incident for a number of seconds.",
    method: "POST",
    url: (i) => `/incidents/${restSegment(i.incidentId)}/snooze`,
    input: z
      .object({
        from: RestEmailSchema,
        incidentId: PagerDutyId,
        duration: z
          .number()
          .int()
          .min(60)
          .max(86_400 * 7),
      })
      .strict(),
    body: (i) => ({ duration: i.duration }),
    headers: fromHeader,
  },
  {
    action: "merge-incidents",
    name: "Merge Incidents",
    description: "Merges other incidents into a target incident.",
    method: "PUT",
    url: (i) => `/incidents/${restSegment(i.incidentId)}/merge`,
    input: z
      .object({
        from: RestEmailSchema,
        incidentId: PagerDutyId,
        sourceIncidentIds: z.array(PagerDutyId).min(1).max(100),
      })
      .strict(),
    body: (i) => ({
      source_incidents: i.sourceIncidentIds.map((id: string) => ({
        id,
        type: "incident_reference",
      })),
    }),
    headers: fromHeader,
  },
  {
    action: "add-note",
    name: "Add Note",
    description: "Adds a note to an incident.",
    method: "POST",
    url: (i) => `/incidents/${restSegment(i.incidentId)}/notes`,
    input: z
      .object({
        from: RestEmailSchema,
        incidentId: PagerDutyId,
        content: z.string().min(1).max(10_000),
      })
      .strict(),
    body: (i) => ({ note: { content: i.content } }),
    headers: fromHeader,
  },
  {
    action: "list-incident-alerts",
    name: "List Incident Alerts",
    description: "Lists the alerts that make up an incident.",
    method: "GET",
    url: (i) =>
      `/incidents/${restSegment(i.incidentId)}/alerts${restQuery({
        limit: i.limit,
      })}`,
    input: z
      .object({
        incidentId: PagerDutyId,
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
  },
  {
    action: "list-services",
    name: "List Services",
    description: "Lists services.",
    method: "GET",
    url: (i) =>
      `/services${restQuery({ query: i.query, limit: i.limit, offset: i.offset })}`,
    input: z
      .object({
        query: z.string().max(256).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .strict(),
  },
  {
    action: "get-service",
    name: "Get Service",
    description: "Reads one service.",
    method: "GET",
    url: (i) => `/services/${restSegment(i.serviceId)}`,
    input: z.object({ serviceId: PagerDutyId }).strict(),
  },
  {
    action: "list-on-calls",
    name: "List On-Calls",
    description: "Lists who is on call, by policy or time window.",
    method: "GET",
    url: (i) =>
      `/oncalls${restQuery({
        "escalation_policy_ids[]": i.escalationPolicyIds,
        "schedule_ids[]": i.scheduleIds,
        since: i.since,
        until: i.until,
        limit: i.limit,
      })}`,
    input: z
      .object({
        escalationPolicyIds: z.array(PagerDutyId).max(50).optional(),
        scheduleIds: z.array(PagerDutyId).max(50).optional(),
        since: z.string().max(64).optional(),
        until: z.string().max(64).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
  },
  {
    action: "list-escalation-policies",
    name: "List Escalation Policies",
    description: "Lists escalation policies.",
    method: "GET",
    url: (i) =>
      `/escalation_policies${restQuery({ query: i.query, limit: i.limit })}`,
    input: z
      .object({
        query: z.string().max(256).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
  },
  {
    action: "list-schedules",
    name: "List Schedules",
    description: "Lists on-call schedules.",
    method: "GET",
    url: (i) => `/schedules${restQuery({ query: i.query, limit: i.limit })}`,
    input: z
      .object({
        query: z.string().max(256).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
  },
  {
    action: "list-users",
    name: "List Users",
    description: "Lists PagerDuty users.",
    method: "GET",
    url: (i) => `/users${restQuery({ query: i.query, limit: i.limit })}`,
    input: z
      .object({
        query: z.string().max(256).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
  },
];

export function createPagerDutyPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "pagerduty",
    sdkReview: `PagerDuty ${NoSdkNote} @pagerduty/pdjs is a thin fetch wrapper without typed operations.`,
    transportKind: "api_key",
    actions: PAGERDUTY_ACTIONS,
    deferrals: {
      "send-event":
        "The Events API v2 lives on events.pagerduty.com, a different host from the REST API, and this lane resolves every action against one host.",
    },
    headers: {
      // The REST API selects its response shape from this Accept header.
      accept: "application/vnd.pagerduty+json;version=2",
    },
  });
}
