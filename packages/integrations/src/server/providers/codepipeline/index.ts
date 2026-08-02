import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputBoolean,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputNumber,
  requiredInputString,
  requiredInputStringArray,
} from "../shared/sdk";
import { createAwsPack, type AwsOperation } from "../shared/clients/aws";

type AwsInput = Readonly<Record<string, unknown>>;

/** Stage transitions differ only in direction. */
function stageTransition(i: AwsInput): Record<string, unknown> {
  return {
    pipelineName: requiredInputString(i, "pipelineName"),
    stageName: requiredInputString(i, "stageName"),
    transitionType: optionalInputString(i, "transitionType") ?? "Inbound",
  };
}

const CODEPIPELINE_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "codepipeline:start-execution": {
    command: "StartPipelineExecutionCommand",
    input: (i) =>
      definedFields({
        name: requiredInputString(i, "pipelineName", "name"),
        clientRequestToken: optionalInputString(i, "clientRequestToken"),
      }),
  },
  "codepipeline:get-pipeline-state": {
    command: "GetPipelineStateCommand",
    input: (i) => ({ name: requiredInputString(i, "pipelineName", "name") }),
  },
  "codepipeline:get-pipeline-structure": {
    command: "GetPipelineCommand",
    input: (i) =>
      definedFields({
        name: requiredInputString(i, "pipelineName", "name"),
        version: optionalInputNumber(i, "version"),
      }),
  },
  "codepipeline:list-pipelines": {
    command: "ListPipelinesCommand",
    input: (i) =>
      definedFields({
        maxResults: optionalInputNumber(i, "maxResults", "limit"),
        nextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "codepipeline:list-executions": {
    command: "ListPipelineExecutionsCommand",
    input: (i) =>
      definedFields({
        pipelineName: requiredInputString(i, "pipelineName"),
        maxResults: optionalInputNumber(i, "maxResults", "limit"),
        nextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "codepipeline:list-action-executions": {
    command: "ListActionExecutionsCommand",
    input: (i) =>
      definedFields({
        pipelineName: requiredInputString(i, "pipelineName"),
        filter: optionalInputString(i, "pipelineExecutionId")
          ? {
              pipelineExecutionId: optionalInputString(
                i,
                "pipelineExecutionId",
              ),
            }
          : undefined,
        maxResults: optionalInputNumber(i, "maxResults", "limit"),
        nextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "codepipeline:get-execution": {
    command: "GetPipelineExecutionCommand",
    input: (i) => ({
      pipelineName: requiredInputString(i, "pipelineName"),
      pipelineExecutionId: requiredInputString(i, "pipelineExecutionId"),
    }),
  },
  "codepipeline:stop-execution": {
    command: "StopPipelineExecutionCommand",
    input: (i) =>
      definedFields({
        pipelineName: requiredInputString(i, "pipelineName"),
        pipelineExecutionId: requiredInputString(i, "pipelineExecutionId"),
        abandon: optionalInputBoolean(i, "abandon"),
        reason: optionalInputString(i, "reason"),
      }),
  },
  "codepipeline:retry-stage": {
    command: "RetryStageExecutionCommand",
    input: (i) => ({
      pipelineName: requiredInputString(i, "pipelineName"),
      stageName: requiredInputString(i, "stageName"),
      pipelineExecutionId: requiredInputString(i, "pipelineExecutionId"),
      retryMode: optionalInputString(i, "retryMode") ?? "FAILED_ACTIONS",
    }),
  },
  "codepipeline:approve-reject-approval": {
    command: "PutApprovalResultCommand",
    input: (i) => ({
      pipelineName: requiredInputString(i, "pipelineName"),
      stageName: requiredInputString(i, "stageName"),
      actionName: requiredInputString(i, "actionName"),
      token: requiredInputString(i, "token"),
      result: {
        status: requiredInputString(i, "status"),
        summary: optionalInputString(i, "summary") ?? "",
      },
    }),
  },
  "codepipeline:disable-stage-transition": {
    command: "DisableStageTransitionCommand",
    input: (i) => ({
      ...stageTransition(i),
      reason:
        optionalInputString(i, "reason") ??
        "Disabled through the Oppulence integration.",
    }),
    output: (_v, i) => ({
      pipelineName: requiredInputString(i, "pipelineName"),
      stageName: requiredInputString(i, "stageName"),
      enabled: false,
    }),
  },
  "codepipeline:enable-stage-transition": {
    command: "EnableStageTransitionCommand",
    input: stageTransition,
    output: (_v, i) => ({
      pipelineName: requiredInputString(i, "pipelineName"),
      stageName: requiredInputString(i, "stageName"),
      enabled: true,
    }),
  },
};

export function createCodePipelinePack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "codepipeline",
    packageName: "@aws-sdk/client-codepipeline",
    clientExport: "CodePipelineClient",
    operations: CODEPIPELINE_OPERATIONS,
  });
}
