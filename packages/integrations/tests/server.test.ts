import { describe, expect, test } from "bun:test";
import { createHash, createHmac } from "node:crypto";

import { exportJWK, generateKeyPair, SignJWT } from "jose";

import {
  createApiKeyProviderSdk,
  createIntegrationApiKeyRoutes,
  createIntegrationConnectionLinkRoutes,
  createIntegrationConnectionLinkRuntime,
  createIntegrationWebhookRoutes,
  createIntegrationWebhookRuntime,
  createIntegrationApiKeyRuntime,
  createBuiltInIntegrationApiKeyRuntime,
  BUILT_IN_API_KEY_PROVIDER_CONFIGURATIONS,
  createIntegrationNoAuthRoutes,
  createIntegrationNoAuthRuntime,
  createIntegrationCredentialReference,
  createIntegrationCredentialKeyring,
  createIntegrationProviderExecutionRoutes,
  createIntegrationProviderSdkRegistry,
  createBuiltInProviderSdkRegistry,
  createAirtableOAuth2Provider,
  createAsanaOAuth2Provider,
  createDropboxOAuth2Provider,
  createHubSpotOAuth2Provider,
  createGoogleCalendarOAuth2Provider,
  createGoogleDriveOAuth2Provider,
  createGoogleSheetsOAuth2Provider,
  createGoogleDocsOAuth2Provider,
  createGoogleSlidesOAuth2Provider,
  createGmailOAuth2Provider,
  createGoogleFormsOAuth2Provider,
  createGoogleTasksOAuth2Provider,
  createGoogleContactsOAuth2Provider,
  createGoogleMeetOAuth2Provider,
  createGoogleGroupsOAuth2Provider,
  createHubSpotProviderSdk,
  createGitHubProviderSdk,
  createGitLabProviderSdk,
  createCloudflareProviderSdk,
  createElevenLabsProviderSdk,
  createFirecrawlProviderSdk,
  createAirtableProviderSdk,
  createAsanaProviderSdk,
  createDropboxProviderSdk,
  createBrexProviderSdk,
  createQuickBooksProviderSdk,
  createXeroProviderSdk,
  createPlaidProviderSdk,
  createMergeProviderSdk,
  createMailgunProviderSdk,
  createIntercomProviderSdk,
  createLinearOAuth2Provider,
  createLinearProviderSdk,
  createMailchimpProviderSdk,
  createVercelProviderSdk,
  createSquareProviderSdk,
  createGoogleCalendarProviderSdk,
  createGoogleDriveProviderSdk,
  createGoogleSheetsProviderSdk,
  createGoogleDocsProviderSdk,
  createGoogleSlidesProviderSdk,
  createGmailProviderSdk,
  createGoogleFormsProviderSdk,
  createGoogleTasksProviderSdk,
  createGoogleContactsProviderSdk,
  createGoogleBooksProviderSdk,
  createYouTubeProviderSdk,
  createResendProviderSdk,
  createGoogleMeetProviderSdk,
  createGoogleGroupsProviderSdk,
  createInMemoryIntegrationOAuthStateStore,
  createIntegrationProductRoutes,
  createOAuth2ProviderSdk,
  createOAuthRouteConnector,
  createQuickBooksOAuth2Provider,
  createSlackOAuth2Provider,
  createSlackProviderSdk,
  createStripeProviderSdk,
  createXeroOAuth2Provider,
  createUnauthenticatedProviderSdk,
  createIntegrationOAuthRoutes,
  createIntegrationOAuthRuntime,
  decryptIntegrationApiKeyCredential,
  decryptIntegrationCredential,
  encryptIntegrationApiKeyCredential,
  encryptIntegrationCredential,
  getStripeProviderSdkReport,
  getSlackProviderSdkReport,
  getHubSpotProviderSdkReport,
  getGitHubProviderSdkReport,
  getGitLabProviderSdkReport,
  getCloudflareProviderSdkReport,
  getElevenLabsProviderSdkReport,
  getFirecrawlProviderSdkReport,
  getAirtableProviderSdkReport,
  getAsanaProviderSdkReport,
  getDropboxProviderSdkReport,
  getBrexProviderSdkReport,
  getQuickBooksProviderSdkReport,
  getXeroProviderSdkReport,
  getPlaidProviderSdkReport,
  getMergeProviderSdkReport,
  getMailgunProviderSdkReport,
  getIntercomProviderSdkReport,
  getLinearProviderSdkReport,
  getMailchimpProviderSdkReport,
  getVercelProviderSdkReport,
  getSquareProviderSdkReport,
  getGoogleCalendarProviderSdkReport,
  getGoogleDriveProviderSdkReport,
  getGoogleSheetsProviderSdkReport,
  getGoogleDocsProviderSdkReport,
  getGoogleSlidesProviderSdkReport,
  getGmailProviderSdkReport,
  getGoogleFormsProviderSdkReport,
  getGoogleTasksProviderSdkReport,
  getGoogleContactsProviderSdkReport,
  getGoogleBooksProviderSdkReport,
  getYouTubeProviderSdkReport,
  getResendProviderSdkReport,
  getGoogleMeetProviderSdkReport,
  getGoogleGroupsProviderSdkReport,
  getProviderSdkCoverageReport,
  type EncryptedIntegrationCredential,
  type IntegrationCredentialKeyring,
  type IntegrationCredentialReference,
  type IntegrationCredentialVault,
  type PendingIntegrationOAuthAuthorization,
} from "../src/server";
import type { ProductIntegrationKit } from "../src/kit";

async function createKeyring(): Promise<IntegrationCredentialKeyring> {
  return createIntegrationCredentialKeyring({
    active: {
      id: "test-key",
      secret: Buffer.from(new Uint8Array(32).fill(7)).toString("base64url"),
    },
  });
}

async function allowOAuthCompletion(): Promise<void> {}

function recordKey(reference: IntegrationCredentialReference): string {
  return `${reference.product}:${reference.integrationId}:${reference.connectionId}`;
}

function createRuntimeFixture(
  options: {
    tokenRequestDelayMs?: number;
    tokenRequestGate?: Promise<void>;
    onTokenRequest?: () => void;
  } = {},
) {
  const states = new Map<string, PendingIntegrationOAuthAuthorization>();
  const credentials = new Map<string, EncryptedIntegrationCredential>();
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const vault: IntegrationCredentialVault = {
    async read(reference) {
      return credentials.get(recordKey(reference));
    },
    async save(reference, credential) {
      credentials.set(recordKey(reference), credential);
    },
    async revoke(reference) {
      credentials.delete(recordKey(reference));
    },
  };
  const stateStore = {
    async create(state: PendingIntegrationOAuthAuthorization) {
      states.set(state.state, state);
      return true;
    },
    async consume(state: string) {
      const value = states.get(state);
      states.delete(state);
      return value;
    },
    async purgeExpired(at: Date) {
      for (const [state, authorization] of states) {
        if (Date.parse(authorization.expiresAt) <= at.getTime()) {
          states.delete(state);
        }
      }
    },
  };
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    requests.push({ url, init });
    if (url === "https://provider.example.test/token") {
      options.onTokenRequest?.();
      if (options?.tokenRequestDelayMs) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, options.tokenRequestDelayMs);
        });
      }
      if (options.tokenRequestGate) {
        await options.tokenRequestGate;
      }
      return Response.json({
        access_token: "server-access-token",
        refresh_token: "server-refresh-token",
        expires_in: 3_600,
        scope: "accounting.read",
        token_type: "Bearer",
      });
    }
    return Response.json({ ok: true });
  }) as typeof fetch;
  const config = {
    providers: [
      {
        integrationId: "quickbooks" as const,
        authorizationEndpoint: "https://provider.example.test/authorize",
        tokenEndpoint: "https://provider.example.test/token",
        apiBaseUrl: "https://provider.example.test/api",
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri:
          "https://app.example.test/integrations/quickbooks/oauth/callback",
        scopes: ["accounting.read"],
        callbackMetadata: { companyId: "realmId" },
      },
    ],
    credentialVault: vault,
    oauthStateStore: stateStore,
    fetcher,
    now: () => new Date("2026-07-31T12:00:00.000Z"),
  };
  return { config, credentials, requests, states };
}

describe("server credential vault", () => {
  test("encrypts credentials with a connection-bound authenticated envelope", async () => {
    const keyring = await createKeyring();
    const reference = createIntegrationCredentialReference({
      connectionId: "connection-1",
      integrationId: "quickbooks",
      product: "eigenn",
    });
    const encrypted = await encryptIntegrationCredential({
      reference,
      credential: {
        accessToken: "secret-access-token",
        scope: [],
        tokenType: "Bearer",
      },
      keyring,
      now: new Date("2026-07-31T12:00:00.000Z"),
    });
    expect(JSON.stringify(encrypted)).not.toContain("secret-access-token");
    await expect(
      decryptIntegrationCredential({
        reference,
        credential: encrypted,
        keyring,
      }),
    ).resolves.toMatchObject({ accessToken: "secret-access-token" });

    await expect(
      decryptIntegrationCredential({
        reference: { ...reference, connectionId: "connection-2" },
        credential: encrypted,
        keyring,
      }),
    ).rejects.toMatchObject({ code: "CREDENTIAL_DECRYPT_FAILED" });
  });

  test("stores API keys in the same connection-bound encrypted envelope", async () => {
    const keyring = await createKeyring();
    const reference = createIntegrationCredentialReference({
      connectionId: "connection-api-key",
      integrationId: "stripe",
      product: "conduitt",
    });
    const encrypted = await encryptIntegrationApiKeyCredential({
      reference,
      credential: { apiKey: "secret-api-key" },
      keyring,
    });
    expect(JSON.stringify(encrypted)).not.toContain("secret-api-key");
    await expect(
      decryptIntegrationApiKeyCredential({
        reference,
        credential: encrypted,
        keyring,
      }),
    ).resolves.toEqual({ apiKey: "secret-api-key", fields: {} });

    // A provider needing more than one secret, such as AWS, carries the rest
    // in the same envelope. An envelope written before `fields` existed still
    // decrypts, which is why it defaults rather than being required.
    const composite = await encryptIntegrationApiKeyCredential({
      reference,
      credential: {
        apiKey: "AKIAEXAMPLE",
        fields: { secretAccessKey: "wJalr-secret", sessionToken: "FQoGZ" },
      },
      keyring,
    });
    expect(JSON.stringify(composite)).not.toContain("wJalr-secret");
    await expect(
      decryptIntegrationApiKeyCredential({
        reference,
        credential: composite,
        keyring,
      }),
    ).resolves.toEqual({
      apiKey: "AKIAEXAMPLE",
      fields: { secretAccessKey: "wJalr-secret", sessionToken: "FQoGZ" },
    });

    await expect(
      decryptIntegrationApiKeyCredential({
        reference: { ...reference, product: "eigenn" },
        credential: encrypted,
        keyring,
      }),
    ).rejects.toMatchObject({ code: "CREDENTIAL_DECRYPT_FAILED" });
  });
});

describe("server provider SDK families", () => {
  test("sends API keys only through the configured secure header", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const provider = createApiKeyProviderSdk(
      {
        integrationId: "stripe",
        apiBaseUrl: "https://provider.example.test/v1",
        credentialHeader: "Authorization",
        credentialPrefix: "Bearer",
      },
      (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: input.toString(), init });
        return Response.json({ ok: true });
      }) as typeof fetch,
    );

    await provider.request(
      { apiKey: "secret-api-key" },
      {
        path: "/customers?limit=10",
        headers: { Authorization: "attacker-supplied" },
      },
    );

    expect(requests[0]?.url).toBe(
      "https://provider.example.test/v1/customers?limit=10",
    );
    expect(new Headers(requests[0]?.init?.headers).get("Authorization")).toBe(
      "Bearer secret-api-key",
    );
  });

  test("rejects API-key transport configuration that could leak or rewrite requests", () => {
    expect(() =>
      createApiKeyProviderSdk({
        integrationId: "stripe",
        apiBaseUrl: "http://provider.example.test/v1",
        credentialHeader: "Authorization",
      }),
    ).toThrow("provider request");
    expect(() =>
      createApiKeyProviderSdk({
        integrationId: "stripe",
        apiBaseUrl: "https://provider.example.test/v1",
        credentialHeader: "Host",
      }),
    ).toThrow("provider request");
  });

  test("permits SDK-only API-key profiles without an arbitrary HTTP transport", async () => {
    const provider = createApiKeyProviderSdk({ integrationId: "mailchimp" });

    await expect(
      provider.request({ apiKey: "secret-api-key" }, { path: "/lists" }),
    ).rejects.toMatchObject({
      code: "API_KEY_PROVIDER_TRANSPORT_UNAVAILABLE",
    });
  });

  test("keeps no-auth provider requests on their configured HTTPS origin", async () => {
    const requests: string[] = [];
    const provider = createUnauthenticatedProviderSdk(
      {
        integrationId: "duckduckgo",
        apiBaseUrl: "https://provider.example.test/api",
      },
      (async (input: RequestInfo | URL) => {
        requests.push(input.toString());
        return Response.json({ ok: true });
      }) as typeof fetch,
    );

    await provider.request({ path: "/search?q=runway" });
    expect(requests).toEqual([
      "https://provider.example.test/api/search?q=runway",
    ]);
  });
});

describe("server API-key runtime", () => {
  test("ships all API-key profiles needed by the package-owned SDK registry", async () => {
    const keyring = await createKeyring();
    const credentials = new Map<string, EncryptedIntegrationCredential>();
    const vault: IntegrationCredentialVault = {
      async read(reference) {
        return credentials.get(recordKey(reference));
      },
      async save(reference, credential) {
        credentials.set(recordKey(reference), credential);
      },
      async revoke(reference) {
        credentials.delete(recordKey(reference));
      },
    };
    const runtime = createBuiltInIntegrationApiKeyRuntime({
      credentialVault: vault,
      credentialKeyring: keyring,
    });

    const connected = await runtime.connect(
      {
        integrationId: "youtube",
        product: "eigenn",
        subjectId: "user-1",
        apiKey: "youtube-api-key",
      },
      async () => undefined,
    );
    expect(connected.integrationId).toBe("youtube");
    await expect(
      runtime.withCredential(
        createIntegrationCredentialReference({
          connectionId: connected.connectionId,
          integrationId: "youtube",
          product: "eigenn",
        }),
        async (credential) => credential.apiKey,
      ),
    ).resolves.toBe("youtube-api-key");
    expect(
      BUILT_IN_API_KEY_PROVIDER_CONFIGURATIONS.map(
        (provider) => provider.integrationId,
      ),
    ).toEqual([
      "stripe",
      "github",
      "gitlab",
      "cloudflare",
      "elevenlabs",
      "firecrawl",
      "intercom",
      "mailgun",
      "mailchimp",
      "vercel",
      "square",
      "google-books",
      "youtube",
      "resend",
      "brex",
    ]);
  });

  test("owns encrypted persistence and authenticated provider requests", async () => {
    const keyring = await createKeyring();
    const credentials = new Map<string, EncryptedIntegrationCredential>();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const runtime = createIntegrationApiKeyRuntime({
      providers: [
        {
          integrationId: "stripe",
          apiBaseUrl: "https://provider.example.test/v1",
          credentialHeader: "Authorization",
          credentialPrefix: "Bearer",
        },
      ],
      credentialVault: {
        async read(reference) {
          return credentials.get(recordKey(reference));
        },
        async save(reference, credential) {
          credentials.set(recordKey(reference), credential);
        },
        async revoke(reference) {
          credentials.delete(recordKey(reference));
        },
      },
      credentialKeyring: keyring,
      fetcher: (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: input.toString(), init });
        return Response.json({ ok: true });
      }) as typeof fetch,
    });

    const connected = await runtime.connect(
      {
        product: "conduitt",
        subjectId: "organization-1",
        integrationId: "stripe",
        apiKey: "secret-api-key",
      },
      async () => {},
    );
    const reference = createIntegrationCredentialReference({
      connectionId: connected.connectionId,
      integrationId: "stripe",
      product: "conduitt",
    });
    expect(JSON.stringify(credentials.get(recordKey(reference)))).not.toContain(
      "secret-api-key",
    );

    await runtime.request({ reference, request: { path: "/customers" } });
    expect(requests[0]?.url).toBe("https://provider.example.test/v1/customers");
    expect(new Headers(requests[0]?.init?.headers).get("Authorization")).toBe(
      "Bearer secret-api-key",
    );

    await expect(
      runtime.withCredential(reference, async (credential) =>
        credential.apiKey === "secret-api-key" ? "sdk-initialized" : "wrong",
      ),
    ).resolves.toBe("sdk-initialized");

    await runtime.revoke(reference);
    expect(credentials.size).toBe(0);
  });

  test("mounts a bounded API-key route without reflecting the supplied secret", async () => {
    const keyring = await createKeyring();
    const credentials = new Map<string, EncryptedIntegrationCredential>();
    const persistedConnectionIds: string[] = [];
    const routes = createIntegrationApiKeyRoutes({
      providers: [
        {
          integrationId: "stripe",
          apiBaseUrl: "https://provider.example.test/v1",
          credentialHeader: "Authorization",
          credentialPrefix: "Bearer",
        },
      ],
      credentialVault: {
        async read(reference) {
          return credentials.get(recordKey(reference));
        },
        async save(reference, credential) {
          credentials.set(recordKey(reference), credential);
        },
        async revoke(reference) {
          credentials.delete(recordKey(reference));
        },
      },
      credentialKeyring: keyring,
      async resolveSubject() {
        return { product: "eigenn", subjectId: "team-1" };
      },
      async authorizeConnect(subject, integrationId) {
        expect(subject).toEqual({ product: "eigenn", subjectId: "team-1" });
        expect(integrationId).toBe("stripe");
      },
      async onConnected(input) {
        persistedConnectionIds.push(input.connectionId);
      },
    });

    const response = await routes.handle(
      new Request("https://app.example.test/integrations/stripe/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "secret-api-key" }),
      }),
    );
    expect(response?.status).toBe(200);
    const body = await response?.text();
    expect(body).toContain("connected");
    expect(body).not.toContain("secret-api-key");
    expect(persistedConnectionIds).toHaveLength(1);
    expect(credentials.size).toBe(1);
  });
});

