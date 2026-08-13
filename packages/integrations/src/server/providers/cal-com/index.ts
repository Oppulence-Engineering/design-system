import { z } from "zod";
import { requireOptionalSdk } from "../shared/optional-sdk";

import { SIMSTUDIO_BASELINE } from "../../../catalog";

import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import { createIntegrationTypedRestProvider } from "../../core/provider-rest";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import {
  definedFields,
  optionalInputNumber,
  optionalInputString,
  requiredInputRecord,
  requiredInputString,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorProviderSdk,
  requiredVendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/**
 * @calcom/sdk@1.0.1 is published but incomplete: its `bookings` namespace has
 * no methods at all, and `eventTypes` exposes two of the six the source needs.
 * Only schedules and slots are covered. The nine actions it can execute run on
 * the SDK; the other ten use the typed REST lane against Cal.com's v2 API,
 * with that review recorded per action.
 */
const CAL_SDK_REVIEW =
  "@calcom/sdk@1.0.1 publishes no method for this action — its bookings namespace is empty and eventTypes exposes only createEventType and getEventType.";

function calId(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (!/^[A-Za-z0-9_-]{1,64}$/u.test(value)) throw invocationError();
  return value;
}

const CAL_SDK_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "cal-com:create-schedule": {
    path: ["schedules", "createSchedule"],
    params: (i) => [
      definedFields({
        name: requiredInputString(i, "name"),
        timeZone: requiredInputString(i, "timeZone"),
        isDefault: i.isDefault === true,
        availability: i.availability,
      }),
    ],
  },
  "cal-com:get-schedule": {
    path: ["schedules", "getScheduleById"],
    params: (i) => [{ scheduleId: calId(i, "scheduleId", "id") }],
  },
  "cal-com:list-schedules": { path: ["schedules", "getSchedules"] },
  "cal-com:update-schedule": {
    path: ["schedules", "updateSchedule"],
    params: (i) => [
      {
        scheduleId: calId(i, "scheduleId", "id"),
        ...definedFields({
          name: optionalInputString(i, "name"),
          timeZone: optionalInputString(i, "timeZone"),
          availability: i.availability,
        }),
      },
    ],
  },
  "cal-com:delete-schedule": {
    path: ["schedules", "deleteSchedule"],
    params: (i) => [{ scheduleId: calId(i, "scheduleId", "id") }],
    output: (_v, i) => ({
      scheduleId: calId(i, "scheduleId", "id"),
      deleted: true,
    }),
  },
  "cal-com:get-default-schedule": { path: ["schedules", "getDefaultSchedule"] },
  "cal-com:get-available-slots": {
    path: ["slots", "getAvailableSlots"],
    params: (i) => [
      definedFields({
        eventTypeId: optionalInputNumber(i, "eventTypeId"),
        startTime: requiredInputString(i, "startTime", "from"),
        endTime: requiredInputString(i, "endTime", "to"),
        timeZone: optionalInputString(i, "timeZone"),
      }),
    ],
  },
  "cal-com:create-event-type": {
    path: ["eventTypes", "createEventType"],
    params: (i) => [requiredInputRecord(i, "eventType", "fields")],
  },
  "cal-com:get-event-type": {
    path: ["eventTypes", "getEventType"],
    params: (i) => [{ eventTypeId: calId(i, "eventTypeId", "id") }],
  },
};

const CAL_REST_OPERATION_IDS = [
  "cal-com:list-bookings",
  "cal-com:create-booking",
  "cal-com:get-booking",
  "cal-com:cancel-booking",
  "cal-com:reschedule-booking",
  "cal-com:confirm-booking",
  "cal-com:decline-booking",
  "cal-com:list-event-types",
  "cal-com:update-event-type",
  "cal-com:delete-event-type",
] as const;

const CalDocumentSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

const BookingUidSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/u);
const EventTypeIdSchema = z.union([
  z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/u),
  z.number().int().positive(),
]);

/** Cal.com's v2 API versions each resource with a date header. */
const CAL_API_VERSION = "2024-08-13";

function bookingHeaders(): Record<string, string> {
  return { accept: "application/json", "cal-api-version": CAL_API_VERSION };
}

export interface CalComRestProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "request">;
}

