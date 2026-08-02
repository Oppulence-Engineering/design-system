import {
  ApiClient as AsanaApiClient,
  ProjectsApi as AsanaProjectsApi,
  SectionsApi as AsanaSectionsApi,
  StoriesApi as AsanaStoriesApi,
  TasksApi as AsanaTasksApi,
  WorkspacesApi as AsanaWorkspacesApi,
} from "asana";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  optionalInputBoolean,
  optionalInputJson,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
} from "../shared/sdk";

interface AsanaSdkClient {
  tasks: Record<
    string,
    (...arguments_: readonly unknown[]) => Promise<unknown>
  >;
  projects: Record<
    string,
    (...arguments_: readonly unknown[]) => Promise<unknown>
  >;
  sections: Record<
    string,
    (...arguments_: readonly unknown[]) => Promise<unknown>
  >;
  stories: Record<
    string,
    (...arguments_: readonly unknown[]) => Promise<unknown>
  >;
  workspaces: Record<
    string,
    (...arguments_: readonly unknown[]) => Promise<unknown>
  >;
}

type AsanaClientFactory = (accessToken: string) => AsanaSdkClient;

export interface AsanaProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: AsanaClientFactory;
}

function createAsanaClient(accessToken: string): AsanaSdkClient {
  const apiClient = new AsanaApiClient();
  apiClient.authentications.token!.accessToken = accessToken;
  return {
    tasks: new AsanaTasksApi(apiClient) as unknown as AsanaSdkClient["tasks"],
    projects: new AsanaProjectsApi(
      apiClient,
    ) as unknown as AsanaSdkClient["projects"],
    sections: new AsanaSectionsApi(
      apiClient,
    ) as unknown as AsanaSdkClient["sections"],
    stories: new AsanaStoriesApi(
      apiClient,
    ) as unknown as AsanaSdkClient["stories"],
    workspaces: new AsanaWorkspacesApi(
      apiClient,
    ) as unknown as AsanaSdkClient["workspaces"],
  };
}

const ASANA_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "asana",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

function asanaString(
  input: Readonly<Record<string, unknown>>,
  ...fields: readonly string[]
): string | undefined {
  for (const field of fields) {
    const value = optionalInputString(input, field);
    if (value) return value;
  }
  return undefined;
}

