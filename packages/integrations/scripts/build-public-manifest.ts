import { mkdir } from "node:fs/promises";

import {
  createPublicIntegrationManifest,
  serializePublicIntegrationManifest,
} from "../src/documentation";

const outputDirectory = new URL("../dist/", import.meta.url);
const outputPath = new URL("integrations.manifest.json", outputDirectory);

await mkdir(outputDirectory, { recursive: true });
const manifest = createPublicIntegrationManifest();
await Bun.write(outputPath, serializePublicIntegrationManifest(manifest));
console.log(
  `Wrote public manifest for ${manifest.integrations.length} integrations.`,
);
