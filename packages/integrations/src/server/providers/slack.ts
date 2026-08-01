import { WebClient } from "@slack/web-api";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationOAuthRuntime } from "../runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import { ProviderSdkInvocationSchema, asInputRecord } from "./shared";

interface SlackApiClient {
  apiCall(method: string, options?: Record<string, unknown>): Promise<unknown>;
}

type SlackClientFactory = (
  accessToken: string,
  configuration: { timeout: number },
) => SlackApiClient;

export interface SlackProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: SlackClientFactory;
  fetcher?: typeof fetch;
  requestTimeoutMs?: number;
  maxDownloadBytes?: number;
}

function createSlackClient(
  accessToken: string,
  configuration: { timeout: number },
): SlackApiClient {
  return new WebClient(accessToken, {
    timeout: configuration.timeout,
  });
}

const SLACK_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "slack",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

const SLACK_OPERATION_METHODS: Readonly<Record<string, string>> = {
  "slack:send-message": "chat.postMessage",
  "slack:send-ephemeral-message": "chat.postEphemeral",
  "slack:create-canvas": "canvases.create",
  "slack:read-messages": "conversations.history",
  "slack:get-message": "conversations.replies",
  "slack:get-thread": "conversations.replies",
  "slack:get-thread-replies": "conversations.replies",
  "slack:get-channel-history": "conversations.history",
  "slack:get-message-permalink": "chat.getPermalink",
  "slack:set-assistant-status": "assistant.threads.setStatus",
  "slack:set-assistant-title": "assistant.threads.setTitle",
  "slack:set-suggested-prompts": "assistant.threads.setSuggestedPrompts",
  "slack:list-channels": "conversations.list",
  "slack:list-channel-members": "conversations.members",
  "slack:list-users": "users.list",
  "slack:get-user-info": "users.info",
  "slack:download-file": "files.info",
  "slack:update-message": "chat.update",
  "slack:delete-message": "chat.delete",
  "slack:add-reaction": "reactions.add",
  "slack:remove-reaction": "reactions.remove",
  "slack:get-channel-info": "conversations.info",
  "slack:get-user-presence": "users.getPresence",
  "slack:edit-canvas": "canvases.edit",
  "slack:create-channel-canvas": "conversations.canvases.create",
  "slack:get-canvas-info": "files.info",
  "slack:list-canvases": "files.list",
  "slack:lookup-canvas-sections": "canvases.sections.lookup",
  "slack:delete-canvas": "canvases.delete",
  "slack:create-conversation": "conversations.create",
  "slack:invite-to-conversation": "conversations.invite",
  "slack:open-view": "views.open",
  "slack:update-view": "views.update",
  "slack:push-view": "views.push",
  "slack:publish-view": "views.publish",
  "slack:schedule-message": "chat.scheduleMessage",
  "slack:list-scheduled-messages": "chat.scheduledMessages.list",
  "slack:delete-scheduled-message": "chat.deleteScheduledMessage",
  "slack:archive-conversation": "conversations.archive",
  "slack:rename-conversation": "conversations.rename",
  "slack:set-conversation-topic": "conversations.setTopic",
  "slack:set-conversation-purpose": "conversations.setPurpose",
};

function assertSlackOperationCoverage(): void {
  const expected = new Set(SLACK_OPERATION_IDS);
  const implemented = Object.keys(SLACK_OPERATION_METHODS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Slack provider SDK operation coverage is incomplete.");
  }
}

function normalizeSlackValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeSlackValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key.replace(/[A-Z]/gu, (character) => `_${character.toLowerCase()}`),
      normalizeSlackValue(child),
    ]),
  );
}

function slackParameters(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const parameters = normalizeSlackValue(asInputRecord(input)) as Record<
    string,
    unknown
  >;
  for (const key of [
    "credential",
    "oauth_credential",
    "bot_token",
    "api_key",
    "auth_method",
  ]) {
    delete parameters[key];
  }
  return parameters;
}

function asProviderResult(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  return value as Record<string, unknown>;
}

function isSlackDownloadUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "slack.com" || url.hostname.endsWith(".slack.com"))
    );
  } catch {
    return false;
  }
}

async function readBoundedResponse(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) {
      break;
    }
    length += next.value.byteLength;
    if (length > maximumBytes) {
      void reader.cancel().catch(() => undefined);
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
      );
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function downloadSlackFile(
  result: Record<string, unknown>,
  accessToken: string,
  fetcher: typeof fetch,
  maximumBytes: number,
): Promise<{ file: Record<string, unknown>; content: Uint8Array }> {
  const file = result.file;
  if (!file || typeof file !== "object" || Array.isArray(file)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  const record = file as Record<string, unknown>;
  const downloadUrl =
    typeof record.url_private_download === "string"
      ? record.url_private_download
      : record.url_private;
  if (typeof downloadUrl !== "string" || !isSlackDownloadUrl(downloadUrl)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  const response = await fetcher(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  return {
    file: record,
    content: await readBoundedResponse(response, maximumBytes),
  };
}

/**
 * All 42 Slack operations from the pinned Sim Studio baseline. The maintained
 * Slack Web API SDK receives a short-lived access token only inside the
 * encrypted OAuth runtime callback.
 */
export function createSlackProviderSdk(
  config: SlackProviderSdkConfig,
): IntegrationProviderSdk {
  assertSlackOperationCoverage();
  const timeout = config.requestTimeoutMs ?? 15_000;
  const maximumDownloadBytes = config.maxDownloadBytes ?? 25 * 1024 * 1024;
  if (
    !Number.isSafeInteger(timeout) ||
    timeout < 100 ||
    timeout > 120_000 ||
    !Number.isSafeInteger(maximumDownloadBytes) ||
    maximumDownloadBytes < 1_024 ||
    maximumDownloadBytes > 100 * 1024 * 1024
  ) {
    throw new Error("Invalid Slack SDK configuration.");
  }
  const clientFactory = config.clientFactory ?? createSlackClient;
  const fetcher = config.fetcher ?? fetch;

  return {
    integrationId: "slack",
    operationIds: SLACK_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "slack" ||
        invocation.reference.integrationId !== "slack"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const method = SLACK_OPERATION_METHODS[invocation.operationId];
      if (!method) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const result = asProviderResult(
            await clientFactory(credential.accessToken, { timeout }).apiCall(
              method,
              slackParameters(invocation.input),
            ),
          );
          return {
            operationId: invocation.operationId,
            output:
              invocation.operationId === "slack:download-file"
                ? await downloadSlackFile(
                    result,
                    credential.accessToken,
                    fetcher,
                    maximumDownloadBytes,
                  )
                : result,
          };
        },
      );
    },
  };
}

export function getSlackProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertSlackOperationCoverage();
  return {
    operations: SLACK_OPERATION_IDS.length,
    operationIds: SLACK_OPERATION_IDS,
  };
}
