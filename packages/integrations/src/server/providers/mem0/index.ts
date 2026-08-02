import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Mem0's published OpenAPI document:
 * https://docs.mem0.ai/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Mem0 publishes no maintained Node SDK; its OpenAPI document at https://docs.mem0.ai/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "add-memories",
    name: "Add Memories",
    description: "Add memories to Mem0 for persistent storage and retrieval",
    method: "POST",
    url: (i) =>
      `/v3/memories/${restQuery({ page: i.page, page_size: i.pageSize })}`,
    input: z
      .object({
        page: z
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
        filters: SpecObject,
        showExpired: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      filters: i.filters,
      ...(i.showExpired !== undefined ? { show_expired: i.showExpired } : {}),
    }),
  },
  {
    action: "search-memories",
    name: "Search Memories",
    description: "Search for memories in Mem0 using semantic search",
    method: "GET",
    url: (i) =>
      `/v1/memories/${restQuery({ user_id: i.userId, agent_id: i.agentId, app_id: i.appId, run_id: i.runId, metadata: i.metadata, categories: i.categories, org_id: i.orgId, project_id: i.projectId, fields: i.fields, keywords: i.keywords, page: i.page, page_size: i.pageSize, start_date: i.startDate, end_date: i.endDate })}`,
    input: z
      .object({
        userId: z.string().max(4_000).optional(),
        agentId: z.string().max(4_000).optional(),
        appId: z.string().max(4_000).optional(),
        runId: z.string().max(4_000).optional(),
        metadata: SpecObject.optional(),
        categories: SpecArray.optional(),
        orgId: z.string().max(4_000).optional(),
        projectId: z.string().max(4_000).optional(),
        fields: SpecArray.optional(),
        keywords: z.string().max(4_000).optional(),
        page: z
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
        startDate: z.string().max(4_000).optional(),
        endDate: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-memories",
    name: "Get Memories",
    description: "Retrieve memories from Mem0 by ID or filter criteria",
    method: "GET",
    url: "/v1/memories/events/",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
];

export function createMem0Pack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "mem0",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
  });
}
