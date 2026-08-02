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
