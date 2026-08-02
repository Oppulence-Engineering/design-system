import { describe, expect, test } from "bun:test";

import {
  createApiKeyProviderSdk,
  type ApiKeyProviderConfiguration,
} from "../src/server/transport/api-key";
import { createIntegrationConnectionLinkRuntime } from "../src/server/transport/connection-link";

/**
 * Two properties a connection must not be able to bend.
 *
 * A provider profile's literal `apiBaseUrl` is written in this package and is
 * trusted. A host taken from `apiBaseUrlField` is not — it lives in a
 * credential field controlled by whoever creates the connection — and the REST
 * executor hands the response body back to the caller, so reaching an internal
 * service also reads it.
 */

const HOST_FROM_CONNECTION: ApiKeyProviderConfiguration = {
  integrationId: "grafana",
  apiBaseUrlField: "baseUrl",
  credentialHeader: "Authorization",
  credentialPrefix: "Bearer ",
  credentialFields: [{ name: "baseUrl", required: true }],
};

/** Attempts one request with the connection naming its own host. */
async function attempt(baseUrl: string): Promise<{
  rejected: boolean;
  code?: string;
  reached: number;
}> {
  const seen: URL[] = [];
  const sdk = createApiKeyProviderSdk(HOST_FROM_CONNECTION, (async (
    url: URL,
  ) => {
    seen.push(url);
    return new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch);

  try {
    await sdk.request(
      { apiKey: "k", fields: { baseUrl } },
      { path: "/api/search", method: "GET" },
    );
    return { rejected: false, reached: seen.length };
  } catch (error) {
    return {
      rejected: true,
      code: (error as { code?: string }).code,
      reached: seen.length,
    };
  }
}

describe("apiBaseUrlField", () => {
  /*
   * The construction guard required a literal apiBaseUrl whenever a transport
   * was present, so every profile using apiBaseUrlField — the whole point of
   * the field — failed to construct and the request path that reads it was
   * unreachable.
   */
  test("can be configured without a literal apiBaseUrl", () => {
    expect(() => createApiKeyProviderSdk(HOST_FROM_CONNECTION)).not.toThrow();
  });

  test("is refused alongside a literal apiBaseUrl, which would be ambiguous", () => {
    expect(() =>
      createApiKeyProviderSdk({
        ...HOST_FROM_CONNECTION,
        apiBaseUrl: "https://grafana.example.com",
      }),
    ).toThrow();
  });

  test("a profile naming no host at all is still refused", () => {
    expect(() =>
      createApiKeyProviderSdk({
        integrationId: "grafana",
        credentialHeader: "Authorization",
      }),
    ).toThrow();
  });
});

describe("a connection-supplied base URL", () => {
  const blocked = [
    ["loopback by name", "https://localhost/"],
    ["loopback by address", "https://127.0.0.1/"],
    ["a subdomain of localhost", "https://api.localhost/"],
    ["link-local metadata", "https://169.254.169.254/"],
    ["private class A", "https://10.1.2.3/"],
    ["private class B", "https://172.16.9.9/"],
    ["private class C", "https://192.168.1.1/"],
    ["carrier-grade NAT", "https://100.64.0.1/"],
    ["the unspecified address", "https://0.0.0.0/"],
    ["IPv6 loopback", "https://[::1]/"],
    ["IPv6 unique-local", "https://[fd00::1]/"],
    ["IPv6 link-local", "https://[fe80::1]/"],
    ["an IPv4-mapped IPv6 address", "https://[::ffff:7f00:1]/"],
    ["a cluster-internal name", "https://api.internal/"],
    ["an mDNS name", "https://printer.local/"],
  ] as const;

  for (const [label, url] of blocked) {
    test(`is refused for ${label}`, async () => {
      const result = await attempt(url);

      expect(result.rejected).toBe(true);
      expect(result.code).toBe("API_KEY_PROVIDER_CONFIGURATION_INVALID");
      // Nothing was sent — the check runs before the request leaves.
      expect(result.reached).toBe(0);
    });
  }

  test("is refused for a non-https scheme", async () => {
    const result = await attempt("http://grafana.example.com/");

    expect(result.rejected).toBe(true);
    expect(result.reached).toBe(0);
  });

  test("is refused when it embeds credentials", async () => {
    const result = await attempt("https://user:pass@grafana.example.com/");

    expect(result.rejected).toBe(true);
    expect(result.reached).toBe(0);
  });

  test("is allowed for an ordinary public host", async () => {
    const result = await attempt("https://grafana.example.com/");

    expect(result.rejected).toBe(false);
    expect(result.reached).toBe(1);
  });

  test("is allowed for addresses just outside the blocked ranges", async () => {
    // 172.32 sits above the private 172.16/12 block, and 100.128 above the
    // 100.64/10 carrier-grade NAT block.
    expect((await attempt("https://172.32.0.1/")).rejected).toBe(false);
    expect((await attempt("https://100.128.0.1/")).rejected).toBe(false);
  });
});

describe("a product's authorization denial during connection link", () => {
  class Forbidden extends Error {
    readonly httpStatus = 403;
    constructor() {
      super("subject may not link this provider");
      this.name = "Forbidden";
    }
  }

  const neverCalled = () => {
    throw new Error("the provider must not be reached after a denial");
  };

  function runtime() {
    return createIntegrationConnectionLinkRuntime({
      credentialVault: {
        async read() {
          return undefined;
        },
        async save() {},
        async revoke() {},
      },
      credentialKeyring: {
        async getActiveKey() {
          throw new Error("unused");
        },
        async getKey() {
          return undefined;
        },
      },
      plaid: {
        clientId: "c",
        secret: "s",
        environment: "sandbox",
        clientFactory: neverCalled,
      },
      merge: {
        apiKey: "k",
        signatureKey: "s",
        async resolveEndUser() {
          return { email: "a@b.test", organizationName: "Org" };
        },
        clientFactory: neverCalled,
      },
    } as never);
  }

  /*
   * The authorizer ran inside the catch that rewrites anything it does not
   * recognise into COMPLETION_FAILED, so a plain Error — the obvious thing for
   * a product to throw to deny a request — came back as a generic provider
   * failure. The request was still refused, but an HTTP layer could not map it
   * to a 403 and a denial was indistinguishable from a provider outage.
   */
  test("reaches the caller unchanged from completePlaidLink", async () => {
    await expect(
      runtime().completePlaidLink(
        {
          product: "eigenn",
          subjectId: "sub_1",
          publicToken: "public-sandbox-abc",
        } as never,
        async () => {
          throw new Forbidden();
        },
      ),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  test("reaches the caller unchanged from completeMergeLink", async () => {
    await expect(
      runtime().completeMergeLink(
        {
          product: "eigenn",
          subjectId: "sub_1",
          publicToken: "public-abc",
        } as never,
        async () => {
          throw new Forbidden();
        },
      ),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  test("still wraps a genuine provider failure", async () => {
    await expect(
      runtime().completePlaidLink(
        {
          product: "eigenn",
          subjectId: "sub_1",
          publicToken: "public-sandbox-abc",
        } as never,
        async () => {},
      ),
    ).rejects.toMatchObject({
      code: "INTEGRATION_CONNECTION_LINK_COMPLETION_FAILED",
    });
  });
});
