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

  test("the server entry uses Node-resolvable Next.js imports", async () => {
    const serverArtifact = await readArtifact("server.js");

    expect(serverArtifact).toContain('from "next/headers.js"');
    expect(serverArtifact).not.toContain('from "next/headers"');
  });

  // The server entry was fixed in #10; the client entry kept the bare specifier
  // and broke every Node-run test whose module graph reached it
  // (ERR_MODULE_NOT_FOUND on `next/script`). Guard both entries, not just one.
  test("the client entry uses Node-resolvable Next.js imports", async () => {
    const clientArtifact = await readArtifact("client.js");

    expect(clientArtifact).toContain('from "next/script.js"');
    expect(clientArtifact).not.toContain('from "next/script"');
  });
});
