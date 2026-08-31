import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createElement, type ComponentType, type SVGProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { INTEGRATION_CATALOGUE, SIMSTUDIO_BASELINE } from "../src/catalog";

const SIMSTUDIO_ICON_COMMIT = "2a6267391d24d4e10e043ce474615ce9f5d1c22a";
const SIMPLE_ICONS_VERSION = "16.28.0";
const ICONIFY_LOGOS_VERSION = "1.2.11";

const SIMSTUDIO_ICONS_URL = `https://raw.githubusercontent.com/simstudioai/sim/${SIMSTUDIO_ICON_COMMIT}/apps/sim/components/icons.tsx`;
const SIMSTUDIO_MAPPING_URL = `https://raw.githubusercontent.com/simstudioai/sim/${SIMSTUDIO_ICON_COMMIT}/apps/docs/components/ui/icon-mapping.ts`;
const SIMPLE_ICONS_METADATA_URL = `https://cdn.jsdelivr.net/npm/simple-icons@${SIMPLE_ICONS_VERSION}/data/simple-icons.json`;
const ICONIFY_LOGOS_DATA_URL = `https://cdn.jsdelivr.net/npm/@iconify-json/logos@${ICONIFY_LOGOS_VERSION}/icons.json`;

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = join(packageRoot, "src/generated/integration-logos.json");
const temporaryIconsPath = join(
  packageRoot,
  "scripts/.integration-logo-source.tsx",
);

type LogoSourceKey =
  | "iconify-svg-logos"
  | "simple-icons"
  | "simstudio"
  | "vendor-favicon";

interface GeneratedLogo {
  copyrightLicense: string;
  dataUri: string;
  mediaType: "image/png" | "image/svg+xml";
  retrievedFrom: string;
  source: LogoSourceKey;
  sourceUrl: string;
}

interface SimpleIconMetadata {
  hex: string;
  license?: { type: string };
  slug: string;
  source: string;
  title: string;
}

interface IconifyLogoSet {
  height: number;
  width: number;
  icons: Record<
    string,
    {
      body: string;
      height?: number;
      width?: number;
    }
  >;
}

type ExtraLogoSource =
  | { kind: "favicon"; domain: string }
  | { kind: "iconify"; icon: string }
  | { kind: "simple-icons"; slug: string };

const EXTRA_LOGO_SOURCES: Readonly<Record<string, ExtraLogoSource>> = {
  bamboohr: { kind: "favicon", domain: "bamboohr.com" },
  bitbucket: { kind: "simple-icons", slug: "bitbucket" },
  close: { kind: "iconify", icon: "close" },
  copper: { kind: "favicon", domain: "copper.com" },
  deel: { kind: "favicon", domain: "deel.com" },
  "enable-banking": { kind: "favicon", domain: "enablebanking.com" },
  fortnox: { kind: "favicon", domain: "fortnox.se" },
  freshbooks: { kind: "favicon", domain: "freshbooks.com" },
  front: { kind: "iconify", icon: "frontapp" },
  gocardless: { kind: "favicon", domain: "gocardless.com" },
  make: { kind: "simple-icons", slug: "make" },
  mcp: { kind: "simple-icons", slug: "modelcontextprotocol" },
  mercury: { kind: "favicon", domain: "mercury.com" },
  merge: { kind: "favicon", domain: "merge.dev" },
  n8n: { kind: "simple-icons", slug: "n8n" },
  netsuite: { kind: "favicon", domain: "netsuite.com" },
  paypal: { kind: "simple-icons", slug: "paypal" },
  plaid: { kind: "favicon", domain: "plaid.com" },
  quickbooks: { kind: "simple-icons", slug: "quickbooks" },
  salesflare: { kind: "favicon", domain: "salesflare.com" },
  "signed-webhooks": { kind: "iconify", icon: "webhooks" },
  snowflake: { kind: "simple-icons", slug: "snowflake" },
  taleez: { kind: "favicon", domain: "taleez.com" },
  teller: { kind: "favicon", domain: "teller.io" },
  wave: { kind: "favicon", domain: "waveapps.com" },
  wise: { kind: "simple-icons", slug: "wise" },
  xero: { kind: "simple-icons", slug: "xero" },
  zapier: { kind: "simple-icons", slug: "zapier" },
  "zoho-books": { kind: "favicon", domain: "zoho.com" },
};

