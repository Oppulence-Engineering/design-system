import { z } from "zod";

import {
  type IntegrationCapability,
  type IntegrationDefinition,
  IntegrationIdSchema,
  type Product,
  ProductSchema,
  StableDescriptorIdSchema,
} from "./contracts";

const SafeRelativePathSchema = z
  .string()
  .min(1)
  .max(2_000)
  .refine(
    (value) =>
      /^\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/.test(value) &&
      !/%(?:2f|5c|3f|23)/iu.test(value),
    "Redirect paths must be safe product-owned relative paths without a query, fragment, encoded separator, or protocol-relative host.",
  );

/**
 * Browser-safe connector command payloads. Product adapters validate these at
 * their boundary, then perform their own tenant, role, policy, and credential
 * checks. They intentionally contain neither tokens nor provider URLs.
 */
export const ConnectRequestSchema = z
  .object({
    integrationId: IntegrationIdSchema,
    mode: z.enum([
      "oauth2",
      "api_key",
      "service_account",
      "connection_link",
      "webhook",
      "file_upload",
      "mcp",
      "none",
    ]),
  })
  .strict();

export const ConnectResultSchema = z
  .object({
    state: z.enum(["redirect", "setup_required", "connected"]),
    safeNextStep: z.string().min(1).max(500),
    /**
     * Optional product route for a server-owned connection handoff. Raw OAuth
     * authorization URLs, query credentials, and callback state never cross
     * this shared boundary.
     */
    redirectPath: SafeRelativePathSchema.optional(),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.state === "redirect" && !result.redirectPath) {
      context.addIssue({
        code: "custom",
        path: ["redirectPath"],
        message: "Redirect results require a safe product-owned redirect path.",
      });
    }
    if (result.state !== "redirect" && result.redirectPath) {
      context.addIssue({
        code: "custom",
        path: ["redirectPath"],
        message: "Only redirect results may include a redirect path.",
      });
    }
  });

export const IntegrationActionRequestSchema = z
  .object({
    connectionId: z.string().min(1).max(160),
    action: z.enum([
      "reconnect",
      "sync_now",
      "configure",
      "disconnect",
      "inspect",
    ]),
  })
  .strict();

export const ConnectionHealthRequestSchema = z
  .object({
    connectionId: z.string().min(1).max(160),
  })
  .strict();

export const ActionResultSchema = z
  .object({
    accepted: z.boolean(),
    safeMessage: z.string().min(1).max(500),
  })
  .strict();

export const ConnectionHealthSchema = z
  .object({
    state: z.enum(["healthy", "stale", "attention", "disconnected"]),
    summary: z.string().min(1).max(500),
  })
  .strict();

export const IntegrationEntitlementSchema = z
  .object({
    allowed: z.boolean(),
    reasonCode: z.string().min(1).max(100).optional(),
    requestAccessAllowed: z.boolean().default(false),
    explanation: z.string().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.allowed && !value.explanation) {
      context.addIssue({
        code: "custom",
        path: ["explanation"],
        message: "Denied entitlement projections require a safe explanation.",
      });
    }
  });

/**
 * Static product policy recorded with a functional connector. This is not a
 * tenant decision: product APIs still evaluate and return IntegrationEntitlement
 * for each actor, organization, and command.
 */
export const IntegrationEntitlementPolicySchema = z
  .object({
    eligiblePlans: z.array(z.string().min(1).max(120)).min(1).readonly(),
    requiredRoles: z
      .array(z.enum(["view", "connect", "manage", "owner"]))
      .min(1)
      .readonly(),
    connectionLimit: z.number().int().positive().optional(),
    delegatedAdminRequired: z.boolean().default(false),
    dataRegionPolicy: z.string().min(1).max(500),
    requestAccessAllowed: z.boolean().default(false),
    featureFlag: z.string().min(1).max(160).optional(),
  })
  .strict();

export const EigennDataImpactSchema = z
  .object({
    product: z.literal("eigenn"),
    modelDriver: z.string().min(1).max(160),
    timeGrain: z.enum([
      "event",
      "daily",
      "weekly",
      "monthly",
      "quarterly",
      "annual",
    ]),
    currencyOrUnits: z.string().min(1).max(160),
    historicalCoverage: z.string().min(1).max(500),
    refreshTimestampField: z.string().min(1).max(160),
    forecastingUse: z.string().min(1).max(500),
  })
  .strict();

