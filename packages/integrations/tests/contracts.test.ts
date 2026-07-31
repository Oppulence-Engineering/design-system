import { describe, expect, test } from "bun:test";

import {
  IntegrationConnectionProjectionSchema,
  IntegrationDefinitionSchema,
} from "../src/contracts";

describe("public contracts", () => {
  test("rejects a product capability that the provider does not declare", () => {
    const result = IntegrationDefinitionSchema.safeParse({
      id: "example-provider",
      aliases: [],
      name: "Example provider",
      category: "accounting",
      summary: "Example",
      capabilities: ["ledger_actuals"],
      operations: [],
      triggers: [],
      products: [
        {
          product: "eigenn",
          availability: "planned",
          authMethods: ["oauth2"],
          enabledCapabilities: ["cash_position"],
          setup: [],
        },
      ],
      sourceParity: [{ source: "oppulence" }],
    });
    expect(result.success).toBeFalse();
  });

  test("rejects secret-shaped connection payload fields through its strict boundary", () => {
    const result = IntegrationConnectionProjectionSchema.safeParse({
      id: "connection-1",
      integrationId: "quickbooks",
      product: "eigenn",
      displayName: "Finance",
      state: "healthy",
      enabledCapabilities: [],
      permittedActions: ["inspect"],
      accessToken: "must-not-cross-the-contract-boundary",
    });
    expect(result.success).toBeFalse();
  });
});
