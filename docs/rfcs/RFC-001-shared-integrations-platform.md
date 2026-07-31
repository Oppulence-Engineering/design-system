# RFC-001: Shared Integrations Platform

**Status:** Proposed
**Owners:** Design System, Eigenn, Corinthian
**Date:** 2026-07-31

## Decision

Create a publishable @oppulence/integrations package in this repository. Its core owns canonical integration metadata, capability vocabulary, product availability, safe connection projections, search/filter helpers, database-resolver contracts, and generated public catalogue data. Ship its React adapter in Phase 0 and add controlled integration-directory primitives to @oppulence/design-system.

Eigenn and Corinthian retain OAuth, encrypted credentials, provider SDKs, databases, webhooks, sync jobs, authorization, actions, and audit records. The shared package is a contract and experience layer, not a shared connector runtime or credential vault.

## Summary

Eigenn and Corinthian need one honest integration experience: the same provider identity, categories, capability language, health states, and expansion path while preserving each product's data and governance boundary.

Today, @canvas/app-store is useful provider-implementation evidence but it is Canvas-specific: it includes database/server helpers, provider actions, callbacks, and transport dependencies. Eigenn also carries a separate accounting catalogue. Corinthian web owns a static APP_CATALOG, while Corinthian API derives some accounting metadata from @canvas/app-store. Those sources have already drifted on IDs, availability, and capability claims.

The new package gives both products a durable source of truth, with a design inspired by Sim's useful boundary: a normalized integration catalogue separate from workspace credentials and permissioned connection state. Sim Studio catalogue parity is the explicit product target. We adopt its provider coverage and catalogue discipline, not its provider code, schemas, branding, or product claims.

## Goals

- Publish one canonical provider ID, alias, category, capability, operation, trigger, authentication, and product-availability contract.
- Reach and maintain provider-catalogue parity with the versioned Sim Studio baseline: 232 providers at the initial snapshot, with automated detection of additions, removals, and renamed records.
- Provide every parity provider through at least one owned product path before it is counted as functionally at parity; a registry-only or logo-only entry counts only as tracked catalogue parity.
- Support a broad directory without making a planned provider appear connectable.
- Express value as business outcomes: accounting actuals, cash, payroll, subscriptions, CRM context, documents, warehouse metrics, automation, and governed action, not a decorative list of logos.
- Project multiple authorized connections per provider with health, freshness, enabled capabilities, and permitted recovery actions.
- Give both apps controlled, accessible directory UI primitives with consistent connected, stale, attention, available, setup-required, and planned states.
- Generate documentation, marketing, and assistant/workflow discovery data from a sanitized versioned registry.
- Generate provider detail pages, operation/trigger catalogues, and outcome templates from the same source so the directory, docs, and assisted setup cannot drift.

## Non-goals

- Shared OAuth callbacks, token storage, provider SDKs, databases, workers, or API routers.
- Moving provider implementations from @canvas/app-store, @canvas/accounting, @canvas/engine, or Corinthian services.
- Copying Sim Studio's provider code, block schemas, credential storage, brand assets, or generic workflow product.
- Shipping third-party logo assets without legal/design approval.
- A general-purpose ETL platform, workflow engine, or automation marketplace.

## Product principles

### A connection must improve a decision or governed action

An integration qualifies for shipped only when it improves at least one named product loop:

| Loop                         | Qualifying value                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Eigenn planning truth        | Accounting actuals, bank cash, payroll costs, subscription MRR, operational drivers, source freshness |
| Eigenn owner decision        | Forecast variance explanation, scenario driver, cash/runway alert, reconciled evidence                |
| Corinthian revenue execution | Invoice/payment import, promise evidence, communication context, reconciliation, governed action      |
| Cross-product intelligence   | Permissioned AR outcomes improve forecasts; approved forecast directives become Corinthian work       |

### Catalogue truth is separate from connection truth

The catalogue says what a provider could do for a product. The owning product API says whether an organization has connected it, what it is allowed to do, and whether its data is healthy. A browser must never infer a connection from a provider card or an availability label.

### Availability is per product and evidence-based

The same provider can be shipped for Corinthian and planned for Eigenn. Shipped requires a verified authorized connection, the promised business outcome, observable health/freshness, recovery behavior, and an audit trail. An SDK, callback stub, or marketing card alone is not sufficient.

### Sim Studio parity is versioned and measurable

