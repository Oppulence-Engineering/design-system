/**
 * Loads an optional vendor SDK at runtime, out of reach of bundlers.
 *
 * Every provider here reaches its SDK through a lazy `require` that runs only
 * when that integration is actually invoked. `createRequire` is the right
 * mechanism, but a literal specifier still gets statically resolved: bundlers
 * treat `someRequire("docusign-esign")` as a dependency edge and follow it,
 * even with `--packages=external`, because the call is indistinguishable from
 * a real import at parse time.
 *
 * That turns a vendor's packaging problem into a consumer's build failure. Two
 * of ours already do:
 *
 * - `docusign-esign` ships a malformed UMD header,
 *   `define([undefined, './ApiClient'], factory)`, which bundlers refuse to
 *   parse.
 * - `confluence.js` and `trello.js` are ESM-only — no `require` condition in
 *   their `exports` map — so a CommonJS require cannot load them at all.
 *
 * Routing the specifier through a variable keeps the call dynamic, so the
 * module graph stops at this file and the SDK is resolved by Node when (and
 * only when) the integration runs.
 *
 * @module server/providers/shared/optional-sdk
 */

import { createRequire } from "node:module";

const requireFromHere = createRequire(import.meta.url);

/**
 * Requires a vendor SDK by name.
 *
 * @param specifier - Package name, passed as a value so it stays opaque to
 *   static analysis.
 * @returns The SDK's module exports.
 * @throws {Error} Whatever Node throws when the package is absent or cannot be
 *   loaded, at the point of use rather than at import time.
 */
export function requireOptionalSdk<T = unknown>(specifier: string): T {
  // Indirection is deliberate: passing the parameter (never a literal) is what
  // keeps bundlers from resolving the dependency at build time.
  return requireFromHere(specifier) as T;
}

/**
 * Imports an ESM-only vendor SDK.
 *
 * Some SDKs (`confluence.js`, `trello.js`) declare only an `import` condition
 * in their `exports` map, so `require` cannot load them from any directory --
 * it fails with ERR_PACKAGE_PATH_NOT_EXPORTED regardless of how resolution is
 * configured. A dynamic import is the only way in, and it keeps the same
 * load-on-use behaviour.
 *
 * @param specifier - Package name, passed as a value so it stays opaque to
 *   static analysis.
 * @returns The SDK's module namespace.
 * @throws {Error} Whatever Node throws when the package is absent or cannot be
 *   loaded, at the point of use rather than at import time.
 */
export async function importOptionalSdk<T = unknown>(
  specifier: string,
): Promise<T> {
  // The indirection through a variable matters here too: a literal would let a
  // bundler pull the SDK into the module graph and parse it at build time.
  return (await import(specifier)) as T;
}

/**
 * Wraps an async client build behind a synchronous facade.
 *
 * Client factories are synchronous by contract, but an ESM-only SDK can only
 * be reached by `await import()`. Rather than make every factory async — which
 * would ripple through every provider and force callers to await a value that
 * is usually already resolved — the returned object defers to the real client
 * on first method call.
 *
 * Only method access is modelled, which is all the SDK dispatcher does: it
 * walks a dotted path and calls the leaf. Property reads that are not calls
 * would need the client to already exist, and no operation does that.
 *
 * @param build - Resolves the real client, called at most once.
 * @returns A stand-in that forwards calls to the built client.
 */
export function lazyAsyncClient<T extends object>(build: () => Promise<T>): T {
  let pending: Promise<T> | null = null;
  const client = () => {
    pending ??= build();
    return pending;
  };

  const wrap = (path: readonly string[]): unknown =>
    new Proxy(function () {} as unknown as Record<string, unknown>, {
      get: (_target, key: string) =>
        // `then` must not be forwarded: an accidental await on this facade
        // would otherwise treat it as a thenable and resolve to something
        // other than the client.
        key === "then" ? undefined : wrap([...path, key]),
      apply: async (_target, _thisArg, args: unknown[]) => {
        const resolved = (await client()) as Record<string, unknown>;
        let receiver: unknown = resolved;
        let current: unknown = resolved;

        for (const key of path) {
          receiver = current;
          current = (current as Record<string, unknown>)[key];
        }

        return (current as (...callArgs: unknown[]) => unknown).apply(
          receiver,
          args,
        );
      },
    });

  return wrap([]) as T;
}
