import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

const NoSdkNote =
  "publishes no maintained Node SDK; its HTTP API is the supported integration surface.";

// ----------------------------------------------------------------- Telegram

/**
 * A Telegram chat is addressed by numeric ID or by @username, and both reach
 * the same field. Anything else would be a malformed request.
 */
const ChatId = z.union([
  z.number().int(),
  z
    .string()
    .min(1)
    .max(64)
    .regex(/^(@[A-Za-z0-9_]{4,32}|-?\d{1,20})$/u),
]);

const MessageId = z.number().int().positive();
const Caption = z.string().max(1_024).optional();

/** Every send action shares the same optional delivery controls. */
const sendControls = {
  parseMode: z.enum(["Markdown", "MarkdownV2", "HTML"]).optional(),
  disableNotification: z.boolean().optional(),
  replyToMessageId: MessageId.optional(),
};

function sendBody(i: Record<string, unknown>): Record<string, unknown> {
  return {
    chat_id: i.chatId,
    ...(i.parseMode ? { parse_mode: i.parseMode } : {}),
    ...(i.disableNotification ? { disable_notification: true } : {}),
    ...(i.replyToMessageId
      ? { reply_parameters: { message_id: i.replyToMessageId } }
      : {}),
  };
}

/** Telegram's media sends differ only in the field naming the file. */
function mediaAction(
  action: string,
  name: string,
  method: string,
  field: string,
): RestAction<any> {
  return {
    action,
    name,
    description: `Sends ${name.replace(/^Send /u, "").toLowerCase()} to a Telegram chat.`,
    method: "POST",
    url: `/${method}`,
    input: z
      .object({
        chatId: ChatId,
        [field]: z.string().min(1).max(2_000),
        caption: Caption,
        ...sendControls,
      })
      .strict(),
    body: (i) => ({
      ...sendBody(i),
      [field]: i[field],
      ...(i.caption ? { caption: i.caption } : {}),
    }),
  };
}