describe("server vendor SDK adapters", () => {
  test("reports executable coverage separately from catalogue parity", () => {
    const registry = createIntegrationProviderSdkRegistry([
      {
        integrationId: "stripe",
        operationIds: getStripeProviderSdkReport().operationIds,
        async execute(input) {
          return { operationId: input.operationId, output: {} };
        },
      },
    ]);

    expect(getProviderSdkCoverageReport(registry)).toEqual({
      sourceProviders: 232,
      sourceOperations: 3890,
      sourceTriggers: 363,
      executableProviders: 1,
      executableOperations: 50,
      executableTriggers: 0,
      unimplementedProviders: 231,
      unimplementedOperations: 3840,
      unimplementedTriggers: 363,
      hasCompleteExecutionParity: false,
    });
  });

  test("builds the standard package registry without product vendor-SDK glue", () => {
    const registry = createBuiltInProviderSdkRegistry({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "key", fields: {} });
        },
        async request() {
          return Response.json({});
        },
      },
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "token",
            scope: [],
            tokenType: "Bearer",
          });
        },
        async request() {
          return Response.json({});
        },
      },
    });

    expect(getProviderSdkCoverageReport(registry)).toMatchObject({
      executableProviders: 57,
      executableOperations: 1286,
      executableTriggers: 0,
      hasCompleteExecutionParity: false,
    });
  });

  test("executes every pinned Stripe operation through a package-owned Stripe SDK", async () => {
    const calls: Array<{
      resource: string;
      method: string;
      args: unknown[];
    }> = [];
    const clientFactory = () =>
      new Proxy(
        {},
        {
          get(_target, resource) {
            return new Proxy(
              {},
              {
                get(_resourceTarget, method) {
                  return (...args: unknown[]) => {
                    calls.push({
                      resource: String(resource),
                      method: String(method),
                      args,
                    });
                    return Promise.resolve({ resource, method, args });
                  };
                },
              },
            );
          },
        },
      );
    const adapter = createStripeProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "secret-api-key", fields: {} });
        },
      },
      clientFactory: clientFactory as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "stripe-connection",
      integrationId: "stripe",
      product: "conduitt",
    });

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "stripe",
        operationId,
        reference,
        input: { id: "stripe-object", query: "status:'active'" },
        idempotencyKey: `operation-${operationId}`,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("secret-api-key");
    }

    const report = getStripeProviderSdkReport();
    expect(report.operations).toBe(50);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(calls).toHaveLength(report.operations);
    expect(calls.some((call) => call.method === "finalizeInvoice")).toBeTrue();
    expect(calls.some((call) => call.method === "sendInvoice")).toBeTrue();
  });

  test("does not let a Stripe operation use another provider connection", async () => {
    const adapter = createStripeProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "must-not-be-used", fields: {} });
        },
      },
      clientFactory: (() => ({})) as never,
    });

    await expect(
      adapter.execute({
        integrationId: "stripe",
        operationId: "stripe:create-customer",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "quickbooks",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned Slack operation through its OAuth-owned Web API SDK", async () => {
    const calls: Array<{ method: string; input?: Record<string, unknown> }> =
      [];
    const adapter = createSlackProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "slack-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: (() => ({
        async apiCall(method: string, input?: Record<string, unknown>) {
          calls.push({ method, input });
          return {
            ok: true,
            file: {
              id: "file-1",
              url_private_download:
                "https://files.slack.com/files-pri/T1/file-1",
            },
          };
        },
      })) as never,
      fetcher: (async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(input.toString()).toContain("files.slack.com");
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          "Bearer slack-access-token",
        );
        return new Response(new Uint8Array([1, 2, 3]));
      }) as typeof fetch,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "slack-connection",
      integrationId: "slack",
      product: "eigenn",
    });

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "slack",
        operationId,
        reference,
        input: { channelId: "C1", messageTs: "1.2" },
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("slack-access-token");
    }

    const report = getSlackProviderSdkReport();
    expect(report.operations).toBe(42);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(calls).toHaveLength(report.operations);
    expect(
      calls.find((call) => call.method === "chat.postMessage")?.input,
    ).toMatchObject({
      channel_id: "C1",
      message_ts: "1.2",
    });
  });

  test("does not let a Slack operation use another provider connection", async () => {
    const adapter = createSlackProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "slack",
        operationId: "slack:send-message",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "quickbooks",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned HubSpot operation through its OAuth-owned Node SDK", async () => {
    const tokens: string[] = [];
    const requests: Array<{
      method: string;
      path: string;
      body?: unknown;
      qs?: Record<string, string>;
    }> = [];
    const adapter = createHubSpotProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "hubspot-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: (() => ({
        setAccessToken(token: string) {
          tokens.push(token);
        },
        async apiRequest(request: (typeof requests)[number]) {
          requests.push(request);
          return {
            ok: true,
            async json() {
              return { id: "hubspot-record", request };
            },
          };
        },
      })) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "hubspot-connection",
      integrationId: "hubspot",
      product: "conduitt",
    });
    const input = {
      id: "record-1",
      contactId: "contact-1",
      companyId: "company-1",
      dealId: "deal-1",
      ticketId: "ticket-1",
      noteId: "note-1",
      emailId: "email-1",
      lineItemId: "line-item-1",
      quoteId: "quote-1",
      appointmentId: "appointment-1",
      cartId: "cart-1",
      eventId: "event-1",
      listId: "list-1",
      objectType: "contacts",
      objectId: "record-1",
      toObjectType: "companies",
      toObjectId: "company-1",
      properties: { email: "operator@example.test" },
      associations: [],
      filterGroups: [],
      sorts: [],
      recordIds: ["record-1"],
      name: "Priority accounts",
      objectTypeId: "0-1",
      processingType: "MANUAL",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "hubspot",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("hubspot-access-token");
    }

    const report = getHubSpotProviderSdkReport();
    expect(report.operations).toBe(50);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(requests).toHaveLength(report.operations);
    expect(tokens).toHaveLength(report.operations);
    expect(
      tokens.every((token) => token === "hubspot-access-token"),
    ).toBeTrue();
    expect(requests).toContainEqual(
      expect.objectContaining({
        method: "GET",
        path: "/crm/v3/objects/contacts/contact-1",
      }),
    );
    expect(requests).toContainEqual(
      expect.objectContaining({
        method: "PUT",
        path: "/crm/v3/lists/list-1/memberships/add",
        body: ["record-1"],
      }),
    );
  });

  test("does not let a HubSpot operation use another provider connection", async () => {
    const adapter = createHubSpotProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "hubspot",
        operationId: "hubspot:get-contacts",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "slack",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned GitHub operation through its package-owned Octokit client", async () => {
    const tokens: string[] = [];
    const requests: Array<{
      route: string;
      parameters: Record<string, unknown>;
    }> = [];
    const adapter = createGitHubProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "github-api-key", fields: {} });
        },
      },
      clientFactory: ((apiKey: string) => {
        tokens.push(apiKey);
        return {
          async request(route: string, parameters: Record<string, unknown>) {
            requests.push({ route, parameters });
            return { data: { route, parameters } };
          },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "github-connection",
      integrationId: "github",
      product: "eigenn",
    });
    const input = {
      owner: "oppulence",
      repo: "integrations",
      path: "README.md",
      branch: "main",
      pullNumber: 1,
      issueNumber: 1,
      commentId: 2,
      reactionId: 3,
      releaseId: 4,
      workflowId: 5,
      runId: 6,
      milestoneNumber: 7,
      gistId: "gist-1",
      ref: "main",
      base: "main",
      head: "feature/adapter",
      name: "bug",
      username: "octocat",
      ownerLogin: "oppulence",
      ownerId: "PVT_owner",
      projectId: "PVT_project",
      projectNumber: 1,
      title: "Title",
      body: "Body",
      state: "open",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "github",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("github-api-key");
    }

    const report = getGitHubProviderSdkReport();
    expect(report.operations).toBe(87);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(requests).toHaveLength(report.operations);
    expect(tokens).toHaveLength(report.operations);
    expect(
      requests.every((request) => request.parameters.api_key === undefined),
    ).toBeTrue();
    expect(requests).toContainEqual(
      expect.objectContaining({
        route: "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      }),
    );
    expect(requests).toContainEqual(
      expect.objectContaining({ route: "POST /graphql" }),
    );
  });

  test("executes every pinned GitLab action through the maintained GitBeaker SDK", async () => {
    const apiKeys: string[] = [];
    const hosts: string[] = [];
    const calls: Array<{
      resource: string;
      method: string;
      args: unknown[];
    }> = [];
    const clientFactory = (apiKey: string, host: string) => {
      apiKeys.push(apiKey);
      hosts.push(host);
      return new Proxy(
        {},
        {
          get(_target, resource) {
            if (resource === "then") return undefined;
            return new Proxy(
              {},
              {
                get(_resourceTarget, method) {
                  if (method === "then") return undefined;
                  return async (...args: unknown[]) => {
                    calls.push({
                      resource: String(resource),
                      method: String(method),
                      args,
                    });
                    return { resource, method, args };
                  };
                },
              },
            );
          },
        },
      );
    };
    const adapter = createGitLabProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            apiKey: "gitlab-personal-access-token",
            fields: {},
          });
        },
      },
      clientFactory: clientFactory as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "gitlab-connection",
      integrationId: "gitlab",
      product: "eigenn",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      host: "https://attacker.example.test",
      projectId: "finance/platform",
      groupId: "finance",
      issueIid: 1,
      mergeRequestIid: 2,
      pipelineId: 3,
      jobId: 4,
      filePath: "docs/close.md",
      ref: "main",
      branch: "feature/close",
      content: "ready",
      commitMessage: "docs: add close runbook",
      title: "Close the books",
      body: "Please review this item.",
      sourceBranch: "feature/close",
      targetBranch: "main",
      from: "main",
      to: "feature/close",
      resourceType: "project",
      resourceId: "finance/platform",
      userId: 5,
      username: "ada",
      accessLevel: 30,
      email: "ada@example.test",
      samlGroupName: "finance-operators",
      provider: "saml",
      search: "ada",
      tagName: "v1.2.3",
      name: "July close",
      description: "Release notes",
      perPage: 20,
      page: 1,
      variables: [{ key: "DEPLOY", value: "true" }],
      jobVariables: [{ key: "DEPLOY", value: "true" }],
      membershipType: "Project",
      labels: "finance",
      state: "opened",
      status: "running",
      orderBy: "updated_at",
      sort: "desc",
      maxResults: 10,
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "gitlab",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain(
        "gitlab-personal-access-token",
      );
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
      expect(JSON.stringify(result)).not.toContain("attacker.example.test");
    }

    const report = getGitLabProviderSdkReport();
    expect(report.operations).toBe(65);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(apiKeys).toEqual(Array(65).fill("gitlab-personal-access-token"));
    expect(hosts).toEqual(Array(65).fill("https://gitlab.com"));
    expect(calls).toContainEqual(
      expect.objectContaining({
        resource: "MergeRequestApprovals",
        method: "approve",
      }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ resource: "GroupSAMLLinks", method: "create" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({
        resource: "Users",
        method: "removeAuthenticationIdentity",
      }),
    );
  });

  test("rejects an unsafe GitLab host before a credential is read", () => {
    try {
      createGitLabProviderSdk({
        apiKeyRuntime: {
          async withCredential(_reference, operation) {
            return operation({ apiKey: "must-not-be-used", fields: {} });
          },
        },
        host: "http://gitlab.example.test",
      });
      throw new Error("Expected the unsafe host to fail.");
    } catch (error) {
      expect(error).toMatchObject({
        code: "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
      });
    }
  });

  test("executes every Cloudflare action exposed by the official SDK", async () => {
    const apiKeys: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const node = (path: string[]): unknown => {
      return new Proxy(
        {},
        {
          get(_target, property) {
            if (property === "then") return undefined;
            if (
              ["list", "get", "create", "delete", "edit", "purge"].includes(
                String(property),
              )
            ) {
              return async (...args: unknown[]) => {
                const methodPath = [...path, String(property)].join(".");
                calls.push({ path: methodPath, args });
                return { path: methodPath, args };
              };
            }
            return node([...path, String(property)]);
          },
        },
      );
    };
    const adapter = createCloudflareProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "cloudflare-api-token", fields: {} });
        },
      },
      clientFactory: ((apiKey: string) => {
        apiKeys.push(apiKey);
        return node([]);
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "cloudflare-connection",
      integrationId: "cloudflare",
      product: "eigenn",
    });
    const input = {
      apiKey: "attacker-supplied-token",
      zoneId: "zone-123",
      recordId: "record-123",
      accountId: "account-123",
      name: "www.example.test",
      type: "A",
      content: "192.0.2.1",
      ttl: 300,
      proxied: true,
      priority: 10,
      comment: "managed by workflow",
      tags: "finance,production",
      status: "active",
      page: 1,
      per_page: 20,
      order: "name",
      direction: "asc",
      match: "all",
      search: "www",
      tag: "production",
      tag_match: "all",
      commentFilter: "managed",
      settingId: "always_online",
      value: "on",
      since: "2026-07-01T00:00:00Z",
      until: "2026-07-31T23:59:59Z",
      metrics: "queryCount",
      dimensions: "queryType",
      filters: "queryType eq A",
      sort: "-queryCount",
      limit: 100,
      purge_everything: true,
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "cloudflare",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("cloudflare-api-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getCloudflareProviderSdkReport();
    expect(report.operations).toBe(12);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(apiKeys).toEqual(Array(12).fill("cloudflare-api-token"));
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "dns.records.create" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "cache.purge" }),
    );
    await expect(
      adapter.execute({
        integrationId: "cloudflare",
        operationId: "cloudflare:get-zone-settings",
        reference,
        input,
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    });
  });

  test("executes every pinned ElevenLabs action through the official SDK", async () => {
    const apiKeys: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const node = (path: string[]): unknown =>
      new Proxy(
        {},
        {
          get(_target, property) {
            if (property === "then") return undefined;
            if (
              ["convert", "search", "get", "update", "list"].includes(
                String(property),
              )
            ) {
              return async (...args: unknown[]) => {
                const methodPath = [...path, String(property)].join(".");
                calls.push({ path: methodPath, args });
                if (property === "convert") {
                  return new ReadableStream<Uint8Array>({
                    start(controller) {
                      controller.enqueue(new Uint8Array([1, 2, 3]));
                      controller.close();
                    },
                  });
                }
                return { path: methodPath, args };
              };
            }
            return node([...path, String(property)]);
          },
        },
      );
    const adapter = createElevenLabsProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "elevenlabs-api-key", fields: {} });
        },
      },
      clientFactory: ((apiKey: string) => {
        apiKeys.push(apiKey);
        return node([]);
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "elevenlabs-connection",
      integrationId: "elevenlabs",
      product: "eigenn",
    });
    const input = {
      apiKey: "attacker-supplied-token",
      text: "Turn this into an audio update.",
      voiceId: "voice_123",
      modelId: "eleven_multilingual_v2",
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0.1,
      useSpeakerBoost: true,
      speed: 1,
      outputFormat: "mp3_44100_128",
      durationSeconds: 5,
      promptInfluence: 0.3,
      loop: false,
      removeBackgroundNoise: true,
      audioFile: {
        name: "source.mp3",
        type: "audio/mpeg",
        base64: Buffer.from([4, 5, 6]).toString("base64"),
      },
      search: "finance",
      category: "premade",
      pageSize: 10,
      nextPageToken: "next-page",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "elevenlabs",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("elevenlabs-api-key");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
      if (operationId === "elevenlabs:text-to-speech") {
        expect(result.output).toMatchObject({
          audioBase64: "AQID",
          mimeType: "audio/mpeg",
          byteLength: 3,
        });
      }
    }

    const report = getElevenLabsProviderSdkReport();
    expect(report.operations).toBe(10);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(apiKeys).toEqual(Array(10).fill("elevenlabs-api-key"));
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "textToSpeech.convert" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "speechToSpeech.convert" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "voices.settings.update" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "models.list" }),
    );
  });

  test("executes every pinned Firecrawl action through the official SDK", async () => {
    const apiKeys: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const node = (path: string[]): unknown =>
      new Proxy(
        {},
        {
          get(_target, property) {
            if (property === "then") return undefined;
            return async (...args: unknown[]) => {
              const methodPath = [...path, String(property)].join(".");
              calls.push({ path: methodPath, args });
              return { path: methodPath, args };
            };
          },
        },
      );
    const adapter = createFirecrawlProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "firecrawl-api-key", fields: {} });
        },
      },
      clientFactory: ((apiKey: string) => {
        apiKeys.push(apiKey);
        return node([]);
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "firecrawl-connection",
      integrationId: "firecrawl",
      product: "conduitt",
    });
    const input = {
      apiKey: "attacker-supplied-token",
      url: "https://example.test/docs",
      urls: '["https://example.test/one","https://example.test/two"]',
      jobId: "job_123",
      query: "quarterly close checklist",
      prompt: "Find every current deadline.",
      formats: '["markdown","html"]',
      scrapeOptions: '{"onlyMainContent":true}',
      onlyMainContent: true,
      maxConcurrency: 5,
      ignoreInvalidURLs: true,
      zeroDataRetention: true,
      limit: 10,
      maxDepth: 2,
      excludePaths: '["/admin/*"]',
      includePaths: '["/docs/*"]',
      search: "finance",
      sitemap: "include",
      includeSubdomains: true,
      ignoreQueryParameters: true,
      timeout: 30_000,
      location: '{"country":"US"}',
      schema: '{"type":"object","properties":{"deadline":{"type":"string"}}}',
      enableWebSearch: true,
      ignoreSitemap: false,
      showSources: true,
      maxCredits: 100,
      strictConstrainToURLs: true,
      file: {
        name: "close.pdf",
        type: "application/pdf",
        base64: Buffer.from("PDF").toString("base64"),
      },
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "firecrawl",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("firecrawl-api-key");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getFirecrawlProviderSdkReport();
    expect(report.operations).toBe(13);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(apiKeys).toEqual(Array(13).fill("firecrawl-api-key"));
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "startBatchScrape" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "getCrawlStatus" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "startExtract" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "getCreditUsage" }),
    );
  });

  test("executes Airtable actions exposed by the official SDK", async () => {
    const accessTokens: string[] = [];
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const adapter = createAirtableProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "airtable-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        accessTokens.push(accessToken);
        const table = {
          select: (...args: unknown[]) => {
            calls.push({ method: "select", args });
            return {
              all: async () => [{ id: "rec_1", fields: { Name: "Ada" } }],
            };
          },
          find: async (...args: unknown[]) => {
            calls.push({ method: "find", args });
            return { id: "rec_1", fields: { Name: "Ada" } };
          },
          create: async (...args: unknown[]) => {
            calls.push({ method: "create", args });
            return [{ id: "rec_2", fields: { Name: "Grace" } }];
          },
          update: async (...args: unknown[]) => {
            calls.push({ method: "update", args });
            return { id: "rec_1", fields: { Name: "Ada Lovelace" } };
          },
          destroy: async (...args: unknown[]) => {
            calls.push({ method: "destroy", args });
            return [{ id: "rec_1" }];
          },
        };
        return { base: () => ({ table: () => table }) };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "airtable-connection",
      integrationId: "airtable",
      product: "eigenn",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      baseId: "app_123",
      tableId: "tbl_123",
      recordId: "rec_1",
      maxRecords: 25,
      filterFormula: "{Status} = 'Open'",
      records: '[{"id":"rec_1","fields":{"Name":"Ada"}}]',
      recordIds: '["rec_1"]',
      fields: '{"Name":"Ada Lovelace"}',
      typecast: true,
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "airtable",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("airtable-access-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getAirtableProviderSdkReport();
    expect(report.operations).toBe(6);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(accessTokens).toEqual(Array(6).fill("airtable-access-token"));
    expect(calls).toContainEqual(expect.objectContaining({ method: "select" }));
    expect(calls).toContainEqual(expect.objectContaining({ method: "create" }));
    expect(calls).toContainEqual(
      expect.objectContaining({ method: "destroy" }),
    );
    await expect(
      adapter.execute({
        integrationId: "airtable",
        operationId: "airtable:upsert-records",
        reference,
        input,
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    });
  });

  test("executes every pinned Asana action through the official SDK", async () => {
    const accessTokens: string[] = [];
    const calls: Array<{ resource: string; method: string; args: unknown[] }> =
      [];
    const resource = (resourceName: string) =>
      new Proxy(
        {},
        {
          get(_target, property) {
            return async (...args: unknown[]) => {
              const method = String(property);
              calls.push({ resource: resourceName, method, args });
              return { resource: resourceName, method, args };
            };
          },
        },
      );
    const adapter = createAsanaProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "asana-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        accessTokens.push(accessToken);
        return {
          tasks: resource("tasks"),
          projects: resource("projects"),
          sections: resource("sections"),
          stories: resource("stories"),
          workspaces: resource("workspaces"),
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "asana-connection",
      integrationId: "asana",
      product: "conduitt",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      taskId: "task_123",
      projectId: "project_123",
      workspaceId: "workspace_123",
      text: "Close the books",
      data: {
        name: "Close checklist",
        workspace: "workspace_123",
      },
      options: { limit: 25, archived: false },
      followers: ["user_ada", "user_grace"],
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "asana",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("asana-access-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getAsanaProviderSdkReport();
    expect(report.operations).toBe(14);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(accessTokens).toEqual(Array(14).fill("asana-access-token"));
    expect(calls).toContainEqual(
      expect.objectContaining({ resource: "tasks", method: "createTask" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({
        resource: "stories",
        method: "createStoryForTask",
      }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({
        resource: "sections",
        method: "createSectionForProject",
      }),
    );
  });

  test("executes every pinned Dropbox action through the official SDK", async () => {
    const accessTokens: string[] = [];
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const adapter = createDropboxProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "dropbox-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        accessTokens.push(accessToken);
        return new Proxy(
          {},
          {
            get(_target, property) {
              return async (args: unknown) => {
                const method = String(property);
                calls.push({ method, args: [args] });
                return {
                  result:
                    method === "filesDownload"
                      ? {
                          name: "close.txt",
                          fileBinary: Buffer.from("close complete"),
                        }
                      : { method, args },
                };
              };
            },
          },
        );
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "dropbox-connection",
      integrationId: "dropbox",
      product: "conduitt",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      path: "/finance/close.txt",
      destinationPath: "/finance/close-copy.txt",
      fromPath: "/finance/close.txt",
      toPath: "/finance/close-copy.txt",
      query: "close",
      rev: "revision_123",
      file: {
        name: "close.txt",
        type: "text/plain",
        base64: Buffer.from("close complete").toString("base64"),
      },
      options: { autorename: true, limit: 25 },
      settings: { requested_visibility: "public" },
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "dropbox",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("dropbox-access-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getDropboxProviderSdkReport();
    expect(report.operations).toBe(13);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(accessTokens).toEqual(Array(13).fill("dropbox-access-token"));
    expect(calls).toContainEqual(
      expect.objectContaining({ method: "filesUpload" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({
        method: "sharingCreateSharedLinkWithSettings",
      }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ method: "filesRestore" }),
    );
  });

  test("executes every pinned Mailgun action through the official SDK", async () => {
    const apiKeys: string[] = [];
    const apiUrls: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return { path, args };
      };
    const adapter = createMailgunProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "mailgun-api-key", fields: {} });
        },
      },
      apiUrl: "https://api.eu.mailgun.net",
      clientFactory: ((apiKey: string, apiUrl: string) => {
        apiKeys.push(apiKey);
        apiUrls.push(apiUrl);
        return {
          messages: {
            create: method("messages.create"),
            retrieveStoredEmail: method("messages.retrieveStoredEmail"),
          },
          events: { get: method("events.get") },
          lists: {
            create: method("lists.create"),
            get: method("lists.get"),
            members: { createMember: method("lists.members.createMember") },
          },
          domains: {
            list: method("domains.list"),
            get: method("domains.get"),
          },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "mailgun-connection",
      integrationId: "mailgun",
      product: "conduitt",
    });
    const input = {
      apiKey: "attacker-supplied-token",
      domain: "mg.example.test",
      messageKey: "storage-key",
      from: "Finance <finance@example.test>",
      to: "ada@example.test,grace@example.test",
      subject: "Close ready",
      text: "The close is ready.",
      html: "<p>The close is ready.</p>",
      cc: "controller@example.test",
      bcc: "audit@example.test",
      tags: "close,finance",
      event: "delivered",
      limit: 100,
      address: "newsletter@mg.example.test",
      listAddress: "newsletter@mg.example.test",
      name: "Finance newsletter",
      description: "Close updates",
      accessLevel: "members",
      vars: '{"team":"finance"}',
      subscribed: true,
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "mailgun",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("mailgun-api-key");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getMailgunProviderSdkReport();
    expect(report.operations).toBe(8);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(apiKeys).toEqual(Array(8).fill("mailgun-api-key"));
    expect(apiUrls).toEqual(Array(8).fill("https://api.eu.mailgun.net"));
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "messages.create" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "lists.members.createMember" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "domains.get" }),
    );
  });

  test("executes every pinned Intercom action through the official Intercom SDK", async () => {
    const apiKeys: string[] = [];
    const calls: Array<{
      resource: string;
      method: string;
      args: unknown[];
    }> = [];
    const clientFactory = (apiKey: string) => {
      apiKeys.push(apiKey);
      return new Proxy(
        {},
        {
          get(_target, resource) {
            if (resource === "then") return undefined;
            return new Proxy(
              {},
              {
                get(_resourceTarget, method) {
                  if (method === "then") return undefined;
                  return async (...args: unknown[]) => {
                    calls.push({
                      resource: String(resource),
                      method: String(method),
                      args,
                    });
                    return { resource, method, args };
                  };
                },
              },
            );
          },
        },
      );
    };
    const adapter = createIntercomProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "intercom-access-token", fields: {} });
        },
      },
      clientFactory: clientFactory as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "intercom-connection",
      integrationId: "intercom",
      product: "conduitt",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      contactId: "contact_123",
      companyId: "company_123",
      conversationId: "conversation_123",
      ticketId: "ticket_123",
      tagId: "tag_123",
      admin_id: "admin_123",
      assignee_id: "admin_456",
      role: "lead",
      email: "ada@example.test",
      external_id: "ada-001",
      phone: "+15551234567",
      avatar: "https://example.test/ada.png",
      signed_up_at: 1_700_000_000,
      last_seen_at: 1_700_000_001,
      owner_id: "admin_123",
      unsubscribed_from_emails: false,
      company_id: "company-external-123",
      website: "https://example.test",
      plan: "enterprise",
      size: 120,
      industry: "software",
      monthly_spend: 5000,
      remote_created_at: 1_700_000_002,
      custom_attributes: '{"plan":"enterprise"}',
      per_page: 20,
      page: 1,
      starting_after: "next-page",
      order: "desc",
      display_as: "plaintext",
      include_translations: true,
      message_type: "email",
      body: "The finance close is ready.",
      attachment_urls: "https://example.test/close.pdf",
      created_at: 1_700_000_003,
      query: '{"field":"email","operator":"=","value":"ada@example.test"}',
      ticket_type_id: "ticket-type-123",
      contacts: '[{"id":"contact_123"}]',
      ticket_attributes: '{"_default_title_":"Close"}',
      conversation_to_link_id: "conversation_123",
      disable_notifications: true,
      open: true,
      is_shared: false,
      snoozed_until: 1_700_003_600,
      template: "plain",
      subject: "Close ready",
      from_type: "admin",
      from_id: "admin_123",
      to_type: "lead",
      to_id: "contact_123",
      name: "close-ready",
      id: "event-or-tag-123",
      event_name: "close_ready",
      user_id: "contact_123",
      metadata: '{"source":"workflow"}',
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "intercom",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("intercom-access-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getIntercomProviderSdkReport();
    expect(report.operations).toBe(31);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(apiKeys).toEqual(Array(31).fill("intercom-access-token"));
    expect(calls).toContainEqual(
      expect.objectContaining({
        resource: "companies",
        method: "createOrUpdate",
      }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ resource: "conversations", method: "reply" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ resource: "tickets", method: "update" }),
    );
  });

  test("executes every pinned Linear operation through its package-owned TypeScript SDK", async () => {
    const tokens: string[] = [];
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const resource = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === "then") {
            return undefined;
          }
          return (...args: unknown[]) => {
            calls.push({ method: String(property), args });
            return Promise.resolve({
              method: String(property),
              args,
              nodes: [],
            });
          };
        },
      },
    );
    const adapter = createLinearProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "linear-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        tokens.push(accessToken);
        return new Proxy(
          {
            viewer: Promise.resolve({ id: "viewer-1" }),
            client: {
              async rawRequest(
                query: string,
                variables?: Record<string, unknown>,
              ) {
                calls.push({ method: "rawRequest", args: [query, variables] });
                return { data: { success: true } };
              },
            },
          },
          {
            get(target, property, receiver) {
              if (Reflect.has(target, property)) {
                return Reflect.get(target, property, receiver);
              }
              return (...args: unknown[]) => {
                calls.push({ method: String(property), args });
                if (
                  property === "issue" ||
                  property === "project" ||
                  property === "team"
                ) {
                  return Promise.resolve(resource);
                }
                return Promise.resolve({
                  method: String(property),
                  args,
                  nodes: [],
                });
              };
            },
          },
        );
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "linear-connection",
      integrationId: "linear",
      product: "conduitt",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      after: "cursor-1",
      attachmentId: "attachment-1",
      body: "Status update",
      color: "#5E6AD2",
      commentId: "comment-1",
      customerId: "customer-1",
      customerNeedId: "need-1",
      cycleId: "cycle-1",
      endsAt: "2026-08-31T00:00:00.000Z",
      file: { url: "https://files.example.test/attachment" },
      first: 10,
      issueId: "issue-1",
      labelId: "label-1",
      milestoneId: "milestone-1",
      name: "Integration work",
      notificationId: "notification-1",
      position: 1,
      priority: 1,
      projectId: "project-1",
      query: "integration",
      relatedIssueId: "issue-2",
      relationId: "relation-1",
      sourceCustomerId: "customer-1",
      startsAt: "2026-08-01T00:00:00.000Z",
      stateId: "state-1",
      statusId: "status-1",
      targetCustomerId: "customer-2",
      targetDate: "2026-08-31",
      teamId: "team-1",
      tierId: "tier-1",
      title: "Integration work",
      type: "started",
      url: "https://files.example.test/attachment",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "linear",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("linear-access-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getLinearProviderSdkReport();
    expect(report.operations).toBe(78);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(tokens).toHaveLength(report.operations);
    expect(calls.some((call) => call.method === "createIssue")).toBeTrue();
    expect(calls.some((call) => call.method === "issueAddLabel")).toBeTrue();
    expect(calls.some((call) => call.method === "rawRequest")).toBeTrue();
  });

  test("does not let a Linear operation use another provider connection", async () => {
    const adapter = createLinearProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "linear",
        operationId: "linear:create-issue",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "slack",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });
  test("executes every pinned Mailchimp operation through its package-owned Marketing API client", async () => {
    const keys: string[] = [];
    const calls: Array<{
      resource: string;
      method: string;
      args: unknown[];
    }> = [];
    const adapter = createMailchimpProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "mailchimp-key-us19", fields: {} });
        },
      },
      clientFactory: ((apiKey: string) => {
        keys.push(apiKey);
        return new Proxy(
          {},
          {
            get(_target, resource) {
              if (resource === "setConfig") {
                return () => undefined;
              }
              return new Proxy(
                {},
                {
                  get(_resourceTarget, method) {
                    return (...args: unknown[]) => {
                      calls.push({
                        resource: String(resource),
                        method: String(method),
                        args,
                      });
                      return Promise.resolve({ resource, method, args });
                    };
                  },
                },
              );
            },
          },
        );
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "mailchimp-connection",
      integrationId: "mailchimp",
      product: "eigenn",
    });
    const input = {
      apiKey: "attacker-supplied-key",
      audienceName: "Product updates",
      batchId: "batch-1",
      campaignDefaults: { from_email: "operator@example.test" },
      campaignId: "campaign-1",
      campaignSettings: { subject_line: "Product update" },
      campaignType: "regular",
      contact: { company: "Oppulence" },
      count: 10,
      emailAddress: "operator@example.test",
      emailTypeOption: true,
      html: "<p>Update</p>",
      interestCategoryId: "category-1",
      interestCategoryTitle: "Industry",
      interestCategoryType: "checkboxes",
      interestId: "interest-1",
      interestName: "Technology",
      interests: { "interest-1": true },
      landingPageId: "landing-page-1",
      landingPageTitle: "Product updates",
      landingPageType: "subscribe",
      listId: "list-1",
      mergeFields: { FNAME: "Ada" },
      mergeId: "merge-1",
      mergeName: "First name",
      mergeType: "text",
      operations: [],
      pageId: "landing-page-1",
      permissionReminder: "You signed up for updates",
      plainText: "Update",
      recipients: { list_id: "list-1" },
      scheduleTime: "2026-08-15T15:00:00+00:00",
      segmentId: "segment-1",
      segmentName: "Recent customers",
      segmentOptions: { match: "all", conditions: [] },
      status: "subscribed",
      statusIfNew: "subscribed",
      subscriberEmail: "subscriber-hash",
      tags: ["product"],
      templateHtml: "<p>Template</p>",
      templateId: "template-1",
      templateName: "Product update",
      workflowEmailId: "workflow-email-1",
      workflowId: "workflow-1",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "mailchimp",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("mailchimp-key-us19");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-key");
    }

    const report = getMailchimpProviderSdkReport();
    expect(report.operations).toBe(73);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(keys).toHaveLength(report.operations);
    expect(calls).toContainEqual(
      expect.objectContaining({ resource: "campaigns", method: "send" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ resource: "lists", method: "setListMember" }),
    );
  });

  test("does not let a Mailchimp operation use another provider connection", async () => {
    const adapter = createMailchimpProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "must-not-be-used-us1", fields: {} });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "mailchimp",
        operationId: "mailchimp:get-audiences",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every Vercel action exposed by the package-owned SDK adapter", async () => {
    const keys: string[] = [];
    const calls: Array<{
      resource: string;
      method: string;
      args: unknown[];
    }> = [];
    const adapter = createVercelProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "vercel-api-key", fields: {} });
        },
      },
      clientFactory: ((apiKey: string) => {
        keys.push(apiKey);
        return new Proxy(
          {},
          {
            get(_target, resource) {
              return new Proxy(
                {},
                {
                  get(_resourceTarget, method) {
                    return (...args: unknown[]) => {
                      calls.push({
                        resource: String(resource),
                        method: String(method),
                        args,
                      });
                      return Promise.resolve({ resource, method, args });
                    };
                  },
                },
              );
            },
          },
        );
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "vercel-connection",
      integrationId: "vercel",
      product: "conduitt",
    });
    const input = {
      apiKey: "attacker-supplied-key",
      aliasDeploymentId: "deployment-1",
      aliasId: "alias-1",
      aliasName: "app.example.test",
      aliasRedirect: "www.example.test",
      checkAutoUpdate: "true",
      checkBlocking: "true",
      checkConclusion: "succeeded",
      checkDeploymentId: "deployment-1",
      checkDetailsUrl: "https://checks.example.test/1",
      checkExternalId: "external-check-1",
      checkId: "check-1",
      checkName: "Smoke test",
      checkOutput: '{"summary":"passed"}',
      checkPath: "/health",
      checkRerequestable: "true",
      checkStatus: "completed",
      deploymentForceNew: "1",
      deploymentGitSource: '{"type":"github","repo":"owner/repo","ref":"main"}',
      deploymentId: "deployment-1",
      deploymentsApp: "web",
      deploymentsLimit: 10,
      deploymentsProjectId: "project-1",
      deploymentsSince: 1,
      deploymentsUntil: 2,
      dnsRecordsLimit: "10",
      domainName: "example.test",
      edgeConfigId: "edge-1",
      edgeConfigItems: '[{"operation":"upsert","key":"theme","value":"dark"}]',
      edgeConfigSlug: "settings",
      envComment: "production database",
      envGitBranch: "main",
      envId: "env-1",
      envKey: "DATABASE_URL",
      envTarget: "production,preview",
      envType: "encrypted",
      envValue: "postgres://database.example.test/app",
      envVarsDecrypt: "true",
      envVarsGitBranch: "main",
      eventsDirection: "forward",
      eventsFollow: "1",
      eventsLimit: "10",
      eventsSince: "1",
      eventsUntil: "2",
      framework: "nextjs",
      name: "web",
      nodeVersion: "22.x",
      projectDomainsLimit: 10,
      projectId: "project-1",
      projectName: "web",
      recordComment: "managed by workflow",
      recordId: "record-1",
      recordName: "www",
      recordType: "A",
      recordValue: "192.0.2.1",
      redeployId: "deployment-0",
      search: "web",
      state: "READY",
      target: "production",
      teamId: "team-1",
      teamIdParam: "team-1",
      teamMembersLimit: 10,
      teamMembersSearch: "Ada",
      teamSlug: "engineering",
      teamsLimit: 10,
      teamsSince: 1,
      teamsUntil: 2,
      updateDomainGitBranch: "main",
      updateDomainRedirect: "www.example.test",
      updateDomainRedirectStatusCode: "308",
      updateProjectName: "web-renamed",
      updateRecordComment: "updated by workflow",
      updateRecordName: "api",
      updateRecordType: "CNAME",
      updateRecordValue: "cname.vercel-dns.test",
      webhookEvents: "deployment.created,project.created",
      webhookId: "webhook-1",
      webhookProjectIds: "project-1,project-2",
      webhookUrl: "https://hooks.example.test/vercel",
      withGitRepoInfo: "true",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "vercel",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("vercel-api-key");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-key");
    }

    const report = getVercelProviderSdkReport();
    expect(report.operations).toBe(55);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(keys).toHaveLength(report.operations);
    expect(calls).toContainEqual(
      expect.objectContaining({
        resource: "deployments",
        method: "createDeployment",
      }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({
        resource: "globalConfig",
        method: "getEdgeConfigItems",
      }),
    );
    await expect(
      adapter.execute({
        integrationId: "vercel",
        operationId: "vercel:update-edge-config-items",
        reference,
        input,
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    });
  });

  test("does not let a Vercel operation use another provider connection", async () => {
    const adapter = createVercelProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "must-not-be-used", fields: {} });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "vercel",
        operationId: "vercel:list-projects",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned Square operation through Square's official Node.js SDK", async () => {
    const keys: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return { path, args, bigint: 1n };
      };
    const adapter = createSquareProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "square-api-key", fields: {} });
        },
      },
      clientFactory: ((apiKey: string) => {
        keys.push(apiKey);
        return {
          payments: {
            create: method("payments.create"),
            get: method("payments.get"),
            list: method("payments.list"),
            cancel: method("payments.cancel"),
            complete: method("payments.complete"),
          },
          refunds: {
            refundPayment: method("refunds.refundPayment"),
            get: method("refunds.get"),
            list: method("refunds.list"),
          },
          customers: {
            create: method("customers.create"),
            get: method("customers.get"),
            list: method("customers.list"),
            search: method("customers.search"),
            update: method("customers.update"),
            delete: method("customers.delete"),
          },
          locations: {
            list: method("locations.list"),
            get: method("locations.get"),
          },
          orders: {
            create: method("orders.create"),
            get: method("orders.get"),
            search: method("orders.search"),
            pay: method("orders.pay"),
          },
          invoices: {
            create: method("invoices.create"),
            get: method("invoices.get"),
            list: method("invoices.list"),
            search: method("invoices.search"),
            publish: method("invoices.publish"),
            cancel: method("invoices.cancel"),
            delete: method("invoices.delete"),
          },
          catalog: {
            object: {
              upsert: method("catalog.object.upsert"),
              get: method("catalog.object.get"),
              delete: method("catalog.object.delete"),
            },
            list: method("catalog.list"),
            search: method("catalog.search"),
            images: { create: method("catalog.images.create") },
          },
          inventory: { batchGetCounts: method("inventory.batchGetCounts") },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "square-connection",
      integrationId: "square",
      product: "conduitt",
    });
    const input = {
      apiKey: "attacker-supplied-key",
      sourceId: "source-1",
      paymentId: "payment-1",
      refundId: "refund-1",
      amount: 100,
      currency: "USD",
      customerId: "customer-1",
      locationId: "location-1",
      orderId: "order-1",
      orderVersion: 1,
      paymentIds: ["payment-1"],
      locationIds: ["location-1"],
      invoiceId: "invoice-1",
      version: 1,
      order: { locationId: "location-1", lineItems: [] },
      invoice: { locationId: "location-1", orderId: "order-1" },
      object: { type: "ITEM", id: "#item" },
      objectId: "item-1",
      objectTypes: ["ITEM"],
      catalogObjectIds: ["item-1"],
      states: ["IN_STOCK"],
      file: new Blob(["square-catalog-image"], { type: "image/png" }),
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "square",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("square-api-key");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-key");
    }

    const report = getSquareProviderSdkReport();
    expect(report.operations).toBe(34);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(keys).toHaveLength(report.operations);
    expect(calls).toHaveLength(report.operations);
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "catalog.images.create" }),
    );
    const createPayment = calls.find((call) => call.path === "payments.create");
    expect(createPayment?.args[0]).toMatchObject({
      amountMoney: { amount: 100n, currency: "USD" },
    });
  });

  test("does not let a Square operation use another provider connection", async () => {
    const adapter = createSquareProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "must-not-be-used", fields: {} });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "square",
        operationId: "square:list-locations",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned Google Calendar operation through Google's Node.js SDK", async () => {
    const tokens: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        if (path === "events.get") {
          return {
            data: {
              id: "event-1",
              attendees: [{ email: "ada@example.test" }],
            },
          };
        }
        if (path === "events.quickAdd") return { data: { id: "event-2" } };
        return { data: { path, args } };
      };
    const adapter = createGoogleCalendarProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "google-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        tokens.push(accessToken);
        return {
          events: {
            insert: method("events.insert"),
            list: method("events.list"),
            get: method("events.get"),
            patch: method("events.patch"),
            delete: method("events.delete"),
            move: method("events.move"),
            instances: method("events.instances"),
            quickAdd: method("events.quickAdd"),
          },
          calendarList: { list: method("calendarList.list") },
          freebusy: { query: method("freebusy.query") },
          calendars: {
            insert: method("calendars.insert"),
            patch: method("calendars.patch"),
            delete: method("calendars.delete"),
          },
          acl: {
            insert: method("acl.insert"),
            patch: method("acl.patch"),
            list: method("acl.list"),
            delete: method("acl.delete"),
          },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "google-calendar-connection",
      integrationId: "google-calendar",
      product: "eigenn",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      calendarId: "primary",
      eventId: "event-1",
      destinationCalendarId: "destination-calendar",
      summary: "Planning",
      description: "Quarterly planning",
      location: "New York",
      startDateTime: "2026-08-01T09:00:00-04:00",
      endDateTime: "2026-08-01T10:00:00-04:00",
      timeMin: "2026-08-01T00:00:00-04:00",
      timeMax: "2026-08-02T00:00:00-04:00",
      timeZone: "America/New_York",
      attendees: ["new@example.test"],
      recurrence: "RRULE:FREQ=WEEKLY",
      addGoogleMeet: true,
      sendUpdates: "all",
      text: "Lunch with Ada tomorrow at noon",
      calendarIds: "primary,team-calendar",
      minAccessRole: "reader",
      maxResults: 10,
      pageToken: "page-1",
      q: "planning",
      scopeType: "user",
      scopeValue: "ada@example.test",
      role: "writer",
      ruleId: "rule-1",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "google-calendar",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("google-access-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getGoogleCalendarProviderSdkReport();
    expect(report.operations).toBe(18);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(tokens).toHaveLength(report.operations);
    expect(calls).toHaveLength(report.operations + 2);
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "freebusy.query" }),
    );
    expect(calls.filter((call) => call.path === "events.patch")).toHaveLength(
      3,
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "calendarList.list" }),
    );
  });

  test("does not let a Google Calendar operation use another provider connection", async () => {
    const adapter = createGoogleCalendarProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "google-calendar",
        operationId: "google-calendar:list-calendars",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned Google Drive operation through Google's Node.js SDK", async () => {
    const tokens: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        const request = args[0] as Record<string, unknown> | undefined;
        if (path === "files.get" && request?.fields === "parents") {
          return { data: { parents: ["source-folder"] } };
        }
        if (request?.responseType === "arraybuffer") {
          return { data: new TextEncoder().encode("file content") };
        }
        return { data: { path, args } };
      };
    const adapter = createGoogleDriveProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "google-drive-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        tokens.push(accessToken);
        return {
          files: {
            list: method("files.list"),
            get: method("files.get"),
            create: method("files.create"),
            copy: method("files.copy"),
            update: method("files.update"),
            delete: method("files.delete"),
            export: method("files.export"),
          },
          permissions: {
            create: method("permissions.create"),
            delete: method("permissions.delete"),
            list: method("permissions.list"),
          },
          revisions: {
            list: method("revisions.list"),
            get: method("revisions.get"),
          },
          comments: {
            list: method("comments.list"),
            create: method("comments.create"),
            delete: method("comments.delete"),
          },
          about: { get: method("about.get") },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "google-drive-connection",
      integrationId: "google-drive",
      product: "conduitt",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      fileId: "file-1",
      fileName: "notes.txt",
      content: "meeting notes",
      mimeType: "text/plain",
      folderId: "folder-1",
      folderSelector: "folder-1",
      destinationFolderId: "folder-2",
      newName: "copied-notes.txt",
      name: "renamed-notes.txt",
      description: "updated notes",
      query: "notes",
      pageSize: 10,
      pageToken: "page-1",
      addParents: "folder-3",
      removeParents: "folder-4",
      type: "user",
      role: "writer",
      email: "ada@example.test",
      permissionId: "permission-1",
      revisionId: "revision-1",
      commentId: "comment-1",
      anchor: "anchor-1",
      includeDeleted: false,
      startModifiedTime: "2026-08-01T00:00:00Z",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "google-drive",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("google-drive-access-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getGoogleDriveProviderSdkReport();
    expect(report.operations).toBe(24);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(tokens).toHaveLength(report.operations);
    expect(calls).toHaveLength(report.operations + 1);
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "permissions.create" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "revisions.get" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "about.get" }),
    );
  });

  test("does not let a Google Drive operation use another provider connection", async () => {
    const adapter = createGoogleDriveProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "google-drive",
        operationId: "google-drive:get-drive-info",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned Google Sheets operation through Google's Node.js SDK", async () => {
    const tokens: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return { data: { path, args } };
      };
    const adapter = createGoogleSheetsProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "google-sheets-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        tokens.push(accessToken);
        return {
          sheets: {
            spreadsheets: {
              values: {
                get: method("spreadsheets.values.get"),
                update: method("spreadsheets.values.update"),
                append: method("spreadsheets.values.append"),
                clear: method("spreadsheets.values.clear"),
                batchGet: method("spreadsheets.values.batchGet"),
                batchUpdate: method("spreadsheets.values.batchUpdate"),
                batchClear: method("spreadsheets.values.batchClear"),
              },
              get: method("spreadsheets.get"),
              create: method("spreadsheets.create"),
              batchUpdate: method("spreadsheets.batchUpdate"),
              sheets: { copyTo: method("spreadsheets.sheets.copyTo") },
            },
          },
          drive: { files: { delete: method("drive.files.delete") } },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "google-sheets-connection",
      integrationId: "google-sheets",
      product: "eigenn",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      spreadsheetId: "spreadsheet-1",
      sourceSpreadsheetId: "spreadsheet-source",
      destinationSpreadsheetId: "spreadsheet-destination",
      range: "Sheet1!A1:B2",
      ranges: ["Sheet1!A1:B2"],
      values: [
        ["name", "amount"],
        ["Ada", 5],
      ],
      data: [{ range: "Sheet1!A1", values: [["Ada"]] }],
      valueInputOption: "USER_ENTERED",
      sheetId: 1,
      startIndex: 1,
      endIndex: 2,
      title: "Planning",
      sheetTitles: ["Sheet1"],
      locale: "en_US",
      timeZone: "America/New_York",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "google-sheets",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain(
        "google-sheets-access-token",
      );
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getGoogleSheetsProviderSdkReport();
    expect(report.operations).toBe(14);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(tokens).toHaveLength(report.operations);
    expect(calls).toHaveLength(report.operations);
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "spreadsheets.values.batchUpdate" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "spreadsheets.sheets.copyTo" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "drive.files.delete" }),
    );
  });

  test("does not let a Google Sheets operation use another provider connection", async () => {
    const adapter = createGoogleSheetsProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "google-sheets",
        operationId: "google-sheets:get-spreadsheet-info",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned Google Docs operation through Google's Node.js SDK", async () => {
    const tokens: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return path === "drive.files.create"
          ? { data: { id: "document-1" } }
          : { data: { path, args } };
      };
    const adapter = createGoogleDocsProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "google-docs-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        tokens.push(accessToken);
        return {
          docs: {
            documents: {
              get: method("documents.get"),
              batchUpdate: method("documents.batchUpdate"),
            },
          },
          drive: { files: { create: method("drive.files.create") } },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "google-docs-connection",
      integrationId: "google-docs",
      product: "conduitt",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      documentId: "document-1",
      title: "Planning",
      content: "Initial plan",
      text: "Inserted text",
      index: 1,
      searchText: "Initial",
      replaceText: "Updated",
      startIndex: 1,
      endIndex: 2,
      rows: 2,
      columns: 3,
      imageUrl: "https://images.example.test/chart.png",
      bold: true,
      namedStyleType: "HEADING_1",
      bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
      name: "quarterly-plan",
      namedRangeId: "named-range-1",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "google-docs",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("google-docs-access-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getGoogleDocsProviderSdkReport();
    expect(report.operations).toBe(15);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(tokens).toHaveLength(report.operations);
    expect(calls).toHaveLength(report.operations + 1);
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "drive.files.create" }),
    );
    expect(
      calls.filter((call) => call.path === "documents.batchUpdate"),
    ).toHaveLength(14);
  });

  test("does not let a Google Docs operation use another provider connection", async () => {
    const adapter = createGoogleDocsProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "google-docs",
        operationId: "google-docs:read-document",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned Google Slides action through Google's Node.js SDK", async () => {
    const tokens: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return { data: { path, args } };
      };
    const adapter = createGoogleSlidesProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "google-slides-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        tokens.push(accessToken);
        return {
          slides: {
            presentations: {
              get: method("slides.presentations.get"),
              create: method("slides.presentations.create"),
              batchUpdate: method("slides.presentations.batchUpdate"),
              pages: {
                getThumbnail: method("slides.presentations.pages.getThumbnail"),
                get: method("slides.presentations.pages.get"),
              },
            },
          },
          drive: {
            files: {
              copy: method("drive.files.copy"),
              export: method("drive.files.export"),
            },
          },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "google-slides-connection",
      integrationId: "google-slides",
      product: "eigenn",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      presentationId: "presentation-1",
      sourcePresentationId: "template-1",
      title: "Board update",
      pageObjectId: "slide-1",
      mimeType: "application/pdf",
      request: { objectId: "shape-1" },
      requests: [{ deleteObject: { objectId: "shape-1" } }],
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "google-slides",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("google-slides-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getGoogleSlidesProviderSdkReport();
    expect(report.operations).toBe(52);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(tokens).toEqual(Array(52).fill("google-slides-token"));
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "slides.presentations.get" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "slides.presentations.batchUpdate" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "drive.files.export" }),
    );
  });

  test("does not let a Google Slides operation use another provider connection", async () => {
    const adapter = createGoogleSlidesProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "google-slides",
        operationId: "google-slides:read-presentation",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("persists bounded Google Slides exports through the product file seam", async () => {
    const exports: Array<{
      bytes: number[];
      mimeType: string;
      presentationId: string;
    }> = [];
    const adapter = createGoogleSlidesProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "google-slides-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: (() => ({
        drive: {
          files: {
            export: async () => ({ data: new Uint8Array([1, 2, 3]) }),
          },
        },
      })) as never,
      async exportSink(input) {
        exports.push({
          bytes: Array.from(input.bytes),
          mimeType: input.mimeType,
          presentationId: input.presentationId,
        });
        return { fileId: "export-file-1" };
      },
    });

    await expect(
      adapter.execute({
        integrationId: "google-slides",
        operationId: "google-slides:export-presentation",
        reference: createIntegrationCredentialReference({
          connectionId: "google-slides-export",
          integrationId: "google-slides",
          product: "eigenn",
        }),
        input: {
          presentationId: "presentation-1",
          mimeType: "application/pdf",
        },
      }),
    ).resolves.toEqual({
      operationId: "google-slides:export-presentation",
      output: { fileId: "export-file-1" },
    });
    expect(exports).toEqual([
      {
        bytes: [1, 2, 3],
        mimeType: "application/pdf",
        presentationId: "presentation-1",
      },
    ]);
  });

  test("executes every pinned Gmail action through Google's Node.js SDK", async () => {
    const tokens: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return { data: { path, args } };
      };
    const adapter = createGmailProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "gmail-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        tokens.push(accessToken);
        return {
          gmail: {
            users: {
              messages: {
                send: method("gmail.users.messages.send"),
                get: method("gmail.users.messages.get"),
                list: method("gmail.users.messages.list"),
                modify: method("gmail.users.messages.modify"),
                trash: method("gmail.users.messages.trash"),
              },
              drafts: {
                create: method("gmail.users.drafts.create"),
                update: method("gmail.users.drafts.update"),
              },
            },
          },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "gmail-connection",
      integrationId: "gmail",
      product: "eigenn",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      to: "recipient@example.test",
      subject: "Monthly close",
      body: "The attachment is ready.",
      contentType: "text",
      messageId: "message-1",
      draftId: "draft-1",
      query: "from:finance@example.test",
      maxResults: 25,
      addLabelIds: "INBOX,Label_1",
      removeLabelIds: "SPAM",
      labelIds: "Label_2,Label_3",
      attachments: [
        {
          filename: "close.txt",
          mimeType: "text/plain",
          data: Buffer.from("ready", "utf8").toString("base64"),
        },
      ],
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "gmail",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("gmail-access-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getGmailProviderSdkReport();
    expect(report.operations).toBe(13);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(tokens).toEqual(Array(13).fill("gmail-access-token"));
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "gmail.users.messages.send" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "gmail.users.messages.modify" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "gmail.users.drafts.update" }),
    );
    const sent = calls.find(
      (call) => call.path === "gmail.users.messages.send",
    );
    const sentRequest = sent?.args.at(0) as {
      requestBody: { raw: string };
    };
    expect(
      Buffer.from(sentRequest.requestBody.raw, "base64url").toString("utf8"),
    ).toContain("Content-Disposition: attachment");
  });

  test("does not let a Gmail operation use another provider connection", async () => {
    const adapter = createGmailProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "gmail",
        operationId: "gmail:read-email",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("preserves Gmail reply threading and bounded read attachments inside the SDK adapter", async () => {
    const sends: Array<Record<string, unknown>> = [];
    const get = async (request: Record<string, unknown>) => {
      if (request.format === "metadata") {
        return {
          data: {
            threadId: "thread-1",
            payload: {
              headers: [
                { name: "Message-ID", value: "<original@example.test>" },
                { name: "References", value: "<earlier@example.test>" },
              ],
            },
          },
        };
      }
      return {
        data: {
          id: request.id,
          threadId: "thread-1",
          labelIds: ["INBOX"],
          payload: {
            headers: [
              { name: "From", value: "sender@example.test" },
              { name: "To", value: "recipient@example.test" },
              { name: "Subject", value: "Monthly close" },
              { name: "Date", value: "Fri, 31 Jul 2026 09:00:00 -0400" },
            ],
            parts: [
              {
                mimeType: "text/plain",
                body: {
                  data: Buffer.from("The report is ready.", "utf8").toString(
                    "base64url",
                  ),
                },
              },
              {
                filename: "close.txt",
                mimeType: "text/plain",
                body: { attachmentId: "attachment-1", size: 6 },
              },
            ],
          },
        },
      };
    };
    const adapter = createGmailProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "gmail-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: (() => ({
        gmail: {
          users: {
            messages: {
              async send(request: Record<string, unknown>) {
                sends.push(request);
                return { data: { id: "sent-1", threadId: "thread-1" } };
              },
              get,
              async list() {
                return { data: { messages: [{ id: "message-1" }] } };
              },
              attachments: {
                async get() {
                  return {
                    data: {
                      data: Buffer.from("ready\n", "utf8").toString(
                        "base64url",
                      ),
                    },
                  };
                },
              },
            },
          },
        },
      })) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "gmail-threading",
      integrationId: "gmail",
      product: "conduitt",
    });

    await adapter.execute({
      integrationId: "gmail",
      operationId: "gmail:send-email",
      reference,
      input: {
        to: "recipient@example.test",
        subject: "Re: Monthly close",
        body: "Thanks.",
        replyToMessageId: "message-1",
      },
    });
    const sent = sends.at(0) as {
      requestBody: { raw: string; threadId: string };
    };
    const raw = Buffer.from(sent.requestBody.raw, "base64url").toString("utf8");
    expect(sent.requestBody.threadId).toBe("thread-1");
    expect(raw).toContain("In-Reply-To: <original@example.test>");
    expect(raw).toContain(
      "References: <earlier@example.test> <original@example.test>",
    );

    await expect(
      adapter.execute({
        integrationId: "gmail",
        operationId: "gmail:read-email",
        reference,
        input: { messageId: "message-1", includeAttachments: true },
      }),
    ).resolves.toEqual({
      operationId: "gmail:read-email",
      output: {
        id: "message-1",
        threadId: "thread-1",
        labelIds: ["INBOX"],
        from: "sender@example.test",
        to: "recipient@example.test",
        subject: "Monthly close",
        date: "Fri, 31 Jul 2026 09:00:00 -0400",
        body: "The report is ready.",
        hasAttachments: true,
        attachmentCount: 1,
        attachments: [
          {
            name: "close.txt",
            data: Buffer.from("ready\n", "utf8").toString("base64"),
            mimeType: "text/plain",
            size: 6,
          },
        ],
      },
    });
  });

  test("executes every pinned Google Forms action through Google's Node.js SDK", async () => {
    const tokens: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return { data: { path, args } };
      };
    const adapter = createGoogleFormsProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "google-forms-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        tokens.push(accessToken);
        return {
          forms: {
            forms: {
              get: method("forms.get"),
              create: method("forms.create"),
              batchUpdate: method("forms.batchUpdate"),
              setPublishSettings: method("forms.setPublishSettings"),
              responses: {
                get: method("forms.responses.get"),
                list: method("forms.responses.list"),
              },
              watches: {
                create: method("forms.watches.create"),
                list: method("forms.watches.list"),
                delete: method("forms.watches.delete"),
                renew: method("forms.watches.renew"),
              },
            },
          },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "google-forms-connection",
      integrationId: "google-forms",
      product: "eigenn",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      formId: "form-1",
      responseId: "response-1",
      pageSize: 10,
      pageToken: "page-token",
      filter: "timestamp > 2025-01-01T00:00:00Z",
      title: "Weekly cash review",
      documentTitle: "Cash review form",
      unpublished: true,
      requests: [
        {
          updateFormInfo: {
            info: { title: "Updated weekly cash review" },
            updateMask: "title",
          },
        },
      ],
      includeFormInResponse: true,
      isPublished: true,
      isAcceptingResponses: true,
      eventType: "RESPONSES",
      topicName: "projects/project-1/topics/google-forms",
      watchId: "watch-1",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "google-forms",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("google-forms-access-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    await adapter.execute({
      integrationId: "google-forms",
      operationId: "google-forms:get-responses",
      reference,
      input: { formId: "form-1", pageSize: 25 },
    });

    const report = getGoogleFormsProviderSdkReport();
    expect(report.operations).toBe(9);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(tokens).toHaveLength(report.operations + 1);
    expect(calls).toHaveLength(report.operations + 1);
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "forms.responses.get" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "forms.responses.list" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "forms.watches.renew" }),
    );
  });

  test("does not let a Google Forms operation use another provider connection", async () => {
    const adapter = createGoogleFormsProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "google-forms",
        operationId: "google-forms:get-form",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned Google Tasks action through Google's Node.js SDK", async () => {
    const tokens: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return { data: { path, args } };
      };
    const adapter = createGoogleTasksProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "google-tasks-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        tokens.push(accessToken);
        return {
          tasks: {
            tasks: {
              insert: method("tasks.insert"),
              list: method("tasks.list"),
              get: method("tasks.get"),
              update: method("tasks.update"),
              delete: method("tasks.delete"),
            },
            tasklists: { list: method("tasklists.list") },
          },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "google-tasks-connection",
      integrationId: "google-tasks",
      product: "conduitt",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      taskListId: "task-list-1",
      taskId: "task-1",
      title: "Review cash forecast",
      notes: "Review the forecast before the weekly cash meeting.",
      due: "2026-08-01T17:00:00.000Z",
      status: "needsAction",
      parent: "parent-task",
      previous: "previous-task",
      maxResults: 25,
      pageToken: "page-token",
      showCompleted: true,
      showDeleted: false,
      showHidden: false,
      dueMin: "2026-08-01T00:00:00.000Z",
      dueMax: "2026-08-31T23:59:59.000Z",
      completedMin: "2026-07-01T00:00:00.000Z",
      completedMax: "2026-07-31T23:59:59.000Z",
      updatedMin: "2026-07-01T00:00:00.000Z",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "google-tasks",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("google-tasks-access-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getGoogleTasksProviderSdkReport();
    expect(report.operations).toBe(6);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(tokens).toHaveLength(report.operations);
    expect(calls).toHaveLength(report.operations);
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "tasks.insert" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "tasklists.list" }),
    );
  });

  test("does not let a Google Tasks operation use another provider connection", async () => {
    const adapter = createGoogleTasksProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "google-tasks",
        operationId: "google-tasks:get-task",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned Google Contacts action through Google's Node.js SDK", async () => {
    const tokens: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return { data: { path, args } };
      };
    const adapter = createGoogleContactsProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "google-contacts-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        tokens.push(accessToken);
        return {
          people: {
            people: {
              createContact: method("people.createContact"),
              get: method("people.get"),
              searchContacts: method("people.searchContacts"),
              updateContact: method("people.updateContact"),
              deleteContact: method("people.deleteContact"),
              connections: { list: method("people.connections.list") },
            },
          },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "google-contacts-connection",
      integrationId: "google-contacts",
      product: "eigenn",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      resourceName: "people/contact-1",
      etag: "etag-1",
      givenName: "Ada",
      familyName: "Lovelace",
      email: "ada@example.test",
      emailType: "work",
      phone: "+15551234567",
      phoneType: "mobile",
      organization: "Oppulence",
      jobTitle: "Finance Lead",
      notes: "Owns the monthly close.",
      pageSize: 25,
      pageToken: "page-token",
      sortOrder: "LAST_MODIFIED_DESCENDING",
      query: "Ada",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "google-contacts",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain(
        "google-contacts-access-token",
      );
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getGoogleContactsProviderSdkReport();
    expect(report.operations).toBe(6);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(tokens).toHaveLength(report.operations);
    expect(calls).toHaveLength(report.operations);
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "people.createContact" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "people.connections.list" }),
    );
  });

  test("does not let a Google Contacts operation use another provider connection", async () => {
    const adapter = createGoogleContactsProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "google-contacts",
        operationId: "google-contacts:get-contact",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned Google Books action through Google's Node.js SDK", async () => {
    const apiKeys: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return { data: { path, args } };
      };
    const adapter = createGoogleBooksProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "google-books-api-key", fields: {} });
        },
      },
      clientFactory: ((apiKey: string) => {
        apiKeys.push(apiKey);
        return {
          books: {
            volumes: {
              list: method("books.volumes.list"),
              get: method("books.volumes.get"),
            },
          },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "google-books-connection",
      integrationId: "google-books",
      product: "eigenn",
    });
    const input = {
      apiKey: "attacker-supplied-key",
      query: "corporate finance",
      volumeId: "volume-1",
      filter: "ebooks",
      printType: "books",
      orderBy: "newest",
      startIndex: 0,
      maxResults: 10,
      langRestrict: "en",
      projection: "full",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "google-books",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("google-books-api-key");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-key");
    }

    const report = getGoogleBooksProviderSdkReport();
    expect(report.operations).toBe(2);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(apiKeys).toEqual(["google-books-api-key", "google-books-api-key"]);
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "books.volumes.list" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "books.volumes.get" }),
    );
  });

  test("does not let a Google Books operation use another provider connection", async () => {
    const adapter = createGoogleBooksProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "must-not-be-used", fields: {} });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "google-books",
        operationId: "google-books:get-volume-details",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned YouTube action through Google's Node.js SDK", async () => {
    const apiKeys: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return { data: { path, args } };
      };
    const adapter = createYouTubeProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "youtube-api-key", fields: {} });
        },
      },
      clientFactory: ((apiKey: string) => {
        apiKeys.push(apiKey);
        return {
          youtube: {
            search: { list: method("youtube.search.list") },
            videos: { list: method("youtube.videos.list") },
            videoCategories: { list: method("youtube.videoCategories.list") },
            channels: { list: method("youtube.channels.list") },
            playlists: { list: method("youtube.playlists.list") },
            playlistItems: { list: method("youtube.playlistItems.list") },
            commentThreads: { list: method("youtube.commentThreads.list") },
          },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "youtube-connection",
      integrationId: "youtube",
      product: "eigenn",
    });
    const input = {
      apiKey: "attacker-supplied-key",
      query: "corporate finance",
      videoId: "video-1",
      channelId: "channel-1",
      playlistId: "playlist-1",
      regionCode: "US",
      maxResults: 10,
      order: "date",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "youtube",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("youtube-api-key");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-key");
    }

    const report = getYouTubeProviderSdkReport();
    expect(report.operations).toBe(9);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(apiKeys).toEqual(Array(9).fill("youtube-api-key"));
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "youtube.search.list" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "youtube.videos.list" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "youtube.commentThreads.list" }),
    );
  });

  test("does not let a YouTube operation use another provider connection", async () => {
    const adapter = createYouTubeProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "must-not-be-used", fields: {} });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "youtube",
        operationId: "youtube:get-video-details",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned Resend action through its official Node.js SDK", async () => {
    const apiKeys: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return { data: { path, args } };
      };
    const adapter = createResendProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "resend-api-key", fields: {} });
        },
      },
      clientFactory: ((apiKey: string) => {
        apiKeys.push(apiKey);
        return {
          resend: {
            emails: {
              send: method("resend.emails.send"),
              get: method("resend.emails.get"),
              cancel: method("resend.emails.cancel"),
            },
            contacts: {
              create: method("resend.contacts.create"),
              list: method("resend.contacts.list"),
              get: method("resend.contacts.get"),
              update: method("resend.contacts.update"),
              remove: method("resend.contacts.remove"),
            },
            audiences: {
              create: method("resend.audiences.create"),
              get: method("resend.audiences.get"),
              list: method("resend.audiences.list"),
              remove: method("resend.audiences.remove"),
            },
            broadcasts: {
              create: method("resend.broadcasts.create"),
              send: method("resend.broadcasts.send"),
              get: method("resend.broadcasts.get"),
            },
            domains: { list: method("resend.domains.list") },
          },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "resend-connection",
      integrationId: "resend",
      product: "conduitt",
    });
    const input = {
      apiKey: "attacker-supplied-key",
      fromAddress: "billing@example.com",
      to: "customer@example.com",
      subject: "Your invoice",
      body: "Invoice details",
      contentType: "text",
      emailId: "email-1",
      cancelEmailId: "email-2",
      email: "customer@example.com",
      contactId: "contact-1",
      firstName: "Alex",
      lastName: "Morgan",
      audienceId: "audience-1",
      audienceName: "Customers",
      broadcastId: "broadcast-1",
      broadcastFrom: "billing@example.com",
      broadcastSubject: "Product update",
      broadcastText: "An update",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "resend",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("resend-api-key");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-key");
    }

    const report = getResendProviderSdkReport();
    expect(report.operations).toBe(16);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(apiKeys).toEqual(Array(16).fill("resend-api-key"));
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "resend.emails.send" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "resend.contacts.update" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "resend.broadcasts.create" }),
    );
  });

  test("does not let a Resend operation use another provider connection", async () => {
    const adapter = createResendProviderSdk({
      apiKeyRuntime: {
        async withCredential(_reference, operation) {
          return operation({ apiKey: "must-not-be-used", fields: {} });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "resend",
        operationId: "resend:get-email",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned Google Meet action through Google's Node.js SDK", async () => {
    const tokens: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return { data: { path, args } };
      };
    const adapter = createGoogleMeetProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "google-meet-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        tokens.push(accessToken);
        return {
          meet: {
            spaces: {
              create: method("spaces.create"),
              get: method("spaces.get"),
              endActiveConference: method("spaces.endActiveConference"),
            },
            conferenceRecords: {
              list: method("conferenceRecords.list"),
              get: method("conferenceRecords.get"),
              participants: {
                list: method("conferenceRecords.participants.list"),
              },
            },
          },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "google-meet-connection",
      integrationId: "google-meet",
      product: "conduitt",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      accessType: "TRUSTED",
      entryPointAccess: "ALL",
      spaceName: "spaces/space-1",
      conferenceName: "conferenceRecords/conference-1",
      filter: 'space.name = "spaces/space-1"',
      pageSize: 25,
      pageToken: "page-token",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "google-meet",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain("google-meet-access-token");
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getGoogleMeetProviderSdkReport();
    expect(report.operations).toBe(6);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(tokens).toHaveLength(report.operations);
    expect(calls).toHaveLength(report.operations);
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "spaces.endActiveConference" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "conferenceRecords.participants.list" }),
    );
  });

  test("does not let a Google Meet operation use another provider connection", async () => {
    const adapter = createGoogleMeetProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "google-meet",
        operationId: "google-meet:get-space",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });

  test("executes every pinned Google Groups action through Google's Node.js SDK", async () => {
    const tokens: string[] = [];
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const method =
      (path: string) =>
      async (...args: unknown[]) => {
        calls.push({ path, args });
        return { data: { path, args } };
      };
    const adapter = createGoogleGroupsProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "google-groups-access-token",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
      clientFactory: ((accessToken: string) => {
        tokens.push(accessToken);
        return {
          admin: {
            groups: {
              list: method("admin.groups.list"),
              get: method("admin.groups.get"),
              insert: method("admin.groups.insert"),
              patch: method("admin.groups.patch"),
              delete: method("admin.groups.delete"),
              aliases: {
                list: method("admin.groups.aliases.list"),
                insert: method("admin.groups.aliases.insert"),
                delete: method("admin.groups.aliases.delete"),
              },
            },
            members: {
              list: method("admin.members.list"),
              get: method("admin.members.get"),
              insert: method("admin.members.insert"),
              update: method("admin.members.update"),
              delete: method("admin.members.delete"),
              hasMember: method("admin.members.hasMember"),
            },
          },
          groupssettings: {
            groups: {
              get: method("groupssettings.groups.get"),
              update: method("groupssettings.groups.update"),
            },
          },
        };
      }) as never,
    });
    const reference = createIntegrationCredentialReference({
      connectionId: "google-groups-connection",
      integrationId: "google-groups",
      product: "eigenn",
    });
    const input = {
      accessToken: "attacker-supplied-token",
      groupKey: "finance@example.test",
      memberKey: "ada@example.test",
      groupEmail: "finance@example.test",
      customer: "my_customer",
      domain: "example.test",
      maxResults: 25,
      pageToken: "page-token",
      query: "email:finance*",
      roles: "MEMBER",
      email: "finance@example.test",
      name: "Finance",
      description: "Finance operations group",
      role: "MANAGER",
      alias: "finance-team@example.test",
      whoCanJoin: "INVITED_CAN_JOIN",
      allowExternalMembers: "false",
    };

    for (const operationId of adapter.operationIds) {
      const result = await adapter.execute({
        integrationId: "google-groups",
        operationId,
        reference,
        input,
      });
      expect(result.operationId).toBe(operationId);
      expect(JSON.stringify(result)).not.toContain(
        "google-groups-access-token",
      );
      expect(JSON.stringify(result)).not.toContain("attacker-supplied-token");
    }

    const report = getGoogleGroupsProviderSdkReport();
    expect(report.operations).toBe(16);
    expect(adapter.operationIds).toEqual(report.operationIds);
    expect(tokens).toHaveLength(report.operations);
    expect(calls).toHaveLength(report.operations);
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "admin.members.hasMember" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ path: "groupssettings.groups.update" }),
    );
  });

  test("does not let a Google Groups operation use another provider connection", async () => {
    const adapter = createGoogleGroupsProviderSdk({
      oauthRuntime: {
        async withCredential(_reference, operation) {
          return operation({
            accessToken: "must-not-be-used",
            scope: [],
            tokenType: "Bearer",
          });
        },
      },
    });

    await expect(
      adapter.execute({
        integrationId: "google-groups",
        operationId: "google-groups:get-group",
        reference: createIntegrationCredentialReference({
          connectionId: "wrong-provider",
          integrationId: "stripe",
          product: "eigenn",
        }),
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    });
  });
});

