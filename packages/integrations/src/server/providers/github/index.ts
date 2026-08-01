import { Octokit } from "@octokit/rest";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationApiKeyRuntime } from "../../runtime/api-key";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import {
  ProviderSdkInvocationSchema,
  optionalStringValue,
  toSnakeCase,
} from "../shared/sdk";

interface GitHubApiClient {
  request(
    route: string,
    parameters: Record<string, unknown>,
  ): Promise<{ data: unknown }>;
}

type GitHubClientFactory = (apiKey: string) => GitHubApiClient;

export interface GitHubProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: GitHubClientFactory;
}

function createGitHubClient(apiKey: string): GitHubApiClient {
  return new Octokit({
    auth: apiKey,
    userAgent: "@oppulence/integrations",
  }) as unknown as GitHubApiClient;
}

const GITHUB_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "github",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GitHubApiRequest {
  route: string;
  parameters: Record<string, unknown>;
}

type GitHubOperationRequestFactory = (
  input: Readonly<Record<string, unknown>>,
) => GitHubApiRequest;

const GITHUB_CREDENTIAL_PARAMETER_NAMES = new Set([
  "access_token",
  "api_key",
  "auth",
  "authorization",
  "bearer",
  "bot_token",
  "credential",
  "headers",
  "oauth_credential",
  "password",
  "refresh_token",
  "request",
  "secret",
  "token",
]);

function gitHubParameters(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(input)) {
    const key = toSnakeCase(rawKey);
    if (!GITHUB_CREDENTIAL_PARAMETER_NAMES.has(key)) {
      parameters[key] = value;
    }
  }
  if (
    parameters.pull_number === undefined &&
    parameters.issue_number !== undefined
  ) {
    parameters.pull_number = parameters.issue_number;
  }
  if (
    parameters.issue_number === undefined &&
    parameters.pull_number !== undefined
  ) {
    parameters.issue_number = parameters.pull_number;
  }
  return parameters;
}

function gitHubRequest(
  route: string,
  input: Readonly<Record<string, unknown>>,
  additions?: Readonly<Record<string, unknown>>,
): GitHubApiRequest {
  return {
    route,
    parameters: { ...gitHubParameters(input), ...additions },
  };
}

function gitHubRest(route: string): GitHubOperationRequestFactory {
  return (input) => gitHubRequest(route, input);
}

function gitHubGraphql(
  query: string,
  input: Readonly<Record<string, unknown>>,
  variables: Readonly<Record<string, unknown>> = gitHubParameters(input),
): GitHubApiRequest {
  return gitHubRequest("POST /graphql", input, { query, variables });
}

const GITHUB_PROJECT_FIELDS = `
  id
  number
  title
  shortDescription
  closed
  public
  url
`;

const GITHUB_OPERATION_REQUESTS: Readonly<
  Record<string, GitHubOperationRequestFactory>
