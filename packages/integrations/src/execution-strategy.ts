import { SIMSTUDIO_BASELINE } from "./catalog";

/** The implementation track selected for a source integration provider. */
export type ProviderExecutionStrategyKind =
  | "installed_vendor_sdk"
  | "vendor_sdk_candidate"
  | "maintained_sdk_candidate"
  | "sdk_unverified_catalogue_only"
  | "protocol_client"
  | "no_runtime_actions";

export interface ProviderExecutionStrategy {
  integrationId: string;
  kind: ProviderExecutionStrategyKind;
  /** Package to install or already used by a package-owned adapter. */
  packageName?: string;
  /** Source action count used to size and sequence implementation work. */
  operations: number;
  /** Source trigger count; trigger execution is tracked separately. */
  triggers: number;
}

export interface ProviderExecutionStrategyReport {
  providers: number;
  operations: number;
  triggers: number;
  byKind: Readonly<
    Record<
      ProviderExecutionStrategyKind,
      { providers: number; operations: number; triggers: number }
    >
  >;
}

interface StrategyOverride {
  kind: Exclude<
    ProviderExecutionStrategyKind,
    "sdk_unverified_catalogue_only" | "no_runtime_actions"
  >;
  packageName?: string;
}

/**
 * SDK-only adoption map. Entries are deliberately limited to maintained,
 * vendor-published SDKs or actively maintained ecosystem SDKs. A provider must remain
 * on this map whenever such an SDK exists. Providers without a verified SDK
 * remain catalogue-only; the package does not schedule raw REST adapters as a
 * substitute for an available or missing SDK.
 */
