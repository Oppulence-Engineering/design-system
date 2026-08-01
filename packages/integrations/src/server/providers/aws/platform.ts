import type { IntegrationProviderPack } from "../../provider-pack";
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
} from "../shared";
import { createAwsPack, type AwsOperation } from "./client";

type AwsInput = Readonly<Record<string, unknown>>;

const APPCONFIG_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "aws-appconfig:get-configuration": {
    command: "GetConfigurationCommand",
    input: (i) => ({
      Application: requiredInputString(i, "applicationId", "application"),
      Environment: requiredInputString(i, "environmentId", "environment"),
      Configuration: requiredInputString(i, "configurationProfileId"),
      ClientId: requiredInputString(i, "clientId"),
    }),
  },
  "aws-appconfig:list-applications": {
    command: "ListApplicationsCommand",
    input: (i) =>
      definedFields({
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-appconfig:create-application": {
    command: "CreateApplicationCommand",
    input: (i) =>
      definedFields({
        Name: requiredInputString(i, "name"),
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:get-application": {
    command: "GetApplicationCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
    }),
  },
  "aws-appconfig:update-application": {
    command: "UpdateApplicationCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        Name: optionalInputString(i, "name"),
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:delete-application": {
    command: "DeleteApplicationCommand",
    input: (i) => ({ ApplicationId: requiredInputString(i, "applicationId") }),
    output: (_v, i) => ({
      applicationId: requiredInputString(i, "applicationId"),
      deleted: true,
    }),
  },
  "aws-appconfig:list-environments": {
    command: "ListEnvironmentsCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-appconfig:create-environment": {
    command: "CreateEnvironmentCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        Name: requiredInputString(i, "name"),
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:get-environment": {
    command: "GetEnvironmentCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      EnvironmentId: requiredInputString(i, "environmentId"),
    }),
  },
  "aws-appconfig:update-environment": {
    command: "UpdateEnvironmentCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        EnvironmentId: requiredInputString(i, "environmentId"),
        Name: optionalInputString(i, "name"),
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:delete-environment": {
    command: "DeleteEnvironmentCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      EnvironmentId: requiredInputString(i, "environmentId"),
    }),
    output: (_v, i) => ({
      environmentId: requiredInputString(i, "environmentId"),
      deleted: true,
    }),
  },
  "aws-appconfig:list-configuration-profiles": {
    command: "ListConfigurationProfilesCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-appconfig:create-configuration-profile": {
    command: "CreateConfigurationProfileCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        Name: requiredInputString(i, "name"),
        LocationUri: requiredInputString(i, "locationUri"),
        Description: optionalInputString(i, "description"),
        RetrievalRoleArn: optionalInputString(i, "retrievalRoleArn"),
      }),
  },
  "aws-appconfig:get-configuration-profile": {
    command: "GetConfigurationProfileCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      ConfigurationProfileId: requiredInputString(i, "configurationProfileId"),
    }),
  },
  "aws-appconfig:update-configuration-profile": {
    command: "UpdateConfigurationProfileCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        ConfigurationProfileId: requiredInputString(
          i,
          "configurationProfileId",
        ),
        Name: optionalInputString(i, "name"),
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:delete-configuration-profile": {
    command: "DeleteConfigurationProfileCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      ConfigurationProfileId: requiredInputString(i, "configurationProfileId"),
    }),
    output: (_v, i) => ({
      configurationProfileId: requiredInputString(i, "configurationProfileId"),
      deleted: true,
    }),
  },
  "aws-appconfig:create-hosted-configuration-version": {
    command: "CreateHostedConfigurationVersionCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        ConfigurationProfileId: requiredInputString(
          i,
          "configurationProfileId",
        ),
        Content: requiredInputString(i, "content"),
        ContentType:
          optionalInputString(i, "contentType") ?? "application/json",
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:get-hosted-configuration-version": {
    command: "GetHostedConfigurationVersionCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      ConfigurationProfileId: requiredInputString(i, "configurationProfileId"),
      VersionNumber: requiredInputNumber(i, "versionNumber"),
    }),
  },
  "aws-appconfig:list-hosted-configuration-versions": {
    command: "ListHostedConfigurationVersionsCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        ConfigurationProfileId: requiredInputString(
          i,
          "configurationProfileId",
        ),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-appconfig:delete-hosted-configuration-version": {
    command: "DeleteHostedConfigurationVersionCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      ConfigurationProfileId: requiredInputString(i, "configurationProfileId"),
      VersionNumber: requiredInputNumber(i, "versionNumber"),
    }),
    output: (_v, i) => ({
      versionNumber: requiredInputNumber(i, "versionNumber"),
      deleted: true,
    }),
  },
  "aws-appconfig:list-deployment-strategies": {
    command: "ListDeploymentStrategiesCommand",
    input: (i) =>
      definedFields({
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-appconfig:start-deployment": {
    command: "StartDeploymentCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        EnvironmentId: requiredInputString(i, "environmentId"),
        DeploymentStrategyId: requiredInputString(i, "deploymentStrategyId"),
        ConfigurationProfileId: requiredInputString(
          i,
          "configurationProfileId",
        ),
        ConfigurationVersion: requiredInputString(i, "configurationVersion"),
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:get-deployment": {
    command: "GetDeploymentCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      EnvironmentId: requiredInputString(i, "environmentId"),
      DeploymentNumber: requiredInputNumber(i, "deploymentNumber"),
    }),
  },
  "aws-appconfig:list-deployments": {
    command: "ListDeploymentsCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        EnvironmentId: requiredInputString(i, "environmentId"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-appconfig:stop-deployment": {
    command: "StopDeploymentCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      EnvironmentId: requiredInputString(i, "environmentId"),
      DeploymentNumber: requiredInputNumber(i, "deploymentNumber"),
    }),
  },
};

