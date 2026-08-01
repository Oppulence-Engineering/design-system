import { describe, expect, test } from "bun:test";

import { SIMSTUDIO_BASELINE } from "../src/catalog";
import {
  assertProviderPackCoverage,
  getProviderPackContractIssues,
  getProviderPackCoverageReport,
  ProviderPackContractError,
  type IntegrationProviderPack,
  type ProviderPackOperationCoverage,
} from "../src/server";
import type { IntegrationProviderSdk } from "../src/server";

const AIRTABLE_OPERATION_IDS = (
  SIMSTUDIO_BASELINE.integrations.find(
    (integration) => integration.id === "airtable",
  )?.operations ?? []
).map((operation) => operation.id);

function adapter(
  operationIds: readonly string[],
  executionLane?: IntegrationProviderSdk["executionLane"],
): IntegrationProviderSdk {
  return {
    integrationId: "airtable",
    operationIds,
    ...(executionLane ? { executionLane } : {}),
    async execute(input) {
      return { operationId: input.operationId, output: {} };
    },
  };
}

function pack(
  coverage: readonly ProviderPackOperationCoverage[],
  adapters: readonly IntegrationProviderSdk[] = [],
): IntegrationProviderPack {
  return {
    integrationId: "airtable",
    coverage,
    triggerCoverage: [
      {
        sourceTriggerId: "airtable:airtable-webhook",
        kind: "webhook",
        disposition: "supported",
      },
    ],
    create: () => adapters,
  };
}

function fullyCovered(): readonly ProviderPackOperationCoverage[] {
  return AIRTABLE_OPERATION_IDS.map((sourceOperationId) => ({
    sourceOperationId,
    lane: "sdk" as const,
    disposition: "supported" as const,
  }));
}

describe("provider pack contract", () => {
  test("accepts a pack whose declared coverage matches the adapters it builds", () => {
    const complete = pack(fullyCovered(), [adapter(AIRTABLE_OPERATION_IDS)]);

    expect(getProviderPackContractIssues(complete)).toEqual([]);
    expect(() => assertProviderPackCoverage(complete, {})).not.toThrow();
  });

  test("rejects a pack that silently drops a source action", () => {
    const [dropped, ...rest] = AIRTABLE_OPERATION_IDS;
    const incomplete = pack(
      fullyCovered().filter((entry) => entry.sourceOperationId !== dropped),
      [adapter(rest)],
    );

    const issues = getProviderPackContractIssues(incomplete);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      integrationId: "airtable",
      descriptor: "operation",
      sourceId: dropped,
    });
    expect(issues[0]?.detail).toContain("no coverage record");
  });

  test("requires a recorded SDK review before an action may use the typed REST lane", () => {
    const withoutReview = fullyCovered().map((entry, index) =>
      index === 0 ? { ...entry, lane: "typed_rest" as const } : entry,
    );

    const issues = getProviderPackContractIssues(pack(withoutReview));

    expect(issues).toHaveLength(1);
    expect(issues[0]?.detail).toContain("sdkReview");

    const withReview = withoutReview.map((entry, index) =>
      index === 0
        ? { ...entry, sdkReview: "airtable@0.12.2 exposes no metadata API." }
        : entry,
    );

    expect(getProviderPackContractIssues(pack(withReview))).toEqual([]);
  });

  test("requires a reason before an action may be deferred", () => {
    const deferred = fullyCovered().map((entry, index) =>
      index === 0
        ? {
            sourceOperationId: entry.sourceOperationId,
            disposition: "deferred" as const,
          }
        : entry,
    );

    expect(getProviderPackContractIssues(pack(deferred))[0]?.detail).toContain(
      "without a reason",
    );
  });

  test("rejects coverage for an action the source provider does not have", () => {
    const invented = [
      ...fullyCovered(),
      {
        sourceOperationId: "airtable:invented-action",
        lane: "sdk" as const,
        disposition: "supported" as const,
      },
    ];

    expect(getProviderPackContractIssues(pack(invented))[0]).toMatchObject({
      sourceId: "airtable:invented-action",
    });
  });

  test("rejects a pack that claims an action no adapter executes", () => {
    const claimed = pack(fullyCovered(), [
      adapter(AIRTABLE_OPERATION_IDS.slice(1)),
    ]);

    expect(() => assertProviderPackCoverage(claimed, {})).toThrow(
      ProviderPackContractError,
    );
    try {
      assertProviderPackCoverage(claimed, {});
    } catch (error) {
      expect((error as ProviderPackContractError).issues[0]?.detail).toContain(
        "no adapter executes it",
      );
    }
  });

  test("rejects a pack whose adapter lane disagrees with its declared lane", () => {
    const mismatched = pack(fullyCovered(), [
      adapter(AIRTABLE_OPERATION_IDS, "typed_rest"),
    ]);

    try {
      assertProviderPackCoverage(mismatched, {});
      throw new Error("expected a contract error");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderPackContractError);
      expect((error as ProviderPackContractError).issues[0]?.detail).toContain(
        "declared on the sdk lane but executes on the typed_rest lane",
      );
    }
  });

  test("rejects a pack for a provider outside the pinned source baseline", () => {
    const issues = getProviderPackContractIssues({
      integrationId: "not-a-source-provider",
      coverage: [],
      triggerCoverage: [],
      create: () => [],
    });

    expect(issues).toEqual([
      {
        integrationId: "not-a-source-provider",
        descriptor: "pack",
        detail: "does not match a pinned Sim Studio source provider.",
      },
    ]);
  });

  test("reports declared coverage split by execution lane", () => {
    const report = getProviderPackCoverageReport([
      pack([
        {
          sourceOperationId: AIRTABLE_OPERATION_IDS[0],
          lane: "sdk",
          disposition: "supported",
        },
        {
          sourceOperationId: AIRTABLE_OPERATION_IDS[1],
          lane: "typed_rest",
          disposition: "supported",
          sdkReview: "No public SDK method.",
        },
        {
          sourceOperationId: AIRTABLE_OPERATION_IDS[2],
          disposition: "deferred",
          reason: "Pending provider access.",
        },
      ]),
    ]);

    expect(report).toEqual({
      providers: 1,
      operations: 2,
      triggers: 1,
      deferredOperations: 1,
      deferredTriggers: 0,
      byLane: {
        sdk: { operations: 1 },
        typed_rest: { operations: 1 },
        special: { operations: 0 },
      },
    });
  });
});