The reference baseline is Sim Studio's generated integration catalogue at [`apps/sim/lib/integrations/integrations.json`](https://github.com/simstudioai/sim/blob/2a6267391d24d4e10e043ce474615ce9f5d1c22a/apps/sim/lib/integrations/integrations.json), source commit `2a6267391d24d4e10e043ce474615ce9f5d1c22a`, catalogue blob `deadb0012bc33708e4c1500b08b1aa8c9ae533e1`, and catalogue date 2026-07-30. Its baseline is 232 providers, 3,890 operations, and 363 triggers. The target is provider parity, not an unqualified promise to reproduce every generic workflow operation.

| Parity level               | Definition                                                                                                                                                          | Counts as parity?                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Catalogue parity           | A canonical registry entry maps to every Sim Studio provider identity, category, auth type, operations, and triggers from the pinned snapshot.                      | Yes, for catalogue coverage only       |
| Functional provider parity | At least one owning product supports an authorized connection or approved configuration path, an outcome-backed capability, health/recovery state, and audit trail. | Yes, for a customer-facing integration |
| Operation/trigger parity   | An explicit, product-relevant operation or trigger mapping is shipped and tested. It need not copy unrelated generic automation actions.                            | Yes, for that operation or trigger     |

`planned` entries remain visible only where the product deliberately shows its roadmap and never count toward functional provider parity. The public parity dashboard reports all three levels so “232 integrations” cannot conceal missing connections or unsupported actions.

The initial category ledger is mechanically derived from the pinned snapshot. It must be regenerated and reviewed whenever the Sim source changes.

| Sim Studio category | Providers | Sim Studio category | Providers |
| ------------------- | --------: | ------------------- | --------: |
| AI                  |        17 | Analytics           |        15 |
| Commerce            |         5 | Communication       |        17 |
| Databases           |        19 | DevOps              |        20 |
| Documents           |        19 | Email               |        13 |
| HR                  |         6 | Marketing           |         5 |
| Observability       |        13 | Productivity        |        19 |
| Sales               |        27 | Search              |        18 |
| Security            |        15 | Support             |         4 |

Each `IntegrationDefinition` that maps to the reference dataset includes the Sim Studio slug and type. A generated report separates matched, missing, extra, renamed, catalogue-only, functionally supported, and operation/trigger-supported records. Extra Oppulence-specific providers are allowed and do not reduce parity.

## Architecture

```text
packages/integrations                 @oppulence/integrations
├── catalog                            immutable provider definitions
├── contracts                          Zod public schemas and inferred types
├── capabilities                       outcome, operation, and trigger vocabulary
├── registry                           IDs, aliases, search, and filters
├── connection                         catalogue merge + injected resolver contract
├── parity                             pinned Sim Studio baseline + generated report
├── support                            lifecycle, entitlement, SLO, and data-contract metadata
├── templates                          provider outcome templates and discovery data
├── documentation                      sanitized generated-manifest helpers
└── react                              Phase-0 typed loader and React hooks

packages/design-system                @oppulence/design-system
└── integrations                       controlled visual primitives over contracts

apps/web and Corinthian web           product-specific query and command adapters
└── their own APIs/workers             credentials, providers, sync, authorization,
                                       actions, source data, and audit ownership
```

The core package must be safe for a browser, Next server, worker, or API process. Its only runtime dependency should be zod. It must not import a product database, secret manager, OAuth SDK, provider SDK, router, Next.js, or server-only module.

The Design System may depend on @oppulence/integrations for contracts and controlled view models only. It must not acquire provider client libraries.

## Package structure and public exports

The package follows the built artifact convention already used by @oppulence/events and @oppulence/import: explicit dist exports, sideEffects false, package-local tests, and prepublishOnly verification.

```text
packages/integrations/
├── src/index.ts
├── src/catalog.ts
├── src/catalog/{accounting,banking,revenue,operations,workforce-data}.ts
├── src/contracts.ts
├── src/capabilities.ts
├── src/registry.ts
├── src/connection.ts
├── src/parity.ts
├── src/support.ts
├── src/templates.ts
├── src/documentation.ts
├── src/react.ts
├── tests/{registry,contracts,availability,parity,artifacts}.test.ts
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

Initial public APIs:

```ts
export {
  getIntegration,
  getProductIntegrations,
  resolveIntegrationId,
  searchIntegrations,
} from "./registry";

export {
  IntegrationDefinitionSchema,
  ProductIntegrationSchema,
  IntegrationConnectionProjectionSchema,
} from "./contracts";

