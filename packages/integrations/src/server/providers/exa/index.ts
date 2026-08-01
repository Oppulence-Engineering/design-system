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

// ---------------------------------------------------------------------- Exa

const EXA_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "search",
    name: "Search",
    description: "Runs an Exa neural or keyword search.",
    method: "POST",
    url: "/search",
    input: z
      .object({
        query: Query,
        type: z.enum(["neural", "keyword", "auto"]).optional(),
        numResults: Limit,
        includeDomains: z.array(z.string().max(256)).max(50).optional(),
        startPublishedDate: z.string().max(64).optional(),
      })
      .strict(),
    body: (i) => ({
      query: i.query,
      type: i.type ?? "auto",
      numResults: i.numResults ?? 10,
      ...(i.includeDomains ? { includeDomains: i.includeDomains } : {}),
      ...(i.startPublishedDate
        ? { startPublishedDate: i.startPublishedDate }
        : {}),
    }),
  },
  {
    action: "get-contents",
    name: "Get Contents",
    description: "Fetches the contents of Exa result IDs or URLs.",
    method: "POST",
    url: "/contents",
    input: z
      .object({
        ids: z.array(z.string().min(1).max(2_000)).min(1).max(50),
        text: z.boolean().optional(),
        highlights: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      ids: i.ids,
      text: i.text ?? true,
      ...(i.highlights ? { highlights: true } : {}),
    }),
    maxResponseBytes: 1_048_576,
  },
  {
    action: "answer",
    name: "Answer",
    description: "Answers a question with cited sources.",
    method: "POST",
    url: "/answer",
    input: z.object({ query: Query, text: z.boolean().optional() }).strict(),
    body: (i) => ({ query: i.query, text: i.text ?? false }),
  },
  {
    action: "find-similar-links",
    name: "Find Similar Links",
    description: "Finds pages similar to a given URL.",
    method: "POST",
    url: "/findSimilar",
    input: z
      .object({
        url: z.string().url().max(2_000),
        numResults: Limit,
        excludeSourceDomain: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      url: i.url,
      numResults: i.numResults ?? 10,
      excludeSourceDomain: i.excludeSourceDomain ?? true,
    }),
  },
  {
    action: "agent",
    name: "Agent",
    description: "Runs an Exa research agent task.",
    method: "POST",
    url: "/research/v1",
    input: z
      .object({
        instructions: z.string().min(1).max(10_000),
        model: z.string().max(128).optional(),
      })
      .strict(),
    body: (i) => ({
      instructions: i.instructions,
      ...(i.model ? { model: i.model } : {}),
    }),
    maxResponseBytes: 1_048_576,
  },
];

export function createExaPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "exa",
    sdkReview: noSdk("Exa"),
    transportKind: "api_key",
    actions: EXA_ACTIONS,
  });
}
