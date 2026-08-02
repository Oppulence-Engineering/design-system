import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";

import {
  assertProviderPackCoverage,
  createAtlassianOAuth2Provider,
  createAtlassianWebhookTriggerSources,
  createConfluencePack,
  createConfluenceProviderSdk,
  createInMemoryIntegrationTriggerStore,
  createIntegrationCredentialReference,
  createIntegrationTriggerRuntime,
  createJiraPack,
  createJiraProviderSdk,
  createJiraServiceManagementPack,
  createJiraServiceManagementRestProviderSdk,
  type IntegrationTriggerEvent,
} from "../src/server";

interface SdkCall {
  path: string;
  params: unknown;
}

/** Records the SDK group, method, and parameters each action dispatches to. */
function sdkRecorder(response: unknown = { id: "1" }) {
  const calls: SdkCall[] = [];
  const group = (name: string): Record<string, unknown> =>
    new Proxy(
      {},
      {
        get(_target, method: string) {
          return async (params: unknown) => {
            calls.push({ path: `${name}.${method}`, params });
            return response;
          };
        },
      },
    );
  const client = new Proxy(
    {},
    {
      get(_target, name: string) {
        return group(name);
      },
    },
  ) as Record<string, unknown>;
  return { calls, clientFactory: () => client };
}

const oauthRuntime = {
  async withCredential<T>(
    _reference: unknown,
    operation: (credential: {
      accessToken: string;
      scope: readonly string[];
      tokenType: string;
    }) => Promise<T>,
  ): Promise<T> {
    return operation({
      accessToken: "atlassian-token",
      scope: [],
      tokenType: "Bearer",
    });
  },
  async request() {
    return Response.json({});
  },
};

function reference(integrationId: string) {
  return createIntegrationCredentialReference({
    integrationId,
    connectionId: `connection_${integrationId}`,
    product: "eigenn",
  });
}

const CLOUD_ID = "11111111-2222-3333-4444-555555555555";

