/**
 * Pairs a provider's baseline actions with the operations its published
 * OpenAPI document declares.
 *
 * The baseline records only an action's id, label, and description — no
 * endpoint, method, or parameter. Where a provider publishes a spec, that
 * missing half is available and verifiable, so a pack can be written from the
 * vendor's own description of its API rather than from recall.
 *
 * Usage: bun run providers:openapi <integration-id> <spec-url>
 */
import { SIMSTUDIO_BASELINE } from "../src/catalog";

const [integrationId, specUrl] = process.argv.slice(2);
if (!integrationId || !specUrl) {
  console.error("usage: providers:openapi <integration-id> <spec-url>");
  process.exit(1);
}

const baseline = SIMSTUDIO_BASELINE.integrations.find(
  (integration) => integration.id === integrationId,
);
if (!baseline) {
  console.error(`no baseline entry for ${integrationId}`);
  process.exit(1);
}

const cache = `/tmp/openapi-cache-${integrationId}.txt`;
let raw: string;
if (await Bun.file(cache).exists()) {
  raw = await Bun.file(cache).text();
} else {
  const response = await fetch(specUrl, {
    redirect: "follow",
    headers: { accept: "application/json, application/yaml, text/yaml, */*" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    console.error(`spec fetch failed: ${response.status}`);
    process.exit(1);
  }
  raw = await response.text();
  await Bun.write(cache, raw);
}

interface SpecOperation {
  method: string;
  path: string;
  operationId?: string;
  summary: string;
  /** Parameters the vendor declares, so a schema is not invented. */
  parameters: Array<{ name: string; in: string; required: boolean }>;
  requestFields: string[];
}

/** YAML is only parsed far enough to enumerate operations. */
function parseSpec(text: string): any {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{")) return JSON.parse(text);
  throw new Error(
    "spec is YAML; re-run against a .json spec or convert it first",
  );
}

const spec = parseSpec(raw);
const basePath: string = spec.basePath ?? "";

function fieldsOf(node: any, seen = 0): string[] {
  if (!node || seen > 2) return [];
  const schema =
    node.schema ??
    node.content?.["application/json"]?.schema ??
    node.content?.["application/x-www-form-urlencoded"]?.schema ??
    node;
  const properties = schema?.properties;
  if (!properties) return [];
  const required: string[] = schema.required ?? [];
  return Object.keys(properties).map((key) =>
    required.includes(key) ? `${key}*` : key,
  );
}

const operations: SpecOperation[] = [];
for (const [path, item] of Object.entries<any>(spec.paths ?? {})) {
  for (const method of [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
  ] as const) {
    const operation = item?.[method];
    if (!operation) continue;
    const parameters = [
      ...(item.parameters ?? []),
      ...(operation.parameters ?? []),
    ]
      .filter((parameter: any) => parameter?.name)
      .map((parameter: any) => ({
        name: parameter.name,
        in: parameter.in ?? "query",
        required: Boolean(parameter.required),
      }));
    operations.push({
      method: method.toUpperCase(),
      path: `${basePath}${path}`,
      operationId: operation.operationId,
      summary: (operation.summary ?? operation.description ?? "")
        .split("\n")[0]
        .slice(0, 90),
      parameters,
      requestFields: fieldsOf(operation.requestBody ?? {}).concat(
        (operation.parameters ?? [])
          .filter((parameter: any) => parameter?.in === "body")
          .flatMap((parameter: any) => fieldsOf(parameter)),
      ),
    });
  }
}

/** Token overlap, which is enough to shortlist candidates for review. */
function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length > 2),
  );
}

function score(
  action: { id: string; label: string },
  op: SpecOperation,
): number {
  const wanted = tokens(
    `${action.id.split(":")[1] ?? action.id} ${action.label}`,
  );
  const got = tokens(`${op.operationId ?? ""} ${op.path} ${op.summary}`);
  let hits = 0;
  for (const token of wanted) if (got.has(token)) hits += 1;
  return hits / Math.max(1, wanted.size);
}

console.log(
  `${baseline.name}: ${baseline.operations.length} baseline actions vs ${operations.length} spec operations\n`,
);

// `--all` dumps the vendor's operations verbatim. Token overlap is only good
// enough to shortlist, and it mis-ranks siblings that share a noun — "create
// incident" scores the same against /incidents and /incident_attachments — so
// the mapping is made against this list, not against the ranking.
if (process.argv.includes("--all")) {
  for (const op of operations
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))) {
    const required = op.parameters
      .filter((parameter) => parameter.required)
      .map((parameter) => `${parameter.name}:${parameter.in}`)
      .join(",");
    console.log(
      `${op.method.padEnd(6)} ${op.path}${required ? `  req[${required}]` : ""}  ${op.summary}`,
    );
  }
  process.exit(0);
}
for (const action of baseline.operations) {
  const ranked = operations
    .map((op) => ({ op, value: score(action, op) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .filter((candidate) => candidate.value > 0);
  const suffix = action.id.slice(action.id.indexOf(":") + 1);
  console.log(`${suffix}  —  ${action.label}`);
  if (!ranked.length) {
    console.log("    (no candidate)");
    continue;
  }
  for (const { op, value } of ranked) {
    const required = op.parameters
      .filter((parameter) => parameter.required)
      .map((parameter) => `${parameter.name}:${parameter.in}`)
      .join(",");
    console.log(
      `    ${value.toFixed(2)} ${op.method.padEnd(6)} ${op.path}${required ? `  req[${required}]` : ""}${op.requestFields.length ? `  body{${op.requestFields.slice(0, 8).join(",")}}` : ""}`,
    );
  }
}
