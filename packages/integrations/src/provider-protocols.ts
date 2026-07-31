import { INTEGRATION_CATALOGUE, SIMSTUDIO_BASELINE } from "./catalog";
import type {
  IntegrationAuthMethod,
  IntegrationDefinition,
  Product,
} from "./contracts";

export type SimStudioProviderProtocol = "api_key" | "oauth2" | "none";

export interface SimStudioProviderProtocolGap {
  integrationId: string;
  product?: Product;
  reason: "missing" | "auth-method-mismatch";
  detail: string;
}

export interface SimStudioProviderProtocolReport {
  baseline: {
    providers: number;
    protocols: Readonly<Record<SimStudioProviderProtocol, number>>;
  };
  catalogue: {
    covered: number;
    missing: readonly SimStudioProviderProtocolGap[];
    authMethodMismatches: readonly SimStudioProviderProtocolGap[];
  };
}

const SIMSTUDIO_AUTH_TO_PROTOCOL: Readonly<
  Record<"api-key" | "oauth" | "none", SimStudioProviderProtocol>
> = {
  "api-key": "api_key",
  oauth: "oauth2",
  none: "none",
};

const PROTOCOL_AUTH_METHOD: Readonly<
  Record<SimStudioProviderProtocol, IntegrationAuthMethod>
> = {
  api_key: "api_key",
  oauth2: "oauth2",
  none: "none",
};

/**
 * Checks auth-protocol coverage against the pinned Sim Studio source. This is
 * intentionally narrower than functional parity: it proves that every source
 * provider maps to one shared transport family, not that a product has
 * shipped every operation or customer outcome.
 */
export function getSimStudioProviderProtocolReport(
  definitions: readonly IntegrationDefinition[] = INTEGRATION_CATALOGUE,
): SimStudioProviderProtocolReport {
  const byId = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  const protocols: Record<SimStudioProviderProtocol, number> = {
    api_key: 0,
    oauth2: 0,
    none: 0,
  };
  const missing: SimStudioProviderProtocolGap[] = [];
  const authMethodMismatches: SimStudioProviderProtocolGap[] = [];
  let covered = 0;

  for (const source of SIMSTUDIO_BASELINE.integrations) {
    const protocol = SIMSTUDIO_AUTH_TO_PROTOCOL[source.sourceAuthType];
    protocols[protocol] += 1;
    const definition = byId.get(source.id);
    if (!definition) {
      missing.push({
        integrationId: source.id,
        reason: "missing",
        detail:
          "No canonical integration definition maps this Sim Studio provider.",
      });
      continue;
    }
    covered += 1;
    const expectedAuthMethod = PROTOCOL_AUTH_METHOD[protocol];
    for (const product of definition.products) {
      if (!product.authMethods.includes(expectedAuthMethod)) {
        authMethodMismatches.push({
          integrationId: source.id,
          product: product.product,
          reason: "auth-method-mismatch",
          detail: `${product.product} does not declare ${expectedAuthMethod} required by the pinned Sim Studio auth class.`,
        });
      }
    }
  }

  return {
    baseline: {
      providers: SIMSTUDIO_BASELINE.integrations.length,
      protocols,
    },
    catalogue: {
      covered,
      missing,
      authMethodMismatches,
    },
  };
}

export function assertSimStudioProviderProtocolParity(
  definitions: readonly IntegrationDefinition[] = INTEGRATION_CATALOGUE,
): void {
  const report = getSimStudioProviderProtocolReport(definitions);
  if (
    report.catalogue.covered !== report.baseline.providers ||
    report.catalogue.missing.length > 0 ||
    report.catalogue.authMethodMismatches.length > 0
  ) {
    throw new Error(
      `Sim Studio provider protocol parity drift detected: ${[
        ...report.catalogue.missing,
        ...report.catalogue.authMethodMismatches,
      ]
        .map((gap) => `${gap.reason}:${gap.integrationId}`)
        .join(", ")}`,
    );
  }
}
