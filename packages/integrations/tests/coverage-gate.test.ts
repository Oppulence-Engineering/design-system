import { describe, expect, test } from "bun:test";

import { SIMSTUDIO_BASELINE } from "../src/catalog";
import {
  assertProviderPackCoverage,
  createAppConfigPack,
  createAirtablePack,
  createAthenaPack,
  createAzureAdPack,
  createBuiltInProviderSdkRegistry,
  createCloudFormationPack,
  createCloudflarePack,
  createClickHousePack,
  createAlgoliaPack,
  createAzureDevOpsPack,
  createBoxPack,
  createClerkPack,
  createDatadogPack,
  createDocuSignPack,
  createElasticsearchPack,
  createGoogleAppSheetPack,
  createGoogleBigQueryPack,
  createGoogleMapsPack,
  createGoogleTranslatePack,
  createGoogleVaultPack,
  createCloudWatchPack,
  createCodePipelinePack,
  createConfluencePack,
  createDynamoDbPack,
  createJupyterPack,
  createMongoDbPack,
  createMySqlPack,
  createNeo4jPack,
  createPineconePack,
  createPostgreSqlPack,
  createIamPack,
  createIdentityCenterPack,
  createJiraPack,
  createJiraServiceManagementPack,
  createMicrosoftExcelPack,
  createMicrosoftPlannerPack,
  createMicrosoftTeamsPack,
  createOneDrivePack,
  createOutlookPack,
  createOktaPack,
  createQdrantPack,
  createRdsPack,
  createRedditPack,
  createRedisPack,
  createS3Pack,
  createSecretsManagerPack,
  createSesPack,
  createSftpPack,
  createSshPack,
  createSupabasePack,
  createSalesforcePack,
  createSharePointPack,
  createSqsPack,
  createStsPack,
  createTextractPack,
  createTwilioVoicePack,
  createUpstashPack,
  createTrelloPack,
  createVercelPack,
  createXPack,
  createZendeskPack,
  getProviderPackCoverageReport,
  getProviderSdkCoverageReport,
  type IntegrationProviderPack,
} from "../src/server";

/**
 * The merge gate for provider-parity work. These numbers only move when a
 * provider family lands, and moving them is the reviewable statement that it
 * did. The target is the pinned source: 232 providers, 3,890 actions, and 363
 * triggers.
 */
const EXECUTABLE_PROVIDERS = 89;
const EXECUTABLE_ACTIONS = 1787;

const oauthRuntime = {
  async withCredential<T>(
    _reference: unknown,
    operation: (credential: {
      accessToken: string;
      scope: readonly string[];
      tokenType: string;
    }) => Promise<T>,
  ): Promise<T> {
    return operation({ accessToken: "t", scope: [], tokenType: "Bearer" });
  },
  async request() {
    return Response.json({});
  },
};

const apiKeyRuntime = {
  async withCredential<T>(
    _reference: unknown,
    operation: (credential: {
      readonly apiKey: string;
      readonly fields: Readonly<Record<string, string>>;
    }) => Promise<T>,
  ): Promise<T> {
    return operation({ apiKey: "k", fields: { secretAccessKey: "s" } });
  },
  async request() {
    return Response.json({});
  },
};

/** Every provider delivered as a pack, with the runtime each one needs. */
const PACKS: readonly {
  pack: IntegrationProviderPack;
  context: Parameters<IntegrationProviderPack["create"]>[0];
}[] = [
  ...[
    createAirtablePack(),
    createAzureAdPack(),
    createOutlookPack(),
    createOneDrivePack(),
    createSharePointPack(),
    createMicrosoftPlannerPack(),
    createMicrosoftTeamsPack(),
    createMicrosoftExcelPack(),
    createJiraPack(),
    createConfluencePack(),
    createJiraServiceManagementPack(),
    createSalesforcePack(),
    createTrelloPack(),
    createXPack(),
    createRedditPack(),
    createBoxPack(),
    createGoogleVaultPack(),
    createGoogleBigQueryPack(),
    createDocuSignPack(),
  ].map((pack) => ({ pack, context: { oauthRuntime } })),
  ...[
    createCloudflarePack(),
    createVercelPack(),
    createS3Pack(),
    createDynamoDbPack(),
    createSqsPack(),
    createRdsPack(),
    createSesPack(),
    createIamPack(),
    createStsPack(),
    createIdentityCenterPack(),
    createSecretsManagerPack(),
    createTextractPack(),
    createAppConfigPack(),
    createAthenaPack(),
    createCloudWatchPack(),
    createCloudFormationPack(),
    createCodePipelinePack(),
    createPostgreSqlPack(),
    createMySqlPack(),
    createClickHousePack(),
    createRedisPack(),
    createSshPack(),
    createSftpPack(),
    createJupyterPack(),
    createClerkPack(),
    createOktaPack(),
    createSupabasePack(),
    createDatadogPack(),
    createAlgoliaPack(),
    createUpstashPack(),
    createPineconePack(),
    createQdrantPack(),
    createElasticsearchPack(),
    createGoogleTranslatePack(),
    createMongoDbPack(),
    createNeo4jPack(),
    createGoogleMapsPack(),
    createTwilioVoicePack(),
    createGoogleAppSheetPack(),
    createZendeskPack(),
    createAzureDevOpsPack(),
  ].map((pack) => ({ pack, context: { apiKeyRuntime } })),
];

