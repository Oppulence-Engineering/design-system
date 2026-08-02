/**
 * Prints what the pinned SimStudio baseline records for a provider: its auth
 * type, every action ID with its label, and its triggers. This is the input to
 * writing a pack — the baseline is the authority on *which* actions exist, and
 * a pack that omits one must defer it with a reason.
 *
 * The baseline carries no endpoint, method, or parameter data, so the request
 * mapping still comes from the provider's real API documentation.
 *
 *   bun scripts/provider-plan.ts discord
 *   bun scripts/provider-plan.ts discord --json
 */
import { SIMSTUDIO_BASELINE } from "../src/catalog";
import { getProviderExecutionStrategies } from "../src/execution-strategy";

const [, , id, ...flags] = process.argv;
if (!id) {
  console.error(
    "usage: bun scripts/provider-plan.ts <integration-id> [--json]",
  );
  process.exit(1);
}

const integration = SIMSTUDIO_BASELINE.integrations.find(
  (candidate) => candidate.id === id,
);
if (!integration) {
  const near = SIMSTUDIO_BASELINE.integrations
    .map((candidate) => candidate.id)
    .filter((candidate) => candidate.includes(id))
    .slice(0, 10);
  console.error(`unknown provider "${id}".`);
  if (near.length) console.error(`did you mean: ${near.join(", ")}`);
  process.exit(1);
}

if (flags.includes("--json")) {
  console.log(JSON.stringify(integration, null, 2));
  process.exit(0);
}

const strategy = getProviderExecutionStrategies().find(
  (candidate) => candidate.integrationId === id,
);

console.log(`${integration.id} — ${integration.name}`);
console.log(`  auth      ${integration.sourceAuthType}`);
console.log(`  strategy  ${strategy?.kind ?? "unclassified"}`);
if (strategy?.packageName) console.log(`  package   ${strategy.packageName}`);
console.log(
  `  surface   ${integration.operations.length} actions, ${integration.triggers.length} triggers`,
);

console.log(`\nactions`);
for (const operation of integration.operations) {
  const action = operation.id.slice(operation.id.indexOf(":") + 1);
  console.log(`  ${action.padEnd(38)} ${operation.label}`);
}

if (integration.triggers.length) {
  console.log(`\ntriggers`);
  for (const trigger of integration.triggers) {
    const suffix = trigger.id.slice(trigger.id.indexOf(":") + 1);
    console.log(`  ${suffix.padEnd(38)} ${trigger.label}`);
  }
}

console.log(`\naction id list (for the pack's action table)`);
console.log(
  integration.operations
    .map(
      (operation) => `"${operation.id.slice(operation.id.indexOf(":") + 1)}"`,
    )
    .join(", "),
);
