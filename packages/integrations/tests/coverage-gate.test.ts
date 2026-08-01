import { describe, expect, test } from "bun:test";

import { SIMSTUDIO_BASELINE } from "../src/catalog";
import {
  BUILT_IN_PROVIDER_PACKS,
  assertProviderPackCoverage,
  createBuiltInProviderSdkRegistry,
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
const EXECUTABLE_PROVIDERS = 108;
const EXECUTABLE_ACTIONS = 1984;

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

const noAuthRuntime = {
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
describe("provider parity coverage gate", () => {
  test("the built-in registry executes the recorded provider and action counts", () => {
    const report = getProviderSdkCoverageReport(
      createBuiltInProviderSdkRegistry({
        apiKeyRuntime,
        oauthRuntime,
        noAuthRuntime,
      }),
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
    for (const pack of BUILT_IN_PROVIDER_PACKS) {
      expect(() => assertProviderPackCoverage(pack)).not.toThrow();
    }
  });

  test("declared pack coverage matches what the registry executes", () => {
    const report = getProviderPackCoverageReport(BUILT_IN_PROVIDER_PACKS);

    // 79 providers ship as packs; the other 29 executable providers predate
    // the pack contract and are registered directly.
    expect(report.providers).toBe(79);
    // Every deferral is the same shape: an action whose endpoint lives on a
    // host this lane cannot reach, because a provider resolves all of its
    // actions against one host. Google Maps has five such APIs, PagerDuty's
    // Events v2 is a sixth, and Jina's search host is the seventh.
    expect(report.deferredOperations).toBe(7);
    // Every supported action is owned by exactly one lane.
    expect(report.operations).toBe(
      report.byLane.sdk.operations +
        report.byLane.typed_rest.operations +
        report.byLane.special.operations,
    );
    // Typed REST is the exception, not the default: 6 gap actions, the 22
    // Jira Service Management Forms and Assets actions, AppSheet's 4, and
    // the 10 Cal.com actions its own SDK does not implement.
    expect(report.byLane.typed_rest.operations).toBe(179);
    // The special lane carries the seven protocol providers.
    expect(report.byLane.special.operations).toBe(108);
  });

  test("every typed REST action records the SDK review that allows it", () => {
    const restActions = BUILT_IN_PROVIDER_PACKS.flatMap((pack) =>
      pack.coverage.filter((action) => action.lane === "typed_rest"),
    );

    expect(restActions).toHaveLength(179);
    for (const action of restActions) {
      expect(action.sdkReview?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  test("supported triggers cover the Atlassian and Microsoft families", () => {
    const supported = BUILT_IN_PROVIDER_PACKS.flatMap((pack) =>
      pack.triggerCoverage.filter(
        (trigger) => trigger.disposition === "supported",
      ),
    );
    const deferred = BUILT_IN_PROVIDER_PACKS.flatMap((pack) =>
      pack.triggerCoverage.filter(
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
      providersRemaining: 124,
      actionsRemaining: 1906,
      triggersRemaining: 303,
    });
  });
});
