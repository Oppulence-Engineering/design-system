import { z } from "zod";

import { INTEGRATION_CATALOGUE } from "./catalog";
import {
  IntegrationAuthMethodSchema,
  IntegrationCapabilitySchema,
  IntegrationCategorySchema,
  IntegrationDefinitionSchema,
  IntegrationIdSchema,
  ProductAvailabilitySchema,
  ProductSchema,
  IntegrationSetupStepSchema,
  type IntegrationDefinition,
} from "./contracts";
import {
  IntegrationCredentialDefinitionSchema,
  IntegrationEvidenceSchema,
  IntegrationSurfaceSchema,
  StableMetadataIdSchema,
} from "./surfaces";
import { metadataForIntegration } from "./integration-metadata";

export const INTEGRATION_DISCOVERY_MANIFEST_VERSION = 1 as const;

const DiscoveryProductSchema = z
  .object({
    product: ProductSchema,
    availability: ProductAvailabilitySchema,
    authMethods: z.array(IntegrationAuthMethodSchema).min(1).readonly(),
    enabledCapabilities: z.array(IntegrationCapabilitySchema).readonly(),
    setup: z.array(IntegrationSetupStepSchema).readonly(),
    documentationPath: z
      .string()
      .regex(/^\/(?![\\/])/u, "Documentation paths must be site-relative.")
      .refine(
        (value) =>
          !/[\\?#\u0000-\u001f\u007f]/u.test(value) &&
          !/%(?:2f|5c|3f|23)/iu.test(value),
        "Documentation paths cannot contain navigation tokens.",
      )
      .optional(),
  })
  .strict();

const DiscoveryOperationSchema = z
  .object({
    id: z.string().min(1).max(160),
    label: z.string().min(1),
    description: z.string().min(1),
    requiredCapabilities: z.array(IntegrationCapabilitySchema).readonly(),
    inputSensitivity: z.enum(["public", "internal", "sensitive"]),
    outputSensitivity: z.enum(["public", "internal", "sensitive"]),
  })
  .strict();

const DiscoveryTriggerSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1),
    requiredCapabilities: z.array(IntegrationCapabilitySchema).readonly(),
    delivery: z.enum(["polling", "webhook", "manual", "unknown"]),
  })
  .strict();

export const IntegrationDiscoveryDetailSchema = z
  .object({
    id: IntegrationIdSchema,
    name: z.string().min(1),
    category: IntegrationCategorySchema,
    summary: z.string().min(1),
    capabilities: z.array(IntegrationCapabilitySchema).readonly(),
    products: z.array(DiscoveryProductSchema).readonly(),
    surfaces: z.array(IntegrationSurfaceSchema).readonly(),
    credentials: z.record(
      StableMetadataIdSchema,
      IntegrationCredentialDefinitionSchema,
    ),
    evidence: z.array(IntegrationEvidenceSchema).readonly(),
    operations: z.array(DiscoveryOperationSchema).readonly(),
    triggers: z.array(DiscoveryTriggerSchema).readonly(),
  })
  .strict()
  .superRefine((detail, context) => {
    const surfaceIds = new Set<string>();
    const evidenceIds = new Set<string>();
    for (const evidence of detail.evidence) {
      if (evidenceIds.has(evidence.id)) {
        context.addIssue({
          code: "custom",
          path: ["evidence"],
          message: `Duplicate evidence ID: ${evidence.id}`,
        });
      }
      evidenceIds.add(evidence.id);
    }
    for (const surface of detail.surfaces) {
      if (surfaceIds.has(surface.id)) {
        context.addIssue({
          code: "custom",
          path: ["surfaces"],
          message: `Duplicate surface ID: ${surface.id}`,
        });
      }
      surfaceIds.add(surface.id);
      for (const evidenceId of surface.evidenceIds) {
        if (!evidenceIds.has(evidenceId)) {
          context.addIssue({
            code: "custom",
            path: ["surfaces"],
            message: `Surface ${surface.id} references unknown evidence: ${evidenceId}`,
          });
        }
      }
      if (surface.auth.status !== "required") continue;
      for (const alternative of surface.auth.alternatives) {
        for (const use of alternative.uses) {
          if (!detail.credentials[use.credentialId]) {
            context.addIssue({
              code: "custom",
              path: ["surfaces"],
              message: `Surface ${surface.id} references unknown credential: ${use.credentialId}`,
            });
          }
        }
      }
    }
    const operationIds = new Set<string>();
    for (const operation of detail.operations) {
      if (operationIds.has(operation.id)) {
        context.addIssue({
          code: "custom",
          path: ["operations"],
          message: `Duplicate operation ID: ${operation.id}`,
        });
      }
      if (
        operation.id.includes(":") &&
        !operation.id.startsWith(`${detail.id}:`)
      ) {
        context.addIssue({
          code: "custom",
          path: ["operations"],
          message: `Operation ${operation.id} is not namespaced by ${detail.id}.`,
        });
      }
      operationIds.add(operation.id);
    }
    const triggerIds = new Set<string>();
    for (const trigger of detail.triggers) {
      if (triggerIds.has(trigger.id)) {
        context.addIssue({
          code: "custom",
          path: ["triggers"],
          message: `Duplicate trigger ID: ${trigger.id}`,
        });
      }
      if (trigger.id.includes(":") && !trigger.id.startsWith(`${detail.id}:`)) {
        context.addIssue({
          code: "custom",
          path: ["triggers"],
          message: `Trigger ${trigger.id} is not namespaced by ${detail.id}.`,
        });
      }
      triggerIds.add(trigger.id);
    }
  });

