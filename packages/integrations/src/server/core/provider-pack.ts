import { SIMSTUDIO_BASELINE } from "../../catalog";
import { metadataForIntegration } from "../../integration-metadata";
import type { IntegrationApiKeyRuntime } from "../runtime/api-key";
import type { IntegrationConnectionLinkRuntime } from "../transport/connection-link";
import type { IntegrationNoAuthRuntime } from "../runtime/no-auth";
import type {
  IntegrationProviderExecutionLane,
  IntegrationProviderSdk,
} from "./provider-sdk";
import type { IntegrationOAuthRuntime } from "../runtime/oauth";

/**
 * Why an operation is not executable. Recording it is mandatory: a pack may
 * leave a source action unimplemented, but it may not leave it unaccounted
 * for. Coverage reporting reads these dispositions directly.
 */
export type ProviderPackDisposition = "supported" | "deferred";

export interface ProviderPackOperationCoverage {
  readonly sourceOperationId: string;
  /** Optional catalog surface used by this operation. */
  readonly surfaceId?: string;
  /** Required when supported; the lane that owns execution. */
  readonly lane?: IntegrationProviderExecutionLane;
  readonly disposition: ProviderPackDisposition;
  /**
   * Required when the lane is `typed_rest`. Records the SDK-first review that
   * concluded no maintained SDK covers this operation, naming the SDK and
   * version examined. Prose in a README cannot be enforced; this can.
   */
  readonly sdkReview?: string;
  /** Required when deferred. Explains what blocks execution. */
  readonly reason?: string;
}

export interface ProviderPackTriggerCoverage {
  readonly sourceTriggerId: string;
  /** Optional catalog surface used by this trigger. */
  readonly surfaceId?: string;
  /** Required when supported; how the trigger observes provider events. */
  readonly kind?: "webhook" | "poll" | "subscription";
  readonly disposition: ProviderPackDisposition;
  readonly reason?: string;
}

/**
 * The credential runtimes a pack may use. A pack receives runtimes, never
 * secrets: every lane reaches a provider through `withCredential` or
 * `request`, both of which keep the decrypted credential inside the package.
 */
export interface ProviderPackContext {
  readonly apiKeyRuntime?: Pick<
    IntegrationApiKeyRuntime,
    "withCredential" | "request"
  >;
  readonly oauthRuntime?: Pick<
    IntegrationOAuthRuntime,
    "withCredential" | "request"
  >;
  readonly noAuthRuntime?: Pick<IntegrationNoAuthRuntime, "request">;
  readonly connectionLinkRuntime?: Pick<
    IntegrationConnectionLinkRuntime,
    "withPlaidCredential" | "withMergeCredential"
  >;
}

/**
 * One provider's complete delivery unit: the source actions and triggers it
 * claims, the lane that owns each, and the adapters that execute them.
 *
 * Provider modules export a `create<Provider>Pack(config?)` factory so each
 * pack keeps its own typed deployment configuration while presenting this
 * uniform contract to the registry and the contract-test harness.
 */
export interface IntegrationProviderPack {
  readonly integrationId: string;
  readonly coverage: readonly ProviderPackOperationCoverage[];
  readonly triggerCoverage: readonly ProviderPackTriggerCoverage[];
  /**
   * Set for a provider the pinned source does not carry. Such a pack has no
   * entry to be measured against, so its own action table is its coverage —
   * stated here rather than inferred, so a typo in an integration ID still
   * fails the contract instead of quietly self-certifying.
   */
  readonly beyondBaseline?: true;
  /**
   * Builds the execution adapters. Returns several when a provider composes
   * lanes, for example an SDK adapter plus a typed REST adapter for the
   * actions that SDK cannot reach. Returns none when the context lacks the
   * runtime the pack needs, which lets a product mount a partial registry.
   */
  create(context: ProviderPackContext): readonly IntegrationProviderSdk[];
}

export interface ProviderPackContractIssue {
  readonly integrationId: string;
  readonly descriptor: "operation" | "trigger" | "pack";
  readonly sourceId?: string;
  readonly detail: string;
}

export class ProviderPackContractError extends Error {
  readonly issues: readonly ProviderPackContractIssue[];

