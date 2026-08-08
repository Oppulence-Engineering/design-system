import { z } from "zod";

import {
  IntegrationCapabilitySchema,
  IntegrationIdSchema,
  type IntegrationDefinition,
  type Product,
} from "./contracts";
import {
  getFunctionalSupportContract,
  type IntegrationSupportContract,
} from "./support";

export const IntegrationOutcomeTemplateSchema = z
  .object({
    id: z.string().min(1).max(160),
    integrationId: IntegrationIdSchema,
    product: z.enum(["eigenn", "conduitt"]),
    name: z.string().min(1).max(160),
    summary: z.string().min(1).max(1_000),
    sourceOperationId: z.string().min(1).max(160),
    dataContractId: z.string().min(1).max(160).optional(),
    requiredCapability: IntegrationCapabilitySchema,
    successMetric: z.string().min(1).max(500),
  })
  .strict();

export type IntegrationOutcomeTemplate = z.infer<
  typeof IntegrationOutcomeTemplateSchema
>;

export function validateOutcomeTemplates(
  templates: readonly IntegrationOutcomeTemplate[],
  definitions: readonly IntegrationDefinition[],
  contracts: readonly IntegrationSupportContract[],
): void {
  const definitionsById = new Map<string, IntegrationDefinition>(
    definitions.map((definition) => [definition.id as string, definition]),
  );
  const templateIds = new Set<string>();
  for (const rawTemplate of templates) {
    const template = IntegrationOutcomeTemplateSchema.parse(rawTemplate);
    if (templateIds.has(template.id)) {
      throw new Error(`Outcome template IDs must be unique: ${template.id}.`);
    }
    templateIds.add(template.id);
    const definition = definitionsById.get(template.integrationId);
    if (!definition) {
      throw new Error(
        `Template ${template.id} references an unavailable integration.`,
      );
    }
    const product = definition.products.find(
      (candidate) => candidate.product === template.product,
    );
    if (
      !product ||
      product.availability === "planned" ||
      product.availability === "retired"
    ) {
      throw new Error(
        `Template ${template.id} references an unavailable product integration.`,
      );
    }
    if (!product.enabledCapabilities.includes(template.requiredCapability)) {
      throw new Error(
        `Template ${template.id} requires a capability that is not enabled for this product.`,
      );
    }
    const contract = getFunctionalSupportContract(
      definitions,
      contracts,
      template.integrationId,
      template.product,
    );
    if (!contract) {
      throw new Error(
        `Template ${template.id} has no functional support contract.`,
      );
    }
    const operation = contract.operations.find(
      (candidate) => candidate.sourceOperationId === template.sourceOperationId,
    );
    if (!operation || operation.disposition !== "supported") {
      throw new Error(
        `Template ${template.id} references an unsupported operation.`,
      );
    }
    const operationDataContractIds = new Set(operation.dataContractIds);
    if (
      template.dataContractId &&
      !operationDataContractIds.has(template.dataContractId)
    ) {
      throw new Error(
        `Template ${template.id} references a data contract not used by its operation.`,
      );
    }
    if (operationDataContractIds.size > 0 && !template.dataContractId) {
      throw new Error(
        `Template ${template.id} needs the data contract used by its operation.`,
      );
    }
  }
}

export function getOutcomeTemplatesForProduct(
  templates: readonly IntegrationOutcomeTemplate[],
  product: Product,
): readonly IntegrationOutcomeTemplate[] {
  return templates.filter((template) => template.product === product);
}

export interface IntegrationOutcomeReadiness {
  readonly integrationId: string;
  readonly product: Product;
  readonly availability: string;
  readonly hasSupportContract: boolean;
  readonly supportedOperations: number;
  readonly supportedTriggers: number;
  readonly outcomeTemplateCount: number;
  readonly ready: boolean;
  readonly issues: readonly string[];
}

/**
 * Summarizes whether a product entry is backed by a real, outcome-bearing
 * support contract. This is intentionally separate from catalogue and SDK
 * parity: a provider can be executable without being ready to promise a
 * customer outcome.
 */
export function getIntegrationOutcomeReadiness(
  definitions: readonly IntegrationDefinition[],
  contracts: readonly IntegrationSupportContract[],
  templates: readonly IntegrationOutcomeTemplate[] = [],
): readonly IntegrationOutcomeReadiness[] {
  // Validate the complete supplied set first. This prevents templates for a
  // planned or otherwise unrelated product from disappearing because the
  // readiness loop only examines beta/shipped entries.
  if (templates.length > 0) {
    validateOutcomeTemplates(templates, definitions, contracts);
  }
  const results: IntegrationOutcomeReadiness[] = [];
  for (const definition of definitions) {
    for (const product of definition.products) {
      if (product.availability === "retired") continue;
      const contract = getFunctionalSupportContract(
        definitions,
        contracts,
        definition.id,
        product.product,
      );
      const productTemplates = templates.filter(
        (template) =>
          template.integrationId === definition.id &&
          template.product === product.product,
      );
      const issues: string[] = [];
      const supportedOperations =
        contract?.operations.filter(
          (operation) => operation.disposition === "supported",
        ).length ?? 0;
      const supportedTriggers =
        contract?.triggers.filter(
          (trigger) => trigger.disposition === "supported",
        ).length ?? 0;
      if (
        product.availability === "beta" ||
        product.availability === "shipped"
      ) {
        if (!contract) {
          issues.push("Missing a valid product support contract.");
        } else if (supportedOperations + supportedTriggers === 0) {
          issues.push(
            "Support contract has no supported operation or trigger.",
          );
        }
        if (productTemplates.length === 0) {
          issues.push("Requires at least one validated outcome template.");
        }
      }
      results.push({
        integrationId: definition.id,
        product: product.product,
        availability: product.availability,
        hasSupportContract: Boolean(contract),
        supportedOperations,
        supportedTriggers,
        outcomeTemplateCount: productTemplates.length,
        ready: issues.length === 0 && product.availability !== "planned",
        issues,
      });
    }
  }
  return results;
}

/**
 * Enforces the release promise for every beta or shipped product integration.
 * Planned entries remain visible to planning surfaces but do not block a
 * release until they are promoted.
 */
export function assertIntegrationOutcomeReadiness(
  definitions: readonly IntegrationDefinition[],
  contracts: readonly IntegrationSupportContract[],
  templates: readonly IntegrationOutcomeTemplate[] = [],
): readonly IntegrationOutcomeReadiness[] {
  const results = getIntegrationOutcomeReadiness(
    definitions,
    contracts,
    templates,
  );
  const blocked = results.filter(
    (result) =>
      !result.ready &&
      (result.availability === "beta" || result.availability === "shipped"),
  );
  if (blocked.length > 0) {
    const details = blocked
      .slice(0, 8)
      .map(
        (result) =>
          `${result.integrationId}/${result.product}: ${result.issues.join(" ")}`,
      )
      .join("; ");
    throw new Error(
      `Integration outcome readiness is incomplete for ${blocked.length} promoted product(s): ${details}`,
    );
  }
  return results;
}
