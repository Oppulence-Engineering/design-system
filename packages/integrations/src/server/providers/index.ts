import { createIntegrationProviderSdkRegistry } from "../core/provider-sdk";
import type { IntegrationProviderSdk } from "../core/provider-sdk";
import type { IntegrationProviderSdkRegistry } from "../core/provider-sdk";
import type { IntegrationApiKeyRuntime } from "../runtime/api-key";
import type { IntegrationOAuthRuntime } from "../runtime/oauth";
import type { IntegrationConnectionLinkRuntime } from "../transport/connection-link";
import type { IntegrationNoAuthRuntime } from "../runtime/no-auth";
import {
  createAirtableMetadataProviderSdk,
  createAirtableProviderSdk,
} from "./airtable";
import { createAlgoliaPack } from "./algolia";
import { createDynamoDbPack } from "./amazon-dynamodb";
import { createRdsPack } from "./amazon-rds";
import { createSqsPack } from "./amazon-sqs";
import { createArxivPack } from "./arxiv";
import { createAsanaProviderSdk } from "./asana";
import { createAthenaPack } from "./athena";
import { createAppConfigPack } from "./aws-appconfig";
import { createIamPack } from "./aws-iam";
import { createIdentityCenterPack } from "./aws-identity-center";
import { createSecretsManagerPack } from "./aws-secrets-manager";
import { createSesPack } from "./aws-ses";
import { createStsPack } from "./aws-sts";
import { createTextractPack } from "./aws-textract";
import { createAzureAdProviderSdk } from "./azure-ad";
import { createAzureDevOpsPack } from "./azure-devops";
import { createBoxPack } from "./box";
import { createBrandfetchPack } from "./brandfetch";
import { createBrexProviderSdk } from "./brex";
import { createCalComPack } from "./cal-com";
import { createCalendlyPack } from "./calendly";
import { createClerkPack } from "./clerk";
import { createClickHousePack } from "./clickhouse";
import {
  createCloudflareProviderSdk,
  createCloudflareZoneSettingsProviderSdk,
} from "./cloudflare";
import { createCloudFormationPack } from "./cloudformation";
import { createCloudWatchPack } from "./cloudwatch";
import { createCodePipelinePack } from "./codepipeline";
import { createConfluenceProviderSdk } from "./confluence";
import { createDatadogPack } from "./datadog";
import { createDiscordPack } from "./discord";
import { createDocuSignPack } from "./docusign";
import { createDropboxProviderSdk } from "./dropbox";
import { createElasticsearchPack } from "./elasticsearch";
import { createElevenLabsProviderSdk } from "./elevenlabs";
import { createExaPack } from "./exa";
import { createFirecrawlProviderSdk } from "./firecrawl";
import { createGitHubProviderSdk } from "./github";
import { GitLabProviderSdkConfig, createGitLabProviderSdk } from "./gitlab";
import { createGmailProviderSdk } from "./gmail";
import { createGoogleAppSheetPack } from "./google-appsheet";
import { createGoogleBigQueryPack } from "./google-bigquery";
import { createGoogleBooksProviderSdk } from "./google-books";
import { createGoogleCalendarProviderSdk } from "./google-calendar";
import { createGoogleContactsProviderSdk } from "./google-contacts";
import { createGoogleDocsProviderSdk } from "./google-docs";
import { createGoogleDriveProviderSdk } from "./google-drive";
import { createGoogleFormsProviderSdk } from "./google-forms";
import { createGoogleGroupsProviderSdk } from "./google-groups";
import { createGoogleMapsPack } from "./google-maps";
import { createGoogleMeetProviderSdk } from "./google-meet";
import { createGoogleSheetsProviderSdk } from "./google-sheets";
import { createGoogleSlidesProviderSdk } from "./google-slides";
import { createGoogleTasksProviderSdk } from "./google-tasks";
import { createGoogleTranslatePack } from "./google-translate";
import { createGoogleVaultPack } from "./google-vault";
import { createHubSpotProviderSdk } from "./hubspot";
import { createHunterIoPack } from "./hunter-io";
import { createIntercomProviderSdk } from "./intercom";
import { createJinaPack } from "./jina";
import { createJiraProviderSdk } from "./jira";
import {
  createJiraServiceManagementProviderSdk,
  createJiraServiceManagementRestProviderSdk,
} from "./jira-service-management";
import { createJupyterPack } from "./jupyter";
import { createLinearProviderSdk } from "./linear";
import { createLinkedInPack } from "./linkedin";
import { createMailchimpProviderSdk } from "./mailchimp";
import { createMailgunProviderSdk } from "./mailgun";
import { MergeProviderSdkConfig, createMergeProviderSdk } from "./merge";
import { createMicrosoftExcelProviderSdk } from "./microsoft-excel";
import { createMicrosoftPlannerProviderSdk } from "./microsoft-planner";
import { createMicrosoftTeamsProviderSdk } from "./microsoft-teams";
import { createMongoDbPack } from "./mongodb";
import { createMySqlPack } from "./mysql";
import { createNeo4jPack } from "./neo4j";
import { createOktaPack } from "./okta";
import { createOneDriveProviderSdk } from "./onedrive";
import { createOutlookProviderSdk } from "./outlook";
import { createPagerDutyPack } from "./pagerduty";
import { createPerplexityPack } from "./perplexity";
import { createPineconePack } from "./pinecone";
import { PlaidProviderSdkConfig, createPlaidProviderSdk } from "./plaid";
import { createPostgreSqlPack } from "./postgresql";
import { createQdrantPack } from "./qdrant";
import {
  QuickBooksProviderSdkConfig,
  createQuickBooksProviderSdk,
} from "./quickbooks";
import { createRedditPack } from "./reddit";
import { createRedisPack } from "./redis";
import { createResendProviderSdk } from "./resend";
import { createS3Pack } from "./s3";
import { createSalesforcePack } from "./salesforce";
import { createSendGridPack } from "./sendgrid";
import { createSftpPack } from "./sftp";
import { createSharePointProviderSdk } from "./sharepoint";
import { createShopifyPack } from "./shopify";
import { createSlackProviderSdk } from "./slack";
import { createSquareProviderSdk } from "./square";
import { createSshPack } from "./ssh";
import { createStripeProviderSdk } from "./stripe";
import { createSupabasePack } from "./supabase";
import { createTavilyPack } from "./tavily";
import { createTelegramPack } from "./telegram";
import { createTemporalPack } from "./temporal";
import { createTrelloPack } from "./trello";
import { createTwilioVoicePack } from "./twilio-voice";
import { createTypeformPack } from "./typeform";
import { createUpstashPack } from "./upstash";
import {
  createVercelEdgeConfigItemsProviderSdk,
  createVercelProviderSdk,
} from "./vercel";
import { createWebflowPack } from "./webflow";
import { createWikipediaPack } from "./wikipedia";
import { createXPack } from "./x";
import { XeroProviderSdkConfig, createXeroProviderSdk } from "./xero";
import { createYouTubeProviderSdk } from "./youtube";
import { createZendeskPack } from "./zendesk";
import { BUILT_IN_PROVIDER_PACKS } from "./registry";

