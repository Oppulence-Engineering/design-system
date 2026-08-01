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