describe("server no-auth runtime", () => {
  test("owns the authorized no-auth connection and its shared request transport", async () => {
    const persistedConnectionIds: string[] = [];
    const requests: string[] = [];
    const runtime = createIntegrationNoAuthRuntime({
      providers: [
        {
          integrationId: "duckduckgo",
          apiBaseUrl: "https://provider.example.test/api",
        },
      ],
      async onConnected(input) {
        persistedConnectionIds.push(input.connectionId);
      },
      fetcher: (async (input: RequestInfo | URL) => {
        requests.push(input.toString());
        return Response.json({ ok: true });
      }) as typeof fetch,
    });

    const connected = await runtime.connect(
      {
        product: "eigenn",
        subjectId: "team-1",
        integrationId: "duckduckgo",
      },
      async () => {},
    );
    await runtime.request({
      integrationId: connected.integrationId,
      request: { path: "/search?q=runway" },
    });

    expect(persistedConnectionIds).toEqual([connected.connectionId]);
    expect(requests).toEqual([
      "https://provider.example.test/api/search?q=runway",
    ]);
  });

  test("mounts an authorization-gated no-auth confirmation route", async () => {
    const connected: string[] = [];
    const routes = createIntegrationNoAuthRoutes({
      providers: [
        {
          integrationId: "duckduckgo",
          apiBaseUrl: "https://provider.example.test/api",
        },
      ],
      async resolveSubject() {
        return { product: "conduitt", subjectId: "organization-1" };
      },
      async authorizeConnect(subject, integrationId) {
        expect(subject).toEqual({
          product: "conduitt",
          subjectId: "organization-1",
        });
        expect(integrationId).toBe("duckduckgo");
      },
      async onConnected(input) {
        connected.push(input.connectionId);
      },
    });

    const response = await routes.handle(
      new Request("https://app.example.test/integrations/duckduckgo/no-auth", {
        method: "POST",
      }),
    );
    expect(response?.status).toBe(200);
    expect(connected).toHaveLength(1);
  });
});