export * from "./airtable";
export * from "./algolia";
export * from "./amazon-dynamodb";
export * from "./amazon-rds";
export * from "./amazon-sqs";
export * from "./arxiv";
export * from "./asana";
export * from "./athena";
export * from "./attio";
export * from "./aws-appconfig";
export * from "./aws-iam";
export * from "./aws-identity-center";
export * from "./aws-secrets-manager";
export * from "./aws-ses";
export * from "./aws-sts";
export * from "./aws-textract";
export * from "./azure-ad";
export * from "./azure-devops";
export * from "./box";
export * from "./brandfetch";
export * from "./brex";
export * from "./cal-com";
export * from "./calendly";
export * from "./clerk";
export * from "./clickhouse";
export * from "./clickup";
export * from "./cloudflare";
export * from "./cloudformation";
export * from "./cloudwatch";
export * from "./codepipeline";
export * from "./confluence";
export * from "./datadog";
export * from "./discord";
export * from "./docusign";
export * from "./dropbox";
export * from "./elasticsearch";
export * from "./elevenlabs";
export * from "./exa";
export * from "./firecrawl";
export * from "./github";
export * from "./gitlab";
export * from "./gmail";
export * from "./google-appsheet";
export * from "./google-bigquery";
export * from "./google-books";
export * from "./google-calendar";
export * from "./google-contacts";
export * from "./google-docs";
export * from "./google-drive";
export * from "./google-forms";
export * from "./google-groups";
export * from "./google-maps";
export * from "./google-meet";
export * from "./google-sheets";
export * from "./google-slides";
export * from "./google-tasks";
export * from "./google-translate";
export * from "./google-vault";
export * from "./hubspot";
export * from "./hunter-io";
export * from "./incident-io";
export * from "./intercom";
export * from "./jina";
export * from "./jira";
export * from "./jira-service-management";
export * from "./jupyter";
export * from "./linear";
export * from "./linkedin";
export * from "./mailchimp";
export * from "./mailgun";
export * from "./merge";
export * from "./microsoft-excel";
export * from "./microsoft-planner";
export * from "./microsoft-teams";
export * from "./mongodb";
export * from "./mysql";
export * from "./neo4j";
export * from "./okta";
export * from "./onedrive";
export * from "./outlook";
export * from "./pagerduty";
export * from "./perplexity";
export * from "./pinecone";
export * from "./plaid";
export * from "./postgresql";
export * from "./posthog";
export * from "./qdrant";
export * from "./quickbooks";
export * from "./reddit";
export * from "./redis";
export * from "./resend";
export * from "./rootly";
export * from "./s3";
export * from "./salesforce";
export * from "./sendgrid";
export * from "./sftp";
export * from "./shared/clients/atlassian";
export * from "./shared/clients/atlassian-triggers";
export * from "./shared/clients/aws";
export * from "./shared/clients/microsoft-graph";
export * from "./shared/clients/microsoft-graph-query";
export * from "./shared/clients/microsoft-graph-triggers";
export * from "./shared/clients/protocol";
export * from "./shared/clients/protocol-sql";
export * from "./shared/clients/vendor";
export * from "./shared/rest";
export * from "./shared/sdk";
export * from "./shared/sql-connection";
export * from "./shared/ssh-connection";
export * from "./sharepoint";
export * from "./shopify";
export * from "./slack";
export * from "./square";
export * from "./ssh";
export * from "./stripe";
export * from "./supabase";
export * from "./tailscale";
export * from "./tavily";
export * from "./telegram";
export * from "./temporal";
export * from "./trello";
export * from "./twilio-voice";
export * from "./typeform";
export * from "./upstash";
export * from "./vercel";
export * from "./webflow";
export * from "./wikipedia";
export * from "./x";
export * from "./xero";
export * from "./youtube";
export * from "./zendesk";
export { BUILT_IN_PROVIDER_PACKS } from "./registry";

