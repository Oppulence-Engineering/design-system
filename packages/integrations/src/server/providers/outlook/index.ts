import type { IntegrationProviderPack } from "../../core/provider-pack";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import {
  definedFields,
  optionalInputBoolean,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
  requiredInputStringArray,
} from "../shared/sdk";
import {
  createMicrosoftGraphPack,
  createMicrosoftGraphProviderSdk,
  graphSegment,
  optionalGraphSegment,
  type MicrosoftGraphClientFactory,
  type MicrosoftGraphOperation,
} from "../shared/clients/microsoft-graph";
import {
  graphCollectionQuery,
  graphEntityQuery,
} from "../shared/clients/microsoft-graph-query";

type GraphInput = Readonly<Record<string, unknown>>;

function recipients(
  input: GraphInput,
  ...names: string[]
): Array<{ emailAddress: { address: string } }> | undefined {
  const addresses = optionalInputStringArray(input, ...names);
  return addresses?.map((address) => ({ emailAddress: { address } }));
}

function requiredRecipients(
  input: GraphInput,
  ...names: string[]
): Array<{ emailAddress: { address: string } }> {
  return requiredInputStringArray(input, ...names).map((address) => ({
    emailAddress: { address },
  }));
}

function messageBody(input: GraphInput): {
  contentType: string;
  content: string;
} {
  // Graph defaults to HTML; senders that pass plain text must say so.
  const contentType =
    optionalInputString(input, "bodyType", "contentType")?.toLowerCase() ===
    "text"
      ? "Text"
      : "HTML";
  return {
    contentType,
    content: requiredInputString(input, "body", "content"),
  };
}

function draftMessage(input: GraphInput): Record<string, unknown> {
  return definedFields({
    subject: optionalInputString(input, "subject"),
    body: messageBody(input),
    toRecipients: requiredRecipients(input, "to", "toRecipients"),
    ccRecipients: recipients(input, "cc", "ccRecipients"),
    bccRecipients: recipients(input, "bcc", "bccRecipients"),
    importance: optionalInputString(input, "importance"),
  });
}

/** Mail folder segment, defaulting to the well-known inbox. */
function folder(input: GraphInput): string {
  return optionalGraphSegment(input, "folderId", "folder") ?? "inbox";
}

function eventBody(input: GraphInput): Record<string, unknown> {
  const timeZone = optionalInputString(input, "timeZone") ?? "UTC";
  const start = optionalInputString(input, "startDateTime", "start");
  const end = optionalInputString(input, "endDateTime", "end");
  return definedFields({
    subject: optionalInputString(input, "subject"),
    body: optionalInputString(input, "body", "content")
      ? messageBody(input)
      : undefined,
    start: start ? { dateTime: start, timeZone } : undefined,
    end: end ? { dateTime: end, timeZone } : undefined,
    location: optionalInputString(input, "location")
      ? { displayName: optionalInputString(input, "location") }
      : undefined,
    attendees: optionalInputStringArray(input, "attendees")?.map((address) => ({
      emailAddress: { address },
      type: "required",
    })),
    isAllDay: optionalInputBoolean(input, "isAllDay"),
    isOnlineMeeting: optionalInputBoolean(input, "isOnlineMeeting"),
  });
}

