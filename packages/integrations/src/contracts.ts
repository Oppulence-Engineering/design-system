import { z } from "zod";

export const PRODUCTS = ["eigenn", "conduitt"] as const;
export const PRODUCT_AVAILABILITY = [
  "shipped",
  "beta",
  "planned",
  "retired",
] as const;
export const INTEGRATION_AUTH_METHODS = [
  "oauth2",
  "api_key",
  "service_account",
  "connection_link",
  "webhook",
  "file_upload",
  "mcp",
  "none",
] as const;
export const INTEGRATION_CATEGORIES = [
  "ai",
  "analytics",
  "commerce",
  "communication",
  "databases",
  "devops",
  "documents",
  "email",
  "hr",
  "marketing",
  "observability",
  "productivity",
  "sales",
  "search",
  "security",
  "support",
  "accounting",
  "banking-cash",
  "payments-billing",
  "payroll-hr",
  "crm-work",
  "communications",
  "spreadsheets-data",
  "automation",
] as const;
export const INTEGRATION_CAPABILITIES = [
  "ledger_actuals",
  "chart_of_accounts",
  "invoice_import",
  "payment_import",
  "customer_import",
  "journal_import",
  "draft_invoice_export",
  "bank_balance",
  "bank_transaction_import",
  "cash_position",
  "payment_match_evidence",
  "subscription_metrics",
  "revenue_recognition_input",
  "payment_collection",
  "payment_status_webhook",
  "payroll_actuals",
  "headcount_driver",
  "compensation_driver",
  "employee_dimension",
  "crm_account_context",
  "crm_contact_context",
  "deal_pipeline_driver",
  "customer_health_export",
  "mailbox_sync",
  "email_send",
  "message_send",
  "reply_capture",
  "approval_action",
  "file_import",
  "spreadsheet_import",
  "warehouse_metric",
  "bi_metric",
  "source_provenance",
  "event_trigger",
  "signed_webhook_delivery",
  "workflow_action",
  "mcp_tool_access",
] as const;
export const CONNECTION_STATES = [
  "not_connected",
  "authorizing",
  "initial_sync",
  "healthy",
  "stale",
  "attention",
  "disconnected",
] as const;
export const PERMITTED_CONNECTION_ACTIONS = [
  "connect",
  "reconnect",
  "sync_now",
  "configure",
  "disconnect",
  "inspect",
] as const;

export const IntegrationIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Integration IDs are lowercase kebab-case.");
export const IntegrationCapabilitySchema = z.enum(INTEGRATION_CAPABILITIES);
export const IntegrationCategorySchema = z.enum(INTEGRATION_CATEGORIES);
export const IntegrationAuthMethodSchema = z.enum(INTEGRATION_AUTH_METHODS);
export const ProductSchema = z.enum(PRODUCTS);
export const ProductAvailabilitySchema = z.enum(PRODUCT_AVAILABILITY);
export const StableDescriptorIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(
    /^[a-z0-9][a-z0-9:-]*$/,
    "Descriptor IDs must be stable lowercase identifiers.",
  );

const CapabilityListSchema = z.array(IntegrationCapabilitySchema).readonly();
const AuthMethodListSchema = z
  .array(IntegrationAuthMethodSchema)
  .min(1)
  .readonly();

export const IntegrationOperationSchema = z
  .object({
    id: StableDescriptorIdSchema,
    label: z.string().min(1).max(160),
    description: z.string().min(1).max(2_000),
    requiredCapabilities: CapabilityListSchema.default([]),
    inputSensitivity: z
      .enum(["public", "internal", "sensitive"])
      .default("internal"),
    outputSensitivity: z
      .enum(["public", "internal", "sensitive"])
      .default("internal"),
  })
  .strict();

export const IntegrationTriggerSchema = z
  .object({
    id: StableDescriptorIdSchema,
    label: z.string().min(1).max(160),
    description: z.string().min(1).max(2_000),
    requiredCapabilities: CapabilityListSchema.default(["event_trigger"]),
    delivery: z
      .enum(["polling", "webhook", "manual", "unknown"])
      .default("unknown"),
  })
  .strict();

export const IntegrationSetupStepSchema = z
  .object({
    id: StableDescriptorIdSchema,
    label: z.string().min(1).max(160),
    description: z.string().min(1).max(1_000),
    required: z.boolean().default(true),
  })
  .strict();

export const SimStudioParityReferenceSchema = z
  .object({
    source: z.literal("simstudio"),
    sourceSlug: z.string().min(1),
    sourceType: z.string().min(1),
    sourceCategory: z.string().min(1),
    sourceAuthType: z.enum(["api-key", "none", "oauth"]),
    sourceSnapshot: z.literal("2026-07-30"),
  })
  .strict();

export const OppulenceSourceReferenceSchema = z
  .object({
    source: z.literal("oppulence"),
  })
  .strict();

export const SourceParityReferenceSchema = z.discriminatedUnion("source", [
  SimStudioParityReferenceSchema,
  OppulenceSourceReferenceSchema,
]);