export const ConduittDataImpactSchema = z
  .object({
    product: z.literal("conduitt"),
    evidenceRecord: z.string().min(1).max(160),
    actionPolicy: z.string().min(1).max(500),
    idempotencyKey: z.string().min(1).max(160),
    auditEvent: z.string().min(1).max(160),
  })
  .strict();

export const IntegrationDataImpactSchema = z.discriminatedUnion("product", [
  EigennDataImpactSchema,
  ConduittDataImpactSchema,
]);

export const IntegrationDataContractSchema = z
  .object({
    id: z.string().min(1).max(160),
    schemaVersion: z.string().min(1).max(50),
    objectOrMetric: z.string().min(1).max(160),
    fieldClassification: z.enum([
      "public",
      "internal",
      "sensitive",
      "restricted",
    ]),
    normalizationRule: z.string().min(1).max(1_000),
    permittedUse: z.string().min(1).max(1_000),
    retentionDeletionOwner: z.string().min(1).max(160),
    sourceToOutputLineage: z.string().min(1).max(1_000),
    productImpact: IntegrationDataImpactSchema,
  })
  .strict();

/**
 * Product-owned command evidence for a supported action that does not create
 * a durable source-data contract. The shared package records only the
 * auditable descriptor; the command, authorization check, and execution stay
 * in the owning product.
 */
export const IntegrationActionContractSchema = z
  .object({
    id: StableDescriptorIdSchema,
    command: z.string().min(1).max(160),
    authorizationPolicy: z.string().min(1).max(1_000),
    idempotencyKey: z.string().min(1).max(160),
    auditEvent: z.string().min(1).max(160),
    sourceToOutputLineage: z.string().min(1).max(1_000),
  })
  .strict();

export const SupportedOperationSchema = z
  .object({
    sourceOperationId: z.string().min(1).max(160),
    disposition: z.enum([
      "supported",
      "intentionally-not-applicable",
      "not-yet-supported",
    ]),
    outcome: z.string().min(1).max(500).optional(),
    dataContractIds: z.array(z.string().min(1)).readonly().default([]),
    actionContractId: StableDescriptorIdSchema.optional(),
  })
  .strict()
  .superRefine((operation, context) => {
    if (operation.disposition !== "supported") {
      return;
    }
    if (!operation.outcome) {
      context.addIssue({
        code: "custom",
        path: ["outcome"],
        message: "Supported operations require a named product outcome.",
      });
    }
    if (
      operation.dataContractIds.length === 0 &&
      operation.actionContractId === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["dataContractIds"],
        message:
          "Supported operations require a data contract or governed action contract.",
      });
    }
  });

export const SupportedTriggerSchema = z
  .object({
    sourceTriggerId: z.string().min(1).max(160),
    disposition: z.enum([
      "supported",
      "intentionally-not-applicable",
      "not-yet-supported",
    ]),
    outcome: z.string().min(1).max(500).optional(),
    dataContractIds: z.array(z.string().min(1)).readonly().default([]),
    actionContractId: StableDescriptorIdSchema.optional(),
  })
  .strict()
  .superRefine((trigger, context) => {
    if (trigger.disposition !== "supported") {
      return;
    }
    if (!trigger.outcome) {
      context.addIssue({
        code: "custom",
        path: ["outcome"],
        message: "Supported triggers require a named product outcome.",
      });
    }
    if (
      trigger.dataContractIds.length === 0 &&
      trigger.actionContractId === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["dataContractIds"],
        message:
          "Supported triggers require a data contract or governed action contract.",
      });
    }
  });

export const IntegrationServiceLevelSchema = z
  .object({
    initialSyncExpectedWithinMinutes: z.number().int().positive(),
    normalRefreshCadenceMinutes: z.number().int().positive().optional(),
    maximumFreshnessMinutes: z.number().int().positive(),
    retryClass: z.enum(["none", "best-effort", "standard", "critical"]),
    backfillWindowDays: z.number().int().nonnegative(),
    degradationBehavior: z.string().min(1).max(1_000),
    recoveryActions: z
      .array(z.enum(["reconnect", "sync_now", "configure", "disconnect"]))
      .min(1)
      .readonly(),
    ownerSurface: z.string().min(1).max(160),
  })
  .strict();