const OUTLOOK_OPERATIONS: Readonly<Record<string, MicrosoftGraphOperation>> = {
  "outlook:send-email": {
    method: "POST",
    path: () => "/me/sendMail",
    body: (input) => ({
      message: draftMessage(input),
      saveToSentItems: optionalInputBoolean(input, "saveToSentItems") ?? true,
    }),
    output: () => ({ sent: true }),
  },
  "outlook:draft-email": {
    method: "POST",
    path: () => "/me/messages",
    body: (input) => draftMessage(input),
  },
  "outlook:read-email": {
    method: "GET",
    path: (input) => {
      const messageId = optionalGraphSegment(input, "messageId", "id");
      return messageId
        ? `/me/messages/${messageId}`
        : `/me/mailFolders/${folder(input)}/messages`;
    },
    query: (input) =>
      optionalInputString(input, "messageId", "id")
        ? graphEntityQuery(input)
        : graphCollectionQuery(input),
  },
  "outlook:search-email": {
    method: "GET",
    path: () => "/me/messages",
    query: (input) => ({
      ...graphCollectionQuery(input),
      $search: `"${requiredInputString(input, "query", "search").replace(/"/gu, "")}"`,
    }),
  },
  "outlook:reply-to-email": {
    method: "POST",
    path: (input) =>
      `/me/messages/${graphSegment(input, "messageId", "id")}/reply`,
    body: (input) => ({
      comment: requiredInputString(input, "body", "comment"),
    }),
    output: () => ({ replied: true }),
  },
  "outlook:reply-all": {
    method: "POST",
    path: (input) =>
      `/me/messages/${graphSegment(input, "messageId", "id")}/replyAll`,
    body: (input) => ({
      comment: requiredInputString(input, "body", "comment"),
    }),
    output: () => ({ replied: true }),
  },
  "outlook:forward-email": {
    method: "POST",
    path: (input) =>
      `/me/messages/${graphSegment(input, "messageId", "id")}/forward`,
    body: (input) =>
      definedFields({
        comment: optionalInputString(input, "body", "comment"),
        toRecipients: requiredRecipients(input, "to", "toRecipients"),
      }),
    output: () => ({ forwarded: true }),
  },
  "outlook:move-email": {
    method: "POST",
    path: (input) =>
      `/me/messages/${graphSegment(input, "messageId", "id")}/move`,
    body: (input) => ({
      destinationId: requiredInputString(
        input,
        "destinationFolderId",
        "folderId",
      ),
    }),
  },
  "outlook:copy-email": {
    method: "POST",
    path: (input) =>
      `/me/messages/${graphSegment(input, "messageId", "id")}/copy`,
    body: (input) => ({
      destinationId: requiredInputString(
        input,
        "destinationFolderId",
        "folderId",
      ),
    }),
  },
  "outlook:mark-as-read": {
    method: "PATCH",
    path: (input) => `/me/messages/${graphSegment(input, "messageId", "id")}`,
    body: () => ({ isRead: true }),
  },
  "outlook:mark-as-unread": {
    method: "PATCH",
    path: (input) => `/me/messages/${graphSegment(input, "messageId", "id")}`,
    body: () => ({ isRead: false }),
  },
  "outlook:set-categories-flag": {
    method: "PATCH",
    path: (input) => `/me/messages/${graphSegment(input, "messageId", "id")}`,
    body: (input) =>
      definedFields({
        categories: optionalInputStringArray(input, "categories"),
        flag: optionalInputString(input, "flagStatus")
          ? { flagStatus: optionalInputString(input, "flagStatus") }
          : undefined,
      }),
  },
  "outlook:delete-email": {
    method: "DELETE",
    path: (input) => `/me/messages/${graphSegment(input, "messageId", "id")}`,
  },
  "outlook:list-folders": {
    method: "GET",
    path: (input) => {
      const parent = optionalGraphSegment(input, "parentFolderId");
      return parent
        ? `/me/mailFolders/${parent}/childFolders`
        : "/me/mailFolders";
    },
    query: graphCollectionQuery,
  },
  "outlook:create-folder": {
    method: "POST",
    path: (input) => {
      const parent = optionalGraphSegment(input, "parentFolderId");
      return parent
        ? `/me/mailFolders/${parent}/childFolders`
        : "/me/mailFolders";
    },
    body: (input) => ({
      displayName: requiredInputString(input, "displayName", "name"),
    }),
  },
  "outlook:list-attachments": {
    method: "GET",
    path: (input) =>
      `/me/messages/${graphSegment(input, "messageId", "id")}/attachments`,
    query: (input) => ({
      ...graphCollectionQuery(input),
      // Attachment bytes are fetched one at a time by get-attachment.
      $select:
        optionalInputString(input, "select") ?? "id,name,contentType,size",
    }),
  },
  "outlook:get-attachment": {
    method: "GET",
    path: (input) =>
      `/me/messages/${graphSegment(input, "messageId")}/attachments/${graphSegment(input, "attachmentId")}`,
  },
  "outlook:list-calendar-events": {
    method: "GET",
    path: (input) => {
      const calendar = optionalGraphSegment(input, "calendarId");
      return calendar ? `/me/calendars/${calendar}/events` : "/me/events";
    },
    query: graphCollectionQuery,
  },
  "outlook:get-calendar-event": {
    method: "GET",
    path: (input) => `/me/events/${graphSegment(input, "eventId", "id")}`,
    query: graphEntityQuery,
  },
  "outlook:create-event": {
    method: "POST",
    path: (input) => {
      const calendar = optionalGraphSegment(input, "calendarId");
      return calendar ? `/me/calendars/${calendar}/events` : "/me/events";
    },
    body: eventBody,
  },
  "outlook:update-event": {
    method: "PATCH",
    path: (input) => `/me/events/${graphSegment(input, "eventId", "id")}`,
    body: eventBody,
  },
  "outlook:delete-event": {
    method: "DELETE",
    path: (input) => `/me/events/${graphSegment(input, "eventId", "id")}`,
  },
  "outlook:respond-to-invite": {
    method: "POST",
    path: (input) => {
      const response = requiredInputString(
        input,
        "response",
        "responseType",
      ).toLowerCase();
      const action =
        response === "accept"
          ? "accept"
          : response === "decline"
            ? "decline"
            : "tentativelyAccept";
      return `/me/events/${graphSegment(input, "eventId", "id")}/${action}`;
    },
    body: (input) =>
      definedFields({
        comment: optionalInputString(input, "comment"),
        sendResponse: optionalInputBoolean(input, "sendResponse") ?? true,
      }),
    output: (_value, input) => ({
      eventId: requiredInputString(input, "eventId", "id"),
      response: requiredInputString(input, "response", "responseType"),
      responded: true,
    }),
  },
};

export interface OutlookProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: MicrosoftGraphClientFactory;
}

/** Executes the pinned Outlook mail and calendar actions through Graph. */
export function createOutlookProviderSdk(
  config: OutlookProviderSdkConfig,
): IntegrationProviderSdk {
  return createMicrosoftGraphProviderSdk({
    integrationId: "outlook",
    operations: OUTLOOK_OPERATIONS,
    oauthRuntime: config.oauthRuntime,
    ...(config.clientFactory ? { clientFactory: config.clientFactory } : {}),
  });
}

export function createOutlookPack(): IntegrationProviderPack {
  return createMicrosoftGraphPack({
    integrationId: "outlook",
    operations: OUTLOOK_OPERATIONS,
    triggerCoverage: [
      {
        sourceTriggerId: "outlook:outlook-poller",
        kind: "poll",
        disposition: "supported",
      },
    ],
  });
}

export function getOutlookProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  const operationIds = Object.keys(OUTLOOK_OPERATIONS);
  return { operations: operationIds.length, operationIds };
}
