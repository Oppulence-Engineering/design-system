import { createRequire } from "node:module";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationApiKeyRuntime } from "../api-key-runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import { ProviderSdkInvocationSchema } from "./shared";

const mailchimpRequire = createRequire(import.meta.url);

interface MailchimpSdkClient {
  setConfig(configuration: { apiKey: string; server: string }): void;
  [resource: string]: unknown;
}

interface MailchimpSdkResource {
  [method: string]: unknown;
}

type MailchimpClientFactory = (apiKey: string) => MailchimpSdkClient;

export interface MailchimpProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: MailchimpClientFactory;
}

function mailchimpServerFromApiKey(apiKey: string): string {
  const match = /-([a-z0-9]+)$/iu.exec(apiKey);
  if (!match) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return match[1].toLowerCase();
}

function createMailchimpClient(apiKey: string): MailchimpSdkClient {
  const MailchimpApiClient = mailchimpRequire(
    "@mailchimp/mailchimp_marketing/src/ApiClient",
  ) as new () => MailchimpSdkClient;
  const client = new MailchimpApiClient();
  client.setConfig({ apiKey, server: mailchimpServerFromApiKey(apiKey) });
  return client;
}

const MAILCHIMP_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "mailchimp",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

function requiredMailchimpString(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): string {
  for (const name of names) {
    const value = input[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  throw new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

function optionalMailchimpString(
  input: Readonly<Record<string, unknown>>,
  name: string,
): string | undefined {
  const value = input[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalMailchimpJson(
  input: Readonly<Record<string, unknown>>,
  name: string,
): unknown {
  const value = input[name];
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
}

function mailchimpOptions(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (const name of [
    "beforeSendTime",
    "count",
    "excludeFields",
    "fields",
    "offset",
    "sinceSendTime",
    "sortDir",
    "sortField",
    "status",
    "type",
  ]) {
    const value = input[name];
    if (value !== undefined && value !== "") options[name] = value;
  }
  return options;
}

async function invokeMailchimpMethod(
  client: MailchimpSdkClient,
  resource: string,
  method: string,
  arguments_: readonly unknown[],
): Promise<unknown> {
  const api = client[resource];
  if (!api || typeof api !== "object") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const candidate = (api as MailchimpSdkResource)[method];
  if (typeof candidate !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return candidate.apply(api, arguments_);
}

interface MailchimpOperationRequest {
  resource: string;
  method: string;
  arguments: readonly unknown[];
}

type MailchimpOperationRequestFactory = (
  input: Readonly<Record<string, unknown>>,
) => MailchimpOperationRequest;

function mailchimpRequest(
  resource: string,
  method: string,
  arguments_: readonly unknown[],
): MailchimpOperationRequest {
  return { resource, method, arguments: arguments_ };
}

function mailchimpMemberBody(
  input: Readonly<Record<string, unknown>>,
  options: { statusIfNew?: boolean } = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const emailAddress = optionalMailchimpString(input, "emailAddress");
  const status = optionalMailchimpString(input, "status");
  const statusIfNew = optionalMailchimpString(input, "statusIfNew");
  const mergeFields = optionalMailchimpJson(input, "mergeFields");
  const interests = optionalMailchimpJson(input, "interests");
  if (emailAddress) body.email_address = emailAddress;
  if (status) body.status = status;
  if (options.statusIfNew && statusIfNew) body.status_if_new = statusIfNew;
  if (mergeFields !== undefined) body.merge_fields = mergeFields;
  if (interests !== undefined) body.interests = interests;
  return body;
}

function mailchimpTagBody(
  input: Readonly<Record<string, unknown>>,
  status: "active" | "inactive",
): Record<string, unknown> {
  const tags = optionalMailchimpJson(input, "tags");
  const entries = Array.isArray(tags) ? tags : [];
  return {
    tags: entries.map((entry) =>
      typeof entry === "string"
        ? { name: entry, status }
        : entry && typeof entry === "object"
          ? { ...(entry as Record<string, unknown>), status }
          : entry,
    ),
  };
}

const MAILCHIMP_OPERATION_REQUESTS: Readonly<
  Record<string, MailchimpOperationRequestFactory>
> = {
  "mailchimp:get-audiences": (input) =>
    mailchimpRequest("lists", "getAllLists", [mailchimpOptions(input)]),
  "mailchimp:get-audience": (input) =>
    mailchimpRequest("lists", "getList", [
      requiredMailchimpString(input, "listId", "audienceId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:create-audience": (input) =>
    mailchimpRequest("lists", "createList", [
      {
        name: requiredMailchimpString(input, "audienceName", "name"),
        permission_reminder: requiredMailchimpString(
          input,
          "permissionReminder",
        ),
        email_type_option:
          input.emailTypeOption === "true" || input.emailTypeOption === true,
        ...(optionalMailchimpJson(input, "contact") !== undefined
          ? { contact: optionalMailchimpJson(input, "contact") }
          : {}),
        ...(optionalMailchimpJson(input, "campaignDefaults") !== undefined
          ? {
              campaign_defaults: optionalMailchimpJson(
                input,
                "campaignDefaults",
              ),
            }
          : {}),
      },
    ]),
  "mailchimp:update-audience": (input) =>
    mailchimpRequest("lists", "updateList", [
      requiredMailchimpString(input, "listId", "audienceId"),
      {
        ...(optionalMailchimpString(input, "audienceName")
          ? { name: optionalMailchimpString(input, "audienceName") }
          : {}),
        ...(optionalMailchimpString(input, "permissionReminder")
          ? {
              permission_reminder: optionalMailchimpString(
                input,
                "permissionReminder",
              ),
            }
          : {}),
        ...(input.emailTypeOption === undefined
          ? {}
          : {
              email_type_option:
                input.emailTypeOption === "true" ||
                input.emailTypeOption === true,
            }),
        ...(optionalMailchimpJson(input, "campaignDefaults") !== undefined
          ? {
              campaign_defaults: optionalMailchimpJson(
                input,
                "campaignDefaults",
              ),
            }
          : {}),
      },
    ]),
  "mailchimp:delete-audience": (input) =>
    mailchimpRequest("lists", "deleteList", [
      requiredMailchimpString(input, "listId", "audienceId"),
    ]),
  "mailchimp:get-members": (input) =>
    mailchimpRequest("lists", "getListMembersInfo", [
      requiredMailchimpString(input, "listId", "audienceId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:get-member": (input) =>
    mailchimpRequest("lists", "getListMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
      mailchimpOptions(input),
    ]),
  "mailchimp:add-member": (input) =>
    mailchimpRequest("lists", "addListMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      mailchimpMemberBody(input),
    ]),
  "mailchimp:add-or-update-member": (input) =>
    mailchimpRequest("lists", "setListMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
      mailchimpMemberBody(input, { statusIfNew: true }),
    ]),
  "mailchimp:update-member": (input) =>
    mailchimpRequest("lists", "updateListMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
      mailchimpMemberBody(input),
    ]),
  "mailchimp:delete-member": (input) =>
    mailchimpRequest("lists", "deleteListMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
    ]),
  "mailchimp:archive-member": (input) =>
    mailchimpRequest("lists", "deleteListMemberPermanent", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
    ]),
  "mailchimp:unarchive-member": (input) =>
    mailchimpRequest("lists", "updateListMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
      mailchimpMemberBody(input),
    ]),
  "mailchimp:get-campaigns": (input) =>
    mailchimpRequest("campaigns", "list", [mailchimpOptions(input)]),
  "mailchimp:get-campaign": (input) =>
    mailchimpRequest("campaigns", "get", [
      requiredMailchimpString(input, "campaignId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:create-campaign": (input) =>
    mailchimpRequest("campaigns", "create", [
      {
        type: requiredMailchimpString(input, "campaignType", "type"),
        ...(optionalMailchimpJson(input, "campaignSettings") !== undefined
          ? { settings: optionalMailchimpJson(input, "campaignSettings") }
          : {}),
        ...(optionalMailchimpJson(input, "recipients") !== undefined
          ? { recipients: optionalMailchimpJson(input, "recipients") }
          : {}),
      },
    ]),
  "mailchimp:update-campaign": (input) =>
    mailchimpRequest("campaigns", "update", [
      requiredMailchimpString(input, "campaignId"),
      {
        ...(optionalMailchimpJson(input, "campaignSettings") !== undefined
          ? { settings: optionalMailchimpJson(input, "campaignSettings") }
          : {}),
        ...(optionalMailchimpJson(input, "recipients") !== undefined
          ? { recipients: optionalMailchimpJson(input, "recipients") }
          : {}),
      },
    ]),
  "mailchimp:delete-campaign": (input) =>
    mailchimpRequest("campaigns", "remove", [
      requiredMailchimpString(input, "campaignId"),
    ]),
  "mailchimp:send-campaign": (input) =>
    mailchimpRequest("campaigns", "send", [
      requiredMailchimpString(input, "campaignId"),
    ]),
  "mailchimp:schedule-campaign": (input) =>
    mailchimpRequest("campaigns", "schedule", [
      requiredMailchimpString(input, "campaignId"),
      { schedule_time: requiredMailchimpString(input, "scheduleTime") },
    ]),
  "mailchimp:unschedule-campaign": (input) =>
    mailchimpRequest("campaigns", "unschedule", [
      requiredMailchimpString(input, "campaignId"),
    ]),
  "mailchimp:replicate-campaign": (input) =>
    mailchimpRequest("campaigns", "replicate", [
      requiredMailchimpString(input, "campaignId"),
    ]),
  "mailchimp:get-campaign-content": (input) =>
    mailchimpRequest("campaigns", "getContent", [
      requiredMailchimpString(input, "campaignId"),
    ]),
  "mailchimp:set-campaign-content": (input) =>
    mailchimpRequest("campaigns", "setContent", [
      requiredMailchimpString(input, "campaignId"),
      {
        ...(optionalMailchimpString(input, "html")
          ? { html: optionalMailchimpString(input, "html") }
          : {}),
        ...(optionalMailchimpString(input, "plainText")
          ? { plain_text: optionalMailchimpString(input, "plainText") }
          : {}),
        ...(optionalMailchimpString(input, "templateId")
          ? { template: { id: optionalMailchimpString(input, "templateId") } }
          : {}),
      },
    ]),
  "mailchimp:get-automations": (input) =>
    mailchimpRequest("automations", "list", [mailchimpOptions(input)]),
  "mailchimp:get-automation": (input) =>
    mailchimpRequest("automations", "get", [
      requiredMailchimpString(input, "workflowId", "automationId"),
    ]),
  "mailchimp:start-automation": (input) =>
    mailchimpRequest("automations", "startAllEmails", [
      requiredMailchimpString(input, "workflowId", "automationId"),
    ]),
  "mailchimp:pause-automation": (input) =>
    mailchimpRequest("automations", "pauseAllEmails", [
      requiredMailchimpString(input, "workflowId", "automationId"),
    ]),
  "mailchimp:add-subscriber-to-automation": (input) =>
    mailchimpRequest("automations", "addWorkflowEmailSubscriber", [
      requiredMailchimpString(input, "workflowId", "automationId"),
      requiredMailchimpString(input, "workflowEmailId", "emailId"),
      { email_address: requiredMailchimpString(input, "emailAddress") },
    ]),
  "mailchimp:get-templates": (input) =>
    mailchimpRequest("templates", "list", [mailchimpOptions(input)]),
  "mailchimp:get-template": (input) =>
    mailchimpRequest("templates", "getTemplate", [
      requiredMailchimpString(input, "templateId"),
    ]),
  "mailchimp:create-template": (input) =>
    mailchimpRequest("templates", "create", [
      {
        name: requiredMailchimpString(input, "templateName", "name"),
        html: requiredMailchimpString(input, "templateHtml", "html"),
      },
    ]),
  "mailchimp:update-template": (input) =>
    mailchimpRequest("templates", "updateTemplate", [
      requiredMailchimpString(input, "templateId"),
      {
        ...(optionalMailchimpString(input, "templateName")
          ? { name: optionalMailchimpString(input, "templateName") }
          : {}),
        ...(optionalMailchimpString(input, "templateHtml")
          ? { html: optionalMailchimpString(input, "templateHtml") }
          : {}),
      },
    ]),
  "mailchimp:delete-template": (input) =>
    mailchimpRequest("templates", "deleteTemplate", [
      requiredMailchimpString(input, "templateId"),
    ]),
  "mailchimp:get-campaign-reports": (input) =>
    mailchimpRequest("reports", "getAllCampaignReports", [
      mailchimpOptions(input),
    ]),
  "mailchimp:get-campaign-report": (input) =>
    mailchimpRequest("reports", "getCampaignReport", [
      requiredMailchimpString(input, "campaignId"),
    ]),
  "mailchimp:get-segments": (input) =>
    mailchimpRequest("lists", "listSegments", [
      requiredMailchimpString(input, "listId", "audienceId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:get-segment": (input) =>
    mailchimpRequest("lists", "getSegment", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "segmentId"),
    ]),
  "mailchimp:create-segment": (input) =>
    mailchimpRequest("lists", "createSegment", [
      requiredMailchimpString(input, "listId", "audienceId"),
      {
        name: requiredMailchimpString(input, "segmentName", "name"),
        ...(optionalMailchimpJson(input, "segmentOptions") !== undefined
          ? { options: optionalMailchimpJson(input, "segmentOptions") }
          : {}),
      },
    ]),
  "mailchimp:update-segment": (input) =>
    mailchimpRequest("lists", "updateSegment", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "segmentId"),
      {
        ...(optionalMailchimpString(input, "segmentName")
          ? { name: optionalMailchimpString(input, "segmentName") }
          : {}),
        ...(optionalMailchimpJson(input, "segmentOptions") !== undefined
          ? { options: optionalMailchimpJson(input, "segmentOptions") }
          : {}),
      },
    ]),
  "mailchimp:delete-segment": (input) =>
    mailchimpRequest("lists", "deleteSegment", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "segmentId"),
    ]),
  "mailchimp:get-segment-members": (input) =>
    mailchimpRequest("lists", "getSegmentMembersList", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "segmentId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:add-segment-member": (input) =>
    mailchimpRequest("lists", "createSegmentMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "segmentId"),
      { email_address: requiredMailchimpString(input, "emailAddress") },
    ]),
  "mailchimp:remove-segment-member": (input) =>
    mailchimpRequest("lists", "removeSegmentMember", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "segmentId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
    ]),
  "mailchimp:get-member-tags": (input) =>
    mailchimpRequest("lists", "getListMemberTags", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
    ]),
  "mailchimp:add-member-tags": (input) =>
    mailchimpRequest("lists", "updateListMemberTags", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
      mailchimpTagBody(input, "active"),
    ]),
  "mailchimp:remove-member-tags": (input) =>
    mailchimpRequest("lists", "updateListMemberTags", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "subscriberEmail", "subscriberHash"),
      mailchimpTagBody(input, "inactive"),
    ]),
  "mailchimp:get-merge-fields": (input) =>
    mailchimpRequest("lists", "getListMergeFields", [
      requiredMailchimpString(input, "listId", "audienceId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:get-merge-field": (input) =>
    mailchimpRequest("lists", "getListMergeField", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "mergeId"),
    ]),
  "mailchimp:create-merge-field": (input) =>
    mailchimpRequest("lists", "addListMergeField", [
      requiredMailchimpString(input, "listId", "audienceId"),
      {
        name: requiredMailchimpString(input, "mergeName", "name"),
        type: requiredMailchimpString(input, "mergeType", "type"),
      },
    ]),
  "mailchimp:update-merge-field": (input) =>
    mailchimpRequest("lists", "updateListMergeField", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "mergeId"),
      {
        ...(optionalMailchimpString(input, "mergeName")
          ? { name: optionalMailchimpString(input, "mergeName") }
          : {}),
      },
    ]),
  "mailchimp:delete-merge-field": (input) =>
    mailchimpRequest("lists", "deleteListMergeField", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "mergeId"),
    ]),
  "mailchimp:get-interest-categories": (input) =>
    mailchimpRequest("lists", "getListInterestCategories", [
      requiredMailchimpString(input, "listId", "audienceId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:get-interest-category": (input) =>
    mailchimpRequest("lists", "getInterestCategory", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
    ]),
  "mailchimp:create-interest-category": (input) =>
    mailchimpRequest("lists", "createListInterestCategory", [
      requiredMailchimpString(input, "listId", "audienceId"),
      {
        title: requiredMailchimpString(input, "interestCategoryTitle", "title"),
        type: requiredMailchimpString(input, "interestCategoryType", "type"),
      },
    ]),
  "mailchimp:update-interest-category": (input) =>
    mailchimpRequest("lists", "updateInterestCategory", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
      {
        ...(optionalMailchimpString(input, "interestCategoryTitle")
          ? { title: optionalMailchimpString(input, "interestCategoryTitle") }
          : {}),
      },
    ]),
  "mailchimp:delete-interest-category": (input) =>
    mailchimpRequest("lists", "deleteInterestCategory", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
    ]),
  "mailchimp:get-interests": (input) =>
    mailchimpRequest("lists", "listInterestCategoryInterests", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
      mailchimpOptions(input),
    ]),
  "mailchimp:get-interest": (input) =>
    mailchimpRequest("lists", "getInterestCategoryInterest", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
      requiredMailchimpString(input, "interestId"),
    ]),
  "mailchimp:create-interest": (input) =>
    mailchimpRequest("lists", "createInterestCategoryInterest", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
      { name: requiredMailchimpString(input, "interestName", "name") },
    ]),
  "mailchimp:update-interest": (input) =>
    mailchimpRequest("lists", "updateInterestCategoryInterest", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
      requiredMailchimpString(input, "interestId"),
      {
        ...(optionalMailchimpString(input, "interestName")
          ? { name: optionalMailchimpString(input, "interestName") }
          : {}),
      },
    ]),
  "mailchimp:delete-interest": (input) =>
    mailchimpRequest("lists", "deleteInterestCategoryInterest", [
      requiredMailchimpString(input, "listId", "audienceId"),
      requiredMailchimpString(input, "interestCategoryId"),
      requiredMailchimpString(input, "interestId"),
    ]),
  "mailchimp:get-landing-pages": (input) =>
    mailchimpRequest("landingPages", "getAll", [mailchimpOptions(input)]),
  "mailchimp:get-landing-page": (input) =>
    mailchimpRequest("landingPages", "getPage", [
      requiredMailchimpString(input, "pageId", "landingPageId"),
    ]),
  "mailchimp:create-landing-page": (input) =>
    mailchimpRequest("landingPages", "create", [
      {
        type: requiredMailchimpString(input, "landingPageType", "type"),
        ...(optionalMailchimpString(input, "landingPageTitle")
          ? { title: optionalMailchimpString(input, "landingPageTitle") }
          : {}),
      },
    ]),
  "mailchimp:update-landing-page": (input) =>
    mailchimpRequest("landingPages", "updatePage", [
      requiredMailchimpString(input, "pageId", "landingPageId"),
      {
        ...(optionalMailchimpString(input, "landingPageTitle")
          ? { title: optionalMailchimpString(input, "landingPageTitle") }
          : {}),
      },
    ]),
  "mailchimp:delete-landing-page": (input) =>
    mailchimpRequest("landingPages", "deletePage", [
      requiredMailchimpString(input, "pageId", "landingPageId"),
    ]),
  "mailchimp:publish-landing-page": (input) =>
    mailchimpRequest("landingPages", "publishPage", [
      requiredMailchimpString(input, "pageId", "landingPageId"),
    ]),
  "mailchimp:unpublish-landing-page": (input) =>
    mailchimpRequest("landingPages", "unpublishPage", [
      requiredMailchimpString(input, "pageId", "landingPageId"),
    ]),
  "mailchimp:get-batch-operations": (input) =>
    mailchimpRequest("batches", "list", [mailchimpOptions(input)]),
  "mailchimp:get-batch-operation": (input) =>
    mailchimpRequest("batches", "status", [
      requiredMailchimpString(input, "batchId"),
    ]),
  "mailchimp:create-batch-operation": (input) =>
    mailchimpRequest("batches", "start", [
      { operations: optionalMailchimpJson(input, "operations") ?? [] },
    ]),
  "mailchimp:delete-batch-operation": (input) =>
    mailchimpRequest("batches", "deleteRequest", [
      requiredMailchimpString(input, "batchId"),
    ]),
};