  constructor(issues: readonly ProviderPackContractIssue[]) {
    super(
      `Provider pack contract violated:\n${issues
        .map(
          (issue) =>
            `  - ${issue.integrationId}${issue.sourceId ? ` ${issue.sourceId}` : ""}: ${issue.detail}`,
        )
        .join("\n")}`,
    );
    this.name = "ProviderPackContractError";
    this.issues = issues;
  }
}

function baselineFor(integrationId: string) {
  return SIMSTUDIO_BASELINE.integrations.find(
    (integration) => integration.id === integrationId,
  );
}

function collectDescriptorIssues<
  TCoverage extends { readonly disposition: ProviderPackDisposition },
>(input: {
  integrationId: string;
  descriptor: "operation" | "trigger";
  baselineIds: readonly string[];
  coverage: readonly TCoverage[];
  sourceIdOf: (coverage: TCoverage) => string;
  validate: (coverage: TCoverage) => string | undefined;
}): ProviderPackContractIssue[] {
  const issues: ProviderPackContractIssue[] = [];
  const baselineIds = new Set(input.baselineIds);
  const claimed = new Set<string>();

  for (const entry of input.coverage) {
    const sourceId = input.sourceIdOf(entry);
    if (!baselineIds.has(sourceId)) {
      issues.push({
        integrationId: input.integrationId,
        descriptor: input.descriptor,
        sourceId,
        detail: `is not a source ${input.descriptor} of this provider.`,
      });
      continue;
    }
    if (claimed.has(sourceId)) {
      issues.push({
        integrationId: input.integrationId,
        descriptor: input.descriptor,
        sourceId,
        detail: "is covered more than once.",
      });
      continue;
    }
    claimed.add(sourceId);
    const detail = input.validate(entry);
    if (detail) {
      issues.push({
        integrationId: input.integrationId,
        descriptor: input.descriptor,
        sourceId,
        detail,
      });
    }
  }

  for (const sourceId of input.baselineIds) {
    if (!claimed.has(sourceId)) {
      issues.push({
        integrationId: input.integrationId,
        descriptor: input.descriptor,
        sourceId,
        detail: `is a source ${input.descriptor} with no coverage record. Every source ${input.descriptor} must be supported or explicitly deferred with a reason.`,
      });
    }
  }

  return issues;
}

function operationIssue(
  entry: ProviderPackOperationCoverage,
): string | undefined {
  if (entry.disposition === "deferred") {
    return entry.reason?.trim()
      ? undefined
      : "is deferred without a reason. Record what blocks execution.";
  }
  if (!entry.lane) {
    return "is supported without an execution lane.";
  }
  if (entry.lane === "typed_rest" && !entry.sdkReview?.trim()) {
    return "uses the typed REST lane without an sdkReview. Record the SDK and version examined before falling back to REST.";
  }
  return undefined;
}

function triggerIssue(entry: ProviderPackTriggerCoverage): string | undefined {
  if (entry.disposition === "deferred") {
    return entry.reason?.trim()
      ? undefined
      : "is deferred without a reason. Record what blocks delivery.";
  }
  return entry.kind ? undefined : "is supported without a delivery kind.";
}

function surfaceIssues(
  pack: IntegrationProviderPack,
): ProviderPackContractIssue[] {
  const surfaces = new Set(
    metadataForIntegration(pack.integrationId)?.surfaces.map(
      (surface) => surface.id,
    ) ?? [],
  );
  if (
    !pack.coverage.some((entry) => entry.surfaceId) &&
    !pack.triggerCoverage.some((entry) => entry.surfaceId)
  ) {
    return [];
  }
  const issues: ProviderPackContractIssue[] = [];
  for (const entry of pack.coverage) {
    if (entry.surfaceId && !surfaces.has(entry.surfaceId)) {
      issues.push({
        integrationId: pack.integrationId,
        descriptor: "operation",
        sourceId: entry.sourceOperationId,
        detail: `references unknown execution surface ${entry.surfaceId}.`,
      });
    }
  }
  for (const entry of pack.triggerCoverage) {
    if (entry.surfaceId && !surfaces.has(entry.surfaceId)) {
      issues.push({
        integrationId: pack.integrationId,
        descriptor: "trigger",
        sourceId: entry.sourceTriggerId,
        detail: `references unknown execution surface ${entry.surfaceId}.`,
      });
    }
  }
  return issues;
}

