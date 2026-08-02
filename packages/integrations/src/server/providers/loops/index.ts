import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Loops's published OpenAPI document:
 * https://loops.so/docs/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Loops publishes no maintained Node SDK; its OpenAPI document at https://loops.so/docs/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "create-contact",
    name: "Create Contact",
    description:
      "Create a new contact in your Loops audience with an email address and optional properties like name, user group, and mailing list subscriptions.",
    method: "POST",
    url: "/v1/contacts/create",
    input: z
      .object({
        email: z.string().max(4_000),
        firstName: z.string().max(4_000).optional(),
        lastName: z.string().max(4_000).optional(),
        source: z.string().max(4_000).optional(),
        subscribed: z.boolean().optional(),
        userGroup: z.string().max(4_000).optional(),
        userId: z.string().max(4_000).optional(),
        mailingLists: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      email: i.email,
      ...(i.firstName !== undefined ? { firstName: i.firstName } : {}),
      ...(i.lastName !== undefined ? { lastName: i.lastName } : {}),
      ...(i.source !== undefined ? { source: i.source } : {}),
      ...(i.subscribed !== undefined ? { subscribed: i.subscribed } : {}),
      ...(i.userGroup !== undefined ? { userGroup: i.userGroup } : {}),
      ...(i.userId !== undefined ? { userId: i.userId } : {}),
      ...(i.mailingLists !== undefined ? { mailingLists: i.mailingLists } : {}),
    }),
  },
  {
    action: "update-contact",
    name: "Update Contact",
    description:
      "Update an existing contact in Loops by email or userId. Creates a new contact if no match is found (upsert). Can update name, subscription status, user group, mailing lists, and custom properties.",
    method: "PUT",
    url: "/v1/contacts/update",
    input: z
      .object({
        email: z.string().max(4_000).optional(),
        firstName: z.string().max(4_000).optional(),
        lastName: z.string().max(4_000).optional(),
        source: z.string().max(4_000).optional(),
        subscribed: z.boolean().optional(),
        userGroup: z.string().max(4_000).optional(),
        userId: z.string().max(4_000).optional(),
        mailingLists: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.email !== undefined ? { email: i.email } : {}),
      ...(i.firstName !== undefined ? { firstName: i.firstName } : {}),
      ...(i.lastName !== undefined ? { lastName: i.lastName } : {}),
      ...(i.source !== undefined ? { source: i.source } : {}),
      ...(i.subscribed !== undefined ? { subscribed: i.subscribed } : {}),
      ...(i.userGroup !== undefined ? { userGroup: i.userGroup } : {}),
      ...(i.userId !== undefined ? { userId: i.userId } : {}),
      ...(i.mailingLists !== undefined ? { mailingLists: i.mailingLists } : {}),
    }),
  },
  {
    action: "find-contact",
    name: "Find Contact",
    description:
      "Find a contact in Loops by email address or userId. Returns an array of matching contacts with all their properties including name, subscription status, user group, and mailing lists.",
    method: "GET",
    url: (i) =>
      `/v1/contacts/find${restQuery({ email: i.email, userId: i.userId })}`,
    input: z
      .object({
        email: z.string().max(4_000).optional(),
        userId: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "delete-contact",
    name: "Delete Contact",
    description:
      "Delete a contact from Loops by email address or userId. At least one identifier must be provided.",
    method: "POST",
    url: "/v1/contacts/delete",
    input: z
      .object({
        email: z.string().max(4_000),
        userId: z.string().max(4_000),
      })
      .strict(),
    body: (i) => ({
      email: i.email,
      userId: i.userId,
    }),
  },
  {
    action: "send-event",
    name: "Send Event",
    description:
      "Send an event to Loops to trigger automated email sequences for a contact. Identify the contact by email or userId and include optional event properties and mailing list changes.",
    method: "POST",
    url: "/v1/events/send",
    input: z
      .object({
        email: z.string().max(4_000).optional(),
        userId: z.string().max(4_000).optional(),
        eventName: z.string().max(4_000),
        eventProperties: SpecObject.optional(),
        mailingLists: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.email !== undefined ? { email: i.email } : {}),
      ...(i.userId !== undefined ? { userId: i.userId } : {}),
      eventName: i.eventName,
      ...(i.eventProperties !== undefined
        ? { eventProperties: i.eventProperties }
        : {}),
      ...(i.mailingLists !== undefined ? { mailingLists: i.mailingLists } : {}),
    }),
  },
  {
    action: "list-mailing-lists",
    name: "List Mailing Lists",
    description:
      "Retrieve all mailing lists from your Loops account. Returns each list with its ID, name, description, and public/private status.",
    method: "GET",
    url: "/v1/lists",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "list-transactional-emails",
    name: "List Transactional Emails",
    description:
      "Retrieve a list of published transactional email templates from your Loops account. Returns each template with its ID, name, created/updated timestamps, and data variables.",
    method: "GET",
    url: (i) =>
      `/v1/transactional-emails${restQuery({ perPage: i.perPage, cursor: i.cursor })}`,
    input: z
      .object({
        perPage: z.string().max(4_000).optional(),
        cursor: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-contact-property",
    name: "Create Contact Property",
    description:
      "Create a new custom contact property in your Loops account. The property name must be in camelCase format.",
    method: "POST",
    url: "/v1/contacts/properties",
    input: z
      .object({
        name: z.string().max(4_000),
        type: z.enum(["string", "number", "boolean", "date"]),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      type: i.type,
    }),
  },
  {
    action: "list-contact-properties",
    name: "List Contact Properties",
    description:
      "Retrieve a list of contact properties from your Loops account. Returns each property with its key, label, and data type. Can filter to show all properties or only custom ones.",
    method: "GET",
    url: (i) => `/v1/contacts/properties${restQuery({ list: i.list })}`,
    input: z
      .object({
        list: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-transactional-email",
    name: "Get Transactional Email",
    description:
      "Retrieve a single transactional email template from your Loops account by its ID, including its data variables and draft/published message IDs.",
    method: "GET",
    url: (i) => `/v1/transactional-emails/${restSegment(i.transactionalId)}`,
    input: z
      .object({
        transactionalId: z.string().max(4_000),
      })
      .strict(),
  },
];

export function createLoopsPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "loops",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "send-transactional-email":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "check-contact-suppression":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "remove-contact-suppression":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