export const ProductIntegrationSchema = z
  .object({
    product: ProductSchema,
    availability: ProductAvailabilitySchema,
    authMethods: AuthMethodListSchema,
    enabledCapabilities: CapabilityListSchema.default([]),
    setup: z.array(IntegrationSetupStepSchema).readonly().default([]),
    documentationPath: z.string().regex(/^\//).optional(),
    minimumPermission: z.enum(["view", "connect", "manage"]).default("connect"),
    plannedOutcome: z.string().min(1).max(500).optional(),
  })
  .strict();

export const IntegrationDefinitionSchema = z
  .object({
    id: IntegrationIdSchema,
    aliases: z.array(IntegrationIdSchema).readonly(),
    name: z.string().min(1).max(160),
    category: IntegrationCategorySchema,
    summary: z.string().min(1).max(1_000),
    capabilities: CapabilityListSchema,
    operations: z.array(IntegrationOperationSchema).readonly(),
    triggers: z.array(IntegrationTriggerSchema).readonly(),
    products: z.array(ProductIntegrationSchema).min(1).readonly(),
    sourceParity: z.array(SourceParityReferenceSchema).min(1).readonly(),
  })
  .strict()
  .superRefine((definition, context) => {
    const capabilities = new Set(definition.capabilities);
    const aliases = new Set<string>();
    const productNames = new Set<string>();
    const operationIds = new Set<string>();
    const triggerIds = new Set<string>();

    for (const alias of definition.aliases) {
      if (alias === definition.id) {
        context.addIssue({
          code: "custom",
          path: ["aliases"],
          message: "An alias cannot equal its canonical ID.",
        });
      }
      if (aliases.has(alias)) {
        context.addIssue({
          code: "custom",
          path: ["aliases"],
          message: `Duplicate alias: ${alias}`,
        });
      }
      aliases.add(alias);
    }

    for (const product of definition.products) {
      if (productNames.has(product.product)) {
        context.addIssue({
          code: "custom",
          path: ["products"],
          message: `Duplicate product metadata: ${product.product}`,
        });
      }
      productNames.add(product.product);
      for (const capability of product.enabledCapabilities) {
        if (!capabilities.has(capability)) {
          context.addIssue({
            code: "custom",
            path: ["products"],
            message: `${product.product} enables a capability not present on ${definition.id}: ${capability}`,
          });
        }
      }
    }

    for (const operation of definition.operations) {
      if (operationIds.has(operation.id)) {
        context.addIssue({
          code: "custom",
          path: ["operations"],
          message: `Duplicate operation ID: ${operation.id}`,
        });
      }
      operationIds.add(operation.id);
      for (const capability of operation.requiredCapabilities) {
        if (!capabilities.has(capability)) {
          context.addIssue({
            code: "custom",
            path: ["operations"],
            message: `Operation ${operation.id} requires an unknown capability.`,
          });
        }
      }
    }

    for (const trigger of definition.triggers) {
      if (triggerIds.has(trigger.id)) {
        context.addIssue({
          code: "custom",
          path: ["triggers"],
          message: `Duplicate trigger ID: ${trigger.id}`,
        });
      }
      triggerIds.add(trigger.id);
      for (const capability of trigger.requiredCapabilities) {
        if (!capabilities.has(capability)) {
          context.addIssue({
            code: "custom",
            path: ["triggers"],
            message: `Trigger ${trigger.id} requires an unknown capability.`,
          });
        }
      }
    }
  });

/**
 * Browser directory payload. Operation, trigger, setup, support, lineage, and
 * template data deliberately stay out of this compact search/filter model.
 */
export const IntegrationSummarySchema = z
  .object({
    id: IntegrationIdSchema,
    name: z.string().min(1).max(160),
    category: IntegrationCategorySchema,
    summary: z.string().min(1).max(1_000),
    capabilities: CapabilityListSchema,
    authMethods: AuthMethodListSchema,
    availability: ProductAvailabilitySchema,
    searchText: z.string().min(1),
  })
  .strict();

export const SourceFreshnessSchema = z
  .object({
    state: z.enum(["fresh", "stale", "unknown", "failed"]),
    lastSuccessfulSyncAt: z.string().datetime({ offset: true }).optional(),
    nextExpectedSyncAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const IntegrationConnectionProjectionSchema = z
  .object({
    id: z.string().min(1).max(160),
    integrationId: IntegrationIdSchema,
    product: ProductSchema,
    displayName: z.string().min(1).max(200),
    state: z.enum(CONNECTION_STATES),
    enabledCapabilities: CapabilityListSchema.default([]),
    sourceFreshness: SourceFreshnessSchema.optional(),
    accountLabel: z.string().min(1).max(200).optional(),
    permittedActions: z.array(z.enum(PERMITTED_CONNECTION_ACTIONS)).readonly(),
    safeIssue: z
      .object({
        code: z.string().min(1).max(100),
        summary: z.string().min(1).max(500),
        recoverable: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type IntegrationId = z.infer<typeof IntegrationIdSchema>;
export type IntegrationCapability = z.infer<typeof IntegrationCapabilitySchema>;
export type IntegrationCategory = z.infer<typeof IntegrationCategorySchema>;
export type IntegrationAuthMethod = z.infer<typeof IntegrationAuthMethodSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type ProductAvailability = z.infer<typeof ProductAvailabilitySchema>;
export type IntegrationOperation = z.infer<typeof IntegrationOperationSchema>;
export type IntegrationTrigger = z.infer<typeof IntegrationTriggerSchema>;
export type IntegrationSetupStep = z.infer<typeof IntegrationSetupStepSchema>;
export type SourceParityReference = z.infer<typeof SourceParityReferenceSchema>;
export type ProductIntegration = z.infer<typeof ProductIntegrationSchema>;
export type IntegrationDefinition = z.infer<typeof IntegrationDefinitionSchema>;
export type IntegrationSummary = z.infer<typeof IntegrationSummarySchema>;
export type IntegrationConnectionProjection = z.infer<
  typeof IntegrationConnectionProjectionSchema
>;
