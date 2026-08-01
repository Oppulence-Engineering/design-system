---
name: integration-provider
description: Add a provider to @oppulence/integrations — map a SimStudio baseline provider's actions to an executable pack, wire it into the registry, and update the coverage gate. Use when asked to add, implement, or map an integration provider, close provider coverage, or work through the SimStudio parity backlog.
---

# Adding a provider to @oppulence/integrations

Work from `packages/integrations`. Every command below is run from there.

## The rule that decides everything

**Never write a request you are guessing at.** A wrong endpoint typechecks,
passes the pack contract, and reports as executable while failing against the
live API — strictly worse than leaving the provider deferred, because the
coverage gate then lies.

The pinned baseline (`src/generated/simstudio-baseline.json`) records only each
action's id, label, and description. It carries no endpoint, method, or
parameter data. So the request mapping must come from real knowledge of the
provider's API or from documentation in front of you.

If you do not have that for a provider, say so and leave it deferred. Deferring
is a normal outcome, not a failure.

## 1. Read the surface

```bash
bun run providers:plan <integration-id>      # actions, triggers, auth, strategy
bun run providers:coverage --remaining 20    # what is left, largest first
```

`providers:plan` prints every action id the pack must account for. That list is
the contract: a pack either maps an action or defers it with a reason.

## 2. Choose the lane

| Lane | When | Where |
|---|---|---|
| `sdk` | A maintained Node SDK covers the actions. **The default.** | `providers/<id>/index.ts` |
| `typed_rest` | No SDK, or the SDK omits these actions. Requires a recorded `sdkReview`. | same, via `createRestPack` |
| `special` | A protocol or driver, not HTTP — SQL, Redis, SSH. | same, via the protocol client |

Check `bun run providers:plan <id>` output for `strategy` and `package` — that
is the pinned execution-strategy map's opinion. It has been wrong before
(packages that do not exist, packages for a different product, official
packages that are empty stubs), so verify the package actually ships the
methods before committing to the SDK lane:

```bash
bun pm view <package> version
ls node_modules/<package>/dist/*.d.ts   # do the methods you need exist?
```

If the map is wrong, fix `src/execution-strategy.ts` in the same change and say
so in the commit message.

## 3. Write the pack

Create `src/server/providers/<integration-id>/index.ts`. One folder per
provider, no exceptions.

For the typed REST lane, `createRestPack` is the whole shape:

```ts
import { z } from "zod";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import { createRestPack, restQuery, restSegment, type RestAction } from "../shared/rest";

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "send-message",              // the id suffix from providers:plan
    name: "Send Message",
    description: "Posts a message to a channel.",
    method: "POST",
    url: (i) => `/channels/${restSegment(i.channelId)}/messages`,
    input: z.object({ channelId: z.string().min(1).max(24), text: z.string().max(2_000) }).strict(),
    body: (i) => ({ content: i.text }),
  },
];

export function createAcmePack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "acme",
    sdkReview: "Acme publishes no maintained Node SDK; its HTTP API is the supported integration surface.",
    transportKind: "api_key",           // or "oauth2" | "none"
    actions: ACTIONS,
    deferrals: {
      "send-event": "The Events API lives on a different host, and this lane resolves every action against one host.",
    },
  });
}
```

Points that matter:

- **Coverage is derived from the baseline**, so an action you forget shows up as
  deferred rather than vanishing. You do not hand-write a coverage list.
- **`restSegment` every caller value that becomes a path segment.** The lane
  refuses paths that leave the provider host, but a raw segment containing a
  slash still addresses a different resource.
- **`restQuery` drops undefined values**, so optional filters need no branching.
- **`.strict()` on every input schema.** An unknown key is a caller bug.
- **Bound every string and array** (`.max(...)`). Unbounded input reaches the
  provider verbatim.
- **`emptyResponse: true`** for 204s, so the output contract is `{ ok: true }`
  rather than a document that will not arrive.
