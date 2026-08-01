import { describe, expect, test } from "bun:test";

import {
  assertProviderPackCoverage,
  createAirtableMetadataProviderSdk,
  createAirtablePack,
  createCloudflarePack,
  createCloudflareZoneSettingsProviderSdk,
  createIntegrationCredentialReference,
  createVercelEdgeConfigItemsProviderSdk,
  createVercelPack,
} from "../src/server";

interface RecordedRequest {
  path: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
}

function oauthTransport(response: () => Response) {
  const requests: RecordedRequest[] = [];
  return {
    requests,
    runtime: {
      async withCredential<T>(
        _reference: unknown,
        operation: (credential: {
          accessToken: string;
          scope: readonly string[];
          tokenType: string;
        }) => Promise<T>,
      ): Promise<T> {
        return operation({
          accessToken: "token",
          scope: [],
          tokenType: "Bearer",
        });
      },
      async request(request: RecordedRequest & { reference: unknown }) {
        const { reference: _reference, ...rest } = request;
        requests.push(rest);
        return response();
      },
    },
  };
}

function apiKeyTransport(response: () => Response) {
  const requests: RecordedRequest[] = [];
  return {
    requests,
    runtime: {
      async withCredential<T>(
        _reference: unknown,
        operation: (credential: {
          readonly apiKey: string;
          readonly fields: Readonly<Record<string, string>>;
        }) => Promise<T>,
      ): Promise<T> {
        return operation({ apiKey: "key", fields: {} });
      },
      async request(input: { reference: unknown; request: RecordedRequest }) {
        requests.push(input.request);
        return response();
      },
    },
  };
}

const airtableReference = createIntegrationCredentialReference({
  integrationId: "airtable",
  connectionId: "connection_airtable",
  product: "eigenn",
});
const cloudflareReference = createIntegrationCredentialReference({
  integrationId: "cloudflare",
  connectionId: "connection_cloudflare",
  product: "eigenn",
});
const vercelReference = createIntegrationCredentialReference({
  integrationId: "vercel",
  connectionId: "connection_vercel",
  product: "eigenn",
});

