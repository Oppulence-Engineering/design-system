export {};

/**
 * Rewrites the pinned figures in the coverage gate and the server test from
 * the live registry.
 *
 * The numbers are the reviewable statement that a provider landed, so they
 * still have to move in a commit — but transcribing eight of them by hand once
 * per provider is how a wrong one gets in, and a wrong pinned number either
 * hides a regression or fails for no reason.
 */
import { SIMSTUDIO_BASELINE } from "../src/catalog";
import {
  BUILT_IN_API_KEY_PROVIDER_CONFIGURATIONS,
  BUILT_IN_PROVIDER_PACKS,
  createBuiltInProviderSdkRegistry,
  getProviderPackCoverageReport,
  getProviderSdkCoverageReport,
} from "../src/server";

const runtime = {
  async withCredential<T>(_reference: unknown, run: (c: any) => Promise<T>) {
    return run({
      apiKey: "k",
      accessToken: "t",
      scope: [],
      tokenType: "Bearer",
      fields: { secretAccessKey: "s" },
    });
  },
  async request() {
    return Response.json({});
  },
};

const full = createBuiltInProviderSdkRegistry({
  apiKeyRuntime: runtime as never,
  oauthRuntime: runtime as never,
  noAuthRuntime: runtime as never,
});
const report = getProviderSdkCoverageReport(full);
const packs = getProviderPackCoverageReport(BUILT_IN_PROVIDER_PACKS);

// The server test builds a registry without the no-auth runtime, so its
// figures are a subset and cannot be reused from the report above.
const partial = getProviderSdkCoverageReport(
  createBuiltInProviderSdkRegistry({
    apiKeyRuntime: runtime as never,
    oauthRuntime: runtime as never,
  }),
);

const executableIds = SIMSTUDIO_BASELINE.integrations
  .filter((integration) => full.get(integration.id))
  .map((integration) => integration.id)
  .sort();

const sourceActions = SIMSTUDIO_BASELINE.integrations.reduce(
  (total, integration) => total + integration.operations.length,
  0,
);

function replace(source: string, pattern: RegExp, value: string): string {
  if (!pattern.test(source)) throw new Error(`no match for ${pattern}`);
  return source.replace(pattern, value);
}

let gate = await Bun.file("tests/coverage-gate.test.ts").text();
gate = replace(
  gate,
  /const EXECUTABLE_PROVIDERS = \d+;/u,
  `const EXECUTABLE_PROVIDERS = ${report.executableProviders};`,
);
gate = replace(
  gate,
  /const EXECUTABLE_ACTIONS = \d+;/u,
  `const EXECUTABLE_ACTIONS = ${report.executableOperations};`,
);
gate = replace(
  gate,
  /expect\(report\.providers\)\.toBe\(\d+\);/u,
  `expect(report.providers).toBe(${packs.providers});`,
);
gate = replace(
  gate,
  /expect\(report\.deferredOperations\)\.toBe\(\d+\);/u,
  `expect(report.deferredOperations).toBe(${packs.deferredOperations});`,
);
gate = replace(
  gate,
  /expect\(report\.byLane\.typed_rest\.operations\)\.toBe\(\d+\);/u,
  `expect(report.byLane.typed_rest.operations).toBe(${packs.byLane.typed_rest.operations});`,
);
gate = replace(
  gate,
  /expect\(restActions\)\.toHaveLength\(\d+\);/u,
  `expect(restActions).toHaveLength(${packs.byLane.typed_rest.operations});`,
);
gate = replace(
  gate,
  /providersRemaining: \d+,\n {6}actionsRemaining: \d+,/u,
  `providersRemaining: ${232 - report.executableProviders},\n      actionsRemaining: ${sourceActions - report.executableOperations},`,
);
await Bun.write("tests/coverage-gate.test.ts", gate);

let server = await Bun.file("tests/server.test.ts").text();
// Two expectations in this file share the shape; the standard-registry one is
// the last. Replacing the first clobbers a focused single-provider test.
{
  const pattern = /executableProviders: \d+,\n {6}executableOperations: \d+,/gu;
  const matches = [...server.matchAll(pattern)];
  const last = matches.at(-1);
  if (!last) throw new Error("no executable figures in tests/server.test.ts");
  server =
    server.slice(0, last.index) +
    `executableProviders: ${partial.executableProviders},\n      executableOperations: ${partial.executableOperations},` +
    server.slice(last.index! + last[0].length);
}
const profiles = BUILT_IN_API_KEY_PROVIDER_CONFIGURATIONS.map(
  (configuration) => `      ${JSON.stringify(configuration.integrationId)},`,
).join("\n");
server = replace(
  server,
  /(\)\.toEqual\(\[\n)(?: {6}"[a-z0-9-]+",\n)+( {4}\]\);)/u,
  `$1${profiles}\n$2`,
);
await Bun.write("tests/server.test.ts", server);

let executable = await Bun.file("src/executable.ts").text();
executable = replace(
  executable,
  /export const EXECUTABLE_INTEGRATION_IDS: readonly string\[\] = \[\n(?: {2}"[a-z0-9-]+",\n)+\];/u,
  `export const EXECUTABLE_INTEGRATION_IDS: readonly string[] = [\n${executableIds
    .map((id) => `  ${JSON.stringify(id)},`)
    .join("\n")}\n];`,
);
await Bun.write("src/executable.ts", executable);

console.log(
  `gate synced: ${report.executableProviders} providers, ${report.executableOperations} actions, ${packs.deferredOperations} deferred`,
);
