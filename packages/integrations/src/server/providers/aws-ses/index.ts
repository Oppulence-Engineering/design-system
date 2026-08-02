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

const SES_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "aws-ses:send-email": {
    command: "SendEmailCommand",
    input: (i) =>
      definedFields({
        FromEmailAddress: requiredInputString(i, "from", "fromAddress"),
        Destination: destination(i),
        ReplyToAddresses: optionalInputStringArray(i, "replyTo"),
        Content: {
          Simple: {
            Subject: { Data: requiredInputString(i, "subject") },
            Body: definedFields({
              Text: optionalInputString(i, "text", "textBody")
                ? { Data: optionalInputString(i, "text", "textBody") }
                : undefined,
              Html: optionalInputString(i, "html", "htmlBody", "body")
                ? { Data: optionalInputString(i, "html", "htmlBody", "body") }
                : undefined,
            }),
          },
        },
        ConfigurationSetName: optionalInputString(i, "configurationSetName"),
      }),
  },
  "aws-ses:send-templated-email": {
    command: "SendEmailCommand",
    input: (i) =>
      definedFields({
        FromEmailAddress: requiredInputString(i, "from", "fromAddress"),
        Destination: destination(i),
        Content: {
          Template: {
            TemplateName: requiredInputString(i, "templateName"),
            TemplateData: JSON.stringify(
              optionalInputRecord(i, "templateData") ?? {},
            ),
          },
        },
        ConfigurationSetName: optionalInputString(i, "configurationSetName"),
      }),
  },
  "aws-ses:send-bulk-email": {
    command: "SendBulkEmailCommand",
    input: (i) => ({
      FromEmailAddress: requiredInputString(i, "from", "fromAddress"),
      DefaultContent: {
        Template: {
          TemplateName: requiredInputString(i, "templateName"),
          TemplateData: JSON.stringify(
            optionalInputRecord(i, "defaultTemplateData") ?? {},
          ),
        },
      },
      BulkEmailEntries: requiredInputStringArray(i, "to", "toAddresses").map(
        (address) => ({ Destination: { ToAddresses: [address] } }),
      ),
    }),
  },
  "aws-ses:send-custom-verification-email": {
    command: "SendCustomVerificationEmailCommand",
    input: (i) => ({
      EmailAddress: requiredInputString(i, "emailAddress", "email"),
      TemplateName: requiredInputString(i, "templateName"),
    }),
  },
  "aws-ses:list-identities": {
    command: "ListEmailIdentitiesCommand",
    input: (i) =>
      definedFields({
        PageSize: optionalInputNumber(i, "pageSize", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-ses:get-account": { command: "GetAccountCommand" },
  "aws-ses:create-email-identity": {
    command: "CreateEmailIdentityCommand",
    input: (i) => ({
      EmailIdentity: requiredInputString(i, "emailIdentity", "identity"),
    }),
  },
  "aws-ses:get-email-identity": {
    command: "GetEmailIdentityCommand",
    input: (i) => ({
      EmailIdentity: requiredInputString(i, "emailIdentity", "identity"),
    }),
  },
  "aws-ses:delete-email-identity": {
    command: "DeleteEmailIdentityCommand",
    input: (i) => ({
      EmailIdentity: requiredInputString(i, "emailIdentity", "identity"),
    }),
    output: (_v, i) => ({
      emailIdentity: requiredInputString(i, "emailIdentity", "identity"),
      deleted: true,
    }),
  },
  "aws-ses:create-template": {
    command: "CreateEmailTemplateCommand",
    input: (i) => ({
      TemplateName: requiredInputString(i, "templateName"),
      TemplateContent: definedFields({
        Subject: requiredInputString(i, "subject"),
        Text: optionalInputString(i, "text", "textBody"),
        Html: optionalInputString(i, "html", "htmlBody"),
      }),
    }),
  },
  "aws-ses:get-template": {
    command: "GetEmailTemplateCommand",
    input: (i) => ({ TemplateName: requiredInputString(i, "templateName") }),
  },
  "aws-ses:list-templates": {
    command: "ListEmailTemplatesCommand",
    input: (i) =>
      definedFields({
        PageSize: optionalInputNumber(i, "pageSize", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-ses:update-template": {
    command: "UpdateEmailTemplateCommand",
    input: (i) => ({
      TemplateName: requiredInputString(i, "templateName"),
      TemplateContent: definedFields({
        Subject: requiredInputString(i, "subject"),
        Text: optionalInputString(i, "text", "textBody"),
        Html: optionalInputString(i, "html", "htmlBody"),
      }),
    }),
  },
  "aws-ses:delete-template": {
    command: "DeleteEmailTemplateCommand",
    input: (i) => ({ TemplateName: requiredInputString(i, "templateName") }),
    output: (_v, i) => ({
      templateName: requiredInputString(i, "templateName"),
      deleted: true,
    }),
  },
  "aws-ses:put-suppressed-destination": {
    command: "PutSuppressedDestinationCommand",
    input: (i) => ({
      EmailAddress: requiredInputString(i, "emailAddress", "email"),
      Reason: optionalInputString(i, "reason") ?? "COMPLAINT",
    }),
  },
  "aws-ses:get-suppressed-destination": {
    command: "GetSuppressedDestinationCommand",
    input: (i) => ({
      EmailAddress: requiredInputString(i, "emailAddress", "email"),
    }),
  },
  "aws-ses:list-suppressed-destinations": {
    command: "ListSuppressedDestinationsCommand",
    input: (i) =>
      definedFields({
        Reasons: optionalInputStringArray(i, "reasons"),
        PageSize: optionalInputNumber(i, "pageSize", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-ses:delete-suppressed-destination": {
    command: "DeleteSuppressedDestinationCommand",
    input: (i) => ({
      EmailAddress: requiredInputString(i, "emailAddress", "email"),
    }),
    output: (_v, i) => ({
      emailAddress: requiredInputString(i, "emailAddress", "email"),
      deleted: true,
    }),
  },
  "aws-ses:create-configuration-set": {
    command: "CreateConfigurationSetCommand",
    input: (i) => ({
      ConfigurationSetName: requiredInputString(i, "configurationSetName"),
    }),
  },
};

export function createSesPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "aws-ses",
    packageName: "@aws-sdk/client-sesv2",
    clientExport: "SESv2Client",
    operations: SES_OPERATIONS,
  });
}
