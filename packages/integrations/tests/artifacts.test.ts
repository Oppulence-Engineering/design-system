import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test } from "bun:test";

const distDirectory = resolve(import.meta.dir, "../dist");

test("build emits every documented package entrypoint and the generated public manifest", () => {
  for (const entrypoint of [
    "index.js",
    "catalog.js",
    "contracts.js",
    "connection.js",
    "discovery.js",
    "documentation.js",
    "golden-journey.js",
    "kit.js",
    "logos.js",
    "logos-react.js",
    "parity.js",
    "provider-protocols.js",
    "execution-strategy.js",
    "reliability.js",
    "react.js",
    "registry.js",
    "support.js",
    "surfaces.js",
    "templates.js",
    "server/index.js",
    "server/browser.js",
    "integrations.manifest.json",
  ]) {
    expect(existsSync(resolve(distDirectory, entrypoint))).toBeTrue();
  }
  expect(
    existsSync(resolve(distDirectory, "integrations.discovery.json")),
  ).toBeFalse();
  expect(
    existsSync(resolve(distDirectory, "integration-metadata.js")),
  ).toBeFalse();
  expect(
    existsSync(resolve(distDirectory, "integration-metadata.d.ts")),
  ).toBeFalse();

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
  expect(manifest.integrations).toHaveLength(261);
  expect(manifest.details).toHaveLength(261);
  expect(manifest.parity).toMatchObject({
    catalogueOnly: 261,
    functionallySupported: 0,
    operationOrTriggerSupported: 0,
  });

  const logosReactBundle = readFileSync(
    resolve(distDirectory, "logos-react.js"),
    "utf8",
  );
  expect(logosReactBundle).toContain('from "./logos.js"');
  expect(logosReactBundle).not.toContain("data:image/");
  expect(Buffer.byteLength(logosReactBundle)).toBeLessThan(10_000);

  const logosReactDeclaration = readFileSync(
    resolve(distDirectory, "logos-react.d.ts"),
    "utf8",
  );
  expect(logosReactDeclaration).toContain("package bundles the data URI");
  expect(logosReactDeclaration).not.toContain("package owns the data URI");
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

/**
 * The server entry re-exports every package-owned vendor SDK, and the built
 * bundle marks them external — so importing it loads aws-sdk, googleapis,
 * stripe and the rest from disk. That takes seconds even on a warm local
 * machine, and it grew as providers landed. The default per-test timeout is
 * five seconds, which CI hardware exceeded while a laptop did not.
 */
const ARTIFACT_IMPORT_TIMEOUT_MS = 60_000;

test(
  "the built root entry resolves every documented runtime export",
  async () => {
    const entry = await import(
      `${resolve(distDirectory, "index.js")}?artifact-test`
    );
    expect(entry.getIntegration("quickbooks")?.id).toBe("quickbooks");
    expect(typeof entry.validateOutcomeTemplates).toBe("function");
    expect(typeof entry.createIntegrationDirectoryResolver).toBe("function");
    expect(typeof entry.getFunctionallySupportedIntegrationIds).toBe(
      "function",
    );
    expect(typeof entry.getOperationTriggerCoverageReport).toBe("function");
    expect(typeof entry.getSimStudioProviderProtocolReport).toBe("function");
    expect(typeof entry.getProviderExecutionStrategyReport).toBe("function");
    expect(typeof entry.createProductIntegrationKit).toBe("function");
    expect(typeof entry.runIntegrationGoldenJourney).toBe("function");
    expect(entry.getIntegrationDiscovery).toBeUndefined();
    expect(typeof entry.classifyIntegrationFailure).toBe("function");
    expect(typeof entry.getIntegrationOutcomeReadiness).toBe("function");
    expect(typeof entry.assertIntegrationOutcomeReadiness).toBe("function");
    expect(entry.getIntegrationLogo).toBeUndefined();

    const discovery = await import(
      `${resolve(distDirectory, "discovery.js")}?artifact-test`
    );
    expect(typeof discovery.getIntegrationDiscovery).toBe("function");
    const reliability = await import(
      `${resolve(distDirectory, "reliability.js")}?artifact-test`
    );
    expect(typeof reliability.planConnectionRecovery).toBe("function");
    const surfaces = await import(
      `${resolve(distDirectory, "surfaces.js")}?artifact-test`
    );
    expect(typeof surfaces.IntegrationSurfaceSchema.parse).toBe("function");
    const logos = await import(
      `${resolve(distDirectory, "logos.js")}?artifact-test`
    );
    expect(logos.INTEGRATION_LOGO_IDS).toHaveLength(261);
    expect(logos.getIntegrationLogo("stripe")?.dataUri).toStartWith(
      "data:image/svg+xml;base64,",
    );
    const logoReact = await import(
      `${resolve(distDirectory, "logos-react.js")}?artifact-test`
    );
    expect(typeof logoReact.IntegrationLogo).toBe("function");

    const server = await import(
      `${resolve(distDirectory, "server/index.js")}?artifact-test`
    );
    expect(typeof server.createIntegrationOAuthRuntime).toBe("function");
    expect(typeof server.createIntegrationApiKeyRuntime).toBe("function");
    expect(typeof server.createIntegrationConnectionLinkRuntime).toBe(
      "function",
    );
    expect(typeof server.createIntegrationConnectionLinkRoutes).toBe(
      "function",
    );
    expect(typeof server.createIntegrationWebhookRuntime).toBe("function");
    expect(typeof server.createIntegrationWebhookRoutes).toBe("function");
    expect(typeof server.createBuiltInIntegrationApiKeyRuntime).toBe(
      "function",
    );
    expect(Array.isArray(server.BUILT_IN_API_KEY_PROVIDER_CONFIGURATIONS)).toBe(
      true,
    );
    expect(typeof server.createIntegrationApiKeyRoutes).toBe("function");
    expect(typeof server.createApiKeyProviderSdk).toBe("function");
    expect(typeof server.createBrexProviderSdk).toBe("function");
    expect(typeof server.createPlaidProviderSdk).toBe("function");
    expect(typeof server.createMergeProviderSdk).toBe("function");
    expect(typeof server.createQuickBooksProviderSdk).toBe("function");
    expect(typeof server.createXeroProviderSdk).toBe("function");
    expect(typeof server.createSlackOAuth2Provider).toBe("function");
    expect(typeof server.createHubSpotOAuth2Provider).toBe("function");
    expect(typeof server.createLinearOAuth2Provider).toBe("function");
    expect(typeof server.createSlackProviderSdk).toBe("function");
    expect(typeof server.getSlackProviderSdkReport).toBe("function");
    expect(typeof server.createHubSpotProviderSdk).toBe("function");
    expect(typeof server.getHubSpotProviderSdkReport).toBe("function");
    expect(typeof server.createGitHubProviderSdk).toBe("function");
    expect(typeof server.getGitHubProviderSdkReport).toBe("function");
    expect(typeof server.createGitLabProviderSdk).toBe("function");
    expect(typeof server.getGitLabProviderSdkReport).toBe("function");
    expect(typeof server.createCloudflareProviderSdk).toBe("function");
    expect(typeof server.getCloudflareProviderSdkReport).toBe("function");
    expect(typeof server.createAirtableProviderSdk).toBe("function");
    expect(typeof server.getAirtableProviderSdkReport).toBe("function");
    expect(typeof server.createAirtableOAuth2Provider).toBe("function");
    expect(typeof server.createAsanaProviderSdk).toBe("function");
    expect(typeof server.getAsanaProviderSdkReport).toBe("function");
    expect(typeof server.createAsanaOAuth2Provider).toBe("function");
    expect(typeof server.createDropboxProviderSdk).toBe("function");
    expect(typeof server.getDropboxProviderSdkReport).toBe("function");
    expect(typeof server.createDropboxOAuth2Provider).toBe("function");
    expect(typeof server.createElevenLabsProviderSdk).toBe("function");
    expect(typeof server.getElevenLabsProviderSdkReport).toBe("function");
    expect(typeof server.createFirecrawlProviderSdk).toBe("function");
    expect(typeof server.getFirecrawlProviderSdkReport).toBe("function");
    expect(typeof server.createMailgunProviderSdk).toBe("function");
    expect(typeof server.getMailgunProviderSdkReport).toBe("function");
    expect(typeof server.createIntercomProviderSdk).toBe("function");
    expect(typeof server.getIntercomProviderSdkReport).toBe("function");
    expect(typeof server.createLinearProviderSdk).toBe("function");
    expect(typeof server.getLinearProviderSdkReport).toBe("function");
    expect(typeof server.createMailchimpProviderSdk).toBe("function");
    expect(typeof server.getMailchimpProviderSdkReport).toBe("function");
    expect(typeof server.createVercelProviderSdk).toBe("function");
    expect(typeof server.getVercelProviderSdkReport).toBe("function");
    expect(typeof server.createSquareProviderSdk).toBe("function");
    expect(typeof server.getSquareProviderSdkReport).toBe("function");
    expect(typeof server.createGoogleCalendarProviderSdk).toBe("function");
    expect(typeof server.getGoogleCalendarProviderSdkReport).toBe("function");
    expect(typeof server.createGoogleCalendarOAuth2Provider).toBe("function");
    expect(typeof server.createGoogleDriveProviderSdk).toBe("function");
    expect(typeof server.getGoogleDriveProviderSdkReport).toBe("function");
    expect(typeof server.createGoogleDriveOAuth2Provider).toBe("function");
    expect(typeof server.createGoogleSheetsProviderSdk).toBe("function");
    expect(typeof server.getGoogleSheetsProviderSdkReport).toBe("function");
    expect(typeof server.createGoogleSheetsOAuth2Provider).toBe("function");
    expect(typeof server.createGoogleDocsProviderSdk).toBe("function");
    expect(typeof server.getGoogleDocsProviderSdkReport).toBe("function");
    expect(typeof server.createGoogleDocsOAuth2Provider).toBe("function");
    expect(typeof server.createGoogleSlidesProviderSdk).toBe("function");
    expect(typeof server.getGoogleSlidesProviderSdkReport).toBe("function");
    expect(typeof server.createGoogleSlidesOAuth2Provider).toBe("function");
    expect(typeof server.createGmailProviderSdk).toBe("function");
    expect(typeof server.getGmailProviderSdkReport).toBe("function");
    expect(typeof server.createGmailOAuth2Provider).toBe("function");
    expect(typeof server.createGoogleFormsProviderSdk).toBe("function");
    expect(typeof server.getGoogleFormsProviderSdkReport).toBe("function");
    expect(typeof server.createGoogleFormsOAuth2Provider).toBe("function");
    expect(typeof server.createGoogleTasksProviderSdk).toBe("function");
    expect(typeof server.getGoogleTasksProviderSdkReport).toBe("function");
    expect(typeof server.createGoogleTasksOAuth2Provider).toBe("function");
    expect(typeof server.createGoogleContactsProviderSdk).toBe("function");
    expect(typeof server.getGoogleContactsProviderSdkReport).toBe("function");
    expect(typeof server.createGoogleContactsOAuth2Provider).toBe("function");
    expect(typeof server.createGoogleBooksProviderSdk).toBe("function");
    expect(typeof server.getGoogleBooksProviderSdkReport).toBe("function");
    expect(typeof server.createYouTubeProviderSdk).toBe("function");
    expect(typeof server.getYouTubeProviderSdkReport).toBe("function");
    expect(typeof server.createResendProviderSdk).toBe("function");
    expect(typeof server.getResendProviderSdkReport).toBe("function");
    expect(typeof server.createGoogleMeetProviderSdk).toBe("function");
    expect(typeof server.getGoogleMeetProviderSdkReport).toBe("function");
    expect(typeof server.createGoogleMeetOAuth2Provider).toBe("function");
    expect(typeof server.createGoogleGroupsProviderSdk).toBe("function");
    expect(typeof server.getGoogleGroupsProviderSdkReport).toBe("function");
    expect(typeof server.createGoogleGroupsOAuth2Provider).toBe("function");
    expect(typeof server.createStripeProviderSdk).toBe("function");
    expect(typeof server.getStripeProviderSdkReport).toBe("function");
    expect(typeof server.createIntegrationNoAuthRuntime).toBe("function");
    expect(typeof server.createIntegrationNoAuthRoutes).toBe("function");
    expect(typeof server.createUnauthenticatedProviderSdk).toBe("function");
    expect(typeof server.createIntegrationOAuthRoutes).toBe("function");
    expect(typeof server.createIntegrationProviderSdkRegistry).toBe("function");
    expect(typeof server.createIntegrationTypedRestProvider).toBe("function");
    expect(typeof server.createIntegrationSpecialProvider).toBe("function");
    expect(typeof server.assertProviderPackCoverage).toBe("function");
    expect(typeof server.getProviderPackContractIssues).toBe("function");
    expect(typeof server.getProviderPackCoverageReport).toBe("function");
    expect(typeof server.createIntegrationTriggerRuntime).toBe("function");
    expect(typeof server.createIntegrationTriggerRoutes).toBe("function");
    expect(typeof server.createInMemoryIntegrationTriggerStore).toBe(
      "function",
    );
    expect(typeof server.createMicrosoftGraphPack).toBe("function");
    expect(typeof server.createOutlookProviderSdk).toBe("function");
    expect(typeof server.createMicrosoftTeamsChatSubscriptionSource).toBe(
      "function",
    );
    expect(typeof server.createMicrosoftGraphOAuth2Provider).toBe("function");
    expect(typeof server.createAtlassianOAuth2Provider).toBe("function");
    expect(typeof server.createS3Pack).toBe("function");
    expect(typeof server.createPostgreSqlPack).toBe("function");
    expect(typeof server.createProtocolProviderSdk).toBe("function");
    expect(typeof server.createBuiltInProviderSdkRegistry).toBe("function");
    expect(typeof server.getProviderSdkCoverageReport).toBe("function");
    expect(typeof server.createIntegrationProviderExecutionRoutes).toBe(
      "function",
    );
    expect(typeof server.createIntegrationProductRoutes).toBe("function");
    expect(typeof server.composeIntegrationRoutes).toBe("function");

    const react = await import(
      `${resolve(distDirectory, "react.js")}?artifact-test`
    );
    expect(typeof react.createIntegrationConnectionLinkClient).toBe("function");
    expect(typeof react.PlaidConnectionLinkButton).toBe("function");
    expect(typeof react.MergeConnectionLinkButton).toBe("function");
  },
  ARTIFACT_IMPORT_TIMEOUT_MS,
);

test("the browser server stub prevents accidental provider-runtime imports", async () => {
  await expect(
    import(`${resolve(distDirectory, "server/browser.js")}?artifact-test`),
  ).rejects.toThrow("server-only");
});

// Vendor SDKs must load on first use, never at import time: one static import
// of `@vercel/sdk` alone costs every consumer ~590 MB of heap.
const SERVER_STATIC_IMPORT_ALLOW_LIST = new Set(["zod", "jose"]);
const SERVER_IMPORT_HEAP_BUDGET_MB = 150;

test("the server bundle statically imports no vendor SDK", () => {
  const bundle = readFileSync(
    resolve(distDirectory, "server/index.js"),
    "utf8",
  );
  const specifiers = [
    ...bundle.matchAll(/^(?:import|export)\s[^;]*?from\s*"([^"]+)"/gmu),
    ...bundle.matchAll(/^import\s*"([^"]+)"/gmu),
  ].map((match) => match[1] ?? "");
  const vendorSpecifiers = [...new Set(specifiers)].filter(
    (specifier) =>
      !specifier.startsWith("node:") &&
      !SERVER_STATIC_IMPORT_ALLOW_LIST.has(specifier),
  );

  expect(
    vendorSpecifiers,
    "load these SDKs with a literal await import() in the client factory",
  ).toEqual([]);
});

