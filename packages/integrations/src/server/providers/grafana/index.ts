import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Grafana's published OpenAPI document:
 * https://raw.githubusercontent.com/grafana/grafana/main/public/api-merged.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Grafana publishes no maintained Node SDK; its OpenAPI document at https://raw.githubusercontent.com/grafana/grafana/main/public/api-merged.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-dashboards",
    name: "List Dashboards",
    description: "Search and list all dashboards",
    method: "GET",
    url: (i) =>
      `/api/search${restQuery({ query: i.query, tag: i.tag, type: i.type, dashboardIds: i.dashboardIds, dashboardUIDs: i.dashboardUIDs, folderIds: i.folderIds, folderUIDs: i.folderUIDs, starred: i.starred, limit: i.limit, page: i.page, permission: i.permission, sort: i.sort, deleted: i.deleted })}`,
    input: z
      .object({
        query: z.string().max(4_000).optional(),
        tag: SpecArray.optional(),
        type: z.enum(["dash-folder", "dash-db"]).optional(),
        dashboardIds: SpecArray.optional(),
        dashboardUIDs: SpecArray.optional(),
        folderIds: SpecArray.optional(),
        folderUIDs: SpecArray.optional(),
        starred: z.boolean().optional(),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        page: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        permission: z.enum(["Edit", "View"]).optional(),
        sort: z.enum(["alpha-asc", "alpha-desc"]).optional(),
        deleted: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "get-dashboard",
    name: "Get Dashboard",
    description: "Get a dashboard by its UID",
    method: "GET",
    url: (i) => `/api/dashboards/uid/${restSegment(i.uid)}`,
    input: z
      .object({
        uid: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "create-dashboard",
    name: "Create Dashboard",
    description: "Create a new dashboard",
    method: "POST",
    url: "/api/dashboards/db",
    input: z
      .object({
        updatedAt: z.string().max(4_000).optional(),
        dashboard: SpecObject.optional(),
        folderId: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        folderUid: z.string().max(4_000).optional(),
        isFolder: z.boolean().optional(),
        message: z.string().max(4_000).optional(),
        overwrite: z.boolean().optional(),
        userId: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.updatedAt !== undefined ? { UpdatedAt: i.updatedAt } : {}),
      ...(i.dashboard !== undefined ? { dashboard: i.dashboard } : {}),
      ...(i.folderId !== undefined ? { folderId: i.folderId } : {}),
      ...(i.folderUid !== undefined ? { folderUid: i.folderUid } : {}),
      ...(i.isFolder !== undefined ? { isFolder: i.isFolder } : {}),
      ...(i.message !== undefined ? { message: i.message } : {}),
      ...(i.overwrite !== undefined ? { overwrite: i.overwrite } : {}),
      ...(i.userId !== undefined ? { userId: i.userId } : {}),
    }),
  },
  {
    action: "delete-dashboard",
    name: "Delete Dashboard",
    description: "Delete a dashboard by its UID",
    method: "DELETE",
    url: (i) => `/api/dashboards/uid/${restSegment(i.uid)}`,
    input: z
      .object({
        uid: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-alert-rules",
    name: "List Alert Rules",
    description: "List all alert rules in the Grafana instance",
    method: "GET",
    url: "/api/v1/provisioning/alert-rules",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "get-alert-rule",
    name: "Get Alert Rule",
    description: "Get a specific alert rule by its UID",
    method: "GET",
    url: (i) => `/api/v1/provisioning/alert-rules/${restSegment(i.uID)}`,
    input: z
      .object({
        uID: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "create-alert-rule",
    name: "Create Alert Rule",
    description: "Create a new alert rule",
    method: "POST",
    url: "/api/v1/provisioning/alert-rules",
    input: z
      .object({
        annotations: SpecObject.optional(),
        condition: z.string().max(4_000),
        data: SpecArray,
        execErrState: z.enum(["OK", "Alerting", "Error"]),
        folderUID: z.string().max(4_000),
        for: z.string().max(4_000),
        id: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
        isPaused: z.boolean().optional(),
        keepFiringFor: z.string().max(4_000).optional(),
        labels: SpecObject.optional(),
        missingSeriesEvalsToResolve: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        noDataState: z.enum(["Alerting", "NoData", "OK"]),
        notificationSettings: SpecObject.optional(),
        orgID: z.number().int().min(-1_000_000_000).max(1_000_000_000),
        provenance: z.string().max(4_000).optional(),
        record: SpecObject.optional(),
        ruleGroup: z.string().max(4_000),
        title: z.string().max(4_000),
        uid: z.string().max(4_000).optional(),
        updated: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.annotations !== undefined ? { annotations: i.annotations } : {}),
      condition: i.condition,
      data: i.data,
      execErrState: i.execErrState,
      folderUID: i.folderUID,
      for: i.for,
      ...(i.id !== undefined ? { id: i.id } : {}),
      ...(i.isPaused !== undefined ? { isPaused: i.isPaused } : {}),
      ...(i.keepFiringFor !== undefined
        ? { keep_firing_for: i.keepFiringFor }
        : {}),
      ...(i.labels !== undefined ? { labels: i.labels } : {}),
      ...(i.missingSeriesEvalsToResolve !== undefined
        ? { missingSeriesEvalsToResolve: i.missingSeriesEvalsToResolve }
        : {}),
      noDataState: i.noDataState,
      ...(i.notificationSettings !== undefined
        ? { notification_settings: i.notificationSettings }
        : {}),
      orgID: i.orgID,
      ...(i.provenance !== undefined ? { provenance: i.provenance } : {}),
      ...(i.record !== undefined ? { record: i.record } : {}),
      ruleGroup: i.ruleGroup,
      title: i.title,
      ...(i.uid !== undefined ? { uid: i.uid } : {}),
      ...(i.updated !== undefined ? { updated: i.updated } : {}),
    }),
  },
  {
    action: "update-alert-rule",
    name: "Update Alert Rule",
    description:
      "Update an existing alert rule. Fetches the current rule and merges your changes.",
    method: "PUT",
    url: (i) => `/api/v1/provisioning/alert-rules/${restSegment(i.uID)}`,
    input: z
      .object({
        uID: z.string().max(4_000),
        annotations: SpecObject.optional(),
        condition: z.string().max(4_000),
        data: SpecArray,
        execErrState: z.enum(["OK", "Alerting", "Error"]),
        folderUID: z.string().max(4_000),
        for: z.string().max(4_000),
        id: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
        isPaused: z.boolean().optional(),
        keepFiringFor: z.string().max(4_000).optional(),
        labels: SpecObject.optional(),
        missingSeriesEvalsToResolve: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        noDataState: z.enum(["Alerting", "NoData", "OK"]),
        notificationSettings: SpecObject.optional(),
        orgID: z.number().int().min(-1_000_000_000).max(1_000_000_000),
        provenance: z.string().max(4_000).optional(),
        record: SpecObject.optional(),
        ruleGroup: z.string().max(4_000),
        title: z.string().max(4_000),
        uid: z.string().max(4_000).optional(),
        updated: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.annotations !== undefined ? { annotations: i.annotations } : {}),
      condition: i.condition,
      data: i.data,
      execErrState: i.execErrState,
      folderUID: i.folderUID,
      for: i.for,
      ...(i.id !== undefined ? { id: i.id } : {}),
      ...(i.isPaused !== undefined ? { isPaused: i.isPaused } : {}),
      ...(i.keepFiringFor !== undefined
        ? { keep_firing_for: i.keepFiringFor }
        : {}),
      ...(i.labels !== undefined ? { labels: i.labels } : {}),
      ...(i.missingSeriesEvalsToResolve !== undefined
        ? { missingSeriesEvalsToResolve: i.missingSeriesEvalsToResolve }
        : {}),
      noDataState: i.noDataState,
      ...(i.notificationSettings !== undefined
        ? { notification_settings: i.notificationSettings }
        : {}),
      orgID: i.orgID,
      ...(i.provenance !== undefined ? { provenance: i.provenance } : {}),
      ...(i.record !== undefined ? { record: i.record } : {}),
      ruleGroup: i.ruleGroup,
      title: i.title,
      ...(i.uid !== undefined ? { uid: i.uid } : {}),
      ...(i.updated !== undefined ? { updated: i.updated } : {}),
    }),
  },
  {
    action: "delete-alert-rule",
    name: "Delete Alert Rule",
    description: "Delete an alert rule by its UID",
    method: "DELETE",
    url: (i) => `/api/v1/provisioning/alert-rules/${restSegment(i.uID)}`,
    input: z
      .object({
        uID: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-contact-points",
    name: "List Contact Points",
    description: "List all alert notification contact points",
    method: "GET",
    url: (i) =>
      `/api/v1/provisioning/contact-points${restQuery({ name: i.name })}`,
    input: z
      .object({
        name: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-contact-point",
    name: "Create Contact Point",
    description:
      "Create a notification contact point (e.g., Slack, email, PagerDuty)",
    method: "POST",
    url: "/api/v1/provisioning/contact-points",
    input: z
      .object({
        disableResolveMessage: z.boolean().optional(),
        name: z.string().max(4_000).optional(),
        provenance: z.string().max(4_000).optional(),
        settings: SpecObject,
        type: z.enum([
          "alertmanager",
          "dingding",
          "discord",
          "email",
          "googlechat",
          "kafka",
          "line",
          "opsgenie",
          "pagerduty",
          "pushover",
          "sensugo",
          "slack",
          "teams",
          "telegram",
          "threema",
          "victorops",
          "webhook",
          "wecom",
        ]),
        uid: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.disableResolveMessage !== undefined
        ? { disableResolveMessage: i.disableResolveMessage }
        : {}),
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.provenance !== undefined ? { provenance: i.provenance } : {}),
      settings: i.settings,
      type: i.type,
      ...(i.uid !== undefined ? { uid: i.uid } : {}),
    }),
  },
  {
    action: "create-annotation",
    name: "Create Annotation",
    description:
      "Create an annotation on a dashboard or as a global annotation",
    method: "POST",
    url: "/api/annotations",
    input: z
      .object({
        dashboardId: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        dashboardUID: z.string().max(4_000).optional(),
        data: SpecObject.optional(),
        panelId: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        tags: SpecArray.optional(),
        text: z.string().max(4_000),
        time: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        timeEnd: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.dashboardId !== undefined ? { dashboardId: i.dashboardId } : {}),
      ...(i.dashboardUID !== undefined ? { dashboardUID: i.dashboardUID } : {}),
      ...(i.data !== undefined ? { data: i.data } : {}),
      ...(i.panelId !== undefined ? { panelId: i.panelId } : {}),
      ...(i.tags !== undefined ? { tags: i.tags } : {}),
      text: i.text,
      ...(i.time !== undefined ? { time: i.time } : {}),
      ...(i.timeEnd !== undefined ? { timeEnd: i.timeEnd } : {}),
    }),
  },
  {
    action: "list-annotations",
    name: "List Annotations",
    description: "Query annotations by time range, dashboard, or tags",
    method: "GET",
    url: (i) =>
      `/api/annotations${restQuery({ from: i.from, to: i.to, userId: i.userId, userUID: i.userUID, alertId: i.alertId, alertUID: i.alertUID, dashboardId: i.dashboardId, dashboardUID: i.dashboardUID, panelId: i.panelId, limit: i.limit, tags: i.tags, type: i.type, matchAny: i.matchAny })}`,
    input: z
      .object({
        from: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        to: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
        userId: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        userUID: z.string().max(4_000).optional(),
        alertId: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        alertUID: z.string().max(4_000).optional(),
        dashboardId: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        dashboardUID: z.string().max(4_000).optional(),
        panelId: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        tags: SpecArray.optional(),
        type: z.enum(["alert", "annotation"]).optional(),
        matchAny: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "update-annotation",
    name: "Update Annotation",
    description: "Update an existing annotation",
    method: "PUT",
    url: (i) => `/api/annotations/${restSegment(i.annotationId)}`,
    input: z
      .object({
        annotationId: z.string().max(4_000),
        data: SpecObject.optional(),
        id: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
        tags: SpecArray.optional(),
        text: z.string().max(4_000).optional(),
        time: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        timeEnd: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.data !== undefined ? { data: i.data } : {}),
      ...(i.id !== undefined ? { id: i.id } : {}),
      ...(i.tags !== undefined ? { tags: i.tags } : {}),
      ...(i.text !== undefined ? { text: i.text } : {}),
      ...(i.time !== undefined ? { time: i.time } : {}),
      ...(i.timeEnd !== undefined ? { timeEnd: i.timeEnd } : {}),
    }),
  },
  {
    action: "delete-annotation",
    name: "Delete Annotation",
    description: "Delete an annotation by its ID",
    method: "DELETE",
    url: (i) => `/api/annotations/${restSegment(i.annotationId)}`,
    input: z
      .object({
        annotationId: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-data-sources",
    name: "List Data Sources",
    description: "List all data sources configured in Grafana",
    method: "GET",
    url: "/api/datasources",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "get-data-source",
    name: "Get Data Source",
    description: "Get a data source by its ID or UID",
    method: "GET",
    url: (i) => `/api/datasources/uid/${restSegment(i.uid)}`,
    input: z
      .object({
        uid: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "check-data-source-health",
    name: "Check Data Source Health",
    description: "Test connectivity to a data source by its UID",
    method: "GET",
    url: (i) => `/api/datasources/uid/${restSegment(i.uid)}/health`,
    input: z
      .object({
        uid: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "list-folders",
    name: "List Folders",
    description: "List all folders in Grafana",
    method: "GET",
    url: (i) =>
      `/api/folders${restQuery({ limit: i.limit, page: i.page, parentUid: i.parentUid, permission: i.permission })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        page: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        parentUid: z.string().max(4_000).optional(),
        permission: z.enum(["Edit", "View"]).optional(),
      })
      .strict(),
  },
  {
    action: "create-folder",
    name: "Create Folder",
    description: "Create a new folder in Grafana",
    method: "POST",
    url: "/api/folders",
    input: z
      .object({
        description: z.string().max(4_000).optional(),
        parentUid: z.string().max(4_000).optional(),
        title: z.string().max(4_000).optional(),
        uid: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.parentUid !== undefined ? { parentUid: i.parentUid } : {}),
      ...(i.title !== undefined ? { title: i.title } : {}),
      ...(i.uid !== undefined ? { uid: i.uid } : {}),
    }),
  },
  {
    action: "get-folder",
    name: "Get Folder",
    description: "Get a folder by its UID",
    method: "GET",
    url: (i) => `/api/folders/${restSegment(i.folderUid)}`,
    input: z
      .object({
        folderUid: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "update-folder",
    name: "Update Folder",
    description:
      "Update (rename) a folder. Fetches the current folder and merges your changes.",
    method: "PUT",
    url: (i) => `/api/folders/${restSegment(i.folderUid)}`,
    input: z
      .object({
        folderUid: z.string().max(4_000),
        description: z.string().max(4_000).optional(),
        overwrite: z.boolean().optional(),
        title: z.string().max(4_000).optional(),
        version: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.overwrite !== undefined ? { overwrite: i.overwrite } : {}),
      ...(i.title !== undefined ? { title: i.title } : {}),
      ...(i.version !== undefined ? { version: i.version } : {}),
    }),
  },
  {
    action: "delete-folder",
    name: "Delete Folder",
    description: "Delete a folder by its UID",
    method: "DELETE",
    url: (i) =>
      `/api/folders/${restSegment(i.folderUid)}${restQuery({ forceDeleteRules: i.forceDeleteRules })}`,
    input: z
      .object({
        folderUid: z.string().max(4_000),
        forceDeleteRules: z.boolean().optional(),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "get-health",
    name: "Get Health",
    description:
      "Check the health of the Grafana instance (version, database status)",
    method: "GET",
    url: "/api/health",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
];

export function createGrafanaPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "grafana",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "update-dashboard":
        "Grafana upserts through POST /api/dashboards/db, already bound to create-dashboard. The highest-scoring alternative was /api/user/stars/dashboard/uid/{uid}, which stars a dashboard rather than updating it.",
    },
  });
}
