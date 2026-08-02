import { Vercel } from "@vercel/sdk";
import { z } from "zod";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationApiKeyRuntime } from "../../runtime/api-key";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import { createIntegrationTypedRestProvider } from "../../core/provider-rest";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  optionalInputBoolean,
  optionalInputCsv,
  optionalInputJson,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
} from "../shared/sdk";

interface VercelSdkResource {
  [method: string]: unknown;
}

interface VercelSdkClient {
  [resource: string]: VercelSdkResource;
}

type VercelClientFactory = (apiKey: string) => VercelSdkClient;

export interface VercelProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: VercelClientFactory;
}

function createVercelClient(apiKey: string): VercelSdkClient {
  return new Vercel({ bearerToken: apiKey }) as unknown as VercelSdkClient;
}

const VERCEL_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "vercel",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

// @vercel/sdk v1.28.14 does not expose this endpoint, so it is the SDK-first
// exception for this provider and runs on the typed REST lane.
const VERCEL_REST_OPERATION_ID = "vercel:update-edge-config-items";

const VERCEL_SDK_REVIEW =
  "@vercel/sdk@1.28.14 models Edge Config stores and reads but has no method for the PATCH items endpoint.";

const VERCEL_SDK_OPERATION_IDS = Object.freeze(
  VERCEL_OPERATION_IDS.filter(
    (operationId) => operationId !== VERCEL_REST_OPERATION_ID,
  ),
);

function vercelScope(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return definedFields({
    teamId: optionalInputString(input, "teamId"),
    slug: optionalInputString(input, "teamSlug", "slug"),
  });
}

function vercelProjectSettings(
  input: Readonly<Record<string, unknown>>,
  name?: string,
): Record<string, unknown> {
  return definedFields({
    name,
    framework: optionalInputString(input, "framework"),
    buildCommand: optionalInputString(input, "buildCommand"),
    outputDirectory: optionalInputString(input, "outputDirectory"),
    installCommand: optionalInputString(input, "installCommand"),
    rootDirectory: optionalInputString(input, "rootDirectory"),
    nodeVersion: optionalInputString(input, "nodeVersion"),
    devCommand: optionalInputString(input, "devCommand"),
  });
}

function vercelDnsRecordBody(
  input: Readonly<Record<string, unknown>>,
  mode: "create" | "update",
): Record<string, unknown> {
  const update = mode === "update";
  const type = optionalInputString(
    input,
    update ? "updateRecordType" : "recordType",
  )?.toUpperCase();
  const body: Record<string, unknown> = definedFields({
    name: optionalInputString(
      input,
      update ? "updateRecordName" : "recordName",
    ),
    type,
    ttl: optionalInputNumber(input, update ? "updateRecordTtl" : "recordTtl"),
    comment: optionalInputString(
      input,
      update ? "updateRecordComment" : "recordComment",
    ),
  });
  if (type === "SRV") {
    body.srv = definedFields({
      target: optionalInputString(
        input,
        update ? "updateSrvTarget" : "srvTarget",
      ),
      weight: optionalInputNumber(
        input,
        update ? "updateSrvWeight" : "srvWeight",
      ),
      port: optionalInputNumber(input, update ? "updateSrvPort" : "srvPort"),
      priority: optionalInputNumber(
        input,
        update ? "updateSrvPriority" : "srvPriority",
      ),
    });
  } else if (type === "HTTPS") {
    body.https = definedFields({
      target: optionalInputString(
        input,
        update ? "updateHttpsTarget" : "httpsTarget",
      ),
      priority: optionalInputNumber(
        input,
        update ? "updateHttpsPriority" : "httpsPriority",
      ),
      params: optionalInputString(
        input,
        update ? "updateHttpsParams" : "httpsParams",
      ),
    });
  } else {
    const value = optionalInputString(
      input,
      update ? "updateRecordValue" : "recordValue",
    );
    if (value) body.value = value;
    const mxPriority = optionalInputNumber(
      input,
      update ? "updateRecordMxPriority" : "recordMxPriority",
    );
    if (mxPriority !== undefined) body.mxPriority = mxPriority;
  }
  if (mode === "create" && !body.name) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return body;
}

