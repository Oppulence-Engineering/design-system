import { Gitlab } from "@gitbeaker/rest";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationApiKeyRuntime } from "../../runtime/api-key";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  requiredInputString,
} from "../shared/sdk";

type GitLabSdkClient = Record<string, unknown>;

type GitLabClientFactory = (apiKey: string, host: string) => GitLabSdkClient;

export interface GitLabProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: GitLabClientFactory;
  /** A deployment-controlled GitLab origin. Request input can never override it. */
  host?: string;
}

function normalizeGitLabHost(value: string): string {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) {
      throw new Error("unsafe GitLab host");
    }
    return url.origin;
  } catch {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
}

function createGitLabClient(apiKey: string, host: string): GitLabSdkClient {
  return new Gitlab({ token: apiKey, host }) as unknown as GitLabSdkClient;
}

const GITLAB_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "gitlab",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GitLabSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function gitLabRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): GitLabSdkRequest {
  const argumentsCopy = [...arguments_];
  while (argumentsCopy.at(-1) === undefined) argumentsCopy.pop();
  return { path, arguments: argumentsCopy };
}

function gitLabId(
  input: Readonly<Record<string, unknown>>,
  field: string,
): string | number {
  const value = input[field];
  if (
    (typeof value === "string" && value.trim() && value.length <= 1_000) ||
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
  ) {
    return typeof value === "string" ? value.trim() : value;
  }
  throw new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

function gitLabNumber(
  input: Readonly<Record<string, unknown>>,
  field: string,
): number {
  const value = input[field];
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  throw new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

function gitLabOptions(
  input: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): Record<string, unknown> | undefined {
  const options = definedFields(
    Object.fromEntries(fields.map((field) => [field, input[field]])),
  );
  return Object.keys(options).length ? options : undefined;
}

function gitLabProjectId(
  input: Readonly<Record<string, unknown>>,
): string | number {
  return gitLabId(input, "projectId");
}

function gitLabResource(
  input: Readonly<Record<string, unknown>>,
  suffix: "Members" | "Invitations" | "AccessRequests",
): { path: readonly string[]; resourceId: string | number } {
  const type = requiredInputString(input, "resourceType").toLowerCase();
  if (type !== "project" && type !== "group") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return {
    path: [`${type === "project" ? "Project" : "Group"}${suffix}`],
    resourceId: gitLabId(input, "resourceId"),
  };
}

const GITLAB_OPERATION_REQUESTS: Readonly<
  Record<string, (input: Readonly<Record<string, unknown>>) => GitLabSdkRequest>
> = {
  "gitlab:list-projects": (input) =>
    gitLabRequest(
      ["Projects", "all"],
      gitLabOptions(input, [
        "owned",
        "membership",
        "search",
        "visibility",
        "orderBy",
        "sort",
        "perPage",
        "page",
      ]),
    ),
  "gitlab:get-project": (input) =>
    gitLabRequest(["Projects", "show"], gitLabProjectId(input)),
  "gitlab:list-groups": (input) =>
    gitLabRequest(
      ["Groups", "all"],
      gitLabOptions(input, [
        "owned",
        "search",
        "topLevelOnly",
        "visibility",
        "minAccessLevel",
        "allAvailable",
        "orderBy",
        "sort",
        "perPage",
        "page",
      ]),
    ),
  "gitlab:get-group": (input) =>
    gitLabRequest(["Groups", "show"], gitLabId(input, "groupId")),
  "gitlab:list-issues": (input) =>
    gitLabRequest(
      ["Issues", "all"],
      definedFields({
        projectId: gitLabProjectId(input),
        state: input.state,
        labels: input.labels,
        assigneeId: input.assigneeId,
        milestone: input.milestoneTitle,
        search: input.search,
        orderBy: input.orderBy,
        sort: input.sort,
        perPage: input.perPage,
        page: input.page,
      }),
    ),
  "gitlab:get-issue": (input) =>
    gitLabRequest(["Issues", "show"], gitLabNumber(input, "issueIid"), {
      projectId: gitLabProjectId(input),
    }),
  "gitlab:create-issue": (input) =>
    gitLabRequest(
      ["Issues", "create"],
      gitLabProjectId(input),
      requiredInputString(input, "title"),
      gitLabOptions(input, [
        "description",
        "labels",
        "assigneeIds",
        "milestoneId",
        "dueDate",
        "confidential",
      ]),
    ),
  "gitlab:update-issue": (input) =>
    gitLabRequest(
      ["Issues", "edit"],
      gitLabProjectId(input),
      gitLabNumber(input, "issueIid"),
      gitLabOptions(input, [
        "title",
        "description",
        "stateEvent",
        "labels",
        "assigneeIds",
        "milestoneId",
        "dueDate",
        "confidential",
      ]),
    ),
  "gitlab:delete-issue": (input) =>
    gitLabRequest(
      ["Issues", "remove"],
      gitLabProjectId(input),
      gitLabNumber(input, "issueIid"),
    ),
  "gitlab:add-issue-comment": (input) =>
    gitLabRequest(
      ["IssueNotes", "create"],
      gitLabProjectId(input),
      gitLabNumber(input, "issueIid"),
      requiredInputString(input, "body"),
      gitLabOptions(input, ["internal"]),
    ),
  "gitlab:list-merge-requests": (input) =>
    gitLabRequest(
      ["MergeRequests", "all"],
      definedFields({
        projectId: gitLabProjectId(input),
        state: input.state,
        labels: input.labels,
        sourceBranch: input.sourceBranch,
        targetBranch: input.targetBranch,
        orderBy: input.orderBy,
        sort: input.sort,
        perPage: input.perPage,
        page: input.page,
      }),
    ),
  "gitlab:get-merge-request": (input) =>
    gitLabRequest(
      ["MergeRequests", "show"],
      gitLabProjectId(input),
      gitLabNumber(input, "mergeRequestIid"),
    ),
  "gitlab:create-merge-request": (input) =>
    gitLabRequest(
      ["MergeRequests", "create"],
      gitLabProjectId(input),
      requiredInputString(input, "sourceBranch"),
      requiredInputString(input, "targetBranch"),
      requiredInputString(input, "title"),
      gitLabOptions(input, [
        "description",
        "labels",
        "assigneeIds",
        "milestoneId",
        "removeSourceBranch",
        "squash",
        "draft",
      ]),
    ),
  "gitlab:update-merge-request": (input) =>
    gitLabRequest(
      ["MergeRequests", "edit"],
      gitLabProjectId(input),
      gitLabNumber(input, "mergeRequestIid"),
      gitLabOptions(input, [
        "title",
        "description",
        "stateEvent",
        "labels",
        "assigneeIds",
        "milestoneId",
        "targetBranch",
        "removeSourceBranch",
        "squash",
        "draft",
      ]),
    ),
  "gitlab:merge-merge-request": (input) =>
    gitLabRequest(
      ["MergeRequests", "merge"],
      gitLabProjectId(input),
      gitLabNumber(input, "mergeRequestIid"),
      gitLabOptions(input, [
        "mergeCommitMessage",
        "squashCommitMessage",
        "squash",
        "shouldRemoveSourceBranch",
        "mergeWhenPipelineSucceeds",
      ]),
    ),
  "gitlab:add-mr-comment": (input) =>
    gitLabRequest(
      ["MergeRequestNotes", "create"],
      gitLabProjectId(input),
      gitLabNumber(input, "mergeRequestIid"),
      requiredInputString(input, "body"),
      gitLabOptions(input, ["internal"]),
    ),
  "gitlab:list-pipelines": (input) =>
    gitLabRequest(
      ["Pipelines", "all"],
      gitLabProjectId(input),
      gitLabOptions(input, [
        "ref",
        "status",
        "orderBy",
        "sort",
        "perPage",
        "page",
      ]),
    ),
  "gitlab:get-pipeline": (input) =>
    gitLabRequest(
      ["Pipelines", "show"],
      gitLabProjectId(input),
      gitLabNumber(input, "pipelineId"),
    ),
  "gitlab:create-pipeline": (input) =>
    gitLabRequest(
      ["Pipelines", "create"],
      gitLabProjectId(input),
      requiredInputString(input, "ref"),
      gitLabOptions(input, ["variables", "inputs"]),
    ),
  "gitlab:retry-pipeline": (input) =>
    gitLabRequest(
      ["Pipelines", "retry"],
      gitLabProjectId(input),
      gitLabNumber(input, "pipelineId"),
    ),
  "gitlab:cancel-pipeline": (input) =>
    gitLabRequest(
      ["Pipelines", "cancel"],
      gitLabProjectId(input),
      gitLabNumber(input, "pipelineId"),
    ),
  "gitlab:list-repository-tree": (input) =>
    gitLabRequest(
      ["Repositories", "allRepositoryTrees"],
      gitLabProjectId(input),
      gitLabOptions(input, ["path", "ref", "recursive", "perPage", "page"]),
    ),
  "gitlab:get-file": (input) =>
    gitLabRequest(
      ["RepositoryFiles", "show"],
      gitLabProjectId(input),
      requiredInputString(input, "filePath"),
      requiredInputString(input, "ref"),
    ),
  "gitlab:create-file": (input) =>
    gitLabRequest(
      ["RepositoryFiles", "create"],
      gitLabProjectId(input),
      requiredInputString(input, "filePath"),
      requiredInputString(input, "branch"),
      requiredInputString(input, "content"),
      requiredInputString(input, "commitMessage"),
      gitLabOptions(input, [
        "startBranch",
        "authorName",
        "authorEmail",
        "executeFilemode",
      ]),
    ),
  "gitlab:update-file": (input) =>
    gitLabRequest(
      ["RepositoryFiles", "edit"],
      gitLabProjectId(input),
      requiredInputString(input, "filePath"),
      requiredInputString(input, "branch"),
      requiredInputString(input, "content"),
      requiredInputString(input, "commitMessage"),
      gitLabOptions(input, [
        "startBranch",
        "authorName",
        "authorEmail",
        "executeFilemode",
        "lastCommitId",
      ]),
    ),
  "gitlab:list-commits": (input) =>
    gitLabRequest(
      ["Commits", "all"],
      gitLabProjectId(input),
      gitLabOptions(input, [
        "refName",
        "since",
        "until",
        "path",
        "author",
        "perPage",
        "page",
      ]),
    ),
  "gitlab:list-branches": (input) =>
    gitLabRequest(
      ["Branches", "all"],
      gitLabProjectId(input),
      gitLabOptions(input, ["search", "perPage", "page"]),
    ),
  "gitlab:create-branch": (input) =>
    gitLabRequest(
      ["Branches", "create"],
      gitLabProjectId(input),
      requiredInputString(input, "branch"),
      requiredInputString(input, "ref"),
    ),
  "gitlab:delete-branch": (input) =>
    gitLabRequest(
      ["Branches", "remove"],
      gitLabProjectId(input),
      requiredInputString(input, "branch"),
    ),
  "gitlab:compare-branches": (input) =>
    gitLabRequest(
      ["Repositories", "compare"],
      gitLabProjectId(input),
      requiredInputString(input, "from"),
      requiredInputString(input, "to"),
      gitLabOptions(input, ["straight", "fromProjectId", "unidiff"]),
    ),
  "gitlab:get-mr-changes": (input) =>
    gitLabRequest(
      ["MergeRequests", "showChanges"],
      gitLabProjectId(input),
      gitLabNumber(input, "mergeRequestIid"),
    ),
  "gitlab:approve-merge-request": (input) =>
    gitLabRequest(
      ["MergeRequestApprovals", "approve"],
      gitLabProjectId(input),
      gitLabNumber(input, "mergeRequestIid"),
      gitLabOptions(input, ["sha"]),
    ),
  "gitlab:list-pipeline-jobs": (input) =>
    gitLabRequest(
      ["Jobs", "all"],
      gitLabProjectId(input),
      definedFields({
        pipelineId: gitLabNumber(input, "pipelineId"),
        scope: input.scope,
        includeRetried: input.includeRetried,
        perPage: input.perPage,
        page: input.page,
      }),
    ),
  "gitlab:get-job-log": (input) =>
    gitLabRequest(
      ["Jobs", "showLog"],
      gitLabProjectId(input),
      gitLabNumber(input, "jobId"),
    ),
  "gitlab:play-job": (input) =>
    gitLabRequest(
      ["Jobs", "play"],
      gitLabProjectId(input),
      gitLabNumber(input, "jobId"),
      definedFields({ jobVariablesAttributes: input.jobVariables }),
    ),
  "gitlab:list-releases": (input) =>
    gitLabRequest(
      ["ProjectReleases", "all"],
      gitLabProjectId(input),
      gitLabOptions(input, ["orderBy", "sort", "perPage", "page"]),
    ),
  "gitlab:create-release": (input) =>
    gitLabRequest(
      ["ProjectReleases", "create"],
      gitLabProjectId(input),
      gitLabOptions(input, [
        "tagName",
        "name",
        "description",
        "ref",
        "releasedAt",
        "tagMessage",
        "assetLinks",
        "milestones",
      ]),
    ),
  "gitlab:list-members": (input) => {
    const resource = gitLabResource(input, "Members");
    return gitLabRequest(
      [...resource.path, "all"],
      resource.resourceId,
      definedFields({
        includeInherited: !Boolean(input.directOnly),
        query: input.query,
        userIds:
          typeof input.userIds === "string"
            ? input.userIds
                .split(",")
                .map((value) => Number(value.trim()))
                .filter(Number.isSafeInteger)
            : undefined,
        state: input.state,
        showSeatInfo: input.showSeatInfo,
        perPage: input.perPage,
        page: input.page,
      }),
    );
  },
  "gitlab:add-member": (input) => {
    const resource = gitLabResource(input, "Members");
    return gitLabRequest(
      [...resource.path, "add"],
      resource.resourceId,
      gitLabNumber(input, "accessLevel"),
      definedFields({
        userId: input.userId,
        username: input.username,
        expiresAt: input.expiresAt,
        memberRoleId: input.memberRoleId,
      }),
    );
  },
  "gitlab:update-member": (input) => {
    const resource = gitLabResource(input, "Members");
    return gitLabRequest(
      [...resource.path, "edit"],
      resource.resourceId,
      gitLabNumber(input, "userId"),
      gitLabNumber(input, "accessLevel"),
      gitLabOptions(input, ["expiresAt", "memberRoleId"]),
    );
  },
  "gitlab:remove-member": (input) => {
    const resource = gitLabResource(input, "Members");
    return gitLabRequest(
      [...resource.path, "remove"],
      resource.resourceId,
      gitLabNumber(input, "userId"),
      gitLabOptions(input, ["skipSubresources", "unassignIssuables"]),
    );
  },
  "gitlab:invite-member-by-email": (input) => {
    const resource = gitLabResource(input, "Invitations");
    return gitLabRequest(
      [...resource.path, "add"],
      resource.resourceId,
      gitLabNumber(input, "accessLevel"),
      definedFields({
        email: requiredInputString(input, "email"),
        expiresAt: input.expiresAt,
        memberRoleId: input.memberRoleId,
        inviteSource: input.inviteSource,
      }),
    );
  },
  "gitlab:list-invitations": (input) => {
    const resource = gitLabResource(input, "Invitations");
    return gitLabRequest(
      [...resource.path, "all"],
      resource.resourceId,
      gitLabOptions(input, ["query", "perPage", "page"]),
    );
  },
  "gitlab:update-invitation": (input) => {
    const resource = gitLabResource(input, "Invitations");
    return gitLabRequest(
      [...resource.path, "edit"],
      resource.resourceId,
      requiredInputString(input, "email"),
      gitLabOptions(input, ["accessLevel", "expiresAt"]),
    );
  },
  "gitlab:revoke-invitation": (input) => {
    const resource = gitLabResource(input, "Invitations");
    return gitLabRequest(
      [...resource.path, "remove"],
      resource.resourceId,
      requiredInputString(input, "email"),
    );
  },
  "gitlab:list-access-requests": (input) => {
    const resource = gitLabResource(input, "AccessRequests");
    return gitLabRequest(
      [...resource.path, "all"],
      resource.resourceId,
      gitLabOptions(input, ["perPage", "page"]),
    );
  },
  "gitlab:approve-access-request": (input) => {
    const resource = gitLabResource(input, "AccessRequests");
    return gitLabRequest(
      [...resource.path, "approve"],
      resource.resourceId,
      gitLabNumber(input, "userId"),
      gitLabOptions(input, ["accessLevel"]),
    );
  },
  "gitlab:deny-access-request": (input) => {
    const resource = gitLabResource(input, "AccessRequests");
    return gitLabRequest(
      [...resource.path, "deny"],
      resource.resourceId,
      gitLabNumber(input, "userId"),
    );
  },
  "gitlab:list-saml-group-links": (input) =>
    gitLabRequest(
      ["GroupSAMLLinks", "all"],
      gitLabId(input, "groupId"),
      gitLabOptions(input, ["perPage", "page"]),
    ),
  "gitlab:list-user-memberships": (input) =>
    gitLabRequest(
      ["Users", "allMemberships"],
      gitLabNumber(input, "userId"),
      definedFields({
        type: input.membershipType,
        perPage: input.perPage,
        page: input.page,
      }),
    ),
  "gitlab:search-users": (input) =>
    gitLabRequest(
      ["Users", "all"],
      definedFields({
        search: requiredInputString(input, "search"),
        perPage: input.perPage,
        page: input.page,
      }),
    ),
  "gitlab:create-user": (input) =>
    gitLabRequest(
      ["Users", "create"],
      gitLabOptions(input, [
        "email",
        "username",
        "name",
        "password",
        "resetPassword",
        "forceRandomPassword",
        "admin",
        "skipConfirmation",
      ]),
    ),
  "gitlab:update-user": (input) =>
    gitLabRequest(
      ["Users", "edit"],
      gitLabNumber(input, "userId"),
      gitLabOptions(input, ["email", "username", "name", "admin"]),
    ),
  "gitlab:delete-user": (input) =>
    gitLabRequest(
      ["Users", "remove"],
      gitLabNumber(input, "userId"),
      gitLabOptions(input, ["hardDelete"]),
    ),
  "gitlab:block-user": (input) =>
    gitLabRequest(["Users", "block"], gitLabNumber(input, "userId")),
  "gitlab:unblock-user": (input) =>
    gitLabRequest(["Users", "unblock"], gitLabNumber(input, "userId")),
  "gitlab:deactivate-user": (input) =>
    gitLabRequest(["Users", "deactivate"], gitLabNumber(input, "userId")),
  "gitlab:activate-user": (input) =>
    gitLabRequest(["Users", "activate"], gitLabNumber(input, "userId")),
  "gitlab:ban-user": (input) =>
    gitLabRequest(["Users", "ban"], gitLabNumber(input, "userId")),
  "gitlab:unban-user": (input) =>
    gitLabRequest(["Users", "unban"], gitLabNumber(input, "userId")),
  "gitlab:approve-user-signup": (input) =>
    gitLabRequest(["Users", "approve"], gitLabNumber(input, "userId")),
  "gitlab:reject-user-signup": (input) =>
    gitLabRequest(["Users", "reject"], gitLabNumber(input, "userId")),
  "gitlab:delete-user-identity": (input) =>
    gitLabRequest(
      ["Users", "removeAuthenticationIdentity"],
      gitLabNumber(input, "userId"),
      requiredInputString(input, "provider"),
    ),
  "gitlab:add-saml-group-link": (input) =>
    gitLabRequest(
      ["GroupSAMLLinks", "create"],
      gitLabId(input, "groupId"),
      requiredInputString(input, "samlGroupName"),
      gitLabNumber(input, "accessLevel"),
      gitLabOptions(input, ["memberRoleId", "provider"]),
    ),
  "gitlab:delete-saml-group-link": (input) =>
    gitLabRequest(
      ["GroupSAMLLinks", "remove"],
      gitLabId(input, "groupId"),
      requiredInputString(input, "samlGroupName"),
      gitLabOptions(input, ["provider"]),
    ),
};

function assertGitLabOperationCoverage(): void {
  const expected = new Set(GITLAB_OPERATION_IDS);
  const implemented = Object.keys(GITLAB_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("GitLab provider SDK operation coverage is incomplete.");
  }
}

/**
 * All pinned GitLab actions use the maintained GitBeaker SDK. The deployment
 * controls the GitLab origin, which prevents an action input from directing a
 * decrypted personal access token to an arbitrary host.
 */
export function createGitLabProviderSdk(
  config: GitLabProviderSdkConfig,
): IntegrationProviderSdk {
  assertGitLabOperationCoverage();
  const host = normalizeGitLabHost(config.host ?? "https://gitlab.com");
  const clientFactory = config.clientFactory ?? createGitLabClient;
  return {
    integrationId: "gitlab",
    operationIds: GITLAB_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "gitlab" ||
        invocation.reference.integrationId !== "gitlab"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = GITLAB_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await invokeSdkMethod(
            clientFactory(credential.apiKey, host),
            requestFactory(invocation.input),
          ),
        }),
      );
    },
  };
}

export function getGitLabProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGitLabOperationCoverage();
  return {
    operations: GITLAB_OPERATION_IDS.length,
    operationIds: GITLAB_OPERATION_IDS,
  };
}
