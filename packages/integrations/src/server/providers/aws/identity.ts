import type { IntegrationProviderPack } from "../../provider-pack";
import {
  definedFields,
  optionalInputBoolean,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
  requiredInputStringArray,
} from "../shared";
import { createAwsPack, type AwsOperation } from "./client";

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

const IAM_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "aws-iam:list-users": {
    command: "ListUsersCommand",
    input: (i) =>
      definedFields({
        PathPrefix: optionalInputString(i, "pathPrefix"),
        MaxItems: optionalInputNumber(i, "maxItems", "limit"),
        Marker: optionalInputString(i, "marker", "cursor"),
      }),
  },
  "aws-iam:get-user": {
    command: "GetUserCommand",
    input: (i) =>
      definedFields({ UserName: optionalInputString(i, "userName") }),
  },
  "aws-iam:create-user": {
    command: "CreateUserCommand",
    input: (i) =>
      definedFields({
        UserName: requiredInputString(i, "userName"),
        Path: optionalInputString(i, "path"),
      }),
  },
  "aws-iam:delete-user": {
    command: "DeleteUserCommand",
    input: (i) => ({ UserName: requiredInputString(i, "userName") }),
    output: (_v, i) => ({
      userName: requiredInputString(i, "userName"),
      deleted: true,
    }),
  },
  "aws-iam:list-roles": {
    command: "ListRolesCommand",
    input: (i) =>
      definedFields({
        PathPrefix: optionalInputString(i, "pathPrefix"),
        MaxItems: optionalInputNumber(i, "maxItems", "limit"),
        Marker: optionalInputString(i, "marker", "cursor"),
      }),
  },
  "aws-iam:get-role": {
    command: "GetRoleCommand",
    input: (i) => ({ RoleName: requiredInputString(i, "roleName") }),
  },
  "aws-iam:create-role": {
    command: "CreateRoleCommand",
    input: (i) =>
      definedFields({
        RoleName: requiredInputString(i, "roleName"),
        AssumeRolePolicyDocument: requiredInputString(
          i,
          "assumeRolePolicyDocument",
          "trustPolicy",
        ),
        Description: optionalInputString(i, "description"),
        Path: optionalInputString(i, "path"),
      }),
  },
  "aws-iam:delete-role": {
    command: "DeleteRoleCommand",
    input: (i) => ({ RoleName: requiredInputString(i, "roleName") }),
    output: (_v, i) => ({
      roleName: requiredInputString(i, "roleName"),
      deleted: true,
    }),
  },
  "aws-iam:attach-user-policy": {
    command: "AttachUserPolicyCommand",
    input: (i) => ({
      UserName: requiredInputString(i, "userName"),
      PolicyArn: requiredInputString(i, "policyArn"),
    }),
    output: (_v, i) => ({
      userName: requiredInputString(i, "userName"),
      policyArn: requiredInputString(i, "policyArn"),
      attached: true,
    }),
  },
  "aws-iam:detach-user-policy": {
    command: "DetachUserPolicyCommand",
    input: (i) => ({
      UserName: requiredInputString(i, "userName"),
      PolicyArn: requiredInputString(i, "policyArn"),
    }),
    output: (_v, i) => ({
      userName: requiredInputString(i, "userName"),
      policyArn: requiredInputString(i, "policyArn"),
      attached: false,
    }),
  },
  "aws-iam:attach-role-policy": {
    command: "AttachRolePolicyCommand",
    input: (i) => ({
      RoleName: requiredInputString(i, "roleName"),
      PolicyArn: requiredInputString(i, "policyArn"),
    }),
    output: (_v, i) => ({
      roleName: requiredInputString(i, "roleName"),
      policyArn: requiredInputString(i, "policyArn"),
      attached: true,
    }),
  },
  "aws-iam:detach-role-policy": {
    command: "DetachRolePolicyCommand",
    input: (i) => ({
      RoleName: requiredInputString(i, "roleName"),
      PolicyArn: requiredInputString(i, "policyArn"),
    }),
    output: (_v, i) => ({
      roleName: requiredInputString(i, "roleName"),
      policyArn: requiredInputString(i, "policyArn"),
      attached: false,
    }),
  },
  "aws-iam:list-policies": {
    command: "ListPoliciesCommand",
    input: (i) =>
      definedFields({
        Scope: optionalInputString(i, "scope"),
        OnlyAttached: optionalInputBoolean(i, "onlyAttached"),
        PathPrefix: optionalInputString(i, "pathPrefix"),
        MaxItems: optionalInputNumber(i, "maxItems", "limit"),
        Marker: optionalInputString(i, "marker", "cursor"),
      }),
  },
  "aws-iam:list-attached-role-policies": {
    command: "ListAttachedRolePoliciesCommand",
    input: (i) =>
      definedFields({
        RoleName: requiredInputString(i, "roleName"),
        MaxItems: optionalInputNumber(i, "maxItems", "limit"),
        Marker: optionalInputString(i, "marker", "cursor"),
      }),
  },
  "aws-iam:list-attached-user-policies": {
    command: "ListAttachedUserPoliciesCommand",
    input: (i) =>
      definedFields({
        UserName: requiredInputString(i, "userName"),
        MaxItems: optionalInputNumber(i, "maxItems", "limit"),
        Marker: optionalInputString(i, "marker", "cursor"),
      }),
  },
  "aws-iam:create-access-key": {
    command: "CreateAccessKeyCommand",
    input: (i) =>
      definedFields({ UserName: optionalInputString(i, "userName") }),
  },
  "aws-iam:delete-access-key": {
    command: "DeleteAccessKeyCommand",
    input: (i) =>
      definedFields({
        UserName: optionalInputString(i, "userName"),
        AccessKeyId: requiredInputString(i, "accessKeyId"),
      }),
    output: (_v, i) => ({
      accessKeyId: requiredInputString(i, "accessKeyId"),
      deleted: true,
    }),
  },
  "aws-iam:list-groups": {
    command: "ListGroupsCommand",
    input: (i) =>
      definedFields({
        PathPrefix: optionalInputString(i, "pathPrefix"),
        MaxItems: optionalInputNumber(i, "maxItems", "limit"),
        Marker: optionalInputString(i, "marker", "cursor"),
      }),
  },
  "aws-iam:add-user-to-group": {
    command: "AddUserToGroupCommand",
    input: (i) => ({
      GroupName: requiredInputString(i, "groupName"),
      UserName: requiredInputString(i, "userName"),
    }),
    output: (_v, i) => ({
      groupName: requiredInputString(i, "groupName"),
      userName: requiredInputString(i, "userName"),
      member: true,
    }),
  },
  "aws-iam:remove-user-from-group": {
    command: "RemoveUserFromGroupCommand",
    input: (i) => ({
      GroupName: requiredInputString(i, "groupName"),
      UserName: requiredInputString(i, "userName"),
    }),
    output: (_v, i) => ({
      groupName: requiredInputString(i, "groupName"),
      userName: requiredInputString(i, "userName"),
      member: false,
    }),
  },
  "aws-iam:simulate-principal-policy": {
    command: "SimulatePrincipalPolicyCommand",
    input: (i) =>
      definedFields({
        PolicySourceArn: requiredInputString(
          i,
          "policySourceArn",
          "principalArn",
        ),
        ActionNames: requiredInputStringArray(i, "actionNames", "actions"),
        ResourceArns: optionalInputStringArray(i, "resourceArns", "resources"),
      }),
  },
};