function requiredAsanaString(
  input: Readonly<Record<string, unknown>>,
  ...fields: readonly string[]
): string {
  const value = asanaString(input, ...fields);
  if (!value) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

function asanaStringArray(
  input: Readonly<Record<string, unknown>>,
  field: string,
): string[] | undefined {
  const json = optionalInputJson(input, field);
  if (json !== undefined) {
    if (
      !Array.isArray(json) ||
      !json.length ||
      json.length > 100 ||
      json.some((value) => typeof value !== "string" || !value.trim())
    ) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return json.map((value) => value.trim());
  }
  return optionalInputString(input, field)
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function asanaObject(
  input: Readonly<Record<string, unknown>>,
  field: string,
): Record<string, unknown> | undefined {
  const value = optionalInputJson(input, field);
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value as Record<string, unknown>;
}

function asanaData(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const supplied = asanaObject(input, "data");
  if (supplied) return supplied;
  const data = definedFields({
    name: optionalInputString(input, "name"),
    notes: optionalInputString(input, "notes"),
    html_notes: optionalInputString(input, "htmlNotes"),
    workspace: asanaString(input, "workspaceId", "workspaceGid", "workspace"),
    projects: asanaStringArray(input, "projects"),
    assignee: asanaString(input, "assigneeId", "assigneeGid", "assignee"),
    due_on: optionalInputString(input, "dueOn"),
    due_at: optionalInputString(input, "dueAt"),
    start_on: optionalInputString(input, "startOn"),
    start_at: optionalInputString(input, "startAt"),
    completed: optionalInputBoolean(input, "completed"),
    followers: asanaStringArray(input, "followers"),
    color: optionalInputString(input, "color"),
  });
  if (!Object.keys(data).length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return data;
}

function asanaOptions(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const supplied = asanaObject(input, "options");
  if (supplied) return supplied;
  return definedFields({
    limit: optionalInputNumber(input, "limit"),
    offset: optionalInputString(input, "offset"),
    workspace: asanaString(input, "workspaceId", "workspaceGid", "workspace"),
    team: asanaString(input, "teamId", "teamGid", "team"),
    project: asanaString(input, "projectId", "projectGid", "project"),
    section: asanaString(input, "sectionId", "sectionGid", "section"),
    assignee: asanaString(input, "assigneeId", "assigneeGid", "assignee"),
    text: optionalInputString(input, "text"),
    completed_since: optionalInputString(input, "completedSince"),
    modified_since: optionalInputString(input, "modifiedSince"),
    archived: optionalInputBoolean(input, "archived"),
    completed: optionalInputBoolean(input, "completed"),
    opt_fields: optionalInputString(input, "optFields"),
  });
}

function callAsana(
  client: AsanaSdkClient,
  resource: keyof AsanaSdkClient,
  method: string,
  ...arguments_: readonly unknown[]
): Promise<unknown> {
  const operation = client[resource][method];
  if (typeof operation !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return operation(...arguments_);
}

/** All pinned Asana actions use Asana's official generated Node SDK. */
export function createAsanaProviderSdk(
  config: AsanaProviderSdkConfig,
): IntegrationProviderSdk {
  const clientFactory = config.clientFactory ?? createAsanaClient;
  return {
    integrationId: "asana",
    operationIds: ASANA_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "asana" ||
        invocation.reference.integrationId !== "asana"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      if (!ASANA_OPERATION_IDS.includes(invocation.operationId)) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const input = invocation.input;
          const client = clientFactory(credential.accessToken);
          let output: unknown;
          switch (invocation.operationId) {
            case "asana:get-task": {
              const taskId = asanaString(input, "taskId", "taskGid");
              output = taskId
                ? await callAsana(
                    client,
                    "tasks",
                    "getTask",
                    taskId,
                    asanaOptions(input),
                  )
                : await callAsana(
                    client,
                    "tasks",
                    "getTasks",
                    asanaOptions(input),
                  );
              break;
            }
            case "asana:create-task":
              output = await callAsana(client, "tasks", "createTask", {
                data: asanaData(input),
              });
              break;
            case "asana:update-task":
              output = await callAsana(
                client,
                "tasks",
                "updateTask",
                { data: asanaData(input) },
                requiredAsanaString(input, "taskId", "taskGid"),
              );
              break;
            case "asana:get-projects":
              output = await callAsana(
                client,
                "projects",
                "getProjects",
                asanaOptions(input),
              );
              break;
            case "asana:search-tasks":
              output = await callAsana(
                client,
                "tasks",
                "searchTasksForWorkspace",
                requiredAsanaString(input, "workspaceId", "workspaceGid"),
                asanaOptions(input),
              );
              break;
            case "asana:add-comment":
              output = await callAsana(
                client,
                "stories",
                "createStoryForTask",
                {
                  data: {
                    text: requiredInputString(input, "text"),
                  },
                },
                requiredAsanaString(input, "taskId", "taskGid"),
              );
              break;
            case "asana:create-subtask":
              output = await callAsana(
                client,
                "tasks",
                "createSubtaskForTask",
                { data: asanaData(input) },
                requiredAsanaString(input, "taskId", "taskGid"),
              );
              break;
            case "asana:delete-task":
              output = await callAsana(
                client,
                "tasks",
                "deleteTask",
                requiredAsanaString(input, "taskId", "taskGid"),
              );
              break;
            case "asana:add-followers": {
              const followers = asanaStringArray(input, "followers");
              if (!followers?.length) {
                throw new IntegrationProviderSdkError(
                  "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
                );
              }
              output = await callAsana(
                client,
                "tasks",
                "addFollowersForTask",
                { data: { followers } },
                requiredAsanaString(input, "taskId", "taskGid"),
              );
              break;
            }
            case "asana:create-project":
              output = await callAsana(client, "projects", "createProject", {
                data: asanaData(input),
              });
              break;
            case "asana:get-project":
              output = await callAsana(
                client,
                "projects",
                "getProject",
                requiredAsanaString(input, "projectId", "projectGid"),
                asanaOptions(input),
              );
              break;
            case "asana:list-workspaces":
              output = await callAsana(
                client,
                "workspaces",
                "getWorkspaces",
                asanaOptions(input),
              );
              break;
            case "asana:create-section":
              output = await callAsana(
                client,
                "sections",
                "createSectionForProject",
                requiredAsanaString(input, "projectId", "projectGid"),
                { body: { data: asanaData(input) } },
              );
              break;
            case "asana:list-sections":
              output = await callAsana(
                client,
                "sections",
                "getSectionsForProject",
                requiredAsanaString(input, "projectId", "projectGid"),
                asanaOptions(input),
              );
              break;
            default:
              throw new IntegrationProviderSdkError(
                "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
              );
          }
          return { operationId: invocation.operationId, output };
        },
      );
    },
  };
}

export function getAsanaProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  return {
    operations: ASANA_OPERATION_IDS.length,
    operationIds: ASANA_OPERATION_IDS,
  };
}
