import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from AgentMail's published OpenAPI document:
 * https://docs.agentmail.to/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "AgentMail publishes no maintained Node SDK; its OpenAPI document at https://docs.agentmail.to/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "send-message",
    name: "Send Message",
    description: "Send an email message from an AgentMail inbox",
    method: "POST",
    url: (i) => `/v0/inboxes/${restSegment(i.inboxId)}/messages/send`,
    input: z
      .object({
        inboxId: z.string().max(4_000),
        labels: SpecArray.optional(),
        replyTo: z.string().max(4_000).optional(),
        to: z.string().max(4_000).optional(),
        cc: z.string().max(4_000).optional(),
        bcc: z.string().max(4_000).optional(),
        subject: z.string().max(4_000).optional(),
        text: z.string().max(4_000).optional(),
        html: z.string().max(4_000).optional(),
        attachments: SpecArray.optional(),
        headers: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.labels !== undefined ? { labels: i.labels } : {}),
      ...(i.replyTo !== undefined ? { reply_to: i.replyTo } : {}),
      ...(i.to !== undefined ? { to: i.to } : {}),
      ...(i.cc !== undefined ? { cc: i.cc } : {}),
      ...(i.bcc !== undefined ? { bcc: i.bcc } : {}),
      ...(i.subject !== undefined ? { subject: i.subject } : {}),
      ...(i.text !== undefined ? { text: i.text } : {}),
      ...(i.html !== undefined ? { html: i.html } : {}),
      ...(i.attachments !== undefined ? { attachments: i.attachments } : {}),
      ...(i.headers !== undefined ? { headers: i.headers } : {}),
    }),
  },
  {
    action: "reply-to-message",
    name: "Reply to Message",
    description: "Reply to an existing email message in AgentMail",
    method: "POST",
    url: (i) =>
      `/v0/inboxes/${restSegment(i.inboxId)}/messages/${restSegment(i.messageId)}/reply`,
    input: z
      .object({
        inboxId: z.string().max(4_000),
        messageId: z.string().max(4_000),
        labels: SpecArray.optional(),
        replyTo: z.string().max(4_000).optional(),
        to: z.string().max(4_000).optional(),
        cc: z.string().max(4_000).optional(),
        bcc: z.string().max(4_000).optional(),
        replyAll: z.boolean().optional(),
        text: z.string().max(4_000).optional(),
        html: z.string().max(4_000).optional(),
        attachments: SpecArray.optional(),
        headers: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.labels !== undefined ? { labels: i.labels } : {}),
      ...(i.replyTo !== undefined ? { reply_to: i.replyTo } : {}),
      ...(i.to !== undefined ? { to: i.to } : {}),
      ...(i.cc !== undefined ? { cc: i.cc } : {}),
      ...(i.bcc !== undefined ? { bcc: i.bcc } : {}),
      ...(i.replyAll !== undefined ? { reply_all: i.replyAll } : {}),
      ...(i.text !== undefined ? { text: i.text } : {}),
      ...(i.html !== undefined ? { html: i.html } : {}),
      ...(i.attachments !== undefined ? { attachments: i.attachments } : {}),
      ...(i.headers !== undefined ? { headers: i.headers } : {}),
    }),
  },
  {
    action: "forward-message",
    name: "Forward Message",
    description: "Forward an email message to new recipients in AgentMail",
    method: "POST",
    url: (i) =>
      `/v0/inboxes/${restSegment(i.inboxId)}/messages/${restSegment(i.messageId)}/forward`,
    input: z
      .object({
        inboxId: z.string().max(4_000),
        messageId: z.string().max(4_000),
        labels: SpecArray.optional(),
        replyTo: z.string().max(4_000).optional(),
        to: z.string().max(4_000).optional(),
        cc: z.string().max(4_000).optional(),
        bcc: z.string().max(4_000).optional(),
        subject: z.string().max(4_000).optional(),
        text: z.string().max(4_000).optional(),
        html: z.string().max(4_000).optional(),
        attachments: SpecArray.optional(),
        headers: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.labels !== undefined ? { labels: i.labels } : {}),
      ...(i.replyTo !== undefined ? { reply_to: i.replyTo } : {}),
      ...(i.to !== undefined ? { to: i.to } : {}),
      ...(i.cc !== undefined ? { cc: i.cc } : {}),
      ...(i.bcc !== undefined ? { bcc: i.bcc } : {}),
      ...(i.subject !== undefined ? { subject: i.subject } : {}),
      ...(i.text !== undefined ? { text: i.text } : {}),
      ...(i.html !== undefined ? { html: i.html } : {}),
      ...(i.attachments !== undefined ? { attachments: i.attachments } : {}),
      ...(i.headers !== undefined ? { headers: i.headers } : {}),
    }),
  },
  {
    action: "list-threads",
    name: "List Threads",
    description: "List email threads in AgentMail",
    method: "GET",
    url: (i) =>
      `/v0/threads${restQuery({ limit: i.limit, page_token: i.pageToken, labels: i.labels, before: i.before, after: i.after, ascending: i.ascending, include_spam: i.includeSpam, include_blocked: i.includeBlocked, include_unauthenticated: i.includeUnauthenticated, include_trash: i.includeTrash, senders: i.senders, recipients: i.recipients, subject: i.subject })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageToken: z.string().max(4_000).optional(),
        labels: SpecArray.optional(),
        before: z.string().max(4_000).optional(),
        after: z.string().max(4_000).optional(),
        ascending: z.boolean().optional(),
        includeSpam: z.boolean().optional(),
        includeBlocked: z.boolean().optional(),
        includeUnauthenticated: z.boolean().optional(),
        includeTrash: z.boolean().optional(),
        senders: SpecArray.optional(),
        recipients: SpecArray.optional(),
        subject: SpecArray.optional(),
      })
      .strict(),
  },
  {
    action: "get-thread",
    name: "Get Thread",
    description:
      "Get details of a specific email thread including messages in AgentMail",
    method: "GET",
    url: (i) => `/v0/threads/${restSegment(i.threadId)}`,
    input: z
      .object({
        threadId: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "delete-thread",
    name: "Delete Thread",
    description:
      "Delete an email thread in AgentMail (moves to trash, or permanently deletes if already in trash)",
    method: "DELETE",
    url: (i) => `/v0/threads/${restSegment(i.threadId)}`,
    input: z
      .object({
        threadId: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-messages",
    name: "List Messages",
    description: "List messages in an inbox in AgentMail",
    method: "GET",
    url: (i) =>
      `/v0/inboxes/${restSegment(i.inboxId)}/messages${restQuery({ limit: i.limit, page_token: i.pageToken, labels: i.labels, before: i.before, after: i.after, ascending: i.ascending, include_spam: i.includeSpam, include_blocked: i.includeBlocked, include_unauthenticated: i.includeUnauthenticated, include_trash: i.includeTrash, from: i.from, to: i.to, subject: i.subject })}`,
    input: z
      .object({
        inboxId: z.string().max(4_000),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageToken: z.string().max(4_000).optional(),
        labels: SpecArray.optional(),
        before: z.string().max(4_000).optional(),
        after: z.string().max(4_000).optional(),
        ascending: z.boolean().optional(),
        includeSpam: z.boolean().optional(),
        includeBlocked: z.boolean().optional(),
        includeUnauthenticated: z.boolean().optional(),
        includeTrash: z.boolean().optional(),
        from: SpecArray.optional(),
        to: SpecArray.optional(),
        subject: SpecArray.optional(),
      })
      .strict(),
  },
  {
    action: "get-message",
    name: "Get Message",
    description: "Get details of a specific email message in AgentMail",
    method: "GET",
    url: (i) =>
      `/v0/inboxes/${restSegment(i.inboxId)}/messages/${restSegment(i.messageId)}`,
    input: z
      .object({
        inboxId: z.string().max(4_000),
        messageId: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "update-message-labels",
    name: "Update Message Labels",
    description: "Add or remove labels on an email message in AgentMail",
    method: "POST",
    url: (i) => `/v0/inboxes/${restSegment(i.inboxId)}/messages/batch-update`,
    input: z
      .object({
        inboxId: z.string().max(4_000),
        messageIds: SpecArray,
        addLabels: z.string().max(4_000).optional(),
        removeLabels: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      message_ids: i.messageIds,
      ...(i.addLabels !== undefined ? { add_labels: i.addLabels } : {}),
      ...(i.removeLabels !== undefined
        ? { remove_labels: i.removeLabels }
        : {}),
    }),
  },
  {
    action: "create-draft",
    name: "Create Draft",
    description: "Create a new email draft in AgentMail",
    method: "POST",
    url: (i) => `/v0/inboxes/${restSegment(i.inboxId)}/drafts`,
    input: z
      .object({
        inboxId: z.string().max(4_000),
        labels: SpecArray.optional(),
        replyTo: SpecArray.optional(),
        to: SpecArray.optional(),
        cc: SpecArray.optional(),
        bcc: SpecArray.optional(),
        subject: z.string().max(4_000).optional(),
        text: z.string().max(4_000).optional(),
        html: z.string().max(4_000).optional(),
        attachments: SpecArray.optional(),
        inReplyTo: z.string().max(4_000).optional(),
        forwardOf: z.string().max(4_000).optional(),
        replyAll: z.boolean().optional(),
        sendAt: z.string().max(4_000).optional(),
        clientId: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.labels !== undefined ? { labels: i.labels } : {}),
      ...(i.replyTo !== undefined ? { reply_to: i.replyTo } : {}),
      ...(i.to !== undefined ? { to: i.to } : {}),
      ...(i.cc !== undefined ? { cc: i.cc } : {}),
      ...(i.bcc !== undefined ? { bcc: i.bcc } : {}),
      ...(i.subject !== undefined ? { subject: i.subject } : {}),
      ...(i.text !== undefined ? { text: i.text } : {}),
      ...(i.html !== undefined ? { html: i.html } : {}),
      ...(i.attachments !== undefined ? { attachments: i.attachments } : {}),
      ...(i.inReplyTo !== undefined ? { in_reply_to: i.inReplyTo } : {}),
      ...(i.forwardOf !== undefined ? { forward_of: i.forwardOf } : {}),
      ...(i.replyAll !== undefined ? { reply_all: i.replyAll } : {}),
      ...(i.sendAt !== undefined ? { send_at: i.sendAt } : {}),
      ...(i.clientId !== undefined ? { client_id: i.clientId } : {}),
    }),
  },
  {
    action: "list-drafts",
    name: "List Drafts",
    description: "List email drafts in an inbox in AgentMail",
    method: "GET",
    url: (i) =>
      `/v0/drafts${restQuery({ limit: i.limit, page_token: i.pageToken, labels: i.labels, before: i.before, after: i.after, ascending: i.ascending })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageToken: z.string().max(4_000).optional(),
        labels: SpecArray.optional(),
        before: z.string().max(4_000).optional(),
        after: z.string().max(4_000).optional(),
        ascending: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "get-draft",
    name: "Get Draft",
    description: "Get details of a specific email draft in AgentMail",
    method: "GET",
    url: (i) => `/v0/drafts/${restSegment(i.draftId)}`,
    input: z
      .object({
        draftId: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "update-draft",
    name: "Update Draft",
    description: "Update an existing email draft in AgentMail",
    method: "PATCH",
    url: (i) =>
      `/v0/inboxes/${restSegment(i.inboxId)}/drafts/${restSegment(i.draftId)}`,
    input: z
      .object({
        inboxId: z.string().max(4_000),
        draftId: z.string().max(4_000),
        replyTo: z.string().max(4_000).optional(),
        to: z.string().max(4_000).optional(),
        cc: z.string().max(4_000).optional(),
        bcc: z.string().max(4_000).optional(),
        subject: z.string().max(4_000).optional(),
        text: z.string().max(4_000).optional(),
        html: z.string().max(4_000).optional(),
        addAttachments: SpecArray.optional(),
        removeAttachments: SpecArray.optional(),
        addLabels: SpecArray.optional(),
        removeLabels: SpecArray.optional(),
        sendAt: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.replyTo !== undefined ? { reply_to: i.replyTo } : {}),
      ...(i.to !== undefined ? { to: i.to } : {}),
      ...(i.cc !== undefined ? { cc: i.cc } : {}),
      ...(i.bcc !== undefined ? { bcc: i.bcc } : {}),
      ...(i.subject !== undefined ? { subject: i.subject } : {}),
      ...(i.text !== undefined ? { text: i.text } : {}),
      ...(i.html !== undefined ? { html: i.html } : {}),
      ...(i.addAttachments !== undefined
        ? { add_attachments: i.addAttachments }
        : {}),
      ...(i.removeAttachments !== undefined
        ? { remove_attachments: i.removeAttachments }
        : {}),
      ...(i.addLabels !== undefined ? { add_labels: i.addLabels } : {}),
      ...(i.removeLabels !== undefined
        ? { remove_labels: i.removeLabels }
        : {}),
      ...(i.sendAt !== undefined ? { send_at: i.sendAt } : {}),
    }),
  },
  {
    action: "delete-draft",
    name: "Delete Draft",
    description: "Delete an email draft in AgentMail",
    method: "DELETE",
    url: (i) =>
      `/v0/inboxes/${restSegment(i.inboxId)}/drafts/${restSegment(i.draftId)}`,
    input: z
      .object({
        inboxId: z.string().max(4_000),
        draftId: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "send-draft",
    name: "Send Draft",
    description: "Send an existing email draft in AgentMail",
    method: "POST",
    url: (i) =>
      `/v0/inboxes/${restSegment(i.inboxId)}/drafts/${restSegment(i.draftId)}/send`,
    input: z
      .object({
        inboxId: z.string().max(4_000),
        draftId: z.string().max(4_000),
        addLabels: z.string().max(4_000).optional(),
        removeLabels: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.addLabels !== undefined ? { add_labels: i.addLabels } : {}),
      ...(i.removeLabels !== undefined
        ? { remove_labels: i.removeLabels }
        : {}),
    }),
  },
  {
    action: "list-inboxes",
    name: "List Inboxes",
    description: "List all email inboxes in AgentMail",
    method: "GET",
    url: (i) =>
      `/v0/inboxes${restQuery({ limit: i.limit, page_token: i.pageToken, ascending: i.ascending })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageToken: z.string().max(4_000).optional(),
        ascending: z.boolean().optional(),
      })
      .strict(),
  },
];

export function createAgentmailPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "agentmail",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "update-thread-labels":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "create-inbox":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-inbox":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "update-inbox":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "delete-inbox":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
