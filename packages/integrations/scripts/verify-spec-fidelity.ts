export {};

/**
 * Verifies each generated pack against the document it was generated from.
 *
 * The pack audit checks a pack for internal consistency; this checks it for
 * fidelity. A route that does not appear in the vendor's document, a query
 * parameter spelled differently from the one declared, a body field the
 * document does not carry — all typecheck and all fail only in production.
 *
 * It reads the cached documents under /tmp that the generators fetched. A
 * missing cache is reported rather than skipped, because a check that quietly
 * verifies nothing is worse than no check: an earlier version of this one
 * matched only quoted body keys and confirmed two fields while claiming to
 * cover them all.
 *
 * Run by hand after regenerating a provider: bun run providers:verify
 */
import { parse as parseYaml } from "yaml";
import { readdirSync, existsSync } from "node:fs";

const SPECS: Readonly<Record<string, string>> = {
  "incident-io": "/tmp/openapi-cache-incident-io.txt",
  rootly: "/tmp/openapi-cache-rootly.txt",
  grafana: "/tmp/openapi-cache-grafana.txt",
  agentmail: "/tmp/openapi-cache-agentmail.txt",
  agentphone: "/tmp/openapi-cache-agentphone.txt",
  ahrefs: "/tmp/openapi-cache-ahrefs.txt",
  apify: "/tmp/openapi-cache-apify.txt",
  daytona: "/tmp/openapi-cache-daytona.txt",
  devin: "/tmp/openapi-cache-devin.txt",
  granola: "/tmp/openapi-cache-granola.txt",
  infisical: "/tmp/openapi-cache-infisical.txt",
  instantly: "/tmp/openapi-cache-instantly.txt",
  kalshi: "/tmp/openapi-cache-kalshi.txt",
  langsmith: "/tmp/openapi-cache-langsmith.txt",
  launchdarkly: "/tmp/openapi-cache-launchdarkly.txt",
  leadmagic: "/tmp/openapi-cache-leadmagic.txt",
  lemlist: "/tmp/openapi-cache-lemlist.txt",
  loops: "/tmp/openapi-cache-loops.txt",
  mem0: "/tmp/openapi-cache-mem0.txt",
  profound: "/tmp/openapi-cache-profound.txt",
  quartr: "/tmp/openapi-cache-quartr.txt",
  sentry: "/tmp/openapi-cache-sentry.txt",
  "sixtyfour-ai": "/tmp/openapi-cache-sixtyfour-ai.txt",
  stagehand: "/tmp/openapi-cache-stagehand.txt",
  thrive: "/tmp/openapi-cache-thrive.txt",
  uptimerobot: "/tmp/openapi-cache-uptimerobot.txt",
  close: "/tmp/adopt-close.txt",
  salesflare: "/tmp/adopt-salesflare.txt",
  front: "/tmp/adopt-front.txt",
  bitbucket: "/tmp/adopt-bitbucket.txt",
  copper: "/tmp/adopt-copper.txt",
  taleez: "/tmp/adopt-taleez.txt",
};

interface SpecIndex {
  routes: Set<string>;
  /** method+path -> declared query parameter names. */
  query: Map<string, Set<string>>;
  /** method+path -> declared request body property names. */
  body: Map<string, Set<string>>;
}

async function indexSpec(path: string): Promise<SpecIndex | undefined> {
  if (!existsSync(path)) return undefined;
  const raw = await Bun.file(path).text();
  let spec: any;
  try {
    spec = raw.trimStart().startsWith("{")
      ? JSON.parse(raw)
      : parseYaml(raw, { maxAliasCount: -1 });
  } catch {
    return undefined;
  }
  const deref = (node: any, depth = 0): any => {
    if (!node || depth > 6) return node;
    if (node.$ref) {
      const parts = String(node.$ref).replace(/^#\//u, "").split("/");
      let target: any = spec;
      for (const key of parts) target = target?.[decodeURIComponent(key)];
      return deref(target, depth + 1);
    }
    return node;
  };
  const base: string = spec.basePath ?? "";
  const routes = new Set<string>();
  const query = new Map<string, Set<string>>();
  const body = new Map<string, Set<string>>();
  for (const [path, rawItem] of Object.entries<any>(spec.paths ?? {})) {
    const item = deref(rawItem);
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const op = deref(item?.[method]);
      if (!op) continue;
      const full = `${base}${path}`.replace(/\/{2,}/gu, "/");
      // Compare shapes, not parameter names: {id} and {uid} are the same slot.
      const shape = `${method.toUpperCase()} ${full.replace(/\{[^}]+\}/gu, "{}")}`;
      routes.add(shape);
      const names = new Set<string>();
      for (const raw of [
        ...(item.parameters ?? []),
        ...(op.parameters ?? []),
      ]) {
        const p = deref(raw);
        if (p?.in === "query" && p.name) names.add(String(p.name));
      }
      query.set(shape, new Set([...(query.get(shape) ?? []), ...names]));
      const content = deref(op.requestBody)?.content ?? {};
      const type =
        Object.keys(content).find((t) => t === "application/json") ??
        Object.keys(content).find((t) => t.includes("json")) ??
        Object.keys(content)[0];
      const schema = deref(
        type
          ? content[type]?.schema
          : (op.parameters ?? []).find((p: any) => deref(p)?.in === "body")
              ?.schema,
      );
      if (schema?.properties) {
        body.set(
          shape,
          new Set([
            ...(body.get(shape) ?? []),
            ...Object.keys(schema.properties),
          ]),
        );
      }
    }
  }
  return { routes, query, body };
}

