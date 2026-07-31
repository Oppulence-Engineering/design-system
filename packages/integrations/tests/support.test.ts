import { describe, expect, test } from "bun:test";

import { IntegrationDefinitionSchema } from "../src/contracts";
import {
  ConnectResultSchema,
  assertOperationTriggerCoverage,
  getFunctionallySupportedIntegrationIds,
  getOperationTriggerCoverageReport,
  IntegrationSupportContractSchema,
  validateFunctionalSupportContracts,
} from "../src/support";
import { validateOutcomeTemplates } from "../src/templates";

const functionalDefinition = IntegrationDefinitionSchema.parse({
  id: "functional-provider",
  aliases: [],
  name: "Functional Provider",
  category: "accounting",
  summary: "A fully owned test provider.",
  capabilities: ["ledger_actuals"],
  operations: [
    {
      id: "functional-provider:import-actuals",
      label: "Import actuals",
      description: "Imports actuals.",
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

const contract = IntegrationSupportContractSchema.parse({
  integrationId: "functional-provider",
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
      normalizationRule: "Normalize to monthly organization currency.",
      permittedUse: "Forecast variance.",
      retentionDeletionOwner: "Eigenn",
      sourceToOutputLineage: "Connection to scenario driver.",
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
      sourceOperationId: "functional-provider:import-actuals",
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

describe("functional provider controls", () => {
  test("keeps connector commands browser-safe and rejects raw OAuth handoffs", () => {
    expect(
      ConnectResultSchema.safeParse({
        state: "redirect",
        safeNextStep: "Continue the server-owned connection handoff.",
        redirectPath: "/settings/integrations/quickbooks/connect",
      }).success,
    ).toBeTrue();
    expect(
      ConnectResultSchema.safeParse({
        state: "redirect",
        safeNextStep: "Do not expose an OAuth URL to this contract.",
        redirectPath: "https://provider.example/authorize?state=secret",
      }).success,
    ).toBeFalse();
    expect(
      ConnectResultSchema.safeParse({
        state: "redirect",
        safeNextStep: "Do not expose a protocol-relative handoff either.",
        redirectPath: "//provider.example/authorize",
      }).success,
    ).toBeFalse();
    expect(
      ConnectResultSchema.safeParse({
        state: "connected",
        safeNextStep: "Connection is available.",
        accessToken: "must-not-cross-the-contract-boundary",
      }).success,
    ).toBeFalse();
  });

  test("requires a support contract before shipped metadata is valid", () => {
    expect(() =>
      validateFunctionalSupportContracts([functionalDefinition], []),
    ).toThrow("has no support contract");
    expect(() =>
      validateFunctionalSupportContracts([functionalDefinition], [contract]),
    ).not.toThrow();
  });

  test("counts functional parity only when product metadata and a support contract agree", () => {
    expect(
      getFunctionallySupportedIntegrationIds([functionalDefinition], []),
    ).toEqual(new Set());
    expect(
      getFunctionallySupportedIntegrationIds(
        [functionalDefinition],
        [contract],
      ),
    ).toEqual(new Set(["functional-provider"]));
  });

  test("does not count an invalid connector contract as functional parity", () => {
    const invalidConnectionMode = {
      ...contract,
      connectionModes: ["api_key"] as const,
    };
    expect(
      getFunctionallySupportedIntegrationIds(
        [functionalDefinition],
        [invalidConnectionMode],
      ),
    ).toEqual(new Set());
    expect(() =>
      validateFunctionalSupportContracts(
        [functionalDefinition],
        [invalidConnectionMode],
      ),
    ).toThrow("uses unsupported connection mode api_key");
  });

  test("requires a real data or governed-action reference for every supported path", () => {
    const operationWithoutContract = {
      ...contract,
      dataContracts: [],
      operations: [
        {
          sourceOperationId: "functional-provider:import-actuals",
          disposition: "supported",
          outcome: "Forecast variance uses reconciled accounting actuals.",
        },
      ],
    };
    expect(
      IntegrationSupportContractSchema.safeParse(operationWithoutContract)
        .success,
    ).toBeFalse();

    const actionOnlyContract = {
      ...contract,
      dataContracts: [],
      actionContracts: [
        {
          id: "functional-provider:import-command",
          command: "importAccountingActuals",
          authorizationPolicy: "Require the Eigenn connect permission.",
          idempotencyKey: "connectionId:period",
          auditEvent: "integration.actuals.import.requested",
          sourceToOutputLineage:
            "Authorized connection to forecast-variance refresh request.",
        },
      ],
      operations: [
        {
          sourceOperationId: "functional-provider:import-actuals",
          disposition: "supported",
          outcome: "Forecast variance uses reconciled accounting actuals.",
          actionContractId: "functional-provider:import-command",
        },
      ],
    };
    expect(
      IntegrationSupportContractSchema.safeParse(actionOnlyContract).success,
    ).toBeTrue();
  });

  test("keeps data-impact evidence in its owning product support contract", () => {
    const productMismatch = {
      ...contract,
      dataContracts: [
        {
          ...contract.dataContracts[0],
          productImpact: {
            product: "conduitt",
            evidenceRecord: "Imported actuals evidence",
            actionPolicy: "Require approved collection policy.",
            idempotencyKey: "connectionId:period",
            auditEvent: "conduitt.actuals.imported",
          },
        },
      ],
    };
    expect(
      IntegrationSupportContractSchema.safeParse(productMismatch).success,
    ).toBeFalse();
  });

  test("reports explicit operation and trigger dispositions for functional providers", () => {
    const report = getOperationTriggerCoverageReport(
      [functionalDefinition],
      [contract],
    );
    expect(report.operations).toEqual({
      total: 1,
      explicit: 1,
      supported: 1,
      intentionallyNotApplicable: 0,
      notYetSupported: 0,
      missing: [],
    });
    expect(report.triggers.total).toBe(0);
    expect(report.supportedIntegrationIds).toEqual(["functional-provider"]);
    expect(() =>
      assertOperationTriggerCoverage([functionalDefinition], [contract]),
    ).not.toThrow();
  });

  test("blocks a functional provider that silently drops a source operation", () => {
    const definitionWithUnmappedOperation = {
      ...functionalDefinition,
      operations: [
        ...functionalDefinition.operations,
        {
          ...functionalDefinition.operations[0],
          id: "functional-provider:unmapped-operation",
          label: "Unmapped operation",
        },
      ],
    };
    expect(() =>
      assertOperationTriggerCoverage(
        [definitionWithUnmappedOperation],
        [contract],
      ),
    ).toThrow("Operation/trigger disposition coverage is incomplete");
  });

  test("permits templates only for supported product operations and data contracts", () => {
    expect(() =>
      validateOutcomeTemplates(
        [
          {
            id: "actuals-to-variance",
            integrationId: "functional-provider",
            product: "eigenn",
            name: "Actuals to variance",
            summary: "Use actuals to explain a forecast variance.",
            sourceOperationId: "functional-provider:import-actuals",
            dataContractId: "ledger-actuals-v1",
            requiredCapability: "ledger_actuals",
            successMetric: "Forecast variance is reconciled.",
          },
        ],
        [functionalDefinition],
        [contract],
      ),
    ).not.toThrow();
  });

  test("rejects template claims that are not enabled or wired to their operation", () => {
    const template = {
      id: "actuals-to-variance",
      integrationId: "functional-provider",
      product: "eigenn" as const,
      name: "Actuals to variance",
      summary: "Use actuals to explain a forecast variance.",
      sourceOperationId: "functional-provider:import-actuals",
      dataContractId: "ledger-actuals-v1",
      requiredCapability: "ledger_actuals" as const,
      successMetric: "Forecast variance is reconciled.",
    };
    const capabilityDisabled = {
      ...functionalDefinition,
      products: [
        {
          ...functionalDefinition.products[0],
          enabledCapabilities: [],
        },
      ],
    };
    expect(() =>
      validateOutcomeTemplates([template], [capabilityDisabled], [contract]),
    ).toThrow("not enabled for this product");

    const unrelatedDataContract = {
      ...contract,
      dataContracts: [
        ...contract.dataContracts,
        {
          ...contract.dataContracts[0],
          id: "unrelated-data-v1",
          objectOrMetric: "Unrelated accounting evidence",
        },
      ],
    };
    expect(() =>
      validateOutcomeTemplates(
        [{ ...template, dataContractId: "unrelated-data-v1" }],
        [functionalDefinition],
        [unrelatedDataContract],
      ),
    ).toThrow("not used by its operation");
    expect(() =>
      validateOutcomeTemplates(
        [{ ...template, dataContractId: undefined }],
        [functionalDefinition],
        [contract],
      ),
    ).toThrow("needs the data contract used by its operation");
  });

  test("does not treat a support record as functional when its operation needs a disabled capability", () => {
    const capabilityDisabled = {
      ...functionalDefinition,
      products: [
        {
          ...functionalDefinition.products[0],
          enabledCapabilities: [],
        },
      ],
    };
    expect(() =>
      validateFunctionalSupportContracts([capabilityDisabled], [contract]),
    ).toThrow("required capability is not enabled");
    expect(
      getFunctionallySupportedIntegrationIds([capabilityDisabled], [contract]),
    ).toEqual(new Set());
  });
});