const STRATEGY_OVERRIDES: Readonly<Record<string, StrategyOverride>> = {
  airtable: { kind: "installed_vendor_sdk", packageName: "airtable" },
  algolia: { kind: "vendor_sdk_candidate", packageName: "algoliasearch" },
  "amazon-dynamodb": {
    kind: "vendor_sdk_candidate",
    packageName: "@aws-sdk/client-dynamodb",
  },
  "amazon-sqs": {
    kind: "vendor_sdk_candidate",
    packageName: "@aws-sdk/client-sqs",
  },
  asana: { kind: "installed_vendor_sdk", packageName: "asana" },
  athena: {
    kind: "vendor_sdk_candidate",
    packageName: "@aws-sdk/client-athena",
  },
  "aws-appconfig": {
    kind: "vendor_sdk_candidate",
    packageName: "@aws-sdk/client-appconfig",
  },
  "aws-iam": {
    kind: "vendor_sdk_candidate",
    packageName: "@aws-sdk/client-iam",
  },
  "aws-identity-center": {
    kind: "vendor_sdk_candidate",
    packageName: "@aws-sdk/client-sso-admin",
  },
  "aws-secrets-manager": {
    kind: "vendor_sdk_candidate",
    packageName: "@aws-sdk/client-secrets-manager",
  },
  "aws-ses": {
    kind: "vendor_sdk_candidate",
    packageName: "@aws-sdk/client-sesv2",
  },
  "aws-sts": {
    kind: "vendor_sdk_candidate",
    packageName: "@aws-sdk/client-sts",
  },
  "aws-textract": {
    kind: "vendor_sdk_candidate",
    packageName: "@aws-sdk/client-textract",
  },
  "azure-ad": {
    kind: "vendor_sdk_candidate",
    packageName: "@microsoft/microsoft-graph-client",
  },
  "azure-devops": {
    kind: "maintained_sdk_candidate",
    packageName: "azure-devops-node-api",
  },
  box: {
    kind: "vendor_sdk_candidate",
    packageName: "box-typescript-sdk-gen",
  },
  brex: { kind: "installed_vendor_sdk", packageName: "brex" },
  "cal-com": { kind: "vendor_sdk_candidate", packageName: "@calcom/sdk" },
  clerk: { kind: "vendor_sdk_candidate", packageName: "@clerk/backend" },
  cloudflare: { kind: "installed_vendor_sdk", packageName: "cloudflare" },
  cloudformation: {
    kind: "vendor_sdk_candidate",
    packageName: "@aws-sdk/client-cloudformation",
  },
  cloudwatch: {
    kind: "vendor_sdk_candidate",
    packageName: "@aws-sdk/client-cloudwatch",
  },
  codepipeline: {
    kind: "vendor_sdk_candidate",
    packageName: "@aws-sdk/client-codepipeline",
  },
  confluence: { kind: "maintained_sdk_candidate", packageName: "jira.js" },
  datadog: {
    kind: "vendor_sdk_candidate",
    packageName: "@datadog/datadog-api-client",
  },
  docusign: { kind: "vendor_sdk_candidate", packageName: "docusign-esign" },
  dropbox: { kind: "installed_vendor_sdk", packageName: "dropbox" },
  elasticsearch: {
    kind: "vendor_sdk_candidate",
    packageName: "@elastic/elasticsearch",
  },
  elevenlabs: {
    kind: "installed_vendor_sdk",
    packageName: "@elevenlabs/elevenlabs-js",
  },
  firecrawl: {
    kind: "installed_vendor_sdk",
    packageName: "@mendable/firecrawl-js",
  },
  github: { kind: "installed_vendor_sdk", packageName: "@octokit/rest" },
  gitlab: { kind: "installed_vendor_sdk", packageName: "@gitbeaker/rest" },
  gmail: { kind: "installed_vendor_sdk", packageName: "googleapis" },
  "google-appsheet": {
    kind: "vendor_sdk_candidate",
    packageName: "googleapis",
  },
  "google-bigquery": {
    kind: "vendor_sdk_candidate",
    packageName: "@google-cloud/bigquery",
  },
  "google-books": { kind: "installed_vendor_sdk", packageName: "googleapis" },
  "google-calendar": {
    kind: "installed_vendor_sdk",
    packageName: "googleapis",
  },
  "google-contacts": {
    kind: "installed_vendor_sdk",
    packageName: "googleapis",
  },
  "google-docs": { kind: "installed_vendor_sdk", packageName: "googleapis" },
  "google-drive": { kind: "installed_vendor_sdk", packageName: "googleapis" },
  "google-forms": { kind: "installed_vendor_sdk", packageName: "googleapis" },
  "google-groups": {
    kind: "installed_vendor_sdk",
    packageName: "googleapis",
  },
  "google-maps": {
    kind: "vendor_sdk_candidate",
    packageName: "@googlemaps/google-maps-services-js",
  },
  "google-meet": { kind: "installed_vendor_sdk", packageName: "googleapis" },
  "google-sheets": {
    kind: "installed_vendor_sdk",
    packageName: "googleapis",
  },
  "google-slides": {
    kind: "installed_vendor_sdk",
    packageName: "googleapis",
  },
  "google-tasks": { kind: "installed_vendor_sdk", packageName: "googleapis" },
  "google-translate": {
    kind: "vendor_sdk_candidate",
    packageName: "@google-cloud/translate",
  },
  "google-vault": { kind: "vendor_sdk_candidate", packageName: "googleapis" },
  hubspot: {
    kind: "installed_vendor_sdk",
    packageName: "@hubspot/api-client",
  },
  intercom: {
    kind: "installed_vendor_sdk",
    packageName: "intercom-client",
  },
  jira: { kind: "maintained_sdk_candidate", packageName: "jira.js" },
  "jira-service-management": {
    kind: "maintained_sdk_candidate",
    packageName: "jira.js",
  },
  linear: { kind: "installed_vendor_sdk", packageName: "@linear/sdk" },
  mailchimp: {
    kind: "installed_vendor_sdk",
    packageName: "@mailchimp/mailchimp_marketing",
  },
  mailgun: { kind: "installed_vendor_sdk", packageName: "mailgun.js" },
  "microsoft-excel": {
    kind: "vendor_sdk_candidate",
    packageName: "@microsoft/microsoft-graph-client",
  },
  "microsoft-planner": {
    kind: "vendor_sdk_candidate",
    packageName: "@microsoft/microsoft-graph-client",
  },
  "microsoft-teams": {
    kind: "vendor_sdk_candidate",
    packageName: "@microsoft/microsoft-graph-client",
  },
  mongodb: { kind: "vendor_sdk_candidate", packageName: "mongodb" },
  neo4j: { kind: "vendor_sdk_candidate", packageName: "neo4j-driver" },
  notion: { kind: "vendor_sdk_candidate", packageName: "@notionhq/client" },
  okta: {
    kind: "vendor_sdk_candidate",
    packageName: "@okta/okta-sdk-nodejs",
  },
  onedrive: {
    kind: "vendor_sdk_candidate",
    packageName: "@microsoft/microsoft-graph-client",
  },
  outlook: {
    kind: "vendor_sdk_candidate",
    packageName: "@microsoft/microsoft-graph-client",
  },
  pinecone: {
    kind: "vendor_sdk_candidate",
    packageName: "@pinecone-database/pinecone",
  },
  qdrant: {
    kind: "vendor_sdk_candidate",
    packageName: "@qdrant/js-client-rest",
  },
  reddit: { kind: "maintained_sdk_candidate", packageName: "snoowrap" },
  resend: { kind: "installed_vendor_sdk", packageName: "resend" },
  s3: { kind: "vendor_sdk_candidate", packageName: "@aws-sdk/client-s3" },
  salesforce: { kind: "maintained_sdk_candidate", packageName: "jsforce" },
  sharepoint: {
    kind: "vendor_sdk_candidate",
    packageName: "@microsoft/microsoft-graph-client",
  },
  shopify: {
    kind: "vendor_sdk_candidate",
    packageName: "@shopify/shopify-api",
  },
  slack: { kind: "installed_vendor_sdk", packageName: "@slack/web-api" },
  square: { kind: "installed_vendor_sdk", packageName: "square" },
  stripe: { kind: "installed_vendor_sdk", packageName: "stripe" },
  supabase: {
    kind: "vendor_sdk_candidate",
    packageName: "@supabase/supabase-js",
  },
  temporal: {
    kind: "vendor_sdk_candidate",
    packageName: "@temporalio/client",
  },
  trello: { kind: "maintained_sdk_candidate", packageName: "@trello/client" },
  "twilio-sms": { kind: "vendor_sdk_candidate", packageName: "twilio" },
  "twilio-voice": { kind: "vendor_sdk_candidate", packageName: "twilio" },
  upstash: {
    kind: "vendor_sdk_candidate",
    packageName: "@upstash/redis",
  },
  vercel: { kind: "installed_vendor_sdk", packageName: "@vercel/sdk" },
  x: { kind: "maintained_sdk_candidate", packageName: "twitter-api-v2" },
  youtube: { kind: "installed_vendor_sdk", packageName: "googleapis" },
  zendesk: {
    kind: "vendor_sdk_candidate",
    packageName: "@zendesk/zendesk-api-client",
  },
};

