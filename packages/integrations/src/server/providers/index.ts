import { createIntegrationProviderSdkRegistry } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import type { IntegrationProviderSdkRegistry } from "../provider-sdk";
import type { IntegrationApiKeyRuntime } from "../api-key-runtime";
import type { IntegrationOAuthRuntime } from "../runtime";
import type { IntegrationConnectionLinkRuntime } from "../connection-link";
import {
  createAirtableMetadataProviderSdk,
  createAirtableProviderSdk,
} from "./airtable";
import {
  createAzureAdProviderSdk,
  createMicrosoftExcelProviderSdk,
  createMicrosoftPlannerProviderSdk,
  createMicrosoftTeamsProviderSdk,
  createOneDriveProviderSdk,
  createOutlookProviderSdk,
  createSharePointProviderSdk,
} from "./microsoft-graph";
import {
  createConfluenceProviderSdk,
  createJiraProviderSdk,
  createJiraServiceManagementProviderSdk,
  createJiraServiceManagementRestProviderSdk,
} from "./atlassian";
import {
  createAppConfigPack,
  createAthenaPack,
  createCloudFormationPack,
  createCloudWatchPack,
  createCodePipelinePack,
  createDynamoDbPack,
  createIamPack,
  createIdentityCenterPack,
  createRdsPack,
  createS3Pack,
  createSecretsManagerPack,
  createSesPack,
  createSqsPack,
  createStsPack,
  createTextractPack,
} from "./aws";
import {
  createClickHousePack,
  createMongoDbPack,
  createNeo4jPack,
  createJupyterPack,
  createMySqlPack,
  createPostgreSqlPack,
  createRedisPack,
  createSftpPack,
  createSshPack,
} from "./protocol";
import {
  createAlgoliaPack,
  createBoxPack,
  createClerkPack,
  createDatadogPack,
  createElasticsearchPack,
  createAzureDevOpsPack,
  createCalComPack,
  createDocuSignPack,
  createGoogleAppSheetPack,
  createGoogleBigQueryPack,
  createGoogleMapsPack,
  createGoogleTranslatePack,
  createTwilioVoicePack,
  createShopifyPack,
  createTemporalPack,
  createZendeskPack,
  createGoogleVaultPack,
  createPineconePack,
  createQdrantPack,
  createRedditPack,
  createUpstashPack,
  createOktaPack,
  createSalesforcePack,
  createSupabasePack,
  createTrelloPack,
  createXPack,
} from "./vendor";
import { createAsanaProviderSdk } from "./asana";
import { createBrexProviderSdk } from "./brex";
import {
  createCloudflareProviderSdk,
  createCloudflareZoneSettingsProviderSdk,
} from "./cloudflare";
import { createDropboxProviderSdk } from "./dropbox";
import { createElevenLabsProviderSdk } from "./elevenlabs";
import { createFirecrawlProviderSdk } from "./firecrawl";
import { createGitHubProviderSdk } from "./github";
import { GitLabProviderSdkConfig, createGitLabProviderSdk } from "./gitlab";
import { createGmailProviderSdk } from "./gmail";
import { createGoogleBooksProviderSdk } from "./google-books";
import { createGoogleCalendarProviderSdk } from "./google-calendar";
import { createGoogleContactsProviderSdk } from "./google-contacts";
import { createGoogleDocsProviderSdk } from "./google-docs";
import { createGoogleDriveProviderSdk } from "./google-drive";
import { createGoogleFormsProviderSdk } from "./google-forms";
import { createGoogleGroupsProviderSdk } from "./google-groups";
import { createGoogleMeetProviderSdk } from "./google-meet";
import { createGoogleSheetsProviderSdk } from "./google-sheets";
import { createGoogleSlidesProviderSdk } from "./google-slides";
import { createGoogleTasksProviderSdk } from "./google-tasks";
import { createHubSpotProviderSdk } from "./hubspot";
import { createIntercomProviderSdk } from "./intercom";
import { createLinearProviderSdk } from "./linear";
import { createMailchimpProviderSdk } from "./mailchimp";
import { createMailgunProviderSdk } from "./mailgun";
import { MergeProviderSdkConfig, createMergeProviderSdk } from "./merge";
import { PlaidProviderSdkConfig, createPlaidProviderSdk } from "./plaid";
import {
  QuickBooksProviderSdkConfig,
  createQuickBooksProviderSdk,
} from "./quickbooks";
import { createResendProviderSdk } from "./resend";
import { createSlackProviderSdk } from "./slack";
import { createSquareProviderSdk } from "./square";
import { createStripeProviderSdk } from "./stripe";
import {
  createVercelEdgeConfigItemsProviderSdk,
  createVercelProviderSdk,
} from "./vercel";
import { XeroProviderSdkConfig, createXeroProviderSdk } from "./xero";
import { createYouTubeProviderSdk } from "./youtube";

