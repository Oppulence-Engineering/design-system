import { google } from "googleapis";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationApiKeyRuntime } from "../api-key-runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
  sdkResponseData,
} from "./shared";

type YouTubeSdkClient = Record<string, unknown>;

type YouTubeClientFactory = (apiKey: string) => YouTubeSdkClient;

export interface YouTubeProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: YouTubeClientFactory;
}

function createYouTubeClient(apiKey: string): YouTubeSdkClient {
  return { youtube: google.youtube({ version: "v3", auth: apiKey }) };
}

const YOUTUBE_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "youtube",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface YouTubeSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function youTubeRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): YouTubeSdkRequest {
  return { path, arguments: [definedFields(request)] };
}

function youTubeParts(
  input: Readonly<Record<string, unknown>>,
  fallback: string,
): string {
  return optionalInputString(input, "part") ?? fallback;
}

const YOUTUBE_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => YouTubeSdkRequest
  >
> = {
  "youtube:search-videos": (input) =>
    youTubeRequest(["youtube", "search", "list"], {
      part: youTubeParts(input, "snippet"),
      q: requiredInputString(input, "query"),
      type: "video",
      channelId: optionalInputString(input, "channelId"),
      channelType: optionalInputString(input, "channelType"),
      eventType: optionalInputString(input, "eventType"),
      location: optionalInputString(input, "location"),
      locationRadius: optionalInputString(input, "locationRadius"),
      maxResults: optionalInputNumber(input, "maxResults"),
      order: optionalInputString(input, "order"),
      pageToken: optionalInputString(input, "pageToken"),
      publishedAfter: optionalInputString(input, "publishedAfter"),
      publishedBefore: optionalInputString(input, "publishedBefore"),
      regionCode: optionalInputString(input, "regionCode"),
      relevanceLanguage: optionalInputString(input, "relevanceLanguage"),
      safeSearch: optionalInputString(input, "safeSearch"),
      videoCaption: optionalInputString(input, "videoCaption"),
      videoCategoryId: optionalInputString(input, "videoCategoryId"),
      videoDefinition: optionalInputString(input, "videoDefinition"),
      videoDimension: optionalInputString(input, "videoDimension"),
      videoDuration: optionalInputString(input, "videoDuration"),
      videoEmbeddable: optionalInputString(input, "videoEmbeddable"),
      videoLicense: optionalInputString(input, "videoLicense"),
      videoSyndicated: optionalInputString(input, "videoSyndicated"),
      videoType: optionalInputString(input, "videoType"),
    }),
  "youtube:get-trending-videos": (input) =>
    youTubeRequest(["youtube", "videos", "list"], {
      part: youTubeParts(input, "snippet,contentDetails,statistics"),
      chart: "mostPopular",
      regionCode: optionalInputString(input, "regionCode"),
      videoCategoryId: optionalInputString(input, "videoCategoryId"),
      maxResults: optionalInputNumber(input, "maxResults"),
      pageToken: optionalInputString(input, "pageToken"),
    }),
  "youtube:get-video-details": (input) =>
    youTubeRequest(["youtube", "videos", "list"], {
      part: youTubeParts(
        input,
        "snippet,contentDetails,statistics,status,liveStreamingDetails",
      ),
      id: requiredInputString(input, "videoId"),
    }),
  "youtube:get-video-categories": (input) =>
    youTubeRequest(["youtube", "videoCategories", "list"], {
      part: youTubeParts(input, "snippet"),
      regionCode: optionalInputString(input, "regionCode"),
      hl: optionalInputString(input, "hl"),
    }),
  "youtube:get-channel-info": (input) => {
    const channelId = optionalInputString(input, "channelId");
    const forHandle = optionalInputString(input, "handle");
    const forUsername = optionalInputString(input, "username");
    if (!channelId && !forHandle && !forUsername) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return youTubeRequest(["youtube", "channels", "list"], {
      part: youTubeParts(
        input,
        "snippet,contentDetails,statistics,brandingSettings",
      ),
      id: channelId,
      forHandle,
      forUsername,
      maxResults: optionalInputNumber(input, "maxResults"),
    });
  },
  "youtube:get-channel-videos": (input) =>
    youTubeRequest(["youtube", "search", "list"], {
      part: youTubeParts(input, "snippet"),
      channelId: requiredInputString(input, "channelId"),
      type: "video",
      maxResults: optionalInputNumber(input, "maxResults"),
      order: optionalInputString(input, "order") ?? "date",
      pageToken: optionalInputString(input, "pageToken"),
      publishedAfter: optionalInputString(input, "publishedAfter"),
      publishedBefore: optionalInputString(input, "publishedBefore"),
    }),
  "youtube:get-channel-playlists": (input) =>
    youTubeRequest(["youtube", "playlists", "list"], {
      part: youTubeParts(input, "snippet,contentDetails"),
      channelId: requiredInputString(input, "channelId"),
      maxResults: optionalInputNumber(input, "maxResults"),
      pageToken: optionalInputString(input, "pageToken"),
    }),
  "youtube:get-playlist-items": (input) =>
    youTubeRequest(["youtube", "playlistItems", "list"], {
      part: youTubeParts(input, "snippet,contentDetails,status"),
      playlistId: requiredInputString(input, "playlistId"),
      maxResults: optionalInputNumber(input, "maxResults"),
      pageToken: optionalInputString(input, "pageToken"),
      videoId: optionalInputString(input, "videoId"),
    }),
  "youtube:get-video-comments": (input) =>
    youTubeRequest(["youtube", "commentThreads", "list"], {
      part: youTubeParts(input, "snippet,replies"),
      videoId: requiredInputString(input, "videoId"),
      maxResults: optionalInputNumber(input, "maxResults"),
      order: optionalInputString(input, "order"),
      pageToken: optionalInputString(input, "pageToken"),
      searchTerms: optionalInputString(input, "searchTerms"),
      textFormat: optionalInputString(input, "textFormat"),
    }),
};

function assertYouTubeOperationCoverage(): void {
  const expected = new Set(YOUTUBE_OPERATION_IDS);
  const implemented = Object.keys(YOUTUBE_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("YouTube provider SDK operation coverage is incomplete.");
  }
}

/** All pinned YouTube actions use Google's official Node.js SDK. */
export function createYouTubeProviderSdk(
  config: YouTubeProviderSdkConfig,
): IntegrationProviderSdk {
  assertYouTubeOperationCoverage();
  const clientFactory = config.clientFactory ?? createYouTubeClient;
  return {
    integrationId: "youtube",
    operationIds: YOUTUBE_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "youtube" ||
        invocation.reference.integrationId !== "youtube"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = YOUTUBE_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: sdkResponseData(
            await invokeSdkMethod(
              clientFactory(credential.apiKey),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getYouTubeProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertYouTubeOperationCoverage();
  return {
    operations: YOUTUBE_OPERATION_IDS.length,
    operationIds: YOUTUBE_OPERATION_IDS,
  };
}