async function fetchResponse(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { "user-agent": "@oppulence/integrations logo generator" },
  });
  if (!response.ok) {
    throw new Error(`Logo source ${url} returned HTTP ${response.status}.`);
  }
  return response;
}

async function fetchText(url: string): Promise<string> {
  return fetchResponse(url).then((response) => response.text());
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function validateSvg(integrationId: string, svg: string): void {
  if (!svg.trimStart().startsWith("<svg")) {
    throw new Error(`${integrationId} did not render an SVG root.`);
  }
  if (/<script\b|\bon[a-z]+\s*=|javascript:/iu.test(svg)) {
    throw new Error(`${integrationId} rendered unsafe SVG content.`);
  }
}

function blockTypeIconMapping(
  source: string,
): Readonly<Record<string, string>> {
  const mappingSource = source.slice(
    source.indexOf("export const blockTypeToIconMap"),
  );
  return Object.fromEntries(
    [
      ...mappingSource.matchAll(
        /^\s+(?:'([^']+)'|([a-zA-Z0-9_]+)):\s*([A-Za-z0-9_]+),/gmu,
      ),
    ].map((match) => [match[1] ?? match[2], match[3]]),
  );
}

function componentNameFor(
  record: (typeof SIMSTUDIO_BASELINE.integrations)[number],
  mapping: Readonly<Record<string, string>>,
): string {
  for (const key of [
    record.sourceType,
    record.sourceSlug,
    record.id,
    record.id.replaceAll("-", "_"),
  ]) {
    const componentName = mapping[key];
    if (componentName) return componentName;
  }
  throw new Error(`No upstream icon component maps to ${record.id}.`);
}

async function simStudioLogos(): Promise<Record<string, GeneratedLogo>> {
  const [iconSource, mappingSource] = await Promise.all([
    fetchText(SIMSTUDIO_ICONS_URL),
    fetchText(SIMSTUDIO_MAPPING_URL),
  ]);
  await Bun.write(temporaryIconsPath, iconSource);

  try {
    const icons = (await import(
      `${pathToFileURL(temporaryIconsPath).href}?commit=${SIMSTUDIO_ICON_COMMIT}`
    )) as Record<string, unknown>;
    const mapping = blockTypeIconMapping(mappingSource);
    return Object.fromEntries(
      SIMSTUDIO_BASELINE.integrations.map((record) => {
        const componentName = componentNameFor(record, mapping);
        const Icon = icons[componentName] as
          | ComponentType<SVGProps<SVGSVGElement>>
          | undefined;
        if (!Icon) {
          throw new Error(
            `Upstream component ${componentName} for ${record.id} is missing.`,
          );
        }
        const svg = renderToStaticMarkup(
          createElement(Icon, { height: 64, width: 64 }),
        );
        validateSvg(record.id, svg);
        return [
          record.id,
          {
            copyrightLicense: "Apache-2.0",
            dataUri: svgDataUri(svg),
            mediaType: "image/svg+xml",
            retrievedFrom: SIMSTUDIO_ICONS_URL,
            source: "simstudio",
            sourceUrl: SIMSTUDIO_ICONS_URL,
          } satisfies GeneratedLogo,
        ];
      }),
    );
  } finally {
    await rm(temporaryIconsPath, { force: true });
  }
}

async function simpleIconLogo(
  integrationId: string,
  slug: string,
  metadata: ReadonlyMap<string, SimpleIconMetadata>,
): Promise<GeneratedLogo> {
  const icon = metadata.get(slug);
  if (!icon) throw new Error(`Simple Icons has no ${slug} icon.`);
  const assetUrl = `https://cdn.jsdelivr.net/npm/simple-icons@${SIMPLE_ICONS_VERSION}/icons/${slug}.svg`;
  const rawSvg = await fetchText(assetUrl);
  const svg = rawSvg.replace(/<svg\b/u, `<svg fill="#${icon.hex}"`);
  validateSvg(integrationId, svg);
  return {
    copyrightLicense: icon.license?.type ?? "CC0-1.0",
    dataUri: svgDataUri(svg),
    mediaType: "image/svg+xml",
    retrievedFrom: assetUrl,
    source: "simple-icons",
    sourceUrl: icon.source,
  };
}

