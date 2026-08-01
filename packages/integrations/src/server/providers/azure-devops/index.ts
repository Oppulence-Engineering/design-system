import { createRequire } from "node:module";

import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
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
} from "../shared/sdk";
import {
  createVendorPack,
  requiredVendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";

const deskRequire = createRequire(import.meta.url);

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
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
