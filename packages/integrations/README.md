# @oppulence/integrations

Browser-safe integration catalogue and directory contracts for Eigenn and
Conduitt. It owns provider identity, aliases, source-parity metadata,
availability metadata, search, safe connection projections, support contracts,
provider-kit orchestration, and public catalogue manifests.

The root entry does not contain credentials, OAuth callbacks, provider SDKs,
databases, workers, routers, or authorization decisions. Use the separate
server-only `@oppulence/integrations/server` entry for reusable OAuth2 and
browser-Link provider clients, encrypted credential envelopes, token refresh,
and mountable routes.

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
  createIntegrationConnectionLinkRoutes,
  createIntegrationConnectionLinkRuntime,
  createIntegrationWebhookRoutes,
  createIntegrationWebhookRuntime,
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

const connectionLinkRuntime = createIntegrationConnectionLinkRuntime({
  credentialVault: productIntegrationCredentialVault,
  credentialKeyring,
  plaid: {
    clientId: env.PLAID_CLIENT_ID,
    secret: env.PLAID_SECRET,
    environment: env.PLAID_ENVIRONMENT,
  },
  merge: {
    apiKey: env.MERGE_API_KEY,
    // Product DB lookup only; the package owns Link token issuance and the
    // encrypted account token returned by Merge Link.
    resolveEndUser: lookupAuthorizedMergeEndUser,
  },
  onConnected: createProductConnectionAndScheduleInitialSync,
});

const connectionLinkRoutes = createIntegrationConnectionLinkRoutes({
  runtime: connectionLinkRuntime,
  resolveSubject: resolveAuthenticatedSubject,
  authorizeStart: authorizeIntegrationConnect,
  authorizeComplete: authorizeIntegrationConnect,
});

const webhookRuntime = createIntegrationWebhookRuntime({
  plaid: {
    clientId: env.PLAID_CLIENT_ID,
    secret: env.PLAID_SECRET,
    environment: env.PLAID_ENVIRONMENT,
    // Product DB lookup only; package code verifies the signed request and
    // never exposes a Plaid access token to this callback.
    resolveConnection: lookupPlaidConnectionByItemId,
  },
  merge: {
    signatureKey: env.MERGE_WEBHOOK_SIGNATURE_KEY,
    // Product DB lookup only; Merge account tokens are never forwarded here.
    resolveConnection: lookupMergeConnectionByLinkedAccountId,
  },
  // Persist/enqueue by idempotencyKey. The package supplies connection scope
  // and a safe provider event name, never the provider payload or credentials.
  onSyncRequired: enqueueIntegrationSync,
});

const webhookRoutes = createIntegrationWebhookRoutes({
  runtime: webhookRuntime,
});

// Mount one handler in Hono, Next, or another HTTP adapter. It owns:
// GET  /integrations
// POST /integrations/:id/connect
// POST /integrations/connections/:id/actions
// GET  /integrations/connections/:id/health
// GET|POST /integrations/:id/oauth/start
// GET  /integrations/:id/oauth/callback
// POST /integrations/:id/link/token
// POST /integrations/:id/link/complete
// POST /integrations/:id/webhooks
const routes = composeIntegrationRoutes(
  productRoutes,
  oauthRoutes,
  connectionLinkRoutes,
  webhookRoutes,
);
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
into product records. Plaid and Merge Link now have package-owned token and
completion routes: `POST /integrations/:id/link/token` and
`POST /integrations/:id/link/complete`. The browser receives only an ephemeral
Link token; its returned public token is exchanged server-side and the Plaid
access token or Merge account token is encrypted before the product callback
runs. It also mounts signature-verified webhook receivers at
`POST /integrations/plaid/webhooks` and `POST /integrations/merge/webhooks`.
Those receivers emit a redacted, idempotent sync signal; products only map a
safe provider ID to a connection and persist the scheduled business sync.
File imports and source normalization remain product business logic. Make
`onConnected` idempotent: if it rejects, the runtime revokes the newly stored
credential envelope before returning a safe failure. The
state-store adapter must atomically purge expired records, enforce the supplied
per-subject pending-state cap (five by default), and consume a state exactly
once. `createInMemoryIntegrationOAuthStateStore()` is provided only for
tests/development; deploy a durable DB/Redis implementation in a product.
`maximumPendingAuthorizationsPerSubject` is configurable from 1 to 20.

