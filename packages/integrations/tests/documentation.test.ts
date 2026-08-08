import { describe, expect, test } from "bun:test";

import { IntegrationDefinitionSchema } from "../src/contracts";
import {
  createPublicIntegrationManifest,
  serializePublicIntegrationManifest,
} from "../src/documentation";
import {
  assertIntegrationOutcomeReadiness,
  getIntegrationOutcomeReadiness,
} from "../src/templates";
import { IntegrationSupportContractSchema } from "../src/support";

const functionalExtraDefinition = IntegrationDefinitionSchema.parse({
  id: "functional-extra",
  aliases: [],
  name: "Functional extra",
  category: "accounting",
  summary: "A functional provider outside the Sim Studio baseline.",
  capabilities: ["ledger_actuals"],
  operations: [
    {
      id: "functional-extra:import-actuals",
      label: "Import actuals",
      description: "Imports reconciled accounting actuals.",
      requiredCapabilities: ["ledger_actuals"],
    },
  ],
  triggers: [],
  products: [
    {
      product: "eigenn",
      availability: "shipped",
      authMethods: ["oauth2"],
      enabledCapabilities: ["ledger_actuals"],
      setup: [],
    },
  ],
  sourceParity: [{ source: "oppulence" }],
});

const functionalExtraContract = IntegrationSupportContractSchema.parse({
  integrationId: "functional-extra",
  product: "eigenn",
  owner: "Eigenn integrations",
  connectionModes: ["oauth2"],
  syncMode: "polling",
  outcome: "Forecast variance uses reconciled accounting actuals.",
  dataContracts: [
    {
      id: "ledger-actuals-v1",
      schemaVersion: "1",
      objectOrMetric: "ledger actual",
      fieldClassification: "sensitive",
      normalizationRule: "Normalize to the organization currency.",
      permittedUse: "Forecast variance.",
      retentionDeletionOwner: "Eigenn",
      sourceToOutputLineage: "Connection to a scenario driver.",
      productImpact: {
        product: "eigenn",
        modelDriver: "Monthly actuals",
        timeGrain: "monthly",
        currencyOrUnits: "Organization currency",
        historicalCoverage: "24 months",
        refreshTimestampField: "lastSuccessfulSyncAt",
        forecastingUse: "Forecast variance explanation",
      },
    },
  ],
  operations: [
    {
      sourceOperationId: "functional-extra:import-actuals",
      disposition: "supported",
      outcome: "Forecast variance uses reconciled accounting actuals.",
      dataContractIds: ["ledger-actuals-v1"],
    },
  ],
  triggers: [],
  entitlementPolicy: {
    eligiblePlans: ["growth"],
    requiredRoles: ["connect"],
    dataRegionPolicy: "Data remains in the selected Eigenn region.",
  },
  serviceLevel: {
    initialSyncExpectedWithinMinutes: 30,
    normalRefreshCadenceMinutes: 60,
    maximumFreshnessMinutes: 120,
    retryClass: "standard",
    backfillWindowDays: 90,
    degradationBehavior: "Mark dependent forecasts stale.",
    recoveryActions: ["reconnect", "sync_now"],
    ownerSurface: "Eigenn on-call",
  },
});

describe("public documentation manifest", () => {
  test("is derived from the registry and excludes connection or credential state", () => {
    const manifest = createPublicIntegrationManifest(
      undefined,
      "2026-07-31T00:00:00.000Z",
    );
    const serialized = serializePublicIntegrationManifest(manifest);
    expect(manifest.integrations).toHaveLength(261);
    expect(manifest.details).toHaveLength(261);
    expect(manifest.parity).toEqual({
      totalProviders: 261,
      providers: 232,
      matched: 232,
      extras: 29,
      catalogueOnly: 261,
      functionallySupported: 0,
      operationOrTriggerSupported: 0,
      catalogueOnlySimStudio: 232,
      functionallySupportedSimStudio: 0,
      operationOrTriggerSupportedSimStudio: 0,
    });
    expect(
      manifest.integrations.find(
        (integration) => integration.id === "quickbooks",
      ),
    ).toBeDefined();
    expect(serialized).not.toContain("permittedActions");
    expect(serialized).not.toContain("accountLabel");
    expect(serialized).not.toContain("accessToken");
  });

  test("counts functional Oppulence-specific providers outside the Sim Studio baseline", () => {
    const manifest = createPublicIntegrationManifest(
      [functionalExtraDefinition],
      "2026-07-31T00:00:00.000Z",
      [functionalExtraContract],
    );

    expect(manifest.parity).toMatchObject({
      totalProviders: 1,
      providers: 232,
      matched: 0,
      extras: 1,
      catalogueOnly: 0,
      functionallySupported: 1,
      operationOrTriggerSupported: 1,
      catalogueOnlySimStudio: 0,
      functionallySupportedSimStudio: 0,
      operationOrTriggerSupportedSimStudio: 0,
    });
  });

  test("reports outcome readiness separately from catalogue presence", () => {
    const outcomeTemplate = {
      id: "functional-extra-eigenn-actuals",
      integrationId: "functional-extra",
      product: "eigenn" as const,
      name: "Forecast actuals",
      summary: "Use imported actuals to explain forecast variance.",
      sourceOperationId: "functional-extra:import-actuals",
      dataContractId: "ledger-actuals-v1",
      requiredCapability: "ledger_actuals" as const,
      successMetric: "Forecast variance includes reconciled actuals.",
    };
    const readiness = getIntegrationOutcomeReadiness(
      [functionalExtraDefinition],
      [functionalExtraContract],
      [outcomeTemplate],
    );
    expect(readiness).toHaveLength(1);
    expect(readiness.find((entry) => entry.product === "eigenn")).toEqual(
      expect.objectContaining({
        integrationId: "functional-extra",
        hasSupportContract: true,
        supportedOperations: 1,
        ready: true,
        issues: [],
      }),
    );

    const catalogueOnly = getIntegrationOutcomeReadiness(
      [functionalExtraDefinition],
      [],
    );
    expect(
      catalogueOnly.find((entry) => entry.product === "eigenn"),
    ).toMatchObject({
      ready: false,
      hasSupportContract: false,
    });

    expect(
      getIntegrationOutcomeReadiness(
        [functionalExtraDefinition],
        [functionalExtraContract],
      ).find((entry) => entry.product === "eigenn"),
    ).toMatchObject({
      ready: false,
      outcomeTemplateCount: 0,
    });
  });
});

test("outcome readiness can be enforced as a release gate", () => {
  expect(() =>
    assertIntegrationOutcomeReadiness(
      [functionalExtraDefinition],
      [functionalExtraContract],
      [],
    ),
  ).toThrow("Integration outcome readiness is incomplete");
  expect(() =>
    assertIntegrationOutcomeReadiness(
      [functionalExtraDefinition],
      [functionalExtraContract],
      [
        {
          id: "actuals-to-variance",
          integrationId: "functional-extra",
          product: "eigenn",
          name: "Actuals to variance",
          summary: "Use actuals to explain a forecast variance.",
          sourceOperationId: "functional-extra:import-actuals",
          dataContractId: "ledger-actuals-v1",
          requiredCapability: "ledger_actuals",
          successMetric: "Forecast variance is reconciled.",
        },
      ],
    ),
  ).not.toThrow();
});
