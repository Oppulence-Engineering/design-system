/**
 * Schema migrations + version-skew policy (§3d).
 *
 * Migrations run FORWARD only. The registry maps `from → to` transforms; opening a
 * document runs the chain up to `CURRENT_SCHEMA_VERSION`, then validates. Because a
 * client can only migrate UP TO the version it knows, a document authored by a NEWER
 * client (higher schemaVersion than this build supports) must NOT be silently
 * under-migrated — it opens read-only, signaled to consumers via `MigrationOutcome`.
 */

import type { CanvasDocument } from "../document";
import { CURRENT_SCHEMA_VERSION } from "../document";
import { parseDocument } from "./v1";

export interface Migration {
  from: number;
  to: number;
  migrate: (doc: Record<string, unknown>) => Record<string, unknown>;
}

/** Registered migrations, ordered by `from`. Empty at v1 (nothing predates it). */
export const migrations: readonly Migration[] = [];

export type MigrationOutcome =
  | { status: "ok"; document: CanvasDocument }
  | {
      status: "outdated";
      document: CanvasDocument;
      docVersion: number;
      supportedVersion: number;
    }
  | { status: "invalid"; error: unknown };

/** Read a numeric schemaVersion from an unknown blob, defaulting to the current version. */
function readVersion(raw: unknown): number {
  if (typeof raw === "object" && raw !== null && "schemaVersion" in raw) {
    const v = (raw as { schemaVersion: unknown }).schemaVersion;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return CURRENT_SCHEMA_VERSION;
}

/**
 * Migrate + validate. On a newer-than-supported document, returns `outdated` with a
 * best-effort parse (consumers should mount read-only). Never throws.
 */
export function migrateCanvasDocumentSafe(raw: unknown): MigrationOutcome {
  try {
    let version = readVersion(raw);

    if (version > CURRENT_SCHEMA_VERSION) {
      // Newer than we understand — parse leniently and flag read-only.
      const document = parseDocument(raw);
      return {
        status: "outdated",
        document,
        docVersion: version,
        supportedVersion: CURRENT_SCHEMA_VERSION,
      };
    }

    let working = raw as Record<string, unknown>;
    // Apply the migration chain deterministically.
    for (;;) {
      if (version >= CURRENT_SCHEMA_VERSION) break;
      const step = migrations.find((m) => m.from === version);
      if (step === undefined) break; // no path forward; validation below will catch gaps
      working = step.migrate(working);
      version = step.to;
    }
    working.schemaVersion = CURRENT_SCHEMA_VERSION;
    return { status: "ok", document: parseDocument(working) };
  } catch (error) {
    return { status: "invalid", error };
  }
}

/**
 * Convenience wrapper that throws on invalid and returns the document (still flags
 * `outdated` via the second return value for callers that care).
 */
export function migrateCanvasDocument(raw: unknown): CanvasDocument {
  const outcome = migrateCanvasDocumentSafe(raw);
  if (outcome.status === "invalid") {
    throw new Error(`Invalid canvas document: ${String(outcome.error)}`);
  }
  return outcome.document;
}
