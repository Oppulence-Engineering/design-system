export {};

/**
 * Registers a generated pack in the six places a provider has to appear.
 *
 * Doing this by hand is where the mistakes live: a pack that is written but
 * left out of the registry is invisible, and one left out of `executable.ts`
 * ships as executable while the directory still advertises it as planned.
 *
 * Usage: bun run providers:wire <integration-id> <factory> <base-url> [scheme]
 *   scheme defaults to "bearer"; "header:X-Api-Key" sets a bare header.
 */
const [integrationId, factory, apiBaseUrl, scheme = "bearer"] =
  process.argv.slice(2);
if (!integrationId || !factory || !apiBaseUrl) {
  console.error(
    "usage: providers:wire <integration-id> <factory> <base-url> [bearer|header:Name]",
  );
  process.exit(1);
}

async function edit(
  path: string,
  change: (source: string) => string,
): Promise<void> {
  const source = await Bun.file(path).text();
  const next = change(source);
  if (next !== source) await Bun.write(path, next);
}

/** Inserts a line into an existing sorted block, keeping it sorted. */
function insertSorted(
  source: string,
  line: string,
  matches: RegExp,
  key: (line: string) => string,
): string {
  if (source.includes(line.trim())) return source;
  const lines = source.split("\n");
  const indexes = lines
    .map((value, index) => ({ value, index }))
    .filter((entry) => matches.test(entry.value));
  if (!indexes.length) throw new Error(`no block matching ${matches}`);
  const target =
    indexes.find((entry) => key(entry.value) > key(line)) ??
    indexes[indexes.length - 1]!;
  const at = key(target.value) > key(line) ? target.index : target.index + 1;
  lines.splice(at, 0, line);
  return lines.join("\n");
}

// 1. Barrel export.
await edit("src/server/providers/index.ts", (source) =>
  insertSorted(
    source,
    `export * from "./${integrationId}";`,
    /^export \* from "\.\/[a-z0-9-]+";$/u,
    (line) => line.replace(/^export \* from "\.\//u, "").replace(/";$/u, ""),
  ),
);

// 2 and 3. Registry import and pack list.
await edit("src/server/providers/registry.ts", (source) => {
  let next = insertSorted(
    source,
    `import { ${factory} } from "./${integrationId}";`,
    /^import \{ create\w+ \} from "\.\/[a-z0-9-]+";$/u,
    (line) => /"\.\/([a-z0-9-]+)"/u.exec(line)?.[1] ?? "",
  );
  next = insertSorted(next, `  ${factory}(),`, /^  create\w+\(\),$/u, (line) =>
    line.trim(),
  );
  return next;
});

// 4. Server entrypoint keeps runtime imports explicit, in two blocks: one
// importing from ./providers and one re-exporting. Both list the same
// factories, so the anchors have to distinguish them — `SqlConnectionSchema`
// appears in each, and replacing the first occurrence twice lands both
// insertions in the import block and duplicates the identifier.
await edit("src/server/index.ts", (source) => {
  if (source.includes(`  ${factory},`)) return source;
  const withImport = source.replace(
    "  createDatadogPack,\n",
    `  ${factory},\n  createDatadogPack,\n`,
  );
  const at = withImport.lastIndexOf("  SqlConnectionSchema,\n");
  if (at < 0) throw new Error("no export block anchor in src/server/index.ts");
  return `${withImport.slice(0, at)}  ${factory},\n${withImport.slice(at)}`;
});

// 5. Browser-safe executable list, which decides directory availability.
await edit("src/executable.ts", (source) =>
  insertSorted(source, `  "${integrationId}",`, /^  "[a-z0-9-]+",$/u, (line) =>
    line.trim(),
  ),
);

// 6. Transport profile naming the one host relative paths resolve against.
await edit("src/server/runtime/api-key.ts", (source) => {
  if (source.includes(`integrationId: "${integrationId}" as const`)) {
    return source;
  }
  const credential = scheme.startsWith("header:")
    ? `    credentialHeader: ${JSON.stringify(scheme.slice("header:".length))},`
    : `    credentialHeader: "Authorization",\n    credentialPrefix: "Bearer",`;
  const entry = `  {
    integrationId: "${integrationId}" as const,
    apiBaseUrl: ${JSON.stringify(apiBaseUrl)},
${credential}
  },
`;
  // The protocol providers close the list; typed REST hosts go before them.
  return source.replace(
    '  {\n    integrationId: "mongodb" as const,',
    `${entry}  {\n    integrationId: "mongodb" as const,`,
  );
});

console.log(`wired ${integrationId} (${factory}) -> ${apiBaseUrl}`);
