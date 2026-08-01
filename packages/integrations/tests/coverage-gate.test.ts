import { describe, expect, test } from "bun:test";

import { INTEGRATION_CATALOGUE, SIMSTUDIO_BASELINE } from "../src/catalog";
import {
  EXECUTABLE_INTEGRATION_IDS,
  EXECUTABLE_INTEGRATION_ID_SET,
} from "../src/executable";
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
const EXECUTABLE_PROVIDERS = 137;
const EXECUTABLE_ACTIONS = 2399;

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
  test("a pack declaring supported triggers ships a source factory for them", async () => {
    // Trigger sources need deployment secrets the package does not hold, so
    // they are wired by the product rather than assembled here. That makes a
    // declaration cheap: without this check a pack could claim triggers that
    // nothing in the package can ever deliver.
    const exported = new Set(Object.keys(await import("../src/server")));
    const FACTORIES: Readonly<Record<string, string>> = {
      clerk: "createClerkWebhookTriggerSources",
      jira: "createAtlassianWebhookTriggerSources",
      confluence: "createAtlassianWebhookTriggerSources",
      "jira-service-management": "createAtlassianWebhookTriggerSources",
      outlook: "createOutlookPollTriggerSource",
      "microsoft-teams": "createMicrosoftTeamsChatSubscriptionSource",
    };
    const unbacked: string[] = [];
    for (const pack of BUILT_IN_PROVIDER_PACKS) {
      const supported = pack.triggerCoverage.filter(
        (trigger) => trigger.disposition === "supported",
      );
      if (!supported.length) continue;
      const factory = FACTORIES[pack.integrationId];
      if (!factory || !exported.has(factory)) {
        unbacked.push(pack.integrationId);
      }
    }
    expect(unbacked).toEqual([]);
  });

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

  test("the browser-safe executable list matches what the registry ships", () => {
    // The catalogue is browser-safe and cannot import the registry, so it
    // derives directory availability from this list instead. If the two drift,
    // a product either advertises a connector that cannot run or hides one
    // that can — and the directory silently renders the wrong action.
    const registry = createBuiltInProviderSdkRegistry({
      apiKeyRuntime,
      oauthRuntime,
      noAuthRuntime,
    });
    const shipped = SIMSTUDIO_BASELINE.integrations
      .filter((integration) => registry.get(integration.id))
      .map((integration) => integration.id)
      .sort();

    expect([...EXECUTABLE_INTEGRATION_IDS]).toEqual(shipped);
    expect(EXECUTABLE_INTEGRATION_IDS).toHaveLength(EXECUTABLE_PROVIDERS);
  });

  test("every executable integration is offerable in the directory", () => {
    // Availability is what decides whether the directory renders a connect
    // action, so an executable integration left at "planned" is invisible to
    // every product however complete its pack is.
    const stranded = INTEGRATION_CATALOGUE.filter(
      (definition) =>
        EXECUTABLE_INTEGRATION_ID_SET.has(definition.id) &&
        definition.products.every(
          (product) => product.availability === "planned",
        ),
    ).map((definition) => definition.id);
    expect(stranded).toEqual([]);

    // And the converse: nothing the package cannot execute may be advertised
    // as connectable.
    const overclaimed = INTEGRATION_CATALOGUE.filter(
      (definition) =>
        !EXECUTABLE_INTEGRATION_ID_SET.has(definition.id) &&
        definition.products.some((product) =>
          ["shipped", "beta"].includes(product.availability),
        ),
    ).map((definition) => definition.id);
    expect(overclaimed).toEqual([]);
  });

  test("every pack satisfies the delivery contract it declares", () => {
    for (const pack of BUILT_IN_PROVIDER_PACKS) {
      expect(() => assertProviderPackCoverage(pack)).not.toThrow();
    }
  });

  test("declared pack coverage matches what the registry executes", () => {
    const report = getProviderPackCoverageReport(BUILT_IN_PROVIDER_PACKS);

    // Most providers ship as packs; the rest predate the pack contract and
    // are registered directly.
    expect(report.providers).toBe(108);
    // Deferrals fall into three kinds, and each one records which it is at
    // the action: an endpoint on a host this lane cannot reach, since a
    // provider resolves every action against one host; a request shape this
    // lane does not serialise, such as multipart; or an action the vendor's
    // own published document does not describe. The per-action reasons are
    // the record — enumerating them here would go stale every time a provider
    // lands, and a stale comment is worse than none.
    expect(report.deferredOperations).toBe(150);
    // Every supported action is owned by exactly one lane.
    expect(report.operations).toBe(
      report.byLane.sdk.operations +
        report.byLane.typed_rest.operations +
        report.byLane.special.operations,
    );
    // Typed REST is where a provider lands when no maintained SDK models its
    // surface. It is now the largest lane by action count, because the
    // providers still outstanding are almost all of that kind.
    expect(report.byLane.typed_rest.operations).toBe(594);
    // The special lane carries the seven protocol providers.
    expect(report.byLane.special.operations).toBe(108);
  });

  test("every typed REST action records the SDK review that allows it", () => {
    const restActions = BUILT_IN_PROVIDER_PACKS.flatMap((pack) =>
      pack.coverage.filter((action) => action.lane === "typed_rest"),
    );

    expect(restActions).toHaveLength(594);
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
      providersRemaining: 95,
      actionsRemaining: 1491,
      triggersRemaining: 303,
    });
  });
});
