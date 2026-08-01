import { z } from "zod";

import type { IntegrationProviderPack } from "../../provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "./pack";

const NoSdkNote =
  "publishes no maintained first-party Node SDK; its HTTP API is the supported integration surface.";

// ------------------------------------------------------------------ Discord

/** Discord addresses everything by numeric snowflake. */
const Snowflake = z
  .string()
  .min(1)
  .max(24)
  .regex(/^\d{1,20}$/u);
const Reason = z.string().max(512).optional();

/** Discord records an audit-log reason from this header on moderation writes. */
function auditHeaders(i: { reason?: string }): Record<string, string> {
  return i.reason ? { "x-audit-log-reason": i.reason } : {};
}

const channel = (i: { channelId: string }) => restSegment(i.channelId);
const guild = (i: { guildId: string }) => restSegment(i.guildId);

const DISCORD_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "send-message",
    name: "Send Message",
    description: "Posts a message to a channel.",
    method: "POST",
    url: (i) => `/channels/${channel(i)}/messages`,
    input: z
      .object({
        channelId: Snowflake,
        content: z.string().max(2_000).optional(),
        embeds: z.array(z.record(z.string(), z.unknown())).max(10).optional(),
        replyToMessageId: Snowflake.optional(),
        tts: z.boolean().optional(),
      })
      .strict()
      .refine((v) => Boolean(v.content ?? v.embeds), {
        message: "A message needs content or embeds.",
      }),
    body: (i) => ({
      ...(i.content ? { content: i.content } : {}),
      ...(i.embeds ? { embeds: i.embeds } : {}),
      ...(i.tts ? { tts: true } : {}),
      ...(i.replyToMessageId
        ? { message_reference: { message_id: i.replyToMessageId } }
        : {}),
    }),
  },
  {
    action: "get-channel-messages",
    name: "Get Channel Messages",
    description: "Reads recent messages from a channel.",
    method: "GET",
    url: (i) =>
      `/channels/${channel(i)}/messages${restQuery({
        limit: i.limit,
        before: i.before,
        after: i.after,
      })}`,
    input: z
      .object({
        channelId: Snowflake,
        limit: z.number().int().min(1).max(100).optional(),
        before: Snowflake.optional(),
        after: Snowflake.optional(),
      })
      .strict(),
  },
  {
    action: "edit-message",
    name: "Edit Message",
    description: "Edits a message the bot sent.",
    method: "PATCH",
    url: (i) => `/channels/${channel(i)}/messages/${restSegment(i.messageId)}`,
    input: z
      .object({
        channelId: Snowflake,
        messageId: Snowflake,
        content: z.string().max(2_000).optional(),
        embeds: z.array(z.record(z.string(), z.unknown())).max(10).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.content === undefined ? {} : { content: i.content }),
      ...(i.embeds ? { embeds: i.embeds } : {}),
    }),
  },
  {
    action: "delete-message",
    name: "Delete Message",
    description: "Deletes one message.",
    method: "DELETE",
    url: (i) => `/channels/${channel(i)}/messages/${restSegment(i.messageId)}`,
    input: z
      .object({ channelId: Snowflake, messageId: Snowflake, reason: Reason })
      .strict(),
    headers: auditHeaders,
    emptyResponse: true,
  },
  {
    action: "bulk-delete-messages",
    name: "Bulk Delete Messages",
    description: "Deletes between 2 and 100 recent messages at once.",
    method: "POST",
    url: (i) => `/channels/${channel(i)}/messages/bulk-delete`,
    input: z
      .object({
        channelId: Snowflake,
        // Discord rejects a bulk delete outside this range, or of messages
        // older than two weeks.
        messageIds: z.array(Snowflake).min(2).max(100),
        reason: Reason,
      })
      .strict(),
    body: (i) => ({ messages: i.messageIds }),
    headers: auditHeaders,
    emptyResponse: true,
  },
  {
    action: "add-reaction",
    name: "Add Reaction",
    description: "Adds the bot's reaction to a message.",
    method: "PUT",
    url: (i) =>
      `/channels/${channel(i)}/messages/${restSegment(i.messageId)}/reactions/${restSegment(i.emoji)}/@me`,
    input: z
      .object({
        channelId: Snowflake,
        messageId: Snowflake,
        emoji: z.string().min(1).max(64),
      })
      .strict(),
    emptyResponse: true,
  },
  {
    action: "remove-reaction",
    name: "Remove Reaction",
    description: "Removes the bot's reaction from a message.",
    method: "DELETE",
    url: (i) =>
      `/channels/${channel(i)}/messages/${restSegment(i.messageId)}/reactions/${restSegment(i.emoji)}/@me`,
    input: z
      .object({
        channelId: Snowflake,
        messageId: Snowflake,
        emoji: z.string().min(1).max(64),
      })
      .strict(),
    emptyResponse: true,
  },
  {
    action: "pin-message",
    name: "Pin Message",
    description: "Pins a message in a channel.",
    method: "PUT",
    url: (i) => `/channels/${channel(i)}/pins/${restSegment(i.messageId)}`,
    input: z
      .object({ channelId: Snowflake, messageId: Snowflake, reason: Reason })
      .strict(),
    headers: auditHeaders,
    emptyResponse: true,
  },
  {
    action: "unpin-message",
    name: "Unpin Message",
    description: "Unpins a message.",
    method: "DELETE",
    url: (i) => `/channels/${channel(i)}/pins/${restSegment(i.messageId)}`,
    input: z
      .object({ channelId: Snowflake, messageId: Snowflake, reason: Reason })
      .strict(),
    headers: auditHeaders,
    emptyResponse: true,
  },
  {
    action: "get-pinned-messages",
    name: "Get Pinned Messages",
    description: "Lists the pinned messages in a channel.",
    method: "GET",
    url: (i) => `/channels/${channel(i)}/pins`,
    input: z.object({ channelId: Snowflake }).strict(),
  },
  {
    action: "create-thread",
    name: "Create Thread",
    description: "Starts a thread, optionally from an existing message.",
    method: "POST",
    url: (i) =>
      i.messageId
        ? `/channels/${channel(i)}/messages/${restSegment(i.messageId)}/threads`
        : `/channels/${channel(i)}/threads`,
    input: z
      .object({
        channelId: Snowflake,
        messageId: Snowflake.optional(),
        name: z.string().min(1).max(100),
        autoArchiveDuration: z
          .union([
            z.literal(60),
            z.literal(1_440),
            z.literal(4_320),
            z.literal(10_080),
          ])
          .optional(),
        type: z.number().int().optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      auto_archive_duration: i.autoArchiveDuration ?? 1_440,
      // A thread started without a message needs an explicit type; 11 is a
      // public thread.
      ...(i.messageId ? {} : { type: i.type ?? 11 }),
    }),
  },
  {
    action: "join-thread",
    name: "Join Thread",
    description: "Adds the bot to a thread.",
    method: "PUT",
    url: (i) => `/channels/${restSegment(i.threadId)}/thread-members/@me`,
    input: z.object({ threadId: Snowflake }).strict(),
    emptyResponse: true,
  },
  {
    action: "leave-thread",
    name: "Leave Thread",
    description: "Removes the bot from a thread.",
    method: "DELETE",
    url: (i) => `/channels/${restSegment(i.threadId)}/thread-members/@me`,
    input: z.object({ threadId: Snowflake }).strict(),
    emptyResponse: true,
  },
  {
    action: "archive-thread",
    name: "Archive Thread",
    description: "Archives or unarchives a thread.",
    method: "PATCH",
    url: (i) => `/channels/${restSegment(i.threadId)}`,
    input: z
      .object({
        threadId: Snowflake,
        archived: z.boolean().optional(),
        locked: z.boolean().optional(),
        reason: Reason,
      })
      .strict(),
    body: (i) => ({
      archived: i.archived !== false,
      ...(i.locked === undefined ? {} : { locked: i.locked }),
    }),
    headers: auditHeaders,
  },
  {
    action: "get-channel",
    name: "Get Channel",
    description: "Reads a channel's settings.",
    method: "GET",
    url: (i) => `/channels/${channel(i)}`,
    input: z.object({ channelId: Snowflake }).strict(),
  },
  {
    action: "list-channels",
    name: "List Channels",
    description: "Lists the channels in a server.",
    method: "GET",
    url: (i) => `/guilds/${guild(i)}/channels`,
    input: z.object({ guildId: Snowflake }).strict(),
  },
  {
    action: "create-channel",
    name: "Create Channel",
    description: "Creates a channel in a server.",
    method: "POST",
    url: (i) => `/guilds/${guild(i)}/channels`,
    input: z
      .object({
        guildId: Snowflake,
        name: z.string().min(1).max(100),
        type: z.number().int().min(0).max(15).optional(),
        parentId: Snowflake.optional(),
        topic: z.string().max(1_024).optional(),
        reason: Reason,
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      type: i.type ?? 0,
      ...(i.parentId ? { parent_id: i.parentId } : {}),
      ...(i.topic ? { topic: i.topic } : {}),
    }),
    headers: auditHeaders,
  },
  {
    action: "update-channel",
    name: "Update Channel",
    description: "Updates a channel's settings.",
    method: "PATCH",
    url: (i) => `/channels/${channel(i)}`,
    input: z
      .object({
        channelId: Snowflake,
        name: z.string().min(1).max(100).optional(),
        topic: z.string().max(1_024).optional(),
        nsfw: z.boolean().optional(),
        rateLimitPerUser: z.number().int().min(0).max(21_600).optional(),
        reason: Reason,
      })
      .strict(),
    body: (i) => ({
      ...(i.name ? { name: i.name } : {}),
      ...(i.topic === undefined ? {} : { topic: i.topic }),
      ...(i.nsfw === undefined ? {} : { nsfw: i.nsfw }),
      ...(i.rateLimitPerUser === undefined
        ? {}
        : { rate_limit_per_user: i.rateLimitPerUser }),
    }),
    headers: auditHeaders,
  },
  {
    action: "delete-channel",
    name: "Delete Channel",
    description: "Deletes a channel.",
    method: "DELETE",
    url: (i) => `/channels/${channel(i)}`,
    input: z.object({ channelId: Snowflake, reason: Reason }).strict(),
    headers: auditHeaders,
  },
  {
    action: "get-server-information",
    name: "Get Server Information",
    description: "Reads a server's profile.",
    method: "GET",
    url: (i) => `/guilds/${guild(i)}${restQuery({ with_counts: true })}`,
    input: z.object({ guildId: Snowflake }).strict(),
  },
  {
    action: "get-user-information",
    name: "Get User Information",
    description: "Reads a Discord user's public profile.",
    method: "GET",
    url: (i) => `/users/${restSegment(i.userId)}`,
    input: z.object({ userId: Snowflake }).strict(),
  },
  {
    action: "list-roles",
    name: "List Roles",
    description: "Lists a server's roles.",
    method: "GET",
    url: (i) => `/guilds/${guild(i)}/roles`,
    input: z.object({ guildId: Snowflake }).strict(),
  },
  {
    action: "create-role",
    name: "Create Role",
    description: "Creates a role in a server.",
    method: "POST",
    url: (i) => `/guilds/${guild(i)}/roles`,
    input: z
      .object({
        guildId: Snowflake,
        name: z.string().min(1).max(100),
        // Discord sends permissions as a decimal bitfield string.
        permissions: z.string().max(32).regex(/^\d+$/u).optional(),
        color: z.number().int().min(0).max(0xff_ff_ff).optional(),
        hoist: z.boolean().optional(),
        mentionable: z.boolean().optional(),
        reason: Reason,
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      ...(i.permissions ? { permissions: i.permissions } : {}),
      ...(i.color === undefined ? {} : { color: i.color }),
      ...(i.hoist === undefined ? {} : { hoist: i.hoist }),
      ...(i.mentionable === undefined ? {} : { mentionable: i.mentionable }),
    }),
    headers: auditHeaders,
  },
  {
    action: "update-role",
    name: "Update Role",
    description: "Updates a role.",
    method: "PATCH",
    url: (i) => `/guilds/${guild(i)}/roles/${restSegment(i.roleId)}`,
    input: z
      .object({
        guildId: Snowflake,
        roleId: Snowflake,
        name: z.string().min(1).max(100).optional(),
        permissions: z.string().max(32).regex(/^\d+$/u).optional(),
        color: z.number().int().min(0).max(0xff_ff_ff).optional(),
        reason: Reason,
      })
      .strict(),
    body: (i) => ({
      ...(i.name ? { name: i.name } : {}),
      ...(i.permissions ? { permissions: i.permissions } : {}),
      ...(i.color === undefined ? {} : { color: i.color }),
    }),
    headers: auditHeaders,
  },
  {
    action: "delete-role",
    name: "Delete Role",
    description: "Deletes a role.",
    method: "DELETE",
    url: (i) => `/guilds/${guild(i)}/roles/${restSegment(i.roleId)}`,
    input: z
      .object({ guildId: Snowflake, roleId: Snowflake, reason: Reason })
      .strict(),
    headers: auditHeaders,
    emptyResponse: true,
  },
  {
    action: "assign-role",
    name: "Assign Role",
    description: "Grants a role to a member.",
    method: "PUT",
    url: (i) =>
      `/guilds/${guild(i)}/members/${restSegment(i.userId)}/roles/${restSegment(i.roleId)}`,
    input: z
      .object({
        guildId: Snowflake,
        userId: Snowflake,
        roleId: Snowflake,
        reason: Reason,
      })
      .strict(),
    headers: auditHeaders,
    emptyResponse: true,
  },
  {
    action: "remove-role",
    name: "Remove Role",
    description: "Removes a role from a member.",
    method: "DELETE",
    url: (i) =>
      `/guilds/${guild(i)}/members/${restSegment(i.userId)}/roles/${restSegment(i.roleId)}`,
    input: z
      .object({
        guildId: Snowflake,
        userId: Snowflake,
        roleId: Snowflake,
        reason: Reason,
      })
      .strict(),
    headers: auditHeaders,
    emptyResponse: true,
  },
  {
    action: "get-member",
    name: "Get Member",
    description: "Reads a server member.",
    method: "GET",
    url: (i) => `/guilds/${guild(i)}/members/${restSegment(i.userId)}`,
    input: z.object({ guildId: Snowflake, userId: Snowflake }).strict(),
  },
  {
    action: "update-member",
    name: "Update Member",
    description: "Updates a member's nickname, roles, or voice state.",
    method: "PATCH",
    url: (i) => `/guilds/${guild(i)}/members/${restSegment(i.userId)}`,
    input: z
      .object({
        guildId: Snowflake,
        userId: Snowflake,
        nick: z.string().max(32).optional(),
        roles: z.array(Snowflake).max(250).optional(),
        mute: z.boolean().optional(),
        deaf: z.boolean().optional(),
        reason: Reason,
      })
      .strict(),
    body: (i) => ({
      ...(i.nick === undefined ? {} : { nick: i.nick }),
      ...(i.roles ? { roles: i.roles } : {}),
      ...(i.mute === undefined ? {} : { mute: i.mute }),
      ...(i.deaf === undefined ? {} : { deaf: i.deaf }),
    }),
    headers: auditHeaders,
  },
  {
    action: "kick-member",
    name: "Kick Member",
    description: "Removes a member from a server; they may rejoin.",
    method: "DELETE",
    url: (i) => `/guilds/${guild(i)}/members/${restSegment(i.userId)}`,
    input: z
      .object({ guildId: Snowflake, userId: Snowflake, reason: Reason })
      .strict(),
    headers: auditHeaders,
    emptyResponse: true,
  },
  {
    action: "ban-member",
    name: "Ban Member",
    description: "Bans a member, optionally deleting their recent messages.",
    method: "PUT",
    url: (i) => `/guilds/${guild(i)}/bans/${restSegment(i.userId)}`,
    input: z
      .object({
        guildId: Snowflake,
        userId: Snowflake,
        // Discord accepts up to seven days of message history to purge.
        deleteMessageSeconds: z.number().int().min(0).max(604_800).optional(),
        reason: Reason,
      })
      .strict(),
    body: (i) =>
      i.deleteMessageSeconds === undefined
        ? {}
        : { delete_message_seconds: i.deleteMessageSeconds },
    headers: auditHeaders,
    emptyResponse: true,
  },
  {
    action: "unban-member",
    name: "Unban Member",
    description: "Lifts a ban.",
    method: "DELETE",
    url: (i) => `/guilds/${guild(i)}/bans/${restSegment(i.userId)}`,
    input: z
      .object({ guildId: Snowflake, userId: Snowflake, reason: Reason })
      .strict(),
    headers: auditHeaders,
    emptyResponse: true,
  },
  {
    action: "create-invite",
    name: "Create Invite",
    description: "Creates an invite to a channel.",
    method: "POST",
    url: (i) => `/channels/${channel(i)}/invites`,
    input: z
      .object({
        channelId: Snowflake,
        maxAge: z.number().int().min(0).max(604_800).optional(),
        maxUses: z.number().int().min(0).max(100).optional(),
        temporary: z.boolean().optional(),
        unique: z.boolean().optional(),
        reason: Reason,
      })
      .strict(),
    body: (i) => ({
      ...(i.maxAge === undefined ? {} : { max_age: i.maxAge }),
      ...(i.maxUses === undefined ? {} : { max_uses: i.maxUses }),
      ...(i.temporary === undefined ? {} : { temporary: i.temporary }),
      ...(i.unique === undefined ? {} : { unique: i.unique }),
    }),
    headers: auditHeaders,
  },
  {
    action: "get-invite",
    name: "Get Invite",
    description: "Reads an invite by its code.",
    method: "GET",
    url: (i) =>
      `/invites/${restSegment(i.code)}${restQuery({ with_counts: true })}`,
    input: z
      .object({
        code: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[A-Za-z0-9-]+$/u),
      })
      .strict(),
  },
  {
    action: "delete-invite",
    name: "Delete Invite",
    description: "Revokes an invite.",
    method: "DELETE",
    url: (i) => `/invites/${restSegment(i.code)}`,
    input: z
      .object({
        code: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[A-Za-z0-9-]+$/u),
        reason: Reason,
      })
      .strict(),
    headers: auditHeaders,
  },
  {
    action: "create-webhook",
    name: "Create Webhook",
    description: "Creates a channel webhook.",
    method: "POST",
    url: (i) => `/channels/${channel(i)}/webhooks`,
    input: z
      .object({
        channelId: Snowflake,
        name: z.string().min(1).max(80),
        reason: Reason,
      })
      .strict(),
    body: (i) => ({ name: i.name }),
    headers: auditHeaders,
  },
  {
    action: "get-webhook",
    name: "Get Webhook",
    description: "Reads a webhook.",
    method: "GET",
    url: (i) => `/webhooks/${restSegment(i.webhookId)}`,
    input: z.object({ webhookId: Snowflake }).strict(),
  },
  {
    action: "delete-webhook",
    name: "Delete Webhook",
    description: "Deletes a webhook.",
    method: "DELETE",
    url: (i) => `/webhooks/${restSegment(i.webhookId)}`,
    input: z.object({ webhookId: Snowflake, reason: Reason }).strict(),
    headers: auditHeaders,
    emptyResponse: true,
  },
  {
    action: "execute-webhook",
    name: "Execute Webhook",
    description: "Posts a message through a webhook's own token.",
    method: "POST",
    url: (i) =>
      `/webhooks/${restSegment(i.webhookId)}/${restSegment(i.webhookToken)}${restQuery(
        { wait: i.wait ?? true },
      )}`,
    input: z
      .object({
        webhookId: Snowflake,
        // The webhook token authorizes this call on its own; the connection's
        // bot token is not what Discord checks here.
        webhookToken: z
          .string()
          .min(1)
          .max(128)
          .regex(/^[\w-]+$/u),
        content: z.string().max(2_000).optional(),
        embeds: z.array(z.record(z.string(), z.unknown())).max(10).optional(),
        username: z.string().max(80).optional(),
        wait: z.boolean().optional(),
      })
      .strict()
      .refine((v) => Boolean(v.content ?? v.embeds), {
        message: "A webhook message needs content or embeds.",
      }),
    body: (i) => ({
      ...(i.content ? { content: i.content } : {}),
      ...(i.embeds ? { embeds: i.embeds } : {}),
      ...(i.username ? { username: i.username } : {}),
    }),
  },
];

