import { google } from "googleapis";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationOAuthRuntime } from "../runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputBoolean,
  optionalInputNumber,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
  requiredInputStringArray,
  sdkResponseData,
} from "./shared";

type GoogleCalendarSdkClient = Record<string, unknown>;

type GoogleCalendarClientFactory = (
  accessToken: string,
) => GoogleCalendarSdkClient;

export interface GoogleCalendarProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleCalendarClientFactory;
}

function createGoogleCalendarClient(
  accessToken: string,
): GoogleCalendarSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({
    version: "v3",
    auth,
  }) as unknown as GoogleCalendarSdkClient;
}

const GOOGLE_CALENDAR_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-calendar",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleCalendarSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleCalendarRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleCalendarSdkRequest {
  return { path, arguments: [definedFields(request)] };
}

function googleCalendarId(input: Readonly<Record<string, unknown>>): string {
  return optionalInputString(input, "calendarId") ?? "primary";
}

function googleCalendarDateTime(
  input: Readonly<Record<string, unknown>>,
  name: string,
  required: boolean,
): Record<string, unknown> | undefined {
  const value = optionalInputString(input, name);
  if (!value) {
    if (required) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return { date: value };
  return definedFields({
    dateTime: value,
    timeZone: optionalInputString(input, "timeZone"),
  });
}

function googleCalendarRecurrence(
  input: Readonly<Record<string, unknown>>,
): string[] | undefined {
  const value = input.recurrence;
  if (value === undefined || value === null || value === "") return undefined;
  const recurrence = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/u)
      : undefined;
  if (
    !recurrence ||
    recurrence.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return recurrence.map((entry) => entry.trim());
}

function googleCalendarAttendees(
  input: Readonly<Record<string, unknown>>,
): Array<{ email: string }> | undefined {
  const attendees = optionalInputStringArray(input, "attendees");
  return attendees?.map((email) => ({ email }));
}

function googleCalendarConferenceData(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> | undefined {
  if (!optionalInputBoolean(input, "addGoogleMeet")) return undefined;
  return { createRequest: { requestId: crypto.randomUUID() } };
}

function googleCalendarEventBody(
  input: Readonly<Record<string, unknown>>,
  options: { requireSummary: boolean; requireTimes: boolean },
): Record<string, unknown> {
  const summary = optionalInputString(input, "summary");
  if (options.requireSummary && !summary) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return definedFields({
    summary,
    description: optionalInputString(input, "description"),
    location: optionalInputString(input, "location"),
    start: googleCalendarDateTime(input, "startDateTime", options.requireTimes),
    end: googleCalendarDateTime(input, "endDateTime", options.requireTimes),
    attendees: googleCalendarAttendees(input),
    recurrence: googleCalendarRecurrence(input),
    conferenceData: googleCalendarConferenceData(input),
  });
}

function googleCalendarScope(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const type = requiredInputString(input, "scopeType");
  const value = optionalInputString(input, "scopeValue");
  if (type !== "default" && !value) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return definedFields({ type, value });
}

const GOOGLE_CALENDAR_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleCalendarSdkRequest
  >
> = {
  "google-calendar:create-event": (input) =>
    googleCalendarRequest(["events", "insert"], {
      calendarId: googleCalendarId(input),
      requestBody: googleCalendarEventBody(input, {
        requireSummary: true,
        requireTimes: true,
      }),
      sendUpdates: optionalInputString(input, "sendUpdates"),
      conferenceDataVersion: optionalInputBoolean(input, "addGoogleMeet")
        ? 1
        : undefined,
    }),
  "google-calendar:list-events": (input) =>
    googleCalendarRequest(["events", "list"], {
      calendarId: googleCalendarId(input),
      timeMin: optionalInputString(input, "timeMin"),
      timeMax: optionalInputString(input, "timeMax"),
      q: optionalInputString(input, "q"),
      maxResults: optionalInputNumber(input, "maxResults"),
      pageToken: optionalInputString(input, "pageToken"),
      singleEvents: optionalInputBoolean(input, "singleEvents") ?? true,
      orderBy: optionalInputString(input, "orderBy") ?? "startTime",
      showDeleted: optionalInputBoolean(input, "showDeleted"),
    }),
  "google-calendar:get-event": (input) =>
    googleCalendarRequest(["events", "get"], {
      calendarId: googleCalendarId(input),
      eventId: requiredInputString(input, "eventId"),
    }),
  "google-calendar:update-event": (input) =>
    googleCalendarRequest(["events", "patch"], {
      calendarId: googleCalendarId(input),
      eventId: requiredInputString(input, "eventId"),
      requestBody: googleCalendarEventBody(input, {
        requireSummary: false,
        requireTimes: false,
      }),
      sendUpdates: optionalInputString(input, "sendUpdates"),
      conferenceDataVersion: optionalInputBoolean(input, "addGoogleMeet")
        ? 1
        : undefined,
    }),
  "google-calendar:delete-event": (input) =>
    googleCalendarRequest(["events", "delete"], {
      calendarId: googleCalendarId(input),
      eventId: requiredInputString(input, "eventId"),
      sendUpdates: optionalInputString(input, "sendUpdates"),
    }),
  "google-calendar:move-event": (input) =>
    googleCalendarRequest(["events", "move"], {
      calendarId: googleCalendarId(input),
      eventId: requiredInputString(input, "eventId"),
      destination: requiredInputString(input, "destinationCalendarId"),
      sendUpdates: optionalInputString(input, "sendUpdates"),
    }),
  "google-calendar:get-recurring-instances": (input) =>
    googleCalendarRequest(["events", "instances"], {
      calendarId: googleCalendarId(input),
      eventId: requiredInputString(input, "eventId"),
      timeMin: optionalInputString(input, "timeMin"),
      timeMax: optionalInputString(input, "timeMax"),
      maxResults: optionalInputNumber(input, "maxResults"),
      pageToken: optionalInputString(input, "pageToken"),
      showDeleted: optionalInputBoolean(input, "showDeleted"),
    }),
  "google-calendar:list-calendars": (input) =>
    googleCalendarRequest(["calendarList", "list"], {
      minAccessRole: optionalInputString(input, "minAccessRole"),
      maxResults: optionalInputNumber(input, "maxResults"),
      pageToken: optionalInputString(input, "pageToken"),
      showDeleted: optionalInputBoolean(input, "showDeleted"),
      showHidden: optionalInputBoolean(input, "showHidden"),
    }),
  "google-calendar:quick-add-natural-language": (input) =>
    googleCalendarRequest(["events", "quickAdd"], {
      calendarId: googleCalendarId(input),
      text: requiredInputString(input, "text"),
      sendUpdates: optionalInputString(input, "sendUpdates"),
    }),
  "google-calendar:check-free-busy": (input) =>
    googleCalendarRequest(["freebusy", "query"], {
      requestBody: definedFields({
        timeMin: requiredInputString(input, "timeMin"),
        timeMax: requiredInputString(input, "timeMax"),
        timeZone: optionalInputString(input, "timeZone") ?? "UTC",
        items: requiredInputStringArray(input, "calendarIds").map((id) => ({
          id,
        })),
      }),
    }),
  "google-calendar:create-calendar": (input) =>
    googleCalendarRequest(["calendars", "insert"], {
      requestBody: definedFields({
        summary: requiredInputString(input, "summary"),
        description: optionalInputString(input, "description"),
        location: optionalInputString(input, "location"),
        timeZone: optionalInputString(input, "timeZone"),
      }),
    }),
  "google-calendar:update-calendar": (input) =>
    googleCalendarRequest(["calendars", "patch"], {
      calendarId: googleCalendarId(input),
      requestBody: definedFields({
        summary: optionalInputString(input, "summary"),
        description: optionalInputString(input, "description"),
        location: optionalInputString(input, "location"),
        timeZone: optionalInputString(input, "timeZone"),
      }),
    }),
  "google-calendar:delete-calendar": (input) =>
    googleCalendarRequest(["calendars", "delete"], {
      calendarId: requiredInputString(input, "calendarId"),
    }),
  "google-calendar:share-calendar": (input) =>
    googleCalendarRequest(["acl", "insert"], {
      calendarId: googleCalendarId(input),
      requestBody: {
        role: requiredInputString(input, "role"),
        scope: googleCalendarScope(input),
      },
      sendNotifications: optionalInputBoolean(input, "sendNotifications"),
    }),
  "google-calendar:update-sharing": (input) =>
    googleCalendarRequest(["acl", "patch"], {
      calendarId: googleCalendarId(input),
      ruleId: requiredInputString(input, "ruleId"),
      requestBody: { role: requiredInputString(input, "role") },
      sendNotifications: optionalInputBoolean(input, "sendNotifications"),
    }),
  "google-calendar:list-sharing": (input) =>
    googleCalendarRequest(["acl", "list"], {
      calendarId: googleCalendarId(input),
      maxResults: optionalInputNumber(input, "maxResults"),
      pageToken: optionalInputString(input, "pageToken"),
      showDeleted: optionalInputBoolean(input, "showDeleted"),
    }),
  "google-calendar:remove-sharing": (input) =>
    googleCalendarRequest(["acl", "delete"], {
      calendarId: googleCalendarId(input),
      ruleId: requiredInputString(input, "ruleId"),
    }),
};

function assertGoogleCalendarOperationCoverage(): void {
  const expected = new Set(GOOGLE_CALENDAR_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_CALENDAR_OPERATION_REQUESTS);
  const requiredMultiCallOperations = new Set([
    "google-calendar:invite-attendees",
  ]);
  if (
    expected.size !== implemented.length + requiredMultiCallOperations.size ||
    implemented.some((operationId) => !expected.has(operationId)) ||
    [...requiredMultiCallOperations].some(
      (operationId) => !expected.has(operationId),
    )
  ) {
    throw new Error(
      "Google Calendar provider SDK operation coverage is incomplete.",
    );
  }
}

async function invokeGoogleCalendarInvite(
  client: GoogleCalendarSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const calendarId = googleCalendarId(input);
  const eventId = requiredInputString(input, "eventId");
  const requestedAttendees = googleCalendarAttendees(input) ?? [];
  if (!requestedAttendees.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const current = sdkResponseData(
    await invokeSdkMethod(
      client,
      googleCalendarRequest(["events", "get"], { calendarId, eventId }),
    ),
  );
  const currentRecord =
    current && typeof current === "object"
      ? (current as Record<string, unknown>)
      : undefined;
  const existing =
    currentRecord && Array.isArray(currentRecord.attendees)
      ? currentRecord.attendees.filter(
          (attendee): attendee is { email: string } =>
            Boolean(
              attendee &&
              typeof attendee === "object" &&
              typeof attendee.email === "string",
            ),
        )
      : [];
  const attendees = optionalInputBoolean(input, "replaceExisting")
    ? requestedAttendees
    : [
        ...existing,
        ...requestedAttendees.filter(
          (attendee) =>
            !existing.some(
              (currentAttendee) =>
                currentAttendee.email.toLowerCase() ===
                attendee.email.toLowerCase(),
            ),
        ),
      ];
  return invokeSdkMethod(
    client,
    googleCalendarRequest(["events", "patch"], {
      calendarId,
      eventId,
      requestBody: { attendees },
      sendUpdates: optionalInputString(input, "sendUpdates") ?? "all",
    }),
  );
}

async function invokeGoogleCalendarQuickAdd(
  client: GoogleCalendarSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const result = await invokeSdkMethod(
    client,
    GOOGLE_CALENDAR_OPERATION_REQUESTS[
      "google-calendar:quick-add-natural-language"
    ](input),
  );
  const event = sdkResponseData(result);
  const eventRecord =
    event && typeof event === "object"
      ? (event as Record<string, unknown>)
      : undefined;
  const attendees = googleCalendarAttendees(input);
  const eventId =
    typeof eventRecord?.id === "string" ? eventRecord.id : undefined;
  if (!attendees?.length || !eventId) return result;
  return invokeSdkMethod(
    client,
    googleCalendarRequest(["events", "patch"], {
      calendarId: googleCalendarId(input),
      eventId,
      requestBody: { attendees },
      sendUpdates: optionalInputString(input, "sendUpdates"),
    }),
  );
}

/** All pinned Google Calendar actions use Google's official Node.js SDK. */
export function createGoogleCalendarProviderSdk(
  config: GoogleCalendarProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleCalendarOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleCalendarClient;
  return {
    integrationId: "google-calendar",
    operationIds: GOOGLE_CALENDAR_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-calendar" ||
        invocation.reference.integrationId !== "google-calendar"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_CALENDAR_OPERATION_REQUESTS[invocation.operationId];
      if (
        !requestFactory &&
        invocation.operationId !== "google-calendar:invite-attendees"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const client = clientFactory(credential.accessToken);
          const result =
            invocation.operationId === "google-calendar:invite-attendees"
              ? await invokeGoogleCalendarInvite(client, invocation.input)
              : invocation.operationId ===
                  "google-calendar:quick-add-natural-language"
                ? await invokeGoogleCalendarQuickAdd(client, invocation.input)
                : await invokeSdkMethod(
                    client,
                    requestFactory!(invocation.input),
                  );
          return {
            operationId: invocation.operationId,
            output: sdkResponseData(result),
          };
        },
      );
    },
  };
}

export function getGoogleCalendarProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleCalendarOperationCoverage();
  return {
    operations: GOOGLE_CALENDAR_OPERATION_IDS.length,
    operationIds: GOOGLE_CALENDAR_OPERATION_IDS,
  };
}
