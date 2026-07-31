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
  for (const rawTemplate of templates) {
    const template = IntegrationOutcomeTemplateSchema.parse(rawTemplate);
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
