import { describe, expect, test } from "bun:test";
import { z } from "zod";

import {
  createIntegrationCredentialReference,
  createIntegrationProviderExecutionRoutes,
  createIntegrationProviderSdkRegistry,
  createIntegrationSpecialProvider,
  createIntegrationTypedRestProvider,
  type IntegrationProviderSdk,
} from "../src/server";

const notionReference = createIntegrationCredentialReference({
  integrationId: "notion",
  connectionId: "connection_notion",
  product: "eigenn",
});

describe("provider execution lanes", () => {
  test("executes typed REST tools through the OAuth runtime without exposing credentials", async () => {
    const requests: Array<{
      path: string;
      method?: string;
      headers?: HeadersInit;
      body?: BodyInit | null;
    }> = [];
    const provider = createIntegrationTypedRestProvider({
      integrationId: "notion",
      transport: {
        kind: "oauth2",
        runtime: {
          async request(request) {
            requests.push(request);
            return Response.json({ id: "page_123", title: "Q3 plan" });
          },
        },
      },
      tools: [
        {
          id: "notion:create-page",
          name: "Create page",
          description: "Creates a page in Notion.",
          version: "1.0.0",
          params: {
            title: {
              type: "string",
              required: true,
              visibility: "user-or-llm",
            },
          },
          outputs: {
            pageId: { type: "string" },
            title: { type: "string" },
          },
          request: {
            method: "POST",
            url: () => "/v1/pages",
            headers: () => ({}),
            body: (input) => ({ title: input.title }),
          },
          transformResponse: async (response) => {
            expect(response.status).toBe(200);
            expect(response.ok).toBe(true);
            const body = (await response.json()) as {
              id: string;
              title: string;
            };
            return { pageId: body.id, title: body.title };
          },
        },
      ],
    });

    const result = await provider.execute({
      integrationId: "notion",
      operationId: "notion:create-page",
      reference: notionReference,
      input: { title: "Q3 plan" },
    });

    expect(provider.executionLane).toBe("typed_rest");
    expect(result).toEqual({
      operationId: "notion:create-page",
      output: { pageId: "page_123", title: "Q3 plan" },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.path).toBe("/v1/pages");
    expect(requests[0]?.method).toBe("POST");
    expect(new Headers(requests[0]?.headers).get("content-type")).toBe(
      "application/json",
    );
    expect(requests[0]?.body).toBe('{"title":"Q3 plan"}');
    expect(JSON.stringify(requests[0])).not.toContain("accessToken");
  });

  test("bounds typed REST response bodies before a transform can consume them", async () => {
    const provider = createIntegrationTypedRestProvider({
      integrationId: "notion",
      transport: {
        kind: "oauth2",
        runtime: {
          async request() {
            return new Response("x".repeat(2_048), {
              headers: { "content-length": "2048" },
            });
          },
        },
      },
      tools: [
        {
          id: "notion:read-page",
          name: "Read page",
          description: "Reads a Notion page.",
          version: "1.0.0",
          params: {},
          inputSchema: z.object({}).strict(),
          request: {
            method: "GET",
            url: () => "/v1/pages/page_123",
            headers: () => ({}),
          },
          maxResponseBytes: 1_024,
          transformResponse: async (response) => ({
            content: await response.text(),
          }),
          outputSchema: z.object({ content: z.string() }).strict(),
        },
      ],
    });

    await expect(
      provider.execute({
        integrationId: "notion",
        operationId: "notion:read-page",
        reference: notionReference,
        input: {},
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_EXECUTION_RESPONSE_INVALID",
    });
  });

  test("composes SDK and special-protocol operations behind one provider route", async () => {
    const sdkProvider: IntegrationProviderSdk = {
      integrationId: "notion",
      operationIds: ["notion:sdk-operation"],
      async execute(input) {
        return { operationId: input.operationId, output: { lane: "sdk" } };
      },
    };
    const specialProvider = createIntegrationSpecialProvider({
      integrationId: "notion",
      operationIds: ["notion:special-operation"],
      async execute(input) {
        return {
          operationId: input.operationId,
          output: { lane: "special" },
        };
      },
    });
    const registry = createIntegrationProviderSdkRegistry([
      sdkProvider,
      specialProvider,
    ]);

    expect(registry.get("notion")?.operationIds).toEqual([
      "notion:sdk-operation",
      "notion:special-operation",
    ]);
    expect(registry.getExecutionLane("notion", "notion:sdk-operation")).toBe(
      "sdk",
    );
    expect(
      registry.getExecutionLane("notion", "notion:special-operation"),
    ).toBe("special");
    await expect(
      registry.execute({
        integrationId: "notion",
        operationId: "notion:special-operation",
        reference: notionReference,
        input: {},
      }),
    ).resolves.toEqual({
      operationId: "notion:special-operation",
      output: { lane: "special" },
    });
  });

  test("mounts typed REST execution on the standard product-authorized route", async () => {
    const provider = createIntegrationTypedRestProvider({
      integrationId: "notion",
      transport: {
        kind: "oauth2",
        runtime: {
          async request() {
            return Response.json({ id: "page_from_route" });
          },
        },
      },
      tools: [
        {
          id: "notion:read-page",
          name: "Read page",
          description: "Reads a Notion page.",
          version: "1.0.0",
          params: {
            pageId: { type: "string", required: true },
          },
          inputSchema: z.object({ pageId: z.string() }).strict(),
          request: {
            method: "GET",
            url: (input) => `/v1/pages/${encodeURIComponent(input.pageId)}`,
            headers: () => ({}),
          },
          transformResponse: async (response) => ({
            pageId: ((await response.json()) as { id: string }).id,
          }),
          outputSchema: z.object({ pageId: z.string() }).strict(),
        },
      ],
    });
    const routes = createIntegrationProviderExecutionRoutes({
      providerRegistry: createIntegrationProviderSdkRegistry([provider]),
      async resolveSubject() {
        return { product: "eigenn", subjectId: "team_123" };
      },
      async authorizeExecution(subject, execution) {
        expect(subject).toEqual({ product: "eigenn", subjectId: "team_123" });
        expect(execution).toEqual({
          integrationId: "notion",
          connectionId: "connection_notion",
          operationId: "notion:read-page",
        });
      },
    });

    const response = await routes.handle(
      new Request(
        "https://app.example/integrations/notion/connections/connection_notion/operations/notion:read-page",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: { pageId: "page_123" } }),
        },
      ),
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      operationId: "notion:read-page",
      output: { pageId: "page_from_route" },
    });
  });
});
