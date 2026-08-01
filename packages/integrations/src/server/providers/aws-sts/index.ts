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

const STS_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "aws-sts:assume-role": {
    command: "AssumeRoleCommand",
    input: (i) =>
      definedFields({
        RoleArn: requiredInputString(i, "roleArn"),
        RoleSessionName: requiredInputString(
          i,
          "roleSessionName",
          "sessionName",
        ),
        DurationSeconds: optionalInputNumber(i, "durationSeconds"),
        ExternalId: optionalInputString(i, "externalId"),
        Policy: optionalInputString(i, "policy"),
      }),
  },
  "aws-sts:assume-role-with-web-identity": {
    command: "AssumeRoleWithWebIdentityCommand",
    input: (i) =>
      definedFields({
        RoleArn: requiredInputString(i, "roleArn"),
        RoleSessionName: requiredInputString(
          i,
          "roleSessionName",
          "sessionName",
        ),
        WebIdentityToken: requiredInputString(i, "webIdentityToken"),
        DurationSeconds: optionalInputNumber(i, "durationSeconds"),
      }),
  },
  "aws-sts:assume-role-with-saml": {
    command: "AssumeRoleWithSAMLCommand",
    input: (i) =>
      definedFields({
        RoleArn: requiredInputString(i, "roleArn"),
        PrincipalArn: requiredInputString(i, "principalArn"),
        SAMLAssertion: requiredInputString(i, "samlAssertion"),
        DurationSeconds: optionalInputNumber(i, "durationSeconds"),
      }),
  },
  "aws-sts:get-caller-identity": { command: "GetCallerIdentityCommand" },
  "aws-sts:get-session-token": {
    command: "GetSessionTokenCommand",
    input: (i) =>
      definedFields({
        DurationSeconds: optionalInputNumber(i, "durationSeconds"),
        SerialNumber: optionalInputString(i, "serialNumber"),
        TokenCode: optionalInputString(i, "tokenCode"),
      }),
  },
  "aws-sts:get-access-key-info": {
    command: "GetAccessKeyInfoCommand",
    input: (i) => ({ AccessKeyId: requiredInputString(i, "accessKeyId") }),
  },
};

export function createStsPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "aws-sts",
    packageName: "@aws-sdk/client-sts",
    clientExport: "STSClient",
    operations: STS_OPERATIONS,
  });
}