describe("server OAuth runtime", () => {
  test("ships Slack's V2 OAuth provider with comma-delimited bot scopes", () => {
    const provider = createOAuth2ProviderSdk(
      createSlackOAuth2Provider({
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri:
          "https://app.example.test/integrations/slack/oauth/callback",
      }),
    );
    const authorizationUrl = new URL(
      provider.createAuthorizationUrl({
        state: "state-value",
        codeChallenge: "challenge-value",
      }),
    );

    expect(authorizationUrl.origin).toBe("https://slack.com");
    expect(authorizationUrl.pathname).toBe("/oauth/v2/authorize");
    expect(authorizationUrl.searchParams.get("scope")).toContain(
      "chat:write,chat:write.public",
    );
    expect(provider.configuration.tokenEndpoint).toBe(
      "https://slack.com/api/oauth.v2.access",
    );
    expect(provider.configuration.clientAuthentication).toBe("body");
  });

  test("ships Airtable OAuth with SDK-required record and schema scopes", () => {
    const provider = createOAuth2ProviderSdk(
      createAirtableOAuth2Provider({
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri:
          "https://app.example.test/integrations/airtable/oauth/callback",
      }),
    );
    const authorizationUrl = new URL(
      provider.createAuthorizationUrl({
        state: "state-value",
        codeChallenge: "challenge-value",
      }),
    );

    expect(authorizationUrl.origin).toBe("https://airtable.com");
    expect(authorizationUrl.pathname).toBe("/oauth2/v1/authorize");
    expect(authorizationUrl.searchParams.get("scope")).toBe(
      "data.records:read data.records:write schema.bases:read",
    );
    expect(provider.configuration.tokenEndpoint).toBe(
      "https://airtable.com/oauth2/v1/token",
    );
  });

  test("ships Asana OAuth with the SDK-required task and project scopes", () => {
    const provider = createOAuth2ProviderSdk(
      createAsanaOAuth2Provider({
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri:
          "https://app.example.test/integrations/asana/oauth/callback",
      }),
    );
    const authorizationUrl = new URL(
      provider.createAuthorizationUrl({
        state: "state-value",
        codeChallenge: "challenge-value",
      }),
    );

    expect(authorizationUrl.origin).toBe("https://app.asana.com");
    expect(authorizationUrl.pathname).toBe("/-/oauth_authorize");
    expect(authorizationUrl.searchParams.get("scope")).toBe(
      "projects:read projects:write tasks:read tasks:write tasks:delete workspaces:read",
    );
    expect(provider.configuration.tokenEndpoint).toBe(
      "https://app.asana.com/-/oauth_token",
    );
    expect(provider.configuration.clientAuthentication).toBe("body");
  });

  test("ships Dropbox OAuth with offline refresh and SDK-required file scopes", () => {
    const provider = createOAuth2ProviderSdk(
      createDropboxOAuth2Provider({
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri:
          "https://app.example.test/integrations/dropbox/oauth/callback",
      }),
    );
    const authorizationUrl = new URL(
      provider.createAuthorizationUrl({
        state: "state-value",
        codeChallenge: "challenge-value",
      }),
    );

    expect(authorizationUrl.origin).toBe("https://www.dropbox.com");
    expect(authorizationUrl.pathname).toBe("/oauth2/authorize");
    expect(authorizationUrl.searchParams.get("scope")).toBe(
      "files.content.read files.content.write sharing.read sharing.write",
    );
    expect(authorizationUrl.searchParams.get("token_access_type")).toBe(
      "offline",
    );
    expect(provider.configuration.tokenEndpoint).toBe(
      "https://api.dropboxapi.com/oauth2/token",
    );
  });

  test("ships Linear OAuth with refresh-token support and the SDK-required scopes", () => {
    const provider = createOAuth2ProviderSdk(
      createLinearOAuth2Provider({
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri:
          "https://app.example.test/integrations/linear/oauth/callback",
      }),
    );
    const authorizationUrl = new URL(
      provider.createAuthorizationUrl({
        state: "state-value",
        codeChallenge: "challenge-value",
      }),
    );

    expect(authorizationUrl.origin).toBe("https://linear.app");
    expect(authorizationUrl.pathname).toBe("/oauth/authorize");
    expect(authorizationUrl.searchParams.get("scope")).toBe(
      "read,write,customer:read,customer:write",
    );
    expect(provider.configuration.tokenEndpoint).toBe(
      "https://api.linear.app/oauth/token",
    );
    expect(provider.configuration.clientAuthentication).toBe("body");
  });

  test("ships Google Calendar OAuth with offline encrypted-refresh support", () => {
    const provider = createGoogleCalendarOAuth2Provider({
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri:
        "https://app.example.test/integrations/google-calendar/callback",
    });

    expect(provider).toMatchObject({
      integrationId: "google-calendar",
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      scopes: ["https://www.googleapis.com/auth/calendar"],
      authorizationParameters: { access_type: "offline", prompt: "consent" },
      clientAuthentication: "body",
    });
  });

  test("ships Google Drive OAuth with offline encrypted-refresh support", () => {
    const provider = createGoogleDriveOAuth2Provider({
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri:
        "https://app.example.test/integrations/google-drive/callback",
    });

    expect(provider).toMatchObject({
      integrationId: "google-drive",
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      scopes: ["https://www.googleapis.com/auth/drive"],
      authorizationParameters: { access_type: "offline", prompt: "consent" },
      clientAuthentication: "body",
    });
  });

  test("ships Google Sheets OAuth with offline encrypted-refresh support", () => {
    const provider = createGoogleSheetsOAuth2Provider({
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri:
        "https://app.example.test/integrations/google-sheets/callback",
    });

    expect(provider).toMatchObject({
      integrationId: "google-sheets",
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file",
      ],
      authorizationParameters: { access_type: "offline", prompt: "consent" },
      clientAuthentication: "body",
    });
  });

  test("ships Google Docs OAuth with offline encrypted-refresh support", () => {
    const provider = createGoogleDocsOAuth2Provider({
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri: "https://app.example.test/integrations/google-docs/callback",
    });

    expect(provider).toMatchObject({
      integrationId: "google-docs",
      scopes: [
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/drive.file",
      ],
      authorizationParameters: { access_type: "offline", prompt: "consent" },
      clientAuthentication: "body",
    });
  });

  test("ships Google Slides OAuth with presentation and Drive-file scopes", () => {
    const provider = createGoogleSlidesOAuth2Provider({
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri:
        "https://app.example.test/integrations/google-slides/callback",
    });

    expect(provider).toMatchObject({
      integrationId: "google-slides",
      scopes: [
        "https://www.googleapis.com/auth/presentations",
        "https://www.googleapis.com/auth/drive.file",
      ],
      authorizationParameters: { access_type: "offline", prompt: "consent" },
      clientAuthentication: "body",
    });
  });

  test("ships Gmail OAuth with the least privileged send and modify scopes", () => {
    const provider = createGmailOAuth2Provider({
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri: "https://app.example.test/integrations/gmail/callback",
    });

    expect(provider).toMatchObject({
      integrationId: "gmail",
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      apiBaseUrl: "https://gmail.googleapis.com/gmail/v1",
      scopes: [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.send",
      ],
      authorizationParameters: { access_type: "offline", prompt: "consent" },
      clientAuthentication: "body",
    });
  });

  test("ships Google Forms OAuth with body and response-read scopes", () => {
    const provider = createGoogleFormsOAuth2Provider({
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri:
        "https://app.example.test/integrations/google-forms/callback",
    });

    expect(provider).toMatchObject({
      integrationId: "google-forms",
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      scopes: [
        "https://www.googleapis.com/auth/forms.body",
        "https://www.googleapis.com/auth/forms.responses.readonly",
      ],
      authorizationParameters: { access_type: "offline", prompt: "consent" },
      clientAuthentication: "body",
    });
  });

  test("ships Google Tasks OAuth with package-owned write access", () => {
    const provider = createGoogleTasksOAuth2Provider({
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri:
        "https://app.example.test/integrations/google-tasks/callback",
    });

    expect(provider).toMatchObject({
      integrationId: "google-tasks",
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      scopes: ["https://www.googleapis.com/auth/tasks"],
      authorizationParameters: { access_type: "offline", prompt: "consent" },
      clientAuthentication: "body",
    });
  });

  test("ships Google Contacts OAuth with package-owned People API access", () => {
    const provider = createGoogleContactsOAuth2Provider({
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri:
        "https://app.example.test/integrations/google-contacts/callback",
    });

    expect(provider).toMatchObject({
      integrationId: "google-contacts",
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      apiBaseUrl: "https://people.googleapis.com",
      scopes: ["https://www.googleapis.com/auth/contacts"],
      authorizationParameters: { access_type: "offline", prompt: "consent" },
      clientAuthentication: "body",
    });
  });

  test("ships Google Meet OAuth with space creation and record-read scopes", () => {
    const provider = createGoogleMeetOAuth2Provider({
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri: "https://app.example.test/integrations/google-meet/callback",
    });

    expect(provider).toMatchObject({
      integrationId: "google-meet",
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      apiBaseUrl: "https://meet.googleapis.com",
      scopes: [
        "https://www.googleapis.com/auth/meetings.space.created",
        "https://www.googleapis.com/auth/meetings.space.readonly",
      ],
      authorizationParameters: { access_type: "offline", prompt: "consent" },
      clientAuthentication: "body",
    });
  });

  test("ships Google Groups OAuth with Workspace admin scopes", () => {
    const provider = createGoogleGroupsOAuth2Provider({
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri:
        "https://app.example.test/integrations/google-groups/callback",
    });

    expect(provider).toMatchObject({
      integrationId: "google-groups",
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      apiBaseUrl: "https://admin.googleapis.com",
      scopes: [
        "https://www.googleapis.com/auth/admin.directory.group",
        "https://www.googleapis.com/auth/admin.directory.group.member",
        "https://www.googleapis.com/auth/apps.groups.settings",
      ],
      authorizationParameters: { access_type: "offline", prompt: "consent" },
      clientAuthentication: "body",
    });
  });

  test("ships HubSpot's current V3 OAuth flow and accepts its scopes response", async () => {
    const provider = createOAuth2ProviderSdk(
      createHubSpotOAuth2Provider({
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri:
          "https://app.example.test/integrations/hubspot/oauth/callback",
      }),
      (async () =>
        new Response(
          JSON.stringify({
            access_token: "hubspot-access-token",
            refresh_token: "hubspot-refresh-token",
            expires_in: 1_800,
            scopes: ["oauth", "crm.objects.contacts.read"],
          }),
        )) as unknown as typeof fetch,
    );
    const authorizationUrl = new URL(
      provider.createAuthorizationUrl({
        state: "state-value",
        codeChallenge: "challenge-value",
      }),
    );
    const credential = await provider.exchangeAuthorizationCode(
      "authorization-code",
      "verifier-value",
    );

    expect(authorizationUrl.origin).toBe("https://app.hubspot.com");
    expect(authorizationUrl.pathname).toBe("/oauth/authorize");
    expect(authorizationUrl.searchParams.get("scope")).toContain(
      "crm.objects.contacts.read",
    );
    expect(provider.configuration.tokenEndpoint).toBe(
      "https://api.hubapi.com/oauth/v3/token",
    );
    expect(provider.configuration.clientAuthentication).toBe("body");
    expect(credential.scope).toEqual(["oauth", "crm.objects.contacts.read"]);
  });

  test("ships a QuickBooks provider preset with safe realm metadata", () => {
    const provider = createOAuth2ProviderSdk(
      createQuickBooksOAuth2Provider({
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri:
          "https://app.example.test/integrations/quickbooks/oauth/callback",
      }),
    );

    expect(
      provider.extractCallbackMetadata(
        new URLSearchParams("realmId=company-123&code=authorization-code"),
      ),
    ).toEqual({ companyId: "company-123" });
  });

  test("preserves the provider API base path for Xero requests", async () => {
    const requests: string[] = [];
    const provider = createOAuth2ProviderSdk(
      createXeroOAuth2Provider({
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri:
          "https://app.example.test/integrations/xero/oauth/callback",
      }),
      (async (input: RequestInfo | URL) => {
        requests.push(input.toString());
        return Response.json({ ok: true });
      }) as typeof fetch,
    );

    await provider.request(
      { accessToken: "access-token", scope: [], tokenType: "Bearer" },
      { path: "/Invoices?where=Status%3D%3D%22AUTHORISED%22" },
    );

    const url = new URL(requests[0]!);
    expect(url.origin).toBe("https://api.xero.com");
    expect(url.pathname).toBe("/api.xro/2.0/Invoices");
    expect(url.searchParams.get("where")).toBe('Status=="AUTHORISED"');
  });

  test("fails provider requests that exceed their configured timeout", async () => {
    const provider = createOAuth2ProviderSdk(
      {
        integrationId: "quickbooks",
        authorizationEndpoint: "https://provider.example.test/authorize",
        tokenEndpoint: "https://provider.example.test/token",
        apiBaseUrl: "https://provider.example.test/api",
        clientId: "client-id",
        redirectUri:
          "https://app.example.test/integrations/quickbooks/oauth/callback",
        scopes: [],
        requestTimeoutMs: 100,
      },
      ((_: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("Request aborted."));
          });
        })) as typeof fetch,
    );

    await expect(
      provider.request(
        { accessToken: "access-token", scope: [], tokenType: "Bearer" },
        { path: "/slow" },
      ),
    ).rejects.toMatchObject({ code: "OAUTH2_API_REQUEST_FAILED" });
  });

  test("rejects OAuth configuration that can override PKCE or send secrets over HTTP", () => {
    const base = {
      integrationId: "quickbooks" as const,
      authorizationEndpoint: "https://provider.example.test/authorize",
      tokenEndpoint: "https://provider.example.test/token",
      apiBaseUrl: "https://provider.example.test/api",
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri:
        "https://app.example.test/integrations/quickbooks/oauth/callback",
      scopes: [],
    };
    expect(() =>
      createOAuth2ProviderSdk({
        ...base,
        authorizationParameters: { state: "attacker-controlled" },
      }),
    ).toThrow("provider authorization");
    expect(() =>
      createOAuth2ProviderSdk({
        ...base,
        tokenEndpoint: "http://provider.example.test/token",
      }),
    ).toThrow("provider authorization");
    expect(() =>
      createOAuth2ProviderSdk({
        ...base,
        apiBaseUrl: "http://provider.example.test/api",
      }),
    ).toThrow("provider authorization");
    expect(() =>
      createOAuth2ProviderSdk({
        ...base,
        authorizationEndpoint: "http://localhost/authorize",
      }),
    ).toThrow("provider authorization");
    expect(() =>
      createOAuth2ProviderSdk({
        ...base,
        redirectUri: "http://127.0.0.1:3000/integrations/callback",
      }),
    ).not.toThrow();
  });

  test("bounds token response reads as well as the initial provider request", async () => {
    const provider = createOAuth2ProviderSdk(
      {
        integrationId: "quickbooks",
        authorizationEndpoint: "https://provider.example.test/authorize",
        tokenEndpoint: "https://provider.example.test/token",
        clientId: "client-id",
        redirectUri:
          "https://app.example.test/integrations/quickbooks/oauth/callback",
        scopes: [],
        requestTimeoutMs: 100,
      },
      (async () =>
        new Response(new ReadableStream({ start() {} }), {
          headers: { "content-type": "application/json" },
        })) as unknown as typeof fetch,
    );

    await expect(
      provider.exchangeAuthorizationCode("authorization-code", "v".repeat(43)),
    ).rejects.toMatchObject({ code: "OAUTH2_TOKEN_EXCHANGE_FAILED" });
  });

  test("rejects an oversized provider token response", async () => {
    const provider = createOAuth2ProviderSdk(
      {
        integrationId: "quickbooks",
        authorizationEndpoint: "https://provider.example.test/authorize",
        tokenEndpoint: "https://provider.example.test/token",
        clientId: "client-id",
        redirectUri:
          "https://app.example.test/integrations/quickbooks/oauth/callback",
        scopes: [],
        maxTokenResponseBytes: 1_024,
      },
      (async () =>
        Response.json({
          access_token: "x".repeat(2_000),
          token_type: "Bearer",
        })) as unknown as typeof fetch,
    );

    await expect(
      provider.exchangeAuthorizationCode("authorization-code", "v".repeat(43)),
    ).rejects.toMatchObject({ code: "OAUTH2_TOKEN_EXCHANGE_FAILED" });
  });

  test("owns PKCE, token exchange, encrypted storage, and authenticated provider requests", async () => {
    const keyring = await createKeyring();
    const fixture = createRuntimeFixture();
    const runtime = createIntegrationOAuthRuntime({
      ...fixture.config,
      credentialKeyring: keyring,
    });
    const start = await runtime.beginAuthorization({
      product: "eigenn",
      subjectId: "team-1",
      integrationId: "quickbooks",
      returnPath: "/settings/integrations",
    });
    const authorizationUrl = new URL(start.authorizationUrl);
    expect(authorizationUrl.searchParams.get("state")).toBeDefined();
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );

    const state = authorizationUrl.searchParams.get("state")!;
    const complete = await runtime.completeAuthorization(
      {
        expectedIntegrationId: "quickbooks",
        state,
        code: "authorization-code",
      },
      allowOAuthCompletion,
    );
    const reference = createIntegrationCredentialReference({
      connectionId: complete.connectionId,
      integrationId: "quickbooks",
      product: "eigenn",
    });
    expect(fixture.credentials.get(recordKey(reference))).toBeDefined();
    expect(
      JSON.stringify(fixture.credentials.get(recordKey(reference))),
    ).not.toContain("server-access-token");

    const response = await runtime.request({
      reference,
      path: "/v3/company/123/query",
      headers: { "X-Company-Id": "123" },
    });
    expect(response.ok).toBeTrue();
    const providerRequest = fixture.requests.at(-1)!;
    expect(providerRequest.url).toBe(
      "https://provider.example.test/api/v3/company/123/query",
    );
    expect(
      new Headers(providerRequest.init?.headers).get("authorization"),
    ).toBe("Bearer server-access-token");
  });

  test("revokes a newly saved credential when product finalization fails", async () => {
    const keyring = await createKeyring();
    const fixture = createRuntimeFixture();
    const runtime = createIntegrationOAuthRuntime({
      ...fixture.config,
      credentialKeyring: keyring,
      async onConnected() {
        throw new Error("Domain row failed to persist.");
      },
    });
    const start = await runtime.beginAuthorization({
      product: "eigenn",
      subjectId: "team-1",
      integrationId: "quickbooks",
      returnPath: "/settings/integrations",
    });
    const state = new URL(start.authorizationUrl).searchParams.get("state")!;

    await expect(
      runtime.completeAuthorization(
        { state, code: "authorization-code" },
        allowOAuthCompletion,
      ),
    ).rejects.toMatchObject({
      code: "INTEGRATION_CONNECTION_FINALIZATION_FAILED",
    });
    expect(fixture.credentials.size).toBe(0);
  });

  test("rejects corrupt durable OAuth state before using its return path", async () => {
    const keyring = await createKeyring();
    const fixture = createRuntimeFixture();
    const runtime = createIntegrationOAuthRuntime({
      ...fixture.config,
      credentialKeyring: keyring,
    });
    const start = await runtime.beginAuthorization({
      product: "eigenn",
      subjectId: "team-1",
      integrationId: "quickbooks",
      returnPath: "/settings/integrations",
    });
    const state = new URL(start.authorizationUrl).searchParams.get("state")!;
    const pending = fixture.states.get(state)!;
    fixture.states.set(state, {
      ...pending,
      returnPath: "https://attacker.example.test",
    } as PendingIntegrationOAuthAuthorization);

    await expect(
      runtime.completeAuthorization(
        { state, code: "authorization-code" },
        allowOAuthCompletion,
      ),
    ).rejects.toMatchObject({ code: "INTEGRATION_OAUTH_STATE_INVALID" });

    await expect(
      runtime.beginAuthorization({
        product: "eigenn",
        subjectId: "team-1",
        integrationId: "quickbooks",
        returnPath: "//attacker.example.test",
      }),
    ).rejects.toBeDefined();
  });

  test("serializes refreshes for concurrent requests to one connection", async () => {
    const keyring = await createKeyring();
    const fixture = createRuntimeFixture({ tokenRequestDelayMs: 25 });
    const runtime = createIntegrationOAuthRuntime({
      ...fixture.config,
      credentialKeyring: keyring,
    });
    const start = await runtime.beginAuthorization({
      product: "eigenn",
      subjectId: "team-1",
      integrationId: "quickbooks",
      returnPath: "/settings/integrations",
    });
    const complete = await runtime.completeAuthorization(
      {
        state: new URL(start.authorizationUrl).searchParams.get("state")!,
        code: "authorization-code",
      },
      allowOAuthCompletion,
    );
    const reference = createIntegrationCredentialReference({
      connectionId: complete.connectionId,
      integrationId: "quickbooks",
      product: "eigenn",
    });
    fixture.credentials.set(
      recordKey(reference),
      await encryptIntegrationCredential({
        reference,
        keyring,
        now: fixture.config.now(),
        credential: {
          accessToken: "expired-access-token",
          refreshToken: "server-refresh-token",
          expiresAt: "2026-07-31T11:00:00.000Z",
          scope: [],
          tokenType: "Bearer",
        },
      }),
    );
    const tokenRequestsBefore = fixture.requests.filter(
      (request) => request.url === "https://provider.example.test/token",
    ).length;

    await Promise.all([
      runtime.request({ reference, path: "/first" }),
      runtime.request({ reference, path: "/second" }),
    ]);

    expect(
      fixture.requests.filter(
        (request) => request.url === "https://provider.example.test/token",
      ),
    ).toHaveLength(tokenRequestsBefore + 1);
  });

  test("does not resurrect a credential when revocation waits for refresh", async () => {
    let releaseTokenResponse: (() => void) | undefined;
    const tokenResponse = new Promise<void>((resolve) => {
      releaseTokenResponse = resolve;
    });
    let refreshStarted: (() => void) | undefined;
    const refreshStartedPromise = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    const fixtureOptions: {
      tokenRequestGate?: Promise<void>;
      onTokenRequest?: () => void;
    } = {};
    const keyring = await createKeyring();
    const fixture = createRuntimeFixture(fixtureOptions);
    const runtime = createIntegrationOAuthRuntime({
      ...fixture.config,
      credentialKeyring: keyring,
    });
    const start = await runtime.beginAuthorization({
      product: "eigenn",
      subjectId: "team-1",
      integrationId: "quickbooks",
      returnPath: "/settings/integrations",
    });
    const complete = await runtime.completeAuthorization(
      {
        state: new URL(start.authorizationUrl).searchParams.get("state")!,
        code: "authorization-code",
      },
      allowOAuthCompletion,
    );
    const reference = createIntegrationCredentialReference({
      connectionId: complete.connectionId,
      integrationId: "quickbooks",
      product: "eigenn",
    });
    fixture.credentials.set(
      recordKey(reference),
      await encryptIntegrationCredential({
        reference,
        keyring,
        now: fixture.config.now(),
        credential: {
          accessToken: "expired-access-token",
          refreshToken: "server-refresh-token",
          expiresAt: "2026-07-31T11:00:00.000Z",
          scope: [],
          tokenType: "Bearer",
        },
      }),
    );
    fixtureOptions.tokenRequestGate = tokenResponse;
    fixtureOptions.onTokenRequest = () => refreshStarted?.();

    const request = runtime.request({ reference, path: "/refreshing" });
    await refreshStartedPromise;
    const revocation = runtime.revokeCredential(reference);
    releaseTokenResponse?.();
    await Promise.all([request, revocation]);

    expect(fixture.credentials.has(recordKey(reference))).toBeFalse();
  });

  test("bounds abandoned OAuth state per subject and purges expired state", async () => {
    let currentTime = new Date("2026-07-31T12:00:00.000Z");
    const keyring = await createKeyring();
    const fixture = createRuntimeFixture();
    const runtime = createIntegrationOAuthRuntime({
      ...fixture.config,
      credentialKeyring: keyring,
      now: () => currentTime,
      oauthStateStore: createInMemoryIntegrationOAuthStateStore({
        now: () => currentTime,
      }),
    });
    for (let index = 0; index < 5; index += 1) {
      await runtime.beginAuthorization({
        product: "eigenn",
        subjectId: "team-1",
        integrationId: "quickbooks",
        returnPath: `/settings/integrations/${index}`,
      });
    }
    await expect(
      runtime.beginAuthorization({
        product: "eigenn",
        subjectId: "team-1",
        integrationId: "quickbooks",
        returnPath: "/settings/integrations/blocked",
      }),
    ).rejects.toMatchObject({ code: "INTEGRATION_OAUTH_STATE_LIMIT_REACHED" });

    currentTime = new Date("2026-07-31T12:11:00.000Z");
    await expect(
      runtime.beginAuthorization({
        product: "eigenn",
        subjectId: "team-1",
        integrationId: "quickbooks",
        returnPath: "/settings/integrations/retry",
      }),
    ).resolves.toMatchObject({ integrationId: "quickbooks" });
  });

  test("ships mountable OAuth start and callback routes without exposing tokens", async () => {
    const keyring = await createKeyring();
    const fixture = createRuntimeFixture();
    let observedMetadata: Readonly<Record<string, string>> | undefined;
    let completionChecks = 0;
    const routes = createIntegrationOAuthRoutes({
      ...fixture.config,
      credentialKeyring: keyring,
      async resolveSubject() {
        return { product: "conduitt", subjectId: "organization-1" };
      },
      async authorizeStart(subject, integrationId) {
        expect(subject.product).toBe("conduitt");
        expect(integrationId).toBe("quickbooks");
      },
      async authorizeComplete(subject, integrationId) {
        expect(subject.product).toBe("conduitt");
        expect(integrationId).toBe("quickbooks");
        completionChecks += 1;
      },
      async onConnected(input) {
        observedMetadata = input.providerMetadata;
      },
    });
    const start = await routes.handle(
      new Request(
        "https://app.example.test/integrations/quickbooks/oauth/start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnPath: "/connected" }),
        },
      ),
    );
    expect(start?.status).toBe(302);
    const state = new URL(start?.headers.get("location")!).searchParams.get(
      "state",
    )!;
    const callback = await routes.handle(
      new Request(
        `https://app.example.test/integrations/quickbooks/oauth/callback?state=${encodeURIComponent(state)}&code=code&realmId=company-123`,
      ),
    );
    expect(callback?.status).toBe(302);
    expect(callback?.headers.get("location")).toBe("/connected");
    expect(callback?.headers.get("location")).not.toContain("token");
    expect(observedMetadata).toEqual({ companyId: "company-123" });
    expect(completionChecks).toBe(1);
  });

  test("does not persist a credential when callback authorization is revoked", async () => {
    const keyring = await createKeyring();
    const fixture = createRuntimeFixture();
    let completionChecks = 0;
    const routes = createIntegrationOAuthRoutes({
      ...fixture.config,
      credentialKeyring: keyring,
      async resolveSubject() {
        return { product: "eigenn", subjectId: "team-1" };
      },
      async authorizeStart() {},
      async authorizeComplete() {
        completionChecks += 1;
        throw new Error("The subject no longer has access.");
      },
    });
    const start = await routes.handle(
      new Request(
        "https://app.example.test/integrations/quickbooks/oauth/start",
      ),
    );
    const state = new URL(start?.headers.get("location")!).searchParams.get(
      "state",
    )!;
    const callback = await routes.handle(
      new Request(
        `https://app.example.test/integrations/quickbooks/oauth/callback?state=${encodeURIComponent(state)}&code=code`,
      ),
    );

    expect(callback?.status).toBe(400);
    expect(completionChecks).toBe(1);
    expect(fixture.credentials.size).toBe(0);
  });

  test("runs product authorization before direct OAuth starts create state", async () => {
    const keyring = await createKeyring();
    const fixture = createRuntimeFixture();
    let authorizationChecks = 0;
    const routes = createIntegrationOAuthRoutes({
      ...fixture.config,
      credentialKeyring: keyring,
      async resolveSubject() {
        return { product: "eigenn", subjectId: "team-1" };
      },
      async authorizeStart() {
        authorizationChecks += 1;
        throw new Error("Denied by product policy.");
      },
      async authorizeComplete() {},
    });

    const response = await routes.handle(
      new Request(
        "https://app.example.test/integrations/quickbooks/oauth/start",
        { method: "GET" },
      ),
    );

    expect(response?.status).toBe(400);
    expect(authorizationChecks).toBe(1);
    expect(fixture.states.size).toBe(0);
  });

  test("provides a product-kit connector that delegates OAuth to package routes", async () => {
    const connector = createOAuthRouteConnector({
      actions: {
        async performAction() {
          return { accepted: true, safeMessage: "Queued." };
        },
        async getConnectionHealth() {
          return { state: "healthy", summary: "Fresh." };
        },
      },
    });
    await expect(
      connector.beginConnection(
        {},
        { integrationId: "quickbooks", mode: "oauth2" },
      ),
    ).resolves.toMatchObject({
      state: "redirect",
      redirectPath: "/integrations/quickbooks/oauth/start",
    });
  });
});

