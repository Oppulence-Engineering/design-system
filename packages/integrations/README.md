# @oppulence/integrations

Browser-safe integration catalogue and directory contracts for Eigenn and
Conduitt. It owns provider identity, aliases, source-parity metadata,
availability metadata, search, safe connection projections, support contracts,
provider-kit orchestration, and public catalogue manifests.

The root entry does not contain credentials, OAuth callbacks, provider SDKs,
databases, workers, routers, or authorization decisions. Use the separate
server-only `@oppulence/integrations/server` entry for reusable OAuth2 provider
clients, encrypted credential envelopes, token refresh, and mountable routes.

## Product resolver

The owning product authorizes its request and adapts only safe connection data.

```ts
import {
  createIntegrationDirectoryResolver,
  type IntegrationConnectionResolver,
} from "@oppulence/integrations";

const resolver: IntegrationConnectionResolver<{ organizationId: string }> = {
  async listAuthorizedConnections(context) {
    // Query the product's own database after it has authorized context.
    // Return no tokens, credentials, raw provider errors, or source records.
    return [];
  },
};

export const resolveDirectory = createIntegrationDirectoryResolver({
  product: "eigenn",
  resolver,
});
```

## Product connector boundary

The owning product implements `ProductIntegrationConnector` and validates the
browser-safe `ConnectRequestSchema`, `IntegrationActionRequestSchema`, and
`ConnectionHealthRequestSchema` at its API boundary. A redirect result can
name only a product-owned relative handoff route; tokens, OAuth authorization
URLs, callback state, provider errors, and credentials stay server-side.

Support records use `IntegrationDataContract` for imported source data and
`IntegrationActionContract` for governed commands. Every supported operation
or trigger references one of those records, which makes its lineage,
authorization policy, idempotency key, and audit event reviewable before a
provider is promoted.

## Product integration kit

`createProductIntegrationKit()` centralizes the repeatable product plumbing:
directory resolution, bulk entitlement gating, canonical-ID normalization,
safe command validation, permitted-action checks, and support-contract
validation. The consumer supplies only its authorized database lookups,
policy evaluation, and server-side connector implementation.

```ts
import {
  createIntegrationConnectionResolver,
  createProductIntegrationKit,
  type ProductIntegrationConnector,
} from "@oppulence/integrations";

type Context = { teamId: string; actorId: string };

const resolver = createIntegrationConnectionResolver({
  async listAuthorizedRecords(context: Context) {
    return database.integrationConnections.findMany({
      where: { teamId: context.teamId },
    });
  },
  toProjection(_context: Context, row) {
    return toSafeConnectionProjection(row); // no tokens or raw provider errors
  },
});

const connector: ProductIntegrationConnector<Context> = {
  // For OAuth2, use createOAuthRouteConnector() from the /server entry.
  // Product-owned Link, API-key, and upload flows can return their own safe
  // relative handoff route.
  beginConnection: async (_context, request) =>
    beginEigennNonOAuthConnection(request),
  performAction: performEigennConnectionAction,
  getConnectionHealth: getEigennConnectionHealth,
};

export const eigennIntegrations = createProductIntegrationKit({
  product: "eigenn",
  resolver,
  findAuthorizedConnection: (context, connectionId) =>
    findEigennConnection(context, connectionId),
  entitlements: {
    async evaluate(context, request) {
      return evaluateEigennIntegrationAccess(context, request);
    },
    async evaluateDirectory(context, candidates) {
      return evaluateEigennDirectoryAccess(context, candidates);
    },
  },
  connector,
  supportContracts: eigennIntegrationSupportContracts,
});

// Framework routes/controllers call these. The root kit is intentionally not a
// router, database client, OAuth handler, worker, or provider SDK runtime.
const directory = await eigennIntegrations.getDirectory(context);
const result = await eigennIntegrations.beginConnection(context, requestBody);
```

`evaluateDirectory` is optional; without it the kit evaluates each eligible
provider through `evaluate`. Supplying the bulk implementation is recommended
for large catalogues.

## Server OAuth runtime

`@oppulence/integrations/server` is a Node-targeted, browser-fenced entry
point. It owns the OAuth2 protocol, PKCE, one-time callback state, AES-GCM
credential envelope, proactive refresh, one 401 refresh retry, provider
request client, and Fetch-standard start/callback routes. It includes reusable
QuickBooks and Xero presets; other normal OAuth2 providers can be configured with
`createOAuth2ProviderSdk()`.

The consuming product implements only persistence and business seams: a vault
for encrypted records, short-lived OAuth state storage, authenticated subject
resolution, authorization policy, and domain actions such as accounting
normalization or a sync job. `createIntegrationCredentialKeyring()` covers the
common deployment-secret case and supports key rotation; a regulated product
can instead provide the same small keyring interface backed by KMS.