interface VercelSdkRequest {
  resource: string;
  method: string;
  arguments: readonly unknown[];
}

function vercelRequest(
  resource: string,
  method: string,
  request: Record<string, unknown>,
): VercelSdkRequest {
  return { resource, method, arguments: [request] };
}

function invokeVercelMethod(
  client: VercelSdkClient,
  request: VercelSdkRequest,
): Promise<unknown> {
  const resource = client[request.resource];
  const method = resource?.[request.method];
  if (typeof method !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return method.apply(resource, request.arguments) as Promise<unknown>;
}

function vercelDeploymentRequest(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return definedFields({
    ...vercelScope(input),
    idOrUrl: requiredInputString(input, "deploymentId", "idOrUrl"),
  });
}

function vercelProjectRequest(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return definedFields({
    ...vercelScope(input),
    idOrName: requiredInputString(input, "projectId", "idOrName"),
  });
}

function vercelDomainRequest(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return definedFields({
    ...vercelScope(input),
    domain: requiredInputString(input, "domainName", "domain"),
  });
}

function vercelCheckRequest(
  input: Readonly<Record<string, unknown>>,
  includeCheckId = false,
): Record<string, unknown> {
  return definedFields({
    ...vercelScope(input),
    deploymentId: requiredInputString(
      input,
      "checkDeploymentId",
      "deploymentId",
    ),
    ...(includeCheckId
      ? { checkId: requiredInputString(input, "checkId") }
      : {}),
  });
}

const VERCEL_OPERATION_REQUESTS: Readonly<
  Record<string, (input: Readonly<Record<string, unknown>>) => VercelSdkRequest>
> = {
  "vercel:list-deployments": (input) =>
    vercelRequest(
      "deployments",
      "getDeployments",
      definedFields({
        ...vercelScope(input),
        projectId: optionalInputString(
          input,
          "deploymentsProjectId",
          "projectId",
        ),
        app: optionalInputString(input, "deploymentsApp", "app"),
        target: optionalInputString(input, "target"),
        state: optionalInputString(input, "state"),
        since: optionalInputNumber(input, "deploymentsSince", "since"),
        until: optionalInputNumber(input, "deploymentsUntil", "until"),
        limit: optionalInputNumber(input, "deploymentsLimit", "limit"),
      }),
    ),
  "vercel:get-deployment": (input) =>
    vercelRequest(
      "deployments",
      "getDeployment",
      definedFields({
        ...vercelDeploymentRequest(input),
        withGitRepoInfo: optionalInputString(input, "withGitRepoInfo"),
      }),
    ),
  "vercel:create-deployment": (input) =>
    vercelRequest(
      "deployments",
      "createDeployment",
      definedFields({
        ...vercelScope(input),
        forceNew: optionalInputString(input, "deploymentForceNew", "forceNew"),
        requestBody: definedFields({
          name: requiredInputString(input, "name", "projectName"),
          project: optionalInputString(input, "project"),
          deploymentId: optionalInputString(
            input,
            "redeployId",
            "deploymentId",
          ),
          target: optionalInputString(input, "deployTarget", "target"),
          gitSource: optionalInputJson(
            input,
            "deploymentGitSource",
            "gitSource",
          ),
        }),
      }),
    ),
  "vercel:cancel-deployment": (input) =>
    vercelRequest(
      "deployments",
      "cancelDeployment",
      definedFields({
        ...vercelScope(input),
        id: requiredInputString(input, "deploymentId", "id"),
      }),
    ),
  "vercel:delete-deployment": (input) =>
    vercelRequest(
      "deployments",
      "deleteDeployment",
      definedFields({
        ...vercelScope(input),
        id: requiredInputString(input, "deploymentId", "id"),
      }),
    ),
  "vercel:get-deployment-logs": (input) =>
    vercelRequest(
      "deployments",
      "getDeploymentEvents",
      definedFields({
        ...vercelScope(input),
        idOrUrl: requiredInputString(input, "deploymentId", "idOrUrl"),
        direction: optionalInputString(input, "eventsDirection", "direction"),
        follow: optionalInputNumber(input, "eventsFollow", "follow"),
        limit: optionalInputNumber(input, "eventsLimit", "limit"),
        since: optionalInputNumber(input, "eventsSince", "since"),
        until: optionalInputNumber(input, "eventsUntil", "until"),
      }),
    ),
  "vercel:list-deployment-files": (input) =>
    vercelRequest(
      "deployments",
      "listDeploymentFiles",
      definedFields({
        ...vercelScope(input),
        id: requiredInputString(input, "deploymentId", "id"),
      }),
    ),
  "vercel:promote-deployment": (input) =>
    vercelRequest(
      "projects",
      "requestPromote",
      definedFields({
        ...vercelScope(input),
        projectId: requiredInputString(input, "projectId"),
        deploymentId: requiredInputString(input, "deploymentId"),
      }),
    ),
  "vercel:list-projects": (input) =>
    vercelRequest(
      "projects",
      "getProjects",
      definedFields({
        ...vercelScope(input),
        search: optionalInputString(input, "search"),
        from: optionalInputString(input, "projectsFrom", "from"),
      }),
    ),
  "vercel:get-project": (input) =>
    vercelRequest("projects", "getProject", vercelProjectRequest(input)),
  "vercel:create-project": (input) =>
    vercelRequest(
      "projects",
      "createProject",
      definedFields({
        ...vercelScope(input),
        requestBody: vercelProjectSettings(
          input,
          requiredInputString(input, "projectName", "name"),
        ),
      }),
    ),
  "vercel:update-project": (input) =>
    vercelRequest(
      "projects",
      "updateProject",
      definedFields({
        ...vercelProjectRequest(input),
        requestBody: vercelProjectSettings(
          input,
          optionalInputString(input, "updateProjectName", "name"),
        ),
      }),
    ),
  "vercel:delete-project": (input) =>
    vercelRequest("projects", "deleteProject", vercelProjectRequest(input)),
  "vercel:pause-project": (input) =>
    vercelRequest(
      "projects",
      "pauseProject",
      definedFields({
        ...vercelScope(input),
        projectId: requiredInputString(input, "projectId"),
      }),
    ),
  "vercel:unpause-project": (input) =>
    vercelRequest(
      "projects",
      "unpauseProject",
      definedFields({
        ...vercelScope(input),
        projectId: requiredInputString(input, "projectId"),
      }),
    ),
  "vercel:list-project-domains": (input) =>
    vercelRequest(
      "projects",
      "getProjectDomains",
      definedFields({
        ...vercelProjectRequest(input),
        limit: optionalInputNumber(input, "projectDomainsLimit", "limit"),
      }),
    ),
  "vercel:add-project-domain": (input) =>
    vercelRequest(
      "projects",
      "addProjectDomain",
      definedFields({
        ...vercelProjectRequest(input),
        requestBody: definedFields({
          name: requiredInputString(input, "domainName", "domain"),
          redirect: optionalInputString(
            input,
            "updateDomainRedirect",
            "redirect",
          ),
          redirectStatusCode: optionalInputNumber(
            input,
            "updateDomainRedirectStatusCode",
            "redirectStatusCode",
          ),
          gitBranch: optionalInputString(
            input,
            "updateDomainGitBranch",
            "gitBranch",
          ),
        }),
      }),
    ),
  "vercel:update-project-domain": (input) =>
    vercelRequest(
      "projects",
      "updateProjectDomain",
      definedFields({
        ...vercelProjectRequest(input),
        domain: requiredInputString(input, "domainName", "domain"),
        requestBody: definedFields({
          redirect: optionalInputString(
            input,
            "updateDomainRedirect",
            "redirect",
          ),
          redirectStatusCode: optionalInputNumber(
            input,
            "updateDomainRedirectStatusCode",
            "redirectStatusCode",
          ),
          gitBranch: optionalInputString(
            input,
            "updateDomainGitBranch",
            "gitBranch",
          ),
        }),
      }),
    ),
  "vercel:verify-project-domain": (input) =>
    vercelRequest(
      "projects",
      "verifyProjectDomain",
      definedFields({
        ...vercelProjectRequest(input),
        domain: requiredInputString(input, "domainName", "domain"),
      }),
    ),
  "vercel:remove-project-domain": (input) =>
    vercelRequest(
      "projects",
      "removeProjectDomain",
      definedFields({
        ...vercelProjectRequest(input),
        domain: requiredInputString(input, "domainName", "domain"),
      }),
    ),
  "vercel:get-environment-variables": (input) =>
    vercelRequest(
      "projects",
      "filterProjectEnvs",
      definedFields({
        ...vercelProjectRequest(input),
        decrypt: optionalInputBoolean(input, "envVarsDecrypt", "decrypt")
          ? "true"
          : undefined,
        gitBranch: optionalInputString(input, "envVarsGitBranch", "gitBranch"),
      }),
    ),
  "vercel:create-environment-variable": (input) =>
    vercelRequest(
      "projects",
      "createProjectEnv",
      definedFields({
        ...vercelProjectRequest(input),
        requestBody: definedFields({
          key: requiredInputString(input, "envKey", "key"),
          value: requiredInputString(input, "envValue", "value"),
          target: optionalInputCsv(input, "envTarget", "target"),
          type: optionalInputString(input, "envType", "type") ?? "plain",
          gitBranch: optionalInputString(input, "envGitBranch", "gitBranch"),
          comment: optionalInputString(input, "envComment", "comment"),
        }),
      }),
    ),
  "vercel:update-environment-variable": (input) =>
    vercelRequest(
      "projects",
      "editProjectEnv",
      definedFields({
        ...vercelProjectRequest(input),
        id: requiredInputString(input, "envId", "id"),
        requestBody: definedFields({
          key: optionalInputString(input, "envKey", "key"),
          value: optionalInputString(input, "envValue", "value"),
          target: optionalInputCsv(input, "envTarget", "target"),
          type: optionalInputString(input, "envType", "type"),
          gitBranch: optionalInputString(input, "envGitBranch", "gitBranch"),
          comment: optionalInputString(input, "envComment", "comment"),
        }),
      }),
    ),
  "vercel:delete-environment-variable": (input) =>
    vercelRequest(
      "projects",
      "removeProjectEnv",
      definedFields({
        ...vercelProjectRequest(input),
        id: requiredInputString(input, "envId", "id"),
      }),
    ),
  "vercel:list-domains": (input) =>
    vercelRequest(
      "domains",
      "getDomains",
      definedFields({
        ...vercelScope(input),
        limit: optionalInputNumber(input, "limit"),
        since: optionalInputNumber(input, "since"),
        until: optionalInputNumber(input, "until"),
      }),
    ),
  "vercel:get-domain": (input) =>
    vercelRequest("domains", "getDomain", vercelDomainRequest(input)),
  "vercel:add-domain": (input) =>
    vercelRequest(
      "domains",
      "createOrTransferDomain",
      definedFields({
        ...vercelScope(input),
        requestBody: {
          name: requiredInputString(input, "domainName", "domain"),
        },
      }),
    ),
  "vercel:delete-domain": (input) =>
    vercelRequest("domains", "deleteDomain", vercelDomainRequest(input)),
  "vercel:get-domain-config": (input) =>
    vercelRequest("domains", "getDomainConfig", vercelDomainRequest(input)),
  "vercel:list-dns-records": (input) =>
    vercelRequest(
      "dns",
      "getRecords",
      definedFields({
        ...vercelDomainRequest(input),
        limit: optionalInputString(input, "dnsRecordsLimit", "limit"),
      }),
    ),
  "vercel:create-dns-record": (input) =>
    vercelRequest(
      "dns",
      "createRecord",
      definedFields({
        ...vercelDomainRequest(input),
        requestBody: vercelDnsRecordBody(input, "create"),
      }),
    ),
  "vercel:update-dns-record": (input) =>
    vercelRequest(
      "dns",
      "updateRecord",
      definedFields({
        ...vercelScope(input),
        recordId: requiredInputString(input, "recordId"),
        requestBody: vercelDnsRecordBody(input, "update"),
      }),
    ),
  "vercel:delete-dns-record": (input) =>
    vercelRequest(
      "dns",
      "removeRecord",
      definedFields({
        ...vercelScope(input),
        recordId: requiredInputString(input, "recordId"),
      }),
    ),
  "vercel:list-aliases": (input) =>
    vercelRequest(
      "aliases",
      "listAliases",
      definedFields({
        ...vercelScope(input),
        projectId: optionalInputString(input, "projectId"),
      }),
    ),
  "vercel:get-alias": (input) =>
    vercelRequest(
      "aliases",
      "getAlias",
      definedFields({
        ...vercelScope(input),
        idOrAlias: requiredInputString(input, "aliasId", "idOrAlias"),
      }),
    ),
  "vercel:create-alias": (input) =>
    vercelRequest(
      "aliases",
      "assignAlias",
      definedFields({
        ...vercelScope(input),
        id: requiredInputString(
          input,
          "aliasDeploymentId",
          "deploymentId",
          "id",
        ),
        requestBody: definedFields({
          alias: requiredInputString(input, "aliasName", "alias"),
          redirect: optionalInputString(input, "aliasRedirect", "redirect"),
        }),
      }),
    ),
  "vercel:delete-alias": (input) =>
    vercelRequest(
      "aliases",
      "deleteAlias",
      definedFields({
        ...vercelScope(input),
        aliasId: requiredInputString(input, "aliasId"),
      }),
    ),
  "vercel:list-edge-configs": (input) =>
    vercelRequest("globalConfig", "getEdgeConfigs", vercelScope(input)),
  "vercel:get-edge-config": (input) =>
    vercelRequest(
      "globalConfig",
      "getEdgeConfig",
      definedFields({
        ...vercelScope(input),
        edgeConfigId: requiredInputString(input, "edgeConfigId"),
      }),
    ),
  "vercel:create-edge-config": (input) =>
    vercelRequest(
      "globalConfig",
      "createEdgeConfig",
      definedFields({
        ...vercelScope(input),
        requestBody: {
          slug: requiredInputString(input, "edgeConfigSlug", "slug"),
        },
      }),
    ),
  "vercel:get-edge-config-items": (input) =>
    vercelRequest(
      "globalConfig",
      "getEdgeConfigItems",
      definedFields({
        ...vercelScope(input),
        edgeConfigId: requiredInputString(input, "edgeConfigId"),
      }),
    ),
  "vercel:delete-edge-config": (input) =>
    vercelRequest(
      "globalConfig",
      "deleteEdgeConfig",
      definedFields({
        ...vercelScope(input),
        edgeConfigId: requiredInputString(input, "edgeConfigId"),
      }),
    ),
  "vercel:list-webhooks": (input) =>
    vercelRequest(
      "webhooks",
      "getWebhooks",
      definedFields({
        ...vercelScope(input),
        projectId: optionalInputString(input, "projectId"),
      }),
    ),
  "vercel:get-webhook": (input) =>
    vercelRequest(
      "webhooks",
      "getWebhook",
      definedFields({
        ...vercelScope(input),
        id: requiredInputString(input, "webhookId", "id"),
      }),
    ),
  "vercel:create-webhook": (input) =>
    vercelRequest(
      "webhooks",
      "createWebhook",
      definedFields({
        ...vercelScope(input),
        requestBody: definedFields({
          url: requiredInputString(input, "webhookUrl", "url"),
          events: optionalInputCsv(input, "webhookEvents", "events") ?? [],
          projectIds: optionalInputCsv(
            input,
            "webhookProjectIds",
            "projectIds",
          ),
        }),
      }),
    ),
  "vercel:delete-webhook": (input) =>
    vercelRequest(
      "webhooks",
      "deleteWebhook",
      definedFields({
        ...vercelScope(input),
        id: requiredInputString(input, "webhookId", "id"),
      }),
    ),
  "vercel:list-checks": (input) =>
    vercelRequest("checks", "getAllChecks", vercelCheckRequest(input)),
  "vercel:get-check": (input) =>
    vercelRequest("checks", "getCheck", vercelCheckRequest(input, true)),
  "vercel:create-check": (input) =>
    vercelRequest(
      "checks",
      "createCheck",
      definedFields({
        ...vercelCheckRequest(input),
        requestBody: definedFields({
          name: requiredInputString(input, "checkName", "name"),
          blocking:
            optionalInputBoolean(input, "checkBlocking", "blocking") ?? false,
          path: optionalInputString(input, "checkPath", "path"),
          detailsUrl: optionalInputString(
            input,
            "checkDetailsUrl",
            "detailsUrl",
          ),
          externalId: optionalInputString(
            input,
            "checkExternalId",
            "externalId",
          ),
          rerequestable: optionalInputBoolean(
            input,
            "checkRerequestable",
            "rerequestable",
          ),
        }),
      }),
    ),
  "vercel:update-check": (input) =>
    vercelRequest(
      "checks",
      "updateCheck",
      definedFields({
        ...vercelCheckRequest(input, true),
        requestBody: definedFields({
          name: optionalInputString(input, "checkName", "name"),
          status: optionalInputString(input, "checkStatus", "status"),
          conclusion: optionalInputString(
            input,
            "checkConclusion",
            "conclusion",
          ),
          path: optionalInputString(input, "checkPath", "path"),
          detailsUrl: optionalInputString(
            input,
            "checkDetailsUrl",
            "detailsUrl",
          ),
          externalId: optionalInputString(
            input,
            "checkExternalId",
            "externalId",
          ),
          output: optionalInputJson(input, "checkOutput", "output"),
        }),
      }),
    ),
  "vercel:rerequest-check": (input) =>
    vercelRequest(
      "checks",
      "rerequestCheck",
      definedFields({
        ...vercelCheckRequest(input, true),
        autoUpdate: optionalInputBoolean(
          input,
          "checkAutoUpdate",
          "autoUpdate",
        ),
      }),
    ),
  "vercel:list-teams": (input) =>
    vercelRequest(
      "teams",
      "getTeams",
      definedFields({
        limit: optionalInputNumber(input, "teamsLimit", "limit"),
        since: optionalInputNumber(input, "teamsSince", "since"),
        until: optionalInputNumber(input, "teamsUntil", "until"),
      }),
    ),
  "vercel:get-team": (input) =>
    vercelRequest(
      "teams",
      "getTeam",
      definedFields({
        teamId: requiredInputString(input, "teamIdParam", "teamId"),
        slug: optionalInputString(input, "teamSlug", "slug"),
      }),
    ),
  "vercel:list-team-members": (input) =>
    vercelRequest(
      "teams",
      "getTeamMembers",
      definedFields({
        teamId: requiredInputString(input, "teamIdParam", "teamId"),
        slug: optionalInputString(input, "teamSlug", "slug"),
        role: optionalInputString(input, "memberRole", "role"),
        limit: optionalInputNumber(input, "teamMembersLimit", "limit"),
        since: optionalInputNumber(input, "teamMembersSince", "since"),
        until: optionalInputNumber(input, "teamMembersUntil", "until"),
        search: optionalInputString(input, "teamMembersSearch", "search"),
      }),
    ),
  "vercel:get-user": () => vercelRequest("user", "getAuthUser", {}),
};

function assertVercelOperationCoverage(): void {
  const expected = new Set(VERCEL_SDK_OPERATION_IDS);
  const implemented = Object.keys(VERCEL_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Vercel provider SDK operation coverage is incomplete.");
  }
}

/**
 * Executes Vercel actions exposed by Vercel's official generated TypeScript
 * SDK. Source actions missing from that SDK remain catalogue-only rather than
 * silently falling back to raw REST.
 */
export function createVercelProviderSdk(
  config: VercelProviderSdkConfig,
): IntegrationProviderSdk {
  assertVercelOperationCoverage();
  const clientFactory = config.clientFactory ?? createVercelClient;
  return {
    integrationId: "vercel",
    operationIds: VERCEL_SDK_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "vercel" ||
        invocation.reference.integrationId !== "vercel"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = VERCEL_OPERATION_REQUESTS[invocation.operationId];
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
          output: (await invokeVercelMethod(
            clientFactory(credential.apiKey),
            request,
          )) ?? { success: true },
        }),
      );
    },
  };
}

