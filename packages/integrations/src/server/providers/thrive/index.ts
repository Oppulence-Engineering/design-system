import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Thrive's published OpenAPI document:
 * https://api.thrive.app/swagger/v1/swagger.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Thrive publishes no maintained Node SDK; its OpenAPI document at https://api.thrive.app/swagger/v1/swagger.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "create-user",
    name: "Create User",
    description: "Create a new user in Thrive.",
    method: "POST",
    url: (i) =>
      `/api/user/resetpassword${restQuery({ "api-version": i.apiVersion })}`,
    input: z
      .object({
        apiVersion: z.string().max(4_000),
        email: z.string().max(4_000),
        appScheme: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      email: i.email,
      ...(i.appScheme !== undefined ? { appScheme: i.appScheme } : {}),
    }),
  },
  {
    action: "search-users",
    name: "Search Users",
    description:
      "Search users in Thrive and return basic user information with pagination.",
    method: "GET",
    url: (i) =>
      `/api/user/search${restQuery({ nameFilter: i.nameFilter, department: i.department, Top: i.top, Skip: i.skip, "api-version": i.apiVersion })}`,
    input: z
      .object({
        nameFilter: z.string().max(4_000).optional(),
        department: z.string().max(4_000).optional(),
        top: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
        skip: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        apiVersion: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "query-content",
    name: "Query Content",
    description:
      "Query content records in Thrive with pagination and filtering options.",
    method: "GET",
    url: (i) =>
      `/api/app/${restSegment(i.appGuid)}/content${restQuery({ updatedSince: i.updatedSince, Language: i.language, top: i.top, skip: i.skip, "api-version": i.apiVersion })}`,
    input: z
      .object({
        appGuid: z.string().max(4_000),
        updatedSince: z.string().max(4_000).optional(),
        language: z.string().max(4_000).optional(),
        top: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
        skip: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        apiVersion: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "get-content",
    name: "Get Content",
    description: "Get a single content record in Thrive by its ID.",
    method: "GET",
    url: (i) =>
      `/api/app/${restSegment(i.appGuid)}/content/${restSegment(i.id)}${restQuery({ Language: i.language, SearchTerm: i.searchTerm, Top: i.top, Skip: i.skip, "api-version": i.apiVersion })}`,
    input: z
      .object({
        appGuid: z.string().max(4_000),
        id: z.number().int().min(-1_000_000_000).max(1_000_000_000),
        language: z.string().max(4_000).optional(),
        searchTerm: z.string().max(4_000).optional(),
        top: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
        skip: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        apiVersion: z.string().max(4_000),
      })
      .strict(),
  },
];

export function createThrivePack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "thrive",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "update-user":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "delete-user":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "suspend-user":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-user-by-id":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-user-by-ref":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "list-audiences":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "create-audience":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-audience":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "update-audience":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "delete-audience":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "list-audience-members":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "add-audience-members":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "replace-audience-members":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "remove-audience-member":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "list-audience-managers":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "add-audience-managers":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "replace-audience-managers":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "remove-audience-manager":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "list-assignments":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "create-assignment":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-assignment":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "update-assignment":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "delete-assignment":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "list-enrolments":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-enrolment":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "list-completions":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-completion":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "create-completion":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "query-activities":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-activity":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "query-cpd-categories":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-cpd-category":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "query-cpd-entries":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-cpd-entry":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "query-cpd-requirements":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-cpd-requirement":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "query-cpd-user-summaries":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "list-tags":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-tag":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "add-user-tags":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "remove-user-tags":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "update-user-skills":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-skill-levels":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
