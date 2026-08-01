import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  RestEmailSchema,
  type RestAction,
} from "../shared/rest";

const NoSdkNote =
  "publishes no maintained first-party Node SDK; its HTTP API is the supported integration surface.";

// ----------------------------------------------------------------- SendGrid

const ListId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/u);

const SENDGRID_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "send-mail",
    name: "Send Mail",
    description: "Sends an email through SendGrid.",
    method: "POST",
    url: "/v3/mail/send",
    input: z
      .object({
        to: z.array(RestEmailSchema).min(1).max(1_000),
        from: RestEmailSchema,
        fromName: z.string().max(128).optional(),
        subject: z.string().min(1).max(998),
        text: z.string().max(2_000_000).optional(),
        html: z.string().max(2_000_000).optional(),
        cc: z.array(RestEmailSchema).max(1_000).optional(),
        bcc: z.array(RestEmailSchema).max(1_000).optional(),
        replyTo: RestEmailSchema.optional(),
        templateId: z.string().max(128).optional(),
        dynamicTemplateData: z.record(z.string(), z.unknown()).optional(),
      })
      .strict()
      .refine((v) => Boolean(v.text ?? v.html ?? v.templateId), {
        message: "An email needs text, html, or a template.",
      }),
    body: (i) => ({
      personalizations: [
        {
          to: i.to.map((email: string) => ({ email })),
          ...(i.cc ? { cc: i.cc.map((email: string) => ({ email })) } : {}),
          ...(i.bcc ? { bcc: i.bcc.map((email: string) => ({ email })) } : {}),
          ...(i.dynamicTemplateData
            ? { dynamic_template_data: i.dynamicTemplateData }
            : {}),
        },
      ],
      from: { email: i.from, ...(i.fromName ? { name: i.fromName } : {}) },
      subject: i.subject,
      ...(i.replyTo ? { reply_to: { email: i.replyTo } } : {}),
      ...(i.templateId ? { template_id: i.templateId } : {}),
      ...(i.text || i.html
        ? {
            content: [
              ...(i.text ? [{ type: "text/plain", value: i.text }] : []),
              ...(i.html ? [{ type: "text/html", value: i.html }] : []),
            ],
          }
        : {}),
    }),
    // A successful send answers 202 with no body.
    emptyResponse: true,
  },
  {
    action: "add-contact",
    name: "Add Contact",
    description: "Adds or updates a marketing contact.",
    method: "PUT",
    url: "/v3/marketing/contacts",
    input: z
      .object({
        contacts: z.array(z.record(z.string(), z.unknown())).min(1).max(30_000),
        listIds: z.array(ListId).max(50).optional(),
      })
      .strict(),
    body: (i) => ({
      contacts: i.contacts,
      ...(i.listIds ? { list_ids: i.listIds } : {}),
    }),
  },
  {
    action: "get-contact",
    name: "Get Contact",
    description: "Reads one marketing contact by ID.",
    method: "GET",
    url: (i) => `/v3/marketing/contacts/${restSegment(i.contactId)}`,
    input: z.object({ contactId: z.string().min(1).max(64) }).strict(),
  },
  {
    action: "search-contacts",
    name: "Search Contacts",
    description: "Searches contacts with a SendGrid query.",
    method: "POST",
    url: "/v3/marketing/contacts/search",
    input: z.object({ query: z.string().min(1).max(2_000) }).strict(),
    body: (i) => ({ query: i.query }),
  },
  {
    action: "delete-contacts",
    name: "Delete Contacts",
    description: "Deletes contacts by ID, or all of them.",
    method: "DELETE",
    url: (i) =>
      `/v3/marketing/contacts${restQuery(
        i.deleteAllContacts
          ? { delete_all_contacts: "true" }
          : { ids: (i.contactIds ?? []).join(",") },
      )}`,
    input: z
      .object({
        contactIds: z.array(z.string().min(1).max(64)).max(100).optional(),
        // Deleting every contact is irreversible, so it is an explicit flag
        // rather than the effect of omitting IDs.
        deleteAllContacts: z.boolean().optional(),
      })
      .strict()
      .refine(
        (v) => Boolean(v.contactIds?.length) !== Boolean(v.deleteAllContacts),
        {
          message: "Supply contact IDs or deleteAllContacts, not both.",
        },
      ),
  },
  {
    action: "create-list",
    name: "Create List",
    description: "Creates a marketing list.",
    method: "POST",
    url: "/v3/marketing/lists",
    input: z.object({ name: z.string().min(1).max(100) }).strict(),
    body: (i) => ({ name: i.name }),
  },
  {
    action: "get-list",
    name: "Get List",
    description: "Reads a marketing list.",
    method: "GET",
    url: (i) =>
      `/v3/marketing/lists/${restSegment(i.listId)}${restQuery({
        contact_sample: i.contactSample,
      })}`,
    input: z
      .object({ listId: ListId, contactSample: z.boolean().optional() })
      .strict(),
  },
  {
    action: "list-all-lists",
    name: "List All Lists",
    description: "Lists the marketing lists.",
    method: "GET",
    url: (i) =>
      `/v3/marketing/lists${restQuery({
        page_size: i.pageSize,
        page_token: i.pageToken,
      })}`,
    input: z
      .object({
        pageSize: z.number().int().min(1).max(1_000).optional(),
        pageToken: z.string().max(512).optional(),
      })
      .strict(),
  },
  {
    action: "delete-list",
    name: "Delete List",
    description: "Deletes a marketing list.",
    method: "DELETE",
    url: (i) =>
      `/v3/marketing/lists/${restSegment(i.listId)}${restQuery({
        delete_contacts: i.deleteContacts,
      })}`,
    input: z
      .object({ listId: ListId, deleteContacts: z.boolean().optional() })
      .strict(),
    // 204 on its own; 200 with a job id when it also deletes the contacts.
    emptyResponse: "optional",
  },
  {
    action: "add-contacts-to-list",
    name: "Add Contacts To List",
    description: "Adds existing contacts to a list.",
    method: "PUT",
    url: "/v3/marketing/contacts",
    input: z
      .object({
        listId: ListId,
        contacts: z.array(z.record(z.string(), z.unknown())).min(1).max(30_000),
      })
      .strict(),
    body: (i) => ({ list_ids: [i.listId], contacts: i.contacts }),
  },
  {
    action: "remove-contacts-from-list",
    name: "Remove Contacts From List",
    description: "Removes contacts from a list without deleting them.",
    method: "DELETE",
    url: (i) =>
      `/v3/marketing/lists/${restSegment(i.listId)}/contacts${restQuery({
        contact_ids: (i.contactIds ?? []).join(","),
      })}`,
    input: z
      .object({
        listId: ListId,
        contactIds: z.array(z.string().min(1).max(64)).min(1).max(100),
      })
      .strict(),
  },
  {
    action: "create-template",
    name: "Create Template",
    description: "Creates a dynamic email template.",
    method: "POST",
    url: "/v3/templates",
    input: z
      .object({
        name: z.string().min(1).max(100),
        generation: z.enum(["legacy", "dynamic"]).optional(),
      })
      .strict(),
    body: (i) => ({ name: i.name, generation: i.generation ?? "dynamic" }),
  },
  {
    action: "get-template",
    name: "Get Template",
    description: "Reads a template and its versions.",
    method: "GET",
    url: (i) => `/v3/templates/${restSegment(i.templateId)}`,
    input: z.object({ templateId: z.string().min(1).max(64) }).strict(),
    maxResponseBytes: 1_048_576,
  },
  {
    action: "list-templates",
    name: "List Templates",
    description: "Lists email templates.",
    method: "GET",
    url: (i) =>
      `/v3/templates${restQuery({
        generations: i.generations ?? "dynamic",
        page_size: i.pageSize ?? 100,
      })}`,
    input: z
      .object({
        generations: z.enum(["legacy", "dynamic", "legacy,dynamic"]).optional(),
        pageSize: z.number().int().min(1).max(200).optional(),
      })
      .strict(),
  },
  {
    action: "delete-template",
    name: "Delete Template",
    description: "Deletes a template.",
    method: "DELETE",
    url: (i) => `/v3/templates/${restSegment(i.templateId)}`,
    input: z.object({ templateId: z.string().min(1).max(64) }).strict(),
    emptyResponse: true,
  },
  {
    action: "create-template-version",
    name: "Create Template Version",
    description: "Adds a version to a template.",
    method: "POST",
    url: (i) => `/v3/templates/${restSegment(i.templateId)}/versions`,
    input: z
      .object({
        templateId: z.string().min(1).max(64),
        name: z.string().min(1).max(100),
        subject: z.string().min(1).max(998),
        htmlContent: z.string().max(2_000_000).optional(),
        plainContent: z.string().max(2_000_000).optional(),
        active: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      subject: i.subject,
      active: i.active === false ? 0 : 1,
      ...(i.htmlContent ? { html_content: i.htmlContent } : {}),
      ...(i.plainContent ? { plain_content: i.plainContent } : {}),
    }),
  },
];

export function createSendGridPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "sendgrid",
    sdkReview:
      "@sendgrid/mail covers only mail send; the marketing contacts, lists, and template actions have no SDK method, so the whole provider uses one lane.",
    transportKind: "api_key",
    actions: SENDGRID_ACTIONS,
  });
}
