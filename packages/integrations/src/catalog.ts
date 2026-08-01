import simStudioBaseline from "./generated/simstudio-baseline.json";

import {
  type IntegrationAuthMethod,
  type IntegrationCapability,
  type IntegrationCategory,
  type IntegrationDefinition,
  IntegrationDefinitionSchema,
  type ProductIntegration,
} from "./contracts";
import { EXECUTABLE_INTEGRATION_ID_SET } from "./executable";

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

/**
 * The source labels a provider `none` when it has no vendor OAuth or API-key
 * app to register against. That is not the same as needing no secret: a
 * self-hosted PostgreSQL still takes a password, and an AWS service still
 * takes an access key pair. These providers additionally accept the package's
 * API-key credential class, which is what encrypts that secret at rest.
 *
 * The source protocol stays first in the list, so protocol parity against the
 * pinned baseline is unaffected.
 */
const SECRET_BEARING_NO_AUTH_PROVIDERS: ReadonlySet<string> = new Set([
  // Clerk has no OAuth app to register; its backend SDK takes a secret key.
  "clerk",
  "mongodb",
  "neo4j",
  "postgresql",
  "mysql",
  "clickhouse",
  "amazon-rds",
  "amazon-sqs",
  "aws-secrets-manager",
  "athena",
  "cloudwatch",
  "cloudformation",
]);

function authMethodsFor(
  record: SimStudioBaselineRecord,
): IntegrationAuthMethod[] {
  const sourceMethod = authMethodForSource[record.sourceAuthType];
  return sourceMethod === "none" &&
    SECRET_BEARING_NO_AUTH_PROVIDERS.has(record.id)
    ? [sourceMethod, "api_key"]
    : [sourceMethod];
}

/**
 * An integration the package can execute is offered to a product as `beta`;
 * everything else stays `planned`. Without this the directory reports every
 * integration as planned and renders no connect action, however many providers
 * the registry actually ships.
 *
 * `beta` rather than `shipped`: these are executable and credential-backed, but
 * promotion to shipped is a product's call once it has verified one live.
 */
