export {};

/**
 * Unauthenticated reachability check for the routes the generated packs emit.
 *
 * There are no credentials here, so a 200 is not the signal. The useful one is
 * the difference between "this route exists and rejected me" and "this route
 * is not there":
 *
 *   401 / 403      the path exists and auth failed — the mapping is right
 *   404            the path is probably wrong, or the vendor hides routes
 *   405            the path exists but not for this method
 *   200            served without auth
 *
 * Only GET routes are probed. A write would be fired at a real vendor with no
 * credential. A placeholder id in a path 404s for a reason that says nothing
 * about the mapping, so a 404 is reported as inconclusive and never counted
 * against a route.
 *
 * This makes live network calls and is deliberately not part of `test`. Run it
 * by hand after mapping a provider: bun run providers:smoke
 */
import { readdirSync, existsSync } from "node:fs";

import { BUILT_IN_API_KEY_PROVIDER_CONFIGURATIONS } from "../src/server";

const hosts = new Map<string, string>();
for (const configuration of BUILT_IN_API_KEY_PROVIDER_CONFIGURATIONS) {
  if (configuration.apiBaseUrl) {
    hosts.set(configuration.integrationId, configuration.apiBaseUrl);
  }
}

/** Providers whose packs were generated from a published spec. */
const GENERATED = new Set([
  "agentmail",
  "agentphone",
  "ahrefs",
  "apify",
  "daytona",
  "devin",
  "granola",
  "infisical",
  "instantly",
  "kalshi",
  "langsmith",
  "launchdarkly",
  "leadmagic",
  "lemlist",
  "loops",
  "mem0",
  "profound",
  "quartr",
  "rootly",
  "sentry",
  "sixtyfour-ai",
  "stagehand",
  "thrive",
  "uptimerobot",
  "incident-io",
  "clickup",
  "tailscale",
  "attio",
  "posthog",
]);

interface Probe {
  provider: string;
  action: string;
  url: string;
}

const probes: Probe[] = [];
for (const entry of readdirSync("src/server/providers", {
  withFileTypes: true,
})) {
  if (!entry.isDirectory() || !GENERATED.has(entry.name)) continue;
  const base = hosts.get(entry.name);
  if (!base) continue;
  const file = `src/server/providers/${entry.name}/index.ts`;
  if (!existsSync(file)) continue;
  const source = await Bun.file(file).text();
  const starts = [...source.matchAll(/^    action: "([a-z0-9-]+)",$/gmu)];
  let taken = 0;
  for (let n = 0; n < starts.length && taken < 4; n += 1) {
    const from = starts[n]!.index!;
    const to = n + 1 < starts.length ? starts[n + 1]!.index! : source.length;
    const block = source.slice(from, to);
    if (!/^    method: "GET",$/mu.test(block)) continue;
    // Prettier wraps a long url across lines, so it is read from `url:` up to
    // the `input:` that follows rather than as a single line.
    const urlAt = block.indexOf("    url: ");
    const inputAt = block.indexOf("    input: ", urlAt);
    if (urlAt < 0 || inputAt < 0) continue;
    const url = block
      .slice(urlAt + "    url: ".length, inputAt)
      .replace(/\s+/gu, " ")
      .trim()
      .replace(/,$/u, "");
    if (!url) continue;
    // Either a literal path, or a template whose only interpolation is the
    // query builder — with every query input omitted that yields the bare
    // path, which is still a parameter-free route.
    let literal = /^"(.+)"$/u.exec(url)?.[1];
    if (!literal) {
      const template = /`(.+)`$/u.exec(url)?.[1];
      if (!template) continue;
      // A path parameter gets a placeholder. Most APIs authenticate before
      // they look a resource up, so a 401 still proves the route; only a 404
      // becomes ambiguous, and it is reported as inconclusive rather than as
      // evidence the mapping is wrong.
      literal = template
        .replace(/\$\{restSegment\(i\.[A-Za-z0-9]+\)\}/gu, "smoke-probe")
        .replace(/\$\{restQuery\(\{[\s\S]*?\}\)\}/gu, "");
      if (literal.includes("${")) continue;
    }
    probes.push({
      provider: entry.name,
      action: starts[n]![1]!,
      url: `${base}${literal}`,
    });
    taken += 1;
  }
}

async function probe(target: Probe): Promise<string> {
  try {
    const response = await fetch(target.url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: { accept: "application/json" },
    });
    return String(response.status);
  } catch (error) {
    return (error as Error).name === "TimeoutError" ? "timeout" : "network";
  }
}

const results: Array<Probe & { status: string }> = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (cursor < probes.length) {
      const target = probes[cursor++]!;
      results.push({ ...target, status: await probe(target) });
    }
  }),
);

const byProvider = new Map<string, Array<(typeof results)[number]>>();
for (const result of results) {
  const list = byProvider.get(result.provider) ?? [];
  list.push(result);
  byProvider.set(result.provider, list);
}

const verdicts: string[] = [];
for (const [provider, list] of [...byProvider].sort()) {
  const codes = list.map((r) => r.status);
  const exists = codes.filter((c) => ["200", "401", "403", "429"].includes(c));
  const missing = list.filter((r) => r.status === "404");
  // A 404 against a placeholder id says nothing, so it never counts against a
  // mapping here; only the absence of any authenticated rejection does.
  const verdict =
    exists.length > 0
      ? "REACHABLE"
      : missing.length === list.length
        ? "404 ONLY"
        : "INCONCLUSIVE";
  verdicts.push(
    `${verdict.padEnd(13)} ${provider.padEnd(14)} ${list
      .map((r) => `${r.action}=${r.status}`)
      .join("  ")}`,
  );
}
console.log(verdicts.sort().join("\n"));
console.log(
  `\n${probes.length} GET routes probed across ${byProvider.size} providers`,
);