describe("server product routes", () => {
  test("owns the authorized vendor-SDK execution route without accepting credentials", async () => {
    const executions: Array<{
      integrationId: string;
      operationId: string;
      connectionId: string;
      product: string;
    }> = [];
    const authorizations: Array<{
      integrationId: string;
      operationId: string;
      connectionId: string;
      product: string;
      subjectId: string;
    }> = [];
    const registry = createIntegrationProviderSdkRegistry([
      {
        integrationId: "stripe",
        operationIds: ["stripe:create-customer"],
        async execute(invocation) {
          executions.push({
            integrationId: invocation.integrationId,
            operationId: invocation.operationId,
            connectionId: invocation.reference.connectionId,
            product: invocation.reference.product,
          });
          return {
            operationId: invocation.operationId,
            output: {
              customerId: "cus-1",
              accessToken: "must-not-reach-the-browser",
            },
          };
        },
      },
    ]);
    const routes = createIntegrationProviderExecutionRoutes({
      providerRegistry: registry,
      async resolveSubject() {
        return { product: "eigenn", subjectId: "team-1" };
      },
      async authorizeExecution(subject, execution) {
        authorizations.push({ ...subject, ...execution });
      },
    });

    const response = await routes.handle(
      new Request(
        "https://app.example.test/integrations/stripe/connections/connection-1/operations/stripe%3Acreate-customer",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "execution-1",
          },
          body: JSON.stringify({ input: { email: "operator@example.test" } }),
        },
      ),
    );
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({
      operationId: "stripe:create-customer",
      output: { customerId: "cus-1", accessToken: "[REDACTED]" },
    });
    expect(authorizations).toEqual([
      {
        product: "eigenn",
        subjectId: "team-1",
        integrationId: "stripe",
        operationId: "stripe:create-customer",
        connectionId: "connection-1",
      },
    ]);
    expect(executions).toEqual([
      {
        integrationId: "stripe",
        operationId: "stripe:create-customer",
        connectionId: "connection-1",
        product: "eigenn",
      },
    ]);

    const rejected = await routes.handle(
      new Request(
        "https://app.example.test/integrations/stripe/connections/connection-1/operations/stripe%3Acreate-customer",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { email: "operator@example.test", accessToken: "forbidden" },
          }),
        },
      ),
    );
    expect(rejected?.status).toBe(400);
    expect(executions).toHaveLength(1);
  });

  test("owns standard directory and connection controller plumbing", async () => {
    const kit: ProductIntegrationKit<{ actorId: string }> = {
      async getDirectory(context) {
        expect(context).toEqual({ actorId: "actor-1" });
        return { product: "eigenn", entries: [] };
      },
      async getEntitlement() {
        return { allowed: true, requestAccessAllowed: false };
      },
      async beginConnection(context, request) {
        expect(context).toEqual({ actorId: "actor-1" });
        expect(request).toEqual({
          integrationId: "quickbooks",
          mode: "oauth2",
        });
        return {
          state: "redirect",
          safeNextStep: "Continue to the secure provider connection.",
          redirectPath: "/integrations/quickbooks/oauth/start",
        };
      },
      async performAction(context, request) {
        expect(context).toEqual({ actorId: "actor-1" });
        expect(request).toEqual({
          connectionId: "connection-1",
          action: "sync_now",
        });
        return { accepted: true, safeMessage: "Sync queued." };
      },
      async getConnectionHealth(context, request) {
        expect(context).toEqual({ actorId: "actor-1" });
        expect(request).toEqual({ connectionId: "connection-1" });
        return { state: "healthy", summary: "Fresh." };
      },
    };
    const routes = createIntegrationProductRoutes({
      kit,
      maxJsonBodyBytes: 1_024,
      async resolveContext() {
        return { actorId: "actor-1" };
      },
    });

    const directory = await routes.handle(
      new Request("https://app.example.test/integrations"),
    );
    expect(await directory?.json()).toEqual({ product: "eigenn", entries: [] });

    const connect = await routes.handle(
      new Request("https://app.example.test/integrations/quickbooks/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId: "untrusted", mode: "oauth2" }),
      }),
    );
    expect(await connect?.json()).toMatchObject({
      redirectPath: "/integrations/quickbooks/oauth/start",
    });

    const action = await routes.handle(
      new Request(
        "https://app.example.test/integrations/connections/connection-1/actions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync_now" }),
        },
      ),
    );
    expect(await action?.json()).toEqual({
      accepted: true,
      safeMessage: "Sync queued.",
    });

    const health = await routes.handle(
      new Request(
        "https://app.example.test/integrations/connections/connection-1/health",
      ),
    );
    expect(await health?.json()).toEqual({
      state: "healthy",
      summary: "Fresh.",
    });

    const oversized = await routes.handle(
      new Request("https://app.example.test/integrations/quickbooks/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: "x".repeat(1_100) }),
      }),
    );
    expect(oversized?.status).toBe(413);
    await expect(oversized?.json()).resolves.toEqual({
      error: {
        code: "INTEGRATION_REQUEST_TOO_LARGE",
        message: "Integration request failed.",
      },
    });
  });
});

