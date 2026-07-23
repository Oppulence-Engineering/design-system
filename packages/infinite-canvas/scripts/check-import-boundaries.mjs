#!/usr/bin/env node
// Import-boundary guard (grep-based; no eslint wiring exists in this repo to extend).
//
// Enforces two hard rules the plan depends on:
//   1. yjs isolation — no file reachable from a yjs-FREE entrypoint may import
//      yjs / y-protocols / @hocuspocus/*. Only files under src/collab/yjs/ may.
//      A leak breaks corinthian's transitive typecheck (it never installs yjs).
//   2. No `dangerouslySetInnerHTML` anywhere — document-derived strings must
//      render as escaped React text children only (§3c security invariant).
//
// Exits non-zero on violation so CI fails.

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");

/** Directory (relative to src) that is ALLOWED to import yjs. */
const YJS_ALLOWED_PREFIX = "collab/yjs";

const YJS_IMPORT = /from\s+["'](yjs|y-protocols|@hocuspocus\/[^"']+)["']/;
// Match ACTUAL usage (JSX attr / object property), not a "never do this" mention in a comment.
const DANGEROUS_HTML = /dangerouslySetInnerHTML\s*[=:]/;

/** @param {string} dir */
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

const violations = [];

for await (const file of walk(SRC)) {
  const rel = relative(SRC, file);
  const source = await readFile(file, "utf8");

  if (YJS_IMPORT.test(source) && !rel.startsWith(YJS_ALLOWED_PREFIX)) {
    violations.push(
      `yjs import outside src/${YJS_ALLOWED_PREFIX}/: src/${rel} — breaks corinthian's yjs-free typecheck`,
    );
  }
  if (DANGEROUS_HTML.test(source)) {
    violations.push(
      `dangerouslySetInnerHTML in src/${rel} — banned package-wide (untrusted document data)`,
    );
  }
}

if (violations.length > 0) {
  console.error(
    "Import-boundary violations:\n" +
      violations.map((v) => "  - " + v).join("\n"),
  );
  process.exit(1);
}
console.log("Import boundaries OK.");
