import { LinearClient } from "@linear/sdk";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationOAuthRuntime } from "../runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import { ProviderSdkInvocationSchema, toSnakeCase } from "./shared";

interface LinearSdkResource {
  [method: string]: unknown;
}

interface LinearSdkClient extends LinearSdkResource {
  readonly viewer: Promise<unknown>;
  readonly client: {
    rawRequest(
      query: string,
      variables?: Record<string, unknown>,
    ): Promise<unknown>;
  };
}

type LinearClientFactory = (accessToken: string) => LinearSdkClient;

export interface LinearProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: LinearClientFactory;
}

function createLinearClient(accessToken: string): LinearSdkClient {
  return new LinearClient({ accessToken }) as unknown as LinearSdkClient;
}

const LINEAR_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "linear",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

const LINEAR_CREDENTIAL_PARAMETER_NAMES = new Set([
  "access_token",
  "api_key",
  "authorization",
  "credential",
  "headers",
  "oauth_credential",
  "refresh_token",
  "secret",
  "token",
]);

function linearOperationInput(
  input: Readonly<Record<string, unknown>>,
  excluded: readonly string[] = [],
): Record<string, unknown> {
  const excludedNames = new Set(excluded);
  const result: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(input)) {
    const normalizedName = toSnakeCase(name);
    if (
      excludedNames.has(name) ||
      LINEAR_CREDENTIAL_PARAMETER_NAMES.has(normalizedName) ||
      value === undefined ||
      value === ""
    ) {
      continue;
    }
    result[name] = value;
  }
  return result;
}

