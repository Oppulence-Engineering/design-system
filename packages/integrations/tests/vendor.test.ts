import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";

import {
  assertProviderPackCoverage,
  createClerkPack,
  createClerkWebhookTriggerSources,
  createIntegrationCredentialReference,
  createOktaPack,
  createSalesforceOAuth2Provider,
  createSalesforcePack,
  createSupabasePack,
  createTrelloPack,
  createXPack,
  createDatadogPack,
  createRedditPack,
  createBoxPack,
  createAlgoliaPack,
  createUpstashPack,
  createPineconePack,
  createQdrantPack,
  createElasticsearchPack,
  createGoogleMapsPack,
  createZendeskPack,
  createDocuSignPack,
  createAzureDevOpsPack,
  createShopifyPack,
  createTemporalPack,
  type IntegrationProviderPack,
} from "../src/server";

interface SdkCall {
  path: string;
  args: readonly unknown[];
}

/**
 * Records the dotted method path and arguments each action dispatches to.
 * Every node is callable, chainable, and thenable, which is what a fluent
 * query builder such as PostgREST's actually is — a recorder that returned a
 * plain Promise from the first call could not model `.delete().match()`.
 */
function sdkRecorder(response: unknown = { ok: true }) {
  const calls: SdkCall[] = [];
  const make = (prefix: string): unknown =>
    new Proxy(function () {} as unknown as Record<string, unknown>, {
      get(_target, key: string) {
        if (key === "then") {
          return (resolve: (value: unknown) => unknown) => resolve(response);
        }
        // The dispatcher invokes through Function.prototype.apply, so these
        // have to keep their normal meaning rather than extend the path.
        if (key === "apply") {
          return (_this: unknown, args: unknown[] = []) => {
            calls.push({ path: prefix, args });
            return make(prefix);
          };
        }
        if (key === "call") {
          return (_this: unknown, ...args: unknown[]) => {
            calls.push({ path: prefix, args });
            return make(prefix);
          };
        }
        return make(prefix ? `${prefix}.${key}` : key);
      },
      apply(_target, _this, args: unknown[]) {
        calls.push({ path: prefix, args });
        return make(prefix);
      },
    });
  return { calls, clientFactory: () => make("") as Record<string, unknown> };
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
    return operation({ accessToken: "t", scope: [], tokenType: "Bearer" });
  },
  async request() {
    return Response.json({});
  },
};

