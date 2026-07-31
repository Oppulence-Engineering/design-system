import simStudioBaseline from "./generated/simstudio-baseline.json";

import {
  type IntegrationAuthMethod,
  type IntegrationCapability,
  type IntegrationCategory,
  type IntegrationDefinition,
  IntegrationDefinitionSchema,
  type ProductIntegration,
} from "./contracts";

interface SimStudioBaselineRecord {
  id: string;
  aliases: string[];
  sourceSlug: string;
  sourceType: string;
  name: string;
  summary: string;
  sourceDocumentationUrl?: string;
  sourceCategory: IntegrationCategory;
  sourceAuthType: "api-key" | "none" | "oauth";
  tags: string[];
  operations: Array<{ id: string; label: string; description: string }>;
  triggers: Array<{ id: string; label: string; description: string }>;
}

interface SimStudioBaseline {
  sourceCommit: string;
  sourceBlob: string;
  sourceDate: "2026-07-30";
  sourceUrl: string;
  generatedAt: string;
  reviewNote: string;
  integrations: SimStudioBaselineRecord[];
}

export const SIMSTUDIO_BASELINE = simStudioBaseline as SimStudioBaseline;

const authMethodForSource: Record<
  SimStudioBaselineRecord["sourceAuthType"],
  IntegrationAuthMethod
> = {
  "api-key": "api_key",
  none: "none",
  oauth: "oauth2",
};

function plannedProduct(
  product: ProductIntegration["product"],
  authMethod: IntegrationAuthMethod,
  plannedOutcome: string,
  documentationPath: string,
): ProductIntegration {
  return {
    product,
    availability: "planned",
    authMethods: [authMethod],
    enabledCapabilities: [],
    setup: [],
    documentationPath,
    minimumPermission: "connect",
    plannedOutcome,
  };
}

function simStudioCapabilities(
  record: SimStudioBaselineRecord,
): IntegrationCapability[] {
  return record.triggers.length > 0
    ? ["workflow_action", "event_trigger"]
    : ["workflow_action"];
}

function fromSimStudio(record: SimStudioBaselineRecord): IntegrationDefinition {
  const documentationPath = `/integrations/${record.id}`;
  const capabilities = simStudioCapabilities(record);
  return IntegrationDefinitionSchema.parse({
    id: record.id,
    aliases: record.aliases,
    name: record.name,
    category: record.sourceCategory,
    summary: record.summary,
    capabilities,
    operations: record.operations.map((operation) => ({
      ...operation,
      description: operation.description || "No source description available.",
      requiredCapabilities: ["workflow_action"],
      inputSensitivity: "internal",
      outputSensitivity: "internal",
    })),
    triggers: record.triggers.map((trigger) => ({
      ...trigger,
      description: trigger.description || "No source description available.",
      requiredCapabilities: ["event_trigger"],
      delivery: "unknown",
    })),
    products: [
      plannedProduct(
        "eigenn",
        authMethodForSource[record.sourceAuthType],
        "Tracked for a finance decision or modelling outcome once an owned connector is verified.",
        documentationPath,
      ),
      plannedProduct(
        "conduitt",
        authMethodForSource[record.sourceAuthType],
        "Tracked for a governed revenue-execution outcome once an owned connector is verified.",
        documentationPath,
      ),
    ],
    sourceParity: [
      {
        source: "simstudio",
        sourceSlug: record.sourceSlug,
        sourceType: record.sourceType,
        sourceCategory: record.sourceCategory,
        sourceAuthType: record.sourceAuthType,
        sourceSnapshot: "2026-07-30",
      },
    ],
  });
}

interface ExtraDefinitionInput {
  id: string;
  aliases: string[];
  name: string;
  category: IntegrationCategory;
  summary: string;
  capabilities: IntegrationCapability[];
  authMethods: IntegrationAuthMethod[];
}