export function createDiscordPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "discord",
    sdkReview: `Discord ${NoSdkNote} discord.js is a gateway-first bot framework rather than an HTTP client for these actions.`,
    transportKind: "api_key",
    actions: DISCORD_ACTIONS,
  });
}

// ----------------------------------------------------------------- SendGrid

const Email = z.string().email().max(320);
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
        to: z.array(Email).min(1).max(1_000),
        from: Email,
        fromName: z.string().max(128).optional(),
        subject: z.string().min(1).max(998),
        text: z.string().max(2_000_000).optional(),
        html: z.string().max(2_000_000).optional(),
        cc: z.array(Email).max(1_000).optional(),
        bcc: z.array(Email).max(1_000).optional(),
        replyTo: Email.optional(),
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

// ---------------------------------------------------------------- PagerDuty

const PagerDutyId = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[A-Z0-9]+$/u);

/** Every PagerDuty write needs the acting user's email in a header. */
function fromHeader(i: { from?: string }): Record<string, string> {
  return i.from ? { From: i.from } : {};
}

const PAGERDUTY_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-incidents",
    name: "List Incidents",
    description: "Lists incidents, optionally filtered.",
    method: "GET",
    url: (i) =>
      `/incidents${restQuery({
        statuses: i.statuses,
        "service_ids[]": i.serviceIds,
        urgencies: i.urgencies,
        since: i.since,
        until: i.until,
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        statuses: z
          .array(z.enum(["triggered", "acknowledged", "resolved"]))
          .max(3)
          .optional(),
        serviceIds: z.array(PagerDutyId).max(50).optional(),
        urgencies: z
          .array(z.enum(["high", "low"]))
          .max(2)
          .optional(),
        since: z.string().max(64).optional(),
        until: z.string().max(64).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .strict(),
  },
  {
    action: "get-incident",
    name: "Get Incident",
    description: "Reads one incident.",
    method: "GET",
    url: (i) => `/incidents/${restSegment(i.incidentId)}`,
    input: z.object({ incidentId: PagerDutyId }).strict(),
  },
  {
    action: "create-incident",
    name: "Create Incident",
    description: "Creates an incident on a service.",
    method: "POST",
    url: "/incidents",
    input: z
      .object({
        from: Email,
        serviceId: PagerDutyId,
        title: z.string().min(1).max(1_024),
        urgency: z.enum(["high", "low"]).optional(),
        body: z.string().max(10_000).optional(),
        escalationPolicyId: PagerDutyId.optional(),
      })
      .strict(),
    body: (i) => ({
      incident: {
        type: "incident",
        title: i.title,
        service: { id: i.serviceId, type: "service_reference" },
        ...(i.urgency ? { urgency: i.urgency } : {}),
        ...(i.body ? { body: { type: "incident_body", details: i.body } } : {}),
        ...(i.escalationPolicyId
          ? {
              escalation_policy: {
                id: i.escalationPolicyId,
                type: "escalation_policy_reference",
              },
            }
          : {}),
      },
    }),
    headers: fromHeader,
  },
  {
    action: "update-incident",
    name: "Update Incident",
    description: "Changes an incident's status, urgency, or assignment.",
    method: "PUT",
    url: (i) => `/incidents/${restSegment(i.incidentId)}`,
    input: z
      .object({
        from: Email,
        incidentId: PagerDutyId,
        status: z.enum(["acknowledged", "resolved"]).optional(),
        urgency: z.enum(["high", "low"]).optional(),
        resolution: z.string().max(10_000).optional(),
        escalationLevel: z.number().int().min(1).max(10).optional(),
      })
      .strict(),
    body: (i) => ({
      incident: {
        type: "incident_reference",
        ...(i.status ? { status: i.status } : {}),
        ...(i.urgency ? { urgency: i.urgency } : {}),
        ...(i.resolution ? { resolution: i.resolution } : {}),
        ...(i.escalationLevel ? { escalation_level: i.escalationLevel } : {}),
      },
    }),
    headers: fromHeader,
  },
  {
    action: "snooze-incident",
    name: "Snooze Incident",
    description: "Silences an incident for a number of seconds.",
    method: "POST",
    url: (i) => `/incidents/${restSegment(i.incidentId)}/snooze`,
    input: z
      .object({
        from: Email,
        incidentId: PagerDutyId,
        duration: z
          .number()
          .int()
          .min(60)
          .max(86_400 * 7),
      })
      .strict(),
    body: (i) => ({ duration: i.duration }),
    headers: fromHeader,
  },
  {
    action: "merge-incidents",
    name: "Merge Incidents",
    description: "Merges other incidents into a target incident.",
    method: "PUT",
    url: (i) => `/incidents/${restSegment(i.incidentId)}/merge`,
    input: z
      .object({
        from: Email,
        incidentId: PagerDutyId,
        sourceIncidentIds: z.array(PagerDutyId).min(1).max(100),
      })
      .strict(),
    body: (i) => ({
      source_incidents: i.sourceIncidentIds.map((id: string) => ({
        id,
        type: "incident_reference",
      })),
    }),
    headers: fromHeader,
  },
  {
    action: "add-note",
    name: "Add Note",
    description: "Adds a note to an incident.",
    method: "POST",
    url: (i) => `/incidents/${restSegment(i.incidentId)}/notes`,
    input: z
      .object({
        from: Email,
        incidentId: PagerDutyId,
        content: z.string().min(1).max(10_000),
      })
      .strict(),
    body: (i) => ({ note: { content: i.content } }),
    headers: fromHeader,
  },
  {
    action: "list-incident-alerts",
    name: "List Incident Alerts",
    description: "Lists the alerts that make up an incident.",
    method: "GET",
    url: (i) =>
      `/incidents/${restSegment(i.incidentId)}/alerts${restQuery({
        limit: i.limit,
      })}`,
    input: z
      .object({
        incidentId: PagerDutyId,
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
  },
  {
    action: "list-services",
    name: "List Services",
    description: "Lists services.",
    method: "GET",
    url: (i) =>
      `/services${restQuery({ query: i.query, limit: i.limit, offset: i.offset })}`,
    input: z
      .object({
        query: z.string().max(256).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .strict(),
  },
  {
    action: "get-service",
    name: "Get Service",
    description: "Reads one service.",
    method: "GET",
    url: (i) => `/services/${restSegment(i.serviceId)}`,
    input: z.object({ serviceId: PagerDutyId }).strict(),
  },
  {
    action: "list-on-calls",
    name: "List On-Calls",
    description: "Lists who is on call, by policy or time window.",
    method: "GET",
    url: (i) =>
      `/oncalls${restQuery({
        "escalation_policy_ids[]": i.escalationPolicyIds,
        "schedule_ids[]": i.scheduleIds,
        since: i.since,
        until: i.until,
        limit: i.limit,
      })}`,
    input: z
      .object({
        escalationPolicyIds: z.array(PagerDutyId).max(50).optional(),
        scheduleIds: z.array(PagerDutyId).max(50).optional(),
        since: z.string().max(64).optional(),
        until: z.string().max(64).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
  },
  {
    action: "list-escalation-policies",
    name: "List Escalation Policies",
    description: "Lists escalation policies.",
    method: "GET",
    url: (i) =>
      `/escalation_policies${restQuery({ query: i.query, limit: i.limit })}`,
    input: z
      .object({
        query: z.string().max(256).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
  },
  {
    action: "list-schedules",
    name: "List Schedules",
    description: "Lists on-call schedules.",
    method: "GET",
    url: (i) => `/schedules${restQuery({ query: i.query, limit: i.limit })}`,
    input: z
      .object({
        query: z.string().max(256).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
  },
  {
    action: "list-users",
    name: "List Users",
    description: "Lists PagerDuty users.",
    method: "GET",
    url: (i) => `/users${restQuery({ query: i.query, limit: i.limit })}`,
    input: z
      .object({
        query: z.string().max(256).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
  },
];

export function createPagerDutyPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "pagerduty",
    sdkReview: `PagerDuty ${NoSdkNote} @pagerduty/pdjs is a thin fetch wrapper without typed operations.`,
    transportKind: "api_key",
    actions: PAGERDUTY_ACTIONS,
    deferrals: {
      "send-event":
        "The Events API v2 lives on events.pagerduty.com, a different host from the REST API, and this lane resolves every action against one host.",
    },
    headers: {
      // The REST API selects its response shape from this Accept header.
      accept: "application/vnd.pagerduty+json;version=2",
    },
  });
}

// ----------------------------------------------------------------- LinkedIn

const LINKEDIN_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "get-profile",
    name: "Get Profile",
    description: "Reads the authenticated member's profile.",
    method: "GET",
    url: "/v2/userinfo",
    input: z.object({}).strict(),
  },
  {
    action: "share-post",
    name: "Share Post",
    description: "Publishes a post as the authenticated member.",
    method: "POST",
    url: "/rest/posts",
    input: z
      .object({
        // LinkedIn addresses the author by URN, which the product holds on
        // its connection row after the profile read.
        authorUrn: z
          .string()
          .min(1)
          .max(128)
          .regex(/^urn:li:(person|organization):[A-Za-z0-9_-]+$/u),
        commentary: z.string().min(1).max(3_000),
        visibility: z.enum(["PUBLIC", "CONNECTIONS"]).optional(),
      })
      .strict(),
    body: (i) => ({
      author: i.authorUrn,
      commentary: i.commentary,
      visibility: i.visibility ?? "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
    headers: () => ({
      "content-type": "application/json",
      // The versioned Posts API requires both of these.
      "LinkedIn-Version": "202405",
      "X-Restli-Protocol-Version": "2.0.0",
    }),
  },
];

export function createLinkedInPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "linkedin",
    sdkReview: `LinkedIn ${NoSdkNote}`,
    transportKind: "oauth2",
    actions: LINKEDIN_ACTIONS,
  });
}

// ------------------------------------------------------------------ Webflow

const WebflowId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9]+$/u);

const WEBFLOW_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-items",
    name: "List Items",
    description: "Lists the items in a CMS collection.",
    method: "GET",
    url: (i) =>
      `/v2/collections/${restSegment(i.collectionId)}/items${restQuery({
        offset: i.offset,
        limit: i.limit,
      })}`,
    input: z
      .object({
        collectionId: WebflowId,
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
  },
  {
    action: "get-item",
    name: "Get Item",
    description: "Reads one CMS item.",
    method: "GET",
    url: (i) =>
      `/v2/collections/${restSegment(i.collectionId)}/items/${restSegment(i.itemId)}`,
    input: z.object({ collectionId: WebflowId, itemId: WebflowId }).strict(),
  },
  {
    action: "create-item",
    name: "Create Item",
    description: "Creates a CMS item.",
    method: "POST",
    url: (i) => `/v2/collections/${restSegment(i.collectionId)}/items`,
    input: z
      .object({
        collectionId: WebflowId,
        fieldData: z.record(z.string(), z.unknown()),
        isArchived: z.boolean().optional(),
        isDraft: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      fieldData: i.fieldData,
      isArchived: i.isArchived ?? false,
      // A new item stays a draft unless the caller says otherwise, so a
      // create cannot accidentally publish to a live site.
      isDraft: i.isDraft ?? true,
    }),
  },
  {
    action: "update-item",
    name: "Update Item",
    description: "Updates a CMS item.",
    method: "PATCH",
    url: (i) =>
      `/v2/collections/${restSegment(i.collectionId)}/items/${restSegment(i.itemId)}`,
    input: z
      .object({
        collectionId: WebflowId,
        itemId: WebflowId,
        fieldData: z.record(z.string(), z.unknown()),
        isArchived: z.boolean().optional(),
        isDraft: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      fieldData: i.fieldData,
      ...(i.isArchived === undefined ? {} : { isArchived: i.isArchived }),
      ...(i.isDraft === undefined ? {} : { isDraft: i.isDraft }),
    }),
  },
  {
    action: "delete-item",
    name: "Delete Item",
    description: "Deletes a CMS item.",
    method: "DELETE",
    url: (i) =>
      `/v2/collections/${restSegment(i.collectionId)}/items/${restSegment(i.itemId)}`,
    input: z.object({ collectionId: WebflowId, itemId: WebflowId }).strict(),
    emptyResponse: true,
  },
];

export function createWebflowPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "webflow",
    sdkReview: `Webflow ${NoSdkNote}`,
    transportKind: "oauth2",
    actions: WEBFLOW_ACTIONS,
  });
}
