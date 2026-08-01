import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

const NoSdkNote =
  "publishes no maintained first-party Node SDK; its HTTP API is the supported integration surface.";

// ----------------------------------------------------------------- LinkedIn

const LINKEDIN_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "get-profile",
    name: "Get Profile",
    description: "Reads the authenticated member's profile.",
    method: "GET",
    url: "/v2/userinfo",
    input: z.object({}).strict(),
  },
  {
    action: "share-post",
    name: "Share Post",
    description: "Publishes a post as the authenticated member.",
    method: "POST",
    url: "/rest/posts",
    input: z
      .object({
        // LinkedIn addresses the author by URN, which the product holds on
        // its connection row after the profile read.
        authorUrn: z
          .string()
          .min(1)
          .max(128)
          .regex(/^urn:li:(person|organization):[A-Za-z0-9_-]+$/u),
        commentary: z.string().min(1).max(3_000),
        visibility: z.enum(["PUBLIC", "CONNECTIONS"]).optional(),
      })
      .strict(),
    body: (i) => ({
      author: i.authorUrn,
      commentary: i.commentary,
      visibility: i.visibility ?? "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
    headers: () => ({
      "content-type": "application/json",
      // The versioned Posts API requires both of these.
      "LinkedIn-Version": "202405",
      "X-Restli-Protocol-Version": "2.0.0",
    }),
  },
];

export function createLinkedInPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "linkedin",
    sdkReview: `LinkedIn ${NoSdkNote}`,
    transportKind: "oauth2",
    actions: LINKEDIN_ACTIONS,
  });
}
