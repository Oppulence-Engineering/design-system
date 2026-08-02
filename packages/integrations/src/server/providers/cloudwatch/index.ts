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
