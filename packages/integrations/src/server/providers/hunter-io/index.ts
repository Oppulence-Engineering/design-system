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

// ----------------------------------------------------------------- Hunter.io

const HUNTER_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "domain-search",
    name: "Domain Search",
    description: "Finds email addresses associated with a domain.",
    method: "GET",
    url: (i) =>
      `/v2/domain-search${restQuery({
        domain: i.domain,
        company: i.company,
        limit: i.limit,
        type: i.type,
      })}`,
    input: z
      .object({
        domain: z.string().max(253).optional(),
        company: z.string().max(256).optional(),
        limit: Limit,
        type: z.enum(["personal", "generic"]).optional(),
      })
      .strict()
      .refine((value) => Boolean(value.domain ?? value.company), {
        message: "A domain search needs a domain or a company name.",
      }),
  },
  {
    action: "email-finder",
    name: "Email Finder",
    description: "Finds the most likely email address for a person.",
    method: "GET",
    url: (i) =>
      `/v2/email-finder${restQuery({
        domain: i.domain,
        first_name: i.firstName,
        last_name: i.lastName,
        full_name: i.fullName,
      })}`,
    input: z
      .object({
        domain: z.string().min(1).max(253),
        firstName: z.string().max(128).optional(),
        lastName: z.string().max(128).optional(),
        fullName: z.string().max(256).optional(),
      })
      .strict(),
  },
  {
    action: "email-verifier",
    name: "Email Verifier",
    description: "Verifies the deliverability of an email address.",
    method: "GET",
    url: (i) => `/v2/email-verifier${restQuery({ email: i.email })}`,
    input: z.object({ email: z.string().email().max(320) }).strict(),
  },
  {
    action: "email-count",
    name: "Email Count",
    description: "Counts the email addresses known for a domain.",
    method: "GET",
    url: (i) =>
      `/v2/email-count${restQuery({ domain: i.domain, company: i.company })}`,
    input: z
      .object({
        domain: z.string().max(253).optional(),
        company: z.string().max(256).optional(),
      })
      .strict(),
  },
  {
    action: "discover-companies",
    name: "Discover Companies",
    description: "Finds companies matching a natural-language description.",
    method: "POST",
    url: "/v2/discover",
    input: z
      .object({
        query: z.string().max(2_000).optional(),
        organization: z.record(z.string(), z.unknown()).optional(),
        limit: Limit,
      })
      .strict(),
    body: (i) => ({
      ...(i.query ? { query: i.query } : {}),
      ...(i.organization ? { organization: i.organization } : {}),
      limit: i.limit ?? 10,
    }),
  },
  {
    action: "find-company",
    name: "Find Company",
    description: "Reads company details for a domain.",
    method: "GET",
    url: (i) => `/v2/companies/find${restQuery({ domain: i.domain })}`,
    input: z.object({ domain: z.string().min(1).max(253) }).strict(),
  },
];

export function createHunterIoPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "hunter-io",
    sdkReview: noSdk("Hunter.io"),
    transportKind: "api_key",
    actions: HUNTER_ACTIONS,
  });
}
