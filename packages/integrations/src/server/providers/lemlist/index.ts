import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Lemlist's published OpenAPI document:
 * https://developer.lemlist.com/api-reference/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Lemlist publishes no maintained Node SDK; its OpenAPI document at https://developer.lemlist.com/api-reference/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "get-activities",
    name: "Get Activities",
    description:
      "Retrieves campaign activities and steps performed, including email opens, clicks, replies, and other events.",
    method: "GET",
    url: (i) =>
      `/activities/${restQuery({ type: i.type, campaignId: i.campaignId, isFirst: i.isFirst, offset: i.offset, limit: i.limit, leadId: i.leadId, version: i.version })}`,
    input: z
      .object({
        type: z.string().max(4_000).optional(),
        campaignId: z.string().max(4_000).optional(),
        isFirst: z.boolean().optional(),
        offset: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        leadId: z.string().max(4_000).optional(),
        version: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-lead",
    name: "Get Lead",
    description: "Retrieves lead information by email address or lead ID.",
    method: "GET",
    url: (i) =>
      `/leads/${restSegment(i.email)}${restQuery({ version: i.version })}`,
    input: z
      .object({
        email: z.string().max(4_000),
        version: z.string().max(4_000).optional(),
      })
      .strict(),
  },
];

export function createLemlistPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "lemlist",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "send-email":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
