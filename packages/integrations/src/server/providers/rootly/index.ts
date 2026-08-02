import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Rootly's published OpenAPI document:
 * https://rootly.com/swagger/v1/swagger.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Rootly publishes no maintained Node SDK; its OpenAPI document at https://rootly.com/swagger/v1/swagger.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "create-incident",
    name: "Create Incident",
    description:
      "Create a new incident in Rootly with optional severity, services, and teams.",
    method: "POST",
    url: "/v1/incidents",
    input: z
      .object({
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "get-incident",
    name: "Get Incident",
    description: "Retrieve a single incident by ID from Rootly.",
    method: "GET",
    url: (i) =>
      `/v1/incidents/${restSegment(i.id)}${restQuery({ include: i.include })}`,
    input: z
      .object({
        id: z.string().max(4_000),
        include: z
          .enum([
            "sub_statuses",
            "causes",
            "subscribers",
            "roles",
            "slack_messages",
            "environments",
            "incident_types",
            "services",
            "functionalities",
            "groups",
            "events",
            "action_items",
            "custom_field_selections",
            "feedbacks",
            "incident_post_mortem",
            "alerts",
          ])
          .optional(),
      })
      .strict(),
  },
  {
    action: "update-incident",
    name: "Update Incident",
    description:
      "Update an existing incident in Rootly (status, severity, summary, etc.).",
    method: "PUT",
    url: (i) => `/v1/incidents/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "list-incidents",
    name: "List Incidents",
    description:
      "List incidents from Rootly with optional filtering by status, severity, and more.",
    method: "GET",
    url: (i) =>
      `/v1/incidents${restQuery({ "page[after]": i.pageAfter, "page[number]": i.pageNumber, "page[size]": i.pageSize, "filter[search]": i.filterSearch, "filter[kind]": i.filterKind, "filter[status]": i.filterStatus, "filter[private]": i.filterPrivate, "filter[user_id]": i.filterUserId, "filter[severity]": i.filterSeverity, "filter[severity_id]": i.filterSeverityId, "filter[labels]": i.filterLabels, "filter[types]": i.filterTypes, "filter[type_ids]": i.filterTypeIds, "filter[environments]": i.filterEnvironments, "filter[environment_ids]": i.filterEnvironmentIds, "filter[functionalities]": i.filterFunctionalities, "filter[functionality_ids]": i.filterFunctionalityIds, "filter[functionality_names]": i.filterFunctionalityNames, "filter[services]": i.filterServices, "filter[service_ids]": i.filterServiceIds, "filter[service_names]": i.filterServiceNames, "filter[teams]": i.filterTeams, "filter[team_ids]": i.filterTeamIds, "filter[team_names]": i.filterTeamNames, "filter[cause]": i.filterCause, "filter[cause_ids]": i.filterCauseIds, "filter[custom_field_selected_option_ids]": i.filterCustomFieldSelectedOptionIds, "filter[slack_channel_id]": i.filterSlackChannelId, "filter[sequential_id]": i.filterSequentialId, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, "filter[updated_at][gt]": i.filterUpdatedAtGt, "filter[updated_at][gte]": i.filterUpdatedAtGte, "filter[updated_at][lt]": i.filterUpdatedAtLt, "filter[updated_at][lte]": i.filterUpdatedAtLte, "filter[started_at][gt]": i.filterStartedAtGt, "filter[started_at][gte]": i.filterStartedAtGte, "filter[started_at][lt]": i.filterStartedAtLt, "filter[started_at][lte]": i.filterStartedAtLte, "filter[detected_at][gt]": i.filterDetectedAtGt, "filter[detected_at][gte]": i.filterDetectedAtGte, "filter[detected_at][lt]": i.filterDetectedAtLt, "filter[detected_at][lte]": i.filterDetectedAtLte, "filter[acknowledged_at][gt]": i.filterAcknowledgedAtGt, "filter[acknowledged_at][gte]": i.filterAcknowledgedAtGte, "filter[acknowledged_at][lt]": i.filterAcknowledgedAtLt, "filter[acknowledged_at][lte]": i.filterAcknowledgedAtLte, "filter[mitigated_at][gt]": i.filterMitigatedAtGt, "filter[mitigated_at][gte]": i.filterMitigatedAtGte, "filter[mitigated_at][lt]": i.filterMitigatedAtLt, "filter[mitigated_at][lte]": i.filterMitigatedAtLte, "filter[resolved_at][gt]": i.filterResolvedAtGt, "filter[resolved_at][gte]": i.filterResolvedAtGte, "filter[resolved_at][lt]": i.filterResolvedAtLt, "filter[resolved_at][lte]": i.filterResolvedAtLte, "filter[closed_at][gt]": i.filterClosedAtGt, "filter[closed_at][gte]": i.filterClosedAtGte, "filter[closed_at][lt]": i.filterClosedAtLt, "filter[closed_at][lte]": i.filterClosedAtLte, "filter[in_triage_at][gt]": i.filterInTriageAtGt, "filter[in_triage_at][gte]": i.filterInTriageAtGte, "filter[in_triage_at][lt]": i.filterInTriageAtLt, "filter[in_triage_at][lte]": i.filterInTriageAtLte, "filter[kind][eq]": i.filterKindEq, "filter[kind][not_eq]": i.filterKindNotEq, "filter[kind][in]": i.filterKindIn, "filter[kind][not_in]": i.filterKindNotIn, "filter[status][eq]": i.filterStatusEq, "filter[status][not_eq]": i.filterStatusNotEq, "filter[status][in]": i.filterStatusIn, "filter[status][not_in]": i.filterStatusNotIn, "filter[private][eq]": i.filterPrivateEq, "filter[private][not_eq]": i.filterPrivateNotEq, "filter[private][in]": i.filterPrivateIn, "filter[private][not_in]": i.filterPrivateNotIn, "filter[user_id][eq]": i.filterUserIdEq, "filter[user_id][not_eq]": i.filterUserIdNotEq, "filter[user_id][in]": i.filterUserIdIn, "filter[user_id][not_in]": i.filterUserIdNotIn, "filter[severity][eq]": i.filterSeverityEq, "filter[severity][not_eq]": i.filterSeverityNotEq, "filter[severity][in]": i.filterSeverityIn, "filter[severity][not_in]": i.filterSeverityNotIn, "filter[severity_id][eq]": i.filterSeverityIdEq, "filter[severity_id][not_eq]": i.filterSeverityIdNotEq, "filter[severity_id][in]": i.filterSeverityIdIn, "filter[severity_id][not_in]": i.filterSeverityIdNotIn, "filter[labels][eq]": i.filterLabelsEq, "filter[labels][not_eq]": i.filterLabelsNotEq, "filter[labels][in]": i.filterLabelsIn, "filter[labels][not_in]": i.filterLabelsNotIn, "filter[zendesk_ticket_id][eq]": i.filterZendeskTicketIdEq, "filter[zendesk_ticket_id][not_eq]": i.filterZendeskTicketIdNotEq, "filter[zendesk_ticket_id][in]": i.filterZendeskTicketIdIn, "filter[zendesk_ticket_id][not_in]": i.filterZendeskTicketIdNotIn, "filter[sequential_id][eq]": i.filterSequentialIdEq, "filter[sequential_id][not_eq]": i.filterSequentialIdNotEq, "filter[sequential_id][in]": i.filterSequentialIdIn, "filter[sequential_id][not_in]": i.filterSequentialIdNotIn, "filter[types][eq]": i.filterTypesEq, "filter[types][not_eq]": i.filterTypesNotEq, "filter[types][in]": i.filterTypesIn, "filter[types][not_in]": i.filterTypesNotIn, "filter[type_ids][eq]": i.filterTypeIdsEq, "filter[type_ids][not_eq]": i.filterTypeIdsNotEq, "filter[type_ids][in]": i.filterTypeIdsIn, "filter[type_ids][not_in]": i.filterTypeIdsNotIn, "filter[environments][eq]": i.filterEnvironmentsEq, "filter[environments][not_eq]": i.filterEnvironmentsNotEq, "filter[environments][in]": i.filterEnvironmentsIn, "filter[environments][not_in]": i.filterEnvironmentsNotIn, "filter[environment_ids][eq]": i.filterEnvironmentIdsEq, "filter[environment_ids][not_eq]": i.filterEnvironmentIdsNotEq, "filter[environment_ids][in]": i.filterEnvironmentIdsIn, "filter[environment_ids][not_in]": i.filterEnvironmentIdsNotIn, "filter[services][eq]": i.filterServicesEq, "filter[services][not_eq]": i.filterServicesNotEq, "filter[services][in]": i.filterServicesIn, "filter[services][not_in]": i.filterServicesNotIn, "filter[service_ids][eq]": i.filterServiceIdsEq, "filter[service_ids][not_eq]": i.filterServiceIdsNotEq, "filter[service_ids][in]": i.filterServiceIdsIn, "filter[service_ids][not_in]": i.filterServiceIdsNotIn, "filter[service_names][eq]": i.filterServiceNamesEq, "filter[service_names][not_eq]": i.filterServiceNamesNotEq, "filter[service_names][in]": i.filterServiceNamesIn, "filter[service_names][not_in]": i.filterServiceNamesNotIn, "filter[functionalities][eq]": i.filterFunctionalitiesEq, "filter[functionalities][not_eq]": i.filterFunctionalitiesNotEq, "filter[functionalities][in]": i.filterFunctionalitiesIn, "filter[functionalities][not_in]": i.filterFunctionalitiesNotIn, "filter[functionality_ids][eq]": i.filterFunctionalityIdsEq, "filter[functionality_ids][not_eq]": i.filterFunctionalityIdsNotEq, "filter[functionality_ids][in]": i.filterFunctionalityIdsIn, "filter[functionality_ids][not_in]": i.filterFunctionalityIdsNotIn, "filter[functionality_names][eq]": i.filterFunctionalityNamesEq, "filter[functionality_names][not_eq]": i.filterFunctionalityNamesNotEq, "filter[functionality_names][in]": i.filterFunctionalityNamesIn, "filter[functionality_names][not_in]": i.filterFunctionalityNamesNotIn, "filter[causes][eq]": i.filterCausesEq, "filter[causes][not_eq]": i.filterCausesNotEq, "filter[causes][in]": i.filterCausesIn, "filter[causes][not_in]": i.filterCausesNotIn, "filter[cause_ids][eq]": i.filterCauseIdsEq, "filter[cause_ids][not_eq]": i.filterCauseIdsNotEq, "filter[cause_ids][in]": i.filterCauseIdsIn, "filter[cause_ids][not_in]": i.filterCauseIdsNotIn, "filter[teams][eq]": i.filterTeamsEq, "filter[teams][not_eq]": i.filterTeamsNotEq, "filter[teams][in]": i.filterTeamsIn, "filter[teams][not_in]": i.filterTeamsNotIn, "filter[team_ids][eq]": i.filterTeamIdsEq, "filter[team_ids][not_eq]": i.filterTeamIdsNotEq, "filter[team_ids][in]": i.filterTeamIdsIn, "filter[team_ids][not_in]": i.filterTeamIdsNotIn, "filter[team_names][eq]": i.filterTeamNamesEq, "filter[team_names][not_eq]": i.filterTeamNamesNotEq, "filter[team_names][in]": i.filterTeamNamesIn, "filter[team_names][not_in]": i.filterTeamNamesNotIn, sort: i.sort, include: i.include })}`,
    input: z
      .object({
        pageAfter: z.string().max(4_000).optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filterSearch: z.string().max(4_000).optional(),
        filterKind: z.string().max(4_000).optional(),
        filterStatus: z.string().max(4_000).optional(),
        filterPrivate: z.string().max(4_000).optional(),
        filterUserId: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filterSeverity: z.string().max(4_000).optional(),
        filterSeverityId: z.string().max(4_000).optional(),
        filterLabels: z.string().max(4_000).optional(),
        filterTypes: z.string().max(4_000).optional(),
        filterTypeIds: z.string().max(4_000).optional(),
        filterEnvironments: z.string().max(4_000).optional(),
        filterEnvironmentIds: z.string().max(4_000).optional(),
        filterFunctionalities: z.string().max(4_000).optional(),
        filterFunctionalityIds: z.string().max(4_000).optional(),
        filterFunctionalityNames: z.string().max(4_000).optional(),
        filterServices: z.string().max(4_000).optional(),
        filterServiceIds: z.string().max(4_000).optional(),
        filterServiceNames: z.string().max(4_000).optional(),
        filterTeams: z.string().max(4_000).optional(),
        filterTeamIds: z.string().max(4_000).optional(),
        filterTeamNames: z.string().max(4_000).optional(),
        filterCause: z.string().max(4_000).optional(),
        filterCauseIds: z.string().max(4_000).optional(),
        filterCustomFieldSelectedOptionIds: z.string().max(4_000).optional(),
        filterSlackChannelId: z.string().max(4_000).optional(),
        filterSequentialId: z.string().max(4_000).optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        filterUpdatedAtGt: z.string().max(4_000).optional(),
        filterUpdatedAtGte: z.string().max(4_000).optional(),
        filterUpdatedAtLt: z.string().max(4_000).optional(),
        filterUpdatedAtLte: z.string().max(4_000).optional(),
        filterStartedAtGt: z.string().max(4_000).optional(),
        filterStartedAtGte: z.string().max(4_000).optional(),
        filterStartedAtLt: z.string().max(4_000).optional(),
        filterStartedAtLte: z.string().max(4_000).optional(),
        filterDetectedAtGt: z.string().max(4_000).optional(),
        filterDetectedAtGte: z.string().max(4_000).optional(),
        filterDetectedAtLt: z.string().max(4_000).optional(),
        filterDetectedAtLte: z.string().max(4_000).optional(),
        filterAcknowledgedAtGt: z.string().max(4_000).optional(),
        filterAcknowledgedAtGte: z.string().max(4_000).optional(),
        filterAcknowledgedAtLt: z.string().max(4_000).optional(),
        filterAcknowledgedAtLte: z.string().max(4_000).optional(),
        filterMitigatedAtGt: z.string().max(4_000).optional(),
        filterMitigatedAtGte: z.string().max(4_000).optional(),
        filterMitigatedAtLt: z.string().max(4_000).optional(),
        filterMitigatedAtLte: z.string().max(4_000).optional(),
        filterResolvedAtGt: z.string().max(4_000).optional(),
        filterResolvedAtGte: z.string().max(4_000).optional(),
        filterResolvedAtLt: z.string().max(4_000).optional(),
        filterResolvedAtLte: z.string().max(4_000).optional(),
        filterClosedAtGt: z.string().max(4_000).optional(),
        filterClosedAtGte: z.string().max(4_000).optional(),
        filterClosedAtLt: z.string().max(4_000).optional(),
        filterClosedAtLte: z.string().max(4_000).optional(),
        filterInTriageAtGt: z.string().max(4_000).optional(),
        filterInTriageAtGte: z.string().max(4_000).optional(),
        filterInTriageAtLt: z.string().max(4_000).optional(),
        filterInTriageAtLte: z.string().max(4_000).optional(),
        filterKindEq: z.string().max(4_000).optional(),
        filterKindNotEq: z.string().max(4_000).optional(),
        filterKindIn: z.string().max(4_000).optional(),
        filterKindNotIn: z.string().max(4_000).optional(),
        filterStatusEq: z.string().max(4_000).optional(),
        filterStatusNotEq: z.string().max(4_000).optional(),
        filterStatusIn: z.string().max(4_000).optional(),
        filterStatusNotIn: z.string().max(4_000).optional(),
        filterPrivateEq: z.string().max(4_000).optional(),
        filterPrivateNotEq: z.string().max(4_000).optional(),
        filterPrivateIn: z.string().max(4_000).optional(),
        filterPrivateNotIn: z.string().max(4_000).optional(),
        filterUserIdEq: z.string().max(4_000).optional(),
        filterUserIdNotEq: z.string().max(4_000).optional(),
        filterUserIdIn: z.string().max(4_000).optional(),
        filterUserIdNotIn: z.string().max(4_000).optional(),
        filterSeverityEq: z.string().max(4_000).optional(),
        filterSeverityNotEq: z.string().max(4_000).optional(),
        filterSeverityIn: z.string().max(4_000).optional(),
        filterSeverityNotIn: z.string().max(4_000).optional(),
        filterSeverityIdEq: z.string().max(4_000).optional(),
        filterSeverityIdNotEq: z.string().max(4_000).optional(),
        filterSeverityIdIn: z.string().max(4_000).optional(),
        filterSeverityIdNotIn: z.string().max(4_000).optional(),
        filterLabelsEq: z.string().max(4_000).optional(),
        filterLabelsNotEq: z.string().max(4_000).optional(),
        filterLabelsIn: z.string().max(4_000).optional(),
        filterLabelsNotIn: z.string().max(4_000).optional(),
        filterZendeskTicketIdEq: z.string().max(4_000).optional(),
        filterZendeskTicketIdNotEq: z.string().max(4_000).optional(),
        filterZendeskTicketIdIn: z.string().max(4_000).optional(),
        filterZendeskTicketIdNotIn: z.string().max(4_000).optional(),
        filterSequentialIdEq: z.string().max(4_000).optional(),
        filterSequentialIdNotEq: z.string().max(4_000).optional(),
        filterSequentialIdIn: z.string().max(4_000).optional(),
        filterSequentialIdNotIn: z.string().max(4_000).optional(),
        filterTypesEq: z.string().max(4_000).optional(),
        filterTypesNotEq: z.string().max(4_000).optional(),
        filterTypesIn: z.string().max(4_000).optional(),
        filterTypesNotIn: z.string().max(4_000).optional(),
        filterTypeIdsEq: z.string().max(4_000).optional(),
        filterTypeIdsNotEq: z.string().max(4_000).optional(),
        filterTypeIdsIn: z.string().max(4_000).optional(),
        filterTypeIdsNotIn: z.string().max(4_000).optional(),
        filterEnvironmentsEq: z.string().max(4_000).optional(),
        filterEnvironmentsNotEq: z.string().max(4_000).optional(),
        filterEnvironmentsIn: z.string().max(4_000).optional(),
        filterEnvironmentsNotIn: z.string().max(4_000).optional(),
        filterEnvironmentIdsEq: z.string().max(4_000).optional(),
        filterEnvironmentIdsNotEq: z.string().max(4_000).optional(),
        filterEnvironmentIdsIn: z.string().max(4_000).optional(),
        filterEnvironmentIdsNotIn: z.string().max(4_000).optional(),
        filterServicesEq: z.string().max(4_000).optional(),
        filterServicesNotEq: z.string().max(4_000).optional(),
        filterServicesIn: z.string().max(4_000).optional(),
        filterServicesNotIn: z.string().max(4_000).optional(),
        filterServiceIdsEq: z.string().max(4_000).optional(),
        filterServiceIdsNotEq: z.string().max(4_000).optional(),
        filterServiceIdsIn: z.string().max(4_000).optional(),
        filterServiceIdsNotIn: z.string().max(4_000).optional(),
        filterServiceNamesEq: z.string().max(4_000).optional(),
        filterServiceNamesNotEq: z.string().max(4_000).optional(),
        filterServiceNamesIn: z.string().max(4_000).optional(),
        filterServiceNamesNotIn: z.string().max(4_000).optional(),
        filterFunctionalitiesEq: z.string().max(4_000).optional(),
        filterFunctionalitiesNotEq: z.string().max(4_000).optional(),
        filterFunctionalitiesIn: z.string().max(4_000).optional(),
        filterFunctionalitiesNotIn: z.string().max(4_000).optional(),
        filterFunctionalityIdsEq: z.string().max(4_000).optional(),
        filterFunctionalityIdsNotEq: z.string().max(4_000).optional(),
        filterFunctionalityIdsIn: z.string().max(4_000).optional(),
        filterFunctionalityIdsNotIn: z.string().max(4_000).optional(),
        filterFunctionalityNamesEq: z.string().max(4_000).optional(),
        filterFunctionalityNamesNotEq: z.string().max(4_000).optional(),
        filterFunctionalityNamesIn: z.string().max(4_000).optional(),
        filterFunctionalityNamesNotIn: z.string().max(4_000).optional(),
        filterCausesEq: z.string().max(4_000).optional(),
        filterCausesNotEq: z.string().max(4_000).optional(),
        filterCausesIn: z.string().max(4_000).optional(),
        filterCausesNotIn: z.string().max(4_000).optional(),
        filterCauseIdsEq: z.string().max(4_000).optional(),
        filterCauseIdsNotEq: z.string().max(4_000).optional(),
        filterCauseIdsIn: z.string().max(4_000).optional(),
        filterCauseIdsNotIn: z.string().max(4_000).optional(),
        filterTeamsEq: z.string().max(4_000).optional(),
        filterTeamsNotEq: z.string().max(4_000).optional(),
        filterTeamsIn: z.string().max(4_000).optional(),
        filterTeamsNotIn: z.string().max(4_000).optional(),
        filterTeamIdsEq: z.string().max(4_000).optional(),
        filterTeamIdsNotEq: z.string().max(4_000).optional(),
        filterTeamIdsIn: z.string().max(4_000).optional(),
        filterTeamIdsNotIn: z.string().max(4_000).optional(),
        filterTeamNamesEq: z.string().max(4_000).optional(),
        filterTeamNamesNotEq: z.string().max(4_000).optional(),
        filterTeamNamesIn: z.string().max(4_000).optional(),
        filterTeamNamesNotIn: z.string().max(4_000).optional(),
        sort: z
          .enum([
            "created_at",
            "-created_at",
            "updated_at",
            "-updated_at",
            "started_at",
            "-started_at",
            "in_triage_at",
            "-in_triage_at",
            "mitigated_at",
            "-mitigated_at",
            "resolved_at",
            "-resolved_at",
          ])
          .optional(),
        include: z
          .enum([
            "sub_statuses",
            "causes",
            "subscribers",
            "roles",
            "slack_messages",
            "environments",
            "incident_types",
            "services",
            "functionalities",
            "groups",
            "events",
            "action_items",
            "custom_field_selections",
            "feedbacks",
            "incident_post_mortem",
            "alerts",
          ])
          .optional(),
      })
      .strict(),
  },
  {
    action: "create-alert",
    name: "Create Alert",
    description:
      "Create a new alert in Rootly for on-call notification and routing.",
    method: "POST",
    url: "/v1/alerts",
    input: z
      .object({
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "list-alerts",
    name: "List Alerts",
    description:
      "List alerts from Rootly with optional filtering by status, source, and services.",
    method: "GET",
    url: (i) =>
      `/v1/alerts${restQuery({ include: i.include, "filter[status]": i.filterStatus, "filter[source]": i.filterSource, "filter[services]": i.filterServices, "filter[environments]": i.filterEnvironments, "filter[groups]": i.filterGroups, "filter[labels]": i.filterLabels, "filter[started_at][gt]": i.filterStartedAtGt, "filter[started_at][gte]": i.filterStartedAtGte, "filter[started_at][lt]": i.filterStartedAtLt, "filter[started_at][lte]": i.filterStartedAtLte, "filter[ended_at][gt]": i.filterEndedAtGt, "filter[ended_at][gte]": i.filterEndedAtGte, "filter[ended_at][lt]": i.filterEndedAtLt, "filter[ended_at][lte]": i.filterEndedAtLte, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, "filter[updated_at][gt]": i.filterUpdatedAtGt, "filter[updated_at][gte]": i.filterUpdatedAtGte, "filter[updated_at][lt]": i.filterUpdatedAtLt, "filter[updated_at][lte]": i.filterUpdatedAtLte, "filter[status][eq]": i.filterStatusEq, "filter[status][not_eq]": i.filterStatusNotEq, "filter[status][in]": i.filterStatusIn, "filter[status][not_in]": i.filterStatusNotIn, "filter[source][eq]": i.filterSourceEq, "filter[source][not_eq]": i.filterSourceNotEq, "filter[source][in]": i.filterSourceIn, "filter[source][not_in]": i.filterSourceNotIn, "filter[services][eq]": i.filterServicesEq, "filter[services][not_eq]": i.filterServicesNotEq, "filter[services][in]": i.filterServicesIn, "filter[services][not_in]": i.filterServicesNotIn, "filter[groups][eq]": i.filterGroupsEq, "filter[groups][not_eq]": i.filterGroupsNotEq, "filter[groups][in]": i.filterGroupsIn, "filter[groups][not_in]": i.filterGroupsNotIn, "filter[environments][eq]": i.filterEnvironmentsEq, "filter[environments][not_eq]": i.filterEnvironmentsNotEq, "filter[environments][in]": i.filterEnvironmentsIn, "filter[environments][not_in]": i.filterEnvironmentsNotIn, "filter[labels][eq]": i.filterLabelsEq, "filter[labels][not_eq]": i.filterLabelsNotEq, "filter[labels][in]": i.filterLabelsIn, "filter[labels][not_in]": i.filterLabelsNotIn, "page[after]": i.pageAfter, "page[number]": i.pageNumber, "page[size]": i.pageSize })}`,
    input: z
      .object({
        include: z
          .enum([
            "environments",
            "services",
            "groups",
            "functionalities",
            "responders",
            "incidents",
            "notified_users",
            "events",
            "alert_urgency",
            "heartbeat",
            "live_call_router",
            "alert_group",
            "group_leader_alert",
            "group_member_alerts",
            "alert_field_values",
            "alerting_targets",
            "escalation_policies",
            "alert_call_recording",
          ])
          .optional(),
        filterStatus: z.string().max(4_000).optional(),
        filterSource: z.string().max(4_000).optional(),
        filterServices: z.string().max(4_000).optional(),
        filterEnvironments: z.string().max(4_000).optional(),
        filterGroups: z.string().max(4_000).optional(),
        filterLabels: z.string().max(4_000).optional(),
        filterStartedAtGt: z.string().max(4_000).optional(),
        filterStartedAtGte: z.string().max(4_000).optional(),
        filterStartedAtLt: z.string().max(4_000).optional(),
        filterStartedAtLte: z.string().max(4_000).optional(),
        filterEndedAtGt: z.string().max(4_000).optional(),
        filterEndedAtGte: z.string().max(4_000).optional(),
        filterEndedAtLt: z.string().max(4_000).optional(),
        filterEndedAtLte: z.string().max(4_000).optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        filterUpdatedAtGt: z.string().max(4_000).optional(),
        filterUpdatedAtGte: z.string().max(4_000).optional(),
        filterUpdatedAtLt: z.string().max(4_000).optional(),
        filterUpdatedAtLte: z.string().max(4_000).optional(),
        filterStatusEq: z.string().max(4_000).optional(),
        filterStatusNotEq: z.string().max(4_000).optional(),
        filterStatusIn: z.string().max(4_000).optional(),
        filterStatusNotIn: z.string().max(4_000).optional(),
        filterSourceEq: z.string().max(4_000).optional(),
        filterSourceNotEq: z.string().max(4_000).optional(),
        filterSourceIn: z.string().max(4_000).optional(),
        filterSourceNotIn: z.string().max(4_000).optional(),
        filterServicesEq: z.string().max(4_000).optional(),
        filterServicesNotEq: z.string().max(4_000).optional(),
        filterServicesIn: z.string().max(4_000).optional(),
        filterServicesNotIn: z.string().max(4_000).optional(),
        filterGroupsEq: z.string().max(4_000).optional(),
        filterGroupsNotEq: z.string().max(4_000).optional(),
        filterGroupsIn: z.string().max(4_000).optional(),
        filterGroupsNotIn: z.string().max(4_000).optional(),
        filterEnvironmentsEq: z.string().max(4_000).optional(),
        filterEnvironmentsNotEq: z.string().max(4_000).optional(),
        filterEnvironmentsIn: z.string().max(4_000).optional(),
        filterEnvironmentsNotIn: z.string().max(4_000).optional(),
        filterLabelsEq: z.string().max(4_000).optional(),
        filterLabelsNotEq: z.string().max(4_000).optional(),
        filterLabelsIn: z.string().max(4_000).optional(),
        filterLabelsNotIn: z.string().max(4_000).optional(),
        pageAfter: z.string().max(4_000).optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "add-incident-event",
    name: "Add Incident Event",
    description: "Add a timeline event to an existing incident in Rootly.",
    method: "POST",
    url: (i) => `/v1/incidents/${restSegment(i.incidentId)}/events`,
    input: z
      .object({
        incidentId: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "list-services",
    name: "List Services",
    description: "List services from Rootly with optional search filtering.",
    method: "GET",
    url: (i) =>
      `/v1/services${restQuery({ include: i.include, "page[number]": i.pageNumber, "page[size]": i.pageSize, "filter[search]": i.filterSearch, "filter[name]": i.filterName, "filter[slug]": i.filterSlug, "filter[backstage_id]": i.filterBackstageId, "filter[cortex_id]": i.filterCortexId, "filter[opslevel_id]": i.filterOpslevelId, "filter[external_id]": i.filterExternalId, "filter[alert_broadcast_enabled]": i.filterAlertBroadcastEnabled, "filter[incident_broadcast_enabled]": i.filterIncidentBroadcastEnabled, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, "filter[name][eq]": i.filterNameEq, "filter[name][not_eq]": i.filterNameNotEq, "filter[name][in]": i.filterNameIn, "filter[name][not_in]": i.filterNameNotIn, "filter[slug][eq]": i.filterSlugEq, "filter[slug][not_eq]": i.filterSlugNotEq, "filter[slug][in]": i.filterSlugIn, "filter[slug][not_in]": i.filterSlugNotIn, "filter[alert_broadcast_enabled][eq]": i.filterAlertBroadcastEnabledEq, "filter[alert_broadcast_enabled][not_eq]": i.filterAlertBroadcastEnabledNotEq, "filter[alert_broadcast_enabled][in]": i.filterAlertBroadcastEnabledIn, "filter[alert_broadcast_enabled][not_in]": i.filterAlertBroadcastEnabledNotIn, "filter[incident_broadcast_enabled][eq]": i.filterIncidentBroadcastEnabledEq, "filter[incident_broadcast_enabled][not_eq]": i.filterIncidentBroadcastEnabledNotEq, "filter[incident_broadcast_enabled][in]": i.filterIncidentBroadcastEnabledIn, "filter[incident_broadcast_enabled][not_in]": i.filterIncidentBroadcastEnabledNotIn, sort: i.sort })}`,
    input: z
      .object({
        include: z.string().max(4_000).optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filterSearch: z.string().max(4_000).optional(),
        filterName: z.string().max(4_000).optional(),
        filterSlug: z.string().max(4_000).optional(),
        filterBackstageId: z.string().max(4_000).optional(),
        filterCortexId: z.string().max(4_000).optional(),
        filterOpslevelId: z.string().max(4_000).optional(),
        filterExternalId: z.string().max(4_000).optional(),
        filterAlertBroadcastEnabled: z.boolean().optional(),
        filterIncidentBroadcastEnabled: z.boolean().optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        filterNameEq: z.string().max(4_000).optional(),
        filterNameNotEq: z.string().max(4_000).optional(),
        filterNameIn: z.string().max(4_000).optional(),
        filterNameNotIn: z.string().max(4_000).optional(),
        filterSlugEq: z.string().max(4_000).optional(),
        filterSlugNotEq: z.string().max(4_000).optional(),
        filterSlugIn: z.string().max(4_000).optional(),
        filterSlugNotIn: z.string().max(4_000).optional(),
        filterAlertBroadcastEnabledEq: z.string().max(4_000).optional(),
        filterAlertBroadcastEnabledNotEq: z.string().max(4_000).optional(),
        filterAlertBroadcastEnabledIn: z.string().max(4_000).optional(),
        filterAlertBroadcastEnabledNotIn: z.string().max(4_000).optional(),
        filterIncidentBroadcastEnabledEq: z.string().max(4_000).optional(),
        filterIncidentBroadcastEnabledNotEq: z.string().max(4_000).optional(),
        filterIncidentBroadcastEnabledIn: z.string().max(4_000).optional(),
        filterIncidentBroadcastEnabledNotIn: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-severities",
    name: "List Severities",
    description: "List severity levels configured in Rootly.",
    method: "GET",
    url: (i) =>
      `/v1/severities${restQuery({ include: i.include, "page[number]": i.pageNumber, "page[size]": i.pageSize, "filter[search]": i.filterSearch, "filter[slug]": i.filterSlug, "filter[name]": i.filterName, "filter[severity]": i.filterSeverity, "filter[color]": i.filterColor, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, "filter[slug][eq]": i.filterSlugEq, "filter[slug][not_eq]": i.filterSlugNotEq, "filter[slug][in]": i.filterSlugIn, "filter[slug][not_in]": i.filterSlugNotIn, "filter[name][eq]": i.filterNameEq, "filter[name][not_eq]": i.filterNameNotEq, "filter[name][in]": i.filterNameIn, "filter[name][not_in]": i.filterNameNotIn, "filter[severity][eq]": i.filterSeverityEq, "filter[severity][not_eq]": i.filterSeverityNotEq, "filter[severity][in]": i.filterSeverityIn, "filter[severity][not_in]": i.filterSeverityNotIn, "filter[color][eq]": i.filterColorEq, "filter[color][not_eq]": i.filterColorNotEq, "filter[color][in]": i.filterColorIn, "filter[color][not_in]": i.filterColorNotIn, sort: i.sort })}`,
    input: z
      .object({
        include: z.string().max(4_000).optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filterSearch: z.string().max(4_000).optional(),
        filterSlug: z.string().max(4_000).optional(),
        filterName: z.string().max(4_000).optional(),
        filterSeverity: z.string().max(4_000).optional(),
        filterColor: z.string().max(4_000).optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        filterSlugEq: z.string().max(4_000).optional(),
        filterSlugNotEq: z.string().max(4_000).optional(),
        filterSlugIn: z.string().max(4_000).optional(),
        filterSlugNotIn: z.string().max(4_000).optional(),
        filterNameEq: z.string().max(4_000).optional(),
        filterNameNotEq: z.string().max(4_000).optional(),
        filterNameIn: z.string().max(4_000).optional(),
        filterNameNotIn: z.string().max(4_000).optional(),
        filterSeverityEq: z.string().max(4_000).optional(),
        filterSeverityNotEq: z.string().max(4_000).optional(),
        filterSeverityIn: z.string().max(4_000).optional(),
        filterSeverityNotIn: z.string().max(4_000).optional(),
        filterColorEq: z.string().max(4_000).optional(),
        filterColorNotEq: z.string().max(4_000).optional(),
        filterColorIn: z.string().max(4_000).optional(),
        filterColorNotIn: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-teams",
    name: "List Teams",
    description: "List teams (groups) configured in Rootly.",
    method: "GET",
    url: (i) =>
      `/v1/teams${restQuery({ include: i.include, "page[number]": i.pageNumber, "page[size]": i.pageSize, "filter[search]": i.filterSearch, "filter[slug]": i.filterSlug, "filter[name]": i.filterName, "filter[backstage_id]": i.filterBackstageId, "filter[cortex_id]": i.filterCortexId, "filter[opslevel_id]": i.filterOpslevelId, "filter[external_id]": i.filterExternalId, "filter[color]": i.filterColor, "filter[alert_broadcast_enabled]": i.filterAlertBroadcastEnabled, "filter[incident_broadcast_enabled]": i.filterIncidentBroadcastEnabled, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, "filter[slug][eq]": i.filterSlugEq, "filter[slug][not_eq]": i.filterSlugNotEq, "filter[slug][in]": i.filterSlugIn, "filter[slug][not_in]": i.filterSlugNotIn, "filter[name][eq]": i.filterNameEq, "filter[name][not_eq]": i.filterNameNotEq, "filter[name][in]": i.filterNameIn, "filter[name][not_in]": i.filterNameNotIn, "filter[color][eq]": i.filterColorEq, "filter[color][not_eq]": i.filterColorNotEq, "filter[color][in]": i.filterColorIn, "filter[color][not_in]": i.filterColorNotIn, "filter[alert_broadcast_enabled][eq]": i.filterAlertBroadcastEnabledEq, "filter[alert_broadcast_enabled][not_eq]": i.filterAlertBroadcastEnabledNotEq, "filter[alert_broadcast_enabled][in]": i.filterAlertBroadcastEnabledIn, "filter[alert_broadcast_enabled][not_in]": i.filterAlertBroadcastEnabledNotIn, "filter[incident_broadcast_enabled][eq]": i.filterIncidentBroadcastEnabledEq, "filter[incident_broadcast_enabled][not_eq]": i.filterIncidentBroadcastEnabledNotEq, "filter[incident_broadcast_enabled][in]": i.filterIncidentBroadcastEnabledIn, "filter[incident_broadcast_enabled][not_in]": i.filterIncidentBroadcastEnabledNotIn, sort: i.sort })}`,
    input: z
      .object({
        include: z
          .enum(["users", "schedules", "escalation_policies"])
          .optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filterSearch: z.string().max(4_000).optional(),
        filterSlug: z.string().max(4_000).optional(),
        filterName: z.string().max(4_000).optional(),
        filterBackstageId: z.string().max(4_000).optional(),
        filterCortexId: z.string().max(4_000).optional(),
        filterOpslevelId: z.string().max(4_000).optional(),
        filterExternalId: z.string().max(4_000).optional(),
        filterColor: z.string().max(4_000).optional(),
        filterAlertBroadcastEnabled: z.boolean().optional(),
        filterIncidentBroadcastEnabled: z.boolean().optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        filterSlugEq: z.string().max(4_000).optional(),
        filterSlugNotEq: z.string().max(4_000).optional(),
        filterSlugIn: z.string().max(4_000).optional(),
        filterSlugNotIn: z.string().max(4_000).optional(),
        filterNameEq: z.string().max(4_000).optional(),
        filterNameNotEq: z.string().max(4_000).optional(),
        filterNameIn: z.string().max(4_000).optional(),
        filterNameNotIn: z.string().max(4_000).optional(),
        filterColorEq: z.string().max(4_000).optional(),
        filterColorNotEq: z.string().max(4_000).optional(),
        filterColorIn: z.string().max(4_000).optional(),
        filterColorNotIn: z.string().max(4_000).optional(),
        filterAlertBroadcastEnabledEq: z.string().max(4_000).optional(),
        filterAlertBroadcastEnabledNotEq: z.string().max(4_000).optional(),
        filterAlertBroadcastEnabledIn: z.string().max(4_000).optional(),
        filterAlertBroadcastEnabledNotIn: z.string().max(4_000).optional(),
        filterIncidentBroadcastEnabledEq: z.string().max(4_000).optional(),
        filterIncidentBroadcastEnabledNotEq: z.string().max(4_000).optional(),
        filterIncidentBroadcastEnabledIn: z.string().max(4_000).optional(),
        filterIncidentBroadcastEnabledNotIn: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-environments",
    name: "List Environments",
    description: "List environments configured in Rootly.",
    method: "GET",
    url: (i) =>
      `/v1/environments${restQuery({ include: i.include, "page[number]": i.pageNumber, "page[size]": i.pageSize, "filter[search]": i.filterSearch, "filter[slug]": i.filterSlug, "filter[name]": i.filterName, "filter[color]": i.filterColor, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, "filter[slug][eq]": i.filterSlugEq, "filter[slug][not_eq]": i.filterSlugNotEq, "filter[slug][in]": i.filterSlugIn, "filter[slug][not_in]": i.filterSlugNotIn, "filter[name][eq]": i.filterNameEq, "filter[name][not_eq]": i.filterNameNotEq, "filter[name][in]": i.filterNameIn, "filter[name][not_in]": i.filterNameNotIn, "filter[color][eq]": i.filterColorEq, "filter[color][not_eq]": i.filterColorNotEq, "filter[color][in]": i.filterColorIn, "filter[color][not_in]": i.filterColorNotIn, sort: i.sort })}`,
    input: z
      .object({
        include: z.string().max(4_000).optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filterSearch: z.string().max(4_000).optional(),
        filterSlug: z.string().max(4_000).optional(),
        filterName: z.string().max(4_000).optional(),
        filterColor: z.string().max(4_000).optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        filterSlugEq: z.string().max(4_000).optional(),
        filterSlugNotEq: z.string().max(4_000).optional(),
        filterSlugIn: z.string().max(4_000).optional(),
        filterSlugNotIn: z.string().max(4_000).optional(),
        filterNameEq: z.string().max(4_000).optional(),
        filterNameNotEq: z.string().max(4_000).optional(),
        filterNameIn: z.string().max(4_000).optional(),
        filterNameNotIn: z.string().max(4_000).optional(),
        filterColorEq: z.string().max(4_000).optional(),
        filterColorNotEq: z.string().max(4_000).optional(),
        filterColorIn: z.string().max(4_000).optional(),
        filterColorNotIn: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-incident-types",
    name: "List Incident Types",
    description: "List incident types configured in Rootly.",
    method: "GET",
    url: (i) =>
      `/v1/incident_types${restQuery({ include: i.include, "page[number]": i.pageNumber, "page[size]": i.pageSize, "filter[slug]": i.filterSlug, "filter[name]": i.filterName, "filter[color]": i.filterColor, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, "filter[slug][eq]": i.filterSlugEq, "filter[slug][not_eq]": i.filterSlugNotEq, "filter[slug][in]": i.filterSlugIn, "filter[slug][not_in]": i.filterSlugNotIn, "filter[name][eq]": i.filterNameEq, "filter[name][not_eq]": i.filterNameNotEq, "filter[name][in]": i.filterNameIn, "filter[name][not_in]": i.filterNameNotIn, "filter[color][eq]": i.filterColorEq, "filter[color][not_eq]": i.filterColorNotEq, "filter[color][in]": i.filterColorIn, "filter[color][not_in]": i.filterColorNotIn, sort: i.sort })}`,
    input: z
      .object({
        include: z.string().max(4_000).optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filterSlug: z.string().max(4_000).optional(),
        filterName: z.string().max(4_000).optional(),
        filterColor: z.string().max(4_000).optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        filterSlugEq: z.string().max(4_000).optional(),
        filterSlugNotEq: z.string().max(4_000).optional(),
        filterSlugIn: z.string().max(4_000).optional(),
        filterSlugNotIn: z.string().max(4_000).optional(),
        filterNameEq: z.string().max(4_000).optional(),
        filterNameNotEq: z.string().max(4_000).optional(),
        filterNameIn: z.string().max(4_000).optional(),
        filterNameNotIn: z.string().max(4_000).optional(),
        filterColorEq: z.string().max(4_000).optional(),
        filterColorNotEq: z.string().max(4_000).optional(),
        filterColorIn: z.string().max(4_000).optional(),
        filterColorNotIn: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-functionalities",
    name: "List Functionalities",
    description: "List functionalities configured in Rootly.",
    method: "GET",
    url: (i) =>
      `/v1/functionalities${restQuery({ include: i.include, "page[number]": i.pageNumber, "page[size]": i.pageSize, "filter[search]": i.filterSearch, "filter[name]": i.filterName, "filter[backstage_id]": i.filterBackstageId, "filter[cortex_id]": i.filterCortexId, "filter[opslevel_id]": i.filterOpslevelId, "filter[external_id]": i.filterExternalId, "filter[slug]": i.filterSlug, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, "filter[name][eq]": i.filterNameEq, "filter[name][not_eq]": i.filterNameNotEq, "filter[name][in]": i.filterNameIn, "filter[name][not_in]": i.filterNameNotIn, "filter[slug][eq]": i.filterSlugEq, "filter[slug][not_eq]": i.filterSlugNotEq, "filter[slug][in]": i.filterSlugIn, "filter[slug][not_in]": i.filterSlugNotIn, sort: i.sort })}`,
    input: z
      .object({
        include: z.string().max(4_000).optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filterSearch: z.string().max(4_000).optional(),
        filterName: z.string().max(4_000).optional(),
        filterBackstageId: z.string().max(4_000).optional(),
        filterCortexId: z.string().max(4_000).optional(),
        filterOpslevelId: z.string().max(4_000).optional(),
        filterExternalId: z.string().max(4_000).optional(),
        filterSlug: z.string().max(4_000).optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        filterNameEq: z.string().max(4_000).optional(),
        filterNameNotEq: z.string().max(4_000).optional(),
        filterNameIn: z.string().max(4_000).optional(),
        filterNameNotIn: z.string().max(4_000).optional(),
        filterSlugEq: z.string().max(4_000).optional(),
        filterSlugNotEq: z.string().max(4_000).optional(),
        filterSlugIn: z.string().max(4_000).optional(),
        filterSlugNotIn: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "delete-incident",
    name: "Delete Incident",
    description: "Delete an incident by ID from Rootly.",
    method: "DELETE",
    url: (i) => `/v1/incidents/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "get-alert",
    name: "Get Alert",
    description: "Retrieve a single alert by ID from Rootly.",
    method: "GET",
    url: (i) =>
      `/v1/alerts/${restSegment(i.id)}${restQuery({ include: i.include })}`,
    input: z
      .object({
        id: z.string().max(4_000),
        include: z
          .enum([
            "environments",
            "services",
            "groups",
            "functionalities",
            "responders",
            "incidents",
            "notified_users",
            "events",
            "alert_urgency",
            "heartbeat",
            "live_call_router",
            "alert_group",
            "group_leader_alert",
            "group_member_alerts",
            "alert_field_values",
            "alerting_targets",
            "escalation_policies",
            "alert_call_recording",
          ])
          .optional(),
      })
      .strict(),
  },
  {
    action: "update-alert",
    name: "Update Alert",
    description: "Update an existing alert in Rootly.",
    method: "PATCH",
    url: (i) => `/v1/alerts/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "acknowledge-alert",
    name: "Acknowledge Alert",
    description: "Acknowledge an alert in Rootly.",
    method: "POST",
    url: (i) => `/v1/alerts/${restSegment(i.id)}/acknowledge`,
    input: z
      .object({
        id: z.string().max(4_000),
        body: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.body ?? {}),
    }),
  },
  {
    action: "resolve-alert",
    name: "Resolve Alert",
    description: "Resolve an alert in Rootly.",
    method: "POST",
    url: (i) => `/v1/alerts/${restSegment(i.id)}/resolve`,
    input: z
      .object({
        id: z.string().max(4_000),
        data: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.data !== undefined ? { data: i.data } : {}),
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "create-action-item",
    name: "Create Action Item",
    description: "Create a new action item for an incident in Rootly.",
    method: "POST",
    url: (i) => `/v1/incidents/${restSegment(i.incidentId)}/action_items`,
    input: z
      .object({
        incidentId: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "list-action-items",
    name: "List Action Items",
    description: "List action items for an incident in Rootly.",
    method: "GET",
    url: (i) =>
      `/v1/action_items${restQuery({ include: i.include, "page[number]": i.pageNumber, "page[size]": i.pageSize, "filter[kind]": i.filterKind, "filter[priority]": i.filterPriority, "filter[status]": i.filterStatus, "filter[incident_status]": i.filterIncidentStatus, "filter[incident_created_at][gt]": i.filterIncidentCreatedAtGt, "filter[incident_created_at][gte]": i.filterIncidentCreatedAtGte, "filter[incident_created_at][lt]": i.filterIncidentCreatedAtLt, "filter[incident_created_at][lte]": i.filterIncidentCreatedAtLte, "filter[due_date][gt]": i.filterDueDateGt, "filter[due_date][gte]": i.filterDueDateGte, "filter[due_date][lt]": i.filterDueDateLt, "filter[due_date][lte]": i.filterDueDateLte, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, "filter[kind][eq]": i.filterKindEq, "filter[kind][not_eq]": i.filterKindNotEq, "filter[kind][in]": i.filterKindIn, "filter[kind][not_in]": i.filterKindNotIn, "filter[priority][eq]": i.filterPriorityEq, "filter[priority][not_eq]": i.filterPriorityNotEq, "filter[priority][in]": i.filterPriorityIn, "filter[priority][not_in]": i.filterPriorityNotIn, "filter[status][eq]": i.filterStatusEq, "filter[status][not_eq]": i.filterStatusNotEq, "filter[status][in]": i.filterStatusIn, "filter[status][not_in]": i.filterStatusNotIn, "filter[incident_status][eq]": i.filterIncidentStatusEq, "filter[incident_status][not_eq]": i.filterIncidentStatusNotEq, "filter[incident_status][in]": i.filterIncidentStatusIn, "filter[incident_status][not_in]": i.filterIncidentStatusNotIn, sort: i.sort })}`,
    input: z
      .object({
        include: z.string().max(4_000).optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filterKind: z.string().max(4_000).optional(),
        filterPriority: z.string().max(4_000).optional(),
        filterStatus: z.string().max(4_000).optional(),
        filterIncidentStatus: z.string().max(4_000).optional(),
        filterIncidentCreatedAtGt: z.string().max(4_000).optional(),
        filterIncidentCreatedAtGte: z.string().max(4_000).optional(),
        filterIncidentCreatedAtLt: z.string().max(4_000).optional(),
        filterIncidentCreatedAtLte: z.string().max(4_000).optional(),
        filterDueDateGt: z.string().max(4_000).optional(),
        filterDueDateGte: z.string().max(4_000).optional(),
        filterDueDateLt: z.string().max(4_000).optional(),
        filterDueDateLte: z.string().max(4_000).optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        filterKindEq: z.string().max(4_000).optional(),
        filterKindNotEq: z.string().max(4_000).optional(),
        filterKindIn: z.string().max(4_000).optional(),
        filterKindNotIn: z.string().max(4_000).optional(),
        filterPriorityEq: z.string().max(4_000).optional(),
        filterPriorityNotEq: z.string().max(4_000).optional(),
        filterPriorityIn: z.string().max(4_000).optional(),
        filterPriorityNotIn: z.string().max(4_000).optional(),
        filterStatusEq: z.string().max(4_000).optional(),
        filterStatusNotEq: z.string().max(4_000).optional(),
        filterStatusIn: z.string().max(4_000).optional(),
        filterStatusNotIn: z.string().max(4_000).optional(),
        filterIncidentStatusEq: z.string().max(4_000).optional(),
        filterIncidentStatusNotEq: z.string().max(4_000).optional(),
        filterIncidentStatusIn: z.string().max(4_000).optional(),
        filterIncidentStatusNotIn: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-users",
    name: "List Users",
    description:
      "List users from Rootly with optional search and email filtering.",
    method: "GET",
    url: (i) =>
      `/v1/users${restQuery({ "page[number]": i.pageNumber, "page[size]": i.pageSize, "filter[search]": i.filterSearch, "filter[email]": i.filterEmail, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, sort: i.sort, include: i.include })}`,
    input: z
      .object({
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filterSearch: z.string().max(4_000).optional(),
        filterEmail: z.string().max(4_000).optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        sort: z
          .enum(["created_at", "-created_at", "updated_at", "-updated_at"])
          .optional(),
        include: z
          .enum([
            "email_addresses",
            "phone_numbers",
            "devices",
            "role",
            "on_call_role",
            "teams",
            "schedules",
            "notification_rules",
          ])
          .optional(),
      })
      .strict(),
  },
  {
    action: "list-schedules",
    name: "List Schedules",
    description:
      "List on-call schedules from Rootly with optional search filtering.",
    method: "GET",
    url: (i) =>
      `/v1/schedules${restQuery({ include: i.include, "filter[search]": i.filterSearch, "filter[name]": i.filterName, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, "filter[name][eq]": i.filterNameEq, "filter[name][not_eq]": i.filterNameNotEq, "filter[name][in]": i.filterNameIn, "filter[name][not_in]": i.filterNameNotIn, "page[number]": i.pageNumber, "page[size]": i.pageSize })}`,
    input: z
      .object({
        include: z.string().max(4_000).optional(),
        filterSearch: z.string().max(4_000).optional(),
        filterName: z.string().max(4_000).optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        filterNameEq: z.string().max(4_000).optional(),
        filterNameNotEq: z.string().max(4_000).optional(),
        filterNameIn: z.string().max(4_000).optional(),
        filterNameNotIn: z.string().max(4_000).optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "list-escalation-policies",
    name: "List Escalation Policies",
    description:
      "List escalation policies from Rootly with optional search filtering.",
    method: "GET",
    url: (i) =>
      `/v1/escalation_policies${restQuery({ include: i.include, "filter[search]": i.filterSearch, "filter[name]": i.filterName, "filter[team_ids]": i.filterTeamIds, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, "filter[name][eq]": i.filterNameEq, "filter[name][not_eq]": i.filterNameNotEq, "filter[name][in]": i.filterNameIn, "filter[name][not_in]": i.filterNameNotIn, "filter[team_ids][eq]": i.filterTeamIdsEq, "filter[team_ids][not_eq]": i.filterTeamIdsNotEq, "filter[team_ids][in]": i.filterTeamIdsIn, "filter[team_ids][not_in]": i.filterTeamIdsNotIn, "page[number]": i.pageNumber, "page[size]": i.pageSize })}`,
    input: z
      .object({
        include: z
          .enum([
            "escalation_policy_levels",
            "escalation_policy_paths",
            "groups",
            "services",
          ])
          .optional(),
        filterSearch: z.string().max(4_000).optional(),
        filterName: z.string().max(4_000).optional(),
        filterTeamIds: z.string().max(4_000).optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        filterNameEq: z.string().max(4_000).optional(),
        filterNameNotEq: z.string().max(4_000).optional(),
        filterNameIn: z.string().max(4_000).optional(),
        filterNameNotIn: z.string().max(4_000).optional(),
        filterTeamIdsEq: z.string().max(4_000).optional(),
        filterTeamIdsNotEq: z.string().max(4_000).optional(),
        filterTeamIdsIn: z.string().max(4_000).optional(),
        filterTeamIdsNotIn: z.string().max(4_000).optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "list-causes",
    name: "List Causes",
    description: "List causes from Rootly with optional search filtering.",
    method: "GET",
    url: (i) =>
      `/v1/causes${restQuery({ include: i.include, "page[number]": i.pageNumber, "page[size]": i.pageSize, "filter[search]": i.filterSearch, "filter[slug]": i.filterSlug, "filter[name]": i.filterName, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, "filter[slug][eq]": i.filterSlugEq, "filter[slug][not_eq]": i.filterSlugNotEq, "filter[slug][in]": i.filterSlugIn, "filter[slug][not_in]": i.filterSlugNotIn, "filter[name][eq]": i.filterNameEq, "filter[name][not_eq]": i.filterNameNotEq, "filter[name][in]": i.filterNameIn, "filter[name][not_in]": i.filterNameNotIn })}`,
    input: z
      .object({
        include: z.string().max(4_000).optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filterSearch: z.string().max(4_000).optional(),
        filterSlug: z.string().max(4_000).optional(),
        filterName: z.string().max(4_000).optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        filterSlugEq: z.string().max(4_000).optional(),
        filterSlugNotEq: z.string().max(4_000).optional(),
        filterSlugIn: z.string().max(4_000).optional(),
        filterSlugNotIn: z.string().max(4_000).optional(),
        filterNameEq: z.string().max(4_000).optional(),
        filterNameNotEq: z.string().max(4_000).optional(),
        filterNameIn: z.string().max(4_000).optional(),
        filterNameNotIn: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-playbooks",
    name: "List Playbooks",
    description: "List playbooks from Rootly with pagination support.",
    method: "GET",
    url: (i) =>
      `/v1/playbooks${restQuery({ include: i.include, "page[number]": i.pageNumber, "page[size]": i.pageSize })}`,
    input: z
      .object({
        include: z
          .enum([
            "severities",
            "environments",
            "services",
            "functionalities",
            "groups",
            "causes",
            "incident_types",
          ])
          .optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "mitigate-incident",
    name: "Mitigate Incident",
    description: "Transition a Rootly incident to the mitigated state.",
    method: "PUT",
    url: (i) => `/v1/incidents/${restSegment(i.id)}/mitigate`,
    input: z
      .object({
        id: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "resolve-incident",
    name: "Resolve Incident",
    description: "Transition a Rootly incident to the resolved state.",
    method: "PUT",
    url: (i) => `/v1/incidents/${restSegment(i.id)}/resolve`,
    input: z
      .object({
        id: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "assign-incident-role",
    name: "Assign Incident Role",
    description:
      "Assign an incident role (e.g. commander) to a user on a Rootly incident.",
    method: "POST",
    url: (i) => `/v1/incidents/${restSegment(i.id)}/assign_role_to_user`,
    input: z
      .object({
        id: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "unassign-incident-role",
    name: "Unassign Incident Role",
    description:
      "Remove an incident role assignment from a user on a Rootly incident.",
    method: "DELETE",
    url: (i) => `/v1/incidents/${restSegment(i.id)}/unassign_role_from_user`,
    input: z
      .object({
        id: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
    emptyResponse: "optional",
  },
  {
    action: "add-subscribers",
    name: "Add Subscribers",
    description:
      "Subscribe users to a Rootly incident so they receive updates.",
    method: "POST",
    url: (i) => `/v1/incidents/${restSegment(i.id)}/add_subscribers`,
    input: z
      .object({
        id: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "remove-subscribers",
    name: "Remove Subscribers",
    description: "Unsubscribe users from a Rootly incident.",
    method: "DELETE",
    url: (i) => `/v1/incidents/${restSegment(i.id)}/remove_subscribers`,
    input: z
      .object({
        id: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
    emptyResponse: "optional",
  },
  {
    action: "create-status-page-event",
    name: "Create Status Page Event",
    description: "Post a public status page update for a Rootly incident.",
    method: "POST",
    url: (i) => `/v1/incidents/${restSegment(i.incidentId)}/status-page-events`,
    input: z
      .object({
        incidentId: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "update-action-item",
    name: "Update Action Item",
    description:
      "Update a Rootly incident action item (status, priority, assignee, etc.).",
    method: "PUT",
    url: (i) => `/v1/action_items/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "delete-action-item",
    name: "Delete Action Item",
    description: "Delete a Rootly incident action item.",
    method: "DELETE",
    url: (i) => `/v1/action_items/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "snooze-alert",
    name: "Snooze Alert",
    description: "Snooze a Rootly alert for a set number of minutes.",
    method: "POST",
    url: (i) => `/v1/alerts/${restSegment(i.id)}/snooze`,
    input: z
      .object({
        id: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "escalate-alert",
    name: "Escalate Alert",
    description:
      "Escalate a Rootly alert, optionally to a specific escalation policy or level.",
    method: "POST",
    url: (i) => `/v1/alerts/${restSegment(i.id)}/escalate`,
    input: z
      .object({
        id: z.string().max(4_000),
        data: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.data !== undefined ? { data: i.data } : {}),
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "list-incident-events",
    name: "List Incident Events",
    description: "List the timeline events for a Rootly incident.",
    method: "GET",
    url: (i) =>
      `/v1/incidents/${restSegment(i.incidentId)}/events${restQuery({ include: i.include, "page[number]": i.pageNumber, "page[size]": i.pageSize })}`,
    input: z
      .object({
        incidentId: z.string().max(4_000),
        include: z.string().max(4_000).optional(),
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "run-workflow",
    name: "Run Workflow",
    description:
      "Trigger a Rootly automation workflow, optionally scoped to an incident or alert.",
    method: "POST",
    url: (i) => `/v1/workflows/${restSegment(i.workflowId)}/workflow_runs`,
    input: z
      .object({
        workflowId: z.string().max(4_000),
        data: SpecObject,
      })
      .strict(),
    body: (i) => ({
      data: i.data,
    }),
    headers: () => ({ "content-type": "application/vnd.api+json" }),
  },
  {
    action: "list-incident-roles",
    name: "List Incident Roles",
    description:
      "List incident roles configured in Rootly (e.g. commander, scribe).",
    method: "GET",
    url: (i) =>
      `/v1/incident_roles${restQuery({ "page[number]": i.pageNumber, "page[size]": i.pageSize, "filter[search]": i.filterSearch, "filter[slug]": i.filterSlug, "filter[name]": i.filterName, "filter[enabled]": i.filterEnabled, "filter[created_at][gt]": i.filterCreatedAtGt, "filter[created_at][gte]": i.filterCreatedAtGte, "filter[created_at][lt]": i.filterCreatedAtLt, "filter[created_at][lte]": i.filterCreatedAtLte, "filter[slug][eq]": i.filterSlugEq, "filter[slug][not_eq]": i.filterSlugNotEq, "filter[slug][in]": i.filterSlugIn, "filter[slug][not_in]": i.filterSlugNotIn, "filter[name][eq]": i.filterNameEq, "filter[name][not_eq]": i.filterNameNotEq, "filter[name][in]": i.filterNameIn, "filter[name][not_in]": i.filterNameNotIn, "filter[enabled][eq]": i.filterEnabledEq, "filter[enabled][not_eq]": i.filterEnabledNotEq, "filter[enabled][in]": i.filterEnabledIn, "filter[enabled][not_in]": i.filterEnabledNotIn, sort: i.sort })}`,
    input: z
      .object({
        pageNumber: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        filterSearch: z.string().max(4_000).optional(),
        filterSlug: z.string().max(4_000).optional(),
        filterName: z.string().max(4_000).optional(),
        filterEnabled: z.boolean().optional(),
        filterCreatedAtGt: z.string().max(4_000).optional(),
        filterCreatedAtGte: z.string().max(4_000).optional(),
        filterCreatedAtLt: z.string().max(4_000).optional(),
        filterCreatedAtLte: z.string().max(4_000).optional(),
        filterSlugEq: z.string().max(4_000).optional(),
        filterSlugNotEq: z.string().max(4_000).optional(),
        filterSlugIn: z.string().max(4_000).optional(),
        filterSlugNotIn: z.string().max(4_000).optional(),
        filterNameEq: z.string().max(4_000).optional(),
        filterNameNotEq: z.string().max(4_000).optional(),
        filterNameIn: z.string().max(4_000).optional(),
        filterNameNotIn: z.string().max(4_000).optional(),
        filterEnabledEq: z.string().max(4_000).optional(),
        filterEnabledNotEq: z.string().max(4_000).optional(),
        filterEnabledIn: z.string().max(4_000).optional(),
        filterEnabledNotIn: z.string().max(4_000).optional(),
        sort: z.string().max(4_000).optional(),
      })
      .strict(),
  },
];

export function createRootlyPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "rootly",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "list-retrospectives":
        "The document has retrospective_configurations and retrospective_processes, but neither is the list of retrospectives this action names: the first returns configuration objects. Binding either would answer successfully with the wrong resource.",
      "list-on-calls":
        "The document has on_call_roles, on_call_shadows, and shifts. A role is a definition rather than who is on call now, and which of the others the action means is not decidable from the document.",
    },
  });
}
