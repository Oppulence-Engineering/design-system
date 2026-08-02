export {};

/**
 * Adopts a provider the pinned source does not carry, from its published spec.
 *
 * The baseline providers arrive with an action list; these do not, so the list
 * has to be chosen. The rule is written down rather than left to taste: take
 * CRUD operations on the shallowest paths — a vendor's top-level resources are
 * the ones a product integrates against — and cap the result, so a 340-
 * operation document does not become a 340-action pack nobody reviewed.
 *
 * Emits the pack and the catalogue definition together, because a provider
 * needs both: the lane checks the catalogue for the auth method, and the
 * directory cannot offer what the catalogue does not describe.
 *
 * Usage: bun run providers:adopt <id> <spec-url> <base-url> [--limit N] [--write]
 */
import { parse as parseYaml } from "yaml";

const [integrationId, specUrl, baseUrl] = process.argv.slice(2);
const write = process.argv.includes("--write");
const limitFlag = process.argv.indexOf("--limit");
const LIMIT = limitFlag > 0 ? Number(process.argv[limitFlag + 1]) : 22;
if (!integrationId || !specUrl || !baseUrl) {
  console.error(
    "usage: providers:adopt <id> <spec-url> <base-url> [--limit N] [--write]",
  );
  process.exit(1);
}

