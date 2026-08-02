import { google } from "googleapis";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputBoolean,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
  sdkResponseData,
} from "../shared/sdk";

type GoogleTasksSdkClient = Record<string, unknown>;

type GoogleTasksClientFactory = (accessToken: string) => GoogleTasksSdkClient;

export interface GoogleTasksProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleTasksClientFactory;
}

function createGoogleTasksClient(accessToken: string): GoogleTasksSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return { tasks: google.tasks({ version: "v1", auth }) };
}

const GOOGLE_TASKS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-tasks",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleTasksSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleTasksRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleTasksSdkRequest {
  return { path, arguments: [definedFields(request)] };
}

function googleTasksTasklist(input: Readonly<Record<string, unknown>>): string {
  return optionalInputString(input, "taskListId") ?? "@default";
}

function googleTasksStatus(
  input: Readonly<Record<string, unknown>>,
): "needsAction" | "completed" | undefined {
  const status = optionalInputString(input, "status");
  if (
    status !== undefined &&
    status !== "needsAction" &&
    status !== "completed"
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return status;
}

function googleTasksBody(
  input: Readonly<Record<string, unknown>>,
  requireTitle: boolean,
): Record<string, unknown> {
  const title = optionalInputString(input, "title");
  if (requireTitle && !title) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const body = definedFields({
    title,
    notes: optionalInputString(input, "notes"),
    due: optionalInputString(input, "due"),
    status: googleTasksStatus(input),
  });
  if (!requireTitle && !Object.keys(body).length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return body;
}

const GOOGLE_TASKS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleTasksSdkRequest
  >
> = {
  "google-tasks:create-task": (input) =>
    googleTasksRequest(["tasks", "tasks", "insert"], {
      tasklist: googleTasksTasklist(input),
      parent: optionalInputString(input, "parent"),
      previous: optionalInputString(input, "previous"),
      requestBody: googleTasksBody(input, true),
    }),
  "google-tasks:list-tasks": (input) =>
    googleTasksRequest(["tasks", "tasks", "list"], {
      tasklist: googleTasksTasklist(input),
      maxResults: optionalInputNumber(input, "maxResults"),
      pageToken: optionalInputString(input, "pageToken"),
      showCompleted: optionalInputBoolean(input, "showCompleted"),
      showDeleted: optionalInputBoolean(input, "showDeleted"),
      showHidden: optionalInputBoolean(input, "showHidden"),
      dueMin: optionalInputString(input, "dueMin"),
      dueMax: optionalInputString(input, "dueMax"),
      completedMin: optionalInputString(input, "completedMin"),
      completedMax: optionalInputString(input, "completedMax"),
      updatedMin: optionalInputString(input, "updatedMin"),
    }),
  "google-tasks:get-task": (input) =>
    googleTasksRequest(["tasks", "tasks", "get"], {
      tasklist: googleTasksTasklist(input),
      task: requiredInputString(input, "taskId"),
    }),
  "google-tasks:update-task": (input) =>
    googleTasksRequest(["tasks", "tasks", "update"], {
      tasklist: googleTasksTasklist(input),
      task: requiredInputString(input, "taskId"),
      requestBody: googleTasksBody(input, false),
    }),
  "google-tasks:delete-task": (input) =>
    googleTasksRequest(["tasks", "tasks", "delete"], {
      tasklist: googleTasksTasklist(input),
      task: requiredInputString(input, "taskId"),
    }),
  "google-tasks:list-task-lists": (input) =>
    googleTasksRequest(["tasks", "tasklists", "list"], {
      maxResults: optionalInputNumber(input, "maxResults"),
      pageToken: optionalInputString(input, "pageToken"),
    }),
};

function assertGoogleTasksOperationCoverage(): void {
  const expected = new Set(GOOGLE_TASKS_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_TASKS_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Tasks provider SDK operation coverage is incomplete.",
    );
  }
}

/** All pinned Google Tasks actions use Google's official Node.js SDK. */
export function createGoogleTasksProviderSdk(
  config: GoogleTasksProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleTasksOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleTasksClient;
  return {
    integrationId: "google-tasks",
    operationIds: GOOGLE_TASKS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-tasks" ||
        invocation.reference.integrationId !== "google-tasks"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_TASKS_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: sdkResponseData(
            await invokeSdkMethod(
              clientFactory(credential.accessToken),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getGoogleTasksProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleTasksOperationCoverage();
  return {
    operations: GOOGLE_TASKS_OPERATION_IDS.length,
    operationIds: GOOGLE_TASKS_OPERATION_IDS,
  };
}