test(
  "importing the server bundle stays within the heap budget",
  () => {
    const probe = `
      import { heapStats } from "bun:jsc";
      const sample = () => {
        Bun.gc(true);
        return { heap: heapStats().heapSize, rss: process.memoryUsage().rss };
      };
      const before = sample();
      await import(${JSON.stringify(resolve(distDirectory, "server/index.js"))});
      const after = sample();
      const mb = (bytes) => Math.round(bytes / 2 ** 20);
      console.log(JSON.stringify({
        heapMb: mb(after.heap - before.heap),
        rssMb: mb(after.rss - before.rss),
      }));
    `;
    const result = Bun.spawnSync([process.execPath, "-e", probe]);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    const growth = JSON.parse(result.stdout.toString()) as {
      heapMb: number;
      rssMb: number;
    };
    console.log(`server import growth: ${JSON.stringify(growth)}`);

    expect(growth.heapMb).toBeLessThan(SERVER_IMPORT_HEAP_BUDGET_MB);
  },
  ARTIFACT_IMPORT_TIMEOUT_MS,
);

// The Canvas worker ships one `bun build` bundle with no vendor packages in
// node_modules. A provider SDK must therefore be inside the bundle, and it must
// still load only on first use.
test(
  "a bundled consumer runs provider SDKs without node_modules",
  async () => {
    const workDirectory = mkdtempSync(join(tmpdir(), "integrations-bundle-"));
    const entry = join(workDirectory, "entry.ts");
    writeFileSync(
      entry,
      `
      import { heapStats } from "bun:jsc";
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: "stubbed rejection" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      const sample = () => {
        Bun.gc(true);
        return heapStats().heapSize;
      };
      const before = sample();
      const server = await import(${JSON.stringify(resolve(distDirectory, "server/index.js"))});
      const importMb = Math.round((sample() - before) / 2 ** 20);
      const apiKeyRuntime = {
        withCredential: (_reference, operation) =>
          operation({ apiKey: "fake-key", fields: {} }),
      };
      const errors = {};
      for (const [create, integrationId, operationId, input] of [
        [server.createVercelProviderSdk, "vercel", "vercel:list-projects", {}],
        [server.createGitHubProviderSdk, "github", "github:get-repository-info", { owner: "o", repo: "r" }],
      ]) {
        const reference = server.createIntegrationCredentialReference({
          connectionId: "c1",
          integrationId,
          product: "eigenn",
        });
        try {
          await create({ apiKeyRuntime }).execute({ integrationId, operationId, reference, input });
          errors[integrationId] = "resolved";
        } catch (error) {
          errors[integrationId] = String(error);
        }
      }
      console.log(JSON.stringify({ importMb, errors }));
    `,
    );
    const build = await Bun.build({
      entrypoints: [entry],
      target: "bun",
      outdir: join(workDirectory, "out"),
    });
    expect(build.success, build.logs.join("\n")).toBeTrue();

    const result = Bun.spawnSync([process.execPath, "out/entry.js"], {
      cwd: workDirectory,
    });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    const report = JSON.parse(result.stdout.toString()) as {
      importMb: number;
      errors: Record<string, string>;
    };
    console.log(`bundled consumer: ${JSON.stringify(report)}`);

    expect(report.importMb).toBeLessThan(SERVER_IMPORT_HEAP_BUDGET_MB);
    // The stubbed vendor rejection proves the SDK loaded and sent a request.
    expect(report.errors.vercel).toContain("stubbed rejection");
    expect(report.errors.github).toContain("stubbed rejection");
  },
  ARTIFACT_IMPORT_TIMEOUT_MS,
);