describe("server financial and aggregation SDK adapters", () => {
  test("owns Plaid and Merge Link token issuance, encrypted completion, and Fetch routes", async () => {
    const keyring = await createKeyring();
    const credentials = new Map<string, EncryptedIntegrationCredential>();
    const connected: Array<{
      integrationId: string;
      providerMetadata: Readonly<Record<string, string>>;
    }> = [];
    const runtime = createIntegrationConnectionLinkRuntime({
      credentialKeyring: keyring,
      credentialVault: {
        async read(reference) {
          return credentials.get(recordKey(reference));
        },
        async save(reference, credential) {
          credentials.set(recordKey(reference), credential);
        },
        async revoke(reference) {
          credentials.delete(recordKey(reference));
        },
      },
      plaid: {
        clientId: "plaid-client",
        secret: "plaid-secret",
        clientFactory: () => ({
          async linkTokenCreate() {
            return {
              data: {
                link_token: "plaid-link-token",
                expiration: "2026-08-01T00:00:00Z",
                request_id: "plaid-request",
              },
            };
          },
          async itemPublicTokenExchange() {
            return {
              data: {
                access_token: "plaid-access-token",
                item_id: "item-123",
                request_id: "plaid-exchange-request",
              },
            };
          },
        }),
      },
      merge: {
        apiKey: "merge-api-key",
        async resolveEndUser() {
          return { email: "owner@example.test", organizationName: "Acme" };
        },
        clientFactory: () => ({
          async linkTokenCreate() {
            return {
              link_token: "merge-link-token",
              integration_name: "quickbooks",
            };
          },
          async accountTokenRetrieve() {
            return {
              account_token: "merge-account-token",
              integration: { name: "quickbooks" },
            };
          },
        }),
      },
      async onConnected(input) {
        connected.push({
          integrationId: input.integrationId,
          providerMetadata: input.providerMetadata,
        });
      },
    });

    const routes = createIntegrationConnectionLinkRoutes({
      runtime,
      async resolveSubject() {
        return { product: "eigenn", subjectId: "tenant-1" };
      },
      async authorizeStart() {},
      async authorizeComplete() {},
    });
    const tokenResponse = await routes.handle(
      new Request("https://app.example.test/integrations/plaid/link/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(await tokenResponse?.json()).toMatchObject({
      integrationId: "plaid",
      linkToken: "plaid-link-token",
    });
    const completionResponse = await routes.handle(
      new Request("https://app.example.test/integrations/plaid/link/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken: "plaid-public-token" }),
      }),
    );
    const completion = await completionResponse?.text();
    expect(completion).toContain("connected");
    expect(completion).not.toContain("plaid-access-token");
    expect(credentials.size).toBe(1);

    const mergeResult = await runtime.completeMergeLink(
      {
        product: "conduitt",
        subjectId: "tenant-2",
        publicToken: "merge-public-token",
      },
      async () => undefined,
    );
    await expect(
      runtime.withMergeCredential(
        createIntegrationCredentialReference({
          connectionId: mergeResult.connectionId,
          integrationId: "merge",
          product: "conduitt",
        }),
        async (credential) => credential.accountToken,
      ),
    ).resolves.toBe("merge-account-token");
    expect(connected).toEqual([
      {
        integrationId: "plaid",
        providerMetadata: {
          itemId: "item-123",
          requestId: "plaid-exchange-request",
        },
      },
      {
        integrationId: "merge",
        providerMetadata: { integrationName: "quickbooks" },
      },
    ]);
  });

  test("verifies Plaid and Merge webhooks before emitting redacted, idempotent sync signals", async () => {
    const received: unknown[] = [];
    const { privateKey, publicKey } = await generateKeyPair("ES256");
    const keyId = "plaid-webhook-key";
    const key = await exportJWK(publicKey);
    Object.assign(key, { alg: "ES256", kid: keyId, use: "sig" });
    const runtime = createIntegrationWebhookRuntime({
      plaid: {
        clientId: "plaid-client",
        secret: "plaid-secret",
        async resolveConnection(input) {
          return input.itemId === "item-123"
            ? {
                connectionId: "plaid-connection",
                product: "eigenn",
                subjectId: "tenant-1",
              }
            : undefined;
        },
        clientFactory: () => ({
          async webhookVerificationKeyGet(input) {
            expect(input).toEqual({ key_id: keyId });
            return { data: { key } };
          },
        }),
      },
      merge: {
        signatureKey: "merge-webhook-signing-key",
        async resolveConnection(input) {
          return input.linkedAccountId === "linked-account-1"
            ? {
                connectionId: "merge-connection",
                product: "conduitt",
                subjectId: "tenant-2",
              }
            : undefined;
        },
      },
      async onSyncRequired(input) {
        received.push(input);
      },
      now: () => new Date("2026-07-31T18:00:00.000Z"),
    });
    const plaidBody = JSON.stringify({
      item_id: "item-123",
      webhook_type: "TRANSACTIONS",
      webhook_code: "SYNC_UPDATES_AVAILABLE",
      access_token: "must-not-reach-products",
    });
    const plaidSignature = await new SignJWT({
      request_body_sha256: createHash("sha256").update(plaidBody).digest("hex"),
    })
      .setProtectedHeader({ alg: "ES256", kid: keyId })
      .setIssuedAt(Math.floor(Date.parse("2026-07-31T18:00:00.000Z") / 1_000))
      .sign(privateKey);
    const webhookRoutes = createIntegrationWebhookRoutes({ runtime });
    const plaidResponse = await webhookRoutes.handle(
      new Request("https://app.example.test/integrations/plaid/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Plaid-Verification": plaidSignature,
        },
        body: plaidBody,
      }),
    );
    expect(plaidResponse?.status).toBe(200);

    const mergeBody = JSON.stringify({
      hook: { event: "LinkedAccount.synced" },
      linked_account: {
        id: "linked-account-1",
        end_user_origin_id: "tenant-2",
        integration_slug: "quickbooks",
      },
      data: { account_token: "must-not-reach-products" },
    });
    const mergeSignature = createHmac("sha256", "merge-webhook-signing-key")
      .update(mergeBody)
      .digest("base64url");
    const mergeResponse = await webhookRoutes.handle(
      new Request("https://app.example.test/integrations/merge/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Merge-Webhook-Signature": mergeSignature,
        },
        body: mergeBody,
      }),
    );
    expect(mergeResponse?.status).toBe(200);
    expect(received).toEqual([
      {
        integrationId: "plaid",
        connectionId: "plaid-connection",
        product: "eigenn",
        subjectId: "tenant-1",
        providerEvent: "TRANSACTIONS.SYNC_UPDATES_AVAILABLE",
        idempotencyKey: `plaid:${createHash("sha256").update(plaidBody).digest("hex")}`,
        receivedAt: "2026-07-31T18:00:00.000Z",
      },
      {
        integrationId: "merge",
        connectionId: "merge-connection",
        product: "conduitt",
        subjectId: "tenant-2",
        providerEvent: "LinkedAccount.synced",
        idempotencyKey: `merge:${createHash("sha256").update(mergeBody).digest("hex")}`,
        receivedAt: "2026-07-31T18:00:00.000Z",
      },
    ]);
    expect(JSON.stringify(received)).not.toContain("must-not-reach-products");

    const invalidResponse = await webhookRoutes.handle(
      new Request("https://app.example.test/integrations/merge/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Merge-Webhook-Signature": "invalid",
        },
        body: mergeBody,
      }),
    );
    expect(invalidResponse?.status).toBe(401);
    expect(received).toHaveLength(2);
  });

  test("executes every Brex, QuickBooks, Xero, Plaid, and Merge operation through its SDK adapter", async () => {
    const apiKeyRuntime = {
      async withCredential<T>(
        _reference: IntegrationCredentialReference,
        operation: (credential: {
          readonly apiKey: string;
          readonly fields: Readonly<Record<string, string>>;
        }) => Promise<T>,
      ) {
        return operation({ apiKey: "brex-token", fields: {} });
      },
    };
    const oauthRuntime = {
      async withCredential<T>(
        _reference: IntegrationCredentialReference,
        operation: (credential: {
          readonly accessToken: string;
          readonly refreshToken?: string;
          readonly scope: readonly string[];
          readonly tokenType: string;
        }) => Promise<T>,
      ) {
        return operation({
          accessToken: "oauth-token",
          refreshToken: "oauth-refresh-token",
          scope: [],
          tokenType: "Bearer",
        });
      },
    };
    const calls: string[] = [];
    const nestedSdk = (path: string[]): unknown =>
      new Proxy(
        {},
        {
          get(_target, property) {
            if (typeof property !== "string") return undefined;
            return (..._args: unknown[]) => {
              calls.push([...path, property].join("."));
              return Promise.resolve({ path: [...path, property] });
            };
          },
        },
      );
    const brex = createBrexProviderSdk({
      apiKeyRuntime,
      clientFactory: () =>
        new Proxy(
          {},
          {
            get(_target, property) {
              return typeof property === "string"
                ? nestedSdk([property])
                : undefined;
            },
          },
        ) as Record<string, unknown>,
    });
    const quickBooks = createQuickBooksProviderSdk({
      oauthRuntime,
      clientId: "quickbooks-client",
      clientSecret: "quickbooks-secret",
      companyId: "realm-123",
      clientFactory: () =>
        new Proxy(
          {},
          {
            get(_target, property) {
              if (typeof property !== "string") return undefined;
              return (...args: unknown[]) => {
                calls.push(`quickbooks.${property}`);
                const callback = args.at(-1);
                if (typeof callback === "function")
                  callback(null, { property });
              };
            },
          },
        ) as Record<string, unknown>,
    });
    const xero = createXeroProviderSdk({
      oauthRuntime,
      clientId: "xero-client",
      clientSecret: "xero-secret",
      tenantId: "tenant-123",
      async clientFactory() {
        return {
          async initialize() {},
          setTokenSet() {},
          accountingApi: new Proxy(
            {},
            {
              get(_target, property) {
                return async () => {
                  calls.push(`xero.${String(property)}`);
                  return { property };
                };
              },
            },
          ) as Record<string, (...args: unknown[]) => Promise<unknown>>,
        };
      },
    });
    const linkRuntime = {
      async withPlaidCredential<T>(
        _reference: IntegrationCredentialReference,
        operation: (credential: {
          kind: "plaid";
          accessToken: string;
        }) => Promise<T>,
      ) {
        return operation({ kind: "plaid", accessToken: "plaid-access" });
      },
      async withMergeCredential<T>(
        _reference: IntegrationCredentialReference,
        operation: (credential: {
          kind: "merge";
          accountToken: string;
        }) => Promise<T>,
      ) {
        return operation({ kind: "merge", accountToken: "merge-account" });
      },
    };
    const plaid = createPlaidProviderSdk({
      connectionLinkRuntime: linkRuntime,
      clientId: "plaid-client",
      secret: "plaid-secret",
      clientFactory: () => ({
        async accountsGet() {
          calls.push("plaid.accountsGet");
          return { data: {} };
        },
        async accountsBalanceGet() {
          calls.push("plaid.accountsBalanceGet");
          return { data: {} };
        },
        async transactionsSync() {
          calls.push("plaid.transactionsSync");
          return { data: {} };
        },
        async itemGet() {
          calls.push("plaid.itemGet");
          return { data: {} };
        },
      }),
    });
    const merge = createMergeProviderSdk({
      connectionLinkRuntime: linkRuntime,
      apiKey: "merge-api-key",
      clientFactory: () => ({
        async accountsList() {
          calls.push("merge.accountsList");
          return {};
        },
        async invoicesList() {
          calls.push("merge.invoicesList");
          return {};
        },
        async transactionsList() {
          calls.push("merge.transactionsList");
          return {};
        },
        async companyInfoList() {
          calls.push("merge.companyInfoList");
          return {};
        },
        async balanceSheetsList() {
          calls.push("merge.balanceSheetsList");
          return {};
        },
        async syncStatusResyncCreate() {
          calls.push("merge.syncStatusResyncCreate");
          return {};
        },
      }),
    });
    const executeAll = async (provider: {
      integrationId: string;
      operationIds: readonly string[];
      execute(input: {
        integrationId: string;
        operationId: string;
        reference: IntegrationCredentialReference;
        input: Readonly<Record<string, unknown>>;
      }): Promise<unknown>;
    }) => {
      for (const operationId of provider.operationIds) {
        await provider.execute({
          integrationId: provider.integrationId,
          operationId,
          reference: createIntegrationCredentialReference({
            connectionId: "connection-1",
            integrationId: provider.integrationId,
            product: "eigenn",
          }),
          input: {
            id: "record-1",
            expenseId: "expense-1",
            cashAccountId: "cash-1",
            userId: "user-1",
            budgetId: "budget-1",
            spendLimitId: "limit-1",
            vendorId: "vendor-1",
            transferId: "transfer-1",
            body: { name: "Example" },
            invoice: { Line: [] },
            invoices: { invoices: [] },
            query: {},
          },
        });
      }
    };

    await executeAll(brex);
    await executeAll(quickBooks);
    await executeAll(xero);
    await executeAll(plaid);
    await executeAll(merge);

    expect(getBrexProviderSdkReport().operations).toBe(34);
    expect(getQuickBooksProviderSdkReport().operations).toBe(6);
    expect(getXeroProviderSdkReport().operations).toBe(6);
    expect(getPlaidProviderSdkReport().operations).toBe(4);
    expect(getMergeProviderSdkReport().operations).toBe(6);
    expect(calls).toContain("plaid.transactionsSync");
    expect(calls).toContain("merge.syncStatusResyncCreate");
    expect(calls).toContain("quickbooks.createInvoice");
    expect(calls).toContain("xero.createInvoices");
  });
});