export const IntegrationDiscoveryManifestSchema = z
  .object({
    version: z.literal(INTEGRATION_DISCOVERY_MANIFEST_VERSION),
    generatedAt: z.string().datetime({ offset: true }),
    integrations: z.array(IntegrationDiscoveryDetailSchema).readonly(),
  })
  .strict()
  .superRefine((manifest, context) => {
    const ids = new Set<string>();
    for (const integration of manifest.integrations) {
      if (ids.has(integration.id)) {
        context.addIssue({
          code: "custom",
          path: ["integrations"],
          message: `Duplicate integration ID: ${integration.id}`,
        });
      }
      ids.add(integration.id);
    }
  });

export type IntegrationDiscoveryDetail = z.infer<
  typeof IntegrationDiscoveryDetailSchema
>;
export type IntegrationDiscoveryManifest = z.infer<
  typeof IntegrationDiscoveryManifestSchema
>;

function discoveryDetail(
  rawDefinition: IntegrationDefinition,
): IntegrationDiscoveryDetail {
  const definition = IntegrationDefinitionSchema.parse(rawDefinition);
  const metadata = metadataForIntegration(definition.id);
  return IntegrationDiscoveryDetailSchema.parse({
    id: definition.id,
    name: definition.name,
    category: definition.category,
    summary: definition.summary,
    capabilities: definition.capabilities,
    products: definition.products.map((product) => ({
      product: product.product,
      availability: product.availability,
      authMethods: product.authMethods,
      enabledCapabilities: product.enabledCapabilities,
      setup: product.setup,
      documentationPath: product.documentationPath,
    })),
    surfaces: metadata?.surfaces ?? [],
    credentials: metadata?.credentials ?? {},
    evidence: metadata?.evidence ?? [],
    operations: definition.operations,
    triggers: definition.triggers,
  });
}

export function createIntegrationDiscoveryManifest(
  definitions: readonly IntegrationDefinition[] = INTEGRATION_CATALOGUE,
  generatedAt = new Date().toISOString(),
): IntegrationDiscoveryManifest {
  return IntegrationDiscoveryManifestSchema.parse({
    version: INTEGRATION_DISCOVERY_MANIFEST_VERSION,
    generatedAt,
    integrations: definitions.map(discoveryDetail),
  });
}

export function serializeIntegrationDiscoveryManifest(
  manifest = createIntegrationDiscoveryManifest(),
): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function getIntegrationDiscovery(
  integrationId: string,
  definitions: readonly IntegrationDefinition[] = INTEGRATION_CATALOGUE,
): IntegrationDiscoveryDetail | undefined {
  const definition = definitions.find(
    (candidate) =>
      candidate.id === integrationId ||
      candidate.aliases.includes(integrationId),
  );
  return definition ? discoveryDetail(definition) : undefined;
}

export function getIntegrationSurfaces(
  integrationId: string,
  definitions: readonly IntegrationDefinition[] = INTEGRATION_CATALOGUE,
) {
  return getIntegrationDiscovery(integrationId, definitions)?.surfaces ?? [];
}

export function getIntegrationCredentials(
  integrationId: string,
  definitions: readonly IntegrationDefinition[] = INTEGRATION_CATALOGUE,
) {
  return getIntegrationDiscovery(integrationId, definitions)?.credentials ?? {};
}