export {
  buildIntegrationDirectory,
  createIntegrationDirectoryResolver,
  getConnectionAttentionCount,
} from "./connection";

export { getSimStudioParityReport } from "./parity";

export type {
  IntegrationConnectionResolver,
  IntegrationDirectoryLoader,
} from "./connection";
```

The `/react` entry point ships in Phase 0. It exposes `useIntegrationDirectory` and `IntegrationDirectoryProvider` over a product-supplied `IntegrationDirectoryLoader`, with no React Query, database, router, or provider-SDK dependency. Subpaths `/catalog`, `/contracts`, `/connection`, `/react`, and `/documentation` prevent a consumer from importing more than it needs.

## Canonical data model

### Stable provider identity

Every provider gets one lowercase kebab-case canonical ID. quickbooks is canonical; legacy values such as quick-books become aliases resolved only by resolveIntegrationId(). New URLs, records, analytics, policies, and APIs persist canonical IDs. Alias resolution exists for migration and adapters, not as an alternative identity system.

```ts
interface IntegrationDefinition {
  id: IntegrationId;
  aliases: readonly string[];
  name: string;
  category: IntegrationCategory;
  summary: string;
  capabilities: readonly IntegrationCapability[];
  operations: readonly IntegrationOperation[];
  triggers: readonly IntegrationTrigger[];
  products: readonly ProductIntegration[];
  sourceParity?: readonly SourceParityReference[];
}

interface ProductIntegration {
  product: "eigenn" | "corinthian";
  availability: "shipped" | "beta" | "planned" | "retired";
  authMethods: readonly IntegrationAuthMethod[];
  enabledCapabilities: readonly IntegrationCapability[];
  setup: readonly IntegrationSetupStep[];
  documentationPath?: string;
  minimumPermission?: "view" | "connect" | "manage";
}

interface SourceParityReference {
  source: "simstudio";
  sourceSlug: string;
  sourceType: string;
  sourceCategory: string;
  sourceAuthType: "api-key" | "none" | "oauth";
  sourceSnapshot: "2026-07-30";
}
```

Enabled capabilities are always a subset of the provider's global capabilities. Planned may explain intended value but cannot render a connect action. Retired remains resolvable only for history and migration guidance. Source parity references establish a one-to-one mapping to the pinned Sim Studio record and are generated rather than hand-maintained.

### Capability vocabulary

Capabilities express business outcomes rather than product-specific verbs:

| Area             | Initial capability examples                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Accounting       | ledger_actuals, chart_of_accounts, invoice_import, payment_import, customer_import, journal_import, draft_invoice_export |
| Banking          | bank_balance, bank_transaction_import, cash_position, payment_match_evidence                                             |
| Revenue          | subscription_metrics, revenue_recognition_input, payment_collection, payment_status_webhook                              |
| Workforce        | payroll_actuals, headcount_driver, compensation_driver, employee_dimension                                               |
| Customer systems | crm_account_context, crm_contact_context, deal_pipeline_driver, customer_health_export                                   |
| Communications   | mailbox_sync, email_send, message_send, reply_capture, approval_action                                                   |
| Data             | file_import, spreadsheet_import, warehouse_metric, bi_metric, source_provenance                                          |
| Automation       | event_trigger, signed_webhook_delivery, workflow_action, mcp_tool_access                                                 |

Operations and triggers are stable descriptors with labels, input/output sensitivity, and capability requirements. They permit future assistant and workflow discovery without pulling a provider SDK into a client.

Supported authentication methods are oauth2, api_key, service_account, connection_link, webhook, file_upload, mcp, and none. The catalogue never contains secrets, tokens, client IDs, authorization URLs, account IDs, or raw credential values.

## Runtime connection projection

Each owning API adapts its private records into this browser-safe contract:

```ts
interface IntegrationConnectionProjection {
  id: string;
  integrationId: IntegrationId;
  product: "eigenn" | "corinthian";
  displayName: string;
  state:
    | "not_connected"
    | "authorizing"
    | "initial_sync"
    | "healthy"
    | "stale"
    | "attention"
    | "disconnected";
  enabledCapabilities: readonly IntegrationCapability[];
  sourceFreshness?: {
    state: "fresh" | "stale" | "unknown" | "failed";
    lastSuccessfulSyncAt?: string;
    nextExpectedSyncAt?: string;
  };
  accountLabel?: string;
  permittedActions: readonly (
    | "connect"
    | "reconnect"
    | "sync_now"
    | "configure"
    | "disconnect"
    | "inspect"
  )[];
  safeIssue?: { code: string; summary: string; recoverable: boolean };
}
```

The API applies tenant and action authorization before producing this projection. buildIntegrationDirectory() only merges already-authorized projections into known catalogue entries. It has no organization ID and makes no authorization decision.

Many connections to one provider are supported. A directory groups them below one provider card and shows each approved account label, health, freshness, capabilities, and permitted action. A product may impose a single-connection policy in its own API without changing the shared contract.

### Database resolver seam

The package defines the adapter boundary but never resolves a database itself. A product provides an authorized server-side resolver, usually backed by Prisma, Drizzle, tRPC, or a service query; the package combines its safe projections with the registry. The exact storage model remains private to the product.

```ts
interface IntegrationConnectionResolver<TContext> {
  listAuthorizedConnections(
    context: TContext,
  ): Promise<readonly IntegrationConnectionProjection[]>;
}

