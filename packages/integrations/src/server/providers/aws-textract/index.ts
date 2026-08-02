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

/** Textract takes document bytes inline or an S3 object reference. */
function textractDocument(i: AwsInput): Record<string, unknown> {
  const bucket = optionalInputString(i, "bucket", "s3Bucket");
  if (bucket) {
    return {
      S3Object: {
        Bucket: bucket,
        Name: requiredInputString(i, "key", "objectKey", "s3Key"),
      },
    };
  }
  return { Bytes: requiredInputString(i, "documentBytes", "content") };
}

const TEXTRACT_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "aws-textract:analyze-document-text-tables-forms": {
    command: "AnalyzeDocumentCommand",
    input: (i) => ({
      Document: textractDocument(i),
      FeatureTypes: optionalInputStringArray(i, "featureTypes") ?? [
        "TABLES",
        "FORMS",
      ],
    }),
  },
  "aws-textract:analyze-expense-invoices-receipts": {
    command: "AnalyzeExpenseCommand",
    input: (i) => ({ Document: textractDocument(i) }),
  },
  "aws-textract:analyze-identity-document": {
    command: "AnalyzeIDCommand",
    input: (i) => ({ DocumentPages: [textractDocument(i)] }),
  },
};

export function createTextractPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "aws-textract",
    packageName: "@aws-sdk/client-textract",
    clientExport: "TextractClient",
    operations: TEXTRACT_OPERATIONS,
  });
}
