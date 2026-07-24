# Canvas Events Package

> **Comprehensive event tracking and analytics system for Canvas platform**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![OpenPanel](https://img.shields.io/badge/OpenPanel-1.0-purple)](https://openpanel.dev/)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Event Types](#event-types)
- [Usage Examples](#usage-examples)
- [Server-Side Analytics](#server-side-analytics)
- [Client-Side Analytics](#client-side-analytics)
- [API Reference](#api-reference)

## Overview

The Canvas Events package provides a comprehensive event tracking and analytics system for the Canvas platform. It supports both server-side and client-side tracking with OpenPanel integration, event batching, consent management, and comprehensive event definitions.

### Key Benefits

- ✅ **Dual-Mode** - Server-side and client-side tracking
- ✅ **Type-Safe** - Full TypeScript with event definitions
- ✅ **OpenPanel Integration** - Built-in OpenPanel support
- ✅ **Event Registry** - Pre-defined events for all Canvas features
- ✅ **Consent Management** - GDPR-compliant consent handling
- ✅ **Batching** - Efficient event batching and queuing
- ✅ **Error Tracking** - Built-in error and performance tracking

## Features

### Core Capabilities

- **Event Tracking**: Track user actions, system events, and business metrics
- **Event Registry**: Pre-defined events for authentication, banking, transactions, etc.
- **Server Analytics**: Server-side tracking with OpenPanel
- **Client Analytics**: React hooks and components for client-side tracking
- **Event Batching**: Batch events for efficient transmission
- **Consent Management**: Handle user consent for tracking
- **Error Tracking**: Automatic error capture and tracking
- **Performance Tracking**: Track operation performance metrics

### Event Categories

- **Authentication**: Sign in, sign out, registration
- **Banking**: Bank connections, account sync, transactions
- **Transactions**: Import, export, categorization
- **Inbox**: Email processing, matching
- **Vault**: Document operations
- **Support**: Support interactions

## Installation

Already installed as part of the Canvas monorepo workspace:

```json
{
  "dependencies": {
    "@oppulence/events": "workspace:*"
  }
}
```

## Three-App Integration (RFC-025)

This package is wired into three surfaces. The pattern differs by framework
but the **event registry is shared** so OpenPanel sees the same event names
everywhere.

### `apps/web` and `corinthian/corinthian-web` (Next.js)

Both apps mount the React provider via `@oppulence/events/client` inside a
cookie-consent gate, identify on session, and inherit consent semantics from
`@canvas/cookie-consent`.

Provider tree:

```
RootLayout
└─ CookieConsentProvider                (existing)
   └─ AuthProvider                       (existing)
      └─ OpenPanelProvider               (this package, via local wrapper)
         ├─ AnalyticsUserTracker         (calls useAnalyticsIdentify)
         └─ {children}
```

Each app has its **own** OpenPanel project. Env vars are namespaced by app so
the values cannot accidentally be shared across products.

`apps/web` (Canvas / Eigenn):

```env
NEXT_PUBLIC_CANVAS_OPENPANEL_CLIENT_ID=client_xxx
CANVAS_OPENPANEL_SECRET_KEY=secret_xxx        # server-side only
NEXT_PUBLIC_ENABLE_OPENPANEL=true             # non-prod opt-in
```

`corinthian-web`:

```env
NEXT_PUBLIC_CORINTHIAN_OPENPANEL_CLIENT_ID=client_xxx
NEXT_PUBLIC_ENABLE_OPENPANEL=true             # non-prod opt-in
```

`corinthian-workbench` (Vite SPA):

```env
VITE_WORKBENCH_OPENPANEL_CLIENT_ID=client_xxx
```

Server-side callers in apps/web go through `setupCanvasAnalytics()`
(`apps/web/src/lib/analytics-server.ts`) which forwards the validated
`CANVAS_*` keys via `clientConfig`. Do not call `setupAnalytics()` directly in
apps/web — use the wrapper so the Canvas project keys are guaranteed.

When the namespaced client ID is unset, the provider mounts under a
placeholder ID with `enabled=false` so `useAnalytics()` consumers never throw
and no network traffic fires.

### `corinthian-web` PostHog bridge

`corinthian-web` historically used a local singleton at `@/hooks/use-analytics`
that fed PostHog. As of RFC-025 the singleton is a fan-out — multiple
subscribers receive each event. The two subscribers wired today:

1. `PostHogRuntimeProvider` → `posthog.capture(...)` (unchanged)
2. `CanvasEventsBridge` → `@oppulence/events` `analytics.track(...)` (new)

The bridge resolves the event name against `LogEvents` so registry-tagged
events carry the correct channel into OpenPanel; unrecognized events still
fire under the `general` channel.

This means **every existing `useAnalytics().capture(...)` call site
automatically flows to OpenPanel** without per-site changes.

### `corinthian/corinthian-workbench` (Vite SPA)

Workbench is a TanStack Router SPA bundled as a library — it cannot import
`@oppulence/events/client` because that module depends on `next/script`. Instead
it imports the framework-agnostic `@openpanel/web` SDK directly and reuses
**only the pure-TS `LogEvents` constants** from `@oppulence/events/events`.

See `corinthian/corinthian-workbench/src/ui/lib/analytics.ts` for the wrapper
and the workbench README for required env vars (`VITE_OPENPANEL_CLIENT_ID`).

### Identify hook

`@oppulence/events/identity` exposes `useAnalyticsIdentify({ user, organization })`
which dedupes by `userId:organizationId` so it only fires once per
user/team pairing. Each Next.js app mounts a small wrapper component
(`AnalyticsUserTracker`) that pulls user state from its own auth store and
feeds the hook:

```tsx
"use client";
import { useAnalyticsIdentify } from "@oppulence/events/identity";

export function AnalyticsUserTracker() {
  const user = useAuthValue("user");
  useAnalyticsIdentify({
    user: user ? { id: user.id, email: user.email, name: user.username } : null,
  });
  return null;
}
```

## Quick Start

### Server-Side Tracking

```typescript
import { setupAnalytics, AuthenticationEvents } from '@oppulence/events';

// Setup analytics
const analytics = await setupAnalytics({
  userId: user.id,
  email: user.email,
});

// Track authentication event
await analytics.track({
  event: AuthenticationEvents.SignIn.name,
  properties: {
    method: 'email',
    provider: 'google',
  },
});
```

### Client-Side Tracking

```typescript
import { AnalyticsProvider, useAnalytics } from '@oppulence/events';

// Wrap app with provider
function App() {
  return (
    <AnalyticsProvider
      config={{
        userId: user.id,
        email: user.email,
      }}
    >
      <YourApp />
    </AnalyticsProvider>
  );
}

// Use in components
function MyComponent() {
  const analytics = useAnalytics();

  const handleClick = () => {
    analytics.track({
      event: 'Button Clicked',
      properties: { buttonId: 'submit' },
    });
  };

  return <button onClick={handleClick}>Submit</button>;
}
```

## Event Types

### Authentication Events

```typescript
import { AuthenticationEvents } from '@oppulence/events';

// Sign in
await analytics.track({
  event: AuthenticationEvents.SignIn.name,
  properties: { method: 'email' },
});

// Sign out
await analytics.track({
  event: AuthenticationEvents.SignOut.name,
});

// Registration
await analytics.track({
  event: AuthenticationEvents.Registered.name,
  properties: { source: 'website' },
});
```

### Banking Events

```typescript
import { BankingEvents } from '@oppulence/events';

// Bank connection completed
await analytics.track({
  event: BankingEvents.ConnectBankCompleted.name,
  properties: {
    provider: 'plaid',
    accountCount: 3,
  },
});

// Bank connection failed
await analytics.track({
  event: BankingEvents.ConnectBankFailed.name,
  properties: {
    provider: 'plaid',
    error: 'Connection timeout',
  },
});
```

### Transaction Events

```typescript
import { TransactionEvents } from '@oppulence/events';

// Export transactions
await analytics.track({
  event: TransactionEvents.ExportTransactions.name,
  properties: {
    format: 'csv',
    count: 150,
  },
});

// Import transactions
await analytics.track({
  event: TransactionEvents.ImportTransactions.name,
  properties: {
    source: 'csv',
    count: 50,
    success: true,
  },
});
```

## Usage Examples

### Preset Trackers

```typescript
import {
  AuthTracker,
  BankingTracker,
  TransactionTracker,
} from '@oppulence/events';

const authTracker = new AuthTracker(analytics);
const bankingTracker = new BankingTracker(analytics);
const transactionTracker = new TransactionTracker(analytics);

// Use preset methods
await authTracker.signIn({ userId: 'user-123', method: 'email' });
await bankingTracker.connectCompleted({ provider: 'plaid', accountCount: 3 });
await transactionTracker.export({ format: 'csv', count: 150 });
```

### Error Tracking

```typescript
import { captureError } from '@oppulence/events';

try {
  await riskyOperation();
} catch (error) {
  await captureError(analytics, error, {
    operation: 'riskyOperation',
    context: { userId: 'user-123' },
  });
}
```

### Performance Tracking

```typescript
import { trackPerformance } from '@oppulence/events';

const start = performance.now();
await heavyOperation();
const duration = performance.now() - start;

await trackPerformance(analytics, 'heavyOperation', duration, {
  itemCount: 1000,
});
```

### Event Batching

```typescript
import { EventQueue, createEventBatch } from '@oppulence/events';

const queue = new EventQueue({
  batchSize: 10,
  flushInterval: 5000,
});

// Queue events
queue.enqueue({
  event: 'Page Viewed',
  properties: { page: '/dashboard' },
});

// Flush manually
await queue.flush();
```

### Consent Management

```typescript
import { ConsentManager } from '@oppulence/events';

const consentManager = new ConsentManager();

// Check consent
if (await consentManager.hasConsent(userId)) {
  await analytics.track({ event: 'User Action' });
}

// Update consent
await consentManager.updateConsent(userId, {
  analytics: true,
  marketing: false,
});
```

## Server-Side Analytics

### Setup

```typescript
import { setupAnalytics, ServerAnalytics } from '@oppulence/events';

// Simple setup
const analytics = await setupAnalytics({
  userId: user.id,
  email: user.email,
});

// Advanced setup
const analytics = new ServerAnalytics({
  userId: user.id,
  email: user.email,
  apiKey: process.env.OPENPANEL_API_KEY,
  projectId: process.env.OPENPANEL_PROJECT_ID,
  batchSize: 10,
  flushInterval: 5000,
});
```

### Middleware

```typescript
import { analyticsMiddleware } from '@oppulence/events';

// Express middleware
app.use(analyticsMiddleware({
  getUserId: (req) => req.user?.id,
  getEmail: (req) => req.user?.email,
}));
```

## Client-Side Analytics

### Provider Setup

```typescript
import { AnalyticsProvider } from '@oppulence/events';

function App() {
  return (
    <AnalyticsProvider
      config={{
        userId: user.id,
        email: user.email,
        apiKey: process.env.NEXT_PUBLIC_OPENPANEL_API_KEY,
        projectId: process.env.NEXT_PUBLIC_OPENPANEL_PROJECT_ID,
      }}
    >
      <YourApp />
    </AnalyticsProvider>
  );
}
```

### Hook Usage

```typescript
import { useAnalytics } from '@oppulence/events';

function MyComponent() {
  const analytics = useAnalytics();

  useEffect(() => {
    analytics.track({
      event: 'Page Viewed',
      properties: { page: '/dashboard' },
    });
  }, []);

  return <div>Content</div>;
}
```

### HOC Usage

```typescript
import { withAnalytics } from '@oppulence/events';

const TrackedComponent = withAnalytics(MyComponent, {
  trackOnMount: true,
  event: 'Component Mounted',
});
```

## API Reference

### Event Definitions

```typescript
import {
  AuthenticationEvents,
  BankingEvents,
  TransactionEvents,
  VaultEvents,
  InboxEvents,
  SupportEvents,
} from '@oppulence/events';

// Get event definition
const eventDef = getEventDefinition('auth.sign_in');
// { name: 'auth.sign_in', category: 'authentication', ... }
```

### Event Registry

```typescript
import { LogEvents, getEventsByChannel, getEventsBySeverity } from '@oppulence/events';

// Get all events
const allEvents = LogEvents;

// Filter by channel
const analyticsEvents = getEventsByChannel('analytics');

// Filter by severity
const errorEvents = getEventsBySeverity('error');
```

### Utilities

```typescript
import {
  createEventMetadata,
  enrichEventWithContext,
  getDeviceContext,
  sanitizeProperties,
} from '@oppulence/events';

// Create metadata
const metadata = createEventMetadata({
  source: 'web',
  version: '1.0.0',
});

// Enrich with context
const enriched = enrichEventWithContext(event, {
  userId: 'user-123',
  sessionId: 'session-456',
});

// Get device context
const device = getDeviceContext();
// { userAgent, screen, language, ... }
```

## Configuration

### Environment Variables

Vars are namespaced **per app** so each surface points at its own OpenPanel
project. The generic `NEXT_PUBLIC_OPENPANEL_CLIENT_ID` / `OPENPANEL_SECRET_KEY`
names are still honored by `setupAnalytics()` as a last-resort fallback when
no `clientConfig` is passed, but app code should never rely on them.

```env
# apps/web (Canvas / Eigenn)
NEXT_PUBLIC_CANVAS_OPENPANEL_CLIENT_ID=client_xxx
CANVAS_OPENPANEL_SECRET_KEY=secret_xxx

# corinthian-web
NEXT_PUBLIC_CORINTHIAN_OPENPANEL_CLIENT_ID=client_xxx

# corinthian-workbench (Vite)
VITE_WORKBENCH_OPENPANEL_CLIENT_ID=client_xxx

# Shared toggle (any Next.js app)
NEXT_PUBLIC_ENABLE_OPENPANEL=true             # opt-in outside production
```

### Analytics Config

```typescript
interface AnalyticsConfig {
  userId?: string;
  email?: string;
  apiKey?: string;
  projectId?: string;
  batchSize?: number;
  flushInterval?: number;
  debug?: boolean;
  trackInDevelopment?: boolean;
}
```

## Related Packages

- `@canvas/db` - Database for storing events
- `@canvas/logger` - Logging integration

## License

Private - Oppulence Engineering

---

**Built with ❤️ by Oppulence Engineering**

*Comprehensive event tracking and analytics for the Canvas platform.*
