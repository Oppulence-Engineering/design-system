/**
 * Creates the smallest contract-valid provider pack scaffold. The generated
 * pack deliberately defers every source operation and trigger with an explicit
 * reason, so implementation work cannot silently drop source coverage.
 *
 * Usage:
 *   bun run providers:scaffold -- stripe
 *   bun run providers:scaffold -- stripe --dry-run
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { getIntegration, IntegrationIdSchema } from "../src";
import { metadataForIntegration } from "../src/integration-metadata";

function pascalCase(value: string): string {
  return value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function quote(value: string): string {
  return JSON.stringify(value);
}

export function scaffoldFor(integrationId: string): string {
  const definition = getIntegration(integrationId);
  if (!definition) {
    throw new Error(`unknown integration: ${integrationId}`);
  }
  const canonicalIntegrationId = definition.id;
  const metadata = metadataForIntegration(canonicalIntegrationId);
  const surfaceId =
    metadata?.surfaces.length === 1 ? metadata.surfaces[0]?.id : undefined;
  const operations = definition.operations
    .map(
      (operation) =>
        `    { sourceOperationId: ${quote(operation.id)},${surfaceId ? ` surfaceId: ${quote(surfaceId)},` : ""} disposition: "deferred", reason: "Implement and verify the provider operation." },`,
    )
    .join("\n");
  const triggers = definition.triggers
    .map(
      (trigger) =>
        `    { sourceTriggerId: ${quote(trigger.id)},${surfaceId ? ` surfaceId: ${quote(surfaceId)},` : ""} disposition: "deferred", reason: "Implement and verify the provider trigger." },`,
    )
    .join("\n");
  const factory = `create${pascalCase(canonicalIntegrationId)}Pack`;
  return `import type { IntegrationProviderPack } from "../../core/provider-pack";

/**
 * Generated scaffold for ${canonicalIntegrationId}. Replace deferred entries
 * only after the provider's official API documentation and credential flow are
 * reviewed. Register the completed pack in providers/registry.ts.
 */
export function ${factory}(): IntegrationProviderPack {
  return {
    integrationId: ${quote(canonicalIntegrationId)},
    coverage: [
${operations || "      // This provider currently has no source operations."}
    ],
    triggerCoverage: [
${triggers || "      // This provider currently has no source triggers."}
    ],
    create: () => [],
  };
}

`;
}

/** Adds a generated pack to the single executable-provider registry. */
export function registerProviderPack(
  registrySource: string,
  integrationId: string,
): string {
  const canonicalIntegrationId = IntegrationIdSchema.parse(integrationId);
  const factory = `create${pascalCase(canonicalIntegrationId)}Pack`;
  const importLine = `import { ${factory} } from "./${canonicalIntegrationId}";`;
  if (registrySource.includes(importLine)) {
    return registrySource;
  }
  const registryComment = "/**\n * Every provider pack";
  const commentIndex = registrySource.indexOf(registryComment);
  if (commentIndex === -1) {
    throw new Error("provider registry header not found");
  }
  const registryEnd = registrySource.lastIndexOf("\n];");
  if (registryEnd === -1) {
    throw new Error("provider registry array not found");
  }
  const withImport = `${registrySource.slice(0, commentIndex)}${importLine}\n${registrySource.slice(commentIndex)}`;
  const adjustedEnd = withImport.lastIndexOf("\n];");
  return `${withImport.slice(0, adjustedEnd)}  ${factory}(),\n${withImport.slice(adjustedEnd)}`;
}

if (import.meta.main) {
  const [, , rawId, ...flags] = process.argv;
  if (!rawId) {
    console.error("usage: providers:scaffold <integration-id> [--dry-run]");
    process.exit(1);
  }
  const integrationId = IntegrationIdSchema.parse(rawId);
  const definition = getIntegration(integrationId);
  if (!definition) {
    throw new Error(`unknown integration: ${integrationId}`);
  }
  const canonicalIntegrationId = definition.id;
  const outputDirectory = join(
    process.cwd(),
    "src",
    "server",
    "providers",
    canonicalIntegrationId,
  );
  const outputPath = join(outputDirectory, "index.ts");
  const registryPath = join(
    process.cwd(),
    "src",
    "server",
    "providers",
    "registry.ts",
  );
  const contents = scaffoldFor(integrationId);

  if (flags.includes("--dry-run")) {
    process.stdout.write(contents);
    process.exit(0);
  }

  if (await Bun.file(outputPath).exists()) {
    throw new Error(`provider module already exists: ${outputPath}`);
  }
  await mkdir(outputDirectory, { recursive: true });
  await Bun.write(outputPath, contents);
  const registry = await Bun.file(registryPath).text();
  await Bun.write(
    registryPath,
    registerProviderPack(registry, canonicalIntegrationId),
  );
  console.log(`Wrote ${outputPath}`);
  console.log(`Registered ${canonicalIntegrationId} in ${registryPath}`);
}