### Browser Link controls

The React entrypoint owns the provider browser SDKs as well as the two server
calls. Products render a button and receive only a safe connected projection:

```tsx
import {
  MergeConnectionLinkButton,
  PlaidConnectionLinkButton,
} from "@oppulence/integrations/react";

<PlaidConnectionLinkButton
  buttonProps={{ className: "button button-primary" }}
  onConnected={({ connectionId }) => refreshIntegrationDirectory(connectionId)}
/>

<MergeConnectionLinkButton
  buttonProps={{ className: "button button-primary" }}
  onConnected={({ connectionId }) => refreshIntegrationDirectory(connectionId)}
/>
```

Use `createIntegrationConnectionLinkClient({ fetcher })` when the product has
an authenticated fetch wrapper that adds CSRF protection or request tracing.
The components never receive or retain Plaid access tokens or Merge account
tokens.

Provider authorization, token, and API endpoints require HTTPS. A redirect URI
may use HTTP only for a loopback development host; package-owned OAuth and PKCE
parameters cannot be overridden by provider configuration. Token
requests—including their response body—time out after 15 seconds by default
and accept at most 64 KiB of JSON; route JSON bodies are also capped at 64 KiB
by default. Credential operations are serialized per connection: a disconnect
waits for a running refresh and then removes the refreshed envelope.
Deployments with multiple replicas pass a DB/Redis-backed
`credentialRefreshLock` with the same serialization guarantee.

## Package-owned provider execution

Products do not construct vendor SDK clients or receive decrypted credentials.
After supplying their encrypted API-key and OAuth runtimes, they mount one
authorized execution route. The package validates the operation, rejects
credential-shaped input, reads the connection-bound credential, constructs the
vendor client, and redacts credential-shaped output. Products retain only
connection ownership, database lookups, authorization, and their business
action policy.

```ts
import {
  createBuiltInProviderSdkRegistry,
  createIntegrationProviderExecutionRoutes,
} from "@oppulence/integrations/server";

const providerRegistry = createBuiltInProviderSdkRegistry({
  apiKeyRuntime,
  oauthRuntime,
  connectionLinkRuntime,
  plaid: {
    clientId: env.PLAID_CLIENT_ID,
    secret: env.PLAID_SECRET,
    environment: env.PLAID_ENVIRONMENT,
  },
  merge: { apiKey: env.MERGE_API_KEY },
  quickbooks: {
    clientId: env.QUICKBOOKS_CLIENT_ID,
    clientSecret: env.QUICKBOOKS_CLIENT_SECRET,
    // Reads only the non-secret realm ID saved from the OAuth callback.
    companyId: lookupQuickBooksCompanyId,
  },
  xero: {
    clientId: env.XERO_CLIENT_ID,
    clientSecret: env.XERO_CLIENT_SECRET,
    // Reads only the selected non-secret tenant ID from the connection row.
    tenantId: lookupXeroTenantId,
  },
});

const executionRoutes = createIntegrationProviderExecutionRoutes({
  providerRegistry,
  resolveSubject: resolveAuthenticatedSubject,
  authorizeExecution: authorizeProductIntegrationAction,
});
```

For shipped API-key SDKs, create the runtime with
`createBuiltInIntegrationApiKeyRuntime({ credentialVault, credentialKeyring,
onConnected })`. It supplies the package-owned profiles for Stripe, GitHub,
GitLab, Cloudflare, ElevenLabs, Firecrawl, Intercom, Mailgun, Mailchimp, Vercel,
Square, Google Books, YouTube, Resend, and Brex. Mailchimp remains
SDK-only because its regional API hostname is derived from the encrypted key;
the generic HTTP transport deliberately rejects arbitrary requests for it.

