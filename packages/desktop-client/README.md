# Canvas Desktop Client Package (`@oppulence/desktop-client`)

> Tauri desktop utilities for Canvas apps: platform detection, deep links, window management, and platform-aware styling.

[![TypeScript](https://img.shields.io/badge/TypeScript-blue)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB)](https://tauri.app/)
[![Zod](https://img.shields.io/badge/Zod-validation-3068B7)](https://zod.dev/)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Exports](#exports)
- [Quick Start](#quick-start)
- [Platform Detection](#platform-detection)
- [Deep Links](#deep-links)
- [Window Management](#window-management)
- [Tailwind Desktop Variants](#tailwind-desktop-variants)
- [Types and Schemas](#types-and-schemas)
- [Configuration](#configuration)
- [Development](#development)
- [Related Packages](#related-packages)
- [License](#license)

## Overview

`@oppulence/desktop-client` is a TypeScript-first wrapper around the Tauri v2 JS APIs
used by the Canvas desktop app. It provides a single, documented surface area
for:

- Detecting whether the runtime is a Tauri desktop environment
- Creating, validating, and handling deep links
- Managing the current window with safe result types
- Applying platform-specific styling via a Tailwind plugin
- Runtime validation for key payloads using Zod schemas

## Features

- Core Tauri API re-exports: `invoke`, `listen`, `emit`, `Window`, `getCurrentWindow`
- Typed event helpers for safer emit/listen patterns
- `WindowManager` singleton for common window operations:
  - window state, dimensions, centering, resizing, focus/visibility toggles
  - state-change listeners with structured payloads
- Deep link helpers:
  - validated deep link creation (`createDeepLink`)
  - deep link event subscription (`listenForDeepLinks`)
  - navigation events (`openDeepLink`)
- Utilities:
  - consistent logging and error normalization
  - result helpers (`Result<T>`) and type guards

## Installation

Already installed as part of the Canvas monorepo workspace:

```json
{
  "dependencies": {
    "@oppulence/desktop-client": "workspace:*"
  }
}
```

## Exports

The package has stable subpath exports:

| Import | Purpose |
| --- | --- |
| `@oppulence/desktop-client` | Everything (recommended for most consumers) |
| `@oppulence/desktop-client/core` | Tauri API re-exports and `WindowManager` |
| `@oppulence/desktop-client/platform` | Platform detection + deep links |
| `@oppulence/desktop-client/deep-links` | Alias of `platform` export |
| `@oppulence/desktop-client/desktop-variants` | Tailwind plugin + platform helpers |
| `@oppulence/desktop-client/types` | Zod schemas, types, and type guards |
| `@oppulence/desktop-client/utils` | Logger, error handling, and constants |

## Quick Start

### Platform Detection + Setup

```typescript
import { configureDesktopClient, isDesktopApp } from "@oppulence/desktop-client";

if (isDesktopApp()) {
  configureDesktopClient({
    debug: true,
    logLevel: "debug",
    deepLinksEnabled: true,
    deepLinkProtocol: "canvas",
  });
}
```

### Deep Links

```typescript
import {
  createDeepLink,
  listenForDeepLinks,
  openDeepLink,
} from "@oppulence/desktop-client";

const unsubscribe = await listenForDeepLinks((event) => {
  // event.url, event.path, event.params, event.timestamp
  console.log("Deep link:", event.path, event.params);
});

const link = createDeepLink("dashboard", { tab: "overview" });
if (link.success) {
  console.log("Link:", link.data); // "eigenn://dashboard?tab=overview"
}

await openDeepLink("settings/profile");

unsubscribe();
```

### Window Management

```typescript
import { WindowManager } from "@oppulence/desktop-client";

const windowManager = WindowManager.getInstance();
await windowManager.centerWindow();
```

### Tailwind Desktop Variants

```typescript
import desktopPlugin from "@oppulence/desktop-client/desktop-variants";

// tailwind.config.js
export default {
  plugins: [desktopPlugin()],
};
```

## Platform Detection

### `isDesktopApp()`

`isDesktopApp()` is the single source of truth for whether the code is running
inside a Tauri desktop runtime. It caches the result for performance.

```typescript
import { isDesktopApp } from "@oppulence/desktop-client";

if (!isDesktopApp()) {
  // Running in a web browser (or non-Tauri environment).
}
```

## Deep Links

Deep links are URLs of the form:

```text
<protocol>://<path>?<query>
```

The protocol is configurable (defaults to `canvas`), and paths are validated
against a schema to prevent malformed links from flowing through the app.

### Creating a deep link

```typescript
import { createDeepLink } from "@oppulence/desktop-client";

const link = createDeepLink("transactions/123", { focus: "true" });
if (!link.success) {
  console.error(link.error);
} else {
  console.log(link.data);
}
```

### Listening for deep links

`listenForDeepLinks()` registers a handler and returns an unsubscribe function.

```typescript
import { listenForDeepLinks } from "@oppulence/desktop-client";

const unsubscribe = await listenForDeepLinks((event) => {
  console.log(event.path);
});
```

## Window Management

### `WindowManager`

`WindowManager` wraps the current Tauri window and exposes a result-based API so
callers can handle failures without throwing.

```typescript
import { WindowManager } from "@oppulence/desktop-client";

const manager = WindowManager.getInstance();

const state = await manager.getWindowState();
if (state.success) {
  console.log("Focused?", state.data.isFocused);
}

const dims = await manager.getWindowDimensions();
if (dims.success) {
  console.log(dims.data.width, dims.data.height);
}
```

## Tailwind Desktop Variants

The package includes a Tailwind plugin that helps apply platform-specific
styling (macOS vs Windows vs Linux) in a consistent way.

```typescript
import desktopPlugin from "@oppulence/desktop-client/desktop-variants";

export default {
  plugins: [desktopPlugin()],
};
```

The plugin also exports helpers for runtime platform detection and CSS class
composition.

## Types and Schemas

`@oppulence/desktop-client/types` exports Zod schemas and inferred types for:

- Deep link URLs and events
- Desktop client config
- Window state and dimensions
- Common enums (`Platform`, `LogLevel`, etc.)

Example runtime validation:

```typescript
import { DesktopClientConfigSchema } from "@oppulence/desktop-client/types";

const config = DesktopClientConfigSchema.parse({
  debug: true,
  deepLinkProtocol: "canvas",
});
```

## Configuration

`configureDesktopClient()` updates the in-memory configuration used by deep
links and logging.

Fields:

- `debug` (boolean)
- `logLevel` ("debug" | "info" | "warn" | "error")
- `deepLinksEnabled` (boolean)
- `deepLinkProtocol` (string, default: "canvas")
- `maxRetries` (0..10)
- `timeout` (milliseconds)

## Development

From the repo root:

- `bun --filter @oppulence/desktop-client run typecheck`
- `bun --filter @oppulence/desktop-client run lint`

## Related Packages

- `@canvas/styles` - Shared styling used across clients

## License

Private - Oppulence Engineering
