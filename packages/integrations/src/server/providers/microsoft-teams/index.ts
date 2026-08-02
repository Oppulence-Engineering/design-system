import type { IntegrationProviderPack } from "../../core/provider-pack";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import {
  definedFields,
  optionalInputString,
  requiredInputString,
} from "../shared/sdk";
import {
  createMicrosoftGraphPack,
  createMicrosoftGraphProviderSdk,
  graphSegment,
  optionalGraphSegment,
  type MicrosoftGraphClientFactory,
  type MicrosoftGraphOperation,
} from "../shared/clients/microsoft-graph";
import {
  graphCollectionQuery,
  graphEntityQuery,
} from "../shared/clients/microsoft-graph-query";

type GraphInput = Readonly<Record<string, unknown>>;

function chat(input: GraphInput): string {
  return `/chats/${graphSegment(input, "chatId")}`;
}

function channel(input: GraphInput): string {
  return `/teams/${graphSegment(input, "teamId")}/channels/${graphSegment(input, "channelId")}`;
}

function messageBody(input: GraphInput): Record<string, unknown> {
  const contentType =
    optionalInputString(input, "contentType", "bodyType")?.toLowerCase() ===
    "html"
      ? "html"
      : "text";
  return {
    body: {
      contentType,
      content: requiredInputString(input, "message", "content", "body"),
    },
  };
}

/**
 * Reactions are addressed by the message they belong to, and Graph models a
 * chat message and a channel message on different paths.
 */
function messagePath(input: GraphInput): string {
  const chatId = optionalGraphSegment(input, "chatId");
  if (chatId) {
    return `/chats/${chatId}/messages/${graphSegment(input, "messageId")}`;
  }
  return `${channel(input)}/messages/${graphSegment(input, "messageId")}`;
}

const TEAMS_OPERATIONS: Readonly<Record<string, MicrosoftGraphOperation>> = {
  "microsoft-teams:read-chat-messages": {
    method: "GET",
    path: (input) => `${chat(input)}/messages`,
    query: graphCollectionQuery,
  },
  "microsoft-teams:write-chat-message": {
    method: "POST",
    path: (input) => `${chat(input)}/messages`,
    body: messageBody,
  },
  "microsoft-teams:update-chat-message": {
    method: "PATCH",
    path: (input) =>
      `${chat(input)}/messages/${graphSegment(input, "messageId")}`,
    body: messageBody,
  },
  "microsoft-teams:delete-chat-message": {
    method: "DELETE",
    path: (input) =>
      `${chat(input)}/messages/${graphSegment(input, "messageId")}/softDelete`,
    output: (_value, input) => ({
      messageId: requiredInputString(input, "messageId"),
      deleted: true,
    }),
  },
  "microsoft-teams:read-channel-messages": {
    method: "GET",
    path: (input) => `${channel(input)}/messages`,
    query: graphCollectionQuery,
  },
  "microsoft-teams:write-channel-message": {
    method: "POST",
    path: (input) => `${channel(input)}/messages`,
    body: (input) =>
      definedFields({
        ...messageBody(input),
        subject: optionalInputString(input, "subject"),
      }),
  },
  "microsoft-teams:update-channel-message": {
    method: "PATCH",
    path: (input) =>
      `${channel(input)}/messages/${graphSegment(input, "messageId")}`,
    body: messageBody,
  },
  "microsoft-teams:delete-channel-message": {
    method: "DELETE",
    path: (input) =>
      `${channel(input)}/messages/${graphSegment(input, "messageId")}/softDelete`,
    output: (_value, input) => ({
      messageId: requiredInputString(input, "messageId"),
      deleted: true,
    }),
  },
  "microsoft-teams:reply-to-channel-message": {
    method: "POST",
    path: (input) =>
      `${channel(input)}/messages/${graphSegment(input, "messageId")}/replies`,
    body: messageBody,
  },
  "microsoft-teams:get-message": {
    method: "GET",
    path: messagePath,
    query: graphEntityQuery,
  },
  "microsoft-teams:add-reaction": {
    method: "POST",
    path: (input) => `${messagePath(input)}/setReaction`,
    body: (input) => ({
      reactionType:
        optionalInputString(input, "reactionType", "reaction") ?? "like",
    }),
    output: (_value, input) => ({
      messageId: requiredInputString(input, "messageId"),
      reactionType:
        optionalInputString(input, "reactionType", "reaction") ?? "like",
      added: true,
    }),
  },
  "microsoft-teams:remove-reaction": {
    method: "POST",
    path: (input) => `${messagePath(input)}/unsetReaction`,
    body: (input) => ({
      reactionType:
        optionalInputString(input, "reactionType", "reaction") ?? "like",
    }),
    output: (_value, input) => ({
      messageId: requiredInputString(input, "messageId"),
      reactionType:
        optionalInputString(input, "reactionType", "reaction") ?? "like",
      removed: true,
    }),
  },
  "microsoft-teams:list-team-members": {
    method: "GET",
    path: (input) => `/teams/${graphSegment(input, "teamId")}/members`,
    query: graphCollectionQuery,
  },
  "microsoft-teams:list-channel-members": {
    method: "GET",
    path: (input) => `${channel(input)}/members`,
    query: graphCollectionQuery,
  },
  "microsoft-teams:list-chat-members": {
    method: "GET",
    path: (input) => `${chat(input)}/members`,
    query: graphCollectionQuery,
  },
  "microsoft-teams:list-teams": {
    method: "GET",
    path: () => "/me/joinedTeams",
    query: graphCollectionQuery,
  },
  "microsoft-teams:list-chats": {
    method: "GET",
    path: () => "/me/chats",
    query: graphCollectionQuery,
  },
  "microsoft-teams:list-channels": {
    method: "GET",
    path: (input) => `/teams/${graphSegment(input, "teamId")}/channels`,
    query: graphCollectionQuery,
  },
};

export interface MicrosoftTeamsProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: MicrosoftGraphClientFactory;
}

/** Executes the pinned Teams chat and channel actions through Microsoft Graph. */
export function createMicrosoftTeamsProviderSdk(
  config: MicrosoftTeamsProviderSdkConfig,
): IntegrationProviderSdk {
  return createMicrosoftGraphProviderSdk({
    integrationId: "microsoft-teams",
    operations: TEAMS_OPERATIONS,
    oauthRuntime: config.oauthRuntime,
    ...(config.clientFactory ? { clientFactory: config.clientFactory } : {}),
  });
}

export function createMicrosoftTeamsPack(): IntegrationProviderPack {
  return createMicrosoftGraphPack({
    integrationId: "microsoft-teams",
    operations: TEAMS_OPERATIONS,
    triggerCoverage: [
      {
        sourceTriggerId: "microsoft-teams:microsoftteams-webhook",
        kind: "webhook",
        disposition: "supported",
      },
      {
        sourceTriggerId: "microsoft-teams:microsoftteams-chat-subscription",
        kind: "subscription",
        disposition: "supported",
      },
    ],
  });
}

export function getMicrosoftTeamsProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  const operationIds = Object.keys(TEAMS_OPERATIONS);
  return { operations: operationIds.length, operationIds };
}