function catalogueProduct(
  integrationId: string,
  product: ProductIntegration["product"],
  authMethods: readonly IntegrationAuthMethod[],
  plannedOutcome: string,
  documentationPath: string,
  capabilities: readonly IntegrationCapability[],
): ProductIntegration {
  const executable = EXECUTABLE_INTEGRATION_ID_SET.has(integrationId);
  return {
    product,
    availability: executable ? "beta" : "planned",
    authMethods: [...authMethods],
    enabledCapabilities: executable ? [...capabilities] : [],
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
      catalogueProduct(
        record.id,
        "eigenn",
        authMethodsFor(record),
        "Tracked for a finance decision or modelling outcome once an owned connector is verified.",
        documentationPath,
        capabilities,
      ),
      catalogueProduct(
        record.id,
        "conduitt",
        authMethodsFor(record),
        "Tracked for a governed revenue-execution outcome once an owned connector is verified.",
        documentationPath,
        capabilities,
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
  operations?: Array<{ id: string; label: string; description: string }>;
  triggers?: Array<{ id: string; label: string; description: string }>;
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
    operations: [
      {
        id: "quickbooks:list-accounts",
        label: "List Accounts",
        description:
          "List chart-of-accounts entries from the connected company.",
      },
      {
        id: "quickbooks:list-customers",
        label: "List Customers",
        description: "List customers from the connected company.",
      },
      {
        id: "quickbooks:list-invoices",
        label: "List Invoices",
        description: "List invoices from the connected company.",
      },
      {
        id: "quickbooks:list-payments",
        label: "List Payments",
        description: "List payments from the connected company.",
      },
      {
        id: "quickbooks:get-company-info",
        label: "Get Company Information",
        description:
          "Read the connected company profile and accounting context.",
      },
      {
        id: "quickbooks:create-invoice",
        label: "Create Invoice",
        description: "Create an invoice in the connected QuickBooks company.",
      },
    ],
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
    operations: [
      {
        id: "xero:list-organizations",
        label: "List Organizations",
        description:
          "List organizations available to the connected Xero tenant.",
      },
      {
        id: "xero:list-accounts",
        label: "List Accounts",
        description:
          "List chart-of-accounts entries from the selected Xero tenant.",
      },
      {
        id: "xero:list-contacts",
        label: "List Contacts",
        description: "List contacts from the selected Xero tenant.",
      },
      {
        id: "xero:list-invoices",
        label: "List Invoices",
        description: "List invoices from the selected Xero tenant.",
      },
      {
        id: "xero:list-bank-transactions",
        label: "List Bank Transactions",
        description: "List bank transactions from the selected Xero tenant.",
      },
      {
        id: "xero:create-invoices",
        label: "Create Invoices",
        description: "Create invoices in the selected Xero tenant.",
      },
    ],
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
    operations: [
      {
        id: "plaid:get-accounts",
        label: "Get Accounts",
        description: "Retrieve linked financial accounts and cached balances.",
      },
      {
        id: "plaid:get-balances",
        label: "Get Balances",
        description: "Retrieve current balances for linked financial accounts.",
      },
      {
        id: "plaid:sync-transactions",
        label: "Sync Transactions",
        description:
          "Read incremental transaction changes from the linked Item.",
      },
      {
        id: "plaid:get-item",
        label: "Get Item",
        description: "Read connected Item status and institution metadata.",
      },
    ],
  },
  {
    id: "merge",
    aliases: ["merge-dev"],
    name: "Merge",
    category: "accounting",
    summary:
      "Unified accounting connections through Merge Link, including linked account context and normalized finance data.",
    capabilities: [
      "ledger_actuals",
      "chart_of_accounts",
      "invoice_import",
      "payment_import",
      "customer_import",
      "journal_import",
      "source_provenance",
    ],
    authMethods: ["connection_link"],
    operations: [
      {
        id: "merge:list-accounts",
        label: "List Accounts",
        description:
          "List normalized accounting accounts for the linked Merge account.",
      },
      {
        id: "merge:list-invoices",
        label: "List Invoices",
        description:
          "List normalized accounting invoices for the linked Merge account.",
      },
      {
        id: "merge:list-transactions",
        label: "List Transactions",
        description:
          "List normalized accounting transactions for the linked Merge account.",
      },
      {
        id: "merge:list-company-info",
        label: "List Company Information",
        description:
          "List normalized company information for the linked Merge account.",
      },
      {
        id: "merge:list-balance-sheets",
        label: "List Balance Sheets",
        description:
          "List normalized balance sheets for the linked Merge account.",
      },
      {
        id: "merge:resync",
        label: "Resync",
        description:
          "Request a new accounting sync for the linked Merge account.",
      },
    ],
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
  const { authMethods, operations = [], triggers = [], ...definition } = input;
  return IntegrationDefinitionSchema.parse({
    ...definition,
    operations: operations.map((operation) => ({
      ...operation,
      requiredCapabilities: [],
      inputSensitivity: "internal",
      outputSensitivity: "internal",
    })),
    triggers: triggers.map((trigger) => ({
      ...trigger,
      requiredCapabilities: ["event_trigger"],
      delivery: "unknown",
    })),
    products: [
      catalogueProduct(
        input.id,
        "eigenn",
        authMethods,
        "Tracked for a finance decision or modelling outcome.",
        documentationPath,
        input.capabilities,
      ),
      catalogueProduct(
        input.id,
        "conduitt",
        authMethods,
        "Tracked for a governed revenue-execution outcome.",
        documentationPath,
        input.capabilities,
      ),
    ],
    sourceParity: [{ source: "oppulence" }],
  });
}

export const INTEGRATION_CATALOGUE: readonly IntegrationDefinition[] = [
  ...SIMSTUDIO_BASELINE.integrations.map(fromSimStudio),
  ...EXTRA_INTEGRATIONS.map(fromOppulence),
].sort((left, right) => left.id.localeCompare(right.id));
