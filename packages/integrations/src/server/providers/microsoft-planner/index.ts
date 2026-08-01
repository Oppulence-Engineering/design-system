import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  requiredInputString,
} from "../shared/sdk";
import {
  createMicrosoftGraphPack,
  createMicrosoftGraphProviderSdk,
  graphSegment,
  optionalGraphSegment,
  type MicrosoftGraphClientFactory,
  type MicrosoftGraphOperation,
} from "../shared/clients/microsoft-graph";
import {
  graphCollectionQuery,
  graphEntityQuery,
} from "../shared/clients/microsoft-graph-query";

type GraphInput = Readonly<Record<string, unknown>>;

/**
 * Planner requires an If-Match ETag on every update and delete. The client
 * builder carries it as a header, and a caller that omits it gets a clear
 * invocation error instead of a 412 from the provider.
 */
function etagHeader(input: GraphInput): Record<string, string> {
  const etag = optionalInputString(input, "etag", "ifMatch", "@odata.etag");
  if (!etag) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return { "If-Match": etag };
}

function taskBody(input: GraphInput, mode: "create" | "update"): unknown {
  const body = definedFields({
    title: optionalInputString(input, "title"),
    planId: optionalInputString(input, "planId"),
    bucketId: optionalInputString(input, "bucketId"),
    dueDateTime: optionalInputString(input, "dueDateTime", "dueDate"),
    startDateTime: optionalInputString(input, "startDateTime", "startDate"),
    percentComplete: optionalInputNumber(input, "percentComplete"),
    priority: optionalInputNumber(input, "priority"),
    assignments: optionalInputRecord(input, "assignments"),
    appliedCategories: optionalInputRecord(input, "appliedCategories"),
  });
  if (mode === "create") {
    return {
      ...body,
      planId: requiredInputString(input, "planId"),
      title: requiredInputString(input, "title"),
    };
  }
  return body;
}

