import { describe, expect, test } from "bun:test";

import {
  INTEGRATION_CATALOGUE,
  getIntegration,
  getProductIntegrations,
  resolveIntegrationId,
  searchIntegrations,
} from "../src";

describe("integration registry", () => {
  test("has unique canonical IDs and aliases that cannot overlap", () => {
    const canonicalIds = new Set<string>();
    const aliases = new Set<string>();

    for (const integration of INTEGRATION_CATALOGUE) {
      expect(canonicalIds.has(integration.id)).toBeFalse();
      expect(aliases.has(integration.id)).toBeFalse();
      canonicalIds.add(integration.id);
      for (const alias of integration.aliases) {
        expect(canonicalIds.has(alias)).toBeFalse();
        expect(aliases.has(alias)).toBeFalse();
        aliases.add(alias);
      }
    }
  });

  test("resolves legacy aliases to one canonical ID", () => {
    expect(resolveIntegrationId("quick-books")).toBe(
      resolveIntegrationId("quickbooks"),
    );
    expect(getIntegration("quick-books")?.id).toBe("quickbooks");
  });

  test("search is deterministic and includes source operation text", () => {
    const first = searchIntegrations("list vaults");
    const second = searchIntegrations("list vaults");
    expect(first.map((integration) => integration.id)).toEqual(
      second.map((integration) => integration.id),
    );
    expect(
      first.some((integration) => integration.id === "1password"),
    ).toBeTrue();
  });

  test("exposes separate per-product availability metadata", () => {
    const eigenn = getProductIntegrations("eigenn");
    const conduitt = getProductIntegrations("conduitt");
    expect(eigenn).toHaveLength(INTEGRATION_CATALOGUE.length);
    expect(conduitt).toHaveLength(INTEGRATION_CATALOGUE.length);
    expect(
      eigenn.every((entry) => entry.product.product === "eigenn"),
    ).toBeTrue();
    expect(
      conduitt.every((entry) => entry.product.product === "conduitt"),
    ).toBeTrue();
  });

  test("adds the RFC's finance, operations, and data providers without overstating availability", () => {
    const requiredIds = [
      "quickbooks",
      "xero",
      "fortnox",
      "freshbooks",
      "wave",
      "zoho-books",
      "netsuite",
      "plaid",
      "teller",
      "gocardless",
      "enable-banking",
      "mercury",
      "paypal",
      "wise",
      "deel",
      "bamboohr",
      "snowflake",
      "zapier",
      "n8n",
      "make",
      "signed-webhooks",
      "mcp",
    ];
    const ids = new Set(
      INTEGRATION_CATALOGUE.map((integration) => integration.id),
    );
    expect(requiredIds.every((id) => ids.has(id))).toBeTrue();

    for (const product of ["eigenn", "conduitt"] as const) {
      expect(
        getProductIntegrations(product)
          .filter((entry) => requiredIds.includes(entry.definition.id))
          .every((entry) => entry.product.availability === "planned"),
      ).toBeTrue();
    }
  });
});
