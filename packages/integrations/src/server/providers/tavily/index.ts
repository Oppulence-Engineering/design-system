import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/** Shared review: none of these providers publishes a maintained Node SDK. */
function noSdk(provider: string, note = ""): string {
  return `${provider} publishes no maintained Node SDK; its HTTP API is the supported integration surface.${note ? ` ${note}` : ""}`;
}

const Query = z.string().min(1).max(2_000);
const Limit = z.number().int().min(1).max(100).optional();

// ------------------------------------------------------------------- Tavily

const TAVILY_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "search",
    name: "Search",
    description: "Runs a Tavily web search.",
    method: "POST",
    url: "/search",
    input: z
      .object({
        query: Query,
        searchDepth: z.enum(["basic", "advanced"]).optional(),
        maxResults: Limit,
        includeDomains: z.array(z.string().max(256)).max(50).optional(),
        excludeDomains: z.array(z.string().max(256)).max(50).optional(),
        includeAnswer: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      query: i.query,
      search_depth: i.searchDepth ?? "basic",
      max_results: i.maxResults ?? 5,
      include_answer: i.includeAnswer ?? false,
      ...(i.includeDomains ? { include_domains: i.includeDomains } : {}),
      ...(i.excludeDomains ? { exclude_domains: i.excludeDomains } : {}),
    }),
  },
  {
    action: "extract-content",
    name: "Extract Content",
    description: "Extracts readable content from one or more URLs.",
    method: "POST",
    url: "/extract",
    input: z
      .object({
        urls: z.array(z.string().url().max(2_000)).min(1).max(20),
        extractDepth: z.enum(["basic", "advanced"]).optional(),
      })
      .strict(),
    body: (i) => ({
      urls: i.urls,
      extract_depth: i.extractDepth ?? "basic",
    }),
    maxResponseBytes: 1_048_576,
  },
  {
    action: "crawl-website",
    name: "Crawl Website",
    description: "Crawls a site from a starting URL.",
    method: "POST",
    url: "/crawl",
    input: z
      .object({
        url: z.string().url().max(2_000),
        maxDepth: z.number().int().min(1).max(5).optional(),
        limit: Limit,
        instructions: z.string().max(2_000).optional(),
      })
      .strict(),
    body: (i) => ({
      url: i.url,
      max_depth: i.maxDepth ?? 1,
      limit: i.limit ?? 20,
      ...(i.instructions ? { instructions: i.instructions } : {}),
    }),
    maxResponseBytes: 1_048_576,
  },
  {
    action: "map-website",
    name: "Map Website",
    description: "Lists the URLs reachable from a starting URL.",
    method: "POST",
    url: "/map",
    input: z
      .object({
        url: z.string().url().max(2_000),
        maxDepth: z.number().int().min(1).max(5).optional(),
        limit: Limit,
      })
      .strict(),
    body: (i) => ({
      url: i.url,
      max_depth: i.maxDepth ?? 1,
      limit: i.limit ?? 50,
    }),
  },
];

export function createTavilyPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "tavily",
    sdkReview: noSdk("Tavily"),
    transportKind: "api_key",
    actions: TAVILY_ACTIONS,
  });
}
