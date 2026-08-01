import { describe, expect, test } from "bun:test";

import {
  createIntegrationConnectionLinkClient,
  IntegrationConnectionLinkClientError,
} from "../src/link-client";

describe("browser Link route client", () => {
  test("uses only package-owned Link endpoints and returns safe projections", async () => {
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    const client = createIntegrationConnectionLinkClient({
      basePath: "integrations",
      async fetcher(path, init) {
        requests.push({ path: String(path), init });
        if (String(path).endsWith("/token")) {
          return Response.json({
            integrationId: "plaid",
            linkToken: "short-lived-link-token",
          });
        }
        return Response.json({
          integrationId: "plaid",
          connectionId: "connection-1",
          state: "connected",
          safeNextStep: "The provider connection was completed securely.",
        });
      },
    });

    await expect(client.createToken("plaid")).resolves.toEqual({
      integrationId: "plaid",
      linkToken: "short-lived-link-token",
    });
    await expect(
      client.complete("plaid", "plaid-public-token"),
    ).resolves.toEqual({
      integrationId: "plaid",
      connectionId: "connection-1",
      state: "connected",
      safeNextStep: "The provider connection was completed securely.",
    });
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      path: "/integrations/plaid/link/token",
      init: {
        method: "POST",
        credentials: "same-origin",
        body: "{}",
      },
    });
    expect(requests[1]).toMatchObject({
      path: "/integrations/plaid/link/complete",
      init: {
        body: JSON.stringify({ publicToken: "plaid-public-token" }),
      },
    });
  });

  test("rejects malformed and failed Link route responses without exposing server details", async () => {
    const client = createIntegrationConnectionLinkClient({
      async fetcher() {
        return Response.json({ accessToken: "must-not-be-accepted" });
      },
    });
    await expect(client.createToken("merge")).rejects.toMatchObject({
      name: "IntegrationConnectionLinkClientError",
      code: "INTEGRATION_CONNECTION_LINK_CLIENT_RESPONSE_INVALID",
    } satisfies Partial<IntegrationConnectionLinkClientError>);
  });
});
