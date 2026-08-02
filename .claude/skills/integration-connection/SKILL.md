---
name: integration-connection
description: Wire a product's customer-facing connection flow for @oppulence/integrations — mount the routes, supply the credential vault and keyring, render the directory, and add an OAuth or API-key provider to the connect path. Use when asked how a customer connects an integration, to mount integration routes, to configure OAuth or API-key credentials, to debug a connect or callback failure, or to add a new connection broker.
---

# Wiring the customer connection flow

The package ships routes, credential encryption, and provider adapters. The
product supplies storage, identity, and authorization. Keep that line: a change
that makes the package read a product's database is the wrong change.

Work from the product, not from `packages/integrations`. The only reason to
edit the package here is to add a broker or a transport profile.

## The rule that decides everything

**A credential is ciphertext everywhere except inside `withCredential`.** The
vault stores an encrypted envelope, the runtime decrypts server-side to make one
call, and product code never sees a plaintext secret. Any design that hands a
key back to the caller, logs one, or stores one for later is wrong, however
convenient.

## 1. Decide which path the integration uses

The catalogue decides, not the product:

```ts
getIntegration(integrationId)?.products.find((p) => p.product === product)
  ?.authMethods; // ["api_key"] | ["oauth2"] | ["none"] | ...
```

| Method    | Route                              | Registration needed |
| --------- | ---------------------------------- | ------------------- |
| `api_key` | `POST {base}/{id}/api-key`         | none                |
| `oauth2`  | `{base}/{id}/oauth/start`          | an app, per vendor  |
| `none`    | `POST {base}/{id}/no-auth`         | none                |
| broker    | `{base}/{plaid\|merge}/link/token` | one, per broker     |

The lane refuses a transport that disagrees with the catalogue — an `api_key`
adapter for an OAuth-only provider throws
`INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID` at construction. If that fires,
the pack's `transportKind` is wrong, not the catalogue.

## 2. Mount the routes

```ts
composeIntegrationRoutes(
  createIntegrationOAuthRoutes({ ...oauthConfig }),
  createIntegrationApiKeyRoutes({ ...apiKeyConfig }),
  createIntegrationProviderExecutionRoutes({ registry, ...}),
);
```

`basePath` defaults to `/integrations`. Every route is derived from it, so a
product mounting elsewhere sets it once.

## 3. Supply the four product-owned pieces

```ts
{
  credentialVault:   { read, save, revoke },
  credentialKeyring: { getActiveKey, getKey },
  oauthStateStore:   { /* single-use */ },
  resolveSubject, authorizeStart, authorizeComplete,
}
```

Points that matter:

- **`authorizeComplete` is a recheck.** Permission can be revoked while the
  customer is on the vendor's consent screen, and the callback is the last point
  before a credential is persisted. Copying `authorizeStart` into it defeats the
  check.
- **State is single-use and capped per subject** (five pending by default), so
  an abandoned flow cannot be replayed.
- **The keyring is key-id addressed** so a rotation can decrypt old envelopes.
  Returning only the active key from `getKey` breaks every existing connection.

## 4. Render the directory

```ts
createIntegrationDirectoryResolver({ product, resolver });
```

The resolver returns only connections the current customer may see. Availability
and the primary action are derived from that plus `EXECUTABLE_INTEGRATION_IDS`;
do not compute them in the product, or the directory will offer a connector the
package cannot run.

## 5. Execute

```
POST {base}/{integrationId}/connections/{connectionId}/operations/{operationId}
```

`connectionId` scopes execution to one customer's credential. `operationId` is
`{integrationId}:{action}`.

## Adding a broker

Brokers are how the long tail avoids per-vendor OAuth registration: the broker
holds the vendor relationships, the product holds one credential.

`IntegrationConnectionLinkProvider` in `src/link-client.ts` is the union of
supported brokers — today `"plaid" | "merge"`. Adding one means extending that
union, adding a config branch in `src/server/transport/connection-link.ts`, and
a React button beside the existing ones. It is not a new lane.

Before adding one, check whether the broker's provider list actually overlaps
the deferred integrations. A broker that covers vendors already on the API-key
path buys nothing.

## Debugging a failed connect

| Symptom                                   | Cause                                                         |
| ----------------------------------------- | ------------------------------------------------------------- |
| `CONFIGURATION_INVALID` at startup        | pack `transportKind` disagrees with the catalogue auth method |
| Callback 400 with a valid-looking state   | state already consumed, or a second tab started a new flow    |
| Old connections fail after a key rotation | `getKey(keyId)` does not return retired keys                  |
| Directory shows an integration as planned | it is missing from `EXECUTABLE_INTEGRATION_IDS`               |
| 401 from a provider on every action       | transport profile scheme is wrong; check the vendor's spec    |

`bun run providers:smoke` probes mapped GET routes unauthenticated. A 401 or 403
confirms the route exists; a 404 against a placeholder id proves nothing.

## Reference

| Thing                     | Path                                        |
| ------------------------- | ------------------------------------------- |
| Routes                    | `src/server/http/routes.ts`                 |
| OAuth runtime             | `src/server/runtime/oauth.ts`               |
| API-key runtime, profiles | `src/server/runtime/api-key.ts`             |
| Credential envelope       | `src/server/transport/credentials.ts`       |
| Broker lane               | `src/server/transport/connection-link.ts`   |
| Directory resolver        | `src/connection.ts`                         |
| Long-form guide           | `docs/integrations-connecting-customers.md` |
