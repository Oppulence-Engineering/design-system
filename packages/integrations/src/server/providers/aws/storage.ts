import type { IntegrationProviderPack } from "../../provider-pack";
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
} from "../shared";
import { createAwsPack, type AwsOperation } from "./client";

type AwsInput = Readonly<Record<string, unknown>>;

function bucket(input: AwsInput): string {
  return requiredInputString(input, "bucket", "bucketName");
}

function objectKey(input: AwsInput): string {
  return requiredInputString(input, "key", "objectKey");
}

const S3_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "s3:list-buckets": { command: "ListBucketsCommand" },
  "s3:create-bucket": {
    command: "CreateBucketCommand",
    input: (i) =>
      definedFields({
        Bucket: bucket(i),
        // us-east-1 is the API default and rejects an explicit constraint.
        CreateBucketConfiguration:
          optionalInputString(i, "region") &&
          optionalInputString(i, "region") !== "us-east-1"
            ? { LocationConstraint: optionalInputString(i, "region") }
            : undefined,
      }),
  },
  "s3:delete-bucket": {
    command: "DeleteBucketCommand",
    input: (i) => ({ Bucket: bucket(i) }),
    output: (_v, i) => ({ bucket: bucket(i), deleted: true }),
  },
  "s3:list-objects": {
    command: "ListObjectsV2Command",
    input: (i) =>
      definedFields({
        Bucket: bucket(i),
        Prefix: optionalInputString(i, "prefix"),
        Delimiter: optionalInputString(i, "delimiter"),
        MaxKeys: optionalInputNumber(i, "maxKeys", "limit"),
        ContinuationToken: optionalInputString(
          i,
          "continuationToken",
          "cursor",
        ),
      }),
  },
  "s3:head-object-metadata": {
    command: "HeadObjectCommand",
    input: (i) => ({ Bucket: bucket(i), Key: objectKey(i) }),
  },
  "s3:upload-file": {
    command: "PutObjectCommand",
    input: (i) =>
      definedFields({
        Bucket: bucket(i),
        Key: objectKey(i),
        Body: requiredInputString(i, "content", "body", "fileContent"),
        ContentType: optionalInputString(i, "contentType"),
        Metadata: optionalInputRecord(i, "metadata"),
      }),
  },
  "s3:download-file": {
    command: "GetObjectCommand",
    input: (i) => ({ Bucket: bucket(i), Key: objectKey(i) }),
    // The SDK returns a stream; collect it so the product receives a value.
    output: async (value, i) => {
      const body = (
        value as { Body?: { transformToString?: () => Promise<string> } }
      )?.Body;
      return {
        bucket: bucket(i),
        key: objectKey(i),
        content: (await body?.transformToString?.()) ?? "",
      };
    },
  },
  "s3:delete-object": {
    command: "DeleteObjectCommand",
    input: (i) => ({ Bucket: bucket(i), Key: objectKey(i) }),
    output: (_v, i) => ({
      bucket: bucket(i),
      key: objectKey(i),
      deleted: true,
    }),
  },
  "s3:delete-objects-batch": {
    command: "DeleteObjectsCommand",
    input: (i) => ({
      Bucket: bucket(i),
      Delete: {
        Objects: requiredInputStringArray(i, "keys", "objectKeys").map(
          (key) => ({
            Key: key,
          }),
        ),
        Quiet: optionalInputBoolean(i, "quiet") ?? false,
      },
    }),
  },
  "s3:copy-object": {
    command: "CopyObjectCommand",
    input: (i) => ({
      Bucket: requiredInputString(i, "destinationBucket", "bucket"),
      Key: requiredInputString(i, "destinationKey"),
      CopySource: `${requiredInputString(i, "sourceBucket")}/${requiredInputString(i, "sourceKey")}`,
    }),
  },
  "s3:presigned-url": {
    // getSignedUrl signs locally; it never reaches S3, so it is modelled as a
    // GetObject request whose output is the signed URL.
    command: "GetObjectCommand",
    input: (i) =>
      definedFields({
        Bucket: bucket(i),
        Key: objectKey(i),
        ExpiresIn: optionalInputNumber(i, "expiresIn", "expiresInSeconds"),
      }),
  },
};

export function createS3Pack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "s3",
    packageName: "@aws-sdk/client-s3",
    clientExport: "S3Client",
    operations: S3_OPERATIONS,
  });
}

