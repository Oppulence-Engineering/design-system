import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from LeadMagic's published OpenAPI document:
 * https://docs.leadmagic.io/docs/api-reference/openapi.yml
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "LeadMagic publishes no maintained Node SDK; its OpenAPI document at https://docs.leadmagic.io/docs/api-reference/openapi.yml is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "profile-search",
    name: "Profile Search",
    description:
      "Enrich a LinkedIn profile with work history, education, skills, and contact data. Charges 1 credit per successful enrichment; free when profile not found.",
    method: "POST",
    url: "/v1/people/profile-search",
    input: z
      .object({
        profileUrl: z.string().max(4_000),
      })
      .strict(),
    body: (i) => ({
      profile_url: i.profileUrl,
    }),
  },
  {
    action: "company-search",
    name: "Company Search",
    description:
      "Enrich company data including firmographics, headcount, funding, and social profiles by domain, LinkedIn URL, or name. Charges 1 credit when a company is found; free when no result.",
    method: "POST",
    url: "/v1/companies/company-search",
    input: z
      .object({
        profileUrl: z.string().max(4_000).optional(),
        companyDomain: z.string().max(4_000).optional(),
        companyName: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.profileUrl !== undefined ? { profile_url: i.profileUrl } : {}),
      ...(i.companyDomain !== undefined
        ? { company_domain: i.companyDomain }
        : {}),
      ...(i.companyName !== undefined ? { company_name: i.companyName } : {}),
    }),
  },
  {
    action: "role-finder",
    name: "Role Finder",
    description:
      "Find the person holding a specific job role at a company. Charges 2 credits when a matching person is found; free when no result.",
    method: "POST",
    url: "/v1/people/role-finder",
    input: z
      .object({
        companyName: z.string().max(4_000).optional(),
        companyDomain: z.string().max(4_000).optional(),
        jobTitle: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.companyName !== undefined ? { company_name: i.companyName } : {}),
      ...(i.companyDomain !== undefined
        ? { company_domain: i.companyDomain }
        : {}),
      ...(i.jobTitle !== undefined ? { job_title: i.jobTitle } : {}),
    }),
  },
  {
    action: "get-credits",
    name: "Get Credits",
    description:
      "Retrieve the current credit balance for the authenticated LeadMagic account. This endpoint is free and consumes no credits.",
    method: "GET",
    url: "/v1/credits",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
];

export function createLeadmagicPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "leadmagic",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "find-email":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "validate-email":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "find-mobile":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "profile-to-email":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "email-to-profile":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
