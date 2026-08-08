/**
 * Prints every number the coverage gate pins, plus the largest unmapped
 * providers. Run this after adding a provider pack and copy the figures into
 * `tests/coverage-gate.test.ts` and `tests/server.test.ts` rather than
 * deriving them by hand.
 *
 *   bun scripts/provider-coverage.ts            # pinned figures
 *   bun scripts/provider-coverage.ts --remaining 20
 */
import { SIMSTUDIO_BASELINE } from "../src/catalog";
import {
  BUILT_IN_PROVIDER_PACKS,
  createBuiltInProviderSdkRegistry,
  getProviderPackCoverageReport,
  getProviderPackSurfaceCoverageReport,
  getProviderSdkCoverageReport,
} from "../src/server";

const stubRuntime = {
  async request() {
    return Response.json({});
  },
};

const registry = createBuiltInProviderSdkRegistry({
  apiKeyRuntime: stubRuntime,
  oauthRuntime: stubRuntime,
  noAuthRuntime: stubRuntime,
} as never);

const sdk = getProviderSdkCoverageReport(registry);
const packs = getProviderPackCoverageReport(BUILT_IN_PROVIDER_PACKS);
const surfaceCoverage = getProviderPackSurfaceCoverageReport(
  BUILT_IN_PROVIDER_PACKS,
);

const executable = new Set(
  SIMSTUDIO_BASELINE.integrations
    .filter((integration) => registry.get(integration.id))
    .map((integration) => integration.id),
);
const totals = SIMSTUDIO_BASELINE.integrations.reduce(
  (acc, integration) => ({
    providers: acc.providers + 1,
    actions: acc.actions + integration.operations.length,
    triggers: acc.triggers + integration.triggers.length,
  }),
  { providers: 0, actions: 0, triggers: 0 },
);

const supportedTriggers = BUILT_IN_PROVIDER_PACKS.flatMap((pack) =>
  pack.triggerCoverage.filter((trigger) => trigger.disposition === "supported"),
).length;

const rows: readonly (readonly [string, string | number])[] = [
  ["tests/coverage-gate.test.ts", ""],
  ["  EXECUTABLE_PROVIDERS", sdk.executableProviders],
  ["  EXECUTABLE_ACTIONS", sdk.executableOperations],
  ["  report.providers", packs.providers],
  ["  report.deferredOperations", packs.deferredOperations],
  ["  report.byLane.sdk.operations", packs.byLane.sdk.operations],
  ["  report.byLane.typed_rest.operations", packs.byLane.typed_rest.operations],
  ["  report.byLane.special.operations", packs.byLane.special.operations],
  ["  providersRemaining", totals.providers - sdk.executableProviders],
  ["  actionsRemaining", totals.actions - sdk.executableOperations],
  ["", ""],
  ["progress", ""],
  [
    "  providers",
    `${sdk.executableProviders} / ${totals.providers} (${Math.round((sdk.executableProviders / totals.providers) * 100)}%)`,
  ],
  [
    "  actions",
    `${sdk.executableOperations} / ${totals.actions} (${Math.round((sdk.executableOperations / totals.actions) * 100)}%)`,
  ],
  [
    // Declared, not executable. A trigger source needs deployment secrets the
    // package does not hold — a webhook signing key, an OAuth runtime — so a
    // product wires the exported factories itself. The registry's own trigger
    // count reads zero until it does.
    "  triggers (declared, product-wired)",
    `${supportedTriggers} / ${totals.triggers} (${Math.round((supportedTriggers / totals.triggers) * 100)}%)`,
  ],
];

for (const [label, value] of rows) {
  console.log(value === "" ? label : `${label.padEnd(42)} ${String(value)}`);
}

const remainingFlagIndex = process.argv.indexOf("--remaining");
if (remainingFlagIndex !== -1) {
  const limit = Number(process.argv[remainingFlagIndex + 1] ?? 20);
  const unmapped = SIMSTUDIO_BASELINE.integrations
    .filter((integration) => !executable.has(integration.id))
    .sort((a, b) => b.operations.length - a.operations.length)
    .slice(0, limit);
  console.log(
    `\nlargest unmapped providers (${unmapped.length} of ${totals.providers - sdk.executableProviders})`,
  );
  for (const integration of unmapped) {
    console.log(
      `  ${integration.id.padEnd(28)} ${String(integration.operations.length).padStart(4)} actions  ${String(integration.triggers.length).padStart(3)} triggers  ${integration.sourceAuthType}`,
    );
  }
}

if (process.argv.includes("--surfaces")) {
  console.log("\nsurface mappings");
  console.log(`  mapped operations ${surfaceCoverage.mappedOperations}`);
  console.log(`  mapped triggers   ${surfaceCoverage.mappedTriggers}`);
  console.log(
    `  unmapped operations ${surfaceCoverage.unmappedOperations.length}`,
  );
  console.log(
    `  unmapped triggers   ${surfaceCoverage.unmappedTriggers.length}`,
  );
  if (surfaceCoverage.unmappedOperations.length) {
    console.log("  first unmapped operations:");
    for (const operationId of surfaceCoverage.unmappedOperations.slice(0, 20)) {
      console.log(`    ${operationId}`);
    }
  }
  if (
    process.argv.includes("--require-surfaces") &&
    (surfaceCoverage.unmappedOperations.length ||
      surfaceCoverage.unmappedTriggers.length)
  ) {
    throw new Error(
      "Provider surface coverage is incomplete for metadata-backed packs.",
    );
  }
}