const PLANNER_OPERATIONS: Readonly<Record<string, MicrosoftGraphOperation>> = {
  "microsoft-planner:read-task": {
    method: "GET",
    path: (input) => {
      const taskId = optionalGraphSegment(input, "taskId");
      if (taskId) return `/planner/tasks/${taskId}`;
      const planId = optionalGraphSegment(input, "planId");
      if (planId) return `/planner/plans/${planId}/tasks`;
      const bucketId = optionalGraphSegment(input, "bucketId");
      if (bucketId) return `/planner/buckets/${bucketId}/tasks`;
      return "/me/planner/tasks";
    },
    query: (input) =>
      optionalInputString(input, "taskId")
        ? graphEntityQuery(input)
        : graphCollectionQuery(input),
  },
  "microsoft-planner:create-task": {
    method: "POST",
    path: () => "/planner/tasks",
    body: (input) => taskBody(input, "create"),
  },
  "microsoft-planner:update-task": {
    method: "PATCH",
    path: (input) => `/planner/tasks/${graphSegment(input, "taskId")}`,
    headers: etagHeader,
    body: (input) => taskBody(input, "update"),
  },
  "microsoft-planner:delete-task": {
    method: "DELETE",
    path: (input) => `/planner/tasks/${graphSegment(input, "taskId")}`,
    headers: etagHeader,
  },
  "microsoft-planner:get-task-details": {
    method: "GET",
    path: (input) => `/planner/tasks/${graphSegment(input, "taskId")}/details`,
    query: graphEntityQuery,
  },
  "microsoft-planner:update-task-details": {
    method: "PATCH",
    path: (input) => `/planner/tasks/${graphSegment(input, "taskId")}/details`,
    headers: etagHeader,
    body: (input) =>
      definedFields({
        description: optionalInputString(input, "description"),
        previewType: optionalInputString(input, "previewType"),
        references: optionalInputRecord(input, "references"),
        checklist: optionalInputRecord(input, "checklist"),
      }),
  },
  "microsoft-planner:list-plans": {
    method: "GET",
    path: (input) => {
      const groupId = optionalGraphSegment(input, "groupId");
      return groupId ? `/groups/${groupId}/planner/plans` : "/me/planner/plans";
    },
    query: graphCollectionQuery,
  },
  "microsoft-planner:read-plan": {
    method: "GET",
    path: (input) => `/planner/plans/${graphSegment(input, "planId")}`,
    query: graphEntityQuery,
  },
  "microsoft-planner:create-plan": {
    method: "POST",
    path: () => "/planner/plans",
    body: (input) => ({
      owner: requiredInputString(input, "groupId", "owner"),
      title: requiredInputString(input, "title"),
    }),
  },
  "microsoft-planner:update-plan": {
    method: "PATCH",
    path: (input) => `/planner/plans/${graphSegment(input, "planId")}`,
    headers: etagHeader,
    body: (input) =>
      definedFields({ title: optionalInputString(input, "title") }),
  },
  "microsoft-planner:delete-plan": {
    method: "DELETE",
    path: (input) => `/planner/plans/${graphSegment(input, "planId")}`,
    headers: etagHeader,
  },
  "microsoft-planner:get-plan-details": {
    method: "GET",
    path: (input) => `/planner/plans/${graphSegment(input, "planId")}/details`,
    query: graphEntityQuery,
  },
  "microsoft-planner:update-plan-details": {
    method: "PATCH",
    path: (input) => `/planner/plans/${graphSegment(input, "planId")}/details`,
    headers: etagHeader,
    body: (input) =>
      definedFields({
        categoryDescriptions: optionalInputRecord(
          input,
          "categoryDescriptions",
        ),
        sharedWith: optionalInputRecord(input, "sharedWith"),
      }),
  },
  "microsoft-planner:list-buckets": {
    method: "GET",
    path: (input) => {
      const planId = optionalGraphSegment(input, "planId");
      return planId ? `/planner/plans/${planId}/buckets` : "/planner/buckets";
    },
    query: graphCollectionQuery,
  },
  "microsoft-planner:read-bucket": {
    method: "GET",
    path: (input) => `/planner/buckets/${graphSegment(input, "bucketId")}`,
    query: graphEntityQuery,
  },
  "microsoft-planner:create-bucket": {
    method: "POST",
    path: () => "/planner/buckets",
    body: (input) =>
      definedFields({
        name: requiredInputString(input, "name", "bucketName"),
        planId: requiredInputString(input, "planId"),
        orderHint: optionalInputString(input, "orderHint") ?? " !",
      }),
  },
  "microsoft-planner:update-bucket": {
    method: "PATCH",
    path: (input) => `/planner/buckets/${graphSegment(input, "bucketId")}`,
    headers: etagHeader,
    body: (input) =>
      definedFields({
        name: optionalInputString(input, "name", "bucketName"),
        orderHint: optionalInputString(input, "orderHint"),
      }),
  },
  "microsoft-planner:delete-bucket": {
    method: "DELETE",
    path: (input) => `/planner/buckets/${graphSegment(input, "bucketId")}`,
    headers: etagHeader,
  },
};

export interface MicrosoftPlannerProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: MicrosoftGraphClientFactory;
}

/** Executes the pinned Planner plan, bucket, and task actions through Graph. */
export function createMicrosoftPlannerProviderSdk(
  config: MicrosoftPlannerProviderSdkConfig,
): IntegrationProviderSdk {
  return createMicrosoftGraphProviderSdk({
    integrationId: "microsoft-planner",
    operations: PLANNER_OPERATIONS,
    oauthRuntime: config.oauthRuntime,
    ...(config.clientFactory ? { clientFactory: config.clientFactory } : {}),
  });
}

export function createMicrosoftPlannerPack(): IntegrationProviderPack {
  return createMicrosoftGraphPack({
    integrationId: "microsoft-planner",
    operations: PLANNER_OPERATIONS,
    triggerCoverage: [],
  });
}

export function getMicrosoftPlannerProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  const operationIds = Object.keys(PLANNER_OPERATIONS);
  return { operations: operationIds.length, operationIds };
}
