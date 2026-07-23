# Consumer integration (oppulence-canvas)

The wiring below must be applied **after `@oppulence/infinite-canvas` is published to
npm** — adding the dependency / `transpilePackages` / `@source` entries before the
package resolves would break the consumer builds (apps/web's `next.config.mjs` explicitly
warns that every `transpilePackages` entry must exist at runtime for the standalone
output). One change is already staged because it is inert until the package is a
dependency:

- ✅ **`bunfig.toml`** — `@oppulence/infinite-canvas` added to `minimumReleaseAgeExcludes`
  (so the first install isn't blocked by the 3-day quarantine).

## Remaining steps (post-publish)

### 1. Add the dependency (both apps)

```jsonc
// apps/web/package.json  AND  corinthian/corinthian-web/package.json
"dependencies": {
  "@oppulence/infinite-canvas": ">=0.1.0 <1.0.0"
}
```

Then `bun install`. apps/web must also add the yjs stack as **direct** deps only if it
uses `./collab/yjs` (they already exist transitively via Plate):

```jsonc
"yjs": "^13.6.31", "y-protocols": "^1.0.7", "@hocuspocus/provider": "^3.4.4"
```

### 2. transpilePackages

```js
// apps/web/next.config.mjs  (~line 115, in the transpilePackages array)
"@oppulence/infinite-canvas",

// corinthian/corinthian-web/next.config.ts  (~line 289)
"@oppulence/infinite-canvas",
```

### 3. Tailwind `@source` + styles import

```css
/* apps/web + corinthian/corinthian-web globals.css */
@source "../../../../node_modules/@oppulence/infinite-canvas/src";
```

```ts
// once, in the app's root layout or a client entry:
import "@oppulence/infinite-canvas/styles.css";
```

corinthian additionally needs, if it uses the shipped `./panels` (which pull in
`@oppulence/design-system`):

```css
@source "../../../../node_modules/@oppulence/design-system/src";
```

…or skip `./panels` entirely and build app-local chrome on `./headless` (the
recommended corinthian path — no design-system adoption required).

### 4. Usage

See the package README quick-start. Loading is consumer-owned: fetch the document via
your own tRPC, render a skeleton, then mount `<CanvasProvider initialDocument={...}
key={documentId}>`.

## Backend (apps/web multiplayer, P3)

Filed as tickets against the oppulence-canvas backend (see the plan §10 ledger):

1. `documents.type` pgEnum: `ALTER TYPE ... ADD VALUE 'canvas'` (a canvas is a
   `documents` row; `yjs_documents` FKs to it).
2. Creation-time server-side Y.Doc seeding endpoint (avoids the client seed race).
3. Withhold `comment`-access tickets for canvas docs until a canvas-aware comment
   classifier exists (the current Slate classifier fails open for canvas bodies).
