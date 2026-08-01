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

// ---------------------------------------------------------------- Wikipedia

const WIKIPEDIA_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "get-page-summary",
    name: "Get Page Summary",
    description: "Reads the summary extract of a Wikipedia page.",
    method: "GET",
    url: (i) => `/api/rest_v1/page/summary/${restSegment(i.title)}`,
    input: z.object({ title: z.string().min(1).max(512) }).strict(),
  },
  {
    action: "get-page-content",
    name: "Get Page Content",
    description: "Reads the full HTML content of a Wikipedia page.",
    method: "GET",
    url: (i) => `/api/rest_v1/page/html/${restSegment(i.title)}`,
    input: z.object({ title: z.string().min(1).max(512) }).strict(),
    // A long article's HTML is well past the shared default.
    maxResponseBytes: 1_048_576,
    output: z.object({ html: z.string() }).strict(),
  },
  {
    action: "search-pages",
    name: "Search Pages",
    description: "Searches Wikipedia article titles and text.",
    method: "GET",
    url: (i) =>
      `/w/api.php${restQuery({
        action: "query",
        list: "search",
        srsearch: i.query,
        srlimit: i.limit ?? 10,
        format: "json",
        origin: "*",
      })}`,
    input: z.object({ query: Query, limit: Limit }).strict(),
  },
  {
    action: "random-page",
    name: "Random Page",
    description: "Returns a random Wikipedia article summary.",
    method: "GET",
    url: "/api/rest_v1/page/random/summary",
    input: z.object({}).strict(),
  },
];

export function createWikipediaPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "wikipedia",
    sdkReview: noSdk(
      "Wikipedia",
      "The MediaWiki and REST v1 APIs are both public and unauthenticated.",
    ),
    transportKind: "none",
    actions: WIKIPEDIA_ACTIONS,
  });
}
