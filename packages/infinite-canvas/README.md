# @oppulence/infinite-canvas

An infinite canvas spatial editor for **HTML/React designs** — real DOM artboards (not
vector graphics), a typed scene graph, layers, an inspector, undo/redo, and pluggable
real-time collaboration. Ships as raw TypeScript source; consumers own all storage.

Built for two consumers in `oppulence-canvas` (`apps/web`, `corinthian/corinthian-web`),
who persist documents through their own tRPC → Postgres stacks. The library exposes
serializable document types + change signals only.

## Install

```bash
bun add @oppulence/infinite-canvas
```

Peer dependencies: `react`/`react-dom` `^19`, `zustand` `^5`, `zod` `^4.3.5`. Optional
peers: `@oppulence/design-system` (`./panels` only), `tailwindcss`, and — only if you
import `./collab/yjs` — `yjs`, `y-protocols`, `@hocuspocus/provider`.

### Consumer checklist (Next.js)

1. `next.config`: add `"@oppulence/infinite-canvas"` to `transpilePackages` (it ships raw
   TS source).
2. Monorepo `bunfig.toml`: add it to `minimumReleaseAgeExcludes` (same PR as the dep) or
   installs hit the 3-day quarantine.
3. CSS: `import "@oppulence/infinite-canvas/styles.css"` once, and add
   `@source "../../../../node_modules/@oppulence/infinite-canvas/src";` to your Tailwind
   entry (the load-bearing canvas chrome ships in `styles.css`, but panel utilities need
   the `@source`).
4. Only if using `./panels`: install `@oppulence/design-system` and add it to
   `transpilePackages` + `@source`. Prefer `./headless` + your own chrome to skip this.

## Quick start

```tsx
"use client";
import { CanvasProvider, CanvasRoot } from "@oppulence/infinite-canvas";
import {
  CanvasLayersPanel,
  CanvasInspectorPanel,
  CanvasToolbar,
} from "@oppulence/infinite-canvas/panels";
import { migrateCanvasDocument } from "@oppulence/infinite-canvas/document";
import "@oppulence/infinite-canvas/styles.css";

export function Editor({
  raw,
  save,
}: {
  raw: unknown;
  save: (doc: unknown) => void;
}) {
  return (
    <CanvasProvider
      initialDocument={migrateCanvasDocument(raw)}
      storage={{ onDocumentChange: ({ getSnapshot }) => save(getSnapshot()) }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "16rem 1fr 18rem",
          height: "100dvh",
        }}
      >
        <CanvasLayersPanel />
        <div
          style={{
            position: "relative",
            display: "grid",
            gridTemplateRows: "auto 1fr",
          }}
        >
          <CanvasToolbar />
          <CanvasRoot />
        </div>
        <CanvasInspectorPanel />
      </div>
    </CanvasProvider>
  );
}
```

Loading is consumer-owned: fetch/parse the document yourself, render your own skeleton,
then mount `CanvasProvider` **keyed by document id**. Debounce your `onDocumentChange`
save (1.5–2s) and call `getSnapshot()` at flush time only.

## Entrypoints

| Import                       | Contents                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `@oppulence/infinite-canvas` | Provider, `CanvasRoot`, hooks, tools, registry, `CanvasApi`                                                   |
| `.../document`               | **Server-safe** (no React): document/op types, Zod schemas, `migrateCanvasDocument`, `sanitizeNode`           |
| `.../headless`               | Hooks with store-only deps (no design-system): `useLayerTree`, `useInspectorSections`, `useSelectionProps`, … |
| `.../panels`                 | Shipped UI: `CanvasLayersPanel`, `CanvasInspectorPanel`, `CanvasToolbar`                                      |
| `.../collab`                 | `CollabAdapter`/`PresenceAdapter` interfaces + `NullCollabAdapter`/`LocalPresenceAdapter` (**yjs-free**)      |
| `.../collab/yjs`             | `createYjsCanvasCollab` — the only entry that imports yjs/hocuspocus                                          |
| `.../agent`                  | AI op-authoring: LLM-friendly commands → validated op batches, JSON-Schema tool contracts, `describeCanvas`   |
| `.../export`                 | `exportToHtml` / `exportToReact` / PDF (`useCanvasExport`) — design → shippable code                          |
| `.../testing`                | `createLinkedAdapterPair`, `InMemoryCollabAdapter`, document factories (**yjs-free**)                         |
| `.../styles.css`             | Load-bearing canvas chrome                                                                                    |

