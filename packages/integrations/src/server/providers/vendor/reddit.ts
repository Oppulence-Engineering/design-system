import { createRequire } from "node:module";

import { IntegrationProviderSdkError } from "../../provider-sdk";
import type { IntegrationProviderPack } from "../../provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
  requiredInputStringArray,
  type SdkMethodTarget,
} from "../shared";
import {
  createVendorPack,
  requiredVendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "./client";

const redditRequire = createRequire(import.meta.url);

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/**
 * snoowrap is object-oriented rather than method-per-endpoint: `getSubmission`
 * returns a lazy proxy whose own methods perform the action. Every Reddit
 * action therefore uses the executor's invoke hook and reaches the content
 * object itself, rather than a dotted path on the client.
 */
interface RedditClient extends SdkMethodTarget {
  getSubmission(id: string): RedditContent;
  getComment(id: string): RedditContent;
  getSubreddit(name: string): RedditSubreddit;
  getUser(name: string): RedditUser;
  getMessage(id: string): RedditContent;
  getMe(): RedditContent;
  getContentByIds(ids: readonly string[]): Promise<unknown>;
  getInbox(options?: Record<string, unknown>): Promise<unknown>;
  getSavedContent?(options?: Record<string, unknown>): Promise<unknown>;
  composeMessage(options: Record<string, unknown>): Promise<unknown>;
  markMessagesAsRead(messages: readonly unknown[]): Promise<unknown>;
  readAllMessages(): Promise<unknown>;
  searchSubreddits(options: Record<string, unknown>): Promise<unknown>;
  getSubscriptions(options?: Record<string, unknown>): Promise<unknown>;
  search(options: Record<string, unknown>): Promise<unknown>;
}

interface RedditContent {
  upvote(): Promise<unknown>;
  downvote(): Promise<unknown>;
  unvote(): Promise<unknown>;
  save(): Promise<unknown>;
  unsave(): Promise<unknown>;
  reply(text: string): Promise<unknown>;
  edit(text: string): Promise<unknown>;
  delete(): Promise<unknown>;
  report(options?: Record<string, unknown>): Promise<unknown>;
  hide(): Promise<unknown>;
  unhide(): Promise<unknown>;
  markNsfw(): Promise<unknown>;
  unmarkNsfw(): Promise<unknown>;
  approve(): Promise<unknown>;
  remove(options?: Record<string, unknown>): Promise<unknown>;
  distinguish(options?: Record<string, unknown>): Promise<unknown>;
  lock(): Promise<unknown>;
  unlock(): Promise<unknown>;
  sticky(options?: Record<string, unknown>): Promise<unknown>;
  fetch(): Promise<unknown>;
  getSavedContent?(options?: Record<string, unknown>): Promise<unknown>;
}

interface RedditSubreddit {
  getHot(options?: Record<string, unknown>): Promise<unknown>;
  getNew(options?: Record<string, unknown>): Promise<unknown>;
  getTop(options?: Record<string, unknown>): Promise<unknown>;
  getControversial(options?: Record<string, unknown>): Promise<unknown>;
  getNewComments(options?: Record<string, unknown>): Promise<unknown>;
  search(options: Record<string, unknown>): Promise<unknown>;
  submitSelfpost(options: Record<string, unknown>): Promise<unknown>;
  submitLink(options: Record<string, unknown>): Promise<unknown>;
  subscribe(): Promise<unknown>;
  unsubscribe(): Promise<unknown>;
  getRules(): Promise<unknown>;
  fetch(): Promise<unknown>;
}

interface RedditUser {
  getSubmissions(options?: Record<string, unknown>): Promise<unknown>;
  getComments(options?: Record<string, unknown>): Promise<unknown>;
  getSavedContent(options?: Record<string, unknown>): Promise<unknown>;
  fetch(): Promise<unknown>;
}

/** A Reddit thing ID, with or without its `t1_`/`t3_` type prefix. */
function thingId(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (!/^(?:t\d_)?[a-z0-9]{4,16}$/iu.test(value)) throw invocationError();
  return value.replace(/^t\d_/u, "");
}

/** Subreddit and username are path segments in every snoowrap call. */
function redditName(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names).replace(
    /^\/?(?:r|u|user)\//u,
    "",
  );
  if (!/^[A-Za-z0-9_-]{2,64}$/u.test(value)) throw invocationError();
  return value;
}

function listing(input: VendorInput): Record<string, unknown> {
  return definedFields({
    limit: optionalInputNumber(input, "limit"),
    time: optionalInputString(input, "time", "timeframe"),
    after: optionalInputString(input, "after", "cursor"),
  });
}

function client(target: SdkMethodTarget): RedditClient {
  return target as unknown as RedditClient;
}

