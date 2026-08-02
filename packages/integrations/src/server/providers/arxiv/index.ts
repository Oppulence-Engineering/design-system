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

// -------------------------------------------------------------------- arXiv

/**
 * arXiv answers with Atom XML rather than JSON, so these actions transform to
 * a text projection instead of the shared document schema.
 */
const ARXIV_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "search-papers",
    name: "Search Papers",
    description: "Searches arXiv for papers matching a query.",
    method: "GET",
    url: (i) =>
      `/api/query${restQuery({
        search_query: i.query,
        start: i.start ?? 0,
        max_results: i.limit ?? 10,
        sortBy: i.sortBy ?? "relevance",
      })}`,
    input: z
      .object({
        query: Query,
        start: z.number().int().min(0).max(10_000).optional(),
        limit: Limit,
        sortBy: z
          .enum(["relevance", "lastUpdatedDate", "submittedDate"])
          .optional(),
      })
      .strict(),
    maxResponseBytes: 1_048_576,
    output: z.object({ atom: z.string() }).strict(),
  },
  {
    action: "get-paper-details",
    name: "Get Paper Details",
    description: "Reads one arXiv paper by its identifier.",
    method: "GET",
    url: (i) => `/api/query${restQuery({ id_list: i.arxivId })}`,
    input: z
      .object({
        arxivId: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[\w./-]+$/u),
      })
      .strict(),
    output: z.object({ atom: z.string() }).strict(),
  },
  {
    action: "get-author-papers",
    name: "Get Author Papers",
    description: "Lists papers by an author.",
    method: "GET",
    url: (i) =>
      `/api/query${restQuery({
        search_query: `au:"${String(i.author).replace(/"/gu, "")}"`,
        max_results: i.limit ?? 10,
        sortBy: "submittedDate",
      })}`,
    input: z
      .object({ author: z.string().min(1).max(256), limit: Limit })
      .strict(),
    maxResponseBytes: 1_048_576,
    output: z.object({ atom: z.string() }).strict(),
  },
];

export function createArxivPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "arxiv",
    sdkReview: noSdk(
      "arXiv",
      "Its public API answers with Atom XML, which the lane returns as text.",
    ),
    transportKind: "none",
    actions: ARXIV_ACTIONS,
  });
}