export function createIamPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "aws-iam",
    packageName: "@aws-sdk/client-iam",
    clientExport: "IAMClient",
    operations: IAM_OPERATIONS,
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

const IDENTITY_STORE = {
  packageName: "@aws-sdk/client-identitystore",
  clientExport: "IdentitystoreClient",
} as const;
const ORGANIZATIONS = {
  packageName: "@aws-sdk/client-organizations",
  clientExport: "OrganizationsClient",
} as const;

/**
 * Identity Center spans three services: SSO Admin owns instances, permission
 * sets, and assignments; Identity Store owns users and groups; Organizations
 * owns the account directory.
 */
const IDENTITY_CENTER_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "aws-identity-center:list-instances": {
    command: "ListInstancesCommand",
    input: (i) =>
      definedFields({
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-identity-center:list-permission-sets": {
    command: "ListPermissionSetsCommand",
    input: (i) =>
      definedFields({
        InstanceArn: requiredInputString(i, "instanceArn"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-identity-center:create-account-assignment": {
    command: "CreateAccountAssignmentCommand",
    input: (i) => ({
      InstanceArn: requiredInputString(i, "instanceArn"),
      TargetId: requiredInputString(i, "accountId", "targetId"),
      TargetType: "AWS_ACCOUNT",
      PermissionSetArn: requiredInputString(i, "permissionSetArn"),
      PrincipalType: requiredInputString(i, "principalType"),
      PrincipalId: requiredInputString(i, "principalId"),
    }),
  },
  "aws-identity-center:delete-account-assignment": {
    command: "DeleteAccountAssignmentCommand",
    input: (i) => ({
      InstanceArn: requiredInputString(i, "instanceArn"),
      TargetId: requiredInputString(i, "accountId", "targetId"),
      TargetType: "AWS_ACCOUNT",
      PermissionSetArn: requiredInputString(i, "permissionSetArn"),
      PrincipalType: requiredInputString(i, "principalType"),
      PrincipalId: requiredInputString(i, "principalId"),
    }),
  },
  "aws-identity-center:check-assignment-status": {
    command: "DescribeAccountAssignmentCreationStatusCommand",
    input: (i) => ({
      InstanceArn: requiredInputString(i, "instanceArn"),
      AccountAssignmentCreationRequestId: requiredInputString(i, "requestId"),
    }),
  },
  "aws-identity-center:check-assignment-deletion-status": {
    command: "DescribeAccountAssignmentDeletionStatusCommand",
    input: (i) => ({
      InstanceArn: requiredInputString(i, "instanceArn"),
      AccountAssignmentDeletionRequestId: requiredInputString(i, "requestId"),
    }),
  },
  "aws-identity-center:list-account-assignments": {
    command: "ListAccountAssignmentsCommand",
    input: (i) =>
      definedFields({
        InstanceArn: requiredInputString(i, "instanceArn"),
        AccountId: requiredInputString(i, "accountId"),
        PermissionSetArn: requiredInputString(i, "permissionSetArn"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-identity-center:get-user": {
    module: IDENTITY_STORE,
    command: "DescribeUserCommand",
    input: (i) => ({
      IdentityStoreId: requiredInputString(i, "identityStoreId"),
      UserId: requiredInputString(i, "userId"),
    }),
  },
  "aws-identity-center:get-group": {
    module: IDENTITY_STORE,
    command: "DescribeGroupCommand",
    input: (i) => ({
      IdentityStoreId: requiredInputString(i, "identityStoreId"),
      GroupId: requiredInputString(i, "groupId"),
    }),
  },
  "aws-identity-center:list-groups": {
    module: IDENTITY_STORE,
    command: "ListGroupsCommand",
    input: (i) =>
      definedFields({
        IdentityStoreId: requiredInputString(i, "identityStoreId"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-identity-center:list-accounts": {
    module: ORGANIZATIONS,
    command: "ListAccountsCommand",
    input: (i) =>
      definedFields({
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-identity-center:describe-account": {
    module: ORGANIZATIONS,
    command: "DescribeAccountCommand",
    input: (i) => ({ AccountId: requiredInputString(i, "accountId") }),
  },
};

export function createIdentityCenterPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "aws-identity-center",
    packageName: "@aws-sdk/client-sso-admin",
    clientExport: "SSOAdminClient",
    operations: IDENTITY_CENTER_OPERATIONS,
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