## Capabilities

Beyond the editor, the package ships product-grade capabilities for AI/finance/invoicing use cases:

- **AI op-authoring** (`./agent`) — `useAgentAuthoring()` turns an LLM's high-level commands
  (`add-frame`/`add-text`/`add-component`/…) into validated, sanitized op batches. Hand the
  model `agentCommandsJsonSchema()` as a tool and `describeCanvas()` as context; it builds
  and edits designs. Guardrailed by the same sanitize boundary as human edits.
- **Data-binding → templates** — text/attrs/props hold `{{ path | filter }}` expressions;
  pass `data` to `CanvasProvider` and the design renders live (currency/number/date filters
  built in). Design an invoice once, render it per-customer.
- **Export** (`./export`) — real HTML (`exportToHtml`), a React component
  (`exportToReact`, components stay real), or PDF via native print. Directly usable for
  Conduitt invoice PDFs.
- **Review comments** — `useComments()` + canvas-anchored pins with replies/resolve,
  consumer-persisted (`initialComments`/`onCommentsChange`).
- **Block/template library** — `useBlockLibrary()` saves a selection as a reusable,
  id-remappable block; a shared library of invoice sections / dashboard cards.
- **Responsive** — `<ResponsivePreview>` shows an artboard reflowing at multiple widths.
- **Insert palette** — `<CanvasPalette>` drops frames/text/images/registered components.
- **A11y lint** — `useDesignLint()` / `lintDocument()` flag WCAG contrast, missing alt,
  small fonts.

Every capability is demonstrated in Storybook under **Canvas/** with browser play tests.

## Collaboration

Single-player by default. For multiplayer, pass a `CollabAdapter`:

```tsx
import { createYjsCanvasCollab } from "@oppulence/infinite-canvas/collab/yjs";

const { collab, presence } = useMemo(
  () => createYjsCanvasCollab(config),
  [config.documentName, config.hocuspocusUrl], // NOT the whole config object (avoids reconnect flap)
);
<CanvasProvider collab={collab} presence={presence} self={me} /* … */ />;
```

`getToken` must be a stable callback that fetches a fresh ticket on demand. In Yjs mode
the Hocuspocus server's CRDT bytea is authoritative; JSON `onDocumentChange` saves are a
derived read-model. Corinthian (no CRDT infra) implements `PresenceAdapter` only over its
own transport and keeps `NullCollabAdapter`.

## Security

Documents are **untrusted** (in collab, other users author them). `sanitizeNode` runs at
every boundary (local apply, remote apply, JSON load): finite-number guard, prototype-
pollution guard (by shape, all namespaces), a `style.custom` CSS allow/deny-list, an
`attrs` allowlist + URL-scheme allowlist, and per-node bounds. All document strings render
as escaped React text; raw HTML injection is banned package-wide (lint-enforced).

**Consumer responsibility:** component **prop values** are untrusted data — a registered
component must never interpolate a prop into an `href` or raw HTML.

## v1 limitations & non-goals

- **Leaf components only** in the registry — serializable props, no `children`/ReactNode/
  function props (a `slots` design is reserved for a later schema version).
- **No rotation** (schema reserves the field), no image export (data/JSON export only),
  no rulers/align-distribute, plain text (no rich text).
- Flow-child drag is reorder-only in v1; reparent via the layers panel.
- Interactive HTML tags (`input`/`iframe`/`script`/`base`/`meta`) are excluded.
- Library chrome strings are English-only.

## Development

```bash
bun run --filter @oppulence/infinite-canvas test        # vitest
bun run --filter @oppulence/infinite-canvas typecheck
bun run --filter @oppulence/infinite-canvas lint        # prettier + import-boundary guard
```

License: MIT.
