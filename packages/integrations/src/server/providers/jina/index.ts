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

// --------------------------------------------------------------------- Jina

const JINA_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "read-url",
    name: "Read URL",
    description: "Fetches a page and returns it as clean, LLM-ready text.",
    method: "POST",
    url: "/",
    input: z
      .object({
        url: z.string().url().max(2_000),
        withImages: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({ url: i.url }),
    headers: (i) => ({
      "content-type": "application/json",
      // Reader returns markdown unless asked otherwise.
      "x-return-format": "markdown",
      ...(i.withImages ? {} : { "x-retain-images": "none" }),
    }),
    maxResponseBytes: 1_048_576,
  },
  {
    action: "search",
    name: "Search",
    description: "Searches the web and returns readable result content.",
    method: "POST",
    url: "/",
    input: z.object({ query: Query }).strict(),
    body: (i) => ({ q: i.query }),
    headers: () => ({ "content-type": "application/json" }),
    maxResponseBytes: 1_048_576,
  },
];

export function createJinaPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "jina",
    sdkReview: noSdk(
      "Jina AI",
      "Reader and Search are host-differentiated endpoints on the same key.",
    ),
    transportKind: "api_key",
    actions: JINA_ACTIONS,
  });
}
