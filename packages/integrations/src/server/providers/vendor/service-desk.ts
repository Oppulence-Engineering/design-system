import { createRequire } from "node:module";

import { IntegrationProviderSdkError } from "../../provider-sdk";
import type { IntegrationProviderPack } from "../../provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  requiredInputNumber,
  requiredInputRecord,
  requiredInputString,
  requiredInputStringArray,
  type SdkMethodTarget,
} from "../shared";
import {
  createVendorPack,
  requiredVendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "./client";

const deskRequire = createRequire(import.meta.url);

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

// ------------------------------------------------------------------ Zendesk

/** Zendesk object IDs are numeric. */
function zendeskId(input: VendorInput, ...names: string[]): number {
  const value = requiredInputNumber(input, names[0]);
  if (!Number.isSafeInteger(value) || value < 1) throw invocationError();
  return value;
}

function zendeskIds(input: VendorInput, ...names: string[]): number[] {
  const values = requiredInputStringArray(input, ...names).map(Number);
  if (values.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw invocationError();
  }
  if (values.length === 0 || values.length > 100) throw invocationError();
  return values;
}

const ZENDESK_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "zendesk:get-tickets": { path: ["tickets", "list"] },
  "zendesk:get-ticket": {
    path: ["tickets", "show"],
    params: (i) => [zendeskId(i, "ticketId")],
  },
  "zendesk:create-ticket": {
    path: ["tickets", "create"],
    params: (i) => [{ ticket: requiredInputRecord(i, "ticket", "fields") }],
  },
  "zendesk:create-tickets-bulk": {
    path: ["tickets", "createMany"],
    params: (i) => [{ tickets: i.tickets ?? [] }],
  },
  "zendesk:update-ticket": {
    path: ["tickets", "update"],
    params: (i) => [
      zendeskId(i, "ticketId"),
      { ticket: requiredInputRecord(i, "ticket", "fields") },
    ],
  },
  "zendesk:update-tickets-bulk": {
    path: ["tickets", "updateMany"],
    params: (i) => [zendeskIds(i, "ticketIds"), { tickets: i.tickets ?? [] }],
  },
  "zendesk:delete-ticket": {
    path: ["tickets", "delete"],
    params: (i) => [zendeskId(i, "ticketId")],
    output: (_v, i) => ({ ticketId: zendeskId(i, "ticketId"), deleted: true }),
  },
  "zendesk:merge-tickets": {
    path: ["tickets", "merge"],
    params: (i) => [
      zendeskId(i, "ticketId"),
      definedFields({
        ids: zendeskIds(i, "sourceTicketIds", "ids"),
        target_comment: optionalInputString(i, "targetComment"),
        source_comment: optionalInputString(i, "sourceComment"),
      }),
    ],
  },
  "zendesk:get-users": { path: ["users", "list"] },
  "zendesk:get-user": {
    path: ["users", "show"],
    params: (i) => [zendeskId(i, "userId")],
  },
  "zendesk:get-current-user": { path: ["users", "me"] },
  "zendesk:search-users": {
    path: ["users", "search"],
    params: (i) => [{ query: requiredInputString(i, "query", "search") }],
  },
  "zendesk:create-user": {
    path: ["users", "create"],
    params: (i) => [{ user: requiredInputRecord(i, "user", "fields") }],
  },
  "zendesk:create-users-bulk": {
    path: ["users", "createMany"],
    params: (i) => [{ users: i.users ?? [] }],
  },
  "zendesk:update-user": {
    path: ["users", "update"],
    params: (i) => [
      zendeskId(i, "userId"),
      { user: requiredInputRecord(i, "user", "fields") },
    ],
  },
  "zendesk:update-users-bulk": {
    path: ["users", "updateMany"],
    params: (i) => [zendeskIds(i, "userIds"), { users: i.users ?? [] }],
  },
  "zendesk:delete-user": {
    path: ["users", "delete"],
    params: (i) => [zendeskId(i, "userId")],
    output: (_v, i) => ({ userId: zendeskId(i, "userId"), deleted: true }),
  },
  "zendesk:get-organizations": { path: ["organizations", "list"] },
  "zendesk:get-organization": {
    path: ["organizations", "show"],
    params: (i) => [zendeskId(i, "organizationId")],
  },
  "zendesk:autocomplete-organizations": {
    path: ["organizations", "autocomplete"],
    params: (i) => [{ name: requiredInputString(i, "name", "query") }],
  },
  "zendesk:create-organization": {
    path: ["organizations", "create"],
    params: (i) => [
      { organization: requiredInputRecord(i, "organization", "fields") },
    ],
  },
  "zendesk:create-organizations-bulk": {
    path: ["organizations", "createMany"],
    params: (i) => [{ organizations: i.organizations ?? [] }],
  },
  "zendesk:update-organization": {
    path: ["organizations", "update"],
    params: (i) => [
      zendeskId(i, "organizationId"),
      { organization: requiredInputRecord(i, "organization", "fields") },
    ],
  },
  "zendesk:delete-organization": {
    path: ["organizations", "delete"],
    params: (i) => [zendeskId(i, "organizationId")],
    output: (_v, i) => ({
      organizationId: zendeskId(i, "organizationId"),
      deleted: true,
    }),
  },
  "zendesk:search": {
    path: ["search", "query"],
    params: (i) => [requiredInputString(i, "query", "search")],
  },
  "zendesk:search-count": {
    path: ["search", "showResultsCount"],
    params: (i) => [requiredInputString(i, "query", "search")],
  },
};

