import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Sixtyfour AI's published OpenAPI document:
 * https://api.sixtyfour.ai/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Sixtyfour AI publishes no maintained Node SDK; its OpenAPI document at https://api.sixtyfour.ai/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "enrich-lead",
    name: "Enrich Lead",
    description:
      "Enrich lead information with contact details, social profiles, and company data using Sixtyfour AI.",
    method: "POST",
    url: "/enrich-lead",
    input: z
      .object({
        struct: z.string().max(4_000).optional(),
        researchPlan: z.string().max(4_000).optional(),
        tier: z.string().max(4_000).optional(),
        webhookUrl: z.string().max(4_000).optional(),
        fieldConfidence: z.string().max(4_000).optional(),
        leadInfo: SpecObject,
      })
      .strict(),
    body: (i) => ({
      ...(i.struct !== undefined ? { struct: i.struct } : {}),
      ...(i.researchPlan !== undefined
        ? { research_plan: i.researchPlan }
        : {}),
      ...(i.tier !== undefined ? { tier: i.tier } : {}),
      ...(i.webhookUrl !== undefined ? { webhook_url: i.webhookUrl } : {}),
      ...(i.fieldConfidence !== undefined
        ? { field_confidence: i.fieldConfidence }
        : {}),
      lead_info: i.leadInfo,
    }),
  },
  {
    action: "enrich-company",
    name: "Enrich Company",
    description:
      "Enrich company data with additional information and find associated people using Sixtyfour AI.",
    method: "POST",
    url: "/enrich-company",
    input: z
      .object({
        struct: SpecObject,
        findPeople: z.boolean().optional(),
        peopleFocusPrompt: z.string().max(4_000).optional(),
        leadStruct: z.string().max(4_000).optional(),
        researchPlan: z.string().max(4_000).optional(),
        tier: z.string().max(4_000).optional(),
        fullOrgChart: z.boolean().optional(),
        webhookUrl: z.string().max(4_000).optional(),
        fieldConfidence: z.string().max(4_000).optional(),
        targetCompany: SpecObject,
      })
      .strict(),
    body: (i) => ({
      struct: i.struct,
      ...(i.findPeople !== undefined ? { find_people: i.findPeople } : {}),
      ...(i.peopleFocusPrompt !== undefined
        ? { people_focus_prompt: i.peopleFocusPrompt }
        : {}),
      ...(i.leadStruct !== undefined ? { lead_struct: i.leadStruct } : {}),
      ...(i.researchPlan !== undefined
        ? { research_plan: i.researchPlan }
        : {}),
      ...(i.tier !== undefined ? { tier: i.tier } : {}),
      ...(i.fullOrgChart !== undefined
        ? { full_org_chart: i.fullOrgChart }
        : {}),
      ...(i.webhookUrl !== undefined ? { webhook_url: i.webhookUrl } : {}),
      ...(i.fieldConfidence !== undefined
        ? { field_confidence: i.fieldConfidence }
        : {}),
      target_company: i.targetCompany,
    }),
  },
];

export function createSixtyfourAiPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "sixtyfour-ai",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "find-phone":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "find-email":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
