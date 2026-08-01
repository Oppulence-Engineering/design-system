import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

const NoSdkNote =
  "publishes no maintained Node SDK; its HTTP API is the supported integration surface.";

// ----------------------------------------------------------------- Calendly

/** Calendly addresses every resource by a full URI, not a bare ID. */
const CalendlyUri = z
  .string()
  .min(1)
  .max(512)
  .regex(/^https:\/\/api\.calendly\.com\/[A-Za-z0-9/_-]+$/u);

const CALENDLY_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "get-current-user",
    name: "Get Current User",
    description: "Reads the authenticated Calendly user.",
    method: "GET",
    url: "/users/me",
    input: z.object({}).strict(),
  },
  {
    action: "list-event-types",
    name: "List Event Types",
    description: "Lists the event types owned by a user or organization.",
    method: "GET",
    url: (i) =>
      `/event_types${restQuery({
        user: i.user,
        organization: i.organization,
        count: i.count,
        page_token: i.pageToken,
      })}`,
    input: z
      .object({
        user: CalendlyUri.optional(),
        organization: CalendlyUri.optional(),
        count: z.number().int().min(1).max(100).optional(),
        pageToken: z.string().max(512).optional(),
      })
      .strict()
      .refine((value) => Boolean(value.user ?? value.organization), {
        message: "Listing event types needs a user or organization URI.",
      }),
  },
  {
    action: "get-event-type",
    name: "Get Event Type",
    description: "Reads one event type by its UUID.",
    method: "GET",
    url: (i) => `/event_types/${restSegment(i.uuid)}`,
    input: z
      .object({
        uuid: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[A-Za-z0-9-]+$/u),
      })
      .strict(),
  },
  {
    action: "list-scheduled-events",
    name: "List Scheduled Events",
    description: "Lists scheduled events for a user or organization.",
    method: "GET",
    url: (i) =>
      `/scheduled_events${restQuery({
        user: i.user,
        organization: i.organization,
        status: i.status,
        min_start_time: i.minStartTime,
        max_start_time: i.maxStartTime,
        count: i.count,
        page_token: i.pageToken,
      })}`,
    input: z
      .object({
        user: CalendlyUri.optional(),
        organization: CalendlyUri.optional(),
        status: z.enum(["active", "canceled"]).optional(),
        minStartTime: z.string().max(64).optional(),
        maxStartTime: z.string().max(64).optional(),
        count: z.number().int().min(1).max(100).optional(),
        pageToken: z.string().max(512).optional(),
      })
      .strict()
      .refine((value) => Boolean(value.user ?? value.organization), {
        message: "Listing scheduled events needs a user or organization URI.",
      }),
  },
  {
    action: "get-scheduled-event",
    name: "Get Scheduled Event",
    description: "Reads one scheduled event by its UUID.",
    method: "GET",
    url: (i) => `/scheduled_events/${restSegment(i.uuid)}`,
    input: z
      .object({
        uuid: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[A-Za-z0-9-]+$/u),
      })
      .strict(),
  },
  {
    action: "list-event-invitees",
    name: "List Event Invitees",
    description: "Lists the invitees of a scheduled event.",
    method: "GET",
    url: (i) =>
      `/scheduled_events/${restSegment(i.uuid)}/invitees${restQuery({
        status: i.status,
        count: i.count,
        page_token: i.pageToken,
      })}`,
    input: z
      .object({
        uuid: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[A-Za-z0-9-]+$/u),
        status: z.enum(["active", "canceled"]).optional(),
        count: z.number().int().min(1).max(100).optional(),
        pageToken: z.string().max(512).optional(),
      })
      .strict(),
  },
  {
    action: "cancel-event",
    name: "Cancel Event",
    description: "Cancels a scheduled event.",
    method: "POST",
    url: (i) => `/scheduled_events/${restSegment(i.uuid)}/cancellation`,
    input: z
      .object({
        uuid: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[A-Za-z0-9-]+$/u),
        reason: z.string().max(500).optional(),
      })
      .strict(),
    body: (i) => (i.reason ? { reason: i.reason } : {}),
  },
];

export function createCalendlyPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "calendly",
    sdkReview: `Calendly ${NoSdkNote}`,
    transportKind: "api_key",
    actions: CALENDLY_ACTIONS,
  });
}
