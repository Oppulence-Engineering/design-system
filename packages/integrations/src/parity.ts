import { INTEGRATION_CATALOGUE, SIMSTUDIO_BASELINE } from "./catalog";
import type { IntegrationDefinition } from "./contracts";
import {
  getFunctionallySupportedIntegrationIds,
  getOperationTriggerCoverageReport,
  type IntegrationSupportContract,
} from "./support";

export interface SimStudioParityChange {
  sourceSlug: string;
  sourceType: string;
  reason:
    | "missing"
    | "ambiguous"
    | "renamed"
    | "operations-changed"
    | "triggers-changed";
  detail: string;
}

export interface SimStudioParityReport {
  source: {
    commit: string;
    blob: string;
    date: string;
    reviewNote: string;
  };
  baseline: {
    providers: number;
    operations: number;
    triggers: number;
    categories: Readonly<Record<string, number>>;
  };
  catalogue: {
    matched: number;
    missing: readonly SimStudioParityChange[];
    ambiguous: readonly SimStudioParityChange[];
    renamed: readonly SimStudioParityChange[];
    operationChanges: readonly SimStudioParityChange[];
    triggerChanges: readonly SimStudioParityChange[];
    extras: readonly string[];
    catalogueOnly: readonly string[];
    functional: readonly string[];
    operationOrTriggerSupported: readonly string[];
  };
}

function sourceKey(sourceSlug: string, sourceType: string): string {
  return `${sourceSlug}:${sourceType}`;
}

function countBaselineDescriptors(
  descriptor: "operations" | "triggers",
): number {
  return SIMSTUDIO_BASELINE.integrations.reduce(
    (total, definition) => total + definition[descriptor].length,
    0,
  );
}

function sourceDefinitions(definitions: readonly IntegrationDefinition[]) {
  const bySource = new Map<string, IntegrationDefinition[]>();
  for (const definition of definitions) {
    for (const source of definition.sourceParity) {
      if (source.source !== "simstudio") {
        continue;
      }
      const key = sourceKey(source.sourceSlug, source.sourceType);
      const existing = bySource.get(key) ?? [];
      existing.push(definition);
      bySource.set(key, existing);
    }
  }
  return bySource;
}

/**
 * Compares the source references with the checked-in snapshot. It does not
 * make functional-parity claims: only product-owned support records can do
 * that, so this report intentionally remains conservative in Phase 0.
 */