const apiKeyRuntime = {
  async withCredential<T>(
    _reference: unknown,
    operation: (credential: {
      readonly apiKey: string;
      readonly fields: Readonly<Record<string, string>>;
    }) => Promise<T>,
  ): Promise<T> {
    return operation({
      apiKey: "sk_secret",
      fields: {
        orgUrl: "https://acme.okta.com",
        projectUrl: "https://acme.supabase.co",
      },
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

describe("vendor SDK provider batch", () => {
  test("every pack accounts for all of its source actions", () => {
    const packs: Array<[IntegrationProviderPack, object]> = [
      [createSalesforcePack(), { oauthRuntime }],
      [createClerkPack(), { apiKeyRuntime }],
      [createOktaPack(), { apiKeyRuntime }],
      [createSupabasePack(), { apiKeyRuntime }],
      [createTrelloPack(), { oauthRuntime }],
      [createXPack(), { oauthRuntime }],
      [createDatadogPack(), { apiKeyRuntime }],
      [createRedditPack(), { oauthRuntime }],
      [createBoxPack(), { oauthRuntime }],
      [createAlgoliaPack(), { apiKeyRuntime }],
      [createUpstashPack(), { apiKeyRuntime }],
      [createPineconePack(), { apiKeyRuntime }],
      [createQdrantPack(), { apiKeyRuntime }],
      [createElasticsearchPack(), { apiKeyRuntime }],
      [createGoogleMapsPack(), { apiKeyRuntime }],
      [createZendeskPack(), { apiKeyRuntime }],
      [createAzureDevOpsPack(), { apiKeyRuntime }],
      [createDocuSignPack(), { oauthRuntime }],
      [createShopifyPack(), { oauthRuntime }],
      [createTemporalPack(), { apiKeyRuntime }],
    ];

    for (const [pack, context] of packs) {
      expect(() => assertProviderPackCoverage(pack, context)).not.toThrow();
      // Every action this batch supports runs on an SDK; the only deferrals
      // are the five Google Maps APIs neither lane can reach.
      expect(
        pack.coverage
          .filter((entry) => entry.disposition === "supported")
          .every((entry) => entry.lane === "sdk"),
      ).toBe(true);
    }
    expect(
      packs.flatMap(([pack]) =>
        pack.coverage.filter((entry) => entry.disposition === "deferred"),
      ),
    ).toHaveLength(5);

    expect(
      packs.reduce((total, [pack]) => total + pack.coverage.length, 0),
    ).toBe(397);
  });

  test("builds a bounded SOQL read with validated identifiers", async () => {
    const recorder = sdkRecorder({ records: [] });
    const provider = createSalesforcePack({
      clientFactory: recorder.clientFactory,
    }).create({ oauthRuntime })[0];

    await provider.execute({
      integrationId: "salesforce",
      operationId: "salesforce:get-accounts",
      reference: reference("salesforce"),
      input: { fields: ["Id", "Name"], where: "Industry = 'Tech'", limit: 50 },
    });

    expect(recorder.calls[0]).toEqual({
      path: "query",
      args: ["SELECT Id, Name FROM Account WHERE Industry = 'Tech' LIMIT 50"],
    });
  });

  test("rejects a field or object name that is not a plain identifier", async () => {
    const recorder = sdkRecorder();
    const provider = createSalesforcePack({
      clientFactory: recorder.clientFactory,
    }).create({ oauthRuntime })[0];
    const run = (input: Record<string, unknown>) =>
      provider.execute({
        integrationId: "salesforce",
        operationId: "salesforce:get-accounts",
        reference: reference("salesforce"),
        input,
      });

    await expect(
      run({ fields: ["Id, (SELECT Name FROM Contacts)"] }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
    await expect(
      run({ objectName: "Account WHERE 1=1" }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
    // A limit outside the bound would let one call pull an entire org.
    await expect(run({ limit: 100_000 })).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
    expect(recorder.calls).toEqual([]);
  });

  test("singularises the Salesforce action names that do not drop an s", () => {
    const ids = createSalesforcePack().coverage.map(
      (entry) => entry.sourceOperationId,
    );

    // "opportunities" would singularise to "opportunitie" if derived.
    expect(ids).toContain("salesforce:create-opportunity");
    expect(ids).toContain("salesforce:update-opportunity");
    expect(ids).toContain("salesforce:delete-opportunity");
  });

  test("dispatches Clerk actions to the SDK resource group", async () => {
    const recorder = sdkRecorder({ data: [] });
    const provider = createClerkPack({
      clientFactory: recorder.clientFactory,
    }).create({ apiKeyRuntime })[0];

    await provider.execute({
      integrationId: "clerk",
      operationId: "clerk:add-organization-member",
      reference: reference("clerk"),
      input: { organizationId: "org_1", userId: "user_1", role: "org:member" },
    });

    expect(recorder.calls[0]).toEqual({
      path: "organizations.createOrganizationMembership",
      args: [{ organizationId: "org_1", userId: "user_1", role: "org:member" }],
    });
  });

  test("verifies the Svix signature Clerk webhooks carry", async () => {
    const secret = "whsec_" + Buffer.from("shared-secret").toString("base64");
    const [userCreated] = createClerkWebhookTriggerSources({
      signingSecret: secret,
      async resolveConnection() {
        return {
          connectionId: "connection_clerk",
          integrationId: "clerk",
          product: "eigenn",
          subjectId: "team_1",
        };
      },
    });
    const body = JSON.stringify({
      type: "user.created",
      data: { id: "user_1", object: "user" },
    });
    const id = "msg_1";
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const signature = createHmac(
      "sha256",
      Buffer.from(secret.slice(6), "base64"),
    )
      .update(`${id}.${timestamp}.${body}`)
      .digest("base64");
    const rawBody = new TextEncoder().encode(body);

    await expect(
      userCreated.verify({
        rawBody,
        headers: new Headers({
          "svix-id": id,
          "svix-timestamp": timestamp,
          "svix-signature": `v1,${signature}`,
        }),
      }),
    ).resolves.toMatchObject({
      events: [{ providerEvent: "user.created", externalId: "user_1" }],
    });

    // A forged signature and a stale timestamp are both rejected.
    await expect(
      userCreated.verify({
        rawBody,
        headers: new Headers({
          "svix-id": id,
          "svix-timestamp": timestamp,
          "svix-signature": "v1,forged",
        }),
      }),
    ).resolves.toBeUndefined();
    await expect(
      userCreated.verify({
        rawBody,
        headers: new Headers({
          "svix-id": id,
          "svix-timestamp": "1000000000",
          "svix-signature": `v1,${signature}`,
        }),
      }),
    ).resolves.toBeUndefined();
  });

  test("routes each Clerk trigger to only its own event", async () => {
    const secret = "whsec_" + Buffer.from("s").toString("base64");
    const sources = createClerkWebhookTriggerSources({
      signingSecret: secret,
      async resolveConnection() {
        return {
          connectionId: "connection_clerk",
          integrationId: "clerk",
          product: "eigenn",
          subjectId: "team_1",
        };
      },
    });
    const deliver = (triggerId: string, type: string) => {
      const source = sources.find((entry) => entry.triggerId === triggerId)!;
      const body = JSON.stringify({ type, data: { id: "x" } });
      const id = "msg";
      const timestamp = String(Math.floor(Date.now() / 1_000));
      return source.verify({
        rawBody: new TextEncoder().encode(body),
        headers: new Headers({
          "svix-id": id,
          "svix-timestamp": timestamp,
          "svix-signature": `v1,${createHmac(
            "sha256",
            Buffer.from(secret.slice(6), "base64"),
          )
            .update(`${id}.${timestamp}.${body}`)
            .digest("base64")}`,
        }),
      });
    };

    await expect(
      deliver("clerk:clerk-user-created", "user.created"),
    ).resolves.toBeDefined();
    await expect(
      deliver("clerk:clerk-user-created", "session.created"),
    ).resolves.toBeUndefined();
    // The catch-all accepts whatever the instance is configured to send.
    await expect(
      deliver("clerk:clerk-webhook", "session.created"),
    ).resolves.toBeDefined();
  });

  test("reads the Okta org and Supabase project from the credential", async () => {
    const seen: string[] = [];
    const okta = createOktaPack({
      clientFactory: (credential) => {
        seen.push(
          "fields" in credential ? (credential.fields.orgUrl ?? "") : "",
        );
        return sdkRecorder().clientFactory();
      },
    }).create({ apiKeyRuntime })[0];

    await okta.execute({
      integrationId: "okta",
      operationId: "okta:get-user",
      reference: reference("okta"),
      // A caller attempting to point the client at another tenant.
      input: { userId: "00u1", orgUrl: "https://attacker.okta.com" },
    });

    expect(seen).toEqual(["https://acme.okta.com"]);
  });

  test("requires a predicate before deleting a Supabase row", async () => {
    const recorder = sdkRecorder({ data: [] });
    const provider = createSupabasePack({
      clientFactory: recorder.clientFactory,
    }).create({ apiKeyRuntime })[0];

    await expect(
      provider.execute({
        integrationId: "supabase",
        operationId: "supabase:delete-a-row",
        reference: reference("supabase"),
        input: { table: "invoices" },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
  });

  test("rejects a Supabase storage key that escapes its bucket", async () => {
    const recorder = sdkRecorder({ data: null });
    const provider = createSupabasePack({
      clientFactory: recorder.clientFactory,
    }).create({ apiKeyRuntime })[0];

    await expect(
      provider.execute({
        integrationId: "supabase",
        operationId: "supabase:storage-download-file",
        reference: reference("supabase"),
        input: { bucket: "reports", path: "../../secrets/key.pem" },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
  });

  test("rejects a Trello identifier that is not an object ID", async () => {
    const recorder = sdkRecorder();
    const provider = createTrelloPack({
      clientFactory: recorder.clientFactory,
    }).create({ oauthRuntime })[0];
    const run = (cardId: string) =>
      provider.execute({
        integrationId: "trello",
        operationId: "trello:get-card",
        reference: reference("trello"),
        input: { cardId },
      });

    await run("5f2b8c1e4a7d9b0012345678");
    expect(recorder.calls[0]).toEqual({
      path: "cards.getCard",
      args: [{ id: "5f2b8c1e4a7d9b0012345678" }],
    });

    for (const invalid of ["not-an-id", "../boards/1", "12345"]) {
      await expect(run(invalid)).rejects.toMatchObject({
        code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      });
    }
    expect(recorder.calls).toHaveLength(1);
  });

  test("routes an X toggle action by an explicit direction", async () => {
    const recorder = sdkRecorder();
    const provider = createXPack({
      clientFactory: recorder.clientFactory,
    }).create({ oauthRuntime })[0];
    const run = (input: Record<string, unknown>) =>
      provider.execute({
        integrationId: "x",
        operationId: "x:like-unlike",
        reference: reference("x"),
        input: { userId: "1", tweetId: "2", ...input },
      });

    await run({});
    await run({ undo: true });

    // Omitting the flag must like, never unlike.
    expect(recorder.calls.map((call) => call.path)).toEqual([
      "v2.like",
      "v2.unlike",
    ]);
  });

  test("rejects an X identifier that is not a numeric snowflake", async () => {
    const recorder = sdkRecorder();
    const provider = createXPack({
      clientFactory: recorder.clientFactory,
    }).create({ oauthRuntime })[0];

    await expect(
      provider.execute({
        integrationId: "x",
        operationId: "x:delete-tweet",
        reference: reference("x"),
        input: { tweetId: "1; DROP" },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
    expect(recorder.calls).toEqual([]);
  });

  test("mutes a Datadog monitor by silencing every scope", async () => {
    const recorder = sdkRecorder();
    const provider = createDatadogPack({
      clientFactory: recorder.clientFactory,
    }).create({ apiKeyRuntime })[0];

    await provider.execute({
      integrationId: "datadog",
      operationId: "datadog:mute-monitor",
      reference: reference("datadog"),
      input: { monitorId: 42 },
    });
    await provider.execute({
      integrationId: "datadog",
      operationId: "datadog:mute-monitor",
      reference: reference("datadog"),
      input: { monitorId: 42, unmute: true },
    });

    expect(recorder.calls[0]?.args[0]).toEqual({
      monitorId: 42,
      body: { options: { silenced: { "*": null } } },
    });
    expect(recorder.calls[1]?.args[0]).toEqual({
      monitorId: 42,
      body: { options: { silenced: {} } },
    });
  });

  test("reaches a Reddit action through the content object it belongs to", async () => {
    const recorder = sdkRecorder();
    const provider = createRedditPack({
      clientFactory: recorder.clientFactory,
    }).create({ oauthRuntime })[0];

    await provider.execute({
      integrationId: "reddit",
      operationId: "reddit:save",
      reference: reference("reddit"),
      input: { postId: "t3_abc123" },
    });

    // snoowrap is object-oriented: the action is a method on the submission,
    // not on the client, and the type prefix is stripped from the ID.
    expect(recorder.calls.map((call) => call.path)).toEqual([
      "getSubmission",
      "getSubmission.save",
    ]);
    expect(recorder.calls[0]?.args).toEqual(["abc123"]);
  });

  test("routes a Reddit vote by direction and rejects a malformed thing ID", async () => {
    const recorder = sdkRecorder();
    const provider = createRedditPack({
      clientFactory: recorder.clientFactory,
    }).create({ oauthRuntime })[0];
    const vote = (input: Record<string, unknown>) =>
      provider.execute({
        integrationId: "reddit",
        operationId: "reddit:vote",
        reference: reference("reddit"),
        input: { postId: "t3_abc123", ...input },
      });

    await vote({});
    await vote({ direction: "down" });
    await vote({ direction: "none" });

    expect(
      recorder.calls
        .map((call) => call.path)
        .filter((path) => path !== "getSubmission"),
    ).toEqual([
      "getSubmission.upvote",
      "getSubmission.downvote",
      "getSubmission.unvote",
    ]);

    await expect(
      provider.execute({
        integrationId: "reddit",
        operationId: "reddit:save",
        reference: reference("reddit"),
        input: { postId: "../../admin" },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
  });

  test("treats an absent Box parent as the account root", async () => {
    const recorder = sdkRecorder();
    const provider = createBoxPack({
      clientFactory: recorder.clientFactory,
    }).create({ oauthRuntime })[0];

    await provider.execute({
      integrationId: "box",
      operationId: "box:create-folder",
      reference: reference("box"),
      input: { name: "Reports" },
    });

    expect(recorder.calls[0]).toEqual({
      path: "folders.createFolder",
      args: [{ name: "Reports", parent: { id: "0" } }],
    });
  });

  test("allows only data-plane verbs through the Upstash escape hatch", async () => {
    const recorder = sdkRecorder();
    const provider = createUpstashPack({
      clientFactory: recorder.clientFactory,
    }).create({ apiKeyRuntime })[0];
    const run = (command: string) =>
      provider.execute({
        integrationId: "upstash",
        operationId: "upstash:command",
        reference: reference("upstash"),
        input: { command, args: ["k"] },
      });

    await run("get");
    expect(recorder.calls[0]).toEqual({ path: "exec", args: [["GET", "k"]] });

    // The same restriction the Redis protocol provider applies.
    for (const command of ["FLUSHALL", "CONFIG", "EVAL", "KEYS"]) {
      await expect(run(command)).rejects.toMatchObject({
        code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      });
    }
  });

  test("rejects an index name that is not a plain resource identifier", async () => {
    const recorder = sdkRecorder();
    const provider = createAlgoliaPack({
      clientFactory: recorder.clientFactory,
    }).create({ apiKeyRuntime })[0];

    await expect(
      provider.execute({
        integrationId: "algolia",
        operationId: "algolia:search",
        reference: reference("algolia"),
        input: { index: "products/../settings", query: "shoes" },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
    expect(recorder.calls).toEqual([]);
  });

  test("scopes a Pinecone query to its namespace when one is given", async () => {
    const recorder = sdkRecorder();
    const provider = createPineconePack({
      clientFactory: recorder.clientFactory,
    }).create({ apiKeyRuntime })[0];

    await provider.execute({
      integrationId: "pinecone",
      operationId: "pinecone:search-with-vector",
      reference: reference("pinecone"),
      input: { index: "docs", namespace: "tenant-1", vector: [0.1, 0.2] },
    });

    expect(recorder.calls.map((call) => call.path)).toEqual([
      "index",
      "index.namespace",
      "index.namespace.query",
    ]);
    expect(recorder.calls[1]?.args).toEqual(["tenant-1"]);
  });

  test("injects the Maps key into every request rather than each mapping", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const provider = createGoogleMapsPack({
      clientFactory: () =>
        new Proxy({} as Record<string, unknown>, {
          get:
            (_t, method: string) =>
            (request: { params?: Record<string, unknown> }) => {
              calls.push({ method, params: request.params });
              return Promise.resolve({ data: {} });
            },
        }),
    }).create({ apiKeyRuntime })[0];

    await provider.execute({
      integrationId: "google-maps",
      operationId: "google-maps:geocode-address",
      reference: reference("google-maps"),
      input: { address: "1 Infinite Loop" },
    });

    expect(calls[0]).toEqual({
      method: "geocode",
      params: { address: "1 Infinite Loop" },
    });
  });

  test("rejects an out-of-range coordinate", async () => {
    const provider = createGoogleMapsPack({
      clientFactory: () =>
        new Proxy({} as Record<string, unknown>, {
          get: () => () => Promise.resolve({ data: {} }),
        }),
    }).create({ apiKeyRuntime })[0];

    await expect(
      provider.execute({
        integrationId: "google-maps",
        operationId: "google-maps:reverse-geocode",
        reference: reference("google-maps"),
        input: { lat: 200, lng: 0 },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
  });

  test("records why the five uncovered Maps APIs stay deferred", () => {
    const deferred = createGoogleMapsPack().coverage.filter(
      (entry) => entry.disposition === "deferred",
    );

    expect(deferred.map((entry) => entry.sourceOperationId)).toEqual([
      "google-maps:speed-limits",
      "google-maps:validate-address",
      "google-maps:air-quality",
      "google-maps:pollen-forecast",
      "google-maps:solar-potential",
    ]);
    for (const entry of deferred) {
      expect(entry.reason).toContain("own Google Maps Platform host");
    }
  });

  test("rejects a non-numeric Zendesk identifier", async () => {
    const recorder = sdkRecorder();
    const provider = createZendeskPack({
      clientFactory: recorder.clientFactory,
    }).create({ apiKeyRuntime })[0];

    await provider.execute({
      integrationId: "zendesk",
      operationId: "zendesk:get-ticket",
      reference: reference("zendesk"),
      input: { ticketId: 42 },
    });
    expect(recorder.calls[0]).toEqual({ path: "tickets.show", args: [42] });

    await expect(
      provider.execute({
        integrationId: "zendesk",
        operationId: "zendesk:get-ticket",
        reference: reference("zendesk"),
        input: { ticketId: "42 OR 1=1" },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
  });

  test("builds an Azure DevOps work-item write as a JSON Patch document", async () => {
    const calls: Array<{ area: string; args: unknown[] }> = [];
    const api = new Proxy({} as Record<string, unknown>, {
      get(_t, method: string) {
        // The area API is awaited, so it must not look like a thenable.
        if (method === "then") return undefined;
        return (...args: unknown[]) => {
          calls.push({ area: method, args });
          return Promise.resolve({});
        };
      },
    });
    const provider = createAzureDevOpsPack({
      clientFactory: () =>
        ({
          getWorkItemTrackingApi: async () => api,
          project: "Platform",
        }) as never,
    }).create({ apiKeyRuntime })[0];

    await provider.execute({
      integrationId: "azure-devops",
      operationId: "azure-devops:create-work-item",
      reference: reference("azure-devops"),
      input: { workItemType: "Bug", fields: { "System.Title": "Crash" } },
    });

    expect(calls[0]?.area).toBe("createWorkItem");
    expect(calls[0]?.args[1]).toEqual([
      { op: "add", path: "/fields/System.Title", value: "Crash" },
    ]);
    // The project falls back to the one on the connection.
    expect(calls[0]?.args[2]).toBe("Platform");
  });

  test("requires a GUID envelope ID before calling DocuSign", async () => {
    const provider = createDocuSignPack({
      clientFactory: () =>
        ({
          envelopesApi: {
            getEnvelope: async () => ({ status: "sent" }),
          },
          accountId: "acct",
        }) as never,
    }).create({ oauthRuntime })[0];

    await expect(
      provider.execute({
        integrationId: "docusign",
        operationId: "docusign:get-envelope",
        reference: reference("docusign"),
        input: { envelopeId: "not-a-guid" },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
  });

  test("binds Shopify GraphQL values as variables, never into the document", async () => {
    const requests: Array<{ query: string; variables: unknown }> = [];
    const provider = createShopifyPack({
      clientFactory: () =>
        ({
          request: async (query: string, options: { variables?: unknown }) => {
            requests.push({ query, variables: options?.variables });
            return { data: {} };
          },
        }) as never,
    }).create({ oauthRuntime })[0];

    await provider.execute({
      integrationId: "shopify",
      operationId: "shopify:list-products",
      reference: reference("shopify"),
      input: { query: 'title:"] } malicious {"', limit: 10 },
    });

    // The injection attempt survives only as a bound variable.
    expect(requests[0]?.variables).toEqual({
      first: 10,
      query: 'title:"] } malicious {"',
    });
    expect(requests[0]?.query).not.toContain("malicious");
  });

  test("promotes a numeric Shopify ID to a global ID and rejects other types", async () => {
    const requests: Array<{ variables: unknown }> = [];
    const provider = createShopifyPack({
      clientFactory: () =>
        ({
          request: async (_q: string, options: { variables?: unknown }) => {
            requests.push({ variables: options?.variables });
            return { data: {} };
          },
        }) as never,
    }).create({ oauthRuntime })[0];

    await provider.execute({
      integrationId: "shopify",
      operationId: "shopify:get-product",
      reference: reference("shopify"),
      input: { productId: "123" },
    });
    expect(requests[0]?.variables).toEqual({
      id: "gid://shopify/Product/123",
    });

    // A global ID for a different resource type must not be accepted.
    await expect(
      provider.execute({
        integrationId: "shopify",
        operationId: "shopify:get-product",
        reference: reference("shopify"),
        input: { productId: "gid://shopify/Customer/123" },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
  });

  test("resolves a Temporal action through the handle that carries it", async () => {
    const calls: string[] = [];
    const handle = {
      terminate: async (reason?: string) => {
        calls.push(`terminate:${reason ?? ""}`);
      },
    };
    const provider = createTemporalPack({
      clientFactory: () =>
        ({
          workflow: {
            getHandle: (id: string) => {
              calls.push(`getHandle:${id}`);
              return handle;
            },
          },
        }) as never,
    }).create({ apiKeyRuntime })[0];

    const result = await provider.execute({
      integrationId: "temporal",
      operationId: "temporal:terminate-workflow",
      reference: reference("temporal"),
      input: { workflowId: "order-42", reason: "stale" },
    });

    expect(calls).toEqual(["getHandle:order-42", "terminate:stale"]);
    expect(result.output).toEqual({
      workflowId: "order-42",
      terminated: true,
    });
  });

  test("registers Salesforce OAuth with the instance URL as callback metadata", () => {
    const provider = createSalesforceOAuth2Provider({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "https://app.example/callback",
      loginHost: "https://test.salesforce.com",
    });

    expect(provider).toMatchObject({
      integrationId: "salesforce",
      authorizationEndpoint:
        "https://test.salesforce.com/services/oauth2/authorize",
      // jsforce needs the per-org host, which Salesforce returns at callback.
      callbackMetadata: { instanceUrl: "instance_url" },
    });
    expect(provider.scopes).toContain("refresh_token");
  });
});
