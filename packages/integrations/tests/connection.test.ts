import { describe, expect, test } from "bun:test";

import {
  buildIntegrationDirectory,
  createIntegrationDirectoryResolver,
  getConnectionAttentionCount,
} from "../src/connection";
import { IntegrationDefinitionSchema } from "../src/contracts";

const testDefinition = IntegrationDefinitionSchema.parse({
  id: "test-provider",
  aliases: ["legacy-provider"],
  name: "Test Provider",
  category: "accounting",
  summary: "A test integration.",
  capabilities: ["ledger_actuals", "source_provenance"],
  operations: [],
  triggers: [],
  products: [
    {
      product: "eigenn",
      availability: "beta",
      authMethods: ["oauth2"],
      enabledCapabilities: ["ledger_actuals"],
      setup: [],
      documentationPath: "/integrations/test-provider",
    },
  ],
  sourceParity: [{ source: "oppulence" }],
});

describe("directory resolver seam", () => {
  test("groups multiple authorized connections and preserves attention state", () => {
    const directory = buildIntegrationDirectory({
      product: "eigenn",
      definitions: [testDefinition],
      connections: [
        {
          id: "connection-healthy",
          integrationId: "test-provider",
          product: "eigenn",
          displayName: "Primary books",
          state: "healthy",
          enabledCapabilities: ["ledger_actuals"],
          permittedActions: ["inspect"],
        },
        {
          id: "connection-stale",
          integrationId: "test-provider",
          product: "eigenn",
          displayName: "Subsidiary books",
          state: "stale",
          enabledCapabilities: ["ledger_actuals"],
          sourceFreshness: {
            state: "stale",
            lastSuccessfulSyncAt: "2026-07-31T12:00:00.000Z",
          },
          permittedActions: ["reconnect", "inspect"],
        },
      ],
    });

    expect(directory.entries[0]?.connections).toHaveLength(2);
    expect(directory.entries[0]?.availability).toBe("connected");
    expect(directory.entries[0]?.primaryAction).toBe("reconnect");
    expect(getConnectionAttentionCount(directory)).toBe(1);
  });

  test("keeps disconnected records visible and routes the primary action to recovery", () => {
    const directory = buildIntegrationDirectory({
      product: "eigenn",
      definitions: [testDefinition],
      connections: [
        {
          id: "connection-disconnected",
          integrationId: "test-provider",
          product: "eigenn",
          displayName: "Former primary books",
          state: "disconnected",
          enabledCapabilities: ["ledger_actuals"],
          permittedActions: ["reconnect", "inspect"],
        },
      ],
    });

    expect(directory.entries[0]?.availability).toBe("disconnected");
    expect(directory.entries[0]?.primaryAction).toBe("reconnect");
    expect(getConnectionAttentionCount(directory)).toBe(0);
  });

  test("rejects unknown providers, wrong products, and unsupported capabilities", () => {
    const invalid = (projection: Record<string, unknown>) =>
      expect(() =>
        buildIntegrationDirectory({
          product: "eigenn",
          definitions: [testDefinition],
          connections: [projection as never],
        }),
      ).toThrow();

    invalid({
      id: "unknown",
      integrationId: "not-in-registry",
      product: "eigenn",
      displayName: "Unknown",
      state: "healthy",
      enabledCapabilities: [],
      permittedActions: [],
    });
    invalid({
      id: "wrong-product",
      integrationId: "test-provider",
      product: "conduitt",
      displayName: "Wrong product",
      state: "healthy",
      enabledCapabilities: [],
      permittedActions: [],
    });
    invalid({
      id: "wrong-capability",
      integrationId: "test-provider",
      product: "eigenn",
      displayName: "Wrong capability",
      state: "healthy",
      enabledCapabilities: ["cash_position"],
      permittedActions: [],
    });
  });

  test("creates a product-owned async resolver without receiving a database client", async () => {
    const resolveDirectory = createIntegrationDirectoryResolver({
      product: "eigenn",
      resolver: {
        async listAuthorizedConnections() {
          return [];
        },
      },
    });
    const directory = await resolveDirectory({ actorId: "actor-1" });
    expect(directory.product).toBe("eigenn");
    expect(directory.entries.length).toBeGreaterThan(0);
    expect(
      directory.entries.every((entry) => entry.availability === "planned"),
    ).toBeTrue();
    expect(
      directory.entries.every((entry) => entry.primaryAction === undefined),
    ).toBeTrue();
  });

  test("keeps long-form source descriptors out of the directory summary", () => {
    const directory = buildIntegrationDirectory({
      product: "eigenn",
      connections: [],
    });
    const onePassword = directory.entries.find(
      (entry) => entry.integration.id === "1password",
    )!;

    expect(onePassword.integration.searchText).toContain("list vaults");
    expect(onePassword.integration).not.toHaveProperty("operations");
    expect(onePassword.integration).not.toHaveProperty("triggers");
    expect(onePassword.integration).not.toHaveProperty("sourceParity");
  });
});