/**
 * Returns every way a pack breaks the delivery contract. Returning the full
 * list rather than the first failure keeps a contract test readable when a
 * new provider is being filled in.
 */
export function getProviderPackContractIssues(
  pack: IntegrationProviderPack,
): readonly ProviderPackContractIssue[] {
  const baseline = baselineFor(pack.integrationId);
  const surfaces = surfaceIssues(pack);
  if (!baseline) {
    // A provider adopted outside the pinned source has no entry to match, and
    // its own action table is its coverage. It still has to say so explicitly,
    // so a typo in an integration ID cannot pass as an adoption.
    if (pack.beyondBaseline) return surfaces;
    return [
      {
        integrationId: pack.integrationId,
        descriptor: "pack",
        detail: "does not match a pinned Sim Studio source provider.",
      },
    ];
  }
  return [
    ...surfaces,
    ...collectDescriptorIssues({
      integrationId: pack.integrationId,
      descriptor: "operation",
      baselineIds: baseline.operations.map((operation) => operation.id),
      coverage: pack.coverage,
      sourceIdOf: (entry) => entry.sourceOperationId,
      validate: operationIssue,
    }),
    ...collectDescriptorIssues({
      integrationId: pack.integrationId,
      descriptor: "trigger",
      baselineIds: baseline.triggers.map((trigger) => trigger.id),
      coverage: pack.triggerCoverage,
      sourceIdOf: (entry) => entry.sourceTriggerId,
      validate: triggerIssue,
    }),
  ];
}

export interface ProviderPackSurfaceCoverageReport {
  readonly mappedOperations: number;
  readonly mappedTriggers: number;
  readonly unmappedOperations: readonly string[];
  readonly unmappedTriggers: readonly string[];
}

/**
 * Resolves an operation's execution surface during the metadata migration.
 * Explicit mappings always win; a single catalog surface is a safe implicit
 * default. Providers with multiple surfaces must declare the mapping.
 */
export function resolveProviderPackSurface(
  pack: IntegrationProviderPack,
  descriptorId: string,
): string | undefined {
  const operation = pack.coverage.find(
    (entry) => entry.sourceOperationId === descriptorId,
  );
  const trigger = pack.triggerCoverage.find(
    (entry) => entry.sourceTriggerId === descriptorId,
  );
  const explicit = operation?.surfaceId ?? trigger?.surfaceId;
  const surfaces = metadataForIntegration(pack.integrationId)?.surfaces ?? [];
  if (explicit) {
    return surfaces.some((surface) => surface.id === explicit)
      ? explicit
      : undefined;
  }
  return surfaces.length === 1 ? surfaces[0]?.id : undefined;
}

/** Reports which executable declarations are tied to a catalog surface. */
export function getProviderPackSurfaceCoverageReport(
  packs: readonly IntegrationProviderPack[],
): ProviderPackSurfaceCoverageReport {
  const unmappedOperations: string[] = [];
  const unmappedTriggers: string[] = [];
  let mappedOperations = 0;
  let mappedTriggers = 0;
  for (const pack of packs) {
    // Metadata is intentionally being promoted provider-by-provider. The
    // gate must enforce mappings once a provider enters that migration, while
    // leaving legacy packs measurable until their metadata exists.
    if (!metadataForIntegration(pack.integrationId)) continue;
    for (const entry of pack.coverage) {
      if (entry.disposition !== "supported") continue;
      if (resolveProviderPackSurface(pack, entry.sourceOperationId))
        mappedOperations += 1;
      else unmappedOperations.push(entry.sourceOperationId);
    }
    for (const entry of pack.triggerCoverage) {
      if (entry.disposition !== "supported") continue;
      if (resolveProviderPackSurface(pack, entry.sourceTriggerId))
        mappedTriggers += 1;
      else unmappedTriggers.push(entry.sourceTriggerId);
    }
  }
  return {
    mappedOperations,
    mappedTriggers,
    unmappedOperations,
    unmappedTriggers,
  };
}

/**
 * Asserts that a pack accounts for every source action and trigger, that no
 * operation reaches the typed REST lane without a recorded SDK review, and
 * that the adapters it builds expose exactly the operations it claims to
 * support. Every provider pack has a contract test that calls this.
 */