export function getVercelProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertVercelOperationCoverage();
  return {
    operations: VERCEL_SDK_OPERATION_IDS.length,
    operationIds: VERCEL_SDK_OPERATION_IDS,
  };
}

export interface VercelEdgeConfigItemsProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "request">;
}

/** Mirrors the SDK adapter's team scoping as query parameters. */
function vercelScopeQuery(input: { teamId?: string; slug?: string }): string {
  const query = new URLSearchParams();
  if (input.teamId) query.set("teamId", input.teamId);
  if (input.slug) query.set("slug", input.slug);
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * Writes Edge Config items, which @vercel/sdk does not model. Vercel's
 * API-key profile resolves this relative path against
 * `https://api.vercel.com`.
 */
export function createVercelEdgeConfigItemsProviderSdk(
  config: VercelEdgeConfigItemsProviderSdkConfig,
): IntegrationProviderSdk {
  return createIntegrationTypedRestProvider({
    integrationId: "vercel",
    transport: { kind: "api_key", runtime: config.apiKeyRuntime },
    tools: [
      {
        id: VERCEL_REST_OPERATION_ID,
        name: "Update Edge Config Items",
        description:
          "Create, update, upsert, or delete items in an Edge Config store",
        version: "1.0.0",
        params: {
          edgeConfigId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          items: { type: "array", required: true, visibility: "user-or-llm" },
          teamId: { type: "string", visibility: "user-only" },
          slug: { type: "string", visibility: "user-only" },
        },
        request: {
          method: "PATCH",
          url: (input) =>
            `/v1/edge-config/${encodeURIComponent(input.edgeConfigId)}/items${vercelScopeQuery(input)}`,
          headers: () => ({ accept: "application/json" }),
          body: (input) => ({ items: input.items }),
        },
        inputSchema: z
          .object({
            edgeConfigId: z.string().min(1),
            // Vercel accepts at most 100 operations per request.
            items: z
              .array(
                z.union([
                  z
                    .object({
                      operation: z.enum(["create", "update", "upsert"]),
                      key: z.string().min(1),
                      value: z.unknown(),
                      description: z.string().optional(),
                    })
                    .strict(),
                  z
                    .object({
                      operation: z.literal("delete"),
                      key: z.string().min(1),
                    })
                    .strict(),
                ]),
              )
              .min(1)
              .max(100),
            teamId: z.string().min(1).optional(),
            slug: z.string().min(1).optional(),
          })
          .strict(),
        outputSchema: z.object({ status: z.string() }).loose(),
      },
    ],
  });
}

/**
 * Vercel's complete delivery unit: the official SDK for every action it
 * models, plus the typed REST lane for the Edge Config items write.
 */
export function createVercelPack(): IntegrationProviderPack {
  return {
    integrationId: "vercel",
    coverage: VERCEL_OPERATION_IDS.map((sourceOperationId) =>
      sourceOperationId === VERCEL_REST_OPERATION_ID
        ? {
            sourceOperationId,
            lane: "typed_rest" as const,
            disposition: "supported" as const,
            sdkReview: VERCEL_SDK_REVIEW,
          }
        : {
            sourceOperationId,
            lane: "sdk" as const,
            disposition: "supported" as const,
          },
    ),
    triggerCoverage: (
      SIMSTUDIO_BASELINE.integrations.find(
        (integration) => integration.id === "vercel",
      )?.triggers ?? []
    ).map((trigger) => ({
      sourceTriggerId: trigger.id,
      disposition: "deferred" as const,
      reason:
        "Vercel webhooks are registered per team with a shared signing secret; scheduled with the trigger family work.",
    })),
    create(context) {
      if (!context.apiKeyRuntime) return [];
      return [
        createVercelProviderSdk({ apiKeyRuntime: context.apiKeyRuntime }),
        createVercelEdgeConfigItemsProviderSdk({
          apiKeyRuntime: context.apiKeyRuntime,
        }),
      ];
    },
  };
}