/** Executes the Cal.com actions the published SDK does not implement. */
export function createCalComRestProviderSdk(
  config: CalComRestProviderSdkConfig,
): IntegrationProviderSdk {
  return createIntegrationTypedRestProvider({
    integrationId: "cal-com",
    transport: { kind: "oauth2", runtime: config.oauthRuntime },
    tools: [
      {
        id: "cal-com:list-bookings",
        name: "List Bookings",
        description: "Lists bookings on the connected Cal.com account.",
        version: "1.0.0",
        params: {
          status: { type: "string", visibility: "user-or-llm" },
          take: { type: "number", visibility: "user-or-llm" },
          skip: { type: "number", visibility: "user-or-llm" },
        },
        request: {
          method: "GET",
          url: (input) => {
            const query = new URLSearchParams();
            if (input.status) query.set("status", input.status);
            query.set("take", String(input.take ?? 50));
            if (input.skip) query.set("skip", String(input.skip));
            return `/v2/bookings?${query.toString()}`;
          },
          headers: bookingHeaders,
          retry: { enabled: true },
        },
        inputSchema: z
          .object({
            status: z.string().max(64).optional(),
            take: z.number().int().min(1).max(250).optional(),
            skip: z.number().int().min(0).optional(),
          })
          .strict(),
        outputSchema: CalDocumentSchema,
        maxResponseBytes: 512 * 1024,
      },
      {
        id: "cal-com:get-booking",
        name: "Get Booking",
        description: "Reads one booking by its UID.",
        version: "1.0.0",
        params: {
          bookingUid: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "GET",
          url: (input) =>
            `/v2/bookings/${encodeURIComponent(input.bookingUid)}`,
          headers: bookingHeaders,
          retry: { enabled: true },
        },
        inputSchema: z.object({ bookingUid: BookingUidSchema }).strict(),
        outputSchema: CalDocumentSchema,
      },
      {
        id: "cal-com:create-booking",
        name: "Create Booking",
        description: "Books a slot on an event type.",
        version: "1.0.0",
        params: {
          eventTypeId: {
            type: "number",
            required: true,
            visibility: "user-or-llm",
          },
          start: { type: "string", required: true, visibility: "user-or-llm" },
          attendee: {
            type: "object",
            required: true,
            visibility: "user-or-llm",
          },
          metadata: { type: "object", visibility: "user-or-llm" },
        },
        request: {
          method: "POST",
          url: () => "/v2/bookings",
          headers: bookingHeaders,
          body: (input) => ({
            eventTypeId: input.eventTypeId,
            start: input.start,
            attendee: input.attendee,
            ...(input.metadata ? { metadata: input.metadata } : {}),
          }),
        },
        inputSchema: z
          .object({
            eventTypeId: z.number().int().positive(),
            start: z.string().min(1).max(64),
            attendee: z.record(z.string(), z.unknown()),
            metadata: z.record(z.string(), z.unknown()).optional(),
          })
          .strict(),
        outputSchema: CalDocumentSchema,
      },
      ...(
        [
          ["cancel-booking", "cancel", "Cancels a booking."],
          ["confirm-booking", "confirm", "Confirms a pending booking."],
          ["decline-booking", "decline", "Declines a pending booking."],
        ] as const
      ).map(([action, suffix, description]) => ({
        id: `cal-com:${action}`,
        name: action,
        description,
        version: "1.0.0",
        params: {
          bookingUid: {
            type: "string",
            required: true,
            visibility: "user-or-llm" as const,
          },
          reason: { type: "string", visibility: "user-or-llm" as const },
        },
        request: {
          method: "POST" as const,
          url: (input: { bookingUid: string }) =>
            `/v2/bookings/${encodeURIComponent(input.bookingUid)}/${suffix}`,
          headers: bookingHeaders,
          body: (input: { reason?: string }) =>
            input.reason
              ? { cancellationReason: input.reason, reason: input.reason }
              : {},
        },
        inputSchema: z
          .object({
            bookingUid: BookingUidSchema,
            reason: z.string().max(500).optional(),
          })
          .strict(),
        outputSchema: CalDocumentSchema,
      })),
      {
        id: "cal-com:reschedule-booking",
        name: "Reschedule Booking",
        description: "Moves a booking to a new start time.",
        version: "1.0.0",
        params: {
          bookingUid: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          start: { type: "string", required: true, visibility: "user-or-llm" },
          reason: { type: "string", visibility: "user-or-llm" },
        },
        request: {
          method: "POST",
          url: (input) =>
            `/v2/bookings/${encodeURIComponent(input.bookingUid)}/reschedule`,
          headers: bookingHeaders,
          body: (input) => ({
            start: input.start,
            ...(input.reason ? { reschedulingReason: input.reason } : {}),
          }),
        },
        inputSchema: z
          .object({
            bookingUid: BookingUidSchema,
            start: z.string().min(1).max(64),
            reason: z.string().max(500).optional(),
          })
          .strict(),
        outputSchema: CalDocumentSchema,
      },
      {
        id: "cal-com:list-event-types",
        name: "List Event Types",
        description: "Lists the event types on the connected account.",
        version: "1.0.0",
        params: {
          username: { type: "string", visibility: "user-or-llm" },
          eventSlug: { type: "string", visibility: "user-or-llm" },
        },
        request: {
          method: "GET",
          url: (input) => {
            const query = new URLSearchParams();
            if (input.username) query.set("username", input.username);
            if (input.eventSlug) query.set("eventSlug", input.eventSlug);
            const serialized = query.toString();
            return `/v2/event-types${serialized ? `?${serialized}` : ""}`;
          },
          headers: () => ({ accept: "application/json" }),
          retry: { enabled: true },
        },
        inputSchema: z
          .object({
            username: z.string().max(128).optional(),
            eventSlug: z.string().max(128).optional(),
          })
          .strict(),
        outputSchema: CalDocumentSchema,
        maxResponseBytes: 512 * 1024,
      },
      {
        id: "cal-com:update-event-type",
        name: "Update Event Type",
        description: "Updates an event type.",
        version: "1.0.0",
        params: {
          eventTypeId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          fields: { type: "object", required: true, visibility: "user-or-llm" },
        },
        request: {
          method: "PATCH",
          url: (input) =>
            `/v2/event-types/${encodeURIComponent(String(input.eventTypeId))}`,
          headers: () => ({ accept: "application/json" }),
          body: (input) => input.fields,
        },
        inputSchema: z
          .object({
            eventTypeId: EventTypeIdSchema,
            fields: z.record(z.string(), z.unknown()),
          })
          .strict(),
        outputSchema: CalDocumentSchema,
      },
      {
        id: "cal-com:delete-event-type",
        name: "Delete Event Type",
        description: "Deletes an event type.",
        version: "1.0.0",
        params: {
          eventTypeId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "DELETE",
          url: (input) =>
            `/v2/event-types/${encodeURIComponent(String(input.eventTypeId))}`,
          headers: () => ({ accept: "application/json" }),
        },
        inputSchema: z.object({ eventTypeId: EventTypeIdSchema }).strict(),
        transformResponse: async () => ({ deleted: true as const }),
        outputSchema: z.object({ deleted: z.literal(true) }).strict(),
      },
    ],
  });
}