const DYNAMODB_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "amazon-dynamodb:get-item": {
    command: "GetItemCommand",
    input: (i) =>
      definedFields({
        TableName: requiredInputString(i, "tableName", "table"),
        Key: requiredInputRecord(i, "key"),
        ConsistentRead: optionalInputBoolean(i, "consistentRead"),
        ProjectionExpression: optionalInputString(i, "projectionExpression"),
      }),
  },
  "amazon-dynamodb:put-item": {
    command: "PutItemCommand",
    input: (i) =>
      definedFields({
        TableName: requiredInputString(i, "tableName", "table"),
        Item: requiredInputRecord(i, "item"),
        ConditionExpression: optionalInputString(i, "conditionExpression"),
      }),
  },
  "amazon-dynamodb:update-item": {
    command: "UpdateItemCommand",
    input: (i) =>
      definedFields({
        TableName: requiredInputString(i, "tableName", "table"),
        Key: requiredInputRecord(i, "key"),
        UpdateExpression: requiredInputString(i, "updateExpression"),
        ExpressionAttributeValues: optionalInputRecord(
          i,
          "expressionAttributeValues",
        ),
        ExpressionAttributeNames: optionalInputRecord(
          i,
          "expressionAttributeNames",
        ),
        ConditionExpression: optionalInputString(i, "conditionExpression"),
        ReturnValues: optionalInputString(i, "returnValues"),
      }),
  },
  "amazon-dynamodb:delete-item": {
    command: "DeleteItemCommand",
    input: (i) =>
      definedFields({
        TableName: requiredInputString(i, "tableName", "table"),
        Key: requiredInputRecord(i, "key"),
        ConditionExpression: optionalInputString(i, "conditionExpression"),
      }),
  },
  "amazon-dynamodb:query": {
    command: "QueryCommand",
    input: (i) =>
      definedFields({
        TableName: requiredInputString(i, "tableName", "table"),
        KeyConditionExpression: requiredInputString(
          i,
          "keyConditionExpression",
        ),
        ExpressionAttributeValues: optionalInputRecord(
          i,
          "expressionAttributeValues",
        ),
        ExpressionAttributeNames: optionalInputRecord(
          i,
          "expressionAttributeNames",
        ),
        FilterExpression: optionalInputString(i, "filterExpression"),
        IndexName: optionalInputString(i, "indexName"),
        Limit: optionalInputNumber(i, "limit"),
        ExclusiveStartKey: optionalInputRecord(i, "exclusiveStartKey"),
        ScanIndexForward: optionalInputBoolean(i, "scanIndexForward"),
      }),
  },
  "amazon-dynamodb:scan": {
    command: "ScanCommand",
    input: (i) =>
      definedFields({
        TableName: requiredInputString(i, "tableName", "table"),
        FilterExpression: optionalInputString(i, "filterExpression"),
        ExpressionAttributeValues: optionalInputRecord(
          i,
          "expressionAttributeValues",
        ),
        Limit: optionalInputNumber(i, "limit"),
        ExclusiveStartKey: optionalInputRecord(i, "exclusiveStartKey"),
      }),
  },
  "amazon-dynamodb:introspect": {
    command: "DescribeTableCommand",
    input: (i) => ({ TableName: requiredInputString(i, "tableName", "table") }),
  },
};

export function createDynamoDbPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "amazon-dynamodb",
    packageName: "@aws-sdk/client-dynamodb",
    clientExport: "DynamoDBClient",
    operations: DYNAMODB_OPERATIONS,
  });
}

const SQS_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "amazon-sqs:send-message": {
    command: "SendMessageCommand",
    input: (i) =>
      definedFields({
        QueueUrl: requiredInputString(i, "queueUrl", "queue"),
        MessageBody: requiredInputString(i, "messageBody", "message", "body"),
        DelaySeconds: optionalInputNumber(i, "delaySeconds"),
        MessageGroupId: optionalInputString(i, "messageGroupId"),
        MessageDeduplicationId: optionalInputString(
          i,
          "messageDeduplicationId",
        ),
        MessageAttributes: optionalInputRecord(i, "messageAttributes"),
      }),
  },
};

export function createSqsPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "amazon-sqs",
    packageName: "@aws-sdk/client-sqs",
    clientExport: "SQSClient",
    operations: SQS_OPERATIONS,
  });
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