describe("provider parity coverage gate", () => {
  test("the built-in registry executes the recorded provider and action counts", () => {
    const report = getProviderSdkCoverageReport(
      createBuiltInProviderSdkRegistry({ apiKeyRuntime, oauthRuntime }),
    );

    expect(report).toMatchObject({
      sourceProviders: 232,
      sourceOperations: 3890,
      sourceTriggers: 363,
      executableProviders: EXECUTABLE_PROVIDERS,
      executableOperations: EXECUTABLE_ACTIONS,
      hasCompleteExecutionParity: false,
    });
    expect(report.unimplementedProviders).toBe(232 - EXECUTABLE_PROVIDERS);
    expect(report.unimplementedOperations).toBe(3890 - EXECUTABLE_ACTIONS);
  });

  test("every pack satisfies the delivery contract it declares", () => {
    for (const { pack, context } of PACKS) {
      expect(() => assertProviderPackCoverage(pack, context)).not.toThrow();
    }
  });

  test("declared pack coverage matches what the registry executes", () => {
    const report = getProviderPackCoverageReport(
      PACKS.map((entry) => entry.pack),
    );

    // 60 providers ship as packs; the other 29 executable providers predate
    // the pack contract and are registered directly.
    expect(report.providers).toBe(60);
    // Only Google Maps defers, for APIs on hosts neither lane can reach.
    expect(report.deferredOperations).toBe(5);
    // Every supported action is owned by exactly one lane.
    expect(report.operations).toBe(
      report.byLane.sdk.operations +
        report.byLane.typed_rest.operations +
        report.byLane.special.operations,
    );
    // Typed REST is the exception, not the default: 6 gap actions, the 22
    // Jira Service Management Forms and Assets actions, and AppSheet's 4.
    expect(report.byLane.typed_rest.operations).toBe(32);
    // The special lane carries the seven protocol providers.
    expect(report.byLane.special.operations).toBe(108);
  });

  test("every typed REST action records the SDK review that allows it", () => {
    const restActions = PACKS.flatMap((entry) =>
      entry.pack.coverage.filter((action) => action.lane === "typed_rest"),
    );

    expect(restActions).toHaveLength(32);
    for (const action of restActions) {
      expect(action.sdkReview?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  test("supported triggers cover the Atlassian and Microsoft families", () => {
    const supported = PACKS.flatMap((entry) =>
      entry.pack.triggerCoverage.filter(
        (trigger) => trigger.disposition === "supported",
      ),
    );
    const deferred = PACKS.flatMap((entry) =>
      entry.pack.triggerCoverage.filter(
        (trigger) => trigger.disposition === "deferred",
      ),
    );

    expect(supported).toHaveLength(60);
    // Nothing is left unaccounted for: a deferred trigger carries a reason.
    for (const trigger of deferred) {
      expect(trigger.reason?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  test("reports the work remaining against the pinned source", () => {
    const sourceActions = SIMSTUDIO_BASELINE.integrations.reduce(
      (total, integration) => total + integration.operations.length,
      0,
    );

    expect({
      providersRemaining: 232 - EXECUTABLE_PROVIDERS,
      actionsRemaining: sourceActions - EXECUTABLE_ACTIONS,
      triggersRemaining: 363 - 60,
    }).toEqual({
      providersRemaining: 143,
      actionsRemaining: 2103,
      triggersRemaining: 303,
    });
  });
});