The shipped adapters currently execute every pinned source action exposed by a
supported provider SDK for Stripe, Slack, HubSpot, GitHub, GitLab, Airtable,
Asana, Dropbox, Brex, Cloudflare, ElevenLabs, Firecrawl, Intercom, Mailgun,
Linear, Mailchimp, Vercel, Square, Google Calendar,
Google Drive, Google Sheets, Google Docs, Google Slides, Gmail, Google Forms, Google Tasks, Google Contacts, Google Books, YouTube, Resend, Google Meet, and Google Groups. Square uses its official Node.js
SDK for all 34 pinned actions. Google Calendar, Drive, Sheets, Docs, Forms,
Tasks, Contacts, Books, YouTube, Meet, and Groups use Google's `googleapis` client for 138 pinned actions and include package-owned
OAuth presets with encrypted refresh-token handling. Google Slides contributes another 52 pinned actions; its batch edits accept the official Google Slides `Request` object in `input.request`. Gmail contributes 13 more and constructs standards-compliant MIME messages itself; attachments are bounded Base64 payloads (`filename`, `data`, and optional `mimeType`) so decrypted credentials and provider-specific client code stay in the package. Vercel runs 55 actions
through its official generated SDK; its Edge Config item mutation remains
catalogue-only until the vendor adds it to that SDK. GitLab runs all 65 pinned
actions through the maintained GitBeaker client; its host is deployment
configuration, not action input, so a personal access token cannot be
redirected to an attacker-controlled origin. Intercom runs all 31 pinned
actions through its official client. Cloudflare runs 12 actions through its
official client; the source action to list every zone setting remains
catalogue-only because the SDK only exposes individual setting reads. ElevenLabs
runs all 10 pinned actions through its official SDK; generated audio is a
bounded Base64 `audioFile` payload, leaving durable storage and URL policy to
the consuming product. Firecrawl runs all 13 pinned actions through its
official TypeScript SDK, including asynchronous job status and cancellation;
the package returns its vendor job identifiers instead of polling with raw
HTTP. Airtable runs six source record actions through its official SDK; its
metadata discovery and upsert actions remain catalogue-only because that SDK
does not expose public methods for them. Asana runs all 14 pinned task,
project, workspace, section, story, and follower actions through Asana's
official generated Node SDK; its OAuth preset requests only the matching
project, task, and workspace scopes. Dropbox runs all 13 pinned file, folder,
sharing, search, and revision actions through its official JavaScript SDK;
transferred file payloads are bounded portable Base64 data and OAuth requests
offline refresh tokens. Mailgun runs all eight pinned actions
through its official SDK; its regional endpoint is package configuration, not
an action input. Resend runs all 16 pinned actions through its official Node
SDK. Brex runs all 34 pinned actions through its maintained typed SDK.
QuickBooks (six ledger actions) and Xero (six accounting actions) use
package-owned Node SDK adapters after their OAuth connection is complete;
products only read a non-secret company or tenant ID from their own connection
row. Plaid runs Link issuance, public-token exchange, accounts, balances, Item
status, and transaction sync through the official Node SDK. Merge adds a
package-native Accounting Link connector and six normalized accounting actions
through Merge's TypeScript SDK.

## Provider execution lanes

The package owns three server-only execution lanes behind the same operation
route and encrypted credential boundary:

1. **SDK (default):** Use a maintained official or ecosystem SDK whenever it
   safely supports the operation.
2. **Typed REST (exception):** When the SDK review establishes that no viable
   SDK covers an operation, `createIntegrationTypedRestProvider()` supplies a
   schema-validated declarative request. Its authoring surface matches
   SimStudio's core tool config: `id`, `name`, `description`, `version`,
   `params`, `outputs`, `request.url`, `request.method`, `request.headers`,
   `request.body`, optional retry metadata, and
   `transformResponse(response, params)`. It uses the OAuth, API-key, or
   no-auth runtime to inject credentials, accepts relative provider URLs only,
   blocks caller-supplied credential headers, bounds response reads before the
   response transformer runs, and validates the safe output projection before
   it reaches a product. Strict schemas are derived from `params` and `outputs`
   by default; optional Zod input/output schemas and the response byte limit are
   package safety extensions for stricter provider-specific validation.
3. **Special provider:** `createIntegrationSpecialProvider()` covers protocol
   clients, signed requests, streaming/file transfers, and database drivers.
   Its server-only handler may use an SDK or driver, but it shares the same
   connection reference, authorization seam, and operation route as the other
   lanes.

The registry may combine these lanes for one provider only when their operation
IDs do not overlap. This makes an SDK the owner where one exists while allowing
a typed REST or special adapter for an uncovered operation. Products still
provide only durable connection state, authorization, and their domain logic;
they never receive a provider credential.

`getProviderExecutionStrategyReport()` reports the source-wide SDK-first,
typed-REST, and special-provider plan. It is planning evidence only;
`getProviderSdkCoverageReport()` is the executable-coverage source of truth,
and trigger runtime remains separate.

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
