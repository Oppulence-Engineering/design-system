import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from front's published OpenAPI document:
 * https://raw.githubusercontent.com/frontapp/front-api-specs/main/core-api/core-api.json
 *
 * This provider is outside the pinned source, so its action table is its own
 * coverage. The table is the shallowest CRUD operations the document declares,
 * capped at 22 — a vendor's top-level resources, not everything it serves.
 */
const SPEC_NOTE =
  "front publishes no maintained Node SDK; its OpenAPI document at https://raw.githubusercontent.com/frontapp/front-api-specs/main/core-api/core-api.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-conversations",
    name: "List Conversations",
    description: "List conversations",
    method: "GET",
    url: (i) =>
      `/conversations${restQuery({ q: i.q, limit: i.limit, page_token: i.pageToken, sort_by: i.sortBy, sort_order: i.sortOrder })}`,
    input: z
      .object({
        q: z.string().max(4_000).optional(),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageToken: z.string().max(4_000).optional(),
        sortBy: z.string().max(4_000).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
      })
      .strict(),
  },
  {
    action: "create-conversation",
    name: "Create Conversation",
    description: "Create discussion/task conversation",
    method: "POST",
    url: "/conversations",
    input: z
      .object({
        type: z.enum(["discussion", "task"]),
        inboxId: z.string().max(4_000).optional(),
        teammateIds: SpecArray.optional(),
        subject: z.string().max(4_000),
        comment: SpecObject.optional(),
        description: z.string().max(4_000).optional(),
        dueAt: z.number().optional(),
        customFields: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      type: i.type,
      ...(i.inboxId !== undefined ? { inbox_id: i.inboxId } : {}),
      ...(i.teammateIds !== undefined ? { teammate_ids: i.teammateIds } : {}),
      subject: i.subject,
      ...(i.comment !== undefined ? { comment: i.comment } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.dueAt !== undefined ? { due_at: i.dueAt } : {}),
      ...(i.customFields !== undefined
        ? { custom_fields: i.customFields }
        : {}),
    }),
  },
  {
    action: "get-conversation",
    name: "Get Conversation",
    description: "Get conversation",
    method: "GET",
    url: (i) => `/conversations/${restSegment(i.conversationId)}`,
    input: z
      .object({
        conversationId: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "update-conversation",
    name: "Update Conversation",
    description: "Update conversation",
    method: "PATCH",
    url: (i) => `/conversations/${restSegment(i.conversationId)}`,
    input: z
      .object({
        conversationId: z.string().max(4_000),
        assigneeId: z.string().max(4_000).optional(),
        inboxId: z.string().max(4_000).optional(),
        status: z.enum(["archived", "open", "deleted", "spam"]).optional(),
        statusId: z.string().max(4_000).optional(),
        tagIds: SpecArray.optional(),
        description: z.string().max(4_000).optional(),
        dueAt: z.number().optional(),
        customFields: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.assigneeId !== undefined ? { assignee_id: i.assigneeId } : {}),
      ...(i.inboxId !== undefined ? { inbox_id: i.inboxId } : {}),
      ...(i.status !== undefined ? { status: i.status } : {}),
      ...(i.statusId !== undefined ? { status_id: i.statusId } : {}),
      ...(i.tagIds !== undefined ? { tag_ids: i.tagIds } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.dueAt !== undefined ? { due_at: i.dueAt } : {}),
      ...(i.customFields !== undefined
        ? { custom_fields: i.customFields }
        : {}),
    }),
  },
  {
    action: "delete-conversation",
    name: "Delete Conversation",
    description: "Delete conversation",
    method: "DELETE",
    url: (i) => `/conversations/${restSegment(i.conversationId)}`,
    input: z
      .object({
        conversationId: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-contacts",
    name: "List Contacts",
    description: "List contacts",
    method: "GET",
    url: (i) =>
      `/contacts${restQuery({ q: i.q, limit: i.limit, page_token: i.pageToken, sort_by: i.sortBy, sort_order: i.sortOrder })}`,
    input: z
      .object({
        q: z.string().max(4_000).optional(),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageToken: z.string().max(4_000).optional(),
        sortBy: z.string().max(4_000).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
      })
      .strict(),
  },
  {
    action: "create-contact",
    name: "Create Contact",
    description: "Create contact",
    method: "POST",
    url: "/contacts",
    input: z
      .object({
        body: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.body ?? {}),
    }),
  },
  {
    action: "get-contact",
    name: "Get Contact",
    description: "Get contact",
    method: "GET",
    url: (i) => `/contacts/${restSegment(i.contactId)}`,
    input: z
      .object({
        contactId: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "update-contact",
    name: "Update Contact",
    description: "Update a contact",
    method: "PATCH",
    url: (i) => `/contacts/${restSegment(i.contactId)}`,
    input: z
      .object({
        contactId: z.string().max(4_000),
        name: z.string().max(4_000).optional(),
        description: z.string().max(4_000).optional(),
        avatar: z.string().max(4_000).optional(),
        links: SpecArray.optional(),
        groupNames: SpecArray.optional(),
        listNames: SpecArray.optional(),
        customFields: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.avatar !== undefined ? { avatar: i.avatar } : {}),
      ...(i.links !== undefined ? { links: i.links } : {}),
      ...(i.groupNames !== undefined ? { group_names: i.groupNames } : {}),
      ...(i.listNames !== undefined ? { list_names: i.listNames } : {}),
      ...(i.customFields !== undefined
        ? { custom_fields: i.customFields }
        : {}),
    }),
  },
  {
    action: "delete-contact",
    name: "Delete Contact",
    description: "Delete a contact",
    method: "DELETE",
    url: (i) => `/contacts/${restSegment(i.contactId)}`,
    input: z
      .object({
        contactId: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-accounts",
    name: "List Accounts",
    description: "List Accounts",
    method: "GET",
    url: (i) =>
      `/accounts${restQuery({ limit: i.limit, page_token: i.pageToken, sort_by: i.sortBy, sort_order: i.sortOrder })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageToken: z.string().max(4_000).optional(),
        sortBy: z.string().max(4_000).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
      })
      .strict(),
  },
  {
    action: "create-account",
    name: "Create Account",
    description: "Create account",
    method: "POST",
    url: "/accounts",
    input: z
      .object({
        name: z.string().max(4_000).optional(),
        description: z.string().max(4_000).optional(),
        domains: SpecArray.optional(),
        externalId: z.string().max(4_000).optional(),
        customFields: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.domains !== undefined ? { domains: i.domains } : {}),
      ...(i.externalId !== undefined ? { external_id: i.externalId } : {}),
      ...(i.customFields !== undefined
        ? { custom_fields: i.customFields }
        : {}),
    }),
  },
  {
    action: "get-account",
    name: "Get Account",
    description: "Fetch an account",
    method: "GET",
    url: (i) => `/accounts/${restSegment(i.accountId)}`,
    input: z
      .object({
        accountId: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "update-account",
    name: "Update Account",
    description: "Update account",
    method: "PATCH",
    url: (i) => `/accounts/${restSegment(i.accountId)}`,
    input: z
      .object({
        accountId: z.string().max(4_000),
        name: z.string().max(4_000).optional(),
        description: z.string().max(4_000).optional(),
        domains: SpecArray.optional(),
        customFields: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.domains !== undefined ? { domains: i.domains } : {}),
      ...(i.customFields !== undefined
        ? { custom_fields: i.customFields }
        : {}),
    }),
  },
  {
    action: "delete-account",
    name: "Delete Account",
    description: "Delete an account",
    method: "DELETE",
    url: (i) => `/accounts/${restSegment(i.accountId)}`,
    input: z
      .object({
        accountId: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-tags",
    name: "List Tags",
    description: "List tags",
    method: "GET",
    url: (i) =>
      `/tags${restQuery({ limit: i.limit, page_token: i.pageToken, sort_by: i.sortBy, sort_order: i.sortOrder })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageToken: z.string().max(4_000).optional(),
        sortBy: z.string().max(4_000).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
      })
      .strict(),
  },
  {
    action: "create-tag",
    name: "Create Tag",
    description: "Create tag",
    method: "POST",
    url: "/tags",
    input: z
      .object({
        name: z.string().max(4_000),
        description: z.string().max(4_000).optional(),
        highlight: z
          .enum([
            "grey",
            "pink",
            "red",
            "orange",
            "yellow",
            "green",
            "light-blue",
            "blue",
            "purple",
          ])
          .optional(),
        isVisibleInConversationLists: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.highlight !== undefined ? { highlight: i.highlight } : {}),
      ...(i.isVisibleInConversationLists !== undefined
        ? { is_visible_in_conversation_lists: i.isVisibleInConversationLists }
        : {}),
    }),
  },
  {
    action: "get-tag",
    name: "Get Tag",
    description: "Get tag",
    method: "GET",
    url: (i) => `/tags/${restSegment(i.tagId)}`,
    input: z
      .object({
        tagId: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "update-tag",
    name: "Update Tag",
    description: "Update a tag",
    method: "PATCH",
    url: (i) => `/tags/${restSegment(i.tagId)}`,
    input: z
      .object({
        tagId: z.string().max(4_000),
        name: z.string().max(4_000).optional(),
        description: z.string().max(4_000).optional(),
        highlight: z
          .enum([
            "grey",
            "pink",
            "red",
            "orange",
            "yellow",
            "green",
            "light-blue",
            "blue",
            "purple",
          ])
          .optional(),
        parentTagId: z.string().max(4_000).optional(),
        isVisibleInConversationLists: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.highlight !== undefined ? { highlight: i.highlight } : {}),
      ...(i.parentTagId !== undefined ? { parent_tag_id: i.parentTagId } : {}),
      ...(i.isVisibleInConversationLists !== undefined
        ? { is_visible_in_conversation_lists: i.isVisibleInConversationLists }
        : {}),
    }),
  },
  {
    action: "delete-tag",
    name: "Delete Tag",
    description: "Delete tag",
    method: "DELETE",
    url: (i) => `/tags/${restSegment(i.tagId)}`,
    input: z
      .object({
        tagId: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-teammates",
    name: "List Teammates",
    description: "List teammates",
    method: "GET",
    url: "/teammates",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "get-teammate",
    name: "Get Teammate",
    description: "Get teammate",
    method: "GET",
    url: (i) => `/teammates/${restSegment(i.teammateId)}`,
    input: z
      .object({
        teammateId: z.string().max(4_000),
      })
      .strict(),
  },
];

export function createFrontPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "front",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    beyondBaseline: true,
    actions: ACTIONS,
  });
}
