import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(packageRoot, "src");
const packageJson = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
) as { dependencies?: Record<string, string> };

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return extname(entry.name) === ".ts" || extname(entry.name) === ".tsx"
      ? [path]
      : [];
  });
}

function importSpecifiers(source: string): string[] {
  return [
    ...source.matchAll(
      /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    ),
  ].map((match) => match[1]);
}

describe("browser-safe package boundary", () => {
  test("keeps zod as the only core runtime dependency", () => {
    expect(packageJson.dependencies).toEqual({ zod: "^4.3.6" });
  });

  test("keeps server runtime modules out of browser-safe entrypoints", () => {
    const forbidden =
      /^(?:node:|next(?:\/|$)|@prisma(?:\/|$)|drizzle(?:\/|$)|@trpc(?:\/|$)|express(?:\/|$)|hono(?:\/|$)|.*(?:oauth|secret|provider-sdk|database|router).*)/i;
    const browserSourceFiles = sourceFiles(sourceRoot).filter(
      (path) => !path.includes(`${join(sourceRoot, "server")}/`),
    );
    const violations = browserSourceFiles.flatMap((path) =>
      importSpecifiers(readFileSync(path, "utf8"))
        .filter((specifier) => forbidden.test(specifier))
        .map((specifier) => `${path}:${specifier}`),
    );

    expect(violations).toEqual([]);
  });
});