export function createAppConfigPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "aws-appconfig",
    packageName: "@aws-sdk/client-appconfig",
    clientExport: "AppConfigClient",
    operations: APPCONFIG_OPERATIONS,
  });
}

const ATHENA_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "athena:start-query": {
    command: "StartQueryExecutionCommand",
    input: (i) =>
      definedFields({
        QueryString: requiredInputString(i, "query", "queryString", "sql"),
        WorkGroup: optionalInputString(i, "workGroup"),
        QueryExecutionContext: definedFields({
          Database: optionalInputString(i, "database"),
          Catalog: optionalInputString(i, "catalog"),
        }),
        ResultConfiguration: optionalInputString(i, "outputLocation")
          ? { OutputLocation: optionalInputString(i, "outputLocation") }
          : undefined,
      }),
  },
  "athena:get-query-execution": {
    command: "GetQueryExecutionCommand",
    input: (i) => ({
      QueryExecutionId: requiredInputString(i, "queryExecutionId"),
    }),
  },
  "athena:get-query-results": {
    command: "GetQueryResultsCommand",
    input: (i) =>
      definedFields({
        QueryExecutionId: requiredInputString(i, "queryExecutionId"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "athena:stop-query": {
    command: "StopQueryExecutionCommand",
    input: (i) => ({
      QueryExecutionId: requiredInputString(i, "queryExecutionId"),
    }),
    output: (_v, i) => ({
      queryExecutionId: requiredInputString(i, "queryExecutionId"),
      stopped: true,
    }),
  },
  "athena:list-query-executions": {
    command: "ListQueryExecutionsCommand",
    input: (i) =>
      definedFields({
        WorkGroup: optionalInputString(i, "workGroup"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "athena:batch-get-query-executions": {
    command: "BatchGetQueryExecutionCommand",
    input: (i) => ({
      QueryExecutionIds: requiredInputStringArray(i, "queryExecutionIds"),
    }),
  },
  "athena:create-named-query": {
    command: "CreateNamedQueryCommand",
    input: (i) =>
      definedFields({
        Name: requiredInputString(i, "name"),
        Database: requiredInputString(i, "database"),
        QueryString: requiredInputString(i, "query", "queryString", "sql"),
        Description: optionalInputString(i, "description"),
        WorkGroup: optionalInputString(i, "workGroup"),
      }),
  },
  "athena:get-named-query": {
    command: "GetNamedQueryCommand",
    input: (i) => ({ NamedQueryId: requiredInputString(i, "namedQueryId") }),
  },
  "athena:list-named-queries": {
    command: "ListNamedQueriesCommand",
    input: (i) =>
      definedFields({
        WorkGroup: optionalInputString(i, "workGroup"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "athena:delete-named-query": {
    command: "DeleteNamedQueryCommand",
    input: (i) => ({ NamedQueryId: requiredInputString(i, "namedQueryId") }),
    output: (_v, i) => ({
      namedQueryId: requiredInputString(i, "namedQueryId"),
      deleted: true,
    }),
  },
  "athena:list-databases": {
    command: "ListDatabasesCommand",
    input: (i) =>
      definedFields({
        CatalogName:
          optionalInputString(i, "catalog", "catalogName") ?? "AwsDataCatalog",
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "athena:list-table-metadata": {
    command: "ListTableMetadataCommand",
    input: (i) =>
      definedFields({
        CatalogName:
          optionalInputString(i, "catalog", "catalogName") ?? "AwsDataCatalog",
        DatabaseName: requiredInputString(i, "database", "databaseName"),
        Expression: optionalInputString(i, "expression"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
};

export function createAthenaPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "athena",
    packageName: "@aws-sdk/client-athena",
    clientExport: "AthenaClient",
    operations: ATHENA_OPERATIONS,
  });
}

const CLOUDWATCH_LOGS = {
  packageName: "@aws-sdk/client-cloudwatch-logs",
  clientExport: "CloudWatchLogsClient",
} as const;

/** Alarm actions differ only in the state they set. */
function alarmState(
  i: AwsInput,
  value: "ALARM" | "OK",
): Record<string, unknown> {
  return {
    AlarmName: requiredInputString(i, "alarmName"),
    StateValue: value,
    StateReason:
      optionalInputString(i, "reason", "stateReason") ??
      "Set through the Oppulence integration.",
  };
}

/** CloudWatch splits between the metrics service and the Logs service. */
const CLOUDWATCH_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "cloudwatch:query-logs-insights": {
    module: CLOUDWATCH_LOGS,
    command: "StartQueryCommand",
    input: (i) =>
      definedFields({
        logGroupNames: requiredInputStringArray(
          i,
          "logGroupNames",
          "logGroups",
        ),
        queryString: requiredInputString(i, "query", "queryString"),
        startTime: requiredInputNumber(i, "startTime"),
        endTime: requiredInputNumber(i, "endTime"),
        limit: optionalInputNumber(i, "limit"),
      }),
  },
  "cloudwatch:filter-log-events": {
    module: CLOUDWATCH_LOGS,
    command: "FilterLogEventsCommand",
    input: (i) =>
      definedFields({
        logGroupName: requiredInputString(i, "logGroupName", "logGroup"),
        filterPattern: optionalInputString(i, "filterPattern"),
        startTime: optionalInputNumber(i, "startTime"),
        endTime: optionalInputNumber(i, "endTime"),
        limit: optionalInputNumber(i, "limit"),
        nextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "cloudwatch:describe-log-groups": {
    module: CLOUDWATCH_LOGS,
    command: "DescribeLogGroupsCommand",
    input: (i) =>
      definedFields({
        logGroupNamePrefix: optionalInputString(
          i,
          "logGroupNamePrefix",
          "prefix",
        ),
        limit: optionalInputNumber(i, "limit"),
        nextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "cloudwatch:describe-log-streams": {
    module: CLOUDWATCH_LOGS,
    command: "DescribeLogStreamsCommand",
    input: (i) =>
      definedFields({
        logGroupName: requiredInputString(i, "logGroupName", "logGroup"),
        logStreamNamePrefix: optionalInputString(i, "logStreamNamePrefix"),
        limit: optionalInputNumber(i, "limit"),
        nextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "cloudwatch:get-log-events": {
    module: CLOUDWATCH_LOGS,
    command: "GetLogEventsCommand",
    input: (i) =>
      definedFields({
        logGroupName: requiredInputString(i, "logGroupName", "logGroup"),
        logStreamName: requiredInputString(i, "logStreamName", "logStream"),
        startTime: optionalInputNumber(i, "startTime"),
        endTime: optionalInputNumber(i, "endTime"),
        limit: optionalInputNumber(i, "limit"),
        startFromHead: optionalInputBoolean(i, "startFromHead"),
      }),
  },
  "cloudwatch:set-log-group-retention": {
    module: CLOUDWATCH_LOGS,
    command: "PutRetentionPolicyCommand",
    input: (i) => ({
      logGroupName: requiredInputString(i, "logGroupName", "logGroup"),
      retentionInDays: requiredInputNumber(i, "retentionInDays"),
    }),
    output: (_v, i) => ({
      logGroupName: requiredInputString(i, "logGroupName", "logGroup"),
      retentionInDays: requiredInputNumber(i, "retentionInDays"),
    }),
  },
  "cloudwatch:list-metrics": {
    command: "ListMetricsCommand",
    input: (i) =>
      definedFields({
        Namespace: optionalInputString(i, "namespace"),
        MetricName: optionalInputString(i, "metricName"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "cloudwatch:get-metric-statistics": {
    command: "GetMetricStatisticsCommand",
    input: (i) =>
      definedFields({
        Namespace: requiredInputString(i, "namespace"),
        MetricName: requiredInputString(i, "metricName"),
        StartTime: new Date(requiredInputString(i, "startTime")),
        EndTime: new Date(requiredInputString(i, "endTime")),
        Period: requiredInputNumber(i, "period"),
        Statistics: optionalInputStringArray(i, "statistics") ?? ["Average"],
        Dimensions: Object.entries(
          optionalInputRecord(i, "dimensions") ?? {},
        ).map(([Name, Value]) => ({ Name, Value: String(Value) })),
      }),
  },
  "cloudwatch:publish-metric": {
    command: "PutMetricDataCommand",
    input: (i) => ({
      Namespace: requiredInputString(i, "namespace"),
      MetricData: [
        definedFields({
          MetricName: requiredInputString(i, "metricName"),
          Value: requiredInputNumber(i, "value"),
          Unit: optionalInputString(i, "unit"),
          Dimensions: Object.entries(
            optionalInputRecord(i, "dimensions") ?? {},
          ).map(([Name, Value]) => ({ Name, Value: String(Value) })),
        }),
      ],
    }),
    output: (_v, i) => ({
      namespace: requiredInputString(i, "namespace"),
      metricName: requiredInputString(i, "metricName"),
      published: true,
    }),
  },
  "cloudwatch:describe-alarms": {
    command: "DescribeAlarmsCommand",
    input: (i) =>
      definedFields({
        AlarmNames: optionalInputStringArray(i, "alarmNames"),
        StateValue: optionalInputString(i, "stateValue"),
        MaxRecords: optionalInputNumber(i, "maxRecords", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "cloudwatch:describe-alarm-history": {
    command: "DescribeAlarmHistoryCommand",
    input: (i) =>
      definedFields({
        AlarmName: optionalInputString(i, "alarmName"),
        HistoryItemType: optionalInputString(i, "historyItemType"),
        MaxRecords: optionalInputNumber(i, "maxRecords", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "cloudwatch:mute-alarm": {
    command: "SetAlarmStateCommand",
    input: (i) => alarmState(i, "OK"),
    output: (_v, i) => ({
      alarmName: requiredInputString(i, "alarmName"),
      muted: true,
    }),
  },
  "cloudwatch:unmute-alarm": {
    command: "SetAlarmStateCommand",
    input: (i) => alarmState(i, "ALARM"),
    output: (_v, i) => ({
      alarmName: requiredInputString(i, "alarmName"),
      muted: false,
    }),
  },
};

export function createCloudWatchPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "cloudwatch",
    packageName: "@aws-sdk/client-cloudwatch",
    clientExport: "CloudWatchClient",
    operations: CLOUDWATCH_OPERATIONS,
  });
}

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
