import type { IntegrationDefinition, Product } from "./contracts";
import {
  assertOperationTriggerCoverage,
  type IntegrationSupportContract,
  validateFunctionalSupportContracts,
} from "./support";

export const INTEGRATION_GOLDEN_JOURNEY_STEPS = [
  "authorization",
  "entitlement-denial",
  "connect",
  "initial-sync",
  "normal-update",
  "freshness-expiry",
  "recovery",
  "audit-event",
  "disconnect",
] as const;

export type IntegrationGoldenJourneyStep =
  (typeof INTEGRATION_GOLDEN_JOURNEY_STEPS)[number];

export interface IntegrationGoldenJourney {
  integrationId: string;
  product: Product;
  definitions: readonly IntegrationDefinition[];
  supportContracts: readonly IntegrationSupportContract[];
  steps: Readonly<Record<IntegrationGoldenJourneyStep, () => Promise<void>>>;
}

export class IntegrationGoldenJourneyError extends Error {
  readonly integrationId: string;
  readonly product: Product;
  readonly step?: IntegrationGoldenJourneyStep;

  constructor(input: {
    integrationId: string;
    product: Product;
    message: string;
    step?: IntegrationGoldenJourneyStep;
  }) {
    super(input.message);
    this.name = "IntegrationGoldenJourneyError";
    this.integrationId = input.integrationId;
    this.product = input.product;
    this.step = input.step;
  }
}

/**
 * Runs product-owned assertions in the RFC-required order while keeping the
 * common support, lineage, and source-operation gates in one reusable place.
 */
export async function runIntegrationGoldenJourney(
  journey: IntegrationGoldenJourney,
): Promise<readonly IntegrationGoldenJourneyStep[]> {
  const definition = journey.definitions.find(
    (candidate) => candidate.id === journey.integrationId,
  );
  const product = definition?.products.find(
    (candidate) => candidate.product === journey.product,
  );
  const contract = journey.supportContracts.find(
    (candidate) =>
      candidate.integrationId === journey.integrationId &&
      candidate.product === journey.product,
  );
  if (
    !definition ||
    !product ||
    (product.availability !== "beta" && product.availability !== "shipped") ||
    !contract
  ) {
    throw new IntegrationGoldenJourneyError({
      integrationId: journey.integrationId,
      product: journey.product,
      message:
        "A golden journey requires a functional registry entry and matching support contract.",
    });
  }

  try {
    validateFunctionalSupportContracts(
      journey.definitions,
      journey.supportContracts,
    );
    assertOperationTriggerCoverage(
      journey.definitions,
      journey.supportContracts,
    );
  } catch (error) {
    throw new IntegrationGoldenJourneyError({
      integrationId: journey.integrationId,
      product: journey.product,
      message:
        error instanceof Error
          ? error.message
          : "The integration support contract is invalid.",
    });
  }

  const completed: IntegrationGoldenJourneyStep[] = [];
  for (const step of INTEGRATION_GOLDEN_JOURNEY_STEPS) {
    try {
      await journey.steps[step]();
      completed.push(step);
    } catch (error) {
      throw new IntegrationGoldenJourneyError({
        integrationId: journey.integrationId,
        product: journey.product,
        step,
        message:
          error instanceof Error
            ? `Golden journey failed at ${step}: ${error.message}`
            : `Golden journey failed at ${step}.`,
      });
    }
  }
  return completed;
}
