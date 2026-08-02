import { cva, type VariantProps } from "class-variance-authority";
import type { IconType } from "react-icons";
import {
  SiAirtable,
  SiAlgolia,
  SiAmazondynamodb,
  SiAmazonrds,
  SiAmazons3,
  SiAmazonsimpleemailservice,
  SiAmazonsqs,
  SiArxiv,
  SiAsana,
  SiAwssecretsmanager,
  SiBox,
  SiBrex,
  SiBuffer,
  SiCaldotcom,
  SiCalendly,
  SiClaude,
  SiClerk,
  SiClickhouse,
  SiClickup,
  SiCloudflare,
  SiConfluence,
  SiDatabricks,
  SiDatadog,
  SiDiscord,
  SiDowndetector,
  SiDropbox,
  SiDuckduckgo,
  SiElasticsearch,
  SiElevenlabs,
  SiEvernote,
  SiFathom,
  SiGithub,
  SiGitlab,
  SiGmail,
  SiGoogle,
  SiGoogleads,
  SiGooglebigquery,
  SiGooglecalendar,
  SiGoogledocs,
  SiGoogledrive,
  SiGoogleforms,
  SiGooglemaps,
  SiGooglemeet,
  SiGooglesheets,
  SiGoogleslides,
  SiGoogletasks,
  SiGoogletranslate,
  SiGrafana,
  SiGreenhouse,
  SiHubspot,
  SiHuggingface,
  SiIntercom,
  SiJira,
  SiJupyter,
  SiLatex,
  SiLinear,
  SiLinkedin,
  SiMailchimp,
  SiMailgun,
  SiMake,
  SiMongodb,
  SiMysql,
  SiN8N,
  SiNeo4J,
  SiNewrelic,
  SiNotion,
  SiObsidian,
  SiOkta,
  SiPagerduty,
  SiPaypal,
  SiPerplexity,
  SiPostgresql,
  SiPosthog,
  SiQuickbooks,
  SiRailway,
  SiReddit,
  SiRedis,
  SiResend,
  SiSalesforce,
  SiSap,
  SiSendgrid,
  SiSentry,
  SiShopify,
  SiSimilarweb,
  SiSlack,
  SiSnowflake,
  SiSquare,
  SiStripe,
  SiSupabase,
  SiTailscale,
  SiTelegram,
  SiTemporal,
  SiTiktok,
  SiTrello,
  SiTwilio,
  SiTypeform,
  SiUpstash,
  SiVercel,
  SiWebflow,
  SiWhatsapp,
  SiWikipedia,
  SiWise,
  SiWordpress,
  SiX,
  SiXero,
  SiYoutube,
  SiZapier,
  SiZendesk,
  SiZoho,
  SiZoom,
} from "react-icons/si";

/**
 * Brand marks, from Simple Icons via react-icons.
 *
 * These cover 119 of the catalogue and not the rest: Simple Icons carries no
 * mark for much of the B2B long tail, and has removed others on trademark
 * request. Anything absent falls back to a monogram rather than a gap, so a
 * directory row looks deliberate either way.
 */
