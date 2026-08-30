import generatedLogoData from "./generated/integration-logos.json";

export const INTEGRATION_LOGO_MANIFEST_VERSION = 2 as const;

export const INTEGRATION_LOGO_TRADEMARK_NOTICE =
  "Product names and logos may be trademarks of their respective owners; use remains subject to each owner's brand guidelines.";

export type IntegrationLogoMediaType = "image/png" | "image/svg+xml";
export type IntegrationLogoSource =
  | "iconify-svg-logos"
  | "simple-icons"
  | "simstudio"
  | "vendor-favicon";

export interface IntegrationLogoAsset {
  /** Canonical catalogue ID. */
  integrationId: string;
  /** Browser-ready source for an img element; no network request is required. */
  dataUri: string;
  mediaType: IntegrationLogoMediaType;
  source: IntegrationLogoSource;
  /** Human-reviewable upstream brand or icon source. */
  sourceUrl: string;
  /** Exact URL from which the generated asset was retrieved. */
  retrievedFrom: string;
  /** Copyright license covering the source artwork, not any trademark rights. */
  copyrightLicense: string;
  /** Trademark rights are separate from the copyright license. */
  trademarkNotice: typeof INTEGRATION_LOGO_TRADEMARK_NOTICE;
}

interface GeneratedLogoFile {
  version: typeof INTEGRATION_LOGO_MANIFEST_VERSION;
  sourceVersions: {
    iconifySvgLogos: string;
    simpleIcons: string;
    simStudioCommit: string;
  };
  logos: Record<
    string,
    Omit<IntegrationLogoAsset, "integrationId" | "trademarkNotice">
  >;
}

const generated = generatedLogoData as GeneratedLogoFile;
if (generated.version !== INTEGRATION_LOGO_MANIFEST_VERSION) {
  throw new Error(
    `Unsupported integration logo manifest version ${generated.version}.`,
  );
}

export const INTEGRATION_LOGO_SOURCE_VERSIONS = Object.freeze({
  ...generated.sourceVersions,
});

export const INTEGRATION_LOGOS: Readonly<Record<string, IntegrationLogoAsset>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(generated.logos).map(([integrationId, asset]) => [
        integrationId,
        Object.freeze({
          integrationId,
          ...asset,
          trademarkNotice: INTEGRATION_LOGO_TRADEMARK_NOTICE,
        }),
      ]),
    ),
  );

export const INTEGRATION_LOGO_IDS: readonly string[] = Object.freeze(
  Object.keys(INTEGRATION_LOGOS),
);

/** Resolve a locally bundled logo by canonical integration ID. */
export function getIntegrationLogo(
  integrationId: string,
): IntegrationLogoAsset | undefined {
  return INTEGRATION_LOGOS[integrationId];
}

export function hasIntegrationLogo(integrationId: string): boolean {
  return getIntegrationLogo(integrationId) !== undefined;
}

/** Convenience helper for img src, CSS url(), or framework image components. */
export function getIntegrationLogoDataUri(
  integrationId: string,
): string | undefined {
  return getIntegrationLogo(integrationId)?.dataUri;
}
