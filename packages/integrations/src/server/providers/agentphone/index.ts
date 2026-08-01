import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from AgentPhone's published OpenAPI document:
 * https://api.agentphone.ai/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "AgentPhone publishes no maintained Node SDK; its OpenAPI document at https://api.agentphone.ai/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "create-number",
    name: "Create Number",
    description: "Provision a new SMS- and voice-enabled phone number",
    method: "POST",
    url: "/v1/numbers",
    input: z
      .object({
        country: z.string().max(4_000).optional(),
        areaCode: z.string().max(4_000).optional(),
        agentId: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.country !== undefined ? { country: i.country } : {}),
      ...(i.areaCode !== undefined ? { areaCode: i.areaCode } : {}),
      ...(i.agentId !== undefined ? { agentId: i.agentId } : {}),
    }),
  },
  {
    action: "list-numbers",
    name: "List Numbers",
    description:
      "List all phone numbers provisioned for this AgentPhone account",
    method: "GET",
    url: (i) => `/v1/numbers${restQuery({ limit: i.limit, offset: i.offset })}`,
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
      })
      .strict(),
  },
  {
    action: "get-number-messages",
    name: "Get Number Messages",
    description: "Fetch messages received on a specific phone number",
    method: "GET",
    url: (i) =>
      `/v1/numbers/${restSegment(i.numberId)}/messages${restQuery({ limit: i.limit, before: i.before, after: i.after })}`,
    input: z
      .object({
        numberId: z.string().max(4_000),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        before: z.string().max(4_000).optional(),
        after: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-call",
    name: "Create Call",
    description: "Initiate an outbound voice call from an AgentPhone agent",
    method: "POST",
    url: "/v1/calls",
    input: z
      .object({
        agentId: z.string().max(4_000),
        toNumber: z.string().max(4_000),
        fromNumberId: z.string().max(4_000).optional(),
        initialGreeting: z.string().max(4_000).optional(),
        voice: z.string().max(4_000).optional(),
        systemPrompt: z.string().max(4_000).optional(),
        modelTier: z.enum(["turbo", "balanced", "max"]).optional(),
        variables: z.string().max(4_000).optional(),
        callScreeningIdentity: z.string().max(4_000).optional(),
        callScreeningPurpose: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      agentId: i.agentId,
      toNumber: i.toNumber,
      ...(i.fromNumberId !== undefined ? { fromNumberId: i.fromNumberId } : {}),
      ...(i.initialGreeting !== undefined
        ? { initialGreeting: i.initialGreeting }
        : {}),
      ...(i.voice !== undefined ? { voice: i.voice } : {}),
      ...(i.systemPrompt !== undefined ? { systemPrompt: i.systemPrompt } : {}),
      ...(i.modelTier !== undefined ? { modelTier: i.modelTier } : {}),
      ...(i.variables !== undefined ? { variables: i.variables } : {}),
      ...(i.callScreeningIdentity !== undefined
        ? { callScreeningIdentity: i.callScreeningIdentity }
        : {}),
      ...(i.callScreeningPurpose !== undefined
        ? { callScreeningPurpose: i.callScreeningPurpose }
        : {}),
    }),
  },
  {
    action: "list-calls",
    name: "List Calls",
    description: "List voice calls for this AgentPhone account",
    method: "GET",
    url: (i) =>
      `/v1/calls${restQuery({ limit: i.limit, offset: i.offset, status: i.status, direction: i.direction, type: i.type, search: i.search })}`,
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
        status: z.string().max(4_000).optional(),
        direction: z.string().max(4_000).optional(),
        type: z.string().max(4_000).optional(),
        search: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-call",
    name: "Get Call",
    description: "Fetch a call and its full transcript",
    method: "GET",
    url: (i) => `/v1/calls/${restSegment(i.callId)}`,
    input: z
      .object({
        callId: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "list-conversations",
    name: "List Conversations",
    description:
      "List conversations (message threads) for this AgentPhone account",
    method: "GET",
    url: (i) =>
      `/v1/conversations${restQuery({ limit: i.limit, offset: i.offset })}`,
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
      })
      .strict(),
  },
  {
    action: "get-conversation",
    name: "Get Conversation",
    description: "Get a conversation along with its recent messages",
    method: "GET",
    url: (i) =>
      `/v1/conversations/${restSegment(i.conversationId)}${restQuery({ message_limit: i.messageLimit })}`,
    input: z
      .object({
        conversationId: z.string().max(4_000),
        messageLimit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "update-conversation",
    name: "Update Conversation",
    description:
      "Update conversation metadata (stored state). Pass null to clear existing metadata.",
    method: "PATCH",
    url: (i) => `/v1/conversations/${restSegment(i.conversationId)}`,
    input: z
      .object({
        conversationId: z.string().max(4_000),
        metadata: z.string().max(4_000).optional(),
        groupName: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.metadata !== undefined ? { metadata: i.metadata } : {}),
      ...(i.groupName !== undefined ? { group_name: i.groupName } : {}),
    }),
  },
  {
    action: "get-conversation-messages",
    name: "Get Conversation Messages",
    description: "Get paginated messages for a conversation",
    method: "GET",
    url: (i) =>
      `/v1/conversations/${restSegment(i.conversationId)}/messages${restQuery({ limit: i.limit, before: i.before, after: i.after })}`,
    input: z
      .object({
        conversationId: z.string().max(4_000),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        before: z.string().max(4_000).optional(),
        after: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-contact",
    name: "Create Contact",
    description: "Create a new contact in AgentPhone",
    method: "POST",
    url: "/v1/contacts",
    input: z
      .object({
        phoneNumber: z.string().max(4_000),
        name: z.string().max(4_000),
        email: z.string().max(4_000).optional(),
        notes: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      phoneNumber: i.phoneNumber,
      name: i.name,
      ...(i.email !== undefined ? { email: i.email } : {}),
      ...(i.notes !== undefined ? { notes: i.notes } : {}),
    }),
  },
  {
    action: "list-contacts",
    name: "List Contacts",
    description: "List contacts for this AgentPhone account",
    method: "GET",
    url: (i) =>
      `/v1/contacts${restQuery({ search: i.search, limit: i.limit, offset: i.offset })}`,
    input: z
      .object({
        search: z.string().max(4_000).optional(),
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
      })
      .strict(),
  },
  {
    action: "get-contact",
    name: "Get Contact",
    description: "Fetch a single contact by ID",
    method: "GET",
    url: (i) => `/v1/contacts/${restSegment(i.contactId)}`,
    input: z
      .object({
        contactId: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "update-contact",
    name: "Update Contact",
    description: "Update a contact's fields",
    method: "PATCH",
    url: (i) => `/v1/contacts/${restSegment(i.contactId)}`,
    input: z
      .object({
        contactId: z.string().max(4_000),
        phoneNumber: z.string().max(4_000).optional(),
        name: z.string().max(4_000).optional(),
        email: z.string().max(4_000).optional(),
        notes: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.phoneNumber !== undefined ? { phoneNumber: i.phoneNumber } : {}),
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.email !== undefined ? { email: i.email } : {}),
      ...(i.notes !== undefined ? { notes: i.notes } : {}),
    }),
  },
  {
    action: "delete-contact",
    name: "Delete Contact",
    description: "Delete a contact by ID",
    method: "DELETE",
    url: (i) => `/v1/contacts/${restSegment(i.contactId)}`,
    input: z
      .object({
        contactId: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
];

export function createAgentphonePack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "agentphone",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "release-number":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-call-transcript":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "send-message":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "react-to-message":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-usage":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-daily-usage":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-monthly-usage":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
