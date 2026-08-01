/**
 * Generates a typed REST pack from a provider's published OpenAPI document.
 *
 * The pinned baseline names the actions a provider must account for but
 * carries no endpoint, method, or parameter. A published spec carries exactly
 * that half, so where one exists the pack can be derived from the vendor's own
 * description of its API instead of from recall — which is the difference
 * between a mapping that is checkable and one that is asserted.
 *
 * Matching is deliberately conservative. An action whose verb and resource do
 * not line up with an operation is left for the deferral list rather than
 * bound to a plausible-looking neighbour: a wrong route typechecks, satisfies
 * the pack contract, and fails only against the live API.
 *
 * Usage: bun run providers:generate <integration-id> <spec-url> [--write]
 */
import { parse as parseYaml } from "yaml";

import { SIMSTUDIO_BASELINE } from "../src/catalog";

const [integrationId, specUrl] = process.argv.slice(2);
const write = process.argv.includes("--write");
if (!integrationId || !specUrl) {
  console.error(
    "usage: providers:generate <integration-id> <spec-url> [--write]",
  );
  process.exit(1);
}

const baseline = SIMSTUDIO_BASELINE.integrations.find(
  (integration) => integration.id === integrationId,
);
if (!baseline) {
  console.error(`no baseline entry for ${integrationId}`);
  process.exit(1);
}

// ------------------------------------------------------------------- loading

