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

function stackParameters(i: AwsInput): unknown {
  const parameters = optionalInputRecord(i, "parameters");
  return parameters
    ? Object.entries(parameters).map(([ParameterKey, ParameterValue]) => ({
        ParameterKey,
        ParameterValue: String(ParameterValue),
      }))
    : undefined;
}

const CLOUDFORMATION_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "cloudformation:describe-stacks": {
    command: "DescribeStacksCommand",
    input: (i) =>
      definedFields({
        StackName: optionalInputString(i, "stackName"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "cloudformation:create-stack": {
    command: "CreateStackCommand",
    input: (i) =>
      definedFields({
        StackName: requiredInputString(i, "stackName"),
        TemplateBody: optionalInputString(i, "templateBody"),
        TemplateURL: optionalInputString(i, "templateUrl"),
        Parameters: stackParameters(i),
        Capabilities: optionalInputStringArray(i, "capabilities"),
        RoleARN: optionalInputString(i, "roleArn"),
      }),
  },
  "cloudformation:update-stack": {
    command: "UpdateStackCommand",
    input: (i) =>
      definedFields({
        StackName: requiredInputString(i, "stackName"),
        TemplateBody: optionalInputString(i, "templateBody"),
        TemplateURL: optionalInputString(i, "templateUrl"),
        UsePreviousTemplate: optionalInputBoolean(i, "usePreviousTemplate"),
        Parameters: stackParameters(i),
        Capabilities: optionalInputStringArray(i, "capabilities"),
      }),
  },
  "cloudformation:delete-stack": {
    command: "DeleteStackCommand",
    input: (i) =>
      definedFields({
        StackName: requiredInputString(i, "stackName"),
        RetainResources: optionalInputStringArray(i, "retainResources"),
      }),
    output: (_v, i) => ({
      stackName: requiredInputString(i, "stackName"),
      deleting: true,
    }),
  },
  "cloudformation:cancel-update-stack": {
    command: "CancelUpdateStackCommand",
    input: (i) => ({ StackName: requiredInputString(i, "stackName") }),
    output: (_v, i) => ({
      stackName: requiredInputString(i, "stackName"),
      cancelled: true,
    }),
  },
  "cloudformation:create-change-set": {
    command: "CreateChangeSetCommand",
    input: (i) =>
      definedFields({
        StackName: requiredInputString(i, "stackName"),
        ChangeSetName: requiredInputString(i, "changeSetName"),
        TemplateBody: optionalInputString(i, "templateBody"),
        TemplateURL: optionalInputString(i, "templateUrl"),
        Parameters: stackParameters(i),
        Capabilities: optionalInputStringArray(i, "capabilities"),
        ChangeSetType: optionalInputString(i, "changeSetType"),
      }),
  },
  "cloudformation:describe-change-set": {
    command: "DescribeChangeSetCommand",
    input: (i) =>
      definedFields({
        ChangeSetName: requiredInputString(i, "changeSetName"),
        StackName: optionalInputString(i, "stackName"),
      }),
  },
  "cloudformation:execute-change-set": {
    command: "ExecuteChangeSetCommand",
    input: (i) =>
      definedFields({
        ChangeSetName: requiredInputString(i, "changeSetName"),
        StackName: optionalInputString(i, "stackName"),
      }),
    output: (_v, i) => ({
      changeSetName: requiredInputString(i, "changeSetName"),
      executing: true,
    }),
  },
  "cloudformation:list-stack-resources": {
    command: "ListStackResourcesCommand",
    input: (i) =>
      definedFields({
        StackName: requiredInputString(i, "stackName"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "cloudformation:describe-stack-events": {
    command: "DescribeStackEventsCommand",
    input: (i) =>
      definedFields({
        StackName: requiredInputString(i, "stackName"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "cloudformation:detect-stack-drift": {
    command: "DetectStackDriftCommand",
    input: (i) => ({ StackName: requiredInputString(i, "stackName") }),
  },
  "cloudformation:drift-detection-status": {
    command: "DescribeStackDriftDetectionStatusCommand",
    input: (i) => ({
      StackDriftDetectionId: requiredInputString(i, "stackDriftDetectionId"),
    }),
  },
  "cloudformation:get-template": {
    command: "GetTemplateCommand",
    input: (i) =>
      definedFields({
        StackName: optionalInputString(i, "stackName"),
        ChangeSetName: optionalInputString(i, "changeSetName"),
        TemplateStage: optionalInputString(i, "templateStage"),
      }),
  },
  "cloudformation:get-template-summary": {
    command: "GetTemplateSummaryCommand",
    input: (i) =>
      definedFields({
        StackName: optionalInputString(i, "stackName"),
        TemplateBody: optionalInputString(i, "templateBody"),
        TemplateURL: optionalInputString(i, "templateUrl"),
      }),
  },
  "cloudformation:validate-template": {
    command: "ValidateTemplateCommand",
    input: (i) =>
      definedFields({
        TemplateBody: optionalInputString(i, "templateBody"),
        TemplateURL: optionalInputString(i, "templateUrl"),
      }),
  },
};

export function createCloudFormationPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "cloudformation",
    packageName: "@aws-sdk/client-cloudformation",
    clientExport: "CloudFormationClient",
    operations: CLOUDFORMATION_OPERATIONS,
  });
}