const PROTOCOL_CLIENTS: Readonly<Record<string, string>> = {
  clickhouse: "@clickhouse/client",
  jupyter: "Jupyter server protocol",
  mysql: "mysql2",
  postgresql: "pg",
  redis: "redis",
  sftp: "ssh2-sftp-client",
  smtp: "nodemailer",
  ssh: "ssh2",
};

/**
 * Returns every source provider, including zero-action catalogue entries. This
 * ensures the implementation plan cannot silently lose an integration while
 * SDK work progresses in waves.
 */
export function getProviderExecutionStrategies(): readonly ProviderExecutionStrategy[] {
  return SIMSTUDIO_BASELINE.integrations.map((integration) => {
    const operations = integration.operations.length;
    const triggers = integration.triggers.length;
    if (operations === 0) {
      return {
        integrationId: integration.id,
        kind: "no_runtime_actions",
        operations,
        triggers,
      };
    }
    const override = STRATEGY_OVERRIDES[integration.id];
    if (override) {
      return {
        integrationId: integration.id,
        ...override,
        operations,
        triggers,
      };
    }
    const protocolPackage = PROTOCOL_CLIENTS[integration.id];
    if (protocolPackage) {
      return {
        integrationId: integration.id,
        kind: "protocol_client",
        packageName: protocolPackage,
        operations,
        triggers,
      };
    }
    return {
      integrationId: integration.id,
      kind: "sdk_unverified_catalogue_only",
      operations,
      triggers,
    };
  });
}

/** Summarizes the source-wide implementation plan without overstating runtime coverage. */
export function getProviderExecutionStrategyReport(): ProviderExecutionStrategyReport {
  const byKind: Record<
    ProviderExecutionStrategyKind,
    { providers: number; operations: number; triggers: number }
  > = {
    installed_vendor_sdk: { providers: 0, operations: 0, triggers: 0 },
    vendor_sdk_candidate: { providers: 0, operations: 0, triggers: 0 },
    maintained_sdk_candidate: { providers: 0, operations: 0, triggers: 0 },
    sdk_unverified_catalogue_only: { providers: 0, operations: 0, triggers: 0 },
    protocol_client: { providers: 0, operations: 0, triggers: 0 },
    no_runtime_actions: { providers: 0, operations: 0, triggers: 0 },
  };
  let operations = 0;
  let triggers = 0;
  for (const strategy of getProviderExecutionStrategies()) {
    operations += strategy.operations;
    triggers += strategy.triggers;
    const entry = byKind[strategy.kind];
    entry.providers += 1;
    entry.operations += strategy.operations;
    entry.triggers += strategy.triggers;
  }
  return {
    providers: SIMSTUDIO_BASELINE.integrations.length,
    operations,
    triggers,
    byKind,
  };
}