/**
 * Cal.com's platform SDK is constructed with the OAuth client ID and an access
 * token. The client ID is deployment configuration alongside the token.
 */
export const createCalComClient: VendorClientFactory = (credential) => {
  const { Cal } = requireOptionalSdk("@calcom/sdk") as {
    Cal: new (
      clientId: string,
      authOptions: Record<string, unknown>,
    ) => SdkMethodTarget;
  };
  return new Cal(requiredVendorField(credential, "clientId"), {
    accessToken: vendorToken(credential),
  });
};

export function createCalComPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  const clientFactory = options.clientFactory ?? createCalComClient;
  return {
    integrationId: "cal-com",
    coverage: [
      ...Object.keys(CAL_SDK_OPERATIONS).map((sourceOperationId) => ({
        sourceOperationId,
        lane: "sdk" as const,
        disposition: "supported" as const,
      })),
      ...CAL_REST_OPERATION_IDS.map((sourceOperationId) => ({
        sourceOperationId,
        lane: "typed_rest" as const,
        disposition: "supported" as const,
        sdkReview: CAL_SDK_REVIEW,
      })),
    ],
    // Read the trigger list from the pinned source rather than restating it:
    // hand-written IDs drift, and the contract catches it only after the fact.
    triggerCoverage: (
      SIMSTUDIO_BASELINE.integrations.find(
        (integration) => integration.id === "cal-com",
      )?.triggers ?? []
    ).map((trigger) => ({
      sourceTriggerId: trigger.id,
      disposition: "deferred" as const,
      reason:
        "Cal.com signs webhooks with a per-subscription secret; scheduled with the trigger family work.",
    })),
    create(context) {
      if (!context.oauthRuntime) return [];
      return [
        createVendorProviderSdk({
          integrationId: "cal-com",
          operations: CAL_SDK_OPERATIONS,
          clientFactory,
          transport: { kind: "oauth2", runtime: context.oauthRuntime },
        }),
        createCalComRestProviderSdk({ oauthRuntime: context.oauthRuntime }),
      ];
    },
  };
}
