import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import { requireOptionalSdk } from "../shared/optional-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
  requiredInputStringArray,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/** X object IDs are numeric snowflakes. */
function xId(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (!/^\d{1,25}$/u.test(value)) throw invocationError();
  return value;
}

function page(input: VendorInput): Record<string, unknown> {
  return definedFields({
    max_results: optionalInputNumber(input, "limit", "maxResults"),
    pagination_token: optionalInputString(input, "cursor", "paginationToken"),
  });
}

/**
 * Several source actions are a toggle: the same input either applies or
 * reverses the relationship. The direction is an explicit boolean rather than
 * inferred, so a caller cannot unlike by omitting a field.
 */
function toggle(
  onPath: readonly string[],
  offPath: readonly string[],
  params: (input: VendorInput) => readonly unknown[],
): VendorOperation {
  return {
    path: onPath,
    invoke: async ({ client, input }) => {
      const on = input.undo !== true && input.remove !== true;
      const path = on ? onPath : offPath;
      let target: unknown = client;
      for (const segment of path.slice(0, -1)) {
        target = (target as Record<string, unknown>)[segment];
      }
      const method = (target as Record<string, unknown>)[path.at(-1) ?? ""];
      if (typeof method !== "function") {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
        );
      }
      return method.apply(target, params(input)) as Promise<unknown>;
    },
  };
}

const X_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "x:create-tweet": {
    path: ["v2", "tweet"],
    params: (input) => [
      definedFields({
        text: requiredInputString(input, "text"),
        reply: optionalInputString(input, "replyToTweetId")
          ? { in_reply_to_tweet_id: xId(input, "replyToTweetId") }
          : undefined,
        quote_tweet_id: optionalInputString(input, "quoteTweetId"),
      }),
    ],
  },
  "x:delete-tweet": {
    path: ["v2", "deleteTweet"],
    params: (input) => [xId(input, "tweetId", "id")],
  },
  "x:search-tweets": {
    path: ["v2", "search"],
    params: (input) => [
      requiredInputString(input, "query", "search"),
      page(input),
    ],
  },
  "x:get-tweets-by-ids": {
    path: ["v2", "tweets"],
    params: (input) => [requiredInputStringArray(input, "tweetIds", "ids")],
  },
  "x:get-quote-tweets": {
    path: ["v2", "quotes"],
    params: (input) => [xId(input, "tweetId", "id"), page(input)],
  },
  "x:hide-reply": {
    path: ["v2", "hideReply"],
    params: (input) => [xId(input, "tweetId", "id"), input.hidden !== false],
  },
  "x:get-user-tweets": {
    path: ["v2", "userTimeline"],
    params: (input) => [xId(input, "userId"), page(input)],
  },
  "x:get-user-mentions": {
    path: ["v2", "userMentionTimeline"],
    params: (input) => [xId(input, "userId"), page(input)],
  },
  "x:get-user-timeline": {
    path: ["v2", "homeTimeline"],
    params: (input) => [page(input)],
  },
  "x:like-unlike": toggle(["v2", "like"], ["v2", "unlike"], (input) => [
    xId(input, "userId"),
    xId(input, "tweetId"),
  ]),
  "x:retweet-unretweet": toggle(
    ["v2", "retweet"],
    ["v2", "unretweet"],
    (input) => [xId(input, "userId"), xId(input, "tweetId")],
  ),
  "x:follow-unfollow": toggle(["v2", "follow"], ["v2", "unfollow"], (input) => [
    xId(input, "userId"),
    xId(input, "targetUserId"),
  ]),
  "x:block-unblock": toggle(["v2", "block"], ["v2", "unblock"], (input) => [
    xId(input, "userId"),
    xId(input, "targetUserId"),
  ]),
  "x:mute-unmute": toggle(["v2", "mute"], ["v2", "unmute"], (input) => [
    xId(input, "userId"),
    xId(input, "targetUserId"),
  ]),
  "x:get-liked-tweets": {
    path: ["v2", "userLikedTweets"],
    params: (input) => [xId(input, "userId"), page(input)],
  },
  "x:get-liking-users": {
    path: ["v2", "tweetLikedBy"],
    params: (input) => [xId(input, "tweetId", "id")],
  },
  "x:get-retweeted-by": {
    path: ["v2", "tweetRetweetedBy"],
    params: (input) => [xId(input, "tweetId", "id")],
  },
  "x:get-bookmarks": {
    path: ["v2", "bookmarks"],
    params: (input) => [page(input)],
  },
  "x:create-bookmark": {
    path: ["v2", "bookmark"],
    params: (input) => [xId(input, "tweetId", "id")],
  },
  "x:delete-bookmark": {
    path: ["v2", "deleteBookmark"],
    params: (input) => [xId(input, "tweetId", "id")],
    output: (_v, input) => ({
      tweetId: xId(input, "tweetId", "id"),
      bookmarked: false,
    }),
  },
  "x:get-my-profile": { path: ["v2", "me"] },
  "x:search-users": {
    path: ["v2", "usersByUsernames"],
    params: (input) => [requiredInputStringArray(input, "usernames", "query")],
  },
  "x:get-followers": {
    path: ["v2", "followers"],
    params: (input) => [xId(input, "userId"), page(input)],
  },
  "x:get-following": {
    path: ["v2", "following"],
    params: (input) => [xId(input, "userId"), page(input)],
  },
  "x:get-blocked-users": {
    path: ["v2", "userBlockingUsers"],
    params: (input) => [xId(input, "userId"), page(input)],
  },
  "x:get-api-usage": { path: ["v2", "usage"] },
  // The trends endpoints are v1.1-era and reached through the generic caller.
  "x:get-trends-by-location": {
    path: ["v2", "get"],
    params: (input) => [
      `trends/by/woeid/${requiredInputString(input, "woeid", "locationId")}`,
    ],
  },
  "x:get-personalized-trends": {
    path: ["v2", "get"],
    params: () => ["users/personalized_trends"],
  },
};

/**
 * X's OAuth 2.0 user context authenticates with a bearer token; the SDK's
 * v2 client is the read/write surface the source actions map onto.
 */
export const createXClient: VendorClientFactory = (credential) => {
  const { TwitterApi } = requireOptionalSdk("twitter-api-v2") as {
    TwitterApi: new (token: string) => SdkMethodTarget;
  };
  return new TwitterApi(vendorToken(credential));
};

export function createXPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "x",
    driver: "twitter-api-v2@1.29.0",
    transportKind: "oauth2",
    operations: X_OPERATIONS,
    clientFactory: options.clientFactory ?? createXClient,
  });
}