describe("Atlassian provider family", () => {
  test("every pack accounts for all of its source actions and triggers", () => {
    const packs = [
      createJiraPack(),
      createConfluencePack(),
      createJiraServiceManagementPack(),
    ];

    for (const pack of packs) {
      expect(() =>
        assertProviderPackCoverage(pack, { oauthRuntime }),
      ).not.toThrow();
      expect(
        pack.coverage.filter((entry) => entry.disposition === "deferred"),
      ).toEqual([]);
      expect(
        pack.triggerCoverage.filter(
          (entry) => entry.disposition === "deferred",
        ),
      ).toEqual([]);
    }

    expect(packs.reduce((total, pack) => total + pack.coverage.length, 0)).toBe(
      119,
    );
    expect(
      packs.reduce((total, pack) => total + pack.triggerCoverage.length, 0),
    ).toBe(43);
  });

  test("routes Forms and Assets to typed REST with the SDK review recorded", () => {
    const rest = createJiraServiceManagementPack().coverage.filter(
      (entry) => entry.lane === "typed_rest",
    );

    // 13 Forms actions plus 9 Assets actions.
    expect(rest).toHaveLength(22);
    for (const entry of rest) {
      expect(entry.sdkReview).toMatch(/jira\.js@5\.4\.0/u);
    }
  });

  test("requires a well-formed cloud ID before reaching the provider", async () => {
    const recorder = sdkRecorder();
    const provider = createJiraProviderSdk({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
    });

    await expect(
      provider.execute({
        integrationId: "jira",
        operationId: "jira:read-issue",
        reference: reference("jira"),
        input: { issueIdOrKey: "ENG-1" },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });

    await expect(
      provider.execute({
        integrationId: "jira",
        operationId: "jira:read-issue",
        reference: reference("jira"),
        input: { cloudId: "../other-site", issueIdOrKey: "ENG-1" },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
    expect(recorder.calls).toEqual([]);
  });

  test("wraps plain comment text as an Atlassian Document Format body", async () => {
    const recorder = sdkRecorder();
    const provider = createJiraProviderSdk({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
    });

    await provider.execute({
      integrationId: "jira",
      operationId: "jira:add-comment",
      reference: reference("jira"),
      input: { cloudId: CLOUD_ID, issueIdOrKey: "ENG-1", comment: "Shipping." },
    });

    expect(recorder.calls[0]).toEqual({
      path: "issueComments.addComment",
      params: {
        issueIdOrKey: "ENG-1",
        comment: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Shipping." }],
            },
          ],
        },
      },
    });
  });

  test("passes a prepared ADF document through untouched", async () => {
    const recorder = sdkRecorder();
    const provider = createJiraProviderSdk({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
    });
    const document = { type: "doc", version: 1, content: [] };

    await provider.execute({
      integrationId: "jira",
      operationId: "jira:add-comment",
      reference: reference("jira"),
      input: { cloudId: CLOUD_ID, issueIdOrKey: "ENG-1", comment: document },
    });

    expect((recorder.calls[0]?.params as { comment: unknown }).comment).toEqual(
      document,
    );
  });

  test("scopes a Confluence in-space search to the requested space", async () => {
    const recorder = sdkRecorder();
    const provider = createConfluenceProviderSdk({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
    });

    await provider.execute({
      integrationId: "confluence",
      operationId: "confluence:search-in-space",
      reference: reference("confluence"),
      input: {
        cloudId: CLOUD_ID,
        spaceKey: "ENG",
        cql: 'title ~ "runbook"',
      },
    });

    expect(recorder.calls[0]).toMatchObject({
      path: "search.searchByCQL",
      params: { cql: 'space="ENG" AND (title ~ "runbook")' },
    });
  });

  test("addresses Assets through the workspace-scoped gateway path", async () => {
    const requests: Array<{ path: string; method?: string }> = [];
    const provider = createJiraServiceManagementRestProviderSdk({
      oauthRuntime: {
        async request(request) {
          requests.push({ path: request.path, method: request.method });
          return Response.json({ values: [] });
        },
      },
    });

    await provider.execute({
      integrationId: "jira-service-management",
      operationId: "jira-service-management:search-assets-aql",
      reference: reference("jira-service-management"),
      input: { workspaceId: "ws-1", qlQuery: 'objectType = "Laptop"' },
    });

    expect(requests[0]).toEqual({
      path: "/jsm/assets/workspace/ws-1/v1/object/aql",
      method: "POST",
    });
  });

  test("rejects an unsigned or forged Atlassian webhook", async () => {
    const [issueCreated] = createAtlassianWebhookTriggerSources("jira", {
      secret: "webhook-secret",
      async resolveConnection() {
        return {
          connectionId: "connection_jira",
          integrationId: "jira",
          product: "eigenn",
          subjectId: "team_1",
        };
      },
    });
    const body = new TextEncoder().encode(
      JSON.stringify({
        webhookEvent: "jira:issue_created",
        issue: { id: "1" },
      }),
    );

    await expect(
      issueCreated.verify({ rawBody: body, headers: new Headers() }),
    ).resolves.toBeUndefined();
    await expect(
      issueCreated.verify({
        rawBody: body,
        headers: new Headers({ "x-hub-signature": "sha256=deadbeef" }),
      }),
    ).resolves.toBeUndefined();
  });

  test("delivers only the events each trigger models", async () => {
    const secret = "webhook-secret";
    const sources = createAtlassianWebhookTriggerSources("jira", {
      secret,
      async resolveConnection() {
        return {
          connectionId: "connection_jira",
          integrationId: "jira",
          product: "eigenn",
          subjectId: "team_1",
        };
      },
    });
    const events: IntegrationTriggerEvent[] = [];
    const runtime = createIntegrationTriggerRuntime({
      sources,
      store: createInMemoryIntegrationTriggerStore(),
      async onEvent(event) {
        events.push(event);
      },
    });
    const deliver = (triggerId: string, webhookEvent: string) => {
      const rawBody = new TextEncoder().encode(
        JSON.stringify({
          webhookEvent,
          timestamp: 1_780_000_000_000,
          issue: { id: "10001", key: "ENG-1" },
        }),
      );
      return runtime.deliver({
        integrationId: "jira",
        triggerId,
        rawBody,
        headers: new Headers({
          "x-hub-signature": `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`,
        }),
      });
    };

    await expect(
      deliver("jira:jira-issue-created", "jira:issue_created"),
    ).resolves.toMatchObject({ delivered: 1 });
    // An issue-created subscriber must not receive a comment event.
    await expect(
      deliver("jira:jira-issue-created", "comment_created"),
    ).rejects.toMatchObject({ code: "INTEGRATION_TRIGGER_SIGNATURE_INVALID" });
    // The catch-all accepts whatever the site is configured to send.
    await expect(
      deliver("jira:jira-webhook", "comment_created"),
    ).resolves.toMatchObject({ delivered: 1 });

    expect(events.map((event) => event.providerEvent)).toEqual([
      "jira:issue_created",
      "comment_created",
    ]);
    expect(events[0]).toMatchObject({
      externalId: "10001",
      occurredAt: "2026-05-28T20:26:40.000Z",
    });
  });

  test("registers one Atlassian authority with the API audience", () => {
    const provider = createAtlassianOAuth2Provider({
      integrationId: "confluence",
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "https://app.example/callback",
    });

    expect(provider).toMatchObject({
      integrationId: "confluence",
      authorizationEndpoint: "https://auth.atlassian.com/authorize",
      apiBaseUrl: "https://api.atlassian.com",
      authorizationParameters: { audience: "api.atlassian.com" },
    });
    expect(provider.scopes).toContain("offline_access");
    expect(provider.scopes).toContain("search:confluence");
  });
});