/** An action on a submission or comment, chosen by which ID was supplied. */
function content(target: SdkMethodTarget, input: VendorInput): RedditContent {
  const commentId = optionalInputString(input, "commentId");
  if (commentId) return client(target).getComment(thingId(input, "commentId"));
  const messageId = optionalInputString(input, "messageId");
  if (messageId) return client(target).getMessage(thingId(input, "messageId"));
  return client(target).getSubmission(
    thingId(input, "postId", "submissionId", "id", "thingId"),
  );
}

/** Wraps a chained call whose result is a bare acknowledgement. */
function acknowledged(
  run: (context: {
    client: SdkMethodTarget;
    input: VendorInput;
  }) => Promise<unknown>,
  describe: (input: VendorInput) => Record<string, unknown>,
): VendorOperation {
  return {
    path: [],
    invoke: async (context) => {
      await run(context);
      return { ...describe(context.input), applied: true };
    },
  };
}

const REDDIT_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "reddit:get-posts": {
    path: [],
    invoke: ({ client: target, input }) => {
      const subreddit = client(target).getSubreddit(
        redditName(input, "subreddit", "subredditName"),
      );
      const sort = optionalInputString(input, "sort") ?? "hot";
      const options = listing(input);
      if (sort === "new") return subreddit.getNew(options);
      if (sort === "top") return subreddit.getTop(options);
      if (sort === "controversial") return subreddit.getControversial(options);
      return subreddit.getHot(options);
    },
  },
  "reddit:get-controversial-posts": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target)
        .getSubreddit(redditName(input, "subreddit", "subredditName"))
        .getControversial(listing(input)),
  },
  "reddit:get-comments": {
    path: [],
    invoke: ({ client: target, input }) => {
      const postId = optionalInputString(input, "postId", "submissionId");
      if (postId) {
        // A submission's comment tree arrives with the fetched submission.
        return client(target)
          .getSubmission(thingId(input, "postId", "submissionId"))
          .fetch();
      }
      return client(target)
        .getSubreddit(redditName(input, "subreddit", "subredditName"))
        .getNewComments(listing(input));
    },
  },
  "reddit:search-subreddit": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target)
        .getSubreddit(redditName(input, "subreddit", "subredditName"))
        .search({
          query: requiredInputString(input, "query", "search"),
          ...listing(input),
          sort: optionalInputString(input, "sort"),
        }),
  },
  "reddit:submit-post": {
    path: [],
    invoke: ({ client: target, input }) => {
      const subreddit = client(target).getSubreddit(
        redditName(input, "subreddit", "subredditName"),
      );
      const url = optionalInputString(input, "url");
      const options = definedFields({
        title: requiredInputString(input, "title"),
        nsfw: input.nsfw === true ? true : undefined,
        spoiler: input.spoiler === true ? true : undefined,
        flairId: optionalInputString(input, "flairId"),
      });
      return url
        ? subreddit.submitLink({ ...options, url })
        : subreddit.submitSelfpost({
            ...options,
            text: optionalInputString(input, "text", "body") ?? "",
          });
    },
  },
  "reddit:vote": acknowledged(
    async ({ client: target, input }) => {
      const item = content(target, input);
      const direction = optionalInputString(input, "direction", "vote") ?? "up";
      if (direction === "down") return item.downvote();
      if (direction === "none" || direction === "unvote") return item.unvote();
      return item.upvote();
    },
    (input) => ({
      direction: optionalInputString(input, "direction", "vote") ?? "up",
    }),
  ),
  "reddit:save": acknowledged(
    ({ client: target, input }) => content(target, input).save(),
    () => ({ saved: true }),
  ),
  "reddit:unsave": acknowledged(
    ({ client: target, input }) => content(target, input).unsave(),
    () => ({ saved: false }),
  ),
  "reddit:reply": {
    path: [],
    invoke: ({ client: target, input }) =>
      content(target, input).reply(requiredInputString(input, "text", "body")),
  },
  "reddit:edit": {
    path: [],
    invoke: ({ client: target, input }) =>
      content(target, input).edit(requiredInputString(input, "text", "body")),
  },
  "reddit:delete": acknowledged(
    ({ client: target, input }) => content(target, input).delete(),
    () => ({ deleted: true }),
  ),
  "reddit:report": acknowledged(
    ({ client: target, input }) =>
      content(target, input).report(
        definedFields({ reason: optionalInputString(input, "reason") }),
      ),
    () => ({ reported: true }),
  ),
  "reddit:hide": acknowledged(
    ({ client: target, input }) => content(target, input).hide(),
    () => ({ hidden: true }),
  ),
  "reddit:unhide": acknowledged(
    ({ client: target, input }) => content(target, input).unhide(),
    () => ({ hidden: false }),
  ),
  "reddit:mark-nsfw": acknowledged(
    ({ client: target, input }) => content(target, input).markNsfw(),
    () => ({ nsfw: true }),
  ),
  "reddit:unmark-nsfw": acknowledged(
    ({ client: target, input }) => content(target, input).unmarkNsfw(),
    () => ({ nsfw: false }),
  ),
  "reddit:subscribe": acknowledged(
    ({ client: target, input }) => {
      const subreddit = client(target).getSubreddit(
        redditName(input, "subreddit", "subredditName"),
      );
      return input.unsubscribe === true
        ? subreddit.unsubscribe()
        : subreddit.subscribe();
    },
    (input) => ({ subscribed: input.unsubscribe !== true }),
  ),
  "reddit:get-my-profile": {
    path: [],
    invoke: ({ client: target }) => client(target).getMe().fetch(),
  },
  "reddit:get-user-profile": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target)
        .getUser(redditName(input, "username", "user"))
        .fetch(),
  },
  "reddit:get-user-posts": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target)
        .getUser(redditName(input, "username", "user"))
        .getSubmissions(listing(input)),
  },
  "reddit:get-user-comments": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target)
        .getUser(redditName(input, "username", "user"))
        .getComments(listing(input)),
  },
  "reddit:get-saved-items": {
    path: [],
    invoke: ({ client: target, input }) => {
      const username = optionalInputString(input, "username", "user");
      // Saved content hangs off a user, and defaults to the authorized one.
      return username
        ? client(target)
            .getUser(redditName(input, "username", "user"))
            .getSavedContent(listing(input))
        : (client(target).getMe() as RedditContent).getSavedContent!(
            listing(input),
          );
    },
  },
  "reddit:send-message": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target).composeMessage({
        to: redditName(input, "to", "recipient", "username"),
        subject: requiredInputString(input, "subject"),
        text: requiredInputString(input, "text", "body"),
      }),
  },
  "reddit:get-messages": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target).getInbox(
        definedFields({
          filter: optionalInputString(input, "filter"),
          ...listing(input),
        }),
      ),
  },
  "reddit:mark-messages-read": acknowledged(
    ({ client: target, input }) =>
      client(target).markMessagesAsRead(
        requiredInputStringArray(input, "messageIds", "messageId").map((id) =>
          thingId({ id }, "id"),
        ),
      ),
    () => ({ read: true }),
  ),
  "reddit:mark-all-messages-read": acknowledged(
    ({ client: target }) => client(target).readAllMessages(),
    () => ({ read: "all" }),
  ),
  "reddit:get-subreddit-info": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target)
        .getSubreddit(redditName(input, "subreddit", "subredditName"))
        .fetch(),
  },
  "reddit:get-subreddit-rules": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target)
        .getSubreddit(redditName(input, "subreddit", "subredditName"))
        .getRules(),
  },
  "reddit:get-info-by-id": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target).getContentByIds(
        requiredInputStringArray(input, "ids", "thingIds"),
      ),
  },
  "reddit:search-subreddits": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target).searchSubreddits({
        query: requiredInputString(input, "query", "search"),
        ...listing(input),
      }),
  },
  "reddit:list-my-subreddits": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target).getSubscriptions(listing(input)),
  },
  // Moderator actions act on the same content objects as the author actions.
  "reddit:approve-mod": acknowledged(
    ({ client: target, input }) => content(target, input).approve(),
    () => ({ approved: true }),
  ),
  "reddit:remove-mod": acknowledged(
    ({ client: target, input }) =>
      content(target, input).remove(
        definedFields({ spam: input.spam === true ? true : undefined }),
      ),
    () => ({ removed: true }),
  ),
  "reddit:distinguish-mod": acknowledged(
    ({ client: target, input }) =>
      content(target, input).distinguish({
        status: input.undistinguish === true ? false : true,
        sticky: input.sticky === true,
      }),
    (input) => ({ distinguished: input.undistinguish !== true }),
  ),
  "reddit:lock-mod": acknowledged(
    ({ client: target, input }) => content(target, input).lock(),
    () => ({ locked: true }),
  ),
  "reddit:unlock-mod": acknowledged(
    ({ client: target, input }) => content(target, input).unlock(),
    () => ({ locked: false }),
  ),
  "reddit:sticky-mod": acknowledged(
    ({ client: target, input }) =>
      content(target, input).sticky(
        definedFields({ num: optionalInputNumber(input, "slot", "num") }),
      ),
    () => ({ stickied: true }),
  ),
};

/**
 * snoowrap needs the app's client credentials alongside the user token: it
 * refreshes on its own, and Reddit rejects a request without a descriptive
 * user agent. The app credentials are deployment configuration and travel in
 * the same envelope as the per-connection token.
 */
export const createRedditClient: VendorClientFactory = (credential) => {
  const Snoowrap = redditRequire("snoowrap") as new (
    config: Record<string, unknown>,
  ) => SdkMethodTarget;
  return new Snoowrap({
    userAgent: requiredVendorField(credential, "userAgent"),
    accessToken: vendorToken(credential),
  });
};

export function createRedditPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "reddit",
    driver: "snoowrap@1.23.0",
    transportKind: "oauth2",
    operations: REDDIT_OPERATIONS,
    clientFactory: options.clientFactory ?? createRedditClient,
  });
}