/**
 * Zendesk is per-subdomain, so the account host comes from the connection.
 * node-zendesk authenticates with an email plus an API token.
 */
export const createZendeskClient: VendorClientFactory = (credential) => {
  const { createClient } = deskRequire("node-zendesk") as {
    createClient(config: Record<string, unknown>): SdkMethodTarget;
  };
  return createClient({
    subdomain: requiredVendorField(credential, "subdomain"),
    username: requiredVendorField(credential, "email"),
    token: vendorToken(credential),
  });
};

export function createZendeskPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "zendesk",
    driver: "node-zendesk@6.0.1",
    transportKind: "api_key",
    operations: ZENDESK_OPERATIONS,
    clientFactory: options.clientFactory ?? createZendeskClient,
  });
}

// ----------------------------------------------------------------- DocuSign

interface DocuSignClient extends SdkMethodTarget {
  envelopesApi: {
    createEnvelope(accountId: string, options: unknown): Promise<unknown>;
    getEnvelope(accountId: string, envelopeId: string): Promise<unknown>;
    listStatusChanges(accountId: string, options: unknown): Promise<unknown>;
    update(
      accountId: string,
      envelopeId: string,
      options: unknown,
    ): Promise<unknown>;
    getDocument(
      accountId: string,
      envelopeId: string,
      documentId: string,
    ): Promise<unknown>;
    listRecipients(accountId: string, envelopeId: string): Promise<unknown>;
  };
  templatesApi: {
    listTemplates(accountId: string, options?: unknown): Promise<unknown>;
  };
  accountId: string;
}

/** A DocuSign envelope ID is a GUID. */
function envelopeId(input: VendorInput): string {
  const value = requiredInputString(input, "envelopeId", "id");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw invocationError();
  }
  return value;
}

const DOCUSIGN_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "docusign:send-envelope": {
    path: ["envelopesApi", "createEnvelope"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.envelopesApi.createEnvelope(docusign.accountId, {
        envelopeDefinition: definedFields({
          emailSubject: requiredInputString(input, "emailSubject", "subject"),
          emailBlurb: optionalInputString(input, "emailBody", "message"),
          documents: input.documents,
          recipients: optionalInputRecord(input, "recipients"),
          // "sent" dispatches immediately; "created" leaves it a draft.
          status: optionalInputString(input, "status") ?? "sent",
        }),
      });
    },
  },
  "docusign:send-from-template": {
    path: ["envelopesApi", "createEnvelope"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.envelopesApi.createEnvelope(docusign.accountId, {
        envelopeDefinition: definedFields({
          templateId: requiredInputString(input, "templateId"),
          emailSubject: optionalInputString(input, "emailSubject", "subject"),
          templateRoles: input.templateRoles ?? input.roles,
          status: optionalInputString(input, "status") ?? "sent",
        }),
      });
    },
  },
  "docusign:get-envelope": {
    path: ["envelopesApi", "getEnvelope"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.envelopesApi.getEnvelope(
        docusign.accountId,
        envelopeId(input),
      );
    },
  },
  "docusign:list-envelopes": {
    path: ["envelopesApi", "listStatusChanges"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.envelopesApi.listStatusChanges(
        docusign.accountId,
        definedFields({
          // DocuSign requires a lower bound on the search window.
          fromDate:
            optionalInputString(input, "fromDate") ??
            new Date(Date.now() - 30 * 86_400_000).toISOString(),
          status: optionalInputString(input, "status"),
          count: optionalInputNumber(input, "limit", "count"),
        }),
      );
    },
  },
  "docusign:void-envelope": {
    path: ["envelopesApi", "update"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.envelopesApi.update(
        docusign.accountId,
        envelopeId(input),
        {
          envelope: {
            status: "voided",
            voidedReason: requiredInputString(input, "reason", "voidedReason"),
          },
        },
      );
    },
  },
  "docusign:download-document": {
    path: ["envelopesApi", "getDocument"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      // "combined" is DocuSign's alias for the whole envelope as one PDF.
      const documentId = optionalInputString(input, "documentId") ?? "combined";
      if (!/^[A-Za-z0-9_-]{1,64}$/u.test(documentId)) throw invocationError();
      return docusign.envelopesApi.getDocument(
        docusign.accountId,
        envelopeId(input),
        documentId,
      );
    },
  },
  "docusign:list-recipients": {
    path: ["envelopesApi", "listRecipients"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.envelopesApi.listRecipients(
        docusign.accountId,
        envelopeId(input),
      );
    },
  },
  "docusign:list-templates": {
    path: ["templatesApi", "listTemplates"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.templatesApi.listTemplates(
        docusign.accountId,
        definedFields({
          count: optionalInputNumber(input, "limit", "count"),
          searchText: optionalInputString(input, "search", "searchText"),
        }),
      );
    },
  },
};