const resolveEigennDirectory = createIntegrationDirectoryResolver({
  resolver: eigennConnectionResolver,
  product: "eigenn",
});

// Server query/action: authorizes context, calls its DB resolver, then returns
// the shared directory model. The browser receives no database implementation.
const directory = await resolveEigennDirectory({ organizationId, actorId });
```

`createIntegrationDirectoryResolver()` validates and filters the returned projections against the registry, so a database record with an unknown provider ID, invalid product, or unsupported capability cannot leak into a directory. The React loader calls a product-owned query endpoint or server-action bridge; it must never receive a database client or resolve credentials in the browser.

### Product connector and command contract

The shared package also defines the contract that every product-owned connector adapter must satisfy. An adapter is implemented in the owning product or service, where its provider SDK, OAuth callback, tokens, database records, rate-limit handling, and workers live. The package exports only typed descriptors and request/result schemas.

```ts
interface IntegrationSupportContract {
  integrationId: IntegrationId;
  product: "eigenn" | "corinthian";
  connectionModes: readonly IntegrationAuthMethod[];
  syncMode: "on_demand" | "polling" | "webhook" | "hybrid" | "none";
  dataContracts: readonly IntegrationDataContract[];
  operations: readonly SupportedOperation[];
  triggers: readonly SupportedTrigger[];
  entitlement: IntegrationEntitlement;
  serviceLevel: IntegrationServiceLevel;
}

interface ProductIntegrationConnector<TContext> {
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
    connectionId: string,
  ): Promise<ConnectionHealth>;
}
```

`beginConnection` may return an OAuth redirect, a signed Link session, a validated API-key setup state, or a file-upload next step. `performAction` is allow-listed by `permittedActions`, but the adapter reauthorizes it server-side. A connector is never loaded into the Design System, registry, React adapter, or browser bundle.

The support contract is the functional-parity ledger. For each Sim Studio provider, it records one or more product owners, the authorized setup path, supported source operations/triggers, known limitations, and the outcome the connection produces. This makes it possible to say exactly what “provided” means without claiming generic Sim workflow behavior.

### Connection lifecycle and service levels

Every functional provider follows the same observable lifecycle:

```text
available → authorizing → connected/initial_sync → healthy
                             ↘ attention/stale → reconnecting → healthy
