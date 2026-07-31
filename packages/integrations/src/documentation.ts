import { z } from "zod";

import { INTEGRATION_CATALOGUE } from "./catalog";
import type { IntegrationDefinition } from "./contracts";
import { getSimStudioParityReport } from "./parity";
import {
  getFunctionallySupportedIntegrationIds,
  getOperationTriggerCoverageReport,
  type IntegrationSupportContract,
} from "./support";

export const PublicIntegrationSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    summary: z.string(),
    capabilities: z.array(z.string()).readonly(),
    authMethods: z.array(z.string()).readonly(),
    availability: z
      .array(
        z
          .object({
            product: z.string(),
            availability: z.string(),
            documentationPath: z.string().optional(),
          })
          .strict(),
      )
      .readonly(),
    searchText: z.string(),
  })
  .strict();

export const PublicIntegrationDetailSchema = z
  .object({
    id: z.string(),
    operations: z
      .array(
        z
          .object({
            id: z.string(),
            label: z.string(),
            description: z.string(),
          })
          .strict(),
      )
      .readonly(),
    triggers: z
      .array(
        z
          .object({
            id: z.string(),
            label: z.string(),
            description: z.string(),
          })
          .strict(),
      )
      .readonly(),
  })
  .strict();

export const PublicIntegrationManifestSchema = z
  .object({
    version: z.literal(1),
    generatedAt: z.string().datetime({ offset: true }),
    parity: z
      .object({
        totalProviders: z.number().int(),
        providers: z.number().int(),
        matched: z.number().int(),
        extras: z.number().int(),
        /** Counts all registry providers, including Oppulence-specific extras. */
        catalogueOnly: z.number().int(),
        functionallySupported: z.number().int(),
        operationOrTriggerSupported: z.number().int(),
        /** Sim Studio-only values preserve an auditable parity denominator. */
        catalogueOnlySimStudio: z.number().int(),
        functionallySupportedSimStudio: z.number().int(),
        operationOrTriggerSupportedSimStudio: z.number().int(),
      })
      .strict(),
    integrations: z.array(PublicIntegrationSummarySchema).readonly(),
    details: z.array(PublicIntegrationDetailSchema).readonly(),
  })
  .strict();

export type PublicIntegrationManifest = z.infer<
  typeof PublicIntegrationManifestSchema
>;

function summarySearchText(definition: IntegrationDefinition): string {
  return [
    definition.id,
    definition.name,
    definition.summary,
    definition.category,
    ...definition.capabilities,
    ...definition.operations.map((operation) => operation.label),
    ...definition.triggers.map((trigger) => trigger.label),
  ]
    .join(" ")
    .toLocaleLowerCase("en-US");
}

/**
 * Produces public catalogue data only. Connection state, source records,
 * credentials, provider configuration, and raw errors are intentionally not
 * represented in this artifact.
 */
export function createPublicIntegrationManifest(
  definitions: readonly IntegrationDefinition[] = INTEGRATION_CATALOGUE,
  generatedAt = new Date().toISOString(),
  contracts: readonly IntegrationSupportContract[] = [],
): PublicIntegrationManifest {
  const parity = getSimStudioParityReport(definitions, contracts);
  const functionallySupported = getFunctionallySupportedIntegrationIds(
    definitions,
    contracts,
  );
  const operationTriggerCoverage = getOperationTriggerCoverageReport(
    definitions,
    contracts,
  );
  return PublicIntegrationManifestSchema.parse({
    version: 1,
    generatedAt,
    parity: {
      totalProviders: definitions.length,
      providers: parity.baseline.providers,
      matched: parity.catalogue.matched,
      extras: parity.catalogue.extras.length,
      catalogueOnly: definitions.length - functionallySupported.size,
      functionallySupported: functionallySupported.size,
      operationOrTriggerSupported:
        operationTriggerCoverage.supportedIntegrationIds.length,
      catalogueOnlySimStudio: parity.catalogue.catalogueOnly.length,
      functionallySupportedSimStudio: parity.catalogue.functional.length,
      operationOrTriggerSupportedSimStudio:
        parity.catalogue.operationOrTriggerSupported.length,
    },
    integrations: definitions.map((definition) => ({
      id: definition.id,
      name: definition.name,
      category: definition.category,
      summary: definition.summary,
      capabilities: definition.capabilities,
      authMethods: [
        ...new Set(
          definition.products.flatMap((product) => product.authMethods),
        ),
      ].sort(),
      availability: definition.products.map((product) => ({
        product: product.product,
        availability: product.availability,
        documentationPath: product.documentationPath,
      })),
      searchText: summarySearchText(definition),
    })),
    details: definitions.map((definition) => ({
      id: definition.id,
      operations: definition.operations.map(({ id, label, description }) => ({
        id,
        label,
        description,
      })),
      triggers: definition.triggers.map(({ id, label, description }) => ({
        id,
        label,
        description,
      })),
    })),
  });
}

export function serializePublicIntegrationManifest(
  manifest = createPublicIntegrationManifest(),
): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
