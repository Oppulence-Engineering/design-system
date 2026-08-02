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
