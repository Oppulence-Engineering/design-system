import { describe, expect, test } from "bun:test";

import { INTEGRATION_CATALOGUE, SIMSTUDIO_BASELINE } from "../src/catalog";
import { assertSimStudioParity, getSimStudioParityReport } from "../src/parity";

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
});
