import { describe, expect, test } from "bun:test";

import {
  createIntegrationConnectionResolver,
  createProductIntegrationKit,
  IntegrationAccessDeniedError,
} from "../src/kit";
import {
  INTEGRATION_GOLDEN_JOURNEY_STEPS,
  IntegrationGoldenJourneyError,
  runIntegrationGoldenJourney,
} from "../src/golden-journey";
import { IntegrationDefinitionSchema } from "../src/contracts";
import { IntegrationSupportContractSchema } from "../src/support";

const definition = IntegrationDefinitionSchema.parse({
  id: "test-provider",
  aliases: ["legacy-provider"],
  name: "Test Provider",
  category: "accounting",
  summary: "A product-kit test provider.",
  capabilities: ["ledger_actuals"],
  operations: [
    {
      id: "test-provider:import-actuals",
      label: "Import actuals",
      description: "Imports actuals into a model.",
      requiredCapabilities: ["ledger_actuals"],
    },
  ],
  triggers: [],
  products: [
    {
      product: "eigenn",
      availability: "beta",
      authMethods: ["oauth2"],
      enabledCapabilities: ["ledger_actuals"],
      setup: [],
    },
  ],
  sourceParity: [{ source: "oppulence" }],
});

const supportContract = IntegrationSupportContractSchema.parse({
  integrationId: "test-provider",
  product: "eigenn",
  owner: "Eigenn integrations",
  connectionModes: ["oauth2"],
  syncMode: "polling",
  outcome: "Forecast variance uses reconciled actuals.",
  dataContracts: [
    {
      id: "actuals-v1",
      schemaVersion: "1",
      objectOrMetric: "Ledger actual",
      fieldClassification: "sensitive",
      normalizationRule: "Normalize to monthly organization currency.",
      permittedUse: "Forecast variance.",
      retentionDeletionOwner: "Eigenn",
      sourceToOutputLineage: "Connection to forecast variance.",
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
      sourceOperationId: "test-provider:import-actuals",
      disposition: "supported",
      outcome: "Forecast variance uses reconciled actuals.",
      dataContractIds: ["actuals-v1"],
    },
  ],
  triggers: [],
  entitlementPolicy: {
    eligiblePlans: ["growth"],
    requiredRoles: ["connect"],
    dataRegionPolicy: "Data remains in the selected region.",
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

interface Context {
  allowed: boolean;
  hasConnection?: boolean;
}

const connection = {
  id: "connection-1",
  integrationId: "test-provider",
  product: "eigenn" as const,
  displayName: "Primary books",
  state: "healthy" as const,
  enabledCapabilities: ["ledger_actuals"] as const,
  permittedActions: ["sync_now", "inspect"] as const,
};

function createKit() {
  const calls: string[] = [];
  const kit = createProductIntegrationKit<Context>({
    product: "eigenn",
    definitions: [definition],
    supportContracts: [supportContract],
    resolver: {
      async listAuthorizedConnections(context) {
        return context.hasConnection ? [connection] : [];
      },
    },
    async findAuthorizedConnection(context, connectionId) {
      return context.hasConnection && connectionId === connection.id
        ? connection
        : undefined;
    },
    entitlements: {
      async evaluate(context) {
        return context.allowed
          ? { allowed: true }
          : {
              allowed: false,
              reasonCode: "missing_role",
              requestAccessAllowed: true,
              explanation: "You need the integration manager role.",
            };
      },
      async evaluateDirectory(context) {
        return new Map([
          [
            "test-provider",
            context.allowed
              ? { allowed: true }
              : {
                  allowed: false,
                  requestAccessAllowed: true,
                  explanation: "You need the integration manager role.",
                },
          ],
        ]);
      },
    },
    connector: {
      async beginConnection(_, request) {
        calls.push(`connect:${request.integrationId}`);
        return {
          state: "redirect",
          safeNextStep: "Continue the server-owned handoff.",
          redirectPath: "/settings/integrations/test-provider/connect",
        };
      },
      async performAction(_, request) {
        calls.push(`action:${request.action}`);
        return { accepted: true, safeMessage: "Sync queued." };
      },
      async getConnectionHealth(_, request) {
        calls.push(`health:${request.connectionId}`);
        return { state: "healthy", summary: "Source is fresh." };
      },
    },
  });
  return { kit, calls };
}

describe("product integration kit", () => {
  test("turns a product-owned record adapter into strict safe projections", async () => {
    const resolver = createIntegrationConnectionResolver({
      async listAuthorizedRecords() {
        return [{ id: "record-1" }];
      },
      toProjection() {
        return {
          ...connection,
          id: "record-1",
          secret: "must-not-cross-the-boundary",
        } as never;
      },
    });

    await expect(resolver.listAuthorizedConnections({})).rejects.toThrow();
  });

  test("uses one entitlement boundary for directory state and connect commands", async () => {
    const { kit, calls } = createKit();
    const deniedDirectory = await kit.getDirectory({ allowed: false });
    expect(deniedDirectory.entries[0]?.availability).toBe("no-access");
    expect(deniedDirectory.entries[0]?.primaryAction).toBeUndefined();

    const allowedDirectory = await kit.getDirectory({ allowed: true });
    expect(allowedDirectory.entries[0]?.availability).toBe("available");
    expect(allowedDirectory.entries[0]?.primaryAction).toBe("connect");

    await expect(
      kit.beginConnection(
        { allowed: false },
        { integrationId: "legacy-provider", mode: "oauth2" },
      ),
    ).rejects.toBeInstanceOf(IntegrationAccessDeniedError);

    await kit.beginConnection(
      { allowed: true },
      { integrationId: "legacy-provider", mode: "oauth2" },
    );
    expect(calls).toEqual(["connect:test-provider"]);
  });

  test("dispatches only authorized, permitted connection commands", async () => {
    const { kit, calls } = createKit();
    await kit.performAction(
      { allowed: true, hasConnection: true },
      { connectionId: "connection-1", action: "sync_now" },
    );
    await kit.getConnectionHealth(
      { allowed: true, hasConnection: true },
      { connectionId: "connection-1" },
    );
    expect(calls).toEqual(["action:sync_now", "health:connection-1"]);

    await expect(
      kit.performAction(
        { allowed: true, hasConnection: true },
        { connectionId: "connection-1", action: "disconnect" },
      ),
    ).rejects.toBeInstanceOf(IntegrationAccessDeniedError);
  });
});

describe("integration golden journey", () => {
  test("runs every product assertion after validating shared support gates", async () => {
    const completed: string[] = [];
    const result = await runIntegrationGoldenJourney({
      integrationId: "test-provider",
      product: "eigenn",
      definitions: [definition],
      supportContracts: [supportContract],
      steps: Object.fromEntries(
        INTEGRATION_GOLDEN_JOURNEY_STEPS.map((step) => [
          step,
          async () => {
            completed.push(step);
          },
        ]),
      ) as Record<
        (typeof INTEGRATION_GOLDEN_JOURNEY_STEPS)[number],
        () => Promise<void>
      >,
    });

    expect(result).toEqual([...INTEGRATION_GOLDEN_JOURNEY_STEPS]);
    expect(completed).toEqual([...INTEGRATION_GOLDEN_JOURNEY_STEPS]);
  });

  test("reports the failed product-owned verification step", async () => {
    await expect(
      runIntegrationGoldenJourney({
        integrationId: "test-provider",
        product: "eigenn",
        definitions: [definition],
        supportContracts: [supportContract],
        steps: Object.fromEntries(
          INTEGRATION_GOLDEN_JOURNEY_STEPS.map((step) => [
            step,
            async () => {
              if (step === "recovery") {
                throw new Error("Reconnect did not restore freshness.");
              }
            },
          ]),
        ) as Record<
          (typeof INTEGRATION_GOLDEN_JOURNEY_STEPS)[number],
          () => Promise<void>
        >,
      }),
    ).rejects.toMatchObject({
      step: "recovery",
      name: IntegrationGoldenJourneyError.name,
    });
  });
});
