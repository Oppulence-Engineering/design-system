import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { INTEGRATION_CATALOGUE } from "../src/catalog";
import {
  getIntegrationLogo,
  getIntegrationLogoDataUri,
  hasIntegrationLogo,
  INTEGRATION_LOGO_IDS,
  INTEGRATION_LOGOS,
} from "../src/logos";
import { IntegrationLogo } from "../src/logos-react";

describe("integration logos", () => {
  test("covers every canonical catalogue integration", () => {
    const catalogueIds = INTEGRATION_CATALOGUE.map(({ id }) => id).sort();
    expect([...INTEGRATION_LOGO_IDS].sort()).toEqual(catalogueIds);
    expect(Object.keys(INTEGRATION_LOGOS)).toHaveLength(261);
  });

  test("ships browser-ready local data with provenance", () => {
    for (const integrationId of INTEGRATION_LOGO_IDS) {
      const logo = getIntegrationLogo(integrationId);
      expect(logo?.integrationId).toBe(integrationId);
      expect(logo?.dataUri).toStartWith(`data:${logo?.mediaType};base64,`);
      expect(logo?.sourceUrl).toStartWith("https://");
      expect(logo?.retrievedFrom).toStartWith("https://");
      expect(logo?.copyrightLicense.length).toBeGreaterThan(0);
      expect(logo?.trademarkNotice).toContain("trademarks");
      expect(getIntegrationLogoDataUri(integrationId)).toBe(logo?.dataUri);
      expect(hasIntegrationLogo(integrationId)).toBeTrue();
    }
  });

  test("keeps every SVG passive and self-contained", () => {
    for (const logo of Object.values(INTEGRATION_LOGOS)) {
      if (logo.mediaType !== "image/svg+xml") continue;
      const svg = Buffer.from(
        logo.dataUri.slice(logo.dataUri.indexOf(",") + 1),
        "base64",
      ).toString("utf8");
      expect(svg.trimStart()).toStartWith("<svg");
      expect(svg).not.toMatch(/<script\b|\bon[a-z]+\s*=|javascript:/iu);
      expect(svg).not.toMatch(/(?:href|src)=["']https?:\/\//iu);
    }
  });

  test("returns undefined for unknown future integrations", () => {
    expect(getIntegrationLogo("not-a-provider")).toBeUndefined();
    expect(getIntegrationLogoDataUri("not-a-provider")).toBeUndefined();
    expect(hasIntegrationLogo("not-a-provider")).toBeFalse();
  });

  test("renders the React helper without a remote image request", () => {
    const markup = renderToStaticMarkup(
      <IntegrationLogo
        integrationId="stripe"
        decorative={false}
        alt="Stripe"
        className="logo"
      />,
    );
    expect(markup).toContain('alt="Stripe"');
    expect(markup).toContain('class="logo"');
    expect(markup).toContain('data-integration-logo="stripe"');
    expect(markup).toContain('src="data:image/svg+xml;base64,');
    expect(markup).not.toContain("https://");
  });

  test("renders a caller fallback for an unknown integration", () => {
    const markup = renderToStaticMarkup(
      <IntegrationLogo
        integrationId="future-provider"
        fallback={<span>FP</span>}
      />,
    );
    expect(markup).toBe("<span>FP</span>");
  });
});