export const IntegrationSupportContractSchema = z
  .object({
    integrationId: IntegrationIdSchema,
    product: ProductSchema,
    owner: z.string().min(1).max(160),
    connectionModes: z
      .array(
        z.enum([
          "oauth2",
          "api_key",
          "service_account",
          "connection_link",
          "webhook",
          "file_upload",
          "mcp",
          "none",
        ]),
      )
      .min(1)
      .readonly(),
    syncMode: z.enum(["on_demand", "polling", "webhook", "hybrid", "none"]),
    outcome: z.string().min(1).max(500),
    dataContracts: z.array(IntegrationDataContractSchema).readonly(),
    actionContracts: z
      .array(IntegrationActionContractSchema)
      .readonly()
      .default([]),
    operations: z.array(SupportedOperationSchema).readonly(),
    triggers: z.array(SupportedTriggerSchema).readonly(),
    entitlementPolicy: IntegrationEntitlementPolicySchema,
    serviceLevel: IntegrationServiceLevelSchema,
  })
  .strict()
  .superRefine((contract, context) => {
    const dataContractIds = new Set(
      contract.dataContracts.map((dataContract) => dataContract.id),
    );
    const actionContractIds = new Set<string>();
    for (const actionContract of contract.actionContracts) {
      if (actionContractIds.has(actionContract.id)) {
        context.addIssue({
          code: "custom",
          path: ["actionContracts"],
          message: `Duplicate action contract: ${actionContract.id}`,
        });
      }
      actionContractIds.add(actionContract.id);
    }
    const hasSupportedPath =
      contract.operations.some(
        (operation) => operation.disposition === "supported",
      ) ||
      contract.triggers.some((trigger) => trigger.disposition === "supported");
    if (!hasSupportedPath) {
      context.addIssue({
        code: "custom",
        path: ["operations"],
        message:
          "A functional support contract needs at least one supported operation or trigger.",
      });
    }
    for (const operation of contract.operations) {
      for (const dataContractId of operation.dataContractIds) {
        if (!dataContractIds.has(dataContractId)) {
          context.addIssue({
            code: "custom",
            path: ["operations"],
            message: `Operation references an unknown data contract: ${dataContractId}`,
          });
        }
      }
      if (
        operation.actionContractId &&
        !actionContractIds.has(operation.actionContractId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["operations"],
          message: `Operation references an unknown action contract: ${operation.actionContractId}`,
        });
      }
    }
    for (const trigger of contract.triggers) {
      for (const dataContractId of trigger.dataContractIds) {
        if (!dataContractIds.has(dataContractId)) {
          context.addIssue({
            code: "custom",
            path: ["triggers"],
            message: `Trigger references an unknown data contract: ${dataContractId}`,
          });
        }
      }
      if (
        trigger.actionContractId &&
        !actionContractIds.has(trigger.actionContractId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["triggers"],
          message: `Trigger references an unknown action contract: ${trigger.actionContractId}`,
        });
      }
    }
    for (const dataContract of contract.dataContracts) {
      if (dataContract.productImpact.product !== contract.product) {
        context.addIssue({
          code: "custom",
          path: ["dataContracts"],
          message: `Data contract ${dataContract.id} has a ${dataContract.productImpact.product} impact for a ${contract.product} support contract.`,
        });
      }
    }
  });

export type ConnectRequest = z.infer<typeof ConnectRequestSchema>;
export type ConnectResult = z.infer<typeof ConnectResultSchema>;
export type IntegrationActionRequest = z.infer<
  typeof IntegrationActionRequestSchema
>;
export type ConnectionHealthRequest = z.infer<
  typeof ConnectionHealthRequestSchema
>;
export type ActionResult = z.infer<typeof ActionResultSchema>;
export type ConnectionHealth = z.infer<typeof ConnectionHealthSchema>;

export interface ProductIntegrationConnector<TContext> {
  beginConnection(
    context: TContext,
    request: ConnectRequest,
  ): Promise<ConnectResult>;
  performAction(
    context: TContext,
    request: IntegrationActionRequest,
  ): Promise<ActionResult>;
  getConnectionHealth(
    context: TContext,
    request: ConnectionHealthRequest,
  ): Promise<ConnectionHealth>;
}

