import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Devin's published OpenAPI document:
 * https://docs.devin.ai/openapi.yaml
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Devin publishes no maintained Node SDK; its OpenAPI document at https://docs.devin.ai/openapi.yaml is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "create-session",
    name: "Create Session",
    description:
      "Create a new Devin session with a prompt. Devin will autonomously work on the task described in the prompt.",
    method: "POST",
    url: "/v1/sessions",
    input: z
      .object({
        prompt: z.string().max(4_000),
        snapshotId: z.string().max(4_000).optional(),
        unlisted: z.boolean().optional(),
        idempotent: z.boolean().optional(),
        maxAcuLimit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        secretIds: SpecArray.optional(),
        knowledgeIds: SpecArray.optional(),
        tags: SpecArray.optional(),
        title: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      prompt: i.prompt,
      ...(i.snapshotId !== undefined ? { snapshot_id: i.snapshotId } : {}),
      ...(i.unlisted !== undefined ? { unlisted: i.unlisted } : {}),
      ...(i.idempotent !== undefined ? { idempotent: i.idempotent } : {}),
      ...(i.maxAcuLimit !== undefined ? { max_acu_limit: i.maxAcuLimit } : {}),
      ...(i.secretIds !== undefined ? { secret_ids: i.secretIds } : {}),
      ...(i.knowledgeIds !== undefined
        ? { knowledge_ids: i.knowledgeIds }
        : {}),
      ...(i.tags !== undefined ? { tags: i.tags } : {}),
      ...(i.title !== undefined ? { title: i.title } : {}),
    }),
  },
  {
    action: "get-session",
    name: "Get Session",
    description:
      "Retrieve details of an existing Devin session including status, tags, pull requests, and structured output.",
    method: "GET",
    url: (i) => `/v1/sessions/${restSegment(i.sessionId)}`,
    input: z
      .object({
        sessionId: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "list-sessions",
    name: "List Sessions",
    description:
      "List Devin sessions in the organization. Returns up to 100 sessions by default.",
    method: "GET",
    url: (i) =>
      `/v1/sessions${restQuery({ limit: i.limit, offset: i.offset, tags: i.tags })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        offset: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        tags: SpecArray.optional(),
      })
      .strict(),
  },
  {
    action: "replace-session-tags",
    name: "Replace Session Tags",
    description:
      "Replace all tags on a Devin session with a new set of tags (max 50 tags).",
    method: "PUT",
    url: (i) => `/v1/sessions/${restSegment(i.sessionId)}/tags`,
    input: z
      .object({
        sessionId: z.string().max(4_000),
        tags: SpecArray,
      })
      .strict(),
    body: (i) => ({
      tags: i.tags,
    }),
  },
];

export function createDevinPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "devin",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "send-message":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "list-session-messages":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "list-session-attachments":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-session-tags":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "append-session-tags":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "archive-session":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "terminate-session":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
