/**
 * @module @oppulence/events/gate
 * @file Single source of truth for whether OpenPanel emission is allowed in
 *   the current runtime. Every server-side wrapper across the monorepo
 *   (corinthian-api, packages/worker, apps/web, workbench) imports from here
 *   so adjusting the rule once flips everything in lockstep.
 *
 * The rule: `OPENPANEL_ENVIRONMENT` names the deployment and decides first.
 * `production` sends; `staging` and `test` never send, even with the opt-in;
 * `development` sends only with the explicit opt-in. Without it,
 * `NODE_ENV=production` or the opt-in decides. Dev/test runs are no-ops by default so casual
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
  /**
   * The deployment environment (`OPENPANEL_ENVIRONMENT`). When set, it wins
   * over `isProduction` and over a staging/test opt-in: staging builds run
   * with `NODE_ENV=production` and must not write to production projects.
   */
  environment?: string;
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
  switch (input.environment) {
    case "production":
      return true;
    case "staging":
    case "test":
      // Staging and CI share production client ids and secrets; an opt-in
      // left in a secret must never route their traffic into production.
      return false;
    case "development":
      return input.explicitOptIn;
    case undefined:
    case "":
      return input.isProduction || input.explicitOptIn;
    default:
      // An unrecognized name (e.g. "preview") does not prove production.
      return false;
  }
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
  if (!globalThis.process?.env) {
    return false;
  }
  return isEmissionEnabled({
    isProduction: readRuntimeEnv("NODE_ENV") === "production",
    explicitOptIn: readRuntimeEnv("NEXT_PUBLIC_ENABLE_OPENPANEL") === "true",
    // `||`, not `??`: an empty private value must not hide a public one.
    environment:
      readRuntimeEnv("OPENPANEL_ENVIRONMENT") ||
      readRuntimeEnv("NEXT_PUBLIC_OPENPANEL_ENVIRONMENT") ||
      undefined,
  });
}

/**
 * Reads an environment variable when the code runs, not when it is built.
 *
 * Bundlers replace the literal `process.env.NODE_ENV` at build time. This
 * package is built once and published, so a folded value shipped
 * `isProduction: false` and `debug: true` to every production server.
 * Indexing through a binding keeps the read dynamic.
 *
 * @param name - Variable name.
 * @returns The value, or `undefined` outside Node.
 */
export function readRuntimeEnv(name: string): string | undefined {
  const env: Record<string, string | undefined> | undefined =
    globalThis.process?.env;
  return env?.[name];
}

/**
 * Env var name used as the explicit opt-in toggle on the server (Next.js,
 * Node services). Exported for docs/.env.example generation and for callers
 * that want to surface a CLI flag mapped to it.
 */
export const EMISSION_OPT_IN_ENV_VAR = "NEXT_PUBLIC_ENABLE_OPENPANEL" as const;