const cache = `/tmp/adopt-${integrationId}.txt`;
let raw: string;
if (await Bun.file(cache).exists()) {
  raw = await Bun.file(cache).text();
} else {
  const response = await fetch(specUrl, {
    redirect: "follow",
    headers: { accept: "application/json, application/yaml, */*" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    console.error(`spec fetch failed: ${response.status}`);
    process.exit(1);
  }
  raw = await response.text();
  await Bun.write(cache, raw);
}
const spec: any = raw.trimStart().startsWith("{")
  ? JSON.parse(raw)
  : parseYaml(raw, { maxAliasCount: -1 });

function deref(node: any, depth = 0): any {
  if (!node || depth > 6) return node;
  if (node.$ref) {
    const path = String(node.$ref).replace(/^#\//u, "").split("/");
    let target: any = spec;
    for (const key of path) target = target?.[decodeURIComponent(key)];
    return deref(target, depth + 1);
  }
  return node;
}

const basePath: string = spec.basePath ?? "";

interface Candidate {
  method: string;
  path: string;
  summary: string;
  depth: number;
  params: Array<{
    name: string;
    in: string;
    required: boolean;
    type: string;
    enum?: string[];
  }>;
  body?: { required: string[]; properties: Record<string, any> };
  contentType?: string;
}

const candidates: Candidate[] = [];
for (const [path, rawItem] of Object.entries<any>(spec.paths ?? {})) {
  const item = deref(rawItem);
  for (const method of ["get", "post", "put", "patch", "delete"] as const) {
    const op = deref(item?.[method]);
    if (!op || op.deprecated) continue;
    const params = [...(item.parameters ?? []), ...(op.parameters ?? [])]
      .map((p: any) => {
        const r = deref(p);
        const s = deref(r.schema ?? r) ?? {};
        return {
          name: r.name,
          in: r.in ?? "query",
          required: Boolean(r.required),
          type: s.type ?? r.type ?? "string",
          enum: s.enum ?? r.enum,
        };
      })
      .filter((p) => p.name);
    let body: Candidate["body"];
    let contentType: string | undefined;
    let bodyRaw: any;
    if (op.requestBody) {
      const content = deref(op.requestBody).content ?? {};
      contentType =
        Object.keys(content).find((t) => t === "application/json") ??
        Object.keys(content).find((t) => t.includes("json")) ??
        Object.keys(content)[0];
      bodyRaw = contentType ? content[contentType]?.schema : undefined;
    } else {
      bodyRaw = (op.parameters ?? []).find(
        (p: any) => deref(p)?.in === "body",
      )?.schema;
    }
    const bodySchema = deref(bodyRaw);
    if (bodySchema?.properties) {
      const properties = bodySchema.properties;
      body = {
        required: (bodySchema.required ?? []).filter(
          (k: string) => k in properties,
        ),
        properties,
      };
    }
    // A spec whose basePath is "/" would otherwise yield "//accounts", which
    // the lane rejects as a malformed relative URL.
    const full = `${basePath}${path}`.replace(/\/{2,}/gu, "/");
    candidates.push({
      method: method.toUpperCase(),
      path: full,
      summary: String(op.summary ?? op.description ?? "")
        .split("\n")[0]!
        .trim(),
      // Real segments only. Counting parameters made /status/lead/ look as
      // shallow as /lead/, and the ranking then chose lead *statuses* for an
      // action named "list-lead".
      depth: full
        .split("/")
        .filter(
          (s) =>
            s &&
            !s.startsWith("{") &&
            !/^v?\d+(\.\d+)*$/u.test(s) &&
            s !== "api",
        ).length,
      params,
      body,
      ...(contentType && contentType !== "application/json"
        ? { contentType }
        : {}),
    });
  }
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}
function singular(word: string): string {
  return word.endsWith("ies")
    ? `${word.slice(0, -3)}y`
    : word.endsWith("s") && !word.endsWith("ss")
      ? word.slice(0, -1)
      : word;
}

/** The verb a method means against a collection or an item. */
function actionName(candidate: Candidate): string {
  const real = candidate.path
    .split("/")
    .filter(
      (s) =>
        s && !s.startsWith("{") && !/^v?\d+(\.\d+)*$/u.test(s) && s !== "api",
    );
  const noun = words(real.at(-1) ?? "resource").join("-");
  const item = candidate.path.replace(/\/+$/u, "").endsWith("}");
  switch (candidate.method) {
    case "GET":
      return item ? `get-${singular(noun)}` : `list-${noun}`;
    case "POST":
      return `create-${singular(noun)}`;
    case "PUT":
    case "PATCH":
      return `update-${singular(noun)}`;
    default:
      return `delete-${singular(noun)}`;
  }
}

/** The first real segment: the resource an operation belongs to. */
function resourceOf(candidate: Candidate): string {
  return (
    candidate.path
      .split("/")
      .find(
        (s) =>
          s && !s.startsWith("{") && !/^v?\d+(\.\d+)*$/u.test(s) && s !== "api",
      ) ?? candidate.path
  );
}

// Rank resources by how completely the vendor models them. A core resource
// carries the full list/get/create/update/delete set, while an incidental one
// carries a single route — so operation count sorts "lead" above
// "blocked_phone_number" where alphabetical order would not.
const byResource = new Map<string, Candidate[]>();
for (const candidate of candidates) {
  const key = resourceOf(candidate);
  byResource.set(key, [...(byResource.get(key) ?? []), candidate]);
}
// Rank on the operations a resource exposes at its own level, not on how many
// sub-resources hang beneath it. A CRM's /lead/ carries five; /status/ carries
// none of its own and a dozen underneath, and size alone would prefer it.
function topLevelOps(group: Candidate[]): number {
  const shallowest = Math.min(...group.map((c) => c.depth));
  return group.filter((c) => c.depth === shallowest && shallowest === 1).length;
}
// Which resources matter is a product judgement the document cannot express:
// Close models lead, contact, and opportunity with exactly the same five
// operations as blocked_phone_number. Naming them puts them first; without it
// the tie breaks alphabetically and a CRM ships without leads.
const priorityFlag = process.argv.indexOf("--resources");
const PRIORITY =
  priorityFlag > 0 ? (process.argv[priorityFlag + 1] ?? "").split(",") : [];
const rankOf = (name: string) => {
  const at = PRIORITY.indexOf(name);
  return at < 0 ? PRIORITY.length : at;
};
const ranked = [...byResource.entries()].sort(
  (a, b) =>
    rankOf(a[0]) - rankOf(b[0]) ||
    topLevelOps(b[1]) - topLevelOps(a[1]) ||
    b[1].length - a[1].length ||
    a[0].localeCompare(b[0]),
);

const chosen: Candidate[] = [];
const taken = new Set<string>();
// At most the CRUD five per resource. Without this a vendor that models one
// area deeply — Close nests a dozen sub-resources under /activity — spends the
// whole cap there and never reaches leads or contacts.
const PER_RESOURCE = 5;
for (const [, group] of ranked) {
  if (chosen.length >= LIMIT) break;
  let fromResource = 0;
  // Within a resource, shallowest first so the collection and item routes win
  // over its sub-resources.
  for (const candidate of group.sort(
    (a, b) => a.depth - b.depth || a.path.localeCompare(b.path),
  )) {
    if (chosen.length >= LIMIT || fromResource >= PER_RESOURCE) break;
    const name = actionName(candidate);
    if (taken.has(name)) continue;
    taken.add(name);
    chosen.push(candidate);
    fromResource += 1;
  }
}

function camel(value: string): string {
  const parts = value.split(/[^A-Za-z0-9]+/u).filter(Boolean);
  return parts
    .map((p, i) =>
      i === 0
        ? p[0]!.toLowerCase() + p.slice(1)
        : p[0]!.toUpperCase() + p.slice(1),
    )
    .join("");
}
function pascal(value: string): string {
  const c = camel(value);
  return c[0]!.toUpperCase() + c.slice(1);
}
function zodFor(type: string, enums?: string[], schema?: any): string {
  const values = enums ?? schema?.enum;
  if (values?.length && values.every((v: any) => typeof v === "string")) {
    return `z.enum([${values.map((v: string) => JSON.stringify(v)).join(", ")}])`;
  }
  switch (type) {
    case "integer":
      return "z.number().int().min(-1_000_000_000).max(1_000_000_000)";
    case "number":
      return "z.number()";
    case "boolean":
      return "z.boolean()";
    case "array":
      return "SpecArray";
    case "object":
      return "SpecObject";
    default:
      return "z.string().max(4_000)";
  }
}

const actions: string[] = [];
const definitionOps: string[] = [];
for (const candidate of chosen) {
  const name = actionName(candidate);
  const label = name
    .split("-")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
  const pathParams = candidate.params.filter((p) => p.in === "path");
  const queryParams = candidate.params.filter((p) => p.in === "query");
  const inputs: string[] = [];
  const seen = new Set<string>();
  for (const p of pathParams) {
    const key = camel(p.name);
    if (seen.has(key)) continue;
    seen.add(key);
    inputs.push(`        ${key}: ${zodFor(p.type, p.enum)},`);
  }
  for (const p of queryParams) {
    const key = camel(p.name);
    if (seen.has(key)) continue;
    seen.add(key);
    inputs.push(
      `        ${key}: ${zodFor(p.type, p.enum)}${p.required ? "" : ".optional()"},`,
    );
  }
  const bodyEntries: string[] = [];
  for (const [field, rawSchema] of Object.entries(
    candidate.body?.properties ?? {},
  )) {
    const schema = deref(rawSchema);
    const key = camel(field);
    if (seen.has(key)) continue;
    seen.add(key);
    const required = candidate.body!.required.includes(field);
    inputs.push(
      `        ${key}: ${zodFor(schema?.type ?? "string", undefined, schema)}${required ? "" : ".optional()"},`,
    );
    bodyEntries.push(
      required
        ? `      ${JSON.stringify(field)}: i.${key},`
        : `      ...(i.${key} !== undefined ? { ${JSON.stringify(field)}: i.${key} } : {}),`,
    );
  }
  const templated = candidate.path.includes("{");
  const pathExpr = templated
    ? candidate.path.replace(
        /\{([^}]+)\}/gu,
        (_m, n) => `\${restSegment(i.${camel(n)})}`,
      )
    : candidate.path;
  const queryExpr = queryParams.length
    ? `\${restQuery({ ${queryParams.map((p) => `${JSON.stringify(p.name)}: i.${camel(p.name)}`).join(", ")} })}`
    : "";
  const url =
    templated || queryParams.length
      ? `(i) => \`${pathExpr}${queryExpr}\``
      : JSON.stringify(candidate.path);
  const description = candidate.summary || label;
  actions.push(`  {
    action: ${JSON.stringify(name)},
    name: ${JSON.stringify(label)},
    description: ${JSON.stringify(description)},
    method: ${JSON.stringify(candidate.method)},
    url: ${url},
    input: z
      .object({
${inputs.join("\n") || "        /* no declared parameters */"}
      })
      .strict(),${bodyEntries.length ? `\n    body: (i) => ({\n${bodyEntries.join("\n")}\n    }),` : ""}${
        candidate.contentType
          ? `\n    headers: () => ({ "content-type": ${JSON.stringify(candidate.contentType)} }),`
          : ""
      }${candidate.method === "DELETE" ? `\n    emptyResponse: "optional",` : ""}
  },`);
  definitionOps.push(
    `      { id: ${JSON.stringify(name)}, label: ${JSON.stringify(label)}, description: ${JSON.stringify(description)} },`,
  );
}

const factory = `create${pascal(integrationId)}Pack`;
const pack = `import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from ${integrationId}'s published OpenAPI document:
 * ${specUrl}
 *
 * This provider is outside the pinned source, so its action table is its own
 * coverage. The table is the shallowest CRUD operations the document declares,
 * capped at ${LIMIT} — a vendor's top-level resources, not everything it serves.
 */
const SPEC_NOTE =
  "${integrationId} publishes no maintained Node SDK; its OpenAPI document at ${specUrl} is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
${actions.join("\n")}
];

export function ${factory}(): IntegrationProviderPack {
  return createRestPack({
    integrationId: ${JSON.stringify(integrationId)},
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    beyondBaseline: true,
    actions: ACTIONS,
  });
}
`;

const definition = `  {
    id: ${JSON.stringify(integrationId)},
    aliases: [],
    name: ${JSON.stringify(spec.info?.title ?? integrationId)},
    category: "REPLACE_CATEGORY",
    summary: ${JSON.stringify((spec.info?.description ?? `${integrationId} integration.`).split("\n")[0]!.slice(0, 200))},
    capabilities: ["workflow_action"],
    authMethods: ["api_key"],
    operations: [
${definitionOps.join("\n")}
    ],
  },`;

console.log(
  `${integrationId}: ${chosen.length} actions from ${candidates.length} operations`,
);
for (const candidate of chosen) {
  console.log(
    `  ${actionName(candidate).padEnd(28)} ${candidate.method.padEnd(6)} ${candidate.path}`,
  );
}
if (write) {
  await Bun.write(`src/server/providers/${integrationId}/index.ts`, pack);
  await Bun.write(`/tmp/definition-${integrationId}.txt`, definition);
  console.log(
    `\nwrote pack, definition at /tmp/definition-${integrationId}.txt`,
  );
  console.log(`base url for the profile: ${baseUrl}`);
}
