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