healthy or attention → disconnecting → disconnected
```

The registry stores the policy; the product enforces it. Each product support record declares initial-sync expectation, normal refresh cadence, maximum acceptable freshness, retry class, backfill window, webhook signature policy where applicable, rate-limit strategy, degradation behavior, and owner/on-call surface. A connection cannot report `healthy` after its declared freshness threshold has expired.

| Source class                       | Minimum freshness contract                         | Required source evidence                                |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| Bank, accounting, payment, payroll | Last successful sync and covered accounting period | Source timestamp, scope/account label, sync result      |
| CRM, work, and operational drivers | Last successful sync and object coverage           | Source timestamp, selected objects/filters, sync result |
| Webhook/event source               | Last verified delivery and gap-detection state     | Signature verification, delivery ID, replay status      |
| File or spreadsheet                | File version and import validation state           | File identity, import time, row/error summary           |

The UI can show an SLO summary and recovery action, but never raw provider errors, sensitive configuration, or unredacted source payloads.

## UI contract

The core of @oppulence/integrations remains headless; its Phase-0 `/react` adapter owns only typed loading, refresh/error state, and context. @oppulence/design-system adds controlled components which receive resolved data and callbacks:

| Component                 | Responsibility                                                   | Never does                            |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| IntegrationDirectory      | Search, category/capability filters, groups, empty states        | Fetch data or start OAuth itself      |
| IntegrationCard           | Provider summary, availability, health, primary permitted action | Infer connection state                |
| IntegrationDetailPanel    | Capabilities, setup, source implications, multiple connections   | Render a raw provider error or secret |
| IntegrationConnectionList | Authorized connection/freshness state                            | Read a credential/token               |
| IntegrationStatusBadge    | Text, icon, and semantic connection state                        | Convey state only by color            |
| IntegrationSetupProgress  | Product-provided setup/recovery state                            | Persist progress itself               |

All components follow the existing Design System rules: no className overrides, variants rather than styling escape hatches, semantic buttons, keyboard navigation, focus restoration after a panel closes, and programmatic status text.

The UI makes these states unambiguous:

- **Connected:** healthy, stale, or attention state plus last successful freshness where source data is involved.
- **Available:** an authorized user may start setup.
- **Setup required:** the product supports it but an administrator must finish configuration.
- **Planned:** intentionally non-interactive, never a disabled mystery button.
- **No access:** clear request-access path when product policy permits display.

### Directory, detail, and template parity

The directory uses a small generated `IntegrationSummary` payload for search and filters: canonical ID, source/display name, short description, categories, auth methods, availability, and precomputed lowercase search fields for name, description, operations, and triggers. Full operations, triggers, setup steps, support contracts, data lineage, and outcome templates load only in the detail panel or documentation route. This keeps a 232-provider directory fast without hiding capability discovery.

Every provider receives these generated, consistent surfaces:

| Surface              | Required content                                                           | Product-specific content                                         |
| -------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Directory card       | Identity, categories, availability, auth summary, health/count             | Primary allowed action and plan/entitlement state                |
| Provider detail      | Description, operations, triggers, setup modes, source docs, limitations   | Business outcome, model/collection impact, permissions, recovery |
| Connection detail    | Account label, source scope, freshness, coverage, health, audit-safe issue | Resync/configure/disconnect command callbacks                    |
| Outcome templates    | Named provider-to-outcome starting point and inputs                        | Eigenn model driver/lineage or Corinthian governed action/policy |
| Documentation/export | Public catalogue metadata and versioned parity status                      | No tenant state, secrets, raw errors, or customer data           |

Templates are not generic workflow clones. They are outcome-specific recipes that prefill a supported operation, expected data contract, and success metric. Examples: QuickBooks actuals → forecast variance; Plaid balances → cash runway; Stripe collections → liquidity scenario; Salesforce pipeline → revenue scenario; Gmail promises → governed follow-up. Templates must reference only product-supported operations and may be disabled by entitlement or policy.

### Data contracts, lineage, and modelling impact

Each supported source operation declares an `IntegrationDataContract`: stable object/metric name, schema version, field classification, normalization rule, permitted use, retention/deletion owner, and source-to-output lineage. For Eigenn, the contract also identifies the model driver(s), time grain, currency/units, historical coverage, refresh timestamp, and forecasting use. For Corinthian, it identifies the evidence record, action policy, idempotency key, and audit event.

The data contract prevents silent modelling errors: a customer sees which connection supplied a model input, when it was last refreshed, which source scope it covers, and whether an assumption overrides it. Disconnect, scope reduction, or source deletion makes dependent model/collection outputs visibly stale and preserves only the audit-safe lineage required by policy.

### Entitlements and multi-tenant controls

The catalogue is public metadata; support is tenant- and actor-specific. Before rendering any action, a product adapter evaluates plan entitlement, organization policy, role, data-region policy, feature flag, connection limit, and delegated-admin requirement. The result is an `IntegrationEntitlement` projection with `allowed`, `reasonCode`, `requestAccessAllowed`, and a safe explanation.

The server repeats this evaluation for every connect, reconnect, sync, configure, action, and disconnect request. Entitlement changes revoke commands immediately while retaining the appropriate connection/audit history. A customer never learns whether another tenant has connected a provider.

## Initial directory and promotion policy

The registry starts from all 232 pinned Sim Studio providers, retaining their source category and authentication description while adding Oppulence's finance-specific categories: Accounting; Banking and Cash; Payments and Billing; Payroll and HR; CRM and Work; Communications; Spreadsheets and Data; and Automation. Extra providers, including QuickBooks, Xero, Fortnox, FreshBooks, Wave, Zoho Books, NetSuite, Plaid, Teller, GoCardless, Enable Banking, Mercury, PayPal, Wise, Deel, BambooHR, Snowflake, Zapier, n8n, Make, generic signed webhooks, and MCP, are additive to the parity baseline.

The initial public matrix is conservative:

| Product    | Initial shipped entries                                            | Rule                                                                                                     |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Eigenn     | Plaid and QuickBooks after end-to-end verification                 | Honors the current product position; other implementation fragments remain planned or beta until proven. |
| Corinthian | Only providers whose full journey is verified by Corinthian owners | Static cards and callback fragments do not qualify.                                                      |

Promotion from planned to beta requires an owner, customer outcome, permission model, connection-health contract, and test plan. Promotion to shipped requires all acceptance gates in this RFC. Sim Studio operations and triggers are recorded as source capability metadata on day one; an operation becomes functional only when mapped to a product outcome and a governed product command or data contract.

## Consumer boundaries

### Eigenn

Eigenn retains Plaid Link, accounting OAuth, source snapshots, forecast-signal normalization, evaluator inputs, refresh jobs, and provenance. apps/web imports the shared catalogue and adapts authorized team connection state to IntegrationConnectionProjection. The scenario-model grid/dashboard displays the same freshness/lineage; a catalogue entry never proves a model source is fresh.

### Corinthian

Corinthian retains organization authorization, encrypted connection records, accounting import, payment/webhook processing, governed communication actions, and audit timeline. corinthian-web imports the same directory contracts and Design System primitives, while its own tRPC commands carry out actions. Its separate static catalogue and API accounting catalogue migrate to canonical IDs with product-specific copy overlays only where necessary.

### Cross-product bridge

The registry may present Eigenn–Corinthian as an integration, but it owns only catalogue metadata and safe state labels. Signing keys, directives, organization matching, events, permissions, and audit evidence stay in the product bridge services.

## Security and privacy requirements

1. The package never imports an OAuth SDK, database client, secrets client, provider SDK, router, or server-only module.
2. Schemas reject tokens, client secrets, webhook secrets, raw API errors, financial records, bank details, and credential payloads.
3. Product APIs authorize every connection/action; permittedActions is UI data, never an authorization mechanism.
4. Connect, reconnect, scope change, sync, configuration, disconnect, credential rotation, and action execution are audited by the owning product.
5. Source freshness/coverage can be shown without revealing source records to users who lack that permission.

## Generated public manifest

Registry definitions generate a sanitized JSON manifest used by documentation, marketing, and catalogue search. The artifact includes only public ID, name, category, summary, capabilities, operations/triggers, availability, and docs path. It excludes credentials, account data, raw scopes that are not public, and tenant-specific connection state.

```text
registry definitions
        ├── contract tests validate aliases and capability subsets
        ├── generated public manifest for docs and search
        └── artifact test verifies exports and manifest stay in sync
