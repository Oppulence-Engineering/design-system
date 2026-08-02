export {};

/**
 * Mechanical bug hunt across every typed REST pack.
 *
 * Each check targets a defect that typechecks, satisfies the pack contract,
 * and reports as executable — the class the wire tests cannot catch, because a
 * pinned shape generated from a wrong mapping pins the wrong shape.
 *
 * The noun check is a heuristic and its remaining hits are vendor vocabulary:
 * Discord calls a server a guild, ClickUp calls a workspace a team, LinkedIn's
 * profile is the OIDC userinfo route. Read them, do not chase them to zero.
 *
 * Run by hand after generating a provider: bun run providers:audit
 */
import { readdirSync, existsSync } from "node:fs";

interface Action {
  provider: string;
  name: string;
  method: string;
  url: string;
  inputKeys: string[];
  refs: string[];
  block: string;
}

const actions: Action[] = [];
for (const entry of readdirSync("src/server/providers", {
  withFileTypes: true,
})) {
  if (!entry.isDirectory()) continue;
  const file = `src/server/providers/${entry.name}/index.ts`;
  if (!existsSync(file)) continue;
  const source = await Bun.file(file).text();
  if (!source.includes("createRestPack")) continue;
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
    const method = /^    method: "([A-Z]+)",$/mu.exec(block)?.[1] ?? "";
    const urlAt = block.indexOf("    url: ");
    const inputAt = block.indexOf("    input: ", urlAt);
    const url =
      urlAt >= 0 && inputAt >= 0
        ? block
            .slice(urlAt + 9, inputAt)
            .replace(/\s+/gu, " ")
            .trim()
            .replace(/,$/u, "")
        : "";
    const strictAt = block.indexOf(".strict()", inputAt);
    const inputBlock = block.slice(
      inputAt,
      strictAt < 0 ? undefined : strictAt,
    );
    actions.push({
      provider: entry.name,
      name: starts[n]![1]!,
      method,
      url,
      // Any key in the schema slice, not only 8-space-indented ones: a
      // single-line z.object({ a, b }).strict() is just as valid.
      inputKeys: [...inputBlock.matchAll(/\b([A-Za-z][A-Za-z0-9]*)\s*:/gu)]
        .map((m) => m[1]!)
        .filter((k) => k !== "input"),
      refs: [
        ...new Set(
          [...block.matchAll(/\bi\.([A-Za-z0-9]+)/gu)].map((m) => m[1]!),
        ),
      ],
      block,
    });
  }
}

const findings: Array<{ kind: string; provider: string; detail: string }> = [];
const add = (kind: string, provider: string, detail: string) =>
  findings.push({ kind, provider, detail });

// 1. A path parameter the schema never declares can never be supplied, so the
//    action is unusable — restSegment throws on undefined.
for (const action of actions) {
  for (const match of action.url.matchAll(
    /restSegment\(i\.([A-Za-z0-9]+)\)/gu,
  )) {
    if (!action.inputKeys.includes(match[1]!)) {
      add(
        "path-param-undeclared",
        action.provider,
        `${action.name} interpolates i.${match[1]} which the input schema does not declare`,
      );
    }
  }
}

// 2. Two actions on the same provider bound to the same method and path. One
//    of them is almost always the wrong binding.
const byRoute = new Map<string, Action[]>();
for (const action of actions) {
  const key = `${action.provider} ${action.method} ${action.url.replace(/\$\{restQuery\([\s\S]*?\)\}/gu, "")}`;
  byRoute.set(key, [...(byRoute.get(key) ?? []), action]);
}
for (const [key, group] of byRoute) {
  if (group.length > 1) {
    add(
      "duplicate-route",
      group[0]!.provider,
      `${group.map((a) => a.name).join(" and ")} both request ${key.split(" ").slice(1).join(" ")}`,
    );
  }
}

// 3. The action's verb disagrees with the HTTP method. "list" over POST can be
//    a legitimate query endpoint, so only the impossible pairs are flagged.
const IMPOSSIBLE: Array<[RegExp, string[]]> = [
  [/^(delete|remove|destroy)-/u, ["GET"]],
  [/^(list|get|show|read)-/u, ["DELETE"]],
];
for (const action of actions) {
  for (const [pattern, methods] of IMPOSSIBLE) {
    if (pattern.test(action.name) && methods.includes(action.method)) {
      add(
        "verb-method-conflict",
        action.provider,
        `${action.name} is a ${action.method}`,
      );
    }
  }
}

// 4. The action's resource noun appears nowhere in its path. A read of one
//    resource bound to another answers successfully with the wrong thing.
const STOP = new Set([
  "list",
  "get",
  "show",
  "read",
  "create",
  "add",
  "update",
  "edit",
  "delete",
  "remove",
  "set",
  "search",
  "query",
  "run",
  "batch",
  "check",
  "all",
  "the",
  "by",
  "for",
  "new",
]);
function stem(word: string): string {
  return word.endsWith("ies")
    ? `${word.slice(0, -3)}y`
    : word.endsWith("s") && !word.endsWith("ss")
      ? word.slice(0, -1)
      : word;
}
for (const action of actions) {
  const nouns = action.name
    .split("-")
    .filter((w) => !STOP.has(w))
    .map(stem);
  if (!nouns.length) continue;
  // Stem both sides and compare tokens. Substring-matching a stem fails on
  // exactly the regular plurals it was meant to handle: "entry" is not a
  // substring of "entries".
  const pathWords = new Set(
    action.url
      // Keep string literals from inside an interpolation before dropping it:
      // PostHog names its resource in projectPath(i.projectId, "persons").
      // Pad the replacement: without surrounding spaces the text either side
      // of an interpolation fuses, and "/accounts${...\"tag.name\"...}" became
      // the single token "accountstag".
      .replace(
        /\$\{([^}]*)\}/gu,
        (_m, inner) =>
          ` ${[...String(inner).matchAll(/"([^"]+)"/gu)].map((q) => q[1]).join(" ")} `,
      )
      // Split camelCase too: Telegram spells its methods /sendMessage, which
      // a non-alphanumeric split leaves as one token.
      .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter(Boolean)
      .map(stem),
  );
  if (!nouns.some((noun) => pathWords.has(noun))) {
    add(
      "noun-absent-from-path",
      action.provider,
      `${action.name} — no part of "${nouns.join(", ")}" appears in ${action.url.slice(0, 70)}`,
    );
  }
}

// 5. A write with no body and no path parameter sends an empty request to a
//    collection, which is rarely what a create means.
for (const action of actions) {
  if (!["POST", "PUT", "PATCH"].includes(action.method)) continue;
  if (action.block.includes("    body: ")) continue;
  if (action.url.includes("restSegment")) continue;
  if (action.inputKeys.length > 0) continue;
  add(
    "write-without-body",
    action.provider,
    `${action.name} ${action.method}s with no body and no parameters`,
  );
}

const byKind = new Map<string, typeof findings>();
for (const finding of findings) {
  byKind.set(finding.kind, [...(byKind.get(finding.kind) ?? []), finding]);
}
for (const [kind, list] of [...byKind].sort(
  (a, b) => b[1].length - a[1].length,
)) {
  console.log(`\n=== ${kind}: ${list.length} ===`);
  for (const finding of list.slice(0, 30)) {
    console.log(`  ${finding.provider.padEnd(14)} ${finding.detail}`);
  }
  if (list.length > 30) console.log(`  … ${list.length - 30} more`);
}
console.log(`\n${actions.length} actions audited, ${findings.length} findings`);
