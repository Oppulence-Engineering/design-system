import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputBoolean,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
  requiredInputStringArray,
} from "../shared/sdk";
import { createAwsPack, type AwsOperation } from "../shared/clients/aws";

type AwsInput = Readonly<Record<string, unknown>>;

/** SES v2 takes recipients grouped by kind under one destination object. */
function destination(i: AwsInput): Record<string, unknown> {
  return definedFields({
    ToAddresses: requiredInputStringArray(i, "to", "toAddresses"),
    CcAddresses: optionalInputStringArray(i, "cc", "ccAddresses"),
    BccAddresses: optionalInputStringArray(i, "bcc", "bccAddresses"),
  });
}

const SECRETS_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "aws-secrets-manager:get-secret": {
    command: "GetSecretValueCommand",
    input: (i) =>
      definedFields({
        SecretId: requiredInputString(i, "secretId", "secretName"),
        VersionStage: optionalInputString(i, "versionStage"),
      }),
  },
  "aws-secrets-manager:list-secrets": {
    command: "ListSecretsCommand",
    input: (i) =>
      definedFields({
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-secrets-manager:create-secret": {
    command: "CreateSecretCommand",
    input: (i) =>
      definedFields({
        Name: requiredInputString(i, "name", "secretName"),
        SecretString: requiredInputString(i, "secretString", "value"),
        Description: optionalInputString(i, "description"),
        KmsKeyId: optionalInputString(i, "kmsKeyId"),
      }),
  },
  "aws-secrets-manager:update-secret": {
    command: "UpdateSecretCommand",
    input: (i) =>
      definedFields({
        SecretId: requiredInputString(i, "secretId", "secretName"),
        SecretString: optionalInputString(i, "secretString", "value"),
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-secrets-manager:delete-secret": {
    command: "DeleteSecretCommand",
    input: (i) =>
      definedFields({
        SecretId: requiredInputString(i, "secretId", "secretName"),
        RecoveryWindowInDays: optionalInputNumber(i, "recoveryWindowInDays"),
        ForceDeleteWithoutRecovery: optionalInputBoolean(i, "forceDelete"),
      }),
  },
  "aws-secrets-manager:describe-secret": {
    command: "DescribeSecretCommand",
    input: (i) => ({
      SecretId: requiredInputString(i, "secretId", "secretName"),
    }),
  },
  "aws-secrets-manager:restore-secret": {
    command: "RestoreSecretCommand",
    input: (i) => ({
      SecretId: requiredInputString(i, "secretId", "secretName"),
    }),
  },
  "aws-secrets-manager:rotate-secret": {
    command: "RotateSecretCommand",
    input: (i) =>
      definedFields({
        SecretId: requiredInputString(i, "secretId", "secretName"),
        RotationLambdaARN: optionalInputString(i, "rotationLambdaArn"),
        RotateImmediately: optionalInputBoolean(i, "rotateImmediately"),
      }),
  },
  "aws-secrets-manager:tag-secret": {
    command: "TagResourceCommand",
    input: (i) => ({
      SecretId: requiredInputString(i, "secretId", "secretName"),
      Tags: Object.entries(optionalInputRecord(i, "tags") ?? {}).map(
        ([Key, Value]) => ({ Key, Value: String(Value) }),
      ),
    }),
    output: (_v, i) => ({
      secretId: requiredInputString(i, "secretId", "secretName"),
      tagged: true,
    }),
  },
  "aws-secrets-manager:untag-secret": {
    command: "UntagResourceCommand",
    input: (i) => ({
      SecretId: requiredInputString(i, "secretId", "secretName"),
      TagKeys: requiredInputStringArray(i, "tagKeys"),
    }),
    output: (_v, i) => ({
      secretId: requiredInputString(i, "secretId", "secretName"),
      untagged: true,
    }),
  },
};

export function createSecretsManagerPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "aws-secrets-manager",
    packageName: "@aws-sdk/client-secrets-manager",
    clientExport: "SecretsManagerClient",
    operations: SECRETS_OPERATIONS,
  });
}