const cache = `/tmp/openapi-cache-${integrationId}.txt`;
let raw: string;
if (await Bun.file(cache).exists()) {
  raw = await Bun.file(cache).text();
} else {
  const response = await fetch(specUrl, {
    redirect: "follow",
    headers: { accept: "application/json, application/yaml, text/yaml, */*" },
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
  if (Array.isArray(node.allOf)) {
    // A composed schema is flattened; only the shape matters here.
    const merged: any = { type: "object", properties: {}, required: [] };
    for (const part of node.allOf) {
      const resolved = deref(part, depth + 1);
      Object.assign(merged.properties, resolved?.properties ?? {});
      merged.required.push(...(resolved?.required ?? []));
    }
    Object.assign(merged.properties, node.properties ?? {});
    merged.required.push(...(node.required ?? []));
    return merged;
  }
  return node;
}

/** The one host every relative path resolves against. */
function baseUrl(): string {
  if (spec.servers?.[0]?.url) {
    const url = String(spec.servers[0].url);
    // A templated server variable cannot be resolved here.
    return url.includes("{") ? "" : url.replace(/\/+$/u, "");
  }
  if (spec.host) {
    const scheme = spec.schemes?.includes("https") ? "https" : "https";
    return `${scheme}://${spec.host}`;
  }
  return "";
}

const specBasePath: string = spec.basePath ?? "";

// ---------------------------------------------------------------- operations

interface Param {
  name: string;
  in: string;
  required: boolean;
  type: string;
  enum?: string[];
  maximum?: number;
  minimum?: number;
}
interface Operation {
  method: string;
  path: string;
  operationId: string;
  summary: string;
  params: Param[];
  body?: { required: string[]; properties: Record<string, any> };
  /** Set when the vendor serves a JSON dialect rather than application/json. */
  contentType?: string;
}

function paramOf(node: any): Param {
  const resolved = deref(node);
  const schema = deref(resolved.schema ?? resolved) ?? {};
  return {
    name: resolved.name,
    in: resolved.in ?? "query",
    required: Boolean(resolved.required),
    type: schema.type ?? resolved.type ?? "string",
    enum: schema.enum ?? resolved.enum,
    maximum: schema.maximum,
    minimum: schema.minimum,
  };
}

const operations: Operation[] = [];
for (const [path, rawItem] of Object.entries<any>(spec.paths ?? {})) {
  const item = deref(rawItem);
  for (const method of ["get", "post", "put", "patch", "delete"] as const) {
    const op = deref(item?.[method]);
    if (!op) continue;
    const params = [...(item.parameters ?? []), ...(op.parameters ?? [])]
      .map(paramOf)
      .filter((param) => param.name);
    let body: Operation["body"];
    let contentType: string | undefined;
    let rawBodySchema: any;
    if (op.requestBody) {
      const content = deref(op.requestBody).content ?? {};
      // A vendor may serve a JSON dialect rather than application/json —
      // Rootly's is application/vnd.api+json — and the request has to carry
      // that type or the API rejects it.
      contentType =
        Object.keys(content).find((type) => type === "application/json") ??
        Object.keys(content).find((type) => type.includes("json")) ??
        Object.keys(content)[0];
      rawBodySchema = contentType ? content[contentType]?.schema : undefined;
    } else {
      rawBodySchema = (op.parameters ?? []).find(
        (p: any) => deref(p)?.in === "body",
      )?.schema;
    }
    const bodySchema = deref(rawBodySchema);
    if (bodySchema?.properties) {
      const properties = bodySchema.properties;
      // Swagger 2 request schemas often reuse the resource definition, so
      // `required` names response-only fields. Only declared properties count.
      const required = (bodySchema.required ?? []).filter(
        (key: string) => key in properties,
      );
      body = { required, properties };
    }
    operations.push({
      method: method.toUpperCase(),
      path: `${specBasePath}${path}`,
      operationId: op.operationId ?? "",
      summary: String(op.summary ?? op.description ?? "")
        .split("\n")[0]!
        .trim(),
      params,
      body,
      ...(contentType && contentType !== "application/json"
        ? { contentType }
        : {}),
    });
  }
}

// ------------------------------------------------------------------ matching

const VERBS: Array<[RegExp, string[]]> = [
  [/^(list|get-all|search|query|find|fetch-all)/u, ["GET"]],
  [/^(get|show|read|retrieve|describe)/u, ["GET"]],
  [/^(create|add|send|post|start|submit|new|declare|invite|upload)/u, ["POST"]],
  [/^(update|edit|modify|set|replace|patch)/u, ["PATCH", "PUT", "POST"]],
  [/^(delete|remove|destroy|revoke|cancel|archive)/u, ["DELETE", "POST"]],
];

function verbsFor(action: string): string[] {
  for (const [pattern, methods] of VERBS) {
    if (pattern.test(action)) return methods;
  }
  // An unrecognised verb names an operation rather than a read, so it is a
  // write — of any shape, since a vendor may spell "unassign" as a DELETE on
  // an action path. Allowing GET is what let "assign incident role" bind to a
  // plain read of the role.
  return ["POST", "PUT", "PATCH", "DELETE"];
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

/** Trailing "s" only; enough to align "incidents" with "incident". */
function stem(word: string): string {
  return word.endsWith("ies")
    ? `${word.slice(0, -3)}y`
    : word.endsWith("s") && !word.endsWith("ss")
      ? word.slice(0, -1)
      : word;
}

/**
 * Verbs that describe CRUD on a resource, so the endpoint is the resource
 * itself. Anything else — assign, acknowledge, escalate, run — names a
 * distinct operation, and a provider that offers it puts the verb in the path.
 */
const CRUD_VERBS = new Set([
  "list",
  "get",
  "show",
  "read",
  "retrieve",
  "describe",
  "search",
  "query",
  "find",
  "create",
  "add",
  "new",
  "update",
  "edit",
  "modify",
  "set",
  "replace",
  "patch",
  "delete",
  "remove",
  "destroy",
]);

function isCollection(path: string): boolean {
  // Sentry writes every path with a trailing slash, so the parameter test has
  // to ignore it or an item route reads as a collection.
  return !path.replace(/\/+$/u, "").endsWith("}");
}

/** Harmonic mean of how much of each side the overlap accounts for. */
function overlap(wanted: string[], got: string[]): number {
  if (!wanted.length || !got.length) return 0;
  const target = new Set(got);
  let hits = 0;
  for (const word of new Set(wanted)) if (target.has(word)) hits += 1;
  if (!hits) return 0;
  const recall = hits / new Set(wanted).size;
  const precision = hits / target.size;
  return (2 * recall * precision) / (recall + precision);
}

function score(actionSuffix: string, op: Operation): number {
  const all = words(actionSuffix).map(stem);
  if (!all.length) return 0;
  const verb = all[0]!;
  const segments = op.path
    .split("/")
    .filter((segment) => segment && !segment.startsWith("{"))
    .flatMap(words)
    .map(stem);
  if (!segments.length) return 0;
  const opWords = new Set([...segments, ...words(op.operationId).map(stem)]);

  // A non-CRUD verb names its own operation. If the vendor's path and
  // operationId never mention it, the provider does not offer it here, and
  // binding the action to the bare resource would silently do something else —
  // "assign incident role" is not "read incident role".
  if (!CRUD_VERBS.has(verb) && !opWords.has(verb)) return 0;

  // What the request addresses is the last real segment plus its parent: an
  // events collection under /incidents is a different thing from one under
  // /alerts, and the last segment alone cannot tell them apart. Version
  // segments carry no meaning and would only dilute precision.
  const real = op.path.split("/").filter(
    (segment) =>
      segment &&
      !segment.startsWith("{") &&
      // Version and mount segments are structure, not resource names, and
      // counting them only dilutes precision.
      !/^v\d+$/u.test(segment) &&
      !/^\d+$/u.test(segment) &&
      segment !== "api",
  );
  const context = [
    ...words(real.at(-1) ?? ""),
    ...words(real.at(-2) ?? ""),
  ].map(stem);
  let value = Math.max(overlap(all, context), overlap(all.slice(1), context));
  if (value === 0) return 0;

  // An action sub-path — /alerts/{id}/acknowledge — is an item operation even
  // though it does not end in a parameter, so the collection heuristic has to
  // recognise it rather than penalise it.
  const lastWords = words(real.at(-1) ?? "").map(stem);
  // A segment that spells the verb is an operation, whichever verb it is:
  // /incidents/{id}/remove_subscribers is as much an action as /acknowledge.
  const actionPath = lastWords.includes(verb);
  // A plural noun asks for a collection whatever the verb: "get files" is a
  // list, not a read of one file, and binding it to /files/{id} would answer
  // with a single record.
  const tail = words(actionSuffix).at(-1) ?? "";
  const plural = tail !== stem(tail);
  const wantsCollection =
    plural || /^(list|search|query|create|add)/u.test(actionSuffix);
  value +=
    actionPath || isCollection(op.path) === wantsCollection ? 0.25 : -0.3;

  // Prefer the newest version when a vendor ships several.
  const version = /\/v(\d+)\//u.exec(op.path);
  if (version) value += Number(version[1]) * 0.02;
  // A depth tiebreaker only, kept small: at 0.01 a five-segment path lost
  // 0.07 and fell under the bar despite matching exactly.
  value -= op.path.split("/").length * 0.002;
  return value;
}

/**
 * Decisions the matcher cannot make from names alone, recorded per provider.
 *
 * `null` defers an action the vendor's nearest operation does not actually
 * serve — Rootly's retrospective_configurations returns configuration objects
 * rather than retrospectives, and on_call_roles is a role definition rather
 * than who is currently on call. Both would answer successfully with the wrong
 * thing, which is worse than not offering the action.
 *
 * A `"METHOD /path"` string forces a mapping the score ranked second.
 */
type Override = string | { defer: string };
const OVERRIDES: Readonly<Record<string, Readonly<Record<string, Override>>>> =
  {
    rootly: {
      "list-retrospectives": {
        defer:
          "The document has retrospective_configurations and retrospective_processes, but neither is the list of retrospectives this action names: the first returns configuration objects. Binding either would answer successfully with the wrong resource.",
      },
      "list-on-calls": {
        defer:
          "The document has on_call_roles, on_call_shadows, and shifts. A role is a definition rather than who is on call now, and which of the others the action means is not decidable from the document.",
      },
    },
  };

const usedOperations = new Set<Operation>();
const mapping: Array<{
  suffix: string;
  label: string;
  description: string;
  op?: Operation;
  confidence: number;
  /** Set when a deferral has a reason more specific than the default. */
  reason?: string;
}> = [];

const overrides = OVERRIDES[integrationId] ?? {};

for (const action of baseline.operations) {
  const suffix = action.id.slice(action.id.indexOf(":") + 1);
  const override = overrides[suffix];
  if (override !== undefined) {
    const forced = typeof override === "string" ? override : undefined;
    const op = forced
      ? operations.find(
          (candidate) => `${candidate.method} ${candidate.path}` === forced,
        )
      : undefined;
    if (forced && !op) {
      console.error(`override for ${suffix} matches no operation: ${forced}`);
      process.exit(1);
    }
    if (op) usedOperations.add(op);
    mapping.push({
      suffix,
      label: action.label,
      description: action.description,
      op,
      confidence: op ? 1 : 0,
      reason: typeof override === "object" ? override.defer : undefined,
    });
    continue;
  }
  const allowed = new Set(verbsFor(suffix));
  const ranked = operations
    .filter((op) => allowed.has(op.method) && !usedOperations.has(op))
    .map((op) => ({ op, value: score(suffix, op) }))
    .sort((a, b) => b.value - a.value);
  const best = ranked[0];
  // Below this the match is a guess, and a guess is what this exists to avoid.
  const confident = best && best.value >= 0.85;
  if (confident) usedOperations.add(best.op);
  mapping.push({
    suffix,
    label: action.label,
    description: action.description,
    op: confident ? best.op : undefined,
    confidence: best?.value ?? 0,
  });
}

// ---------------------------------------------------------------- generation

function camel(value: string): string {
  const parts = value.split(/[^A-Za-z0-9]+/u).filter(Boolean);
  return parts
    .map((part, index) =>
      index === 0
        ? part[0]!.toLowerCase() + part.slice(1)
        : part[0]!.toUpperCase() + part.slice(1),
    )
    .join("");
}

function pascal(value: string): string {
  const camelCase = camel(value);
  return camelCase[0]!.toUpperCase() + camelCase.slice(1);
}

function zodFor(type: string, param?: Partial<Param>, schema?: any): string {
  if (param?.enum?.length && param.enum.every((v) => typeof v === "string")) {
    return `z.enum([${param.enum.map((v) => JSON.stringify(v)).join(", ")}])`;
  }
  if (
    schema?.enum?.length &&
    schema.enum.every((v: any) => typeof v === "string")
  ) {
    return `z.enum([${schema.enum.map((v: any) => JSON.stringify(v)).join(", ")}])`;
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

const fileParts: string[] = [];
const factory = `create${pascal(integrationId)}Pack`;

// The transport has to match what the catalogue says the provider
// authenticates with: the lane refuses an api_key adapter for a provider whose
// definition only lists OAuth, which is how a mis-wired Pipedrive was caught.
const transportKind =
  baseline.sourceAuthType === "oauth"
    ? "oauth2"
    : baseline.sourceAuthType === "none"
      ? "none"
      : "api_key";

for (const entry of mapping) {
  if (!entry.op) continue;
  const op = entry.op;
  const pathParams = op.params.filter((param) => param.in === "path");
  const queryParams = op.params.filter((param) => param.in === "query");
  const inputs: string[] = [];
  const seen = new Set<string>();

  for (const param of pathParams) {
    const key = camel(param.name);
    if (seen.has(key)) continue;
    seen.add(key);
    inputs.push(`        ${key}: ${zodFor(param.type, param)},`);
  }
  for (const param of queryParams) {
    const key = camel(param.name);
    if (seen.has(key)) continue;
    seen.add(key);
    inputs.push(
      `        ${key}: ${zodFor(param.type, param)}${param.required ? "" : ".optional()"},`,
    );
  }
  const bodyEntries: string[] = [];
  if (op.body) {
    for (const [name, rawSchema] of Object.entries(op.body.properties)) {
      const schema = deref(rawSchema);
      const key = camel(name);
      if (seen.has(key)) continue;
      seen.add(key);
      const required = op.body.required.includes(name);
      inputs.push(
        `        ${key}: ${zodFor(schema?.type ?? "string", undefined, schema)}${required ? "" : ".optional()"},`,
      );
      bodyEntries.push(
        required
          ? `      ${JSON.stringify(name)}: i.${key},`
          : `      ...(i.${key} !== undefined ? { ${JSON.stringify(name)}: i.${key} } : {}),`,
      );
    }
  }

  const pathExpression = op.path.includes("{")
    ? "`" +
      op.path.replace(
        /\{([^}]+)\}/gu,
        (_m, name) => `\${restSegment(i.${camel(name)})}`,
      ) +
      "`"
    : JSON.stringify(op.path);
  const queryExpression = queryParams.length
    ? `${op.path.includes("{") ? "" : ""}\${restQuery({ ${queryParams
        .map((param) => `${JSON.stringify(param.name)}: i.${camel(param.name)}`)
        .join(", ")} })}`
    : "";
  const url = queryParams.length
    ? "`" +
      (op.path.includes("{")
        ? op.path.replace(
            /\{([^}]+)\}/gu,
            (_m, name) => `\${restSegment(i.${camel(name)})}`,
          )
        : op.path) +
      queryExpression +
      "`"
    : pathExpression;

  const needsArrow = op.path.includes("{") || queryParams.length > 0;
  fileParts.push(
    `  {
    action: ${JSON.stringify(entry.suffix)},
    name: ${JSON.stringify(entry.label)},
    description: ${JSON.stringify(entry.description || entry.label)},
    method: ${JSON.stringify(op.method)},
    url: ${needsArrow ? `(i) => ${url}` : url},
    input: z
      .object({
${inputs.join("\n") || "        /* no declared parameters */"}
      })
      .strict(),${
        bodyEntries.length
          ? `
    body: (i) => ({
${bodyEntries.join("\n")}
    }),`
          : ""
      }${
        op.contentType
          ? `\n    headers: () => ({ "content-type": ${JSON.stringify(op.contentType)} }),`
          : ""
      }${op.method === "DELETE" ? `\n    emptyResponse: "optional",` : ""}
  },`,
  );
}

const deferrals = mapping.filter((entry) => !entry.op);
const deferralEntries = deferrals
  .map(
    (entry) =>
      `      ${JSON.stringify(entry.suffix)}:\n        ${JSON.stringify(entry.reason ?? "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.")},`,
  )
  .join("\n");

const file = `import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from ${baseline.name}'s published OpenAPI document:
 * ${specUrl}
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "${baseline.name} publishes no maintained Node SDK; its OpenAPI document at ${specUrl} is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
${fileParts.join("\n")}
];

export function ${factory}(): IntegrationProviderPack {
  return createRestPack({
    integrationId: ${JSON.stringify(integrationId)},
    sdkReview: SPEC_NOTE,
    transportKind: ${JSON.stringify(transportKind)},
    actions: ACTIONS,${
      deferrals.length
        ? `
    deferrals: {
${deferralEntries}
    },`
        : ""
    }
  });
}
`;

const mapped = mapping.filter((entry) => entry.op).length;
console.log(
  `${baseline.name}: ${mapped}/${baseline.operations.length} mapped, ${deferrals.length} deferred`,
);
console.log(
  `base url: ${baseUrl() || "(unresolved — set the profile by hand)"}`,
);
for (const entry of mapping) {
  console.log(
    entry.op
      ? `  OK   ${entry.suffix.padEnd(30)} ${entry.op.method.padEnd(6)} ${entry.op.path}`
      : `  DEF  ${entry.suffix.padEnd(30)} (best ${entry.confidence.toFixed(2)})`,
  );
}

if (write) {
  const target = `src/server/providers/${integrationId}/index.ts`;
  await Bun.write(target, file);
  console.log(`\nwrote ${target}`);
}
