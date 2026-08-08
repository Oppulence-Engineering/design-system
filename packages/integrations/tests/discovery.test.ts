import { describe, expect, test } from "bun:test";

import { IntegrationDefinitionSchema } from "../src/contracts";
import {
  createIntegrationDiscoveryManifest,
  getIntegrationCredentials,
  getIntegrationDiscovery,
  getIntegrationSurfaces,
  IntegrationDiscoveryDetailSchema,
  serializeIntegrationDiscoveryManifest,
} from "../src/discovery";
import { INTEGRATION_CATALOGUE } from "../src/catalog";

describe("integration discovery metadata", () => {
  test("publishes complete metadata for the pilot providers", () => {
    for (const integrationId of [
      "stripe",
      "slack",
      "github",
      "gmail",
      "postgresql",
    ]) {
      const detail = getIntegrationDiscovery(integrationId);
      expect(detail?.surfaces.length).toBeGreaterThan(0);
      expect(Object.keys(detail?.credentials ?? {}).length).toBeGreaterThan(0);
      expect(detail?.evidence.length).toBeGreaterThan(0);
    }
  });

  test("requires every surface credential and evidence reference to resolve", () => {
    for (const definition of INTEGRATION_CATALOGUE) {
      expect(() => IntegrationDefinitionSchema.parse(definition)).not.toThrow();
      const detail = getIntegrationDiscovery(definition.id);
      expect(detail).toBeDefined();
      expect(() =>
        IntegrationDiscoveryDetailSchema.parse(detail),
      ).not.toThrow();
    }
  });

  test("creates a deterministic machine-readable discovery manifest", () => {
    const manifest = createIntegrationDiscoveryManifest(
      undefined,
      "2026-08-08T00:00:00.000Z",
    );
    const serialized = serializeIntegrationDiscoveryManifest(manifest);
    expect(manifest.integrations.length).toBe(INTEGRATION_CATALOGUE.length);
    expect(serialized).toContain('"version": 1');
    expect(serialized).toContain("stripe-http");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("secret-key-value");
  });

  test("exposes surface and credential lookup helpers", () => {
    expect(
      getIntegrationSurfaces("stripe").map((surface) => surface.id),
    ).toEqual(["stripe-http"]);
    expect(Object.keys(getIntegrationCredentials("stripe"))).toEqual([
      "stripe-secret-key",
    ]);
    expect(getIntegrationSurfaces("does-not-exist")).toEqual([]);
    expect(getIntegrationDiscovery("bamboo-hr")?.id).toBe("bamboohr");
  });

  test("rejects insecure surface metadata and dangling credential references", () => {
    const stripe = getIntegrationDiscovery("stripe");
    expect(stripe).toBeDefined();
    if (!stripe) return;
    const invalid = {
      ...stripe,
      surfaces: [
        {
          ...stripe.surfaces[0],
          endpoint: "http://example.test",
          auth: {
            status: "required" as const,
            alternatives: [
              {
                uses: [
                  { credentialId: "missing", placement: "header" as const },
                ],
              },
            ],
          },
        },
      ],
      credentials: {},
    };
    expect(
      IntegrationDiscoveryDetailSchema.safeParse(invalid).success,
    ).toBeFalse();
  });

  test("rejects cross-provider IDs and unsafe documentation paths", () => {
    const stripe = getIntegrationDiscovery("stripe");
    expect(stripe).toBeDefined();
    if (!stripe) return;
    expect(
      IntegrationDiscoveryDetailSchema.safeParse({
        ...stripe,
        products: [
          {
            ...stripe.products[0],
            documentationPath: "/\\\\evil.example/docs",
          },
        ],
        operations: [
          { ...stripe.operations[0], id: "github:list-repositories" },
        ],
      }).success,
    ).toBeFalse();
  });
});
