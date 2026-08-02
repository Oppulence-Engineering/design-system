import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

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