- **`deferrals`** records *why* an action is unmapped. Without it the gate
  reports the generic "no request is mapped", which reads as an oversight.

Destructive and irreversible actions get explicit shapes: a delete-everything
flag rather than the effect of an omitted argument, drafts rather than live
publishes by default, and an audit-reason header wherever the provider records
one.

## 4. Register it — one place

Add the factory to `src/server/providers/registry.ts`:

```ts
import { createAcmePack } from "./acme";
// ...
export const BUILT_IN_PROVIDER_PACKS: readonly IntegrationProviderPack[] = [
  createAcmePack(),
  // ...
];
```

That is the only registration. The registry builder and the coverage gate both
read this list, so a pack cannot be executable without being coverage-checked.
Packs gate themselves on the runtimes they need — a pack whose runtime a
product has not configured returns no adapters — so there is no per-entry
wiring.

Then:

- **API-key or no-auth providers** need a transport profile in
  `src/server/runtime/api-key.ts`, naming the single host its relative paths
  resolve against. OAuth hosts come from product-side registration and need
  nothing here.
- **Export the factory** from `src/server/index.ts` (`tests/artifacts.test.ts`
  fails the build if a documented export goes missing).

## 5. Pin the wire shape

Coverage proves an action is *claimed*. It cannot prove the request is the one
the provider serves. Add at least one case per provider to
`tests/rest-wire.test.ts` — the test refuses a new typed REST provider that has
none:

```ts
{
  operationId: "acme:send-message",
  input: { channelId: "123", text: "hi" },
  method: "POST",
  path: "/channels/123/messages",
},
```

This is what catches a mis-typed route. Two of the three bugs found auditing
the first batch were wrong paths that every other check passed.

**If the credential belongs in the path, not a header** — Telegram's Bot API is
`/bot<token>/<method>` and rejects header auth — use `credentialPathPrefix` on
the profile instead of `credentialHeader`:

```ts
{
  integrationId: "telegram" as const,
  apiBaseUrl: "https://api.telegram.org",
  credentialPathPrefix: "/bot{credential}",
}
```

Supply one or the other, never both. The transport rejects a profile that sets
both, and rejects a key that would not stay a single path segment.

## 6. Update the pinned numbers

```bash
bun run providers:coverage
```

Copy the printed figures into `tests/coverage-gate.test.ts`
(`EXECUTABLE_PROVIDERS`, `EXECUTABLE_ACTIONS`, `report.providers`,
`report.deferredOperations`, the per-lane counts, `providersRemaining`,
`actionsRemaining`) and `tests/server.test.ts` (`executableProviders`,
`executableOperations`, and the API-key profile list — that list is
order-sensitive and must match `runtime/api-key.ts`).

If a comment next to a pinned number explains it — "only Google Maps defers" —
update the comment too, or it becomes false.

## 7. Verify, then commit

```bash
bun run format && bun run typecheck && bun test && bun run build && bun run lint
```

`bun run build` can fail `verify:artifacts` on its first run right after
`format`, because the check reads a stale `dist`. Re-run it once.

Root `bun run lint` also covers `@comp/example`, which has thousands of
pre-existing failures unrelated to this package. Check the integrations package
directly.

Commit per provider family. State the coverage delta, any strategy-map
correction, and every deferral with its reason.

## Reference

| Thing | Path |
|---|---|
| Pinned source of truth | `src/generated/simstudio-baseline.json` |
| Pack contract | `src/server/core/provider-pack.ts` |
| Typed REST executor | `src/server/core/provider-rest.ts` |
| REST pack builder | `src/server/providers/shared/rest.ts` |
| SDK helpers | `src/server/providers/shared/sdk.ts` |
| Family SDK clients | `src/server/providers/shared/clients/` |
| Pack list | `src/server/providers/registry.ts` |
| API-key host profiles | `src/server/runtime/api-key.ts` |
| Coverage gate | `tests/coverage-gate.test.ts` |
| Wire-shape cases | `tests/rest-wire.test.ts` |
