import { describe, expect, test } from "bun:test";

import {
  BUILT_IN_PROVIDER_PACKS,
  createIntegrationCredentialReference,
  type IntegrationProviderSdk,
} from "../src/server";

/**
 * Coverage proves an action is *claimed*. It cannot prove the request that
 * action builds is the one the provider actually serves — a wrong path
 * typechecks, satisfies the pack contract, and reports as executable while
 * failing against the live API.
 *
 * These cases pin the emitted method and path for one representative action per
 * typed REST provider, so a mis-typed route fails here rather than in
 * production. They are written from the provider's published API, and reviewing
 * a change to one means re-checking that API.
 */
const CASES: ReadonlyArray<{
  readonly operationId: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly method: string;
  readonly path: string;
}> = [
  {
    operationId: "perplexity:chat",
    input: { messages: [{ role: "user", content: "hi" }] },
    method: "POST",
    path: "/chat/completions",
  },
  {
    // Perplexity's Search API is a distinct endpoint from chat completions.
    operationId: "perplexity:search",
    input: { query: "rust ownership" },
    method: "POST",
    path: "/search",
  },
  {
    operationId: "jina:read-url",
    input: { url: "https://example.test/a" },
    method: "POST",
    path: "/",
  },
  {
    operationId: "tavily:search",
    input: { query: "q" },
    method: "POST",
    path: "/search",
  },
  {
    operationId: "exa:search",
    input: { query: "q" },
    method: "POST",
    path: "/search",
  },
  {
    operationId: "brandfetch:get-brand",
    input: { domain: "example.com" },
    method: "GET",
    path: "/v2/brands/example.com",
  },
  {
    operationId: "hunter-io:email-verifier",
    input: { email: "a@b.test" },
    method: "GET",
    path: "/v2/email-verifier?email=a%40b.test",
  },
  {
    // Telegram authenticates by path segment, so the bot token belongs in the
    // URL the transport builds — not in a header.
    operationId: "telegram:send-message",
    input: { chatId: "-1001234567890", text: "hi" },
    method: "POST",
    path: "/sendMessage",
  },
  {
    operationId: "calendly:get-current-user",
    input: {},
    method: "GET",
    path: "/users/me",
  },
  {
    operationId: "typeform:get-form-details",
    input: { formId: "abc123" },
    method: "GET",
    path: "/forms/abc123",
  },
  {
    operationId: "discord:send-message",
    input: { channelId: "123456789012345678", content: "hi" },
    method: "POST",
    path: "/channels/123456789012345678/messages",
  },
  {
    operationId: "discord:ban-member",
    input: { guildId: "1", userId: "2" },
    method: "PUT",
    path: "/guilds/1/bans/2",
  },
  {
    operationId: "sendgrid:send-mail",
    input: {
      to: ["a@b.test"],
      from: "c@d.test",
      subject: "s",
      text: "t",
    },
    method: "POST",
    path: "/v3/mail/send",
  },
  {
    operationId: "pagerduty:get-incident",
    input: { incidentId: "PABC123" },
    method: "GET",
    path: "/incidents/PABC123",
  },
  {
    operationId: "linkedin:get-profile",
    input: {},
    method: "GET",
    path: "/v2/userinfo",
  },
  {
    operationId: "webflow:list-items",
    input: { collectionId: "abc123" },
    method: "GET",
    path: "/v2/collections/abc123/items",
  },
  {
    operationId: "wikipedia:get-page-summary",
    input: { title: "Rust" },
    method: "GET",
    path: "/api/rest_v1/page/summary/Rust",
  },
];

const CANARY = "credential-canary-9f3a2b";

function recordingRuntime(sink: Array<Record<string, unknown>>) {
  return {
    async request(input: {
      request?: Record<string, unknown>;
      [key: string]: unknown;
    }) {
      sink.push(input.request ?? input);
      return Response.json({ ok: true });
    },
    async withCredential(
      _reference: unknown,
      run: (credential: Record<string, string>) => Promise<unknown>,
    ) {
      return run({ apiKey: CANARY, accessToken: CANARY });
    },
  };
}

function adapterFor(operationId: string): {
  adapter: IntegrationProviderSdk;
  requests: Array<Record<string, unknown>>;
} {
  const integrationId = operationId.slice(0, operationId.indexOf(":"));
  const requests: Array<Record<string, unknown>> = [];
  const runtime = recordingRuntime(requests);
  const pack = BUILT_IN_PROVIDER_PACKS.find(
    (candidate) => candidate.integrationId === integrationId,
  );
  if (!pack) throw new Error(`no pack ships ${integrationId}`);
  const adapters = pack.create({
    apiKeyRuntime: runtime,
    oauthRuntime: runtime,
    noAuthRuntime: runtime,
  } as never);
  const adapter = adapters.find((candidate) =>
    candidate.operationIds.includes(operationId),
  );
  if (!adapter) throw new Error(`no adapter executes ${operationId}`);
  return { adapter, requests };
}

describe("typed REST wire shape", () => {
  for (const wireCase of CASES) {
    test(`${wireCase.operationId} requests ${wireCase.method} ${wireCase.path}`, async () => {
      const { adapter, requests } = adapterFor(wireCase.operationId);
      const integrationId = wireCase.operationId.slice(
        0,
        wireCase.operationId.indexOf(":"),
      );

      await adapter.execute({
        integrationId,
        operationId: wireCase.operationId,
        reference: createIntegrationCredentialReference({
          integrationId: integrationId as never,
          connectionId: "connection_wire",
          product: "eigenn",
        }),
        input: wireCase.input,
      } as never);

      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        method: wireCase.method,
        path: wireCase.path,
      });
      // The pack builds the request; only the transport may add the credential.
      expect(JSON.stringify(requests[0])).not.toContain(CANARY);
    });
  }

  test("every claimed typed REST action is executed by an adapter", () => {
    // A pack can declare coverage for an action it never builds a request for.
    // Coverage alone would still report that action as executable.
    const unexecutable: string[] = [];
    for (const pack of BUILT_IN_PROVIDER_PACKS) {
      const claimed = pack.coverage.filter(
        (entry) =>
          entry.lane === "typed_rest" && entry.disposition === "supported",
      );
      if (!claimed.length) continue;
      for (const entry of claimed) {
        try {
          adapterFor(entry.sourceOperationId);
        } catch {
          unexecutable.push(entry.sourceOperationId);
        }
      }
    }
    expect(unexecutable).toEqual([]);
  });

  test("each typed REST provider is pinned by at least one wire case", () => {
    // Without this, adding a provider silently adds unverified routes.
    const pinned = new Set(
      CASES.map((wireCase) =>
        wireCase.operationId.slice(0, wireCase.operationId.indexOf(":")),
      ),
    );
    const shipped = BUILT_IN_PROVIDER_PACKS.filter((pack) =>
      pack.coverage.some(
        (entry) =>
          entry.lane === "typed_rest" && entry.disposition === "supported",
      ),
    ).map((pack) => pack.integrationId);
    // The providers that predate this file close the six original SDK gaps and
    // are covered by their own execution tests.
    const legacy = new Set([
      "airtable",
      "cloudflare",
      "vercel",
      "cal-com",
      "google-appsheet",
      "google-maps",
      "jira-service-management",
      "arxiv",
    ]);
    expect(shipped.filter((id) => !pinned.has(id) && !legacy.has(id))).toEqual(
      [],
    );
  });
});
