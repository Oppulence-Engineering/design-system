import { describe, expect, test } from "bun:test";

import {
  buildIntegrationDirectory,
  createIntegrationDirectoryResolver,
  filterIntegrationDirectory,
  getConnectionAttentionCount,
} from "../src/connection";
import { IntegrationDefinitionSchema } from "../src/contracts";
import { EXECUTABLE_INTEGRATION_ID_SET } from "../src/executable";

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

    // An integration the package can execute has to be offerable, and one it
    // cannot has to stay planned. Before the catalogue derived availability
    // from the registry every entry was planned, so the directory rendered no
    // connect action however many providers actually shipped.
    const [executable, planned] = [
      directory.entries.filter((entry) =>
        EXECUTABLE_INTEGRATION_ID_SET.has(entry.integration.id),
      ),
      directory.entries.filter(
        (entry) => !EXECUTABLE_INTEGRATION_ID_SET.has(entry.integration.id),
      ),
    ];
    expect(executable.length).toBeGreaterThan(0);
    expect(planned.length).toBeGreaterThan(0);
    expect(
      executable.every(
        (entry) =>
          entry.availability === "available" &&
          entry.primaryAction === "connect",
      ),
    ).toBeTrue();
    expect(
      planned.every(
        (entry) =>
          entry.availability === "planned" && entry.primaryAction === undefined,
      ),
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

describe("directory filtering", () => {
  const directory = buildIntegrationDirectory({
    product: "eigenn",
    connections: [],
  });

  test("narrows by query, category, and availability together", () => {
    const all = filterIntegrationDirectory(directory.entries);
    expect(all.entries).toHaveLength(directory.entries.length);

    const connectable = filterIntegrationDirectory(directory.entries, {
      availability: ["available"],
    });
    expect(connectable.entries.length).toBeGreaterThan(0);
    expect(
      connectable.entries.every((entry) => entry.primaryAction === "connect"),
    ).toBeTrue();
    // Every connectable entry is one the package can actually execute.
    expect(
      connectable.entries.every((entry) =>
        EXECUTABLE_INTEGRATION_ID_SET.has(entry.integration.id),
      ),
    ).toBeTrue();

    const analytics = filterIntegrationDirectory(directory.entries, {
      category: "analytics",
    });
    expect(analytics.entries.length).toBeGreaterThan(0);
    expect(
      analytics.entries.every(
        (entry) => entry.integration.category === "analytics",
      ),
    ).toBeTrue();

    // Filters compose rather than replace one another.
    const both = filterIntegrationDirectory(directory.entries, {
      category: "analytics",
      availability: ["available"],
    });
    expect(both.entries.length).toBeGreaterThan(0);
    expect(both.entries.length).toBeLessThanOrEqual(analytics.entries.length);
  });

  test("matches the query case-insensitively and ignores surrounding space", () => {
    const exact = filterIntegrationDirectory(directory.entries, {
      query: "posthog",
    });
    const padded = filterIntegrationDirectory(directory.entries, {
      query: "  PostHog  ",
    });
    expect(exact.entries.length).toBeGreaterThan(0);
    expect(padded.entries.map((entry) => entry.integration.id)).toEqual(
      exact.entries.map((entry) => entry.integration.id),
    );
    expect(
      exact.entries.some((entry) => entry.integration.id === "posthog"),
    ).toBeTrue();
  });

  test("counts facets over the filtered entries, not the whole catalogue", () => {
    const analytics = filterIntegrationDirectory(directory.entries, {
      category: "analytics",
    });
    const counted = [...analytics.facets.categories.entries()];
    expect(counted).toHaveLength(1);
    expect(counted[0]).toEqual(["analytics", analytics.entries.length]);

    const availability = [...analytics.facets.availability.values()].reduce(
      (total, count) => total + count,
      0,
    );
    expect(availability).toBe(analytics.entries.length);
  });

  test("an unmatched query yields no entries and no facet buckets", () => {
    const none = filterIntegrationDirectory(directory.entries, {
      query: "no-such-integration-zzz",
    });
    expect(none.entries).toEqual([]);
    expect([...none.facets.categories.keys()]).toEqual([]);
    expect([...none.facets.availability.keys()]).toEqual([]);
  });
});
