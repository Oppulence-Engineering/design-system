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

// --------------------------------------------------------------- Perplexity

const PERPLEXITY_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "chat",
    name: "Chat",
    description: "Runs a chat completion against a Perplexity model.",
    method: "POST",
    url: "/chat/completions",
    input: z
      .object({
        model: z.string().min(1).max(128).optional(),
        messages: z
          .array(
            z
              .object({
                role: z.enum(["system", "user", "assistant"]),
                content: z.string().min(1).max(100_000),
              })
              .strict(),
          )
          .min(1)
          .max(64),
        maxTokens: z.number().int().min(1).max(8_192).optional(),
        temperature: z.number().min(0).max(2).optional(),
      })
      .strict(),
    body: (i) => ({
      model: i.model ?? "sonar",
      messages: i.messages,
      ...(i.maxTokens ? { max_tokens: i.maxTokens } : {}),
      ...(i.temperature === undefined ? {} : { temperature: i.temperature }),
    }),
  },
  {
    action: "search",
    name: "Search",
    description: "Runs a web search and returns ranked results with sources.",
    method: "POST",
    // The Search API is its own endpoint. Routing this through chat completions
    // would answer with generated prose rather than the ranked results the
    // action promises.
    url: "/search",
    input: z
      .object({
        query: Query,
        maxResults: z.number().int().min(1).max(20).optional(),
        recency: z.enum(["hour", "day", "week", "month", "year"]).optional(),
      })
      .strict(),
    body: (i) => ({
      query: i.query,
      ...(i.maxResults ? { max_results: i.maxResults } : {}),
      ...(i.recency ? { search_recency_filter: i.recency } : {}),
    }),
  },
];

export function createPerplexityPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "perplexity",
    sdkReview: noSdk("Perplexity"),
    transportKind: "api_key",
    actions: PERPLEXITY_ACTIONS,
  });
}
