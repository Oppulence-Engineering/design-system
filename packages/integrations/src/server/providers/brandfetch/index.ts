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

// --------------------------------------------------------------- Brandfetch

const BRANDFETCH_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "get-brand",
    name: "Get Brand",
    description: "Reads brand assets and metadata for a domain.",
    method: "GET",
    url: (i) => `/v2/brands/${restSegment(i.domain)}`,
    input: z
      .object({
        domain: z
          .string()
          .min(1)
          .max(253)
          .regex(/^[A-Za-z0-9.-]+$/u),
      })
      .strict(),
  },
  {
    action: "search-brands",
    name: "Search Brands",
    description: "Searches brands by name.",
    method: "GET",
    url: (i) => `/v2/search/${restSegment(i.query)}`,
    input: z.object({ query: z.string().min(1).max(256) }).strict(),
  },
];

export function createBrandfetchPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "brandfetch",
    sdkReview: noSdk("Brandfetch"),
    transportKind: "api_key",
    actions: BRANDFETCH_ACTIONS,
  });
}