export type IntegrationEntitlement = z.infer<
  typeof IntegrationEntitlementSchema
>;
export type IntegrationEntitlementPolicy = z.infer<
  typeof IntegrationEntitlementPolicySchema
>;
export type IntegrationDataContract = z.infer<
  typeof IntegrationDataContractSchema
>;
export type IntegrationActionContract = z.infer<
  typeof IntegrationActionContractSchema
>;
export type IntegrationServiceLevel = z.infer<
  typeof IntegrationServiceLevelSchema
>;
export type IntegrationSupportContract = z.infer<
  typeof IntegrationSupportContractSchema
>;

function supportKey(integrationId: string, product: Product): string {
  return `${integrationId}:${product}`;
}

function isFunctionalAvailability(availability: string): boolean {
  return availability === "shipped" || availability === "beta";
}

function validateContractAgainstDefinition(
  contract: IntegrationSupportContract,
  definition: IntegrationDefinition,
): void {
  const product = definition.products.find(
    (candidate) => candidate.product === contract.product,
  );
  if (!product) {
    throw new Error(
      `Support contract ${supportKey(contract.integrationId, contract.product)} has no matching product registry entry.`,
    );
  }
  const authMethods = new Set(product.authMethods);
  for (const connectionMode of contract.connectionModes) {
    if (!authMethods.has(connectionMode)) {
      throw new Error(
        `Support contract ${supportKey(contract.integrationId, contract.product)} uses unsupported connection mode ${connectionMode}.`,
      );
    }
  }

  const operationIds = new Set(
    definition.operations.map((operation) => operation.id),
  );
  const triggerIds = new Set(definition.triggers.map((trigger) => trigger.id));
  const enabledCapabilities = new Set(product.enabledCapabilities);
  const operationsById = new Map(
    definition.operations.map((operation) => [operation.id, operation]),
  );
  const triggersById = new Map(
    definition.triggers.map((trigger) => [trigger.id, trigger]),
  );
  const seenOperations = new Set<string>();
  const seenTriggers = new Set<string>();
  for (const operation of contract.operations) {
    if (!operationIds.has(operation.sourceOperationId)) {
      throw new Error(
        `Support contract ${supportKey(contract.integrationId, contract.product)} references an unknown operation ${operation.sourceOperationId}.`,
      );
    }
    if (seenOperations.has(operation.sourceOperationId)) {
      throw new Error(
        `Support contract ${supportKey(contract.integrationId, contract.product)} duplicates operation ${operation.sourceOperationId}.`,
      );
    }
    seenOperations.add(operation.sourceOperationId);
    if (
      operation.disposition === "supported" &&
      operationsById
        .get(operation.sourceOperationId)!
        .requiredCapabilities.some(
          (capability) => !enabledCapabilities.has(capability),
        )
    ) {
      throw new Error(
        `Support contract ${supportKey(contract.integrationId, contract.product)} supports an operation whose required capability is not enabled for this product.`,
      );
    }
  }
  for (const trigger of contract.triggers) {
    if (!triggerIds.has(trigger.sourceTriggerId)) {
      throw new Error(
        `Support contract ${supportKey(contract.integrationId, contract.product)} references an unknown trigger ${trigger.sourceTriggerId}.`,
      );
    }
    if (seenTriggers.has(trigger.sourceTriggerId)) {
      throw new Error(
        `Support contract ${supportKey(contract.integrationId, contract.product)} duplicates trigger ${trigger.sourceTriggerId}.`,
      );
    }
    seenTriggers.add(trigger.sourceTriggerId);
    if (
      trigger.disposition === "supported" &&
      triggersById
        .get(trigger.sourceTriggerId)!
        .requiredCapabilities.some(
          (capability) => !enabledCapabilities.has(capability),
        )
    ) {
      throw new Error(
        `Support contract ${supportKey(contract.integrationId, contract.product)} supports a trigger whose required capability is not enabled for this product.`,
      );
    }
  }
}

/**
 * Reporting must be conservative even when its caller has not run the strict
 * validator. Invalid, unknown, and duplicate contract records therefore never
 * contribute to functional coverage.
 */