const TELEGRAM_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "send-message",
    name: "Send Message",
    description: "Sends a text message to a Telegram chat.",
    method: "POST",
    url: "/sendMessage",
    input: z
      .object({
        chatId: ChatId,
        text: z.string().min(1).max(4_096),
        ...sendControls,
      })
      .strict(),
    body: (i) => ({ ...sendBody(i), text: i.text }),
  },
  mediaAction("send-photo", "Send Photo", "sendPhoto", "photo"),
  mediaAction("send-video", "Send Video", "sendVideo", "video"),
  mediaAction("send-audio", "Send Audio", "sendAudio", "audio"),
  mediaAction("send-animation", "Send Animation", "sendAnimation", "animation"),
  mediaAction("send-document", "Send Document", "sendDocument", "document"),
  {
    action: "send-location",
    name: "Send Location",
    description: "Sends a map location to a Telegram chat.",
    method: "POST",
    url: "/sendLocation",
    input: z
      .object({
        chatId: ChatId,
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        ...sendControls,
      })
      .strict(),
    body: (i) => ({
      ...sendBody(i),
      latitude: i.latitude,
      longitude: i.longitude,
    }),
  },
  {
    action: "send-contact",
    name: "Send Contact",
    description: "Sends a contact card to a Telegram chat.",
    method: "POST",
    url: "/sendContact",
    input: z
      .object({
        chatId: ChatId,
        phoneNumber: z.string().min(1).max(64),
        firstName: z.string().min(1).max(128),
        lastName: z.string().max(128).optional(),
        ...sendControls,
      })
      .strict(),
    body: (i) => ({
      ...sendBody(i),
      phone_number: i.phoneNumber,
      first_name: i.firstName,
      ...(i.lastName ? { last_name: i.lastName } : {}),
    }),
  },
  {
    action: "send-poll",
    name: "Send Poll",
    description: "Sends a poll to a Telegram chat.",
    method: "POST",
    url: "/sendPoll",
    input: z
      .object({
        chatId: ChatId,
        question: z.string().min(1).max(300),
        // Telegram accepts between 2 and 10 options.
        options: z.array(z.string().min(1).max(100)).min(2).max(10),
        isAnonymous: z.boolean().optional(),
        allowsMultipleAnswers: z.boolean().optional(),
        ...sendControls,
      })
      .strict(),
    body: (i) => ({
      ...sendBody(i),
      question: i.question,
      options: i.options,
      ...(i.isAnonymous === undefined ? {} : { is_anonymous: i.isAnonymous }),
      ...(i.allowsMultipleAnswers ? { allows_multiple_answers: true } : {}),
    }),
  },
  {
    action: "send-chat-action",
    name: "Send Chat Action",
    description: "Shows a typing or uploading indicator in a chat.",
    method: "POST",
    url: "/sendChatAction",
    input: z
      .object({
        chatId: ChatId,
        action: z
          .enum([
            "typing",
            "upload_photo",
            "record_video",
            "upload_video",
            "record_voice",
            "upload_voice",
            "upload_document",
            "choose_sticker",
            "find_location",
          ])
          .optional(),
      })
      .strict(),
    body: (i) => ({ chat_id: i.chatId, action: i.action ?? "typing" }),
  },
  {
    action: "edit-message-text",
    name: "Edit Message Text",
    description: "Replaces the text of a message the bot sent.",
    method: "POST",
    url: "/editMessageText",
    input: z
      .object({
        chatId: ChatId,
        messageId: MessageId,
        text: z.string().min(1).max(4_096),
        parseMode: sendControls.parseMode,
      })
      .strict(),
    body: (i) => ({
      chat_id: i.chatId,
      message_id: i.messageId,
      text: i.text,
      ...(i.parseMode ? { parse_mode: i.parseMode } : {}),
    }),
  },
  {
    action: "forward-message",
    name: "Forward Message",
    description: "Forwards a message to another chat, keeping attribution.",
    method: "POST",
    url: "/forwardMessage",
    input: z
      .object({
        chatId: ChatId,
        fromChatId: ChatId,
        messageId: MessageId,
        disableNotification: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      chat_id: i.chatId,
      from_chat_id: i.fromChatId,
      message_id: i.messageId,
      ...(i.disableNotification ? { disable_notification: true } : {}),
    }),
  },
  {
    action: "copy-message",
    name: "Copy Message",
    description: "Copies a message to another chat without attribution.",
    method: "POST",
    url: "/copyMessage",
    input: z
      .object({
        chatId: ChatId,
        fromChatId: ChatId,
        messageId: MessageId,
        caption: Caption,
      })
      .strict(),
    body: (i) => ({
      chat_id: i.chatId,
      from_chat_id: i.fromChatId,
      message_id: i.messageId,
      ...(i.caption ? { caption: i.caption } : {}),
    }),
  },
  {
    action: "delete-message",
    name: "Delete Message",
    description: "Deletes a message from a chat.",
    method: "POST",
    url: "/deleteMessage",
    input: z.object({ chatId: ChatId, messageId: MessageId }).strict(),
    body: (i) => ({ chat_id: i.chatId, message_id: i.messageId }),
  },
  {
    action: "pin-message",
    name: "Pin Message",
    description: "Pins a message in a chat.",
    method: "POST",
    url: "/pinChatMessage",
    input: z
      .object({
        chatId: ChatId,
        messageId: MessageId,
        disableNotification: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      chat_id: i.chatId,
      message_id: i.messageId,
      ...(i.disableNotification ? { disable_notification: true } : {}),
    }),
  },
  {
    action: "unpin-message",
    name: "Unpin Message",
    description: "Unpins a message, or the most recent pin when none is given.",
    method: "POST",
    url: "/unpinChatMessage",
    input: z
      .object({ chatId: ChatId, messageId: MessageId.optional() })
      .strict(),
    body: (i) => ({
      chat_id: i.chatId,
      ...(i.messageId ? { message_id: i.messageId } : {}),
    }),
  },
  {
    action: "set-message-reaction",
    name: "Set Message Reaction",
    description: "Sets or clears the bot's reaction on a message.",
    method: "POST",
    url: "/setMessageReaction",
    input: z
      .object({
        chatId: ChatId,
        messageId: MessageId,
        emoji: z.string().min(1).max(16).optional(),
      })
      .strict(),
    body: (i) => ({
      chat_id: i.chatId,
      message_id: i.messageId,
      // An empty reaction list is how Telegram clears a reaction.
      reaction: i.emoji ? [{ type: "emoji", emoji: i.emoji }] : [],
    }),
  },
  {
    action: "get-chat",
    name: "Get Chat",
    description: "Reads a chat's metadata.",
    method: "POST",
    url: "/getChat",
    input: z.object({ chatId: ChatId }).strict(),
    body: (i) => ({ chat_id: i.chatId }),
  },
  {
    action: "get-chat-member",
    name: "Get Chat Member",
    description: "Reads a member's status in a chat.",
    method: "POST",
    url: "/getChatMember",
    input: z
      .object({ chatId: ChatId, userId: z.number().int().positive() })
      .strict(),
    body: (i) => ({ chat_id: i.chatId, user_id: i.userId }),
  },
];

export function createTelegramPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "telegram",
    sdkReview: `Telegram ${NoSdkNote} The Bot API takes the token in the request path, which the API-key transport supplies.`,
    transportKind: "api_key",
    actions: TELEGRAM_ACTIONS,
  });
}
