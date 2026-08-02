import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from copper's published OpenAPI document:
 * https://developer.copper.com/v1/openapi.json
 *
 * This provider is outside the pinned source, so its action table is its own
 * coverage. The table is the shallowest CRUD operations the document declares,
 * capped at 22 — a vendor's top-level resources, not everything it serves.
 */
const SPEC_NOTE =
  "copper publishes no maintained Node SDK; its OpenAPI document at https://developer.copper.com/v1/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-related",
    name: "List Related",
    description: "View all records related to an entity",
    method: "GET",
    url: (i) =>
      `/${restSegment(i.entityType)}/${restSegment(i.entityId)}/related`,
    input: z
      .object({
        entityType: z.enum([
          "leads",
          "people",
          "companies",
          "opportunities",
          "projects",
          "tasks",
        ]),
        entityId: z.number().int().min(-1_000_000_000).max(1_000_000_000),
      })
      .strict(),
  },
  {
    action: "get-related",
    name: "Get Related",
    description: "View all records of a given entity type related to an entity",
    method: "GET",
    url: (i) =>
      `/${restSegment(i.entityType)}/${restSegment(i.entityId)}/related/${restSegment(i.relatedEntityType)}`,
    input: z
      .object({
        entityType: z.enum([
          "leads",
          "people",
          "companies",
          "opportunities",
          "projects",
          "tasks",
        ]),
        entityId: z.number().int().min(-1_000_000_000).max(1_000_000_000),
        relatedEntityType: z.enum([
          "leads",
          "people",
          "companies",
          "opportunities",
          "projects",
          "tasks",
        ]),
      })
      .strict(),
  },
  {
    action: "get-opportunity",
    name: "Get Opportunity",
    description: "Get opportunity by ID",
    method: "GET",
    url: (i) =>
      `/opportunities/${restSegment(i.id)}${restQuery({ custom_field_computed_values: i.customFieldComputedValues })}`,
    input: z
      .object({
        id: z.number().int().min(-1_000_000_000).max(1_000_000_000),
        customFieldComputedValues: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "create-activity",
    name: "Create Activity",
    description: "Get opportunity activities",
    method: "POST",
    url: (i) => `/opportunities/${restSegment(i.id)}/activities`,
    input: z
      .object({
        id: z.number().int().min(-1_000_000_000).max(1_000_000_000),
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
    body: (i) => ({
      ...(i.pageNumber !== undefined ? { page_number: i.pageNumber } : {}),
      ...(i.pageSize !== undefined ? { page_size: i.pageSize } : {}),
    }),
  },
  {
    action: "create-search",
    name: "Create Search",
    description: "Search opportunities",
    method: "POST",
    url: (i) =>
      `/opportunities/search${restQuery({ custom_field_computed_values: i.customFieldComputedValues })}`,
    input: z
      .object({
        customFieldComputedValues: z.boolean().optional(),
        ids: SpecArray.optional(),
        name: z.string().max(4_000).optional(),
        companyName: z.string().max(4_000).optional(),
        companyIds: SpecArray.optional(),
        primaryContactIds: SpecArray.optional(),
        closeDate: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        minimumCloseDate: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maximumCloseDate: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        minimumMonetaryValue: z.number().optional(),
        maximumMonetaryValue: z.number().optional(),
        minimumWinProbability: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maximumWinProbability: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        tags: SpecArray.optional(),
        assigneeIds: SpecArray.optional(),
        pipelineIds: SpecArray.optional(),
        pipelineStageIds: SpecArray.optional(),
        statuses: SpecArray.optional(),
        priorities: SpecArray.optional(),
        lossReasonIds: SpecArray.optional(),
        customerSourceIds: SpecArray.optional(),
        followed: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        age: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
        minimumInteractionCount: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maximumInteractionCount: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        minimumInteractionDate: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maximumInteractionDate: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        minimumDateStageChanged: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maximumDateStageChanged: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        minimumCreatedDate: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maximumCreatedDate: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        minimumModifiedDate: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maximumModifiedDate: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        customFields: SpecArray.optional(),
        sortBy: z
          .enum([
            "assignee",
            "company_name",
            "customer_source_id",
            "date_created",
            "date_modified",
            "inactive_days",
            "interaction_count",
            "last_interaction",
            "monetary_unit",
            "monetary_value",
            "name",
            "primary_contact",
            "priority",
            "stage",
            "status",
          ])
          .optional(),
        sortDirection: z.enum(["asc", "desc"]).optional(),
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
        fields: SpecArray.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.ids !== undefined ? { ids: i.ids } : {}),
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.companyName !== undefined ? { company_name: i.companyName } : {}),
      ...(i.companyIds !== undefined ? { company_ids: i.companyIds } : {}),
      ...(i.primaryContactIds !== undefined
        ? { primary_contact_ids: i.primaryContactIds }
        : {}),
      ...(i.closeDate !== undefined ? { close_date: i.closeDate } : {}),
      ...(i.minimumCloseDate !== undefined
        ? { minimum_close_date: i.minimumCloseDate }
        : {}),
      ...(i.maximumCloseDate !== undefined
        ? { maximum_close_date: i.maximumCloseDate }
        : {}),
      ...(i.minimumMonetaryValue !== undefined
        ? { minimum_monetary_value: i.minimumMonetaryValue }
        : {}),
      ...(i.maximumMonetaryValue !== undefined
        ? { maximum_monetary_value: i.maximumMonetaryValue }
        : {}),
      ...(i.minimumWinProbability !== undefined
        ? { minimum_win_probability: i.minimumWinProbability }
        : {}),
      ...(i.maximumWinProbability !== undefined
        ? { maximum_win_probability: i.maximumWinProbability }
        : {}),
      ...(i.tags !== undefined ? { tags: i.tags } : {}),
      ...(i.assigneeIds !== undefined ? { assignee_ids: i.assigneeIds } : {}),
      ...(i.pipelineIds !== undefined ? { pipeline_ids: i.pipelineIds } : {}),
      ...(i.pipelineStageIds !== undefined
        ? { pipeline_stage_ids: i.pipelineStageIds }
        : {}),
      ...(i.statuses !== undefined ? { statuses: i.statuses } : {}),
      ...(i.priorities !== undefined ? { priorities: i.priorities } : {}),
      ...(i.lossReasonIds !== undefined
        ? { loss_reason_ids: i.lossReasonIds }
        : {}),
      ...(i.customerSourceIds !== undefined
        ? { customer_source_ids: i.customerSourceIds }
        : {}),
      ...(i.followed !== undefined ? { followed: i.followed } : {}),
      ...(i.age !== undefined ? { age: i.age } : {}),
      ...(i.minimumInteractionCount !== undefined
        ? { minimum_interaction_count: i.minimumInteractionCount }
        : {}),
      ...(i.maximumInteractionCount !== undefined
        ? { maximum_interaction_count: i.maximumInteractionCount }
        : {}),
      ...(i.minimumInteractionDate !== undefined
        ? { minimum_interaction_date: i.minimumInteractionDate }
        : {}),
      ...(i.maximumInteractionDate !== undefined
        ? { maximum_interaction_date: i.maximumInteractionDate }
        : {}),
      ...(i.minimumDateStageChanged !== undefined
        ? { minimum_date_stage_changed: i.minimumDateStageChanged }
        : {}),
      ...(i.maximumDateStageChanged !== undefined
        ? { maximum_date_stage_changed: i.maximumDateStageChanged }
        : {}),
      ...(i.minimumCreatedDate !== undefined
        ? { minimum_created_date: i.minimumCreatedDate }
        : {}),
      ...(i.maximumCreatedDate !== undefined
        ? { maximum_created_date: i.maximumCreatedDate }
        : {}),
      ...(i.minimumModifiedDate !== undefined
        ? { minimum_modified_date: i.minimumModifiedDate }
        : {}),
      ...(i.maximumModifiedDate !== undefined
        ? { maximum_modified_date: i.maximumModifiedDate }
        : {}),
      ...(i.customFields !== undefined
        ? { custom_fields: i.customFields }
        : {}),
      ...(i.sortBy !== undefined ? { sort_by: i.sortBy } : {}),
      ...(i.sortDirection !== undefined
        ? { sort_direction: i.sortDirection }
        : {}),
      ...(i.pageNumber !== undefined ? { page_number: i.pageNumber } : {}),
      ...(i.pageSize !== undefined ? { page_size: i.pageSize } : {}),
      ...(i.fields !== undefined ? { fields: i.fields } : {}),
    }),
  },
  {
    action: "get-user",
    name: "Get User",
    description: "Get user by ID",
    method: "GET",
    url: (i) => `/users/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "list-activity-types",
    name: "List Activity Types",
    description: "List activity types",
    method: "GET",
    url: "/activity_types",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "list-contact-types",
    name: "List Contact Types",
    description: "List contact types",
    method: "GET",
    url: "/contact_types",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "list-custom-activity-types",
    name: "List Custom Activity Types",
    description: "List all custom activity types",
    method: "GET",
    url: "/custom_activity_types",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "list-custom-field-definitions",
    name: "List Custom Field Definitions",
    description: "List custom field definitions",
    method: "GET",
    url: "/custom_field_definitions",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "list-customer-sources",
    name: "List Customer Sources",
    description: "List customer sources",
    method: "GET",
    url: "/customer_sources",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "list-lead-statuses",
    name: "List Lead Statuses",
    description: "List lead statuses",
    method: "GET",
    url: "/lead_statuses",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "list-loss-reasons",
    name: "List Loss Reasons",
    description: "List loss reasons",
    method: "GET",
    url: "/loss_reasons",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "list-pipeline-stages",
    name: "List Pipeline Stages",
    description: "List all pipeline stages",
    method: "GET",
    url: "/pipeline_stages",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "list-pipelines",
    name: "List Pipelines",
    description: "List pipelines",
    method: "GET",
    url: "/pipelines",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "list-tags",
    name: "List Tags",
    description: "List all tags",
    method: "GET",
    url: (i) =>
      `/tags${restQuery({ sort_by: i.sortBy, tag_names_only: i.tagNamesOnly, last_tag_value: i.lastTagValue })}`,
    input: z
      .object({
        sortBy: z.enum(["name", "count"]).optional(),
        tagNamesOnly: z.boolean().optional(),
        lastTagValue: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-fetch-by-email",
    name: "Create Fetch By Email",
    description: "Fetch a person by email",
    method: "POST",
    url: (i) =>
      `/people/fetch_by_email${restQuery({ custom_field_computed_values: i.customFieldComputedValues })}`,
    input: z
      .object({
        customFieldComputedValues: z.boolean().optional(),
        email: z.string().max(4_000),
      })
      .strict(),
    body: (i) => ({
      email: i.email,
    }),
  },
  {
    action: "get-by-entity",
    name: "Get By Entity",
    description: "List field layout by entity type",
    method: "GET",
    url: (i) =>
      `/field_layouts/by_entity/${restSegment(i.entityType)}${restQuery({ pipeline_id: i.pipelineId })}`,
    input: z
      .object({
        entityType: z.enum([
          "leads",
          "people",
          "companies",
          "opportunities",
          "projects",
          "tasks",
        ]),
        pipelineId: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
];

export function createCopperPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "copper",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    beyondBaseline: true,
    actions: ACTIONS,
  });
}