function validContractsByKey(
  definitions: readonly IntegrationDefinition[],
  contracts: readonly IntegrationSupportContract[],
): ReadonlyMap<string, IntegrationSupportContract> {
  const definitionsById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  const valid = new Map<string, IntegrationSupportContract>();
  const duplicates = new Set<string>();
  for (const rawContract of contracts) {
    const parsed = IntegrationSupportContractSchema.safeParse(rawContract);
    if (!parsed.success) {
      continue;
    }
    const key = supportKey(parsed.data.integrationId, parsed.data.product);
    const definition = definitionsById.get(parsed.data.integrationId);
    if (!definition || duplicates.has(key)) {
      continue;
    }
    try {
      validateContractAgainstDefinition(parsed.data, definition);
    } catch {
      continue;
    }
    if (valid.has(key)) {
      valid.delete(key);
      duplicates.add(key);
      continue;
    }
    valid.set(key, parsed.data);
  }
  return valid;
}

/**
 * Resolves only a support record that is parseable, matches the product
 * definition, and belongs to a beta or shipped product integration.
 */
export function getFunctionalSupportContract(
  definitions: readonly IntegrationDefinition[],
  contracts: readonly IntegrationSupportContract[],
  integrationId: string,
  product: Product,
): IntegrationSupportContract | undefined {
  const definition = definitions.find(
    (candidate) => candidate.id === integrationId,
  );
  const productMetadata = definition?.products.find(
    (candidate) => candidate.product === product,
  );
  if (
    !definition ||
    !productMetadata ||
    !isFunctionalAvailability(productMetadata.availability)
  ) {
    return undefined;
  }
  return validContractsByKey(definitions, contracts).get(
    supportKey(integrationId, product),
  );
}

export interface OperationTriggerCoverageReport {
  supportedIntegrationIds: readonly string[];
  operations: {
    total: number;
    explicit: number;
    supported: number;
    intentionallyNotApplicable: number;
    notYetSupported: number;
    missing: readonly string[];
  };
  triggers: {
    total: number;
    explicit: number;
    supported: number;
    intentionallyNotApplicable: number;
    notYetSupported: number;
    missing: readonly string[];
  };
}

type DescriptorDisposition =
  | "supported"
  | "intentionally-not-applicable"
  | "not-yet-supported";

function descriptorKey(
  integrationId: string,
  product: Product,
  sourceDescriptorId: string,
): string {
  return `${integrationId}:${product}:${sourceDescriptorId}`;
}

function makeDescriptorCoverage(
  descriptorKeys: readonly string[],
  dispositions: ReadonlyMap<string, DescriptorDisposition>,
) {
  const counts = {
    supported: 0,
    intentionallyNotApplicable: 0,
    notYetSupported: 0,
  };
  const missing: string[] = [];
  for (const key of descriptorKeys) {
    const disposition = dispositions.get(key);
    if (!disposition) {
      missing.push(key);
      continue;
    }
    if (disposition === "supported") {
      counts.supported += 1;
    } else if (disposition === "intentionally-not-applicable") {
      counts.intentionallyNotApplicable += 1;
    } else {
      counts.notYetSupported += 1;
    }
  }
  return {
    total: descriptorKeys.length,
    explicit: descriptorKeys.length - missing.length,
    ...counts,
    missing,
  };
}

/**
 * Audits explicit source-operation and source-trigger dispositions for every
 * product integration that is already beta or shipped. Phase 4 can use this
 * report to block any silently dropped source capability.
 */