const INTEGRATION_BRAND_ICONS: Readonly<Record<string, IconType>> = {
  airtable: SiAirtable,
  algolia: SiAlgolia,
  "amazon-dynamodb": SiAmazondynamodb,
  "amazon-rds": SiAmazonrds,
  "amazon-sqs": SiAmazonsqs,
  arxiv: SiArxiv,
  asana: SiAsana,
  "aws-secrets-manager": SiAwssecretsmanager,
  "aws-ses": SiAmazonsimpleemailservice,
  box: SiBox,
  brex: SiBrex,
  buffer: SiBuffer,
  "cal-com": SiCaldotcom,
  calendly: SiCalendly,
  "claude-managed-agents": SiClaude,
  clerk: SiClerk,
  clickhouse: SiClickhouse,
  clickup: SiClickup,
  cloudflare: SiCloudflare,
  confluence: SiConfluence,
  databricks: SiDatabricks,
  datadog: SiDatadog,
  discord: SiDiscord,
  downdetector: SiDowndetector,
  dropbox: SiDropbox,
  duckduckgo: SiDuckduckgo,
  elasticsearch: SiElasticsearch,
  elevenlabs: SiElevenlabs,
  evernote: SiEvernote,
  fathom: SiFathom,
  github: SiGithub,
  gitlab: SiGitlab,
  gmail: SiGmail,
  "google-ads": SiGoogleads,
  "google-appsheet": SiGoogle,
  "google-bigquery": SiGooglebigquery,
  "google-books": SiGoogle,
  "google-calendar": SiGooglecalendar,
  "google-contacts": SiGoogle,
  "google-docs": SiGoogledocs,
  "google-drive": SiGoogledrive,
  "google-forms": SiGoogleforms,
  "google-groups": SiGoogle,
  "google-maps": SiGooglemaps,
  "google-meet": SiGooglemeet,
  "google-pagespeed": SiGoogle,
  "google-search": SiGoogle,
  "google-sheets": SiGooglesheets,
  "google-slides": SiGoogleslides,
  "google-tasks": SiGoogletasks,
  "google-translate": SiGoogletranslate,
  "google-vault": SiGoogle,
  grafana: SiGrafana,
  greenhouse: SiGreenhouse,
  hubspot: SiHubspot,
  "hugging-face": SiHuggingface,
  intercom: SiIntercom,
  jira: SiJira,
  "jira-service-management": SiJira,
  jupyter: SiJupyter,
  latex: SiLatex,
  linear: SiLinear,
  linkedin: SiLinkedin,
  mailchimp: SiMailchimp,
  mailgun: SiMailgun,
  make: SiMake,
  mongodb: SiMongodb,
  mysql: SiMysql,
  n8n: SiN8N,
  neo4j: SiNeo4J,
  "new-relic": SiNewrelic,
  notion: SiNotion,
  obsidian: SiObsidian,
  okta: SiOkta,
  pagerduty: SiPagerduty,
  paypal: SiPaypal,
  perplexity: SiPerplexity,
  postgresql: SiPostgresql,
  posthog: SiPosthog,
  quickbooks: SiQuickbooks,
  railway: SiRailway,
  reddit: SiReddit,
  redis: SiRedis,
  resend: SiResend,
  s3: SiAmazons3,
  salesforce: SiSalesforce,
  "sap-concur": SiSap,
  "sap-s4hana": SiSap,
  sendgrid: SiSendgrid,
  sentry: SiSentry,
  shopify: SiShopify,
  similarweb: SiSimilarweb,
  slack: SiSlack,
  snowflake: SiSnowflake,
  square: SiSquare,
  stripe: SiStripe,
  supabase: SiSupabase,
  tailscale: SiTailscale,
  telegram: SiTelegram,
  temporal: SiTemporal,
  tiktok: SiTiktok,
  trello: SiTrello,
  "twilio-sms": SiTwilio,
  "twilio-voice": SiTwilio,
  typeform: SiTypeform,
  upstash: SiUpstash,
  vercel: SiVercel,
  webflow: SiWebflow,
  whatsapp: SiWhatsapp,
  wikipedia: SiWikipedia,
  wise: SiWise,
  wordpress: SiWordpress,
  x: SiX,
  xero: SiXero,
  youtube: SiYoutube,
  zapier: SiZapier,
  zendesk: SiZendesk,
  "zoho-books": SiZoho,
  zoom: SiZoom,
};

/**
 * Monogram tints. A fixed set rather than a generated hue keeps the fallback
 * legible in both themes and recognisably part of the product's palette.
 */
const MONOGRAM_TINTS = [
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
] as const;

const integrationLogoVariants = cva(
  "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md",
  {
    variants: {
      size: {
        sm: "size-6 text-[10px] [&>svg]:size-3.5",
        md: "size-8 text-xs [&>svg]:size-4",
        lg: "size-10 text-sm [&>svg]:size-5",
      },
    },
    defaultVariants: { size: "md" },
  },
);

/** Stable across renders and processes, so a provider keeps its colour. */
function tintFor(integrationId: string): string {
  let hash = 0;
  for (let index = 0; index < integrationId.length; index += 1) {
    hash = (hash * 31 + integrationId.charCodeAt(index)) % 100_000;
  }
  return MONOGRAM_TINTS[hash % MONOGRAM_TINTS.length]!;
}

/** Up to two letters: initials for multi-word names, otherwise a prefix. */
function monogramFor(name: string): string {
  const words = name.split(/[\s-]+/u).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return (words[0] ?? "?").slice(0, 2).toUpperCase();
}

export interface IntegrationLogoProps extends VariantProps<
  typeof integrationLogoVariants
> {
  integrationId: string;
  name: string;
}

/**
 * The provider mark for a directory row. Decorative: the provider name is
 * always rendered beside it, so this is hidden from assistive technology
 * rather than repeating the label.
 */
export function IntegrationLogo({
  integrationId,
  name,
  size,
}: IntegrationLogoProps) {
  const Brand = INTEGRATION_BRAND_ICONS[integrationId];
  if (Brand) {
    return (
      <span
        aria-hidden="true"
        data-slot="integration-logo"
        data-integration-logo="brand"
        className={`${integrationLogoVariants({ size })} bg-muted text-foreground`}
      >
        <Brand />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-slot="integration-logo"
      data-integration-logo="monogram"
      className={`${integrationLogoVariants({ size })} ${tintFor(integrationId)} font-semibold`}
    >
      {monogramFor(name)}
    </span>
  );
}

/** Whether a real brand mark exists, as opposed to a monogram fallback. */
export function hasIntegrationBrandIcon(integrationId: string): boolean {
  return integrationId in INTEGRATION_BRAND_ICONS;
}