export interface BuiltInProviderSdkRegistryConfig {
  /**
   * Required for package-owned API-key adapters such as Stripe and GitHub.
   * `request` additionally backs the typed REST lane, which covers the actions
   * a vendor SDK does not model.
   */
  apiKeyRuntime?: Pick<IntegrationApiKeyRuntime, "withCredential" | "request">;
  /** Optional package configuration for a trusted self-managed GitLab host. */
  gitlab?: Omit<GitLabProviderSdkConfig, "apiKeyRuntime">;
  /** Required for package-owned OAuth adapters such as Slack and HubSpot. */
  oauthRuntime?: Pick<IntegrationOAuthRuntime, "withCredential" | "request">;
  /**
   * Required for the public, unauthenticated providers — Wikipedia and arXiv
   * have no credential at all, so they cannot use the API-key transport.
   */
  noAuthRuntime?: Pick<IntegrationNoAuthRuntime, "request">;
  /** Required for package-owned browser-Link adapters such as Plaid and Merge. */
  connectionLinkRuntime?: Pick<
    IntegrationConnectionLinkRuntime,
    "withPlaidCredential" | "withMergeCredential"
  >;
  /** Deployment configuration for the official Xero Node SDK. */
  xero?: Omit<XeroProviderSdkConfig, "oauthRuntime">;
  /** Deployment configuration for the maintained QuickBooks Node SDK. */
  quickbooks?: Omit<QuickBooksProviderSdkConfig, "oauthRuntime">;
  /** Deployment configuration for the Plaid Node SDK. */
  plaid?: Omit<PlaidProviderSdkConfig, "connectionLinkRuntime">;
  /** Deployment configuration for Merge's TypeScript SDK. */
  merge?: Omit<MergeProviderSdkConfig, "connectionLinkRuntime">;
}

/**
 * The standard package registry for currently shipped provider SDK adapters.
 * Products configure their encrypted credential runtimes once, then mount the
 * execution route; they do not instantiate vendor SDKs or handle secrets.
 */
export function createBuiltInProviderSdkRegistry(
  config: BuiltInProviderSdkRegistryConfig,
): IntegrationProviderSdkRegistry {
  const providers: IntegrationProviderSdk[] = [
    ...BUILT_IN_PROVIDER_PACKS.flatMap((pack) => pack.create(config)),
  ];
  if (config.apiKeyRuntime) {
    providers.push(
      createStripeProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createGitHubProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createGitLabProviderSdk({
        apiKeyRuntime: config.apiKeyRuntime,
        ...config.gitlab,
      }),
      createElevenLabsProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createFirecrawlProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createMailgunProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createIntercomProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createMailchimpProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createSquareProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createGoogleBooksProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createYouTubeProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createResendProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createBrexProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      // AWS providers are delivered as packs; each builds its own adapter
      // from the shared executor and the composite key credential.
    );
  }
  if (config.oauthRuntime) {
    providers.push(
      createSlackProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createHubSpotProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createLinearProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleCalendarProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleDriveProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleSheetsProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleDocsProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGmailProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleFormsProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleTasksProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleContactsProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleMeetProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleGroupsProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createGoogleSlidesProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createAsanaProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createDropboxProviderSdk({ oauthRuntime: config.oauthRuntime }),
    );
    if (config.xero) {
      providers.push(
        createXeroProviderSdk({
          oauthRuntime: config.oauthRuntime,
          ...config.xero,
        }),
      );
    }
    if (config.quickbooks) {
      providers.push(
        createQuickBooksProviderSdk({
          oauthRuntime: config.oauthRuntime,
          ...config.quickbooks,
        }),
      );
    }
  }
  if (config.connectionLinkRuntime && config.plaid) {
    providers.push(
      createPlaidProviderSdk({
        connectionLinkRuntime: config.connectionLinkRuntime,
        ...config.plaid,
      }),
    );
  }
  if (config.connectionLinkRuntime && config.merge) {
    providers.push(
      createMergeProviderSdk({
        connectionLinkRuntime: config.connectionLinkRuntime,
        ...config.merge,
      }),
    );
  }
  return createIntegrationProviderSdkRegistry(providers);
}
