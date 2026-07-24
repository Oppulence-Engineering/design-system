/**
 * @module @oppulence/events/gate
 * @file Single source of truth for whether OpenPanel emission is allowed in
 *   the current runtime. Every server-side wrapper across the monorepo
 *   (corinthian-api, packages/worker, apps/web, workbench) imports from here
 *   so adjusting the rule once flips everything in lockstep.
 *
 * The default rule: emit only when the runtime is production OR an explicit
 * opt-in flag is set. Dev/test runs are no-ops by default so casual
 * `bun run local` / `bun --filter X dev` sessions never burn through the
 * OpenPanel quota.
 */

/**
 * Inputs the gate decision depends on. Keep these primitive so the helper
 * works identically in Node.js (process.env), Next.js (`process.env`), and
 * Vite (`import.meta.env`) contexts.
 */
export interface EmissionGateInput {
  /** Whether the current build/runtime is production. */
  isProduction: boolean;
  /**
   * Whether the caller has explicitly opted in for this run. Use this to
   * temporarily enable emission in dev for validation (e.g. set
   * `NEXT_PUBLIC_ENABLE_OPENPANEL=true` before `bun run local`).
   */
  explicitOptIn: boolean;
}

/**
 * Returns true when OpenPanel events should actually be dispatched. False
 * means callers should return their no-op path.
 *
 * @example
 *   ```ts
 *   if (!isEmissionEnabled({ isProduction: process.env.NODE_ENV === "production", explicitOptIn: process.env.NEXT_PUBLIC_ENABLE_OPENPANEL === "true" })) {
 *     return; // no-op
 *   }
 *   ```
 */
export function isEmissionEnabled(input: EmissionGateInput): boolean {
  return input.isProduction || input.explicitOptIn;
}

/**
 * Node.js convenience: reads `process.env.NODE_ENV` and
 * `process.env.NEXT_PUBLIC_ENABLE_OPENPANEL` and applies the gate. Use this
 * from any Node-side wrapper (corinthian-api, worker, Next.js server).
 *
 * Vite/browser callers should use {@link isEmissionEnabled} directly and
 * pass `import.meta.env.PROD` and `import.meta.env.VITE_ENABLE_OPENPANEL`.
 */
export function isEmissionEnabledFromProcessEnv(): boolean {
  if (typeof process === "undefined") {
    return false;
  }
  return isEmissionEnabled({
    isProduction: process.env.NODE_ENV === "production",
    explicitOptIn: process.env.NEXT_PUBLIC_ENABLE_OPENPANEL === "true",
  });
}

/**
 * Env var name used as the explicit opt-in toggle on the server (Next.js,
 * Node services). Exported for docs/.env.example generation and for callers
 * that want to surface a CLI flag mapped to it.
 */
export const EMISSION_OPT_IN_ENV_VAR = "NEXT_PUBLIC_ENABLE_OPENPANEL" as const;