describe("closing the SDK coverage gaps", () => {
  test("every gap pack accounts for all of its source actions", () => {
    const oauth = oauthTransport(() => Response.json({}));
    const apiKey = apiKeyTransport(() => Response.json({}));

    expect(() =>
      assertProviderPackCoverage(createAirtablePack(), {
        oauthRuntime: oauth.runtime,
      }),
    ).not.toThrow();
    expect(() =>
      assertProviderPackCoverage(createCloudflarePack(), {
        apiKeyRuntime: apiKey.runtime,
      }),
    ).not.toThrow();
    expect(() =>
      assertProviderPackCoverage(createVercelPack(), {
        apiKeyRuntime: apiKey.runtime,
      }),
    ).not.toThrow();
  });

  test("each gap action is declared on the typed REST lane with an SDK review", () => {
    const packs = [
      { pack: createAirtablePack(), expected: 4 },
      { pack: createCloudflarePack(), expected: 1 },
      { pack: createVercelPack(), expected: 1 },
    ];

    for (const { pack, expected } of packs) {
      const restActions = pack.coverage.filter(
        (entry) => entry.lane === "typed_rest",
      );
      expect(restActions).toHaveLength(expected);
      for (const action of restActions) {
        expect(action.sdkReview?.length).toBeGreaterThan(0);
      }
      // No action may be left unsupported now that the gaps are closed.
      expect(
        pack.coverage.filter((entry) => entry.disposition === "deferred"),
      ).toEqual([]);
    }
  });

  test("reads Airtable bases through the metadata endpoint", async () => {
    const oauth = oauthTransport(() =>
      Response.json({ bases: [{ id: "app1", name: "Ops" }], offset: "next" }),
    );
    const provider = createAirtableMetadataProviderSdk({
      oauthRuntime: oauth.runtime,
    });

    const result = await provider.execute({
      integrationId: "airtable",
      operationId: "airtable:list-bases",
      reference: airtableReference,
      input: {},
    });

    expect(result.output).toEqual({
      bases: [{ id: "app1", name: "Ops" }],
      offset: "next",
    });
    expect(oauth.requests[0]?.path).toBe("/meta/bases");
    expect(JSON.stringify(oauth.requests[0])).not.toContain("token");
  });

  test("projects list-tables without the per-field detail get-base-schema returns", async () => {
    const body = {
      tables: [
        {
          id: "tbl1",
          name: "Invoices",
          primaryFieldId: "fld1",
          fields: [{ id: "fld1", name: "Name" }],
          views: [{ id: "viw1", name: "Grid" }],
        },
      ],
    };
    const oauth = oauthTransport(() => Response.json(body));
    const provider = createAirtableMetadataProviderSdk({
      oauthRuntime: oauth.runtime,
    });

    const listed = await provider.execute({
      integrationId: "airtable",
      operationId: "airtable:list-tables",
      reference: airtableReference,
      input: { baseId: "app1" },
    });
    const schema = await provider.execute({
      integrationId: "airtable",
      operationId: "airtable:get-base-schema",
      reference: airtableReference,
      input: { baseId: "app1" },
    });

    expect(listed.output).toEqual({
      tables: [{ id: "tbl1", name: "Invoices", primaryFieldId: "fld1" }],
    });
    expect(schema.output).toEqual(body);
    expect(oauth.requests.map((request) => request.path)).toEqual([
      "/meta/bases/app1/tables",
      "/meta/bases/app1/tables",
    ]);
  });

  test("sends the Airtable upsert merge fields and rejects an oversized batch", async () => {
    const oauth = oauthTransport(() =>
      Response.json({ records: [{ id: "rec1" }], updatedRecords: ["rec1"] }),
    );
    const provider = createAirtableMetadataProviderSdk({
      oauthRuntime: oauth.runtime,
    });

    await provider.execute({
      integrationId: "airtable",
      operationId: "airtable:upsert-records",
      reference: airtableReference,
      input: {
        baseId: "app1",
        tableId: "tbl1",
        records: [{ fields: { Name: "Acme" } }],
        fieldsToMergeOn: ["Name"],
      },
    });

    expect(oauth.requests[0]?.method).toBe("PATCH");
    expect(oauth.requests[0]?.path).toBe("/app1/tbl1");
    expect(JSON.parse(String(oauth.requests[0]?.body))).toEqual({
      performUpsert: { fieldsToMergeOn: ["Name"] },
      records: [{ fields: { Name: "Acme" } }],
    });

    await expect(
      provider.execute({
        integrationId: "airtable",
        operationId: "airtable:upsert-records",
        reference: airtableReference,
        input: {
          baseId: "app1",
          tableId: "tbl1",
          records: Array.from({ length: 11 }, () => ({ fields: {} })),
          fieldsToMergeOn: ["Name"],
        },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
  });

  test("reads the whole Cloudflare zone-settings collection", async () => {
    const apiKey = apiKeyTransport(() =>
      Response.json({
        success: true,
        result: [{ id: "ssl", value: "full", editable: true }],
      }),
    );
    const provider = createCloudflareZoneSettingsProviderSdk({
      apiKeyRuntime: apiKey.runtime,
    });

    const result = await provider.execute({
      integrationId: "cloudflare",
      operationId: "cloudflare:get-zone-settings",
      reference: cloudflareReference,
      input: { zoneId: "zone_1" },
    });

    expect(result.output).toMatchObject({ success: true });
    expect(apiKey.requests[0]?.path).toBe("/zones/zone_1/settings");
    expect(JSON.stringify(apiKey.requests[0])).not.toContain("key");
  });

  test("writes Vercel Edge Config items with team scope preserved", async () => {
    const apiKey = apiKeyTransport(() => Response.json({ status: "ok" }));
    const provider = createVercelEdgeConfigItemsProviderSdk({
      apiKeyRuntime: apiKey.runtime,
    });

    await provider.execute({
      integrationId: "vercel",
      operationId: "vercel:update-edge-config-items",
      reference: vercelReference,
      input: {
        edgeConfigId: "ecfg_1",
        teamId: "team_1",
        items: [
          { operation: "upsert", key: "flag", value: true },
          { operation: "delete", key: "old" },
        ],
      },
    });

    expect(apiKey.requests[0]?.method).toBe("PATCH");
    expect(apiKey.requests[0]?.path).toBe(
      "/v1/edge-config/ecfg_1/items?teamId=team_1",
    );
  });

  test("rejects an Edge Config delete carrying a value", async () => {
    const apiKey = apiKeyTransport(() => Response.json({ status: "ok" }));
    const provider = createVercelEdgeConfigItemsProviderSdk({
      apiKeyRuntime: apiKey.runtime,
    });

    await expect(
      provider.execute({
        integrationId: "vercel",
        operationId: "vercel:update-edge-config-items",
        reference: vercelReference,
        input: {
          edgeConfigId: "ecfg_1",
          items: [{ operation: "delete", key: "old", value: "unexpected" }],
        },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
    expect(apiKey.requests).toEqual([]);
  });
});