function assertMailchimpOperationCoverage(): void {
  const expected = new Set(MAILCHIMP_OPERATION_IDS);
  const implemented = Object.keys(MAILCHIMP_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Mailchimp provider SDK operation coverage is incomplete.");
  }
}

/**
 * All pinned Mailchimp actions through Mailchimp's generated Marketing API
 * client. A fresh SDK client is created per invocation so API-key server
 * prefixes and credentials can never cross a connection boundary.
 */
export function createMailchimpProviderSdk(
  config: MailchimpProviderSdkConfig,
): IntegrationProviderSdk {
  assertMailchimpOperationCoverage();
  const clientFactory = config.clientFactory ?? createMailchimpClient;
  return {
    integrationId: "mailchimp",
    operationIds: MAILCHIMP_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "mailchimp" ||
        invocation.reference.integrationId !== "mailchimp"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        MAILCHIMP_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      const request = requestFactory(invocation.input);
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: (await invokeMailchimpMethod(
            clientFactory(credential.apiKey),
            request.resource,
            request.method,
            request.arguments,
          )) ?? { success: true },
        }),
      );
    },
  };
}

export function getMailchimpProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertMailchimpOperationCoverage();
  return {
    operations: MAILCHIMP_OPERATION_IDS.length,
    operationIds: MAILCHIMP_OPERATION_IDS,
  };
}