/**
 * DocuSign issues a per-account base URI at consent time, and every call takes
 * the account ID. Both are non-secret connection state, stored beside the
 * token rather than accepted as operation input.
 */
export const createDocuSignClient: VendorClientFactory = (credential) => {
  const docusign = deskRequire("docusign-esign") as {
    ApiClient: new (config?: Record<string, unknown>) => {
      setBasePath(path: string): void;
      addDefaultHeader(name: string, value: string): void;
    };
    EnvelopesApi: new (client: unknown) => DocuSignClient["envelopesApi"];
    TemplatesApi: new (client: unknown) => DocuSignClient["templatesApi"];
  };
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(requiredVendorField(credential, "basePath"));
  apiClient.addDefaultHeader(
    "Authorization",
    `Bearer ${vendorToken(credential)}`,
  );
  return {
    envelopesApi: new docusign.EnvelopesApi(apiClient),
    templatesApi: new docusign.TemplatesApi(apiClient),
    accountId: requiredVendorField(credential, "accountId"),
  } as unknown as SdkMethodTarget;
};

export function createDocuSignPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "docusign",
    driver: "docusign-esign@10.0.0",
    transportKind: "oauth2",
    operations: DOCUSIGN_OPERATIONS,
    clientFactory: options.clientFactory ?? createDocuSignClient,
  });
}

// -------------------------------------------------------------- Azure DevOps

/**
 * azure-devops-node-api resolves each area API asynchronously, so the client
 * factory cannot build them eagerly. It exposes the connection, and each
 * operation awaits the API it needs.
 */
interface AzureDevOpsConnection extends SdkMethodTarget {
  getBuildApi(): Promise<
    Record<string, (...args: never[]) => Promise<unknown>>
  >;
  getPipelinesApi(): Promise<
    Record<string, (...args: never[]) => Promise<unknown>>
  >;
  getWorkItemTrackingApi(): Promise<
    Record<string, (...args: never[]) => Promise<unknown>>
  >;
  project: string;
}

/** An Azure DevOps project name is a path segment. */
function project(client: SdkMethodTarget, input: VendorInput): string {
  const value =
    optionalInputString(input, "project", "projectName") ??
    (client as unknown as AzureDevOpsConnection).project;
  if (!value || !/^[A-Za-z0-9 ._-]{1,64}$/u.test(value))
    throw invocationError();
  return value;
}

function azureArea(
  area: "getBuildApi" | "getPipelinesApi" | "getWorkItemTrackingApi",
  call: (
    api: Record<string, (...args: never[]) => Promise<unknown>>,
    context: { client: SdkMethodTarget; input: VendorInput },
  ) => Promise<unknown>,
): VendorOperation {
  return {
    path: [area],
    invoke: async (context) => {
      const connection = context.client as unknown as AzureDevOpsConnection;
      const api = await connection[area]();
      return call(api, context);
    },
  };
}

