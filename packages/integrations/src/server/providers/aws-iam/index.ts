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
