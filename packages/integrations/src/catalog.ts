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
  // Providers outside the pinned source, adopted from their published specs
  // because a customer needs them. Their packs declare their own coverage.
  {
    id: "close",
    aliases: [],
    name: "Close",
    category: "crm-work",
    summary:
      "CRM leads, contacts, opportunities, and activity for sales execution.",
    capabilities: ["workflow_action"],
    authMethods: ["api_key"],
    operations: [
      { id: "list-lead", label: "List Lead", description: "List Leads" },
      {
        id: "create-lead",
        label: "Create Lead",
        description: "Create a new lead",
      },
      { id: "get-lead", label: "Get Lead", description: "Get a single Lead" },
      {
        id: "update-lead",
        label: "Update Lead",
        description: "Update an existing lead",
      },
      { id: "delete-lead", label: "Delete Lead", description: "Delete a lead" },
      {
        id: "list-contact",
        label: "List Contact",
        description: "List contacts",
      },
      {
        id: "create-contact",
        label: "Create Contact",
        description: "Create a new contact",
      },
      {
        id: "get-contact",
        label: "Get Contact",
        description: "Fetch a single contact",
      },
      {
        id: "update-contact",
        label: "Update Contact",
        description: "Update an existing contact",
      },
      {
        id: "delete-contact",
        label: "Delete Contact",
        description: "Delete a contact",
      },
      {
        id: "list-opportunity",
        label: "List Opportunity",
        description: "List or filter opportunities",
      },
      {
        id: "create-opportunity",
        label: "Create Opportunity",
        description: "Create an opportunity",
      },
      {
        id: "get-opportunity",
        label: "Get Opportunity",
        description: "Retrieve an opportunity",
      },
      {
        id: "update-opportunity",
        label: "Update Opportunity",
        description: "Update an opportunity",
      },
      {
        id: "delete-opportunity",
        label: "Delete Opportunity",
        description: "Delete an opportunity",
      },
      {
        id: "list-task",
        label: "List Task",
        description: "List or filter tasks",
      },
      { id: "create-task", label: "Create Task", description: "Create a task" },
      {
        id: "update-task",
        label: "Update Task",
        description: "Bulk-update tasks",
      },
      {
        id: "get-task",
        label: "Get Task",
        description: "Fetch a task's details",
      },
      { id: "delete-task", label: "Delete Task", description: "Delete a task" },
      {
        id: "list-activity",
        label: "List Activity",
        description: "List or filter all activity types",
      },
      {
        id: "list-call",
        label: "List Call",
        description: "List or filter all Call activities",
      },
    ],
  },
  {
    id: "salesflare",
    aliases: [],
    name: "Salesflare",
    category: "crm-work",
    summary: "CRM accounts, contacts, opportunities, and tasks.",
    capabilities: ["workflow_action"],
    authMethods: ["api_key"],
    operations: [
      {
        id: "list-accounts",
        label: "List Accounts",
        description: "List accounts",
      },
      {
        id: "create-account",
        label: "Create Account",
        description: "Create an account",
      },
      {
        id: "get-account",
        label: "Get Account",
        description: "Get account details",
      },
      {
        id: "update-account",
        label: "Update Account",
        description: "Update an account",
      },
      {
        id: "delete-account",
        label: "Delete Account",
        description: "Delete an account",
      },
      {
        id: "list-contacts",
        label: "List Contacts",
        description: "List contacts",
      },
      {
        id: "create-contact",
        label: "Create Contact",
        description: "Create a contact",
      },
      {
        id: "get-contact",
        label: "Get Contact",
        description: "Get contact details",
      },
      {
        id: "update-contact",
        label: "Update Contact",
        description: "Update a contact",
      },
      {
        id: "delete-contact",
        label: "Delete Contact",
        description: "Delete a contact",
      },
      {
        id: "list-opportunities",
        label: "List Opportunities",
        description: "List opportunities",
      },
      {
        id: "create-opportunity",
        label: "Create Opportunity",
        description: "Create an opportunity",
      },
      {
        id: "get-opportunity",
        label: "Get Opportunity",
        description: "Get opportunity details",
      },
      {
        id: "update-opportunity",
        label: "Update Opportunity",
        description: "Update an opportunity",
      },
      {
        id: "delete-opportunity",
        label: "Delete Opportunity",
        description: "Delete an opportunity",
      },
      { id: "list-tasks", label: "List Tasks", description: "List tasks" },
      { id: "create-task", label: "Create Task", description: "Create a task" },
      { id: "update-task", label: "Update Task", description: "Update a task" },
      { id: "delete-task", label: "Delete Task", description: "Delete a task" },
      { id: "list-tags", label: "List Tags", description: "List tags" },
      { id: "create-tag", label: "Create Tag", description: "Create a tag" },
      { id: "get-tag", label: "Get Tag", description: "Get tag details" },
    ],
  },
  {
    id: "front",
    aliases: [],
    name: "Front",
    category: "support",
    summary: "Shared inbox conversations, contacts, and teammate routing.",
    capabilities: ["workflow_action"],
    authMethods: ["api_key"],
    operations: [
      {
        id: "list-conversations",
        label: "List Conversations",
        description: "List conversations",
      },
      {
        id: "create-conversation",
        label: "Create Conversation",
        description: "Create discussion/task conversation",
      },
      {
        id: "get-conversation",
        label: "Get Conversation",
        description: "Get conversation",
      },
      {
        id: "update-conversation",
        label: "Update Conversation",
        description: "Update conversation",
      },
      {
        id: "delete-conversation",
        label: "Delete Conversation",
        description: "Delete conversation",
      },
      {
        id: "list-contacts",
        label: "List Contacts",
        description: "List contacts",
      },
      {
        id: "create-contact",
        label: "Create Contact",
        description: "Create contact",
      },
      { id: "get-contact", label: "Get Contact", description: "Get contact" },
      {
        id: "update-contact",
        label: "Update Contact",
        description: "Update a contact",
      },
      {
        id: "delete-contact",
        label: "Delete Contact",
        description: "Delete a contact",
      },
      {
        id: "list-accounts",
        label: "List Accounts",
        description: "List Accounts",
      },
      {
        id: "create-account",
        label: "Create Account",
        description: "Create account",
      },
      {
        id: "get-account",
        label: "Get Account",
        description: "Fetch an account",
      },
      {
        id: "update-account",
        label: "Update Account",
        description: "Update account",
      },
      {
        id: "delete-account",
        label: "Delete Account",
        description: "Delete an account",
      },
      { id: "list-tags", label: "List Tags", description: "List tags" },
      { id: "create-tag", label: "Create Tag", description: "Create tag" },
      { id: "get-tag", label: "Get Tag", description: "Get tag" },
      { id: "update-tag", label: "Update Tag", description: "Update a tag" },
      { id: "delete-tag", label: "Delete Tag", description: "Delete tag" },
      {
        id: "list-teammates",
        label: "List Teammates",
        description: "List teammates",
      },
      {
        id: "get-teammate",
        label: "Get Teammate",
        description: "Get teammate",
      },
    ],
  },
  {
    id: "bitbucket",
    aliases: [],
    name: "Bitbucket",
    category: "devops",
    summary: "Repositories, workspaces, branch restrictions, and snippets.",
    capabilities: ["workflow_action"],
    authMethods: ["api_key"],
    operations: [
      {
        id: "get-repository",
        label: "Get Repository",
        description: "List repositories in a workspace",
      },
      {
        id: "create-repository",
        label: "Create Repository",
        description: "Create a repository",
      },
      {
        id: "update-repository",
        label: "Update Repository",
        description: "Update a repository",
      },
      {
        id: "delete-repository",
        label: "Delete Repository",
        description: "Delete a repository",
      },
      {
        id: "list-branch-restrictions",
        label: "List Branch Restrictions",
        description: "List branch restrictions",
      },
      {
        id: "get-workspace",
        label: "Get Workspace",
        description: "Get a workspace",
      },
      {
        id: "list-hooks",
        label: "List Hooks",
        description: "List webhooks for a workspace",
      },
      {
        id: "create-hook",
        label: "Create Hook",
        description: "Create a webhook for a workspace",
      },
      {
        id: "get-hook",
        label: "Get Hook",
        description: "Get a webhook for a workspace",
      },
      {
        id: "update-hook",
        label: "Update Hook",
        description: "Update a webhook for a workspace",
      },
      {
        id: "create-snippet",
        label: "Create Snippet",
        description: "Create a snippet",
      },
      {
        id: "get-snippet",
        label: "Get Snippet",
        description: "List snippets in a workspace",
      },
      {
        id: "update-snippet",
        label: "Update Snippet",
        description: "Update a snippet",
      },
      {
        id: "delete-snippet",
        label: "Delete Snippet",
        description: "Delete a snippet",
      },
      {
        id: "get-file",
        label: "Get File",
        description: "Get a snippet's raw file",
      },
      { id: "list-user", label: "List User", description: "Get current user" },
      {
        id: "list-emails",
        label: "List Emails",
        description: "List email addresses for current user",
      },
      {
        id: "get-email",
        label: "Get Email",
        description: "Get an email address for current user",
      },
      {
        id: "list-workspaces",
        label: "List Workspaces",
        description: "List workspaces for the current user",
      },
      {
        id: "list-permission",
        label: "List Permission",
        description: "Get user permission on a workspace",
      },
      {
        id: "update-addon",
        label: "Update Addon",
        description: "Update an installed app",
      },
      {
        id: "delete-addon",
        label: "Delete Addon",
        description: "Delete an app",
      },
    ],
  },
  {
    id: "copper",
    aliases: [],
    name: "Copper",
    category: "crm-work",
    summary: "CRM people, companies, opportunities, and pipelines.",
    capabilities: ["workflow_action"],
    authMethods: ["api_key"],
    operations: [
      {
        id: "list-related",
        label: "List Related",
        description: "View all records related to an entity",
      },
      {
        id: "get-related",
        label: "Get Related",
        description:
          "View all records of a given entity type related to an entity",
      },
      {
        id: "get-opportunity",
        label: "Get Opportunity",
        description: "Get opportunity by ID",
      },
      {
        id: "create-activity",
        label: "Create Activity",
        description: "Get opportunity activities",
      },
      {
        id: "create-search",
        label: "Create Search",
        description: "Search opportunities",
      },
      { id: "get-user", label: "Get User", description: "Get user by ID" },
      {
        id: "list-activity-types",
        label: "List Activity Types",
        description: "List activity types",
      },
      {
        id: "list-contact-types",
        label: "List Contact Types",
        description: "List contact types",
      },
      {
        id: "list-custom-activity-types",
        label: "List Custom Activity Types",
        description: "List all custom activity types",
      },
      {
        id: "list-custom-field-definitions",
        label: "List Custom Field Definitions",
        description: "List custom field definitions",
      },
      {
        id: "list-customer-sources",
        label: "List Customer Sources",
        description: "List customer sources",
      },
      {
        id: "list-lead-statuses",
        label: "List Lead Statuses",
        description: "List lead statuses",
      },
      {
        id: "list-loss-reasons",
        label: "List Loss Reasons",
        description: "List loss reasons",
      },
      {
        id: "list-pipeline-stages",
        label: "List Pipeline Stages",
        description: "List all pipeline stages",
      },
      {
        id: "list-pipelines",
        label: "List Pipelines",
        description: "List pipelines",
      },
      { id: "list-tags", label: "List Tags", description: "List all tags" },
      {
        id: "create-fetch-by-email",
        label: "Create Fetch By Email",
        description: "Fetch a person by email",
      },
      {
        id: "get-by-entity",
        label: "Get By Entity",
        description: "List field layout by entity type",
      },
    ],
  },
  {
    id: "taleez",
    aliases: [],
    name: "Taleez",
    category: "hr",
    summary: "Applicant tracking jobs, candidates, and applications.",
    capabilities: ["workflow_action"],
    authMethods: ["api_key"],
    operations: [
      {
        id: "list-jobs",
        label: "List Jobs",
        description: "List all jobs in your company",
      },
      { id: "get-job", label: "Get Job", description: "Get details of a job" },
      {
        id: "create-application",
        label: "Create Application",
        description: "Create an application for a job",
      },
      {
        id: "create-candidate",
        label: "Create Candidate",
        description: "Add candidates to a job",
      },
      {
        id: "list-questions",
        label: "List Questions",
        description: "Get questions of a job",
      },
      {
        id: "list-candidates",
        label: "List Candidates",
        description: "List all candidates in your company",
      },
      {
        id: "get-candidate",
        label: "Get Candidate",
        description: "Get a candidate",
      },
      {
        id: "list-applications",
        label: "List Applications",
        description:
          "Get candidate applications list (can be : spontaneous, application to a job, association to a job)",
      },
      {
        id: "list-documents",
        label: "List Documents",
        description: "Get candidate document list",
      },
      {
        id: "create-document",
        label: "Create Document",
        description: "Add a document to a candidate",
      },
      {
        id: "list-pools",
        label: "List Pools",
        description: "List all pools in your company",
      },
      {
        id: "list-candidate-properties",
        label: "List Candidate Properties",
        description: "List available candidate properties in your company",
      },
      {
        id: "get-candidate-property",
        label: "Get Candidate Property",
        description: "Get details of a candidate property",
      },
      {
        id: "list-job-properties",
        label: "List Job Properties",
        description: "List available job properties in your company",
      },
      {
        id: "get-job-property",
        label: "Get Job Property",
        description: "Get details of a job property",
      },
      {
        id: "list-events",
        label: "List Events",
        description: "List all events in your company",
      },
      {
        id: "list-recruiters",
        label: "List Recruiters",
        description: "List all recruiters in your company",
      },
      {
        id: "list-units",
        label: "List Units",
        description: "List all units (entities) in your company",
      },
      {
        id: "create-tmp",
        label: "Create Tmp",
        description: "Upload a temporary document",
      },
    ],
  },
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
