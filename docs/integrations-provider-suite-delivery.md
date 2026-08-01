# Integration provider-suite delivery

**Status:** Draft implementation plan
**Owner:** `@oppulence/integrations`
**Baseline:** 254 catalogue records: the pinned 232-provider Sim Studio
snapshot plus 22 Oppulence-specific providers

## What "the entire suite" means

The package owns the reusable provider layer for every catalogue record:
identity, availability, setup contract, credential envelope, protocol runtime,
safe routes, connection state, health projection, support evidence, and
directory model. Eigenn and Conduitt own only their authenticated data adapter,
database records, product authorization, domain normalization, business work,
and audit persistence.

Every provider moves through the following states independently for Eigenn and
Conduitt. This is deliberately stricter than a catalogue card or a generated
SDK constructor.

| State            | Shared package deliverable                                                                              | Product deliverable                                                                            | Customer claim                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `catalogued`     | Canonical ID, aliases, source operations/triggers, auth class, and directory metadata                   | None                                                                                           | Tracked only                                     |
| `protocol-ready` | Provider configuration/SDK, encrypted credential lifecycle, callback or setup route, and protocol tests | Secret configuration only                                                                      | Setup can be enabled in a controlled environment |
| `product-ready`  | Validated connection and capability contracts, health/recovery protocol, and golden-journey fixtures    | Authorized storage adapter, entitlement policy, normalization/business handler, and audit sink | Beta                                             |
| `functional`     | Versioned support contract and operation/trigger coverage gate                                          | Production evidence for outcome, freshness, recovery, lineage, and authorization               | Shipped                                          |

No state transition is inferred from a provider's source catalogue metadata.
`planned`, `beta`, and `shipped` continue to be product-specific fields in the
registry and the public manifest continues to report catalogue and functional
coverage separately.

## Package responsibilities

- `@oppulence/integrations`: provider registry, browser-safe contracts,
  connection kit, outcome/support gates, generated manifests, React helpers,
  provider SDKs, OAuth/PKCE, encrypted credentials, refresh locking, and
  Fetch-standard OAuth/directory/command routes.
- `@oppulence/integrations/server`: credentials never cross to a browser;
  provider callback data is allowlisted; routes re-authorize before persisting
  a connection. Its shared transports cover the pinned Sim Studio auth classes:
  OAuth 2.0, API key, and no-auth HTTPS clients. OAuth callbacks, API-key
  setup, and no-auth connection confirmation are all mountable Fetch-standard
  routes; each product provides only authorization plus its database/audit
  callback.
- Eigenn and Conduitt: authenticated subject resolution, tenant/role/plan
  policy, DB/KMS implementations of the package interfaces, provider data
  normalization, sync and action business logic, lineage, and audit records.

Client IDs, client secrets, API keys, service-account keys, account IDs, and
tenant credentials are deployment data. They are never provider-suite source
code or catalogue data.

## Provider packs and the coverage gate

Each provider is delivered as a **provider pack**: one module exporting a
`create<Provider>Pack()` factory that declares every source action and trigger
it claims, the lane that owns each, and the adapters that execute them. A pack
is not shippable until `assertProviderPackCoverage()` passes, which enforces
what this document previously only asserted in prose:

- every source action and trigger is either supported or explicitly deferred
  with a reason, so a pack cannot silently drop one;
- an action may use the typed REST lane only with a recorded `sdkReview`
  naming the SDK and version examined — SDK-first is checked, not trusted;
- declared coverage matches the adapters actually built, so a pack cannot
  claim an action it never wires.

`tests/coverage-gate.test.ts` runs that contract across every pack and asserts
the executable totals. Those numbers are the merge gate for parity work: they
move only when a provider family lands, and moving them is the reviewable
statement that it did.

### Current position

| | Providers | Actions | Triggers |
| --- | ---: | ---: | ---: |
| Pinned source | 232 | 3,890 | 363 |
| Executable | 57 | 1,286 | 46 |
| Remaining | 175 | 2,604 | 317 |

Of the 1,286 executable actions, 1,258 run on a vendor or maintained SDK and
28 on the typed REST lane — the six actions whose SDKs do not model them
(Airtable metadata and upsert, Cloudflare zone settings, Vercel Edge Config
items) plus the 22 Jira Service Management Forms and Assets actions, which
belong to separate Atlassian products with no SDK anywhere.

## Delivery order

### Wave 0 — package and CI foundation

- Keep the catalogue, public manifest, Storybook directory, and package
  artifact contract green in a clean checkout.
- Build workspace dependencies before their consumers' TypeScript checks. The
  package publishes declaration files; a fresh CI installation has no ignored
  `dist` directory to resolve otherwise.
- Keep protocol and credential functionality server-only, with the browser
  stub as the import-boundary guard.

### Wave 1 — finance-system connectors

Start with the owned finance loops already represented in the registry:
QuickBooks, Xero, Plaid, Stripe, PayPal, Wise, and the supported regional
ledger/banking choices. The shared package supplies the auth and connection
protocol; each product supplies the outcome-specific adapter.

### Wave 2 — receivables and customer context

Implement the customer, invoice, payment, CRM, mailbox, and messaging
providers required for Conduitt's governed revenue-execution loops. Add one
support contract per product/provider pair rather than advertising a generic
operation as product functionality.

### Wave 3 — planning inputs and operational data

Implement payroll/HR, spreadsheets, warehouses, BI, documents, and data-source
providers that feed Eigenn drivers, freshness, and scenario explanations.

### Wave 4 — remaining catalogue providers

Process every remaining Sim Studio baseline provider by auth class and owned
outcome. Providers that are irrelevant to both product loops remain
`catalogued`; they do not become connectable merely to improve a count.

## Per-provider completion gate

A provider can be marked functional only after the repository has all of the
following:

- Provider-specific protocol configuration and tests, including failed
  authorization, credential refresh/revocation, and safe callback handling.
- A product-scoped connection record adapter and an entitlement decision for
  every visible command.
- At least one supported capability with a data or governed-action contract,
  lineage, retention/deletion ownership, and audit correlation.
- Initial sync, freshness/SLO, recovery, disconnect, and golden-journey
  coverage.
- Explicit dispositions for its source operations and triggers.

`docs/integrations-availability-promotion-checklist.md` is the release gate for
the final `beta` and `shipped` transitions.

## Measurement

Run the package build to emit `integrations.manifest.json`. Its parity block is
the source of truth for counts:

- `catalogueOnly` must never be presented as functional integrations.
- `functionallySupported` requires a validated product support contract.
- `operationOrTriggerSupported` requires explicit support coverage.

The next implementation commits on this draft PR should add provider protocol
adapters and their tests in waves, then land product adapters in Eigenn and
Conduitt as separate, evidence-backed changes.