const AZURE_DEVOPS_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "azure-devops:list-pipelines": azureArea(
    "getPipelinesApi",
    (api, { client, input }) =>
      api.listPipelines(project(client, input) as never),
  ),
  "azure-devops:get-pipeline": azureArea(
    "getPipelinesApi",
    (api, { client, input }) =>
      api.getPipeline(
        project(client, input) as never,
        requiredInputNumber(input, "pipelineId") as never,
      ),
  ),
  "azure-devops:list-pipeline-runs": azureArea(
    "getPipelinesApi",
    (api, { client, input }) =>
      api.listRuns(
        project(client, input) as never,
        requiredInputNumber(input, "pipelineId") as never,
      ),
  ),
  "azure-devops:get-pipeline-run": azureArea(
    "getPipelinesApi",
    (api, { client, input }) =>
      api.getRun(
        project(client, input) as never,
        requiredInputNumber(input, "pipelineId") as never,
        requiredInputNumber(input, "runId") as never,
      ),
  ),
  "azure-devops:list-builds": azureArea(
    "getBuildApi",
    (api, { client, input }) =>
      api.getBuilds(
        project(client, input) as never,
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        (optionalInputNumber(input, "limit", "top") ?? 50) as never,
      ),
  ),
  "azure-devops:list-build-logs": azureArea(
    "getBuildApi",
    (api, { client, input }) =>
      api.getBuildLogs(
        project(client, input) as never,
        requiredInputNumber(input, "buildId") as never,
      ),
  ),
  "azure-devops:get-build-log": azureArea(
    "getBuildApi",
    (api, { client, input }) =>
      api.getBuildLogLines(
        project(client, input) as never,
        requiredInputNumber(input, "buildId") as never,
        requiredInputNumber(input, "logId") as never,
      ),
  ),
  "azure-devops:get-build-timeline": azureArea(
    "getBuildApi",
    (api, { client, input }) =>
      api.getBuildTimeline(
        project(client, input) as never,
        requiredInputNumber(input, "buildId") as never,
      ),
  ),
  "azure-devops:get-work-items-between-builds": azureArea(
    "getBuildApi",
    (api, { client, input }) =>
      api.getWorkItemsBetweenBuilds(
        project(client, input) as never,
        requiredInputNumber(input, "fromBuildId") as never,
        requiredInputNumber(input, "toBuildId") as never,
      ),
  ),
  "azure-devops:query-work-items": azureArea(
    "getWorkItemTrackingApi",
    (api, { client, input }) =>
      api.queryByWiql(
        { query: requiredInputString(input, "query", "wiql") } as never,
        { project: project(client, input) } as never,
      ),
  ),
  "azure-devops:get-work-item": azureArea(
    "getWorkItemTrackingApi",
    (api, { input }) =>
      api.getWorkItem(
        requiredInputNumber(
          input,
          input.workItemId === undefined ? "id" : "workItemId",
        ) as never,
      ),
  ),
  "azure-devops:get-work-items-batch": azureArea(
    "getWorkItemTrackingApi",
    (api, { input }) =>
      api.getWorkItems(
        requiredInputStringArray(input, "workItemIds", "ids").map(
          Number,
        ) as never,
      ),
  ),
  "azure-devops:create-work-item": azureArea(
    "getWorkItemTrackingApi",
    (api, { client, input }) =>
      // Work-item writes take a JSON Patch document.
      api.createWorkItem(
        null as never,
        Object.entries(requiredInputRecord(input, "fields")).map(
          ([field, value]) => ({
            op: "add",
            path: `/fields/${field}`,
            value,
          }),
        ) as never,
        project(client, input) as never,
        requiredInputString(input, "workItemType", "type") as never,
      ),
  ),
  "azure-devops:update-work-item": azureArea(
    "getWorkItemTrackingApi",
    (api, { input }) =>
      api.updateWorkItem(
        null as never,
        Object.entries(requiredInputRecord(input, "fields")).map(
          ([field, value]) => ({
            op: "add",
            path: `/fields/${field}`,
            value,
          }),
        ) as never,
        requiredInputNumber(
          input,
          input.workItemId === undefined ? "id" : "workItemId",
        ) as never,
      ),
  ),
  "azure-devops:add-comment": azureArea(
    "getWorkItemTrackingApi",
    (api, { client, input }) =>
      api.addComment(
        { text: requiredInputString(input, "text", "comment") } as never,
        project(client, input) as never,
        requiredInputNumber(
          input,
          input.workItemId === undefined ? "id" : "workItemId",
        ) as never,
      ),
  ),
  "azure-devops:get-comments": azureArea(
    "getWorkItemTrackingApi",
    (api, { client, input }) =>
      api.getComments(
        project(client, input) as never,
        requiredInputNumber(
          input,
          input.workItemId === undefined ? "id" : "workItemId",
        ) as never,
      ),
  ),
};

/** Azure DevOps is per-organization, so the org URL comes from the connection. */
export const createAzureDevOpsClient: VendorClientFactory = (credential) => {
  const azdev = deskRequire("azure-devops-node-api") as {
    getPersonalAccessTokenHandler(token: string): unknown;
    WebApi: new (url: string, handler: unknown) => AzureDevOpsConnection;
  };
  const connection = new azdev.WebApi(
    requiredVendorField(credential, "organizationUrl"),
    azdev.getPersonalAccessTokenHandler(vendorToken(credential)),
  );
  return Object.assign(connection, {
    project: requiredVendorField(credential, "project"),
  }) as unknown as SdkMethodTarget;
};

export function createAzureDevOpsPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "azure-devops",
    driver: "azure-devops-node-api@15.1.2",
    transportKind: "api_key",
    operations: AZURE_DEVOPS_OPERATIONS,
    clientFactory: options.clientFactory ?? createAzureDevOpsClient,
  });
}
