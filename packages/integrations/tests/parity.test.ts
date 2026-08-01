import { describe, expect, test } from "bun:test";

import { INTEGRATION_CATALOGUE, SIMSTUDIO_BASELINE } from "../src/catalog";
import { assertSimStudioParity, getSimStudioParityReport } from "../src/parity";
import {
  assertSimStudioProviderProtocolParity,
  getSimStudioProviderProtocolReport,
} from "../src/provider-protocols";
import {
  getProviderExecutionStrategies,
  getProviderExecutionStrategyReport,
} from "../src/execution-strategy";

describe("Sim Studio parity baseline", () => {
  test("preserves every provider, operation, and trigger from the pinned source", () => {
    const report = getSimStudioParityReport();
    expect(SIMSTUDIO_BASELINE.sourceCommit).toBe(
      "2a6267391d24d4e10e043ce474615ce9f5d1c22a",
    );
    expect(SIMSTUDIO_BASELINE.sourceBlob).toBe(
      "deadb0012bc33708e4c1500b08b1aa8c9ae533e1",
    );
    expect(report.baseline.providers).toBe(232);
    expect(report.baseline.operations).toBe(3890);
    expect(report.baseline.triggers).toBe(363);
    expect(report.catalogue.matched).toBe(232);
    expect(report.catalogue.missing).toHaveLength(0);
    expect(report.catalogue.ambiguous).toHaveLength(0);
    expect(report.catalogue.renamed).toHaveLength(0);
    expect(report.catalogue.operationChanges).toHaveLength(0);
    expect(report.catalogue.triggerChanges).toHaveLength(0);
    expect(report.catalogue.extras).toContain("quickbooks");
    expect(report.catalogue.catalogueOnly).toHaveLength(232);
    expect(report.catalogue.functional).toHaveLength(0);
    expect(report.catalogue.operationOrTriggerSupported).toHaveLength(0);
    assertSimStudioParity();
  });

  test("fails if a source provider is not mapped", () => {
    expect(() => assertSimStudioParity(INTEGRATION_CATALOGUE.slice(1))).toThrow(
      "Sim Studio parity drift detected",
    );
  });

  test("maps every pinned source provider to a shared credential transport family", () => {
    const report = getSimStudioProviderProtocolReport();
    expect(report.baseline).toEqual({
      providers: 232,
      protocols: { api_key: 163, oauth2: 50, none: 19 },
    });
    expect(report.catalogue.covered).toBe(232);
    expect(report.catalogue.missing).toHaveLength(0);
    expect(report.catalogue.authMethodMismatches).toHaveLength(0);
    assertSimStudioProviderProtocolParity();
  });

  test("assigns every source provider to an explicit SDK, typed REST, or special execution track", () => {
    const strategies = getProviderExecutionStrategies();
    const report = getProviderExecutionStrategyReport();

    expect(strategies).toHaveLength(232);
    expect(
      new Set(strategies.map((strategy) => strategy.integrationId)).size,
    ).toBe(232);
    expect(report).toEqual({
      providers: 232,
      operations: 3890,
      triggers: 363,
      byKind: {
        installed_vendor_sdk: { providers: 32, operations: 887, triggers: 63 },
        vendor_sdk_candidate: {
          providers: 45,
          operations: 609,
          triggers: 32,
        },
        maintained_sdk_candidate: {
          providers: 8,
          operations: 261,
          triggers: 52,
        },
        typed_rest_candidate: {
          providers: 122,
          operations: 2038,
          triggers: 205,
        },
        special_provider: { providers: 7, operations: 95, triggers: 0 },
        no_runtime_actions: { providers: 18, operations: 0, triggers: 11 },
      },
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "linear"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "@linear/sdk",
      operations: 78,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "vercel"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "@vercel/sdk",
      operations: 56,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "square"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "square",
      operations: 34,
    });
    expect(
      strategies.find(
        (strategy) => strategy.integrationId === "google-calendar",
      ),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "googleapis",
      operations: 18,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "google-drive"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "googleapis",
      operations: 24,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "google-sheets"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "googleapis",
      operations: 14,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "google-docs"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "googleapis",
      operations: 15,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "google-forms"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "googleapis",
      operations: 9,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "google-tasks"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "googleapis",
      operations: 6,
    });
    expect(
      strategies.find(
        (strategy) => strategy.integrationId === "google-contacts",
      ),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "googleapis",
      operations: 6,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "google-books"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "googleapis",
      operations: 2,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "google-meet"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "googleapis",
      operations: 6,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "google-groups"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "googleapis",
      operations: 16,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "youtube"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "googleapis",
      operations: 9,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "resend"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "resend",
      operations: 16,
      triggers: 8,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "google-slides"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "googleapis",
      operations: 52,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "gmail"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "googleapis",
      operations: 13,
      triggers: 1,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "gitlab"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "@gitbeaker/rest",
      operations: 65,
      triggers: 6,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "cloudflare"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "cloudflare",
      operations: 13,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "airtable"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "airtable",
      operations: 10,
      triggers: 1,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "asana"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "asana",
      operations: 14,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "dropbox"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "dropbox",
      operations: 13,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "elevenlabs"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "@elevenlabs/elevenlabs-js",
      operations: 10,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "firecrawl"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "@mendable/firecrawl-js",
      operations: 13,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "mailgun"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "mailgun.js",
      operations: 8,
    });
    expect(
      strategies.find((strategy) => strategy.integrationId === "intercom"),
    ).toMatchObject({
      kind: "installed_vendor_sdk",
      packageName: "intercom-client",
      operations: 31,
      triggers: 6,
    });
  });
});
