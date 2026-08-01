import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Profound's published OpenAPI document:
 * https://api.tryprofound.com/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Profound publishes no maintained Node SDK; its OpenAPI document at https://api.tryprofound.com/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-categories",
    name: "List Categories",
    description: "List all organization categories in Profound",
    method: "GET",
    url: (i) =>
      `/v1/org/categories${restQuery({ organization_ids: i.organizationIds })}`,
    input: z
      .object({
        organizationIds: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-regions",
    name: "List Regions",
    description: "List all organization regions in Profound",
    method: "GET",
    url: (i) =>
      `/v1/org/regions${restQuery({ organization_ids: i.organizationIds })}`,
    input: z
      .object({
        organizationIds: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-models",
    name: "List Models",
    description: "List all AI models/platforms tracked in Profound",
    method: "GET",
    url: "/v1/org/models",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "list-domains",
    name: "List Domains",
    description: "List all organization domains in Profound",
    method: "GET",
    url: (i) =>
      `/v1/org/domains${restQuery({ organization_ids: i.organizationIds })}`,
    input: z
      .object({
        organizationIds: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-assets",
    name: "List Assets",
    description:
      "List all organization assets (companies/brands) across all categories in Profound",
    method: "GET",
    url: (i) =>
      `/v1/org/assets${restQuery({ organization_ids: i.organizationIds })}`,
    input: z
      .object({
        organizationIds: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-personas",
    name: "List Personas",
    description:
      "List all organization personas across all categories in Profound",
    method: "GET",
    url: (i) =>
      `/v1/org/personas${restQuery({ organization_ids: i.organizationIds })}`,
    input: z
      .object({
        organizationIds: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "category-prompts",
    name: "Category Prompts",
    description: "List prompts for a specific category in Profound",
    method: "POST",
    url: (i) => `/v1/org/categories/${restSegment(i.categoryId)}/prompts`,
    input: z
      .object({
        categoryId: z.string().max(4_000),
        prompts: SpecArray,
        dryRun: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      prompts: i.prompts,
      ...(i.dryRun !== undefined ? { dry_run: i.dryRun } : {}),
    }),
  },
  {
    action: "visibility-report",
    name: "Visibility Report",
    description: "Query AI visibility report for a category in Profound",
    method: "POST",
    url: "/v2/reports/visibility",
    input: z
      .object({
        categoryId: z.string().max(4_000),
        startDate: z.string().max(4_000),
        endDate: z.string().max(4_000),
        groupBy: SpecArray.optional(),
        metrics: z.string().max(4_000).optional(),
        interval: z.enum(["day", "week", "month"]).optional(),
        scope: z.enum(["owned", "all"]).optional(),
        assets: z.string().max(4_000).optional(),
        filter: z.string().max(4_000).optional(),
        sort: SpecObject.optional(),
        limit: z.string().max(4_000).optional(),
        maxResults: z.string().max(4_000).optional(),
        cursor: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      category_id: i.categoryId,
      start_date: i.startDate,
      end_date: i.endDate,
      ...(i.groupBy !== undefined ? { group_by: i.groupBy } : {}),
      ...(i.metrics !== undefined ? { metrics: i.metrics } : {}),
      ...(i.interval !== undefined ? { interval: i.interval } : {}),
      ...(i.scope !== undefined ? { scope: i.scope } : {}),
      ...(i.assets !== undefined ? { assets: i.assets } : {}),
      ...(i.filter !== undefined ? { filter: i.filter } : {}),
      ...(i.sort !== undefined ? { sort: i.sort } : {}),
      ...(i.limit !== undefined ? { limit: i.limit } : {}),
      ...(i.maxResults !== undefined ? { max_results: i.maxResults } : {}),
      ...(i.cursor !== undefined ? { cursor: i.cursor } : {}),
    }),
  },
  {
    action: "sentiment-report",
    name: "Sentiment Report",
    description: "Query sentiment report for a category in Profound",
    method: "POST",
    url: "/v2/reports/sentiment",
    input: z
      .object({
        categoryId: z.string().max(4_000),
        asset: z.string().max(4_000),
        startDate: z.string().max(4_000),
        endDate: z.string().max(4_000),
        comparisonStartDate: z.string().max(4_000).optional(),
        comparisonEndDate: z.string().max(4_000).optional(),
        groupBy: SpecArray.optional(),
        metrics: z.string().max(4_000).optional(),
        interval: z.enum(["day", "week", "month"]).optional(),
        filter: z.string().max(4_000).optional(),
        sort: SpecObject.optional(),
        includeCitedWebsites: z.boolean().optional(),
        limit: z.string().max(4_000).optional(),
        maxResults: z.string().max(4_000).optional(),
        cursor: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      category_id: i.categoryId,
      asset: i.asset,
      start_date: i.startDate,
      end_date: i.endDate,
      ...(i.comparisonStartDate !== undefined
        ? { comparison_start_date: i.comparisonStartDate }
        : {}),
      ...(i.comparisonEndDate !== undefined
        ? { comparison_end_date: i.comparisonEndDate }
        : {}),
      ...(i.groupBy !== undefined ? { group_by: i.groupBy } : {}),
      ...(i.metrics !== undefined ? { metrics: i.metrics } : {}),
      ...(i.interval !== undefined ? { interval: i.interval } : {}),
      ...(i.filter !== undefined ? { filter: i.filter } : {}),
      ...(i.sort !== undefined ? { sort: i.sort } : {}),
      ...(i.includeCitedWebsites !== undefined
        ? { include_cited_websites: i.includeCitedWebsites }
        : {}),
      ...(i.limit !== undefined ? { limit: i.limit } : {}),
      ...(i.maxResults !== undefined ? { max_results: i.maxResults } : {}),
      ...(i.cursor !== undefined ? { cursor: i.cursor } : {}),
    }),
  },
  {
    action: "citations-report",
    name: "Citations Report",
    description: "Query citations report for a category in Profound",
    method: "POST",
    url: "/v2/reports/citations",
    input: z
      .object({
        categoryId: z.string().max(4_000),
        startDate: z.string().max(4_000),
        endDate: z.string().max(4_000),
        entity: z.enum(["domain", "page", "citation_category"]).optional(),
        groupBy: SpecArray.optional(),
        metrics: z.string().max(4_000).optional(),
        interval: z.enum(["day", "week", "month"]).optional(),
        scope: z.enum(["all", "owned"]).optional(),
        filter: z.string().max(4_000).optional(),
        limit: z.string().max(4_000).optional(),
        maxResults: z.string().max(4_000).optional(),
        cursor: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      category_id: i.categoryId,
      start_date: i.startDate,
      end_date: i.endDate,
      ...(i.entity !== undefined ? { entity: i.entity } : {}),
      ...(i.groupBy !== undefined ? { group_by: i.groupBy } : {}),
      ...(i.metrics !== undefined ? { metrics: i.metrics } : {}),
      ...(i.interval !== undefined ? { interval: i.interval } : {}),
      ...(i.scope !== undefined ? { scope: i.scope } : {}),
      ...(i.filter !== undefined ? { filter: i.filter } : {}),
      ...(i.limit !== undefined ? { limit: i.limit } : {}),
      ...(i.maxResults !== undefined ? { max_results: i.maxResults } : {}),
      ...(i.cursor !== undefined ? { cursor: i.cursor } : {}),
    }),
  },
  {
    action: "prompt-answers",
    name: "Prompt Answers",
    description: "Get raw prompt answers data for a category in Profound",
    method: "POST",
    url: "/v2/prompts/answers",
    input: z
      .object({
        categoryId: z.string().max(4_000),
        startDate: z.string().max(4_000),
        endDate: z.string().max(4_000),
        include: z.string().max(4_000).optional(),
        filter: z.string().max(4_000).optional(),
        limit: z.string().max(4_000).optional(),
        maxResults: z.string().max(4_000).optional(),
        cursor: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      category_id: i.categoryId,
      start_date: i.startDate,
      end_date: i.endDate,
      ...(i.include !== undefined ? { include: i.include } : {}),
      ...(i.filter !== undefined ? { filter: i.filter } : {}),
      ...(i.limit !== undefined ? { limit: i.limit } : {}),
      ...(i.maxResults !== undefined ? { max_results: i.maxResults } : {}),
      ...(i.cursor !== undefined ? { cursor: i.cursor } : {}),
    }),
  },
  {
    action: "bots-report",
    name: "Bots Report",
    description:
      "Query bot traffic report with hourly granularity for a domain in Profound",
    method: "POST",
    url: "/v2/reports/bots",
    input: z
      .object({
        dateInterval: z
          .enum([
            "hour",
            "day",
            "week",
            "month",
            "quarter",
            "year",
            "relative_week",
          ])
          .optional(),
        dimensions: SpecArray.optional(),
        metrics: SpecArray,
        orderBy: SpecObject.optional(),
        pagination: SpecObject.optional(),
        domain: z.string().max(4_000),
        startDate: z.string().max(4_000),
        endDate: z.string().max(4_000).optional(),
        organizationId: z.string().max(4_000).optional(),
        timezone: z.string().max(4_000).optional(),
        metricFilters: SpecArray.optional(),
        filters: SpecArray.optional(),
        domainId: z.string().max(4_000).optional(),
        tags: SpecArray.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.dateInterval !== undefined
        ? { date_interval: i.dateInterval }
        : {}),
      ...(i.dimensions !== undefined ? { dimensions: i.dimensions } : {}),
      metrics: i.metrics,
      ...(i.orderBy !== undefined ? { order_by: i.orderBy } : {}),
      ...(i.pagination !== undefined ? { pagination: i.pagination } : {}),
      domain: i.domain,
      start_date: i.startDate,
      ...(i.endDate !== undefined ? { end_date: i.endDate } : {}),
      ...(i.organizationId !== undefined
        ? { organization_id: i.organizationId }
        : {}),
      ...(i.timezone !== undefined ? { timezone: i.timezone } : {}),
      ...(i.metricFilters !== undefined
        ? { metric_filters: i.metricFilters }
        : {}),
      ...(i.filters !== undefined ? { filters: i.filters } : {}),
      ...(i.domainId !== undefined ? { domain_id: i.domainId } : {}),
      ...(i.tags !== undefined ? { tags: i.tags } : {}),
    }),
  },
  {
    action: "referrals-report",
    name: "Referrals Report",
    description:
      "Query human referral traffic report with hourly granularity for a domain in Profound",
    method: "POST",
    url: "/v2/reports/referrals",
    input: z
      .object({
        dateInterval: z
          .enum([
            "hour",
            "day",
            "week",
            "month",
            "quarter",
            "year",
            "relative_week",
          ])
          .optional(),
        dimensions: SpecArray.optional(),
        metrics: SpecArray,
        orderBy: SpecObject.optional(),
        pagination: SpecObject.optional(),
        domain: z.string().max(4_000),
        startDate: z.string().max(4_000),
        endDate: z.string().max(4_000).optional(),
        organizationId: z.string().max(4_000).optional(),
        timezone: z.string().max(4_000).optional(),
        metricFilters: SpecArray.optional(),
        filters: SpecArray.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.dateInterval !== undefined
        ? { date_interval: i.dateInterval }
        : {}),
      ...(i.dimensions !== undefined ? { dimensions: i.dimensions } : {}),
      metrics: i.metrics,
      ...(i.orderBy !== undefined ? { order_by: i.orderBy } : {}),
      ...(i.pagination !== undefined ? { pagination: i.pagination } : {}),
      domain: i.domain,
      start_date: i.startDate,
      ...(i.endDate !== undefined ? { end_date: i.endDate } : {}),
      ...(i.organizationId !== undefined
        ? { organization_id: i.organizationId }
        : {}),
      ...(i.timezone !== undefined ? { timezone: i.timezone } : {}),
      ...(i.metricFilters !== undefined
        ? { metric_filters: i.metricFilters }
        : {}),
      ...(i.filters !== undefined ? { filters: i.filters } : {}),
    }),
  },
  {
    action: "list-optimizations",
    name: "List Optimizations",
    description: "List content optimization entries for an asset in Profound",
    method: "GET",
    url: (i) =>
      `/v1/content/${restSegment(i.assetId)}/optimization${restQuery({ limit: i.limit, offset: i.offset })}`,
    input: z
      .object({
        assetId: z.string().max(4_000),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        offset: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
];

export function createProfoundPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "profound",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "category-topics":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "category-tags":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "category-assets":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "category-personas":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "query-fanouts":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "raw-logs":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "bot-logs":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "optimization-analysis":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "prompt-volume":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "citation-prompts":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