> = {
  "github:get-pr-details": gitHubRest(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
  ),
  "github:create-pr-comment": (input) =>
    gitHubRequest(
      input.path
        ? "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments"
        : "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      input,
      input.path ? undefined : { event: "COMMENT" },
    ),
  "github:get-repository-info": gitHubRest("GET /repos/{owner}/{repo}"),
  "github:get-latest-commit": (input) => {
    const parameters = gitHubParameters(input);
    const branch = optionalStringValue(parameters.branch);
    return branch
      ? gitHubRequest("GET /repos/{owner}/{repo}/commits/{branch}", input)
      : gitHubRequest("GET /repos/{owner}/{repo}/commits", input);
  },
  "github:create-issue-comment": gitHubRest(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
  ),
  "github:list-issue-comments": gitHubRest(
    "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
  ),
  "github:update-comment": gitHubRest(
    "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
  ),
  "github:delete-comment": gitHubRest(
    "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}",
  ),
  "github:list-pr-comments": gitHubRest(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
  ),
  "github:create-pull-request": gitHubRest("POST /repos/{owner}/{repo}/pulls"),
  "github:update-pull-request": gitHubRest(
    "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
  ),
  "github:merge-pull-request": gitHubRest(
    "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
  ),
  "github:list-pull-requests": gitHubRest("GET /repos/{owner}/{repo}/pulls"),
  "github:get-pr-files": gitHubRest(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
  ),
  "github:close-pull-request": (input) =>
    gitHubRequest("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", input, {
      state: "closed",
    }),
  "github:request-pr-reviewers": gitHubRest(
    "POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
  ),
  "github:create-pr-review": gitHubRest(
    "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
  ),
  "github:get-file-content": gitHubRest(
    "GET /repos/{owner}/{repo}/contents/{path}",
  ),
  "github:create-file": gitHubRest("PUT /repos/{owner}/{repo}/contents/{path}"),
  "github:update-file": gitHubRest("PUT /repos/{owner}/{repo}/contents/{path}"),
  "github:delete-file": gitHubRest(
    "DELETE /repos/{owner}/{repo}/contents/{path}",
  ),
  "github:get-directory-tree": gitHubRest(
    "GET /repos/{owner}/{repo}/contents/{path}",
  ),
  "github:get-readme": gitHubRest("GET /repos/{owner}/{repo}/readme"),
  "github:list-tags": gitHubRest("GET /repos/{owner}/{repo}/tags"),
  "github:list-branches": gitHubRest("GET /repos/{owner}/{repo}/branches"),
  "github:get-branch": gitHubRest(
    "GET /repos/{owner}/{repo}/branches/{branch}",
  ),
  "github:create-branch": gitHubRest("POST /repos/{owner}/{repo}/git/refs"),
  "github:delete-branch": gitHubRest(
    "DELETE /repos/{owner}/{repo}/git/refs/heads/{branch}",
  ),
  "github:get-branch-protection": gitHubRest(
    "GET /repos/{owner}/{repo}/branches/{branch}/protection",
  ),
  "github:update-branch-protection": gitHubRest(
    "PUT /repos/{owner}/{repo}/branches/{branch}/protection",
  ),
  "github:create-issue": gitHubRest("POST /repos/{owner}/{repo}/issues"),
  "github:update-issue": gitHubRest(
    "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
  ),
  "github:list-issues": gitHubRest("GET /repos/{owner}/{repo}/issues"),
  "github:get-issue": gitHubRest(
    "GET /repos/{owner}/{repo}/issues/{issue_number}",
  ),
  "github:close-issue": (input) =>
    gitHubRequest("PATCH /repos/{owner}/{repo}/issues/{issue_number}", input, {
      state: "closed",
    }),
  "github:add-issue-labels": gitHubRest(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
  ),
  "github:remove-issue-label": gitHubRest(
    "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}",
  ),
  "github:add-issue-assignees": gitHubRest(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/assignees",
  ),
  "github:create-release": gitHubRest("POST /repos/{owner}/{repo}/releases"),
  "github:update-release": gitHubRest(
    "PATCH /repos/{owner}/{repo}/releases/{release_id}",
  ),
  "github:list-releases": gitHubRest("GET /repos/{owner}/{repo}/releases"),
  "github:get-release": gitHubRest(
    "GET /repos/{owner}/{repo}/releases/{release_id}",
  ),
  "github:get-latest-release": gitHubRest(
    "GET /repos/{owner}/{repo}/releases/latest",
  ),
  "github:delete-release": gitHubRest(
    "DELETE /repos/{owner}/{repo}/releases/{release_id}",
  ),
  "github:list-workflows": gitHubRest(
    "GET /repos/{owner}/{repo}/actions/workflows",
  ),
  "github:get-workflow": gitHubRest(
    "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}",
  ),
  "github:trigger-workflow": gitHubRest(
    "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
  ),
  "github:list-workflow-runs": gitHubRest(
    "GET /repos/{owner}/{repo}/actions/runs",
  ),
  "github:get-workflow-run": gitHubRest(
    "GET /repos/{owner}/{repo}/actions/runs/{run_id}",
  ),
  "github:cancel-workflow-run": gitHubRest(
    "POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel",
  ),
  "github:rerun-workflow": gitHubRest(
    "POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun",
  ),
  "github:list-projects": (input) =>
    gitHubGraphql(
      `query($owner_login: String!) {
        repositoryOwner(login: $owner_login) {
          ... on User { projectsV2(first: 100) { nodes { ${GITHUB_PROJECT_FIELDS} } } }
          ... on Organization { projectsV2(first: 100) { nodes { ${GITHUB_PROJECT_FIELDS} } } }
        }
      }`,
      input,
    ),
  "github:get-project": (input) =>
    gitHubGraphql(
      `query($owner_login: String!, $project_number: Int!) {
        repositoryOwner(login: $owner_login) {
          ... on User { projectV2(number: $project_number) { ${GITHUB_PROJECT_FIELDS} } }
          ... on Organization { projectV2(number: $project_number) { ${GITHUB_PROJECT_FIELDS} } }
        }
      }`,
      input,
    ),
  "github:create-project": (input) =>
    gitHubGraphql(
      `mutation($owner_id: ID!, $title: String!) {
        createProjectV2(input: {ownerId: $owner_id, title: $title}) {
          projectV2 { ${GITHUB_PROJECT_FIELDS} }
        }
      }`,
      input,
    ),
  "github:update-project": (input) =>
    gitHubGraphql(
      `mutation($project_id: ID!, $title: String, $short_description: String, $project_public: Boolean, $closed: Boolean) {
        updateProjectV2(input: {projectId: $project_id, title: $title, shortDescription: $short_description, public: $project_public, closed: $closed}) {
          projectV2 { ${GITHUB_PROJECT_FIELDS} }
        }
      }`,
      input,
    ),
  "github:delete-project": (input) =>
    gitHubGraphql(
      `mutation($project_id: ID!) { deleteProjectV2(input: {projectId: $project_id}) { clientMutationId } }`,
      input,
    ),
  "github:search-code": gitHubRest("GET /search/code"),
  "github:search-commits": gitHubRest("GET /search/commits"),
  "github:search-issues": gitHubRest("GET /search/issues"),
  "github:search-repositories": gitHubRest("GET /search/repositories"),
  "github:search-users": gitHubRest("GET /search/users"),
  "github:list-commits": gitHubRest("GET /repos/{owner}/{repo}/commits"),
  "github:get-commit": gitHubRest("GET /repos/{owner}/{repo}/commits/{ref}"),
  "github:compare-commits": gitHubRest(
    "GET /repos/{owner}/{repo}/compare/{base}...{head}",
  ),
  "github:create-gist": gitHubRest("POST /gists"),
  "github:get-gist": gitHubRest("GET /gists/{gist_id}"),
  "github:list-gists": (input) => {
    const parameters = gitHubParameters(input);
    return optionalStringValue(parameters.username)
      ? gitHubRequest("GET /users/{username}/gists", input)
      : gitHubRequest("GET /gists", input);
  },
  "github:update-gist": gitHubRest("PATCH /gists/{gist_id}"),
  "github:delete-gist": gitHubRest("DELETE /gists/{gist_id}"),
  "github:fork-gist": gitHubRest("POST /gists/{gist_id}/forks"),
  "github:star-gist": gitHubRest("PUT /gists/{gist_id}/star"),
  "github:unstar-gist": gitHubRest("DELETE /gists/{gist_id}/star"),
  "github:fork-repository": gitHubRest("POST /repos/{owner}/{repo}/forks"),
  "github:list-forks": gitHubRest("GET /repos/{owner}/{repo}/forks"),
  "github:create-milestone": gitHubRest(
    "POST /repos/{owner}/{repo}/milestones",
  ),
  "github:get-milestone": gitHubRest(
    "GET /repos/{owner}/{repo}/milestones/{milestone_number}",
  ),
  "github:list-milestones": gitHubRest("GET /repos/{owner}/{repo}/milestones"),
  "github:update-milestone": gitHubRest(
    "PATCH /repos/{owner}/{repo}/milestones/{milestone_number}",
  ),
  "github:delete-milestone": gitHubRest(
    "DELETE /repos/{owner}/{repo}/milestones/{milestone_number}",
  ),
  "github:add-issue-reaction": gitHubRest(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/reactions",
  ),
  "github:remove-issue-reaction": gitHubRest(
    "DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}",
  ),
  "github:add-comment-reaction": gitHubRest(
    "POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions",
  ),
  "github:remove-comment-reaction": gitHubRest(
    "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}",
  ),
  "github:star-repository": gitHubRest("PUT /user/starred/{owner}/{repo}"),
  "github:unstar-repository": gitHubRest("DELETE /user/starred/{owner}/{repo}"),
  "github:check-if-starred": gitHubRest("GET /user/starred/{owner}/{repo}"),
  "github:list-stargazers": gitHubRest("GET /repos/{owner}/{repo}/stargazers"),
};

function assertGitHubOperationCoverage(): void {
  const expected = new Set(GITHUB_OPERATION_IDS);
  const implemented = Object.keys(GITHUB_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("GitHub provider SDK operation coverage is incomplete.");
  }
}

/**
 * All pinned GitHub actions, executed through Octokit. A GitHub token is
 * decrypted only while this package constructs its short-lived SDK client.
 */
export function createGitHubProviderSdk(
  config: GitHubProviderSdkConfig,
): IntegrationProviderSdk {
  assertGitHubOperationCoverage();
  const clientFactory = config.clientFactory ?? createGitHubClient;
  return {
    integrationId: "github",
    operationIds: GITHUB_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "github" ||
        invocation.reference.integrationId !== "github"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = GITHUB_OPERATION_REQUESTS[invocation.operationId];
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
          output: (
            await clientFactory(credential.apiKey).request(
              request.route,
              request.parameters,
            )
          ).data,
        }),
      );
    },
  };
}

export function getGitHubProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGitHubOperationCoverage();
  return {
    operations: GITHUB_OPERATION_IDS.length,
    operationIds: GITHUB_OPERATION_IDS,
  };
}
