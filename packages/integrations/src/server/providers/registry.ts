import type { IntegrationProviderPack } from "../core/provider-pack";
import { createAirtablePack } from "./airtable";
import { createAlgoliaPack } from "./algolia";
import { createDynamoDbPack } from "./amazon-dynamodb";
import { createRdsPack } from "./amazon-rds";
import { createSqsPack } from "./amazon-sqs";
import { createArxivPack } from "./arxiv";
import { createAthenaPack } from "./athena";
import { createAttioPack } from "./attio";
import { createAppConfigPack } from "./aws-appconfig";
import { createIamPack } from "./aws-iam";
import { createIdentityCenterPack } from "./aws-identity-center";
import { createSecretsManagerPack } from "./aws-secrets-manager";
import { createSesPack } from "./aws-ses";
import { createStsPack } from "./aws-sts";
import { createTextractPack } from "./aws-textract";
import { createAzureAdPack } from "./azure-ad";
import { createAzureDevOpsPack } from "./azure-devops";
import { createBoxPack } from "./box";
import { createBrandfetchPack } from "./brandfetch";
import { createCalComPack } from "./cal-com";
import { createCalendlyPack } from "./calendly";
import { createClerkPack } from "./clerk";
import { createClickHousePack } from "./clickhouse";
import { createClickUpPack } from "./clickup";
import { createCloudflarePack } from "./cloudflare";
import { createCloudFormationPack } from "./cloudformation";
import { createCloudWatchPack } from "./cloudwatch";
import { createCodePipelinePack } from "./codepipeline";
import { createConfluencePack } from "./confluence";
import { createDatadogPack } from "./datadog";
import { createDiscordPack } from "./discord";
import { createDocuSignPack } from "./docusign";
import { createElasticsearchPack } from "./elasticsearch";
import { createExaPack } from "./exa";
import { createGoogleAppSheetPack } from "./google-appsheet";
import { createGoogleBigQueryPack } from "./google-bigquery";
import { createGoogleMapsPack } from "./google-maps";
import { createGoogleTranslatePack } from "./google-translate";
import { createGoogleVaultPack } from "./google-vault";
import { createHunterIoPack } from "./hunter-io";
import { createIncidentIoPack } from "./incident-io";
import { createJinaPack } from "./jina";
import { createJiraPack } from "./jira";
import { createJiraServiceManagementPack } from "./jira-service-management";
import { createJupyterPack } from "./jupyter";
import { createLinkedInPack } from "./linkedin";
import { createMicrosoftExcelPack } from "./microsoft-excel";
import { createMicrosoftPlannerPack } from "./microsoft-planner";
import { createMicrosoftTeamsPack } from "./microsoft-teams";
import { createMongoDbPack } from "./mongodb";
import { createMySqlPack } from "./mysql";
import { createNeo4jPack } from "./neo4j";
import { createOktaPack } from "./okta";
import { createOneDrivePack } from "./onedrive";
import { createOutlookPack } from "./outlook";
import { createPagerDutyPack } from "./pagerduty";
import { createPerplexityPack } from "./perplexity";
import { createPineconePack } from "./pinecone";
import { createPostgreSqlPack } from "./postgresql";
import { createPostHogPack } from "./posthog";
import { createQdrantPack } from "./qdrant";
import { createRedditPack } from "./reddit";
import { createRedisPack } from "./redis";
import { createS3Pack } from "./s3";
import { createSalesforcePack } from "./salesforce";
import { createSendGridPack } from "./sendgrid";
import { createSftpPack } from "./sftp";
import { createSharePointPack } from "./sharepoint";
import { createShopifyPack } from "./shopify";
import { createSshPack } from "./ssh";
import { createSupabasePack } from "./supabase";
import { createTailscalePack } from "./tailscale";
import { createTavilyPack } from "./tavily";
import { createTelegramPack } from "./telegram";
import { createTemporalPack } from "./temporal";
import { createTrelloPack } from "./trello";
import { createTwilioVoicePack } from "./twilio-voice";
import { createTypeformPack } from "./typeform";
import { createUpstashPack } from "./upstash";
import { createVercelPack } from "./vercel";
import { createWebflowPack } from "./webflow";
import { createWikipediaPack } from "./wikipedia";
import { createXPack } from "./x";
import { createZendeskPack } from "./zendesk";

/**
 * Every provider pack the package ships, in one list.
 *
 * This is the single place a new provider is registered. The registry builder
 * and the coverage gate both read it, so a pack cannot be executable without
 * being coverage-checked, or coverage-checked without being executable — the
 * two used to be separate hand-maintained lists and could drift.
 *
 * Packs gate themselves on the runtimes they need, returning no adapters when
 * a product has not configured one, so the list needs no per-entry wiring.
 */
export const BUILT_IN_PROVIDER_PACKS: readonly IntegrationProviderPack[] = [
  createAirtablePack(),
  createAlgoliaPack(),
  createAppConfigPack(),
  createArxivPack(),
  createAthenaPack(),
  createAttioPack(),
  createAzureAdPack(),
  createAzureDevOpsPack(),
  createBoxPack(),
  createBrandfetchPack(),
  createCalComPack(),
  createCalendlyPack(),
  createClerkPack(),
  createClickHousePack(),
  createClickUpPack(),
  createCloudFormationPack(),
  createCloudWatchPack(),
  createCloudflarePack(),
  createCodePipelinePack(),
  createConfluencePack(),
  createDatadogPack(),
  createDiscordPack(),
  createDocuSignPack(),
  createDynamoDbPack(),
  createElasticsearchPack(),
  createExaPack(),
  createGoogleAppSheetPack(),
  createGoogleBigQueryPack(),
  createGoogleMapsPack(),
  createGoogleTranslatePack(),
  createGoogleVaultPack(),
  createHunterIoPack(),
  createIamPack(),
  createIdentityCenterPack(),
  createIncidentIoPack(),
  createJinaPack(),
  createJiraPack(),
  createJiraServiceManagementPack(),
  createJupyterPack(),
  createLinkedInPack(),
  createMicrosoftExcelPack(),
  createMicrosoftPlannerPack(),
  createMicrosoftTeamsPack(),
  createMongoDbPack(),
  createMySqlPack(),
  createNeo4jPack(),
  createOktaPack(),
  createOneDrivePack(),
  createOutlookPack(),
  createPagerDutyPack(),
  createPerplexityPack(),
  createPineconePack(),
  createPostgreSqlPack(),
  createPostHogPack(),
  createQdrantPack(),
  createRdsPack(),
  createRedditPack(),
  createRedisPack(),
  createS3Pack(),
  createSalesforcePack(),
  createSecretsManagerPack(),
  createSendGridPack(),
  createSesPack(),
  createSftpPack(),
  createSharePointPack(),
  createShopifyPack(),
  createSqsPack(),
  createSshPack(),
  createStsPack(),
  createSupabasePack(),
  createTailscalePack(),
  createTavilyPack(),
  createTelegramPack(),
  createTemporalPack(),
  createTextractPack(),
  createTrelloPack(),
  createTwilioVoicePack(),
  createTypeformPack(),
  createUpstashPack(),
  createVercelPack(),
  createWebflowPack(),
  createWikipediaPack(),
  createXPack(),
  createZendeskPack(),
];
