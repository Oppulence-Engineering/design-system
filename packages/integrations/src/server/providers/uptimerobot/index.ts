import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from UptimeRobot's published OpenAPI document:
 * https://api.uptimerobot.com/openapi.yaml
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "UptimeRobot publishes no maintained Node SDK; its OpenAPI document at https://api.uptimerobot.com/openapi.yaml is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-monitors",
    name: "List Monitors",
    description:
      "List monitors in your UptimeRobot account, with optional filters and pagination",
    method: "GET",
    url: (i) =>
      `/monitors${restQuery({ customField: i.customField, limit: i.limit, groupId: i.groupId, status: i.status, name: i.name, url: i.url, tags: i.tags, cursor: i.cursor })}`,
    input: z
      .object({
        customField: SpecArray.optional(),
        limit: z.number().optional(),
        groupId: z.number().optional(),
        status: z.string().max(4_000).optional(),
        name: z.string().max(4_000).optional(),
        url: z.string().max(4_000).optional(),
        tags: z.string().max(4_000).optional(),
        cursor: z.number().optional(),
      })
      .strict(),
  },
  {
    action: "get-monitor",
    name: "Get Monitor",
    description: "Get the details of a single UptimeRobot monitor by ID",
    method: "GET",
    url: (i) => `/monitors/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number(),
      })
      .strict(),
  },
  {
    action: "create-monitor",
    name: "Create Monitor",
    description: "Create a new monitor in UptimeRobot",
    method: "POST",
    url: "/monitors",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "update-monitor",
    name: "Update Monitor",
    description:
      "Update an existing UptimeRobot monitor. Only the provided fields are changed.",
    method: "PATCH",
    url: (i) => `/monitors/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number(),
        friendlyName: z.string().max(4_000).optional(),
        url: z.string().max(4_000).optional(),
        type: z
          .enum([
            "HTTP",
            "KEYWORD",
            "PING",
            "PORT",
            "HEARTBEAT",
            "DNS",
            "API",
            "UDP",
            "VISUAL_COMPARISON",
          ])
          .optional(),
        port: z.number().optional(),
        keywordType: z.enum(["ALERT_EXISTS", "ALERT_NOT_EXISTS"]).optional(),
        keywordCaseType: z.number().optional(),
        keywordValue: z.string().max(4_000).optional(),
        interval: z.number().optional(),
        timeout: z.number().optional(),
        gracePeriod: z.number().optional(),
        httpUsername: z.string().max(4_000).optional(),
        httpPassword: z.string().max(4_000).optional(),
        httpMethodType: z
          .enum([
            "HEAD",
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS",
            "QUERY",
          ])
          .optional(),
        authType: z.enum(["NONE", "HTTP_BASIC", "DIGEST", "BEARER"]).optional(),
        postValueData: SpecObject.optional(),
        postValueType: z.enum(["KEY_VALUE", "RAW_JSON"]).optional(),
        assignedAlertContacts: SpecArray.optional(),
        customHttpHeaders: SpecObject.optional(),
        successHttpResponseCodes: SpecArray.optional(),
        checkSSLErrors: z.boolean().optional(),
        tagNames: SpecArray.optional(),
        maintenanceWindowsIds: SpecArray.optional(),
        domainExpirationReminder: z.boolean().optional(),
        sslExpirationReminder: z.boolean().optional(),
        followRedirections: z.boolean().optional(),
        responseTimeThreshold: z.number().optional(),
        regionalData: z.enum(["na", "eu", "as", "oc"]).optional(),
        regionData: SpecObject.optional(),
        groupId: z.number().optional(),
        customFields: SpecObject.optional(),
        config: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.friendlyName !== undefined ? { friendlyName: i.friendlyName } : {}),
      ...(i.url !== undefined ? { url: i.url } : {}),
      ...(i.type !== undefined ? { type: i.type } : {}),
      ...(i.port !== undefined ? { port: i.port } : {}),
      ...(i.keywordType !== undefined ? { keywordType: i.keywordType } : {}),
      ...(i.keywordCaseType !== undefined
        ? { keywordCaseType: i.keywordCaseType }
        : {}),
      ...(i.keywordValue !== undefined ? { keywordValue: i.keywordValue } : {}),
      ...(i.interval !== undefined ? { interval: i.interval } : {}),
      ...(i.timeout !== undefined ? { timeout: i.timeout } : {}),
      ...(i.gracePeriod !== undefined ? { gracePeriod: i.gracePeriod } : {}),
      ...(i.httpUsername !== undefined ? { httpUsername: i.httpUsername } : {}),
      ...(i.httpPassword !== undefined ? { httpPassword: i.httpPassword } : {}),
      ...(i.httpMethodType !== undefined
        ? { httpMethodType: i.httpMethodType }
        : {}),
      ...(i.authType !== undefined ? { authType: i.authType } : {}),
      ...(i.postValueData !== undefined
        ? { postValueData: i.postValueData }
        : {}),
      ...(i.postValueType !== undefined
        ? { postValueType: i.postValueType }
        : {}),
      ...(i.assignedAlertContacts !== undefined
        ? { assignedAlertContacts: i.assignedAlertContacts }
        : {}),
      ...(i.customHttpHeaders !== undefined
        ? { customHttpHeaders: i.customHttpHeaders }
        : {}),
      ...(i.successHttpResponseCodes !== undefined
        ? { successHttpResponseCodes: i.successHttpResponseCodes }
        : {}),
      ...(i.checkSSLErrors !== undefined
        ? { checkSSLErrors: i.checkSSLErrors }
        : {}),
      ...(i.tagNames !== undefined ? { tagNames: i.tagNames } : {}),
      ...(i.maintenanceWindowsIds !== undefined
        ? { maintenanceWindowsIds: i.maintenanceWindowsIds }
        : {}),
      ...(i.domainExpirationReminder !== undefined
        ? { domainExpirationReminder: i.domainExpirationReminder }
        : {}),
      ...(i.sslExpirationReminder !== undefined
        ? { sslExpirationReminder: i.sslExpirationReminder }
        : {}),
      ...(i.followRedirections !== undefined
        ? { followRedirections: i.followRedirections }
        : {}),
      ...(i.responseTimeThreshold !== undefined
        ? { responseTimeThreshold: i.responseTimeThreshold }
        : {}),
      ...(i.regionalData !== undefined ? { regionalData: i.regionalData } : {}),
      ...(i.regionData !== undefined ? { regionData: i.regionData } : {}),
      ...(i.groupId !== undefined ? { groupId: i.groupId } : {}),
      ...(i.customFields !== undefined ? { customFields: i.customFields } : {}),
      ...(i.config !== undefined ? { config: i.config } : {}),
    }),
  },
  {
    action: "delete-monitor",
    name: "Delete Monitor",
    description: "Permanently delete an UptimeRobot monitor by ID",
    method: "DELETE",
    url: (i) => `/monitors/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number(),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "pause-monitor",
    name: "Pause Monitor",
    description: "Pause an UptimeRobot monitor so it stops running checks",
    method: "POST",
    url: (i) => `/monitors/${restSegment(i.id)}/pause`,
    input: z
      .object({
        id: z.number(),
      })
      .strict(),
  },
  {
    action: "start-monitor",
    name: "Start Monitor",
    description:
      "Resume a paused UptimeRobot monitor so it starts running checks again",
    method: "POST",
    url: (i) => `/monitors/${restSegment(i.id)}/start`,
    input: z
      .object({
        id: z.number(),
      })
      .strict(),
  },
  {
    action: "list-incidents",
    name: "List Incidents",
    description:
      "List incidents across your UptimeRobot account (last 24 hours by default), with optional filters",
    method: "GET",
    url: (i) =>
      `/incidents${restQuery({ cursor: i.cursor, monitor_id: i.monitorId, monitor_name: i.monitorName, started_after: i.startedAfter, started_before: i.startedBefore })}`,
    input: z
      .object({
        cursor: z.string().max(4_000).optional(),
        monitorId: z.number().optional(),
        monitorName: z.string().max(4_000).optional(),
        startedAfter: z.string().max(4_000).optional(),
        startedBefore: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-incident",
    name: "Get Incident",
    description: "Get the details of a single UptimeRobot incident by ID",
    method: "GET",
    url: (i) => `/incidents/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "list-maintenance-windows",
    name: "List Maintenance Windows",
    description: "List maintenance windows in your UptimeRobot account",
    method: "GET",
    url: (i) => `/maintenance-windows${restQuery({ cursor: i.cursor })}`,
    input: z
      .object({
        cursor: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-maintenance-window",
    name: "Get Maintenance Window",
    description:
      "Get the details of a single UptimeRobot maintenance window by ID",
    method: "GET",
    url: (i) => `/maintenance-windows/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number(),
      })
      .strict(),
  },
  {
    action: "create-maintenance-window",
    name: "Create Maintenance Window",
    description:
      "Create a new maintenance window to suppress alerts during planned downtime",
    method: "POST",
    url: "/maintenance-windows",
    input: z
      .object({
        name: z.string().max(4_000),
        autoAddMonitors: z.boolean().optional(),
        interval: z.enum(["once", "daily", "weekly", "monthly"]),
        date: z.string().max(4_000),
        time: z.string().max(4_000),
        duration: z.number(),
        days: SpecArray.optional(),
        monitorIds: SpecArray.optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      ...(i.autoAddMonitors !== undefined
        ? { autoAddMonitors: i.autoAddMonitors }
        : {}),
      interval: i.interval,
      date: i.date,
      time: i.time,
      duration: i.duration,
      ...(i.days !== undefined ? { days: i.days } : {}),
      ...(i.monitorIds !== undefined ? { monitorIds: i.monitorIds } : {}),
    }),
  },
  {
    action: "update-maintenance-window",
    name: "Update Maintenance Window",
    description:
      "Update an existing maintenance window. Only the provided fields are changed.",
    method: "PATCH",
    url: (i) => `/maintenance-windows/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number(),
        name: z.string().max(4_000).optional(),
        interval: z.enum(["once", "daily", "weekly", "monthly"]).optional(),
        date: z.string().max(4_000).optional(),
        time: z.string().max(4_000).optional(),
        duration: z.number().optional(),
        days: SpecArray.optional(),
        monitorIds: SpecArray.optional(),
        status: z.enum(["active", "paused"]).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.interval !== undefined ? { interval: i.interval } : {}),
      ...(i.date !== undefined ? { date: i.date } : {}),
      ...(i.time !== undefined ? { time: i.time } : {}),
      ...(i.duration !== undefined ? { duration: i.duration } : {}),
      ...(i.days !== undefined ? { days: i.days } : {}),
      ...(i.monitorIds !== undefined ? { monitorIds: i.monitorIds } : {}),
      ...(i.status !== undefined ? { status: i.status } : {}),
    }),
  },
  {
    action: "delete-maintenance-window",
    name: "Delete Maintenance Window",
    description: "Permanently delete an UptimeRobot maintenance window by ID",
    method: "DELETE",
    url: (i) => `/maintenance-windows/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number(),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-alert-contacts",
    name: "List Alert Contacts",
    description: "List the personal alert contacts in your UptimeRobot account",
    method: "GET",
    url: (i) => `/alert-contacts${restQuery({ cursor: i.cursor })}`,
    input: z
      .object({
        cursor: z.number().optional(),
      })
      .strict(),
  },
  {
    action: "get-alert-contact",
    name: "Get Alert Contact",
    description: "Get the details of a single UptimeRobot alert contact by ID",
    method: "GET",
    url: (i) => `/alert-contacts/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number(),
      })
      .strict(),
  },
  {
    action: "create-alert-contact",
    name: "Create Alert Contact",
    description:
      "Create an email alert contact in UptimeRobot. The contact must be confirmed via email before it can receive alerts.",
    method: "POST",
    url: "/alert-contacts",
    input: z
      .object({
        type: z.enum(["Email", "ProSms", "Voice", "MobileAppOld", "MobileApp"]),
        friendlyName: z.string().max(4_000).optional(),
        enableNotificationsFor: z.number().optional(),
        value: z.string().max(4_000).optional(),
        deviceName: z.string().max(4_000).optional(),
        oneSignalSubscriptionId: z.string().max(4_000).optional(),
        oneSignalUserId: z.string().max(4_000).optional(),
        deviceFingerprint: z.string().max(4_000).optional(),
        pushToken: z.string().max(4_000).optional(),
        platform: z.enum(["ios", "android"]).optional(),
        config: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      type: i.type,
      ...(i.friendlyName !== undefined ? { friendlyName: i.friendlyName } : {}),
      ...(i.enableNotificationsFor !== undefined
        ? { enableNotificationsFor: i.enableNotificationsFor }
        : {}),
      ...(i.value !== undefined ? { value: i.value } : {}),
      ...(i.deviceName !== undefined ? { deviceName: i.deviceName } : {}),
      ...(i.oneSignalSubscriptionId !== undefined
        ? { oneSignalSubscriptionId: i.oneSignalSubscriptionId }
        : {}),
      ...(i.oneSignalUserId !== undefined
        ? { oneSignalUserId: i.oneSignalUserId }
        : {}),
      ...(i.deviceFingerprint !== undefined
        ? { deviceFingerprint: i.deviceFingerprint }
        : {}),
      ...(i.pushToken !== undefined ? { pushToken: i.pushToken } : {}),
      ...(i.platform !== undefined ? { platform: i.platform } : {}),
      ...(i.config !== undefined ? { config: i.config } : {}),
    }),
  },
  {
    action: "delete-alert-contact",
    name: "Delete Alert Contact",
    description: "Permanently delete an UptimeRobot alert contact by ID",
    method: "DELETE",
    url: (i) => `/alert-contacts/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number(),
      })
      .strict(),
    emptyResponse: "optional",
  },
];

export function createUptimerobotPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "uptimerobot",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "list-status-pages":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-status-page":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "create-status-page":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "update-status-page":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "delete-status-page":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-account":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
