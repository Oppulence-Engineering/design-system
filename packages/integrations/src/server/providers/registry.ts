import type { IntegrationProviderPack } from "../core/provider-pack";
import { createAgentmailPack } from "./agentmail";
import { createAgentphonePack } from "./agentphone";
import { createAhrefsPack } from "./ahrefs";
import { createAirtablePack } from "./airtable";
import { createAlgoliaPack } from "./algolia";
import { createDynamoDbPack } from "./amazon-dynamodb";
import { createRdsPack } from "./amazon-rds";
import { createSqsPack } from "./amazon-sqs";
import { createApifyPack } from "./apify";
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
import { createBitbucketPack } from "./bitbucket";
import { createBoxPack } from "./box";
import { createBrandfetchPack } from "./brandfetch";
import { createCalComPack } from "./cal-com";
import { createCalendlyPack } from "./calendly";
import { createClerkPack } from "./clerk";
import { createClickHousePack } from "./clickhouse";
import { createClickUpPack } from "./clickup";
import { createClosePack } from "./close";
import { createCloudflarePack } from "./cloudflare";
import { createCloudFormationPack } from "./cloudformation";
import { createCloudWatchPack } from "./cloudwatch";
import { createCodePipelinePack } from "./codepipeline";
import { createConfluencePack } from "./confluence";
import { createCopperPack } from "./copper";
import { createDatadogPack } from "./datadog";
import { createDaytonaPack } from "./daytona";
import { createDevinPack } from "./devin";
import { createDiscordPack } from "./discord";
import { createDocuSignPack } from "./docusign";
import { createElasticsearchPack } from "./elasticsearch";
import { createExaPack } from "./exa";
import { createFrontPack } from "./front";
import { createGoogleAppSheetPack } from "./google-appsheet";
import { createGoogleBigQueryPack } from "./google-bigquery";
import { createGoogleMapsPack } from "./google-maps";
import { createGoogleTranslatePack } from "./google-translate";
import { createGoogleVaultPack } from "./google-vault";
import { createGranolaPack } from "./granola";
import { createGrafanaPack } from "./grafana";
import { createHunterIoPack } from "./hunter-io";
import { createIncidentIoPack } from "./incident-io";
import { createInfisicalPack } from "./infisical";
import { createInstantlyPack } from "./instantly";
import { createJinaPack } from "./jina";
import { createJiraPack } from "./jira";
import { createJiraServiceManagementPack } from "./jira-service-management";
import { createJupyterPack } from "./jupyter";
import { createKalshiPack } from "./kalshi";
import { createLangsmithPack } from "./langsmith";
import { createLaunchdarklyPack } from "./launchdarkly";
import { createLeadmagicPack } from "./leadmagic";
import { createLemlistPack } from "./lemlist";
import { createLinkedInPack } from "./linkedin";
import { createLoopsPack } from "./loops";
import { createMem0Pack } from "./mem0";
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
import { createProfoundPack } from "./profound";
import { createQdrantPack } from "./qdrant";
import { createQuartrPack } from "./quartr";
import { createRedditPack } from "./reddit";
import { createRedisPack } from "./redis";
import { createRootlyPack } from "./rootly";
import { createS3Pack } from "./s3";
import { createSalesflarePack } from "./salesflare";
import { createSalesforcePack } from "./salesforce";
import { createSendGridPack } from "./sendgrid";
import { createSentryPack } from "./sentry";
import { createSftpPack } from "./sftp";
import { createSharePointPack } from "./sharepoint";
import { createShopifyPack } from "./shopify";
import { createSixtyfourAiPack } from "./sixtyfour-ai";
import { createSshPack } from "./ssh";
import { createStagehandPack } from "./stagehand";
import { createSupabasePack } from "./supabase";
import { createTailscalePack } from "./tailscale";
import { createTaleezPack } from "./taleez";
import { createTavilyPack } from "./tavily";
import { createTelegramPack } from "./telegram";
import { createTemporalPack } from "./temporal";
import { createThrivePack } from "./thrive";
import { createTrelloPack } from "./trello";
import { createTwilioVoicePack } from "./twilio-voice";
import { createTypeformPack } from "./typeform";
import { createUpstashPack } from "./upstash";
import { createUptimerobotPack } from "./uptimerobot";
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
  createAgentmailPack(),
  createAgentphonePack(),
  createAhrefsPack(),
  createAirtablePack(),
  createAlgoliaPack(),
  createApifyPack(),
  createAppConfigPack(),
  createArxivPack(),
  createAthenaPack(),
  createAttioPack(),
  createAzureAdPack(),
  createAzureDevOpsPack(),
  createBitbucketPack(),
  createBoxPack(),
  createBrandfetchPack(),
  createCalComPack(),
  createCalendlyPack(),
  createClerkPack(),
  createClickHousePack(),
  createClickUpPack(),
  createClosePack(),
  createCloudFormationPack(),
  createCloudWatchPack(),
  createCloudflarePack(),
  createCodePipelinePack(),
  createConfluencePack(),
  createCopperPack(),
  createDatadogPack(),
  createDaytonaPack(),
  createDevinPack(),
  createDiscordPack(),
  createDocuSignPack(),
  createDynamoDbPack(),
  createElasticsearchPack(),
  createExaPack(),
  createFrontPack(),
  createGoogleAppSheetPack(),
  createGoogleBigQueryPack(),
  createGoogleMapsPack(),
  createGoogleTranslatePack(),
  createGoogleVaultPack(),
  createGranolaPack(),
  createGrafanaPack(),
  createHunterIoPack(),
  createIamPack(),
  createIdentityCenterPack(),
  createIncidentIoPack(),
  createInfisicalPack(),
  createInstantlyPack(),
  createJinaPack(),
  createJiraPack(),
  createJiraServiceManagementPack(),
  createJupyterPack(),
  createKalshiPack(),
  createLangsmithPack(),
  createLaunchdarklyPack(),
  createLeadmagicPack(),
  createLemlistPack(),
  createLinkedInPack(),
  createLoopsPack(),
  createMem0Pack(),
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
  createProfoundPack(),
  createQdrantPack(),
  createQuartrPack(),
  createRdsPack(),
  createRedditPack(),
  createRedisPack(),
  createRootlyPack(),
  createS3Pack(),
  createSalesflarePack(),
  createSalesforcePack(),
  createSecretsManagerPack(),
  createSendGridPack(),
  createSentryPack(),
  createSesPack(),
  createSftpPack(),
  createSharePointPack(),
  createShopifyPack(),
  createSixtyfourAiPack(),
  createSqsPack(),
  createSshPack(),
  createStagehandPack(),
  createStsPack(),
  createSupabasePack(),
  createTailscalePack(),
  createTaleezPack(),
  createTavilyPack(),
  createTelegramPack(),
  createTemporalPack(),
  createTextractPack(),
  createThrivePack(),
  createTrelloPack(),
  createTwilioVoicePack(),
  createTypeformPack(),
  createUpstashPack(),
  createUptimerobotPack(),
  createVercelPack(),
  createWebflowPack(),
  createWikipediaPack(),
  createXPack(),
  createZendeskPack(),
];
