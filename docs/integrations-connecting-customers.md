# Connecting a customer to an integration

How a product using `@oppulence/integrations` lets its own customers connect
the 137 executable integrations, and what the product has to supply.

The package ships routes, credential encryption, and the provider adapters. It
never sees the product's database, its tenancy model, or its authorization
rules — those stay with the product, which is what lets the same package drop
into products with different identity models.

## What a connection is

A connection is one customer's authorization to one integration, held as an
encrypted credential the product stores and the package decrypts server-side to
execute an action. The package hands back a `connectionId`; the plaintext
secret never crosses back into product code.

## 1. Mount the routes

`composeIntegrationRoutes` combines the connectors a product needs under one
base path, `/integrations` by default.

| Route                                                                             | Purpose                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------ |
| `POST\|GET {base}/{integrationId}/oauth/start`                                    | Redirects to the vendor's consent screen         |
| `GET {base}/{integrationId}/oauth/callback`                                       | Vendor returns here; the connection is persisted |
| `POST {base}/{integrationId}/api-key`                                             | Body `{ apiKey }`                                |
| `POST {base}/{integrationId}/no-auth`                                             | Providers with nothing to authenticate           |
| `POST {base}/{plaid\|merge}/link/token`                                           | Opens a broker-hosted Link flow                  |
| `POST {base}/{plaid\|merge}/link/complete`                                        | Exchanges the broker's public token              |
| `POST {base}/{integrationId}/connections/{connectionId}/operations/{operationId}` | Runs one mapped action                           |

## 2. Show the directory

```tsx
const resolveDirectory = createIntegrationDirectoryResolver({
  product: "eigenn",
  resolver: { listAuthorizedConnections: (context) => /* product query */ },
});
```

The resolver returns only the connections the current customer may see. The
package derives each entry's availability and primary action from that, and
`IntegrationDirectory` from `@oppulence/design-system` renders it.

Availability is derived from `EXECUTABLE_INTEGRATION_IDS`, so an integration the
package cannot execute is never offered as connectable, and one it can execute
is never stranded as planned. A gate asserts both directions.

## 3. The three connect paths

Which path an integration uses comes from its catalogue definition, not from a
product decision. Today, across the 137 executable integrations:

| Auth method | Count | What the customer does                       |
| ----------- | ----- | -------------------------------------------- |
| `api_key`   | 82    | Pastes a key from the vendor's dashboard     |
| `oauth2`    | 41    | Approves on the vendor's consent screen      |
| `none`      | 14    | Nothing — public or protocol-level providers |

**API key.** The product renders a field and posts it to `{base}/{id}/api-key`.
The key is encrypted before it reaches storage. Nothing has to be registered
with the vendor, which is why this is the fastest surface to ship.

**OAuth.** The product registers its own app with each vendor and supplies the
client credentials. See "The OAuth registration cost" below — it is the main
constraint on rollout order.

**Broker Link.** Plaid and Merge host their own connection UI.
`IntegrationConnectionLinkButton` in `@oppulence/integrations/react` drives the
broker's SDK and the public token is exchanged server-side.

## 4. What the product supplies

```ts
{
  credentialVault:   { read, save, revoke },    // product storage — ciphertext only
  credentialKeyring: { getActiveKey, getKey },  // KMS, HSM, or managed secret
  oauthStateStore:   { /* single-use state */ },
  providers:         [{ clientId, clientSecret, ... }],
  resolveSubject(request),                      // which customer is this?
  authorizeStart(subject, integrationId, request),
  authorizeComplete(subject, integrationId, request),
}
```

Two of these are easy to get wrong:

- **`authorizeComplete` is a recheck, not a repeat of `authorizeStart`.** A
  customer's permission can be revoked while they are on the vendor's consent
  screen, and the callback is the last point before a credential is persisted.
- **The vault only ever holds ciphertext.** Decryption happens inside
  `withCredential`, server-side, so product code never handles the secret and a
  vault dump is not a credential leak.

OAuth state is single-use, and pending authorizations are capped per subject —
five by default — so an abandoned flow cannot be replayed or used to exhaust
storage.

## 5. Running an action

```
POST {base}/{integrationId}/connections/{connectionId}/operations/{operationId}
```

The `connectionId` scopes execution to that customer's credential. The
`operationId` is one of the mapped actions, spelled `{integrationId}:{action}`.

## The OAuth registration cost

Forty-one integrations need the product to register an OAuth app with the
vendor: a developer account, a redirect URI, and for some a review queue that
takes days. That is a real rollout cost and it is worth planning around rather
than discovering.

It cannot be avoided for first-party OAuth. A vendor issues tokens to a
registered client, and there is no protocol by which a product obtains one
without registering. The realistic choices are:

1. **Ship the 82 API-key integrations first.** They need no registration at all
   and cover the majority of the executable surface.
2. **Register OAuth apps on demand.** Availability is per integration, so a
   vendor can be promoted when a customer asks for it rather than up front.
3. **Use a broker for the long tail.** Plaid and Merge already work this way in
   this package: the broker holds the vendor relationships and the product holds
   one credential. `IntegrationConnectionLinkProvider` is the extension point,
   and adding a broker is one more member of that union rather than a new lane.
4. **Let a customer bring their own app** for vendors where they already have
   one. This shifts the cost rather than removing it, and it is a worse
   experience, so it suits enterprise tenants and not self-serve.

See `integrations-availability-promotion-checklist.md` for what promoting an
integration from `beta` requires.