function iconifyLogo(
  integrationId: string,
  icon: string,
  iconSet: IconifyLogoSet,
): GeneratedLogo {
  const definition = iconSet.icons[icon];
  if (!definition) throw new Error(`Iconify SVG Logos has no ${icon} icon.`);
  const width = definition.width ?? iconSet.width;
  const height = definition.height ?? iconSet.height;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="64" height="64">${definition.body}</svg>`;
  validateSvg(integrationId, svg);
  return {
    copyrightLicense: "CC0-1.0",
    dataUri: svgDataUri(svg),
    mediaType: "image/svg+xml",
    retrievedFrom: ICONIFY_LOGOS_DATA_URL,
    source: "iconify-svg-logos",
    sourceUrl: `https://icon-sets.iconify.design/logos/${icon}/`,
  };
}

async function faviconLogo(
  integrationId: string,
  domain: string,
): Promise<GeneratedLogo> {
  const assetUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
  const response = await fetchResponse(assetUrl);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100) {
    throw new Error(`${integrationId} favicon is unexpectedly small.`);
  }
  return {
    copyrightLicense: "No open-source license asserted",
    dataUri: `data:image/png;base64,${bytes.toString("base64")}`,
    mediaType: "image/png",
    retrievedFrom: assetUrl,
    source: "vendor-favicon",
    sourceUrl: `https://${domain}`,
  };
}

async function extraLogos(): Promise<Record<string, GeneratedLogo>> {
  const [metadata, iconifyLogos] = (await Promise.all([
    fetchResponse(SIMPLE_ICONS_METADATA_URL).then((response) =>
      response.json(),
    ),
    fetchResponse(ICONIFY_LOGOS_DATA_URL).then((response) => response.json()),
  ])) as [SimpleIconMetadata[], IconifyLogoSet];
  const simpleIcons = new Map(metadata.map((icon) => [icon.slug, icon]));

  return Object.fromEntries(
    await Promise.all(
      Object.entries(EXTRA_LOGO_SOURCES).map(
        async ([integrationId, source]) => {
          const logo =
            source.kind === "favicon"
              ? await faviconLogo(integrationId, source.domain)
              : source.kind === "iconify"
                ? iconifyLogo(integrationId, source.icon, iconifyLogos)
                : await simpleIconLogo(integrationId, source.slug, simpleIcons);
          return [integrationId, logo] as const;
        },
      ),
    ),
  );
}

async function main(): Promise<void> {
  const baselineIds = new Set(
    SIMSTUDIO_BASELINE.integrations.map((integration) => integration.id),
  );
  const extraIds = INTEGRATION_CATALOGUE.map((integration) => integration.id)
    .filter((id) => !baselineIds.has(id))
    .sort();
  const configuredExtraIds = Object.keys(EXTRA_LOGO_SOURCES).sort();
  if (JSON.stringify(extraIds) !== JSON.stringify(configuredExtraIds)) {
    throw new Error(
      `Extra logo sources are stale. Expected ${extraIds.join(", ")}; configured ${configuredExtraIds.join(", ")}.`,
    );
  }

  await mkdir(dirname(generatedPath), { recursive: true });
  const [baselineLogos, additionalLogos] = await Promise.all([
    simStudioLogos(),
    extraLogos(),
  ]);
  const logos = Object.fromEntries(
    Object.entries({ ...baselineLogos, ...additionalLogos }).sort(
      ([left], [right]) => left.localeCompare(right),
    ),
  );
  const catalogueIds = INTEGRATION_CATALOGUE.map(
    (integration) => integration.id,
  );
  const missing = catalogueIds.filter((id) => !logos[id]);
  const unknown = Object.keys(logos).filter((id) => !catalogueIds.includes(id));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `Logo coverage mismatch. Missing: ${missing.join(", ") || "none"}. Unknown: ${unknown.join(", ") || "none"}.`,
    );
  }

  await Bun.write(
    generatedPath,
    `${JSON.stringify(
      {
        version: 2,
        sourceVersions: {
          iconifySvgLogos: ICONIFY_LOGOS_VERSION,
          simpleIcons: SIMPLE_ICONS_VERSION,
          simStudioCommit: SIMSTUDIO_ICON_COMMIT,
        },
        logos,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Generated ${Object.keys(logos).length} integration logos.`);
}

await main();