function requiredLinearString(
  input: Readonly<Record<string, unknown>>,
  name: string,
): string {
  const value = input[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value.trim();
}

function optionalLinearString(
  input: Readonly<Record<string, unknown>>,
  name: string,
): string | undefined {
  const value = input[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalLinearNumber(
  input: Readonly<Record<string, unknown>>,
  name: string,
): number | undefined {
  const value = input[name];
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function linearPageVariables(
  input: Readonly<Record<string, unknown>>,
  options: { includeArchived?: boolean } = {},
): Record<string, unknown> {
  const first = optionalLinearNumber(input, "first");
  const after = optionalLinearString(input, "after");
  return {
    first: first === undefined ? 50 : Math.max(1, Math.min(250, first)),
    ...(after ? { after } : {}),
    ...(options.includeArchived
      ? { includeArchived: input.includeArchived === true }
      : {}),
  };
}

function linearTeamFilter(
  input: Readonly<Record<string, unknown>>,
  name = "teamId",
): Record<string, unknown> | undefined {
  const id = optionalLinearString(input, name);
  return id ? { team: { id: { eq: id } } } : undefined;
}

async function invokeLinearMethod(
  client: LinearSdkResource,
  method: string,
  ...arguments_: unknown[]
): Promise<unknown> {
  const candidate = client[method];
  if (typeof candidate !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return candidate.apply(client, arguments_);
}

async function linearResource(
  client: LinearSdkClient,
  method: string,
  id: string,
): Promise<LinearSdkResource> {
  const resource = await invokeLinearMethod(client, method, id);
  if (!resource || typeof resource !== "object") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return resource as LinearSdkResource;
}

async function invokeLinearResourceMethod(
  resource: LinearSdkResource,
  method: string,
  ...arguments_: unknown[]
): Promise<unknown> {
  return invokeLinearMethod(resource, method, ...arguments_);
}

async function linearRawMutation(
  client: LinearSdkClient,
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  const response = await client.client.rawRequest(query, variables);
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data: unknown }).data;
  }
  return response;
}

type LinearOperationHandler = (
  client: LinearSdkClient,
  input: Readonly<Record<string, unknown>>,
) => Promise<unknown>;

function linearIssueFilter(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> | undefined {
  const filter: Record<string, unknown> = {};
  const teamId = optionalLinearString(input, "teamId");
  const projectId = optionalLinearString(input, "projectId");
  const assigneeId = optionalLinearString(input, "assigneeId");
  const stateId = optionalLinearString(input, "stateId");
  const priority = optionalLinearNumber(input, "priority");
  const createdAfter = optionalLinearString(input, "createdAfter");
  const updatedAfter = optionalLinearString(input, "updatedAfter");
  const labelIds = Array.isArray(input.labelIds)
    ? input.labelIds.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  if (teamId) filter.team = { id: { eq: teamId } };
  if (projectId) filter.project = { id: { eq: projectId } };
  if (assigneeId) filter.assignee = { id: { eq: assigneeId } };
  if (stateId) filter.state = { id: { eq: stateId } };
  if (priority !== undefined) filter.priority = { eq: priority };
  if (labelIds.length > 0) filter.labels = { some: { id: { in: labelIds } } };
  if (createdAfter) filter.createdAt = { gte: createdAfter };
  if (updatedAfter) filter.updatedAt = { gte: updatedAfter };
  return Object.keys(filter).length > 0 ? filter : undefined;
}

async function linearUpdateIssue(
  client: LinearSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const issueId = requiredLinearString(input, "issueId");
  const update = linearOperationInput(input, [
    "issueId",
    "addedLabelIds",
    "removedLabelIds",
  ]);
  let output: unknown = undefined;
  if (Object.keys(update).length > 0) {
    output = await invokeLinearMethod(client, "updateIssue", issueId, update);
  }
  for (const labelId of Array.isArray(input.addedLabelIds)
    ? input.addedLabelIds
    : []) {
    if (typeof labelId === "string" && labelId) {
      output = await invokeLinearMethod(
        client,
        "issueAddLabel",
        issueId,
        labelId,
      );
    }
  }
  for (const labelId of Array.isArray(input.removedLabelIds)
    ? input.removedLabelIds
    : []) {
    if (typeof labelId === "string" && labelId) {
      output = await invokeLinearMethod(
        client,
        "issueRemoveLabel",
        issueId,
        labelId,
      );
    }
  }
  if (output === undefined) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return output;
}

async function linearCreateAttachment(
  client: LinearSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const file = input.file;
  const fileUrl =
    file &&
    typeof file === "object" &&
    typeof (file as { url?: unknown }).url === "string"
      ? (file as { url: string }).url
      : undefined;
  const url = optionalLinearString(input, "url") ?? fileUrl;
  if (!url) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return invokeLinearMethod(
    client,
    "createAttachment",
    linearOperationInput({ ...input, url }, ["file"]),
  );
}

async function linearListProjects(
  client: LinearSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const result = await invokeLinearMethod(
    client,
    "projects",
    linearPageVariables(input, { includeArchived: true }),
  );
  const teamId = optionalLinearString(input, "teamId");
  if (!teamId || !result || typeof result !== "object") {
    return result;
  }
  const nodes = (result as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) {
    return result;
  }
  const filtered = await Promise.all(
    nodes.map(async (project) => {
      if (!project || typeof project !== "object") return undefined;
      const teams = await invokeLinearResourceMethod(
        project as LinearSdkResource,
        "teams",
      );
      const teamNodes =
        teams &&
        typeof teams === "object" &&
        Array.isArray((teams as { nodes?: unknown }).nodes)
          ? ((teams as { nodes: unknown[] }).nodes ?? [])
          : [];
      return teamNodes.some(
        (team) =>
          team &&
          typeof team === "object" &&
          (team as { id?: unknown }).id === teamId,
      )
        ? project
        : undefined;
    }),
  );
  return {
    ...(result as Record<string, unknown>),
    nodes: filtered.filter(Boolean),
  };
}

const LINEAR_OPERATION_HANDLERS: Readonly<
  Record<string, LinearOperationHandler>
> = {
  "linear:read-issues": (client, input) =>
    invokeLinearMethod(client, "issues", {
      ...linearPageVariables(input, { includeArchived: true }),
      ...(linearIssueFilter(input) ? { filter: linearIssueFilter(input) } : {}),
      ...(optionalLinearString(input, "orderBy")
        ? { orderBy: optionalLinearString(input, "orderBy") }
        : {}),
    }),
  "linear:get-issue": (client, input) =>
    invokeLinearMethod(client, "issue", requiredLinearString(input, "issueId")),
  "linear:create-issue": (client, input) =>
    invokeLinearMethod(client, "createIssue", linearOperationInput(input)),
  "linear:update-issue": linearUpdateIssue,
  "linear:archive-issue": (client, input) =>
    invokeLinearMethod(
      client,
      "archiveIssue",
      requiredLinearString(input, "issueId"),
    ),
  "linear:unarchive-issue": (client, input) =>
    invokeLinearMethod(
      client,
      "unarchiveIssue",
      requiredLinearString(input, "issueId"),
    ),
  "linear:delete-issue": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteIssue",
      requiredLinearString(input, "issueId"),
    ),
  "linear:search-issues": (client, input) => {
    const teamFilter = linearTeamFilter(input);
    return invokeLinearMethod(client, "issueSearch", {
      ...linearPageVariables(input, { includeArchived: true }),
      term: requiredLinearString(input, "query"),
      ...(teamFilter ? { filter: teamFilter } : {}),
    });
  },
  "linear:add-label-to-issue": (client, input) =>
    invokeLinearMethod(
      client,
      "issueAddLabel",
      requiredLinearString(input, "issueId"),
      requiredLinearString(input, "labelId"),
    ),
  "linear:remove-label-from-issue": (client, input) =>
    invokeLinearMethod(
      client,
      "issueRemoveLabel",
      requiredLinearString(input, "issueId"),
      requiredLinearString(input, "labelId"),
    ),
  "linear:create-comment": (client, input) =>
    invokeLinearMethod(client, "createComment", linearOperationInput(input)),
  "linear:update-comment": (client, input) =>
    invokeLinearMethod(
      client,
      "updateComment",
      requiredLinearString(input, "commentId"),
      linearOperationInput(input, ["commentId"]),
    ),
  "linear:delete-comment": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteComment",
      requiredLinearString(input, "commentId"),
    ),
  "linear:list-comments": async (client, input) =>
    invokeLinearResourceMethod(
      await linearResource(
        client,
        "issue",
        requiredLinearString(input, "issueId"),
      ),
      "comments",
      linearPageVariables(input),
    ),
  "linear:list-projects": linearListProjects,
  "linear:get-project": (client, input) =>
    invokeLinearMethod(
      client,
      "project",
      requiredLinearString(input, "projectId"),
    ),
  "linear:create-project": (client, input) =>
    invokeLinearMethod(client, "createProject", linearOperationInput(input)),
  "linear:update-project": (client, input) =>
    invokeLinearMethod(
      client,
      "updateProject",
      requiredLinearString(input, "projectId"),
      linearOperationInput(input, ["projectId"]),
    ),
  "linear:archive-project": (client, input) =>
    invokeLinearMethod(
      client,
      "archiveProject",
      requiredLinearString(input, "projectId"),
    ),
  "linear:list-users": (client, input) =>
    invokeLinearMethod(client, "users", {
      ...linearPageVariables(input),
      includeDisabled: input.includeDisabled === true,
    }),
  "linear:list-teams": (client, input) =>
    invokeLinearMethod(client, "teams", linearPageVariables(input)),
  "linear:get-viewer": async (client) => client.viewer,
  "linear:list-labels": (client, input) => {
    const filter = linearTeamFilter(input);
    return invokeLinearMethod(client, "issueLabels", {
      ...linearPageVariables(input),
      ...(filter ? { filter } : {}),
    });
  },
  "linear:create-label": (client, input) =>
    invokeLinearMethod(client, "createIssueLabel", linearOperationInput(input)),
  "linear:update-label": (client, input) =>
    invokeLinearMethod(
      client,
      "updateIssueLabel",
      requiredLinearString(input, "labelId"),
      linearOperationInput(input, ["labelId"]),
    ),
  // The generated SDK currently omits this legacy mutation. Keep the request
  // on the official SDK client rather than exposing a product-owned transport.
  "linear:archive-label": (client, input) =>
    linearRawMutation(
      client,
      "mutation($id: String!) { issueLabelArchive(id: $id) { success } }",
      { id: requiredLinearString(input, "labelId") },
    ),
  "linear:list-workflow-states": (client, input) => {
    const filter = linearTeamFilter(input);
    return invokeLinearMethod(client, "workflowStates", {
      ...linearPageVariables(input),
      ...(filter ? { filter } : {}),
    });
  },
  "linear:create-workflow-state": (client, input) =>
    invokeLinearMethod(
      client,
      "createWorkflowState",
      linearOperationInput(input),
    ),
  "linear:update-workflow-state": (client, input) =>
    invokeLinearMethod(
      client,
      "updateWorkflowState",
      requiredLinearString(input, "stateId"),
      linearOperationInput(input, ["stateId"]),
    ),
  "linear:list-cycles": (client, input) => {
    const filter = linearTeamFilter(input);
    return invokeLinearMethod(client, "cycles", {
      ...linearPageVariables(input),
      ...(filter ? { filter } : {}),
    });
  },
  "linear:get-cycle": (client, input) =>
    invokeLinearMethod(client, "cycle", requiredLinearString(input, "cycleId")),
  "linear:create-cycle": (client, input) =>
    invokeLinearMethod(client, "createCycle", linearOperationInput(input)),
  "linear:get-active-cycle": async (client, input) => {
    const team = await linearResource(
      client,
      "team",
      requiredLinearString(input, "teamId"),
    );
    return team.activeCycle;
  },
  "linear:create-attachment": linearCreateAttachment,
  "linear:list-attachments": async (client, input) =>
    invokeLinearResourceMethod(
      await linearResource(
        client,
        "issue",
        requiredLinearString(input, "issueId"),
      ),
      "attachments",
      linearPageVariables(input),
    ),
  "linear:update-attachment": (client, input) =>
    invokeLinearMethod(
      client,
      "updateAttachment",
      requiredLinearString(input, "attachmentId"),
      linearOperationInput(input, ["attachmentId"]),
    ),
  "linear:delete-attachment": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteAttachment",
      requiredLinearString(input, "attachmentId"),
    ),
  "linear:create-issue-relation": (client, input) =>
    invokeLinearMethod(
      client,
      "createIssueRelation",
      linearOperationInput(input),
    ),
  "linear:list-issue-relations": async (client, input) =>
    invokeLinearResourceMethod(
      await linearResource(
        client,
        "issue",
        requiredLinearString(input, "issueId"),
      ),
      "relations",
      linearPageVariables(input),
    ),
  "linear:delete-issue-relation": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteIssueRelation",
      requiredLinearString(input, "relationId"),
    ),
  "linear:create-favorite": (client, input) =>
    invokeLinearMethod(client, "createFavorite", linearOperationInput(input)),
  "linear:list-favorites": (client, input) =>
    invokeLinearMethod(client, "favorites", linearPageVariables(input)),
  "linear:create-project-update": (client, input) =>
    invokeLinearMethod(
      client,
      "createProjectUpdate",
      linearOperationInput(input),
    ),
  "linear:list-project-updates": async (client, input) =>
    invokeLinearResourceMethod(
      await linearResource(
        client,
        "project",
        requiredLinearString(input, "projectId"),
      ),
      "projectUpdates",
      linearPageVariables(input),
    ),
  "linear:list-notifications": (client, input) =>
    invokeLinearMethod(client, "notifications", linearPageVariables(input)),
  "linear:update-notification": (client, input) =>
    invokeLinearMethod(
      client,
      "updateNotification",
      requiredLinearString(input, "notificationId"),
      {
        readAt:
          input.readAt === undefined ? new Date().toISOString() : input.readAt,
      },
    ),
  "linear:create-customer": (client, input) =>
    invokeLinearMethod(client, "createCustomer", linearOperationInput(input)),
  "linear:list-customers": (client, input) =>
    invokeLinearMethod(
      client,
      "customers",
      linearPageVariables(input, { includeArchived: true }),
    ),
  "linear:create-customer-request": (client, input) =>
    invokeLinearMethod(client, "createCustomerNeed", {
      ...linearOperationInput(input),
      priority: optionalLinearNumber(input, "priority") ?? 0,
    }),
  "linear:update-customer-request": (client, input) =>
    invokeLinearMethod(
      client,
      "updateCustomerNeed",
      requiredLinearString(input, "customerNeedId"),
      linearOperationInput(input, ["customerNeedId"]),
    ),
  "linear:list-customer-requests": (client, input) =>
    invokeLinearMethod(
      client,
      "customerNeeds",
      linearPageVariables(input, { includeArchived: true }),
    ),
  "linear:get-customer": (client, input) =>
    invokeLinearMethod(
      client,
      "customer",
      requiredLinearString(input, "customerId"),
    ),
  "linear:update-customer": (client, input) =>
    invokeLinearMethod(
      client,
      "updateCustomer",
      requiredLinearString(input, "customerId"),
      linearOperationInput(input, ["customerId"]),
    ),
  "linear:delete-customer": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteCustomer",
      requiredLinearString(input, "customerId"),
    ),
  "linear:merge-customers": (client, input) =>
    invokeLinearMethod(
      client,
      "customerMerge",
      requiredLinearString(input, "sourceCustomerId"),
      requiredLinearString(input, "targetCustomerId"),
    ),
  "linear:create-customer-status": (client, input) =>
    invokeLinearMethod(
      client,
      "createCustomerStatus",
      linearOperationInput(input),
    ),
  "linear:update-customer-status": (client, input) =>
    invokeLinearMethod(
      client,
      "updateCustomerStatus",
      requiredLinearString(input, "statusId"),
      linearOperationInput(input, ["statusId"]),
    ),
  "linear:delete-customer-status": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteCustomerStatus",
      requiredLinearString(input, "statusId"),
    ),
  "linear:list-customer-statuses": (client, input) =>
    invokeLinearMethod(client, "customerStatuses", linearPageVariables(input)),
  "linear:create-customer-tier": (client, input) =>
    invokeLinearMethod(
      client,
      "createCustomerTier",
      linearOperationInput(input),
    ),
  "linear:update-customer-tier": (client, input) =>
    invokeLinearMethod(
      client,
      "updateCustomerTier",
      requiredLinearString(input, "tierId"),
      linearOperationInput(input, ["tierId"]),
    ),
  "linear:delete-customer-tier": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteCustomerTier",
      requiredLinearString(input, "tierId"),
    ),
  "linear:list-customer-tiers": (client, input) =>
    invokeLinearMethod(client, "customerTiers", linearPageVariables(input)),
  "linear:delete-project": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteProject",
      requiredLinearString(input, "projectId"),
    ),
  "linear:create-project-label": (client, input) =>
    invokeLinearMethod(
      client,
      "createProjectLabel",
      linearOperationInput(input),
    ),
  "linear:update-project-label": (client, input) =>
    invokeLinearMethod(
      client,
      "updateProjectLabel",
      requiredLinearString(input, "labelId"),
      linearOperationInput(input, ["labelId"]),
    ),
  "linear:delete-project-label": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteProjectLabel",
      requiredLinearString(input, "labelId"),
    ),
  "linear:list-project-labels": async (client, input) => {
    const projectId = optionalLinearString(input, "projectId");
    if (!projectId) {
      return invokeLinearMethod(
        client,
        "projectLabels",
        linearPageVariables(input),
      );
    }
    return invokeLinearResourceMethod(
      await linearResource(client, "project", projectId),
      "labels",
      linearPageVariables(input),
    );
  },
  "linear:add-label-to-project": (client, input) =>
    invokeLinearMethod(
      client,
      "projectAddLabel",
      requiredLinearString(input, "projectId"),
      requiredLinearString(input, "labelId"),
    ),
  "linear:remove-label-from-project": (client, input) =>
    invokeLinearMethod(
      client,
      "projectRemoveLabel",
      requiredLinearString(input, "projectId"),
      requiredLinearString(input, "labelId"),
    ),
  "linear:create-project-milestone": (client, input) =>
    invokeLinearMethod(
      client,
      "createProjectMilestone",
      linearOperationInput(input),
    ),
  "linear:update-project-milestone": (client, input) =>
    invokeLinearMethod(
      client,
      "updateProjectMilestone",
      requiredLinearString(input, "milestoneId"),
      linearOperationInput(input, ["milestoneId"]),
    ),
  "linear:delete-project-milestone": (client, input) =>
    invokeLinearMethod(
      client,
      "deleteProjectMilestone",
      requiredLinearString(input, "milestoneId"),
    ),
  "linear:list-project-milestones": async (client, input) =>
    invokeLinearResourceMethod(
      await linearResource(
        client,
        "project",
        requiredLinearString(input, "projectId"),
      ),
      "projectMilestones",
      linearPageVariables(input),
    ),
  "linear:create-project-status": (client, input) =>
    invokeLinearMethod(
      client,
      "createProjectStatus",
      linearOperationInput(input),
    ),
  "linear:update-project-status": (client, input) =>
    invokeLinearMethod(
      client,
      "updateProjectStatus",
      requiredLinearString(input, "statusId"),
      linearOperationInput(input, ["statusId"]),
    ),
  // Like issueLabelArchive, this legacy delete mutation is not generated in
  // the current SDK; route it through the SDK's authenticated GraphQL client.
  "linear:delete-project-status": (client, input) =>
    linearRawMutation(
      client,
      "mutation($id: String!) { projectStatusDelete(id: $id) { success } }",
      { id: requiredLinearString(input, "statusId") },
    ),
  "linear:list-project-statuses": (client, input) =>
    invokeLinearMethod(client, "projectStatuses", linearPageVariables(input)),
};

function assertLinearOperationCoverage(): void {
  const expected = new Set(LINEAR_OPERATION_IDS);
  const implemented = Object.keys(LINEAR_OPERATION_HANDLERS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Linear provider SDK operation coverage is incomplete.");
  }
}

/**
 * All pinned Linear actions are executed through Linear's official TypeScript
 * SDK. Two legacy mutations that are absent from the generated SDK surface
 * use its authenticated GraphQL client, keeping credentials and transport
 * package-owned until Linear regenerates those operations.
 */
export function createLinearProviderSdk(
  config: LinearProviderSdkConfig,
): IntegrationProviderSdk {
  assertLinearOperationCoverage();
  const clientFactory = config.clientFactory ?? createLinearClient;
  return {
    integrationId: "linear",
    operationIds: LINEAR_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "linear" ||
        invocation.reference.integrationId !== "linear"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const handler = LINEAR_OPERATION_HANDLERS[invocation.operationId];
      if (!handler) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await handler(
            clientFactory(credential.accessToken),
            invocation.input,
          ),
        }),
      );
    },
  };
}

export function getLinearProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertLinearOperationCoverage();
  return {
    operations: LINEAR_OPERATION_IDS.length,
    operationIds: LINEAR_OPERATION_IDS,
  };
}
