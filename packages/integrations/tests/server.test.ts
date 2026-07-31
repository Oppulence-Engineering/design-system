import { describe, expect, test } from "bun:test";

import {
  createApiKeyProviderSdk,
  createIntegrationApiKeyRoutes,
  createIntegrationApiKeyRuntime,
  createIntegrationNoAuthRoutes,
  createIntegrationNoAuthRuntime,
  createIntegrationCredentialReference,
  createIntegrationCredentialKeyring,
  createInMemoryIntegrationOAuthStateStore,
  createIntegrationProductRoutes,
  createOAuth2ProviderSdk,
  createOAuthRouteConnector,
  createQuickBooksOAuth2Provider,
  createXeroOAuth2Provider,
  createUnauthenticatedProviderSdk,
  createIntegrationOAuthRoutes,
  createIntegrationOAuthRuntime,
  decryptIntegrationApiKeyCredential,
  decryptIntegrationCredential,
  encryptIntegrationApiKeyCredential,
  encryptIntegrationCredential,
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
    ).resolves.toEqual({ apiKey: "secret-api-key" });

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
