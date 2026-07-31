import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "bun:test";

const distDirectory = resolve(import.meta.dir, "../dist");

test("build emits every documented package entrypoint and the generated public manifest", () => {
  for (const entrypoint of [
    "index.js",
    "catalog.js",
    "contracts.js",
    "connection.js",
    "documentation.js",
    "golden-journey.js",
    "kit.js",
    "parity.js",
    "provider-protocols.js",
    "react.js",
    "registry.js",
    "support.js",
    "templates.js",
    "server/index.js",
    "server/browser.js",
    "integrations.manifest.json",
  ]) {
    expect(existsSync(resolve(distDirectory, entrypoint))).toBeTrue();
  }

  const manifest = JSON.parse(
    readFileSync(resolve(distDirectory, "integrations.manifest.json"), "utf8"),
  ) as {
    integrations: unknown[];
    details: unknown[];
    parity: {
      catalogueOnly: number;
      functionallySupported: number;
      operationOrTriggerSupported: number;
    };
  };
  expect(manifest.integrations).toHaveLength(254);
  expect(manifest.details).toHaveLength(254);
  expect(manifest.parity).toMatchObject({
    catalogueOnly: 254,
    functionallySupported: 0,
    operationOrTriggerSupported: 0,
  });
});

test("declares a browser-only stub for the server export", () => {
  const packageJson = JSON.parse(
    readFileSync(resolve(import.meta.dir, "../package.json"), "utf8"),
  ) as {
    exports: Record<string, { browser?: string }>;
  };
  expect(packageJson.exports["./server"]?.browser).toBe(
    "./dist/server/browser.js",
  );
});

test("the built root entry resolves every documented runtime export", async () => {
  const entry = await import(
    `${resolve(distDirectory, "index.js")}?artifact-test`
  );
  expect(entry.getIntegration("quickbooks")?.id).toBe("quickbooks");
  expect(typeof entry.validateOutcomeTemplates).toBe("function");
  expect(typeof entry.createIntegrationDirectoryResolver).toBe("function");
  expect(typeof entry.getFunctionallySupportedIntegrationIds).toBe("function");
  expect(typeof entry.getOperationTriggerCoverageReport).toBe("function");
  expect(typeof entry.getSimStudioProviderProtocolReport).toBe("function");
  expect(typeof entry.createProductIntegrationKit).toBe("function");
  expect(typeof entry.runIntegrationGoldenJourney).toBe("function");

  const server = await import(
    `${resolve(distDirectory, "server/index.js")}?artifact-test`
  );
  expect(typeof server.createIntegrationOAuthRuntime).toBe("function");
  expect(typeof server.createIntegrationApiKeyRuntime).toBe("function");
  expect(typeof server.createIntegrationApiKeyRoutes).toBe("function");
  expect(typeof server.createApiKeyProviderSdk).toBe("function");
  expect(typeof server.createIntegrationNoAuthRuntime).toBe("function");
  expect(typeof server.createIntegrationNoAuthRoutes).toBe("function");
  expect(typeof server.createUnauthenticatedProviderSdk).toBe("function");
  expect(typeof server.createIntegrationOAuthRoutes).toBe("function");
  expect(typeof server.createIntegrationProductRoutes).toBe("function");
  expect(typeof server.composeIntegrationRoutes).toBe("function");
});

test("the browser server stub prevents accidental provider-runtime imports", async () => {
  await expect(
    import(`${resolve(distDirectory, "server/browser.js")}?artifact-test`),
  ).rejects.toThrow("server-only");
});
