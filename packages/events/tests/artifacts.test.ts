import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const DIST_ROOT = path.resolve(import.meta.dir, "../dist");
const CLIENT_DIRECTIVE = '"use client";';

const readArtifact = (name: string): Promise<string> =>
  readFile(path.join(DIST_ROOT, name), "utf8");

describe("published artifacts", () => {
  test.each(["client.js", "identity.js"])(
    "%s starts with the React client directive",
    async (artifactName) => {
      const artifact = await readArtifact(artifactName);

      expect(artifact.startsWith(CLIENT_DIRECTIVE)).toBe(true);
    },
  );

  test("the root entry remains server-safe", async () => {
    const rootArtifact = await readArtifact("index.js");

    expect(rootArtifact).not.toContain(CLIENT_DIRECTIVE);
  });
});