```

## Sim Studio baseline governance

The pinned baseline is a checked-in generated artifact, not an undocumented manual list. The source refresh command fetches only Sim Studio's public catalogue JSON, records source commit/blob/date, normalizes its provider identities, and produces a machine-readable parity diff. It may not overwrite the approved baseline silently.

| Event                                            | Required review action                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Sim adds a provider                              | Assign owner, product outcome, source-to-canonical ID mapping, and initial support state before accepting the update |
| Sim removes or renames a provider                | Preserve alias/history, decide deprecation policy, and update the source mapping deliberately                        |
| Sim changes auth, operation, or trigger metadata | Review scope, permission, lifecycle, data contract, and any affected template before accepting the update            |
| Oppulence adds a provider outside Sim            | Add it as `source: "oppulence"`; it appears as an extra, never as a Sim match                                        |
| A product promotes a provider                    | Review the functional support contract, golden journey, entitlement, lineage, SLO, and audit evidence                |

The CI parity check compares the generated source snapshot with the committed parity manifest. An intentional update requires a reviewed mapping note and a visible change in the parity dashboard. This protects the target from drift while allowing Sim Studio to evolve.

## Implementation plan

### Phase 0 — Package foundation

1. Add packages/integrations with explicit build exports, contracts, canonical IDs/aliases, vocabulary, resolver factory, Phase-0 `/react` loader/hooks, and tests.
2. Import the pinned Sim Studio baseline into a generated provider/operation/trigger manifest, create all 232 registry records with source-parity references, and publish the parity report.
3. Document and test a product-owned authorized database resolver adapter; it returns only IntegrationConnectionProjection data to the package.
4. Add controlled directory primitives, Storybook stories, accessibility tests, and no-className conformance to @oppulence/design-system.
5. Add an availability-promotion review checklist and public-manifest build.

**Exit:** package publishes independently; all 232 Sim Studio providers, their source operations, and triggers have a one-to-one generated catalogue record; both a server resolver and React query bridge can connect without importing a database into the package or browser; no provider runtime code moves; a planned provider never renders as connectable.

### Phase 1 — Migrate read paths

1. Replace Eigenn's duplicate accounting display metadata with the registry.
2. Replace Corinthian web/API identity, category, availability, and capability metadata with registry definitions plus local copy overlays where needed.
3. Implement Eigenn and Corinthian database resolvers that emit safe connection projections through the shared resolver factory.
4. Migrate both directories to shared category/capability/search helpers.

**Exit:** IDs, categories, availability, and capability labels cannot diverge between the two product directories.

### Phase 2 — Normalize connection health

1. Map installed/connected/sync indicators to the common state vocabulary.
2. Show freshness, attention/recovery, action permission, and setup-required state in both products.
3. Support multiple authorized connections per provider.

**Exit:** every visible connection state has an accessible label, a legal recovery action, and owner-API enforcement.

### Phase 3 — Functional Sim Studio provider parity

1. Convert every catalogue-parity record into at least one functional path in Eigenn, Corinthian, or both. A product-specific data adapter may be intentionally read-only; its value contract must say why.
2. Eigenn prioritizes planning truth: Plaid/QuickBooks, accounting, billing, payroll, spreadsheet, warehouse, CRM, and operations sources when they feed a model, provenance, or owner action loop.
3. Corinthian prioritizes revenue execution: invoice/payment, mailbox, CRM, communication, and support sources when they improve evidence or governed action.
4. Introduce generic signed webhooks before Zapier, n8n, Make, or MCP-specific UI expansion, then map their provider-specific source operations as governed capabilities.

**Exit:** all 232 providers have at least one verified owned-product connection or configuration path, and the parity report has no `catalogue_only`, `missing`, or unreviewed source changes.

### Phase 4 — Operation, trigger, and template depth

1. Map each source operation/trigger to `supported`, `intentionally_not_applicable`, or `not_yet_supported`, with an owner and reason. No operation may be silently dropped.
2. Ship only product-relevant operation/trigger mappings, preserving the source operation's public name and description for discovery while using Oppulence's governed command/data contract.
3. Add outcome templates and provider detail pages from the supported mapping; include auth/setup guidance, source lineage, permissions, limitation, and recovery content.
4. Run recurring baseline refreshes and publish category-level catalogue, functional-provider, and operation/trigger coverage.

**Exit:** every source operation and trigger has an explicit disposition, every advertised template is executable under its advertised permission/entitlement, and parity coverage is auditable over time.

## Testing and acceptance

### Package tests

- Canonical IDs and aliases are unique; aliases never overlap another canonical ID.
- Product capability subsets are valid and shipped/beta entries declare value, auth/setup, recovery, and documentation metadata.
- Search/filter output is deterministic and browser-safe.
- Connection projections reject secret-like fields and unknown IDs.
- The resolver factory rejects unknown provider IDs, wrong-product projections, and capabilities unsupported by the registry before building a directory.
- The React loader accepts only a product-provided async loader and has loading, error, refresh, and unmount-safe behavior without a database dependency.
- The pinned Sim Studio baseline maps exactly 232 unique source slugs/types to registry entries; category totals, source auth types, operation count, and trigger count match the snapshot.
- A parity-diff test fails when a Sim Studio provider is unmapped, ambiguously mapped, silently renamed, or has changed source operations/triggers without an explicit review record.
- Support contracts validate that every functional provider has an owner, connection mode, outcome, entitlement, lifecycle/SLO, recovery path, and at least one data contract or action contract.
- Generated summaries contain no long-form operation/template payload; details load by ID and retain deterministic search over provider, operation, and trigger text.
- Entitlement projections never expose tenant state or unavailable commands, and every denied command has a safe UI explanation.
- Template validation rejects an unavailable provider, unsupported operation, missing data contract, or mismatched product capability.
- Built artifacts expose every documented subpath; the manifest matches the registry.

### Design System tests

- Storybook coverage for connected, stale, attention, available, setup-required, planned, no-access, and multiple-connection states.
- Keyboard/focus tests across filters, cards, detail panel, and callbacks.
- Screen-reader strings identify provider, state, freshness, permitted action, and recovery text without relying on color.

### Product golden journeys

For each shipped provider: authorized connect, entitlement denial, initial sync, normal update, freshness expiry, stale/error state, recovery, audit event, and disconnect all pass. The API must enforce the same permission for each visible command. Any data source used by an Eigenn model must also prove source-to-driver lineage, period/coverage validation, and stale/deleted-source propagation. Any Corinthian action source must prove idempotency, policy evaluation, evidence persistence, and audit correlation.

## Acceptance criteria

- [ ] @oppulence/integrations is independently published from this repository.
- [ ] It has no product database, secret, provider SDK, router, OAuth callback, worker, or server-only dependency.
- [ ] Every integration has a canonical ID and explicit legacy aliases.
- [ ] The generated parity report maps all 232 providers in the pinned Sim Studio snapshot, preserving their source identity, category, authentication method, operations, and triggers.
- [ ] The registry covers the named finance, operations, and data categories while tracking product availability independently.
- [ ] Eigenn and Corinthian consume its identity, availability, capability, and directory-filter contracts.
- [ ] Their APIs return safe projections and retain credentials, data movement, authorization, and audit ownership.
- [ ] Planned providers do not offer connect actions; shipped providers pass the complete golden journey.
- [ ] Every Sim Studio parity provider has a verified owned-product connection or configuration path before the programme is declared functionally at parity.
- [ ] Every functional provider has an owner, support contract, entitlement policy, source freshness/SLO policy, recovery action, and data/action lineage.
- [ ] Each source operation and trigger has a visible supported, intentionally-not-applicable, or not-yet-supported disposition; no source capability disappears silently.
- [ ] Advertised outcome templates are generated from supported contracts and execute only through authorized product commands.
- [ ] Design System primitives pass Storybook, keyboard, visual, and screen-reader states under the existing variant-only styling rules.

## Risks

| Risk                                             | Mitigation                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| A broad catalogue becomes a false marketing list | Per-product availability and no-action planned cards                                                                |
| Shared code absorbs sensitive runtime concerns   | Browser-safe dependency checks and contract tests rejecting secrets                                                 |
| Provider behavior differs by product             | Product support records, not a global availability boolean                                                          |
| Legacy aliases break installed connections       | Explicit alias registry and idempotent product migrations                                                           |
| UI drift returns                                 | Make shared ID/capability/availability imports mandatory; local overlays may only provide copy and command adapters |
| Failed sync is hidden by a connected badge       | Explicit freshness/attention state and product-owned recovery commands                                              |
| Sim Studio's catalogue changes silently          | Pin snapshot commit/blob, generate a diff report, and block baseline updates without a reviewed mapping             |
| 232 cards become superficial parity              | Report catalogue and functional parity separately; require connection/configuration, outcome, health, and audit     |
| A source changes model semantics without notice  | Version data contracts, validate coverage/grain/units, surface lineage, and make dependent outputs stale            |
| Broad provider access creates unsafe actions     | Product-owned entitlement, server-side reauthorization, allow-listed commands, policy checks, and audit evidence    |
| A 232-provider directory becomes slow or noisy   | Generated summary payload, lazy detail content, deterministic search/filtering, and outcome-led recommendations     |

## Open questions

1. Which provider logos may ship in a public package versus being supplied by consumer-owned approved icon renderers?
2. What exact release evidence promotes existing Xero, Stripe, Slack, or Gmail code paths to shipped rather than beta or planned?
3. Do personal and organization-shared credentials require different directory visibility policies in each product?

## Source evidence

- [Design System repository](https://github.com/Oppulence-Engineering/design-system)
- [Sim integration catalogue types](https://github.com/simstudioai/sim/blob/main/apps/sim/lib/integrations/types.ts)
- [Pinned Sim Studio integration catalogue](https://github.com/simstudioai/sim/blob/2a6267391d24d4e10e043ce474615ce9f5d1c22a/apps/sim/lib/integrations/integrations.json)
- [Sim integration catalogue entry point](https://github.com/simstudioai/sim/blob/main/apps/sim/lib/integrations/index.ts)
- [Sim workspace credential contract](https://github.com/simstudioai/sim/blob/main/apps/sim/lib/api/contracts/credentials.ts)