export function getSimStudioParityReport(
  definitions: readonly IntegrationDefinition[] = INTEGRATION_CATALOGUE,
  contracts: readonly IntegrationSupportContract[] = [],
): SimStudioParityReport {
  const bySource = sourceDefinitions(definitions);
  const missing: SimStudioParityChange[] = [];
  const ambiguous: SimStudioParityChange[] = [];
  const renamed: SimStudioParityChange[] = [];
  const operationChanges: SimStudioParityChange[] = [];
  const triggerChanges: SimStudioParityChange[] = [];
  const categories: Record<string, number> = {};
  let matched = 0;

  for (const baseline of SIMSTUDIO_BASELINE.integrations) {
    categories[baseline.sourceCategory] =
      (categories[baseline.sourceCategory] ?? 0) + 1;
    const key = sourceKey(baseline.sourceSlug, baseline.sourceType);
    const definitionsForSource = bySource.get(key) ?? [];
    if (definitionsForSource.length === 0) {
      missing.push({
        sourceSlug: baseline.sourceSlug,
        sourceType: baseline.sourceType,
        reason: "missing",
        detail: "No registry definition maps this pinned Sim Studio provider.",
      });
      continue;
    }
    if (definitionsForSource.length > 1) {
      ambiguous.push({
        sourceSlug: baseline.sourceSlug,
        sourceType: baseline.sourceType,
        reason: "ambiguous",
        detail:
          "More than one registry definition maps this pinned Sim Studio provider.",
      });
      continue;
    }
    const definition = definitionsForSource[0];
    matched += 1;
    if (
      definition.id !== baseline.id &&
      !definition.aliases.includes(baseline.id)
    ) {
      renamed.push({
        sourceSlug: baseline.sourceSlug,
        sourceType: baseline.sourceType,
        reason: "renamed",
        detail: `Canonical ID ${definition.id} does not preserve the generated baseline ID ${baseline.id}.`,
      });
    }
    const operationIds = new Set(
      definition.operations.map((operation) => operation.id),
    );
    const missingOperations = baseline.operations.filter(
      (operation) => !operationIds.has(operation.id),
    );
    if (
      missingOperations.length > 0 ||
      definition.operations.length !== baseline.operations.length
    ) {
      operationChanges.push({
        sourceSlug: baseline.sourceSlug,
        sourceType: baseline.sourceType,
        reason: "operations-changed",
        detail: `${missingOperations.length} source operations are missing or the operation count changed.`,
      });
    }
    const triggerIds = new Set(
      definition.triggers.map((trigger) => trigger.id),
    );
    const missingTriggers = baseline.triggers.filter(
      (trigger) => !triggerIds.has(trigger.id),
    );
    if (
      missingTriggers.length > 0 ||
      definition.triggers.length !== baseline.triggers.length
    ) {
      triggerChanges.push({
        sourceSlug: baseline.sourceSlug,
        sourceType: baseline.sourceType,
        reason: "triggers-changed",
        detail: `${missingTriggers.length} source triggers are missing or the trigger count changed.`,
      });
    }
  }

  const extras = definitions
    .filter((definition) =>
      definition.sourceParity.every((source) => source.source !== "simstudio"),
    )
    .map((definition) => definition.id)
    .sort();
  const functionallySupported = getFunctionallySupportedIntegrationIds(
    definitions,
    contracts,
  );
  const coverage = getOperationTriggerCoverageReport(definitions, contracts);
  const matchedIds = new Set(
    SIMSTUDIO_BASELINE.integrations.flatMap((baseline) => {
      const sourceDefinitions = bySource.get(
        sourceKey(baseline.sourceSlug, baseline.sourceType),
      );
      return sourceDefinitions?.length === 1 ? [sourceDefinitions[0].id] : [];
    }),
  );
  const functional = [...matchedIds]
    .filter((id) => functionallySupported.has(id))
    .sort();
  const catalogueOnly = [...matchedIds]
    .filter((id) => !functionallySupported.has(id))
    .sort();
  const operationOrTriggerSupported = coverage.supportedIntegrationIds.filter(
    (id) => matchedIds.has(id),
  );

  return {
    source: {
      commit: SIMSTUDIO_BASELINE.sourceCommit,
      blob: SIMSTUDIO_BASELINE.sourceBlob,
      date: SIMSTUDIO_BASELINE.sourceDate,
      reviewNote: SIMSTUDIO_BASELINE.reviewNote,
    },
    baseline: {
      providers: SIMSTUDIO_BASELINE.integrations.length,
      operations: countBaselineDescriptors("operations"),
      triggers: countBaselineDescriptors("triggers"),
      categories,
    },
    catalogue: {
      matched,
      missing,
      ambiguous,
      renamed,
      operationChanges,
      triggerChanges,
      extras,
      catalogueOnly,
      functional,
      operationOrTriggerSupported,
    },
  };
}

export function assertSimStudioParity(
  definitions: readonly IntegrationDefinition[] = INTEGRATION_CATALOGUE,
): void {
  const report = getSimStudioParityReport(definitions);
  const issues = [
    ...report.catalogue.missing,
    ...report.catalogue.ambiguous,
    ...report.catalogue.renamed,
    ...report.catalogue.operationChanges,
    ...report.catalogue.triggerChanges,
  ];
  if (
    issues.length > 0 ||
    report.catalogue.matched !== report.baseline.providers
  ) {
    throw new Error(
      `Sim Studio parity drift detected: ${issues.map((issue) => `${issue.reason}:${issue.sourceSlug}`).join(", ")}`,
    );
  }
}
