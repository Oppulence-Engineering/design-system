import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputBoolean,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputRecord,
  requiredInputString,
  requiredInputStringArray,
} from "../shared/sdk";
import { createAwsPack, type AwsOperation } from "../shared/clients/aws";

type AwsInput = Readonly<Record<string, unknown>>;

function bucket(input: AwsInput): string {
  return requiredInputString(input, "bucket", "bucketName");
}

function objectKey(input: AwsInput): string {
  return requiredInputString(input, "key", "objectKey");
}

/**
 * Amazon RDS's source actions are all data operations, which the RDS Data API
 * serves; @aws-sdk/client-rds manages instances and cannot run SQL.
 */
function rdsStatement(i: AwsInput, sql: string): Record<string, unknown> {
  return definedFields({
    resourceArn: requiredInputString(i, "resourceArn", "clusterArn"),
    secretArn: requiredInputString(i, "secretArn"),
    database: optionalInputString(i, "database"),
    sql,
    parameters: optionalInputStringArray(i, "parameterNames")
      ? undefined
      : (optionalInputRecord(i, "parameters") as unknown),
    includeResultMetadata: true,
  });
}

const RDS_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "amazon-rds:query-select": {
    command: "ExecuteStatementCommand",
    input: (i) => rdsStatement(i, requiredInputString(i, "sql", "query")),
  },
  "amazon-rds:execute-raw-sql": {
    command: "ExecuteStatementCommand",
    input: (i) => rdsStatement(i, requiredInputString(i, "sql", "query")),
  },
  "amazon-rds:insert-data": {
    command: "ExecuteStatementCommand",
    input: (i) => rdsStatement(i, requiredInputString(i, "sql", "query")),
  },
  "amazon-rds:update-data": {
    command: "ExecuteStatementCommand",
    input: (i) => rdsStatement(i, requiredInputString(i, "sql", "query")),
  },
  "amazon-rds:delete-data": {
    command: "ExecuteStatementCommand",
    input: (i) => rdsStatement(i, requiredInputString(i, "sql", "query")),
  },
  "amazon-rds:introspect-schema": {
    command: "ExecuteStatementCommand",
    input: (i) =>
      rdsStatement(
        i,
        "SELECT table_schema, table_name, column_name, data_type, is_nullable FROM information_schema.columns ORDER BY table_schema, table_name, ordinal_position",
      ),
  },
};

export function createRdsPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "amazon-rds",
    packageName: "@aws-sdk/client-rds-data",
    clientExport: "RDSDataClient",
    operations: RDS_OPERATIONS,
  });
}