const findings: string[] = [];
let checkedRoutes = 0;
let checkedParams = 0;
let checkedBody = 0;

for (const [provider, specPath] of Object.entries(SPECS)) {
  const index = await indexSpec(specPath);
  if (!index) {
    findings.push(`${provider.padEnd(14)} SPEC CACHE MISSING — not verified`);
    continue;
  }
  const file = `src/server/providers/${provider}/index.ts`;
  if (!existsSync(file)) continue;
  const source = await Bun.file(file).text();
  const starts = [...source.matchAll(/^    action: "([a-z0-9-]+)",$/gmu)];
  for (let n = 0; n < starts.length; n += 1) {
    const from = starts[n]!.index!;
    // The last action ends at the close of the ACTIONS array, not at the end
    // of the file: beyond it sits the deferrals map, whose keys are quoted at
    // the same indent and read as body fields.
    const arrayEnd = source.indexOf("\n];", from);
    const to =
      n + 1 < starts.length
        ? starts[n + 1]!.index!
        : arrayEnd >= 0
          ? arrayEnd
          : source.length;
    const block = source.slice(from, to);
    const name = starts[n]![1]!;
    const method = /^    method: "([A-Z]+)",$/mu.exec(block)?.[1];
    const urlAt = block.indexOf("    url: ");
    const inputAt = block.indexOf("    input: ", urlAt);
    if (!method || urlAt < 0 || inputAt < 0) continue;
    const url = block
      .slice(urlAt + 9, inputAt)
      .replace(/\s+/gu, " ")
      .trim()
      .replace(/,$/u, "");

    // Reduce the emitted url to the same shape the index holds.
    const literal = /^"(.+)"$/u.exec(url)?.[1];
    const template = literal ?? /`(.+)`$/u.exec(url)?.[1];
    if (!template) continue;
    const path = template
      .replace(/\$\{restSegment\([^)]*\)\}/gu, "{}")
      .replace(/\$\{restQuery\([\s\S]*?\)\}/gu, "")
      .replace(/\$\{[^}]*\}/gu, "{}");
    if (path.includes("${")) continue;
    checkedRoutes += 1;
    const shape = `${method} ${path}`;
    if (!index.routes.has(shape)) {
      findings.push(
        `${provider.padEnd(14)} ${name} emits ${shape} — not in the document`,
      );
      continue;
    }
    // Query names the pack sends that the document does not declare.
    const declared = index.query.get(shape) ?? new Set<string>();
    const sent = [...block.matchAll(/restQuery\(\{([\s\S]*?)\}\)/gu)].flatMap(
      (m) => [...m[1]!.matchAll(/"([^"]+)":/gu)].map((q) => q[1]!),
    );
    for (const param of new Set(sent)) {
      checkedParams += 1;
      if (!declared.has(param)) {
        findings.push(
          `${provider.padEnd(14)} ${name} sends ?${param} which ${shape} does not declare`,
        );
      }
    }

    // The same fidelity question for the request body, which is where a write
    // fails rather than merely returning the wrong page.
    const declaredBody = index.body.get(shape);
    if (declaredBody?.size) {
      const bodyAt = block.indexOf("    body: (i) => ({");
      if (bodyAt >= 0) {
        // Prettier unquotes any key that is a valid identifier, so matching
        // only quoted keys checked almost nothing: `data: i.data` is the
        // common case and `"tag.name": i.tagName` the exception.
        const fields = [
          ...block
            .slice(bodyAt)
            .matchAll(
              /^      (?:\.\.\.\(i\.\w+ !== undefined \? \{ )?"?([A-Za-z_][\w.-]*)"?:/gmu,
            ),
        ].map((m) => m[1]!);
        for (const field of new Set(fields)) {
          checkedBody += 1;
          if (!declaredBody.has(field)) {
            findings.push(
              `${provider.padEnd(14)} ${name} sends body.${field} which ${shape} does not declare`,
            );
          }
        }
      }
    }
  }
}

console.log(findings.join("\n") || "no findings");
console.log(
  `\n${checkedRoutes} routes, ${checkedParams} query parameters and ${checkedBody} body fields checked against their documents, ${findings.length} findings`,
);