const EXTRA_INTEGRATIONS: readonly ExtraDefinitionInput[] = [
  {
    id: "quickbooks",
    aliases: ["quick-books", "quickbooks-online"],
    name: "QuickBooks",
    category: "accounting",
    summary:
      "Accounting actuals, invoices, payments, and chart-of-accounts context.",
    capabilities: [
      "ledger_actuals",
      "chart_of_accounts",
      "invoice_import",
      "payment_import",
      "customer_import",
      "journal_import",
      "source_provenance",
    ],
    authMethods: ["oauth2"],
  },
  {
    id: "xero",
    aliases: [],
    name: "Xero",
    category: "accounting",
    summary: "Accounting actuals and operational finance context.",
    capabilities: [
      "ledger_actuals",
      "chart_of_accounts",
      "invoice_import",
      "payment_import",
      "customer_import",
      "source_provenance",
    ],
    authMethods: ["oauth2"],
  },
  {
    id: "fortnox",
    aliases: [],
    name: "Fortnox",
    category: "accounting",
    summary: "Swedish accounting and invoice context.",
    capabilities: [
      "ledger_actuals",
      "invoice_import",
      "payment_import",
      "source_provenance",
    ],
    authMethods: ["oauth2", "api_key"],
  },
  {
    id: "freshbooks",
    aliases: [],
    name: "FreshBooks",
    category: "accounting",
    summary: "Small-business accounting and invoice context.",
    capabilities: [
      "ledger_actuals",
      "invoice_import",
      "payment_import",
      "source_provenance",
    ],
    authMethods: ["oauth2"],
  },
  {
    id: "wave",
    aliases: [],
    name: "Wave",
    category: "accounting",
    summary: "Small-business accounting actuals and invoice context.",
    capabilities: [
      "ledger_actuals",
      "invoice_import",
      "payment_import",
      "source_provenance",
    ],
    authMethods: ["oauth2"],
  },
  {
    id: "zoho-books",
    aliases: ["zohobooks"],
    name: "Zoho Books",
    category: "accounting",
    summary: "Accounting actuals, invoices, and payment context.",
    capabilities: [
      "ledger_actuals",
      "chart_of_accounts",
      "invoice_import",
      "payment_import",
      "source_provenance",
    ],
    authMethods: ["oauth2"],
  },
  {
    id: "netsuite",
    aliases: ["oracle-netsuite"],
    name: "NetSuite",
    category: "accounting",
    summary: "ERP financial actuals and operational dimensions.",
    capabilities: [
      "ledger_actuals",
      "chart_of_accounts",
      "invoice_import",
      "payment_import",
      "journal_import",
      "source_provenance",
    ],
    authMethods: ["oauth2", "service_account"],
  },
  {
    id: "plaid",
    aliases: [],
    name: "Plaid",
    category: "banking-cash",
    summary: "Permissioned bank balances and transactions for cash visibility.",
    capabilities: [
      "bank_balance",
      "bank_transaction_import",
      "cash_position",
      "payment_match_evidence",
      "source_provenance",
    ],
    authMethods: ["connection_link"],
  },
  {
    id: "teller",
    aliases: [],
    name: "Teller",
    category: "banking-cash",
    summary: "Permissioned bank account and transaction data.",
    capabilities: [
      "bank_balance",
      "bank_transaction_import",
      "cash_position",
      "source_provenance",
    ],
    authMethods: ["connection_link"],
  },
  {
    id: "gocardless",
    aliases: ["go-cardless"],
    name: "GoCardless",
    category: "banking-cash",
    summary: "Bank account data and recurring payment evidence.",
    capabilities: [
      "bank_balance",
      "bank_transaction_import",
      "payment_collection",
      "source_provenance",
    ],
    authMethods: ["oauth2", "api_key"],
  },
  {
    id: "enable-banking",
    aliases: [],
    name: "Enable Banking",
    category: "banking-cash",
    summary: "Open-banking data for cash and reconciliation workflows.",
    capabilities: [
      "bank_balance",
      "bank_transaction_import",
      "cash_position",
      "source_provenance",
    ],
    authMethods: ["oauth2", "api_key"],
  },
  {
    id: "mercury",
    aliases: [],
    name: "Mercury",
    category: "banking-cash",
    summary: "Business banking balances and transactions.",
    capabilities: [
      "bank_balance",
      "bank_transaction_import",
      "cash_position",
      "source_provenance",
    ],
    authMethods: ["oauth2", "api_key"],
  },
  {
    id: "paypal",
    aliases: [],
    name: "PayPal",
    category: "payments-billing",
    summary: "Payment activity and collection evidence.",
    capabilities: [
      "payment_import",
      "payment_collection",
      "payment_status_webhook",
      "source_provenance",
    ],
    authMethods: ["oauth2", "api_key"],
  },
  {
    id: "wise",
    aliases: ["transferwise"],
    name: "Wise",
    category: "banking-cash",
    summary: "Multi-currency cash and transfer context.",
    capabilities: [
      "bank_balance",
      "bank_transaction_import",
      "cash_position",
      "source_provenance",
    ],
    authMethods: ["oauth2", "api_key"],
  },
  {
    id: "deel",
    aliases: [],
    name: "Deel",
    category: "payroll-hr",
    summary: "Payroll actuals, contractor costs, and workforce dimensions.",
    capabilities: [
      "payroll_actuals",
      "headcount_driver",
      "compensation_driver",
      "employee_dimension",
      "source_provenance",
    ],
    authMethods: ["oauth2", "api_key"],
  },
  {
    id: "bamboohr",
    aliases: ["bamboo-hr"],
    name: "BambooHR",
    category: "payroll-hr",
    summary: "Workforce dimensions and headcount drivers.",
    capabilities: [
      "headcount_driver",
      "compensation_driver",
      "employee_dimension",
      "source_provenance",
    ],
    authMethods: ["api_key"],
  },
  {
    id: "snowflake",
    aliases: [],
    name: "Snowflake",
    category: "spreadsheets-data",
    summary: "Governed warehouse metrics and operational dimensions.",
    capabilities: ["warehouse_metric", "bi_metric", "source_provenance"],
    authMethods: ["service_account", "oauth2"],
  },
  {
    id: "zapier",
    aliases: [],
    name: "Zapier",
    category: "automation",
    summary: "Approved automation hand-offs and workflow events.",
    capabilities: ["event_trigger", "workflow_action", "source_provenance"],
    authMethods: ["oauth2", "api_key"],
  },
  {
    id: "n8n",
    aliases: [],
    name: "n8n",
    category: "automation",
    summary: "Self-hosted workflow hand-offs and approved events.",
    capabilities: ["event_trigger", "workflow_action", "source_provenance"],
    authMethods: ["api_key", "webhook"],
  },
  {
    id: "make",
    aliases: ["integromat"],
    name: "Make",
    category: "automation",
    summary: "Automation scenarios with governed hand-offs.",
    capabilities: ["event_trigger", "workflow_action", "source_provenance"],
    authMethods: ["oauth2", "api_key"],
  },
  {
    id: "signed-webhooks",
    aliases: ["generic-signed-webhooks"],
    name: "Signed webhooks",
    category: "automation",
    summary: "Verified inbound event delivery from approved systems.",
    capabilities: [
      "event_trigger",
      "signed_webhook_delivery",
      "source_provenance",
    ],
    authMethods: ["webhook"],
  },
  {
    id: "mcp",
    aliases: ["model-context-protocol"],
    name: "Model Context Protocol",
    category: "automation",
    summary: "Governed tool discovery and approved assistant actions.",
    capabilities: ["mcp_tool_access", "workflow_action", "source_provenance"],
    authMethods: ["mcp"],
  },
];

function fromOppulence(input: ExtraDefinitionInput): IntegrationDefinition {
  const documentationPath = `/integrations/${input.id}`;
  const { authMethods, ...definition } = input;
  return IntegrationDefinitionSchema.parse({
    ...definition,
    operations: [],
    triggers: [],
    products: [
      plannedProduct(
        "eigenn",
        authMethods[0],
        "Tracked for a finance decision or modelling outcome.",
        documentationPath,
      ),
      plannedProduct(
        "conduitt",
        authMethods[0],
        "Tracked for a governed revenue-execution outcome.",
        documentationPath,
      ),
    ],
    sourceParity: [{ source: "oppulence" }],
  });
}

export const INTEGRATION_CATALOGUE: readonly IntegrationDefinition[] = [
  ...SIMSTUDIO_BASELINE.integrations.map(fromSimStudio),
  ...EXTRA_INTEGRATIONS.map(fromOppulence),
].sort((left, right) => left.id.localeCompare(right.id));