export function getOperationTriggerCoverageReport(
  definitions: readonly IntegrationDefinition[],
  contracts: readonly IntegrationSupportContract[],
): OperationTriggerCoverageReport {
  const contractsByKey = validContractsByKey(definitions, contracts);
  const operationDescriptorKeys: string[] = [];
  const triggerDescriptorKeys: string[] = [];
  const operationDispositions = new Map<string, DescriptorDisposition>();
  const supportedIntegrationIds = new Set<string>();
  const triggerDispositions = new Map<string, DescriptorDisposition>();

  for (const definition of definitions) {
    for (const product of definition.products) {
      if (!isFunctionalAvailability(product.availability)) {
        continue;
      }
      const contract = contractsByKey.get(
        supportKey(definition.id, product.product),
      );
      operationDescriptorKeys.push(
        ...definition.operations.map((operation) =>
          descriptorKey(definition.id, product.product, operation.id),
        ),
      );
      triggerDescriptorKeys.push(
        ...definition.triggers.map((trigger) =>
          descriptorKey(definition.id, product.product, trigger.id),
        ),
      );
      if (!contract) {
        continue;
      }
      for (const operation of contract.operations) {
        operationDispositions.set(
          descriptorKey(
            definition.id,
            product.product,
            operation.sourceOperationId,
          ),
          operation.disposition,
        );
      }
      for (const trigger of contract.triggers) {
        triggerDispositions.set(
          descriptorKey(
            definition.id,
            product.product,
            trigger.sourceTriggerId,
          ),
          trigger.disposition,
        );
      }
      if (
        contract.operations.some(
          (operation) => operation.disposition === "supported",
        ) ||
        contract.triggers.some((trigger) => trigger.disposition === "supported")
      ) {
        supportedIntegrationIds.add(definition.id);
      }
    }
  }

  return {
    supportedIntegrationIds: [...supportedIntegrationIds].sort(),
    operations: makeDescriptorCoverage(
      operationDescriptorKeys,
      operationDispositions,
    ),
    triggers: makeDescriptorCoverage(
      triggerDescriptorKeys,
      triggerDispositions,
    ),
  };
}

/**
 * Phase 4 gate for product-owned integration suites. A source descriptor may
 * be supported, intentionally inapplicable, or not yet supported, but it may
 * not disappear from a functional provider's support record.
 */
export function assertOperationTriggerCoverage(
  definitions: readonly IntegrationDefinition[],
  contracts: readonly IntegrationSupportContract[],
): void {
  const coverage = getOperationTriggerCoverageReport(definitions, contracts);
  const missing = [
    ...coverage.operations.missing,
    ...coverage.triggers.missing,
  ];
  if (missing.length > 0) {
    throw new Error(
      `Operation/trigger disposition coverage is incomplete: ${missing.join(", ")}`,
    );
  }
}

/**
 * Ensures a product cannot mark an integration functional without the RFC's
 * support, entitlement, recovery, and lineage record.
 */
export function validateFunctionalSupportContracts(
  definitions: readonly IntegrationDefinition[],
  contracts: readonly IntegrationSupportContract[],
): void {
  const definitionsById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  const contractKeys = new Set<string>();
  for (const rawContract of contracts) {
    const contract = IntegrationSupportContractSchema.parse(rawContract);
    const key = supportKey(contract.integrationId, contract.product);
    if (contractKeys.has(key)) {
      throw new Error(`Duplicate support contract: ${key}.`);
    }
    contractKeys.add(key);
    const definition = definitionsById.get(contract.integrationId);
    if (!definition) {
      throw new Error(
        `Support contract ${key} references an unknown integration.`,
      );
    }
    validateContractAgainstDefinition(contract, definition);
  }
  for (const definition of definitions) {
    for (const product of definition.products) {
      if (isFunctionalAvailability(product.availability)) {
        const key = supportKey(definition.id, product.product);
        if (!contractKeys.has(key)) {
          throw new Error(
            `Functional integration ${key} has no support contract.`,
          );
        }
      }
    }
  }
}

/**
 * Returns only providers backed by both functional product metadata and a
 * parseable support contract. Registry availability alone never creates a
 * functional-parity claim.
 */
export function getFunctionallySupportedIntegrationIds(
  definitions: readonly IntegrationDefinition[],
  contracts: readonly IntegrationSupportContract[],
): ReadonlySet<string> {
  const contractsByKey = validContractsByKey(definitions, contracts);
  const functional = new Set<string>();
  for (const definition of definitions) {
    if (
      definition.products.some(
        (product) =>
          isFunctionalAvailability(product.availability) &&
          contractsByKey.has(supportKey(definition.id, product.product)),
      )
    ) {
      functional.add(definition.id);
    }
  }
  return functional;
}

export function supportedCapabilities(
  definition: IntegrationDefinition,
  product: Product,
): readonly IntegrationCapability[] {
  return (
    definition.products.find((candidate) => candidate.product === product)
      ?.enabledCapabilities ?? []
  );
}