export function assertProviderPackCoverage(
  pack: IntegrationProviderPack,
  context?: ProviderPackContext,
): void {
  const issues = [...getProviderPackContractIssues(pack)];
  if (context) {
    issues.push(...getProviderPackAdapterIssues(pack, context));
  }
  if (issues.length > 0) {
    throw new ProviderPackContractError(issues);
  }
}

/**
 * Compares declared coverage with the adapters a pack actually builds. A pack
 * that claims an action but never wires it would otherwise pass a
 * declaration-only check and fail in production.
 */
export function getProviderPackAdapterIssues(
  pack: IntegrationProviderPack,
  context: ProviderPackContext,
): readonly ProviderPackContractIssue[] {
  const issues: ProviderPackContractIssue[] = [];
  const adapters = pack.create(context);
  const executable = new Map<string, IntegrationProviderExecutionLane>();

  for (const adapter of adapters) {
    if (adapter.integrationId !== pack.integrationId) {
      issues.push({
        integrationId: pack.integrationId,
        descriptor: "pack",
        detail: `builds an adapter for ${adapter.integrationId}.`,
      });
      continue;
    }
    for (const operationId of adapter.operationIds) {
      if (executable.has(operationId)) {
        issues.push({
          integrationId: pack.integrationId,
          descriptor: "operation",
          sourceId: operationId,
          detail: "is executed by more than one adapter in this pack.",
        });
        continue;
      }
      executable.set(operationId, adapter.executionLane ?? "sdk");
    }
  }

  for (const entry of pack.coverage) {
    const lane = executable.get(entry.sourceOperationId);
    if (entry.disposition === "supported" && lane === undefined) {
      issues.push({
        integrationId: pack.integrationId,
        descriptor: "operation",
        sourceId: entry.sourceOperationId,
        detail: "is declared supported but no adapter executes it.",
      });
      continue;
    }
    if (entry.disposition === "deferred" && lane !== undefined) {
      issues.push({
        integrationId: pack.integrationId,
        descriptor: "operation",
        sourceId: entry.sourceOperationId,
        detail: "is declared deferred but an adapter executes it.",
      });
      continue;
    }
    if (lane !== undefined && entry.lane !== lane) {
      issues.push({
        integrationId: pack.integrationId,
        descriptor: "operation",
        sourceId: entry.sourceOperationId,
        detail: `is declared on the ${entry.lane} lane but executes on the ${lane} lane.`,
      });
    }
  }

  for (const operationId of executable.keys()) {
    if (
      !pack.coverage.some((entry) => entry.sourceOperationId === operationId)
    ) {
      issues.push({
        integrationId: pack.integrationId,
        descriptor: "operation",
        sourceId: operationId,
        detail: "is executable but has no coverage record.",
      });
    }
  }

  return issues;
}

export interface ProviderPackCoverageReport {
  readonly providers: number;
  readonly operations: number;
  readonly triggers: number;
  readonly deferredOperations: number;
  readonly deferredTriggers: number;
  readonly byLane: Readonly<
    Record<IntegrationProviderExecutionLane, { readonly operations: number }>
  >;
}

/** Aggregates declared pack coverage for the merge-gate coverage report. */
export function getProviderPackCoverageReport(
  packs: readonly IntegrationProviderPack[],
): ProviderPackCoverageReport {
  const byLane: Record<
    IntegrationProviderExecutionLane,
    { operations: number }
  > = {
    sdk: { operations: 0 },
    typed_rest: { operations: 0 },
    special: { operations: 0 },
  };
  let operations = 0;
  let triggers = 0;
  let deferredOperations = 0;
  let deferredTriggers = 0;

  for (const pack of packs) {
    for (const entry of pack.coverage) {
      if (entry.disposition === "deferred") {
        deferredOperations += 1;
        continue;
      }
      operations += 1;
      if (entry.lane) {
        byLane[entry.lane].operations += 1;
      }
    }
    for (const entry of pack.triggerCoverage) {
      if (entry.disposition === "deferred") {
        deferredTriggers += 1;
        continue;
      }
      triggers += 1;
    }
  }

  return {
    providers: new Set(packs.map((pack) => pack.integrationId)).size,
    operations,
    triggers,
    deferredOperations,
    deferredTriggers,
    byLane,
  };
}