export * from "./stripe";
export * from "./slack";
export * from "./hubspot";
export * from "./github";
export * from "./gitlab";
export * from "./cloudflare";
export * from "./elevenlabs";
export * from "./firecrawl";
export * from "./airtable";
export * from "./asana";
export * from "./dropbox";
export * from "./mailgun";
export * from "./intercom";
export * from "./linear";
export * from "./mailchimp";
export * from "./vercel";
export * from "./square";
export * from "./google-calendar";
export * from "./google-drive";
export * from "./google-sheets";
export * from "./google-docs";
export * from "./google-forms";
export * from "./google-tasks";
export * from "./google-contacts";
export * from "./google-books";
export * from "./google-meet";
export * from "./google-groups";
export * from "./gmail";
export * from "./google-slides";
export * from "./youtube";
export * from "./resend";
export * from "./brex";
export * from "./quickbooks";
export * from "./xero";
export * from "./plaid";
export * from "./merge";
export * from "./microsoft-graph";
export * from "./atlassian";
export * from "./aws";
export * from "./protocol";
export * from "./vendor";

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
  const providers: IntegrationProviderSdk[] = [];
  if (config.apiKeyRuntime) {
    providers.push(
      createStripeProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createGitHubProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createGitLabProviderSdk({
        apiKeyRuntime: config.apiKeyRuntime,
        ...config.gitlab,
      }),
      createCloudflareProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createCloudflareZoneSettingsProviderSdk({
        apiKeyRuntime: config.apiKeyRuntime,
      }),
      createElevenLabsProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createFirecrawlProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createMailgunProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createIntercomProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createMailchimpProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createVercelProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createVercelEdgeConfigItemsProviderSdk({
        apiKeyRuntime: config.apiKeyRuntime,
      }),
      createSquareProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createGoogleBooksProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createYouTubeProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createResendProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      createBrexProviderSdk({ apiKeyRuntime: config.apiKeyRuntime }),
      // AWS providers are delivered as packs; each builds its own adapter
      // from the shared executor and the composite key credential.
      ...[
        createS3Pack(),
        createDynamoDbPack(),
        createSqsPack(),
        createRdsPack(),
        createSesPack(),
        createIamPack(),
        createStsPack(),
        createIdentityCenterPack(),
        createSecretsManagerPack(),
        createTextractPack(),
        createAppConfigPack(),
        createAthenaPack(),
        createCloudWatchPack(),
        createCloudFormationPack(),
        createCodePipelinePack(),
        // Protocol providers: databases, cache, shell, file transfer, and the
        // self-hosted Jupyter server.
        createPostgreSqlPack(),
        createMySqlPack(),
        createClickHousePack(),
        createRedisPack(),
        createSshPack(),
        createSftpPack(),
        createJupyterPack(),
        createClerkPack(),
        createOktaPack(),
        createSupabasePack(),
        createDatadogPack(),
        createAlgoliaPack(),
        createUpstashPack(),
        createPineconePack(),
        createQdrantPack(),
        createElasticsearchPack(),
        createGoogleTranslatePack(),
        createMongoDbPack(),
        createNeo4jPack(),
        createGoogleMapsPack(),
        createTwilioVoicePack(),
        createGoogleAppSheetPack(),
        createZendeskPack(),
        createAzureDevOpsPack(),
        createTemporalPack(),
      ].flatMap((pack) => pack.create({ apiKeyRuntime: config.apiKeyRuntime })),
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
      createAirtableProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createAirtableMetadataProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createAzureAdProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createOutlookProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createOneDriveProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createSharePointProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createMicrosoftPlannerProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createMicrosoftTeamsProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createMicrosoftExcelProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createJiraProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createConfluenceProviderSdk({ oauthRuntime: config.oauthRuntime }),
      createJiraServiceManagementProviderSdk({
        oauthRuntime: config.oauthRuntime,
      }),
      createJiraServiceManagementRestProviderSdk({
        oauthRuntime: config.oauthRuntime,
      }),
      ...createSalesforcePack().create({ oauthRuntime: config.oauthRuntime }),
      ...createTrelloPack().create({ oauthRuntime: config.oauthRuntime }),
      ...createXPack().create({ oauthRuntime: config.oauthRuntime }),
      ...createRedditPack().create({ oauthRuntime: config.oauthRuntime }),
      ...createBoxPack().create({ oauthRuntime: config.oauthRuntime }),
      ...createGoogleVaultPack().create({ oauthRuntime: config.oauthRuntime }),
      ...createGoogleBigQueryPack().create({
        oauthRuntime: config.oauthRuntime,
      }),
      ...createDocuSignPack().create({ oauthRuntime: config.oauthRuntime }),
      ...createShopifyPack().create({ oauthRuntime: config.oauthRuntime }),
      ...createCalComPack().create({ oauthRuntime: config.oauthRuntime }),
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