```ts
import {
  composeIntegrationRoutes,
  createIntegrationOAuthRoutes,
  createIntegrationCredentialKeyring,
  createIntegrationProductRoutes,
  createOAuthRouteConnector,
  createQuickBooksOAuth2Provider,
  createXeroOAuth2Provider,
} from "@oppulence/integrations/server";

const credentialKeyring = await createIntegrationCredentialKeyring({
  active: {
    id: "2026-07",
    secret: env.INTEGRATION_CREDENTIAL_KEY, // 32-byte Base64URL secret
  },
  previous: [], // retain prior keys here during a rotation
});

const oauthRoutes = createIntegrationOAuthRoutes({
  providers: [
    createQuickBooksOAuth2Provider({
      clientId: env.QUICKBOOKS_CLIENT_ID,
      clientSecret: env.QUICKBOOKS_CLIENT_SECRET,
      redirectUri: `${env.APP_URL}/integrations/quickbooks/oauth/callback`,
    }),
    createXeroOAuth2Provider({
      clientId: env.XERO_CLIENT_ID,
      clientSecret: env.XERO_CLIENT_SECRET,
      redirectUri: `${env.APP_URL}/integrations/xero/oauth/callback`,
    }),
  ],
  credentialVault: productIntegrationCredentialVault,
  credentialKeyring,
  oauthStateStore: productOAuthStateStore,
  resolveSubject: resolveAuthenticatedSubject,
  // Required for every direct OAuth start route. Reuse the same product
  // entitlement/policy check that governs the integration directory/card.
  authorizeStart: authorizeIntegrationConnect,
  // Required again at callback time, before a credential is exchanged or saved.
  // The original subject may have lost access while completing OAuth.
  authorizeComplete: authorizeIntegrationConnect,
  onConnected: createProductConnectionAndScheduleInitialSync,
});

const productRoutes = createIntegrationProductRoutes({
  kit: eigennIntegrations,
  resolveContext: resolveAuthenticatedProductContext,
});

// Mount one handler in Hono, Next, or another HTTP adapter. It owns:
// GET  /integrations
// POST /integrations/:id/connect
// POST /integrations/connections/:id/actions
// GET  /integrations/connections/:id/health
// GET|POST /integrations/:id/oauth/start
// GET  /integrations/:id/oauth/callback
const routes = composeIntegrationRoutes(productRoutes, oauthRoutes);
const response = await routes.handle(request);
```

Use the shared connector for OAuth2 cards, while retaining only business
actions and health calculations in the product:

```ts
const connector = createOAuthRouteConnector({
  actions: {
    performAction: performEigennConnectionAction,
    getConnectionHealth: getEigennConnectionHealth,
  },
});
```

The server runtime deliberately does not turn provider-specific business data
into product records. Plaid Link, file imports, API keys, webhooks, and any
provider-specific source normalization still use product or future
provider-module adapters. Make `onConnected` idempotent: if it rejects, the
runtime revokes the newly stored credential envelope before returning a safe
failure. The state-store adapter must atomically purge expired records, enforce
the supplied per-subject pending-state cap (five by default), and consume a
state exactly once. `createInMemoryIntegrationOAuthStateStore()` is provided
only for tests/development; deploy a durable DB/Redis implementation in a
product. `maximumPendingAuthorizationsPerSubject` is configurable from 1 to 20.

Provider authorization, token, and API endpoints require HTTPS. A redirect URI
may use HTTP only for a loopback development host; package-owned OAuth and PKCE
parameters cannot be overridden by provider configuration. Token
requests—including their response body—time out after 15 seconds by default
and accept at most 64 KiB of JSON; route JSON bodies are also capped at 64 KiB
by default. Credential operations are serialized per connection: a disconnect
waits for a running refresh and then removes the refreshed envelope.
Deployments with multiple replicas pass a DB/Redis-backed
`credentialRefreshLock` with the same serialization guarantee.

## Golden journey harness

`runIntegrationGoldenJourney()` validates support/operation coverage and then
runs product-owned assertions in the required order: authorization,
entitlement denial, connect, initial sync, normal update, freshness expiry,
recovery, audit event, and disconnect. This lets Canvas and Eigenn keep their
real integration tests while sharing a complete release gate.

## React

The optional `/react` entry point has no query-client or router dependency.

```tsx
import {
  IntegrationDirectoryProvider,
  useIntegrationDirectory,
} from "@oppulence/integrations/react";

function Directory() {
  const { directory, isLoading, error, refresh } = useIntegrationDirectory();
  // Render with @oppulence/design-system once directory is available.
}

function DirectoryBoundary({ teamId }: { teamId: string }) {
  return (
    <IntegrationDirectoryProvider
      loader={loadDirectoryForTeam}
      scopeKey={`eigenn:${teamId}`}
    >
      <Directory />
    </IntegrationDirectoryProvider>
  );
}
```

`scopeKey` is required and must change when the product or tenant changes, so
the adapter never shows the prior tenant's directory while the next one loads.

## Parity and publishing

`src/generated/simstudio-baseline.json` records the approved Sim Studio source
snapshot. Refreshes require an explicit write and a review note:

```sh
bun run refresh:simstudio -- --write --review-note="Review note"
```

`bun run build` emits `dist/integrations.manifest.json`, a tenant-free public
catalogue artifact for documentation, marketing, and discovery. Its parity
summary reports all registry providers (including Oppulence-specific extras)
and separate Sim Studio-only counters for catalogue-only, functionally
supported, and operation-or-trigger-supported coverage. A `beta` or `shipped`
label does not increase functional coverage until it has a parseable product
support contract.
