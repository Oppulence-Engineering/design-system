import { mkdir, unlink } from "node:fs/promises";

import {
  createPublicIntegrationManifest,
  serializePublicIntegrationManifest,
} from "../src/documentation";

const outputDirectory = new URL("../dist/", import.meta.url);
const outputPath = new URL("integrations.manifest.json", outputDirectory);

await mkdir(outputDirectory, { recursive: true });
await unlink(new URL("integrations.discovery.json", outputDirectory)).catch(
  () => undefined,
);
for (const artifact of [
  "integration-metadata.js",
  "integration-metadata.d.ts",
  "integration-metadata.js.map",
  "integration-metadata.d.ts.map",
]) {
  await unlink(new URL(artifact, outputDirectory)).catch(() => undefined);
}
const manifest = createPublicIntegrationManifest();
await Bun.write(outputPath, serializePublicIntegrationManifest(manifest));
console.log(
  `Wrote public manifest for ${manifest.integrations.length} integrations.`,
);
