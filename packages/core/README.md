# @oppulence/core

Core utilities for the Solomon AI platform providing essential functionality for logging, error handling, cryptography, async context management, and system operations.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Error Handling (Result Types)](#error-handling-result-types)
- [Logging](#logging)
- [Cryptography](#cryptography)
- [Async Context (AsyncLocalStorage)](#async-context-asynclocalstorage)
- [Shutdown Management](#shutdown-management)
- [Utility Functions](#utility-functions)
- [Type Utilities](#type-utilities)
- [Schemas](#schemas)
- [API Reference](#api-reference)

## Installation

```bash
bun add @oppulence/core
# or
npm install @oppulence/core
# or
pnpm add @oppulence/core
```

## Quick Start

```typescript
import {
  // Error handling
  tryCatch,
  tryCatchSync,
  mapResult,
  isSuccess,

  // Logging
  Logger,
  createLogger,

  // Utilities
  debounce,
  throttle,
  memoize,
  sleep,
  deepMerge,

  // Crypto
  digestSHA256,
  hmacSHA256,
  generateRandomHex,

  // Shutdown
  shutdownManager,

  // Async context
  SafeAsyncLocalStorage,
} from "@oppulence/core";
```

## Error Handling (Result Types)

Go-style error handling using Result tuples `[Error | null, Data | null]`. This pattern makes error handling explicit and prevents unhandled exceptions.

### Basic Usage

```typescript
import { tryCatch, tryCatchSync, Result } from "@oppulence/core";

// Async operations
const [error, data] = await tryCatch(fetch("/api/users"));
if (error) {
  console.error("Request failed:", error.message);
  return;
}
console.log("Users:", data);

// Sync operations
const [parseError, json] = tryCatchSync(() => JSON.parse(rawString));
if (parseError) {
  console.error("Invalid JSON");
  return;
}
```

### With Timeout

```typescript
import { tryCatchWithTimeout } from "@oppulence/core";

// Automatically fails if operation takes longer than 5 seconds
const [error, data] = await tryCatchWithTimeout(
  fetch("/api/slow-endpoint"),
  5000, // timeout in ms
  new Error("Request timed out") // optional custom error
);
```

### With Abort Controller

```typescript
import { tryCatchWithAbort } from "@oppulence/core";

const controller = new AbortController();

// Cancel after 10 seconds
setTimeout(() => controller.abort(), 10000);

const [error, data] = await tryCatchWithAbort(
  fetch("/api/data", { signal: controller.signal }),
  controller.signal
);

if (error?.name === "AbortError") {
  console.log("Request was cancelled");
}
```

### Result Utilities

```typescript
import {
  mapResult,
  flatMapResult,
  isSuccess,
  isFailure,
  unwrapResult,
  unwrapResultOr,
  combineResults,
} from "@oppulence/core";

// Transform success values
const userResult = await tryCatch(fetchUser(id));
const nameResult = mapResult(userResult, (user) => user.name);

// Chain Result-returning operations
const profileResult = flatMapResult(userResult, (user) =>
  tryCatchSync(() => parseProfile(user.rawProfile))
);

// Type guards
if (isSuccess(result)) {
  console.log("Data:", result[1]); // TypeScript knows result[1] is not null
}

// Extract values
const user = unwrapResult(userResult); // throws if error
const userOrDefault = unwrapResultOr(userResult, defaultUser); // returns default if error

// Combine multiple results
const results = await Promise.all([
  tryCatch(fetchUser(1)),
  tryCatch(fetchUser(2)),
  tryCatch(fetchUser(3)),
]);
const [error, users] = combineResults(results);
if (error) {
  console.error("At least one fetch failed");
} else {
  console.log("All users:", users); // users is User[]
}
```

## Logging

Structured JSON logging with configurable levels, key masking, batching, and OpenTelemetry trace context support.

### Basic Usage

```typescript
import { Logger, createLogger } from "@oppulence/core";

// Create a logger
const logger = new Logger("my-service");
// or
const logger = createLogger("my-service");

// Log at different levels
logger.log("General message");
logger.info("Informational message", { userId: "123" });
logger.warn("Warning message", { threshold: 80 });
logger.error("Error occurred", { error: err });
logger.debug("Debug info", { query: sql });
logger.verbose("Verbose output", { trace: stack });
```

### Key Masking

Automatically mask sensitive data in logs:

```typescript
const logger = new Logger("auth", "info", ["password", "token", "apiKey"]);

logger.info("User login", {
  username: "john",
  password: "secret123",
  token: "abc123",
});
// Output: {"username":"john","password":"[FILTERED]","token":"[FILTERED]",...}
```

### Child Loggers

Create loggers with inherited context:

```typescript
const requestLogger = logger.child({
  requestId: "req-123",
  userId: "user-456",
});

// All logs include requestId and userId
requestLogger.info("Processing request");
requestLogger.info("Request complete", { duration: 150 });
```

### OpenTelemetry Trace Context

```typescript
import { trace } from "@opentelemetry/api";

const span = trace.getActiveSpan();
if (span) {
  const tracedLogger = logger.withTraceContext(span.spanContext());
  tracedLogger.info("Traced operation"); // Includes traceId, spanId
}
```

### Log Batching (High-Throughput)

For high-throughput scenarios, batch logs to reduce I/O overhead:

```typescript
const logger = new Logger("high-throughput");

logger.enableBatching({
  maxSize: 100, // Flush after 100 logs
  flushInterval: 1000, // Or flush every 1 second
});

// Logs are batched and written together
for (let i = 0; i < 1000; i++) {
  logger.info("Processing item", { index: i });
}

// Manually flush when needed
await logger.flush();

// Disable batching
logger.disableBatching();
```

## Cryptography

Secure cryptographic utilities with module caching for optimal performance.

### Hashing

```typescript
import { digestSHA256, digestSHA512 } from "@oppulence/core";

const hash256 = await digestSHA256("Hello, World!");
// Returns 64-character hex string

const hash512 = await digestSHA512("Hello, World!");
// Returns 128-character hex string
```

### HMAC Signing

```typescript
import { hmacSHA256, hmacSHA512 } from "@oppulence/core";

// Sign data with a secret key
const signature = await hmacSHA256("secret-key", "data-to-sign");

// Verify webhook signatures
const expectedSig = await hmacSHA256(webhookSecret, requestBody);
if (expectedSig === receivedSignature) {
  // Valid signature
}
```

### Random Generation

```typescript
import {
  generateRandomBytes,
  generateRandomHex,
  generateId,
} from "@oppulence/core";

const bytes = await generateRandomBytes(32); // Uint8Array
const hex = await generateRandomHex(16); // 32-character hex string
const id = await generateId(12); // URL-safe random ID
```

### Encoding Utilities

```typescript
import {
  bufferToHex,
  hexToBuffer,
  base64Encode,
  base64Decode,
  base64UrlEncode,
  base64UrlDecode,
} from "@oppulence/core";

// Hex encoding
const hex = bufferToHex(buffer);
const buffer = hexToBuffer(hex);

// Base64 encoding
const encoded = base64Encode("Hello");
const decoded = base64Decode(encoded);

// URL-safe Base64 (no padding, URL-safe chars)
const urlSafe = base64UrlEncode("Hello");
const original = base64UrlDecode(urlSafe);
```

### Secure Comparison

```typescript
import { constantTimeCompare } from "@oppulence/core";

// Timing-safe string comparison (prevents timing attacks)
if (constantTimeCompare(providedToken, storedToken)) {
  // Tokens match
}
```

## Async Context (AsyncLocalStorage)

Safe wrapper around Node.js AsyncLocalStorage for request-scoped context.

### Basic Usage

```typescript
import { SafeAsyncLocalStorage, createAsyncLocalStorage } from "@oppulence/core";

interface RequestContext {
  requestId: string;
  userId?: string;
  startTime: number;
}

const requestContext = new SafeAsyncLocalStorage<RequestContext>();
// or
const requestContext = createAsyncLocalStorage<RequestContext>();

// Set context for a scope
requestContext.runWith(
  { requestId: "req-123", startTime: Date.now() },
  async () => {
    // Context is available in all async operations
    await handleRequest();
  }
);

// Access context anywhere in the call chain
function logMessage(msg: string) {
  const ctx = requestContext.getStore();
  if (ctx) {
    console.log(`[${ctx.requestId}] ${msg}`);
  }
}
```

### Safe Access Methods

```typescript
// Get with default value
const ctx = requestContext.getStoreOrDefault({
  requestId: "unknown",
  startTime: 0,
});

// Get or throw (for required context)
try {
  const ctx = requestContext.getStoreOrThrow("Context required");
} catch (e) {
  // Handle missing context
}

// Check if context exists
if (requestContext.hasStore()) {
  const ctx = requestContext.getStore()!;
}
```

### Update Context

```typescript
requestContext.runWith(
  { requestId: "req-123", startTime: Date.now() },
  async () => {
    // Later, after authentication
    requestContext.update({ userId: "user-456" });

    // Context now has both requestId and userId
    const ctx = requestContext.getStore();
    // { requestId: 'req-123', startTime: ..., userId: 'user-456' }
  }
);
```

### Middleware Helper

```typescript
// Create middleware for Express/Koa-like frameworks
const withContext = requestContext.middleware((req: Request) => ({
  requestId: (req.headers["x-request-id"] as string) || generateId(),
  startTime: Date.now(),
}));

// Wrap handlers
app.get(
  "/api/users",
  withContext(async (req, res) => {
    const ctx = requestContext.getStore();
    // Context is automatically set
  })
);
```

### Exit Context

```typescript
requestContext.runWith({ requestId: "req-123" }, () => {
  console.log(requestContext.getStore()); // { requestId: 'req-123' }

  // Run code outside the context
  requestContext.exit(() => {
    console.log(requestContext.getStore()); // undefined
  });

  console.log(requestContext.getStore()); // { requestId: 'req-123' }
});
```

## Shutdown Management

Graceful shutdown handling with priority ordering and timeouts.

### Basic Usage

```typescript
import { shutdownManager, ShutdownManager } from "@oppulence/core";

// Register cleanup handlers
shutdownManager.register("database", async (signal) => {
  console.log(`Closing database (${signal})`);
  await database.close();
});

shutdownManager.register("cache", async () => {
  await cache.flush();
});

// Handlers run automatically on SIGTERM/SIGINT
```

### Priority and Timeout

```typescript
// Lower priority runs first
shutdownManager.register(
  "critical-cleanup",
  async () => {
    await flushLogs();
  },
  {
    priority: 0, // Runs first
    timeout: 5000, // 5 second timeout
  }
);

shutdownManager.register(
  "database",
  async () => {
    await database.close();
  },
  {
    priority: 10, // Runs after priority 0
    timeout: 10000, // 10 second timeout
  }
);

shutdownManager.register(
  "optional-cleanup",
  async () => {
    await sendMetrics();
  },
  {
    priority: 100, // Runs last
    timeout: 2000,
    signals: ["SIGTERM"], // Only on SIGTERM, not SIGINT
  }
);
```

### Manual Shutdown

```typescript
// Trigger shutdown manually
await shutdownManager.shutdown("SIGTERM");

// With options
await shutdownManager.shutdown("SIGTERM", {
  timeout: 30000, // Global timeout
  skipExit: true, // Don't call process.exit (useful for testing)
});
```

## Utility Functions

### Debounce

Collapse multiple calls into one:

```typescript
import { debounce } from "@oppulence/core";

const debouncedSave = debounce(saveDocument, 1000, {
  leading: false, // Don't execute on leading edge
  trailing: true, // Execute on trailing edge (default)
  maxWait: 5000, // Maximum time to wait
});

// Multiple rapid calls
debouncedSave(doc);
debouncedSave(doc);
debouncedSave(doc); // Only this executes after 1 second

// Control methods
debouncedSave.cancel(); // Cancel pending execution
debouncedSave.flush(); // Execute immediately
debouncedSave.pending(); // Check if execution is pending
```

### Throttle

Rate-limit function calls:

```typescript
import { throttle } from "@oppulence/core";

const throttledScroll = throttle(handleScroll, 100, {
  leading: true, // Execute on leading edge
  trailing: true, // Execute on trailing edge
});

window.addEventListener("scroll", throttledScroll);
// Executes at most once per 100ms
```

### Memoize

Cache function results:

```typescript
import { memoize, memoizeAsync } from "@oppulence/core";

// Sync memoization
const expensiveCalc = memoize(
  (n: number) => {
    // Complex calculation
    return fibonacci(n);
  },
  {
    maxSize: 100, // LRU cache size
    ttl: 60000, // Cache TTL in ms
  }
);

// Async memoization
const fetchUser = memoizeAsync(
  async (id: string) => {
    return await api.getUser(id);
  },
  {
    maxSize: 50,
    ttl: 300000, // 5 minutes
    resolver: (id) => id, // Custom cache key
  }
);

// Methods
expensiveCalc.clear(); // Clear cache
```

### Sleep

```typescript
import { sleep, sleepWithSignal, delay } from "@oppulence/core";

// Simple delay
await sleep(1000); // Wait 1 second

// Cancellable delay
const controller = new AbortController();
setTimeout(() => controller.abort(), 500);

try {
  await sleepWithSignal(1000, controller.signal);
} catch (e) {
  console.log("Sleep was cancelled");
}

// Delay with cleanup
const { promise, cancel } = delay(1000);
setTimeout(cancel, 500); // Cancel after 500ms
try {
  await promise;
} catch (e) {
  console.log("Delay was cancelled");
}
```

### Retry

```typescript
import { retry } from "@oppulence/core";

const result = await retry(
  async () => {
    const response = await fetch("/api/data");
    if (!response.ok) throw new Error("Request failed");
    return response.json();
  },
  {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2, // Exponential backoff
    shouldRetry: (error, attempt) => {
      // Custom retry logic
      return attempt < 3 && error.message !== "Not Found";
    },
  }
);
```

### Deep Merge

```typescript
import { deepMerge, deepMergeWithOptions, deepFreeze } from "@oppulence/core";

const defaults = {
  server: { host: "localhost", port: 3000 },
  logging: { level: "info" },
};

const overrides = {
  server: { port: 8080 },
  logging: { format: "json" },
};

const config = deepMerge(defaults, overrides);
// {
//   server: { host: 'localhost', port: 8080 },
//   logging: { level: 'info', format: 'json' }
// }

// With options
const merged = deepMergeWithOptions(defaults, overrides, {
  arrayMerge: "replace", // 'replace' | 'concat' | 'unique'
  clone: true, // Clone objects instead of mutating
});

// Deep freeze for immutability
const frozen = deepFreeze(config);
frozen.server.port = 9000; // TypeError in strict mode
```

### Deep Get/Set

```typescript
import { getDeep, setDeep } from "@oppulence/core";

const obj = { user: { profile: { name: "John" } } };

// Get nested value
const name = getDeep(obj, "user.profile.name"); // 'John'
const missing = getDeep(obj, "user.profile.age", 0); // 0 (default)

// Set nested value (returns new object)
const updated = setDeep(obj, "user.profile.age", 30);
// { user: { profile: { name: 'John', age: 30 } } }
```

### Pick and Omit

```typescript
import { pick, pickBy, omit } from "@oppulence/core";

const user = { id: 1, name: "John", password: "secret", role: "admin" };

// Pick specific keys
const public = pick(user, ["id", "name"]);
// { id: 1, name: 'John' }

// Pick by predicate
const strings = pickBy(user, (value) => typeof value === "string");
// { name: 'John', password: 'secret', role: 'admin' }

// Omit keys
const safe = omit(user, ["password"]);
// { id: 1, name: 'John', role: 'admin' }
```

### Singleton Pattern

```typescript
import { singleton } from "@oppulence/core";

// Create or retrieve singleton instance
const cache = singleton("app-cache", () => new Map());
const sameCache = singleton("app-cache", () => new Map());

console.log(cache === sameCache); // true
```

## Type Utilities

### Branded Types

Prevent mixing up values with the same underlying type:

```typescript
import { Brand, brand, UserId, TeamId, Email } from '@oppulence/core';

// Pre-defined branded types
const userId: UserId = brand<UserId>('user_123');
const teamId: TeamId = brand<TeamId>('team_456');
const email: Email = brand<Email>('john@example.com');

// Custom branded types
type OrderId = Brand<string, 'OrderId'>;
type SKU = Brand<string, 'SKU'>;

function getOrder(id: OrderId): Order { ... }

const orderId = brand<OrderId>('order_789');
getOrder(orderId); // OK
getOrder(userId);  // Type error!
```

### Deep Utility Types

```typescript
import {
  DeepPartial,
  DeepReadonly,
  DeepRequired,
  DeepMutable,
} from "@oppulence/core";

interface Config {
  server: {
    host: string;
    port: number;
    ssl: {
      enabled: boolean;
      cert: string;
    };
  };
}

// All nested properties optional
type PartialConfig = DeepPartial<Config>;

// All nested properties readonly
type ImmutableConfig = DeepReadonly<Config>;

// All nested properties required
type FullConfig = DeepRequired<Config>;

// Remove readonly from all nested properties
type MutableConfig = DeepMutable<ImmutableConfig>;
```

### Other Utility Types

```typescript
import {
  RequireKeys,
  PartialKeys,
  Prettify,
  Awaitable,
  MaybeArray,
  AsyncReturnType,
  KeysOfType,
  PickByType,
  OmitByType,
  JsonValue,
  Jsonify,
} from "@oppulence/core";

// Make specific keys required
type UserCreate = RequireKeys<User, "email" | "name">;

// Make specific keys optional
type UserUpdate = PartialKeys<User, "name" | "avatar">;

// Expand complex types for readability
type Expanded = Prettify<SomeComplexIntersection>;

// Value or Promise of value
type Handler = (req: Request) => Awaitable<Response>;

// Single or array
type Input = MaybeArray<string>; // string | string[]

// Get return type of async function
type UserData = AsyncReturnType<typeof fetchUser>;

// Get keys by value type
type StringKeys = KeysOfType<User, string>; // 'name' | 'email'

// JSON serialization type
type ApiResponse = Jsonify<InternalUser>; // Converts Date to string, removes functions
```

## Schemas

Zod schemas for common patterns:

```typescript
import {
  RetryOptionsSchema,
  RateLimitOptionsSchema,
  // ... other schemas
} from "@oppulence/core";

// Validate configuration
const config = RetryOptionsSchema.parse({
  maxAttempts: 3,
  initialDelay: 1000,
});
```

## API Reference

### Error Handling

| Function                                         | Description                          |
| ------------------------------------------------ | ------------------------------------ |
| `tryCatch<T, E>(promise)`                        | Wrap async operation in Result tuple |
| `tryCatchSync<T, E>(fn)`                         | Wrap sync operation in Result tuple  |
| `tryCatchWithTimeout<T, E>(promise, ms, error?)` | With timeout                         |
| `tryCatchWithAbort<T, E>(promise, signal)`       | With abort signal                    |
| `mapResult<T, U, E>(result, fn)`                 | Transform success value              |
| `flatMapResult<T, U, E>(result, fn)`             | Chain Result operations              |
| `isSuccess<T, E>(result)`                        | Type guard for success               |
| `isFailure<T, E>(result)`                        | Type guard for failure               |
| `unwrapResult<T, E>(result)`                     | Extract value or throw               |
| `unwrapResultOr<T, E>(result, default)`          | Extract value or default             |
| `combineResults<T, E>(results)`                  | Combine array of Results             |

### Logging

| Method                                                 | Description         |
| ------------------------------------------------------ | ------------------- |
| `new Logger(name, level?, maskedKeys?, replacer?)`     | Create logger       |
| `logger.log/info/warn/error/debug/verbose(msg, data?)` | Log at level        |
| `logger.child(context)`                                | Create child logger |
| `logger.withTraceContext(spanContext)`                 | Add trace context   |
| `logger.enableBatching(options)`                       | Enable log batching |
| `logger.disableBatching()`                             | Disable batching    |
| `logger.flush()`                                       | Flush batched logs  |

### Cryptography

| Function                        | Description         |
| ------------------------------- | ------------------- |
| `digestSHA256(data)`            | SHA-256 hash        |
| `digestSHA512(data)`            | SHA-512 hash        |
| `hmacSHA256(key, data)`         | HMAC-SHA256         |
| `hmacSHA512(key, data)`         | HMAC-SHA512         |
| `generateRandomBytes(length)`   | Random bytes        |
| `generateRandomHex(length)`     | Random hex string   |
| `generateId(length?)`           | Random URL-safe ID  |
| `constantTimeCompare(a, b)`     | Timing-safe compare |
| `base64Encode/Decode(data)`     | Base64 encoding     |
| `base64UrlEncode/Decode(data)`  | URL-safe Base64     |
| `bufferToHex/hexToBuffer(data)` | Hex encoding        |

### Utilities

| Function                       | Description            |
| ------------------------------ | ---------------------- |
| `debounce(fn, wait, options?)` | Debounce function      |
| `throttle(fn, wait, options?)` | Throttle function      |
| `memoize(fn, options?)`        | Memoize sync function  |
| `memoizeAsync(fn, options?)`   | Memoize async function |
| `sleep(ms)`                    | Promise-based delay    |
| `sleepWithSignal(ms, signal)`  | Cancellable delay      |
| `retry(fn, options?)`          | Retry with backoff     |
| `delay(ms)`                    | Delay with cancel      |
| `deepMerge(...objects)`        | Deep merge objects     |
| `deepFreeze(obj)`              | Deep freeze object     |
| `getDeep(obj, path, default?)` | Get nested value       |
| `setDeep(obj, path, value)`    | Set nested value       |
| `pick(obj, keys)`              | Pick object keys       |
| `pickBy(obj, predicate)`       | Pick by predicate      |
| `omit(obj, keys)`              | Omit object keys       |
| `singleton(key, factory)`      | Get/create singleton   |

### AsyncLocalStorage

| Method                       | Description          |
| ---------------------------- | -------------------- |
| `runWith(context, fn)`       | Run with context     |
| `run(context, fn)`           | Alias for runWith    |
| `enterWith(context)`         | Set context directly |
| `exit(fn)`                   | Run outside context  |
| `getStore()`                 | Get current context  |
| `getStoreOrDefault(default)` | Get or default       |
| `getStoreOrThrow(message?)`  | Get or throw         |
| `hasStore()`                 | Check if context set |
| `update(partial)`            | Update context       |
| `middleware(getContext)`     | Create middleware    |
| `disable()`                  | Disable storage      |

### Shutdown Manager

| Method                              | Description      |
| ----------------------------------- | ---------------- |
| `register(name, handler, options?)` | Register handler |
| `shutdown(signal, options?)`        | Trigger shutdown |

## Environment Variables

| Variable            | Description        |
| ------------------- | ------------------ |
| `TRIGGER_LOG_LEVEL` | Override log level |
| `NODE_ENV`          | Environment mode   |

## License

ISC
