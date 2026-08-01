import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputBoolean,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputNumber,
  requiredInputString,
  requiredInputStringArray,
} from "../shared/sdk";
import { createAwsPack, type AwsOperation } from "../shared/clients/aws";

type AwsInput = Readonly<Record<string, unknown>>;

const APPCONFIG_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "aws-appconfig:get-configuration": {
    command: "GetConfigurationCommand",
    input: (i) => ({
      Application: requiredInputString(i, "applicationId", "application"),
      Environment: requiredInputString(i, "environmentId", "environment"),
      Configuration: requiredInputString(i, "configurationProfileId"),
      ClientId: requiredInputString(i, "clientId"),
    }),
  },
  "aws-appconfig:list-applications": {
    command: "ListApplicationsCommand",
    input: (i) =>
      definedFields({
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-appconfig:create-application": {
    command: "CreateApplicationCommand",
    input: (i) =>
      definedFields({
        Name: requiredInputString(i, "name"),
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:get-application": {
    command: "GetApplicationCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
    }),
  },
  "aws-appconfig:update-application": {
    command: "UpdateApplicationCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        Name: optionalInputString(i, "name"),
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:delete-application": {
    command: "DeleteApplicationCommand",
    input: (i) => ({ ApplicationId: requiredInputString(i, "applicationId") }),
    output: (_v, i) => ({
      applicationId: requiredInputString(i, "applicationId"),
      deleted: true,
    }),
  },
  "aws-appconfig:list-environments": {
    command: "ListEnvironmentsCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-appconfig:create-environment": {
    command: "CreateEnvironmentCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        Name: requiredInputString(i, "name"),
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:get-environment": {
    command: "GetEnvironmentCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      EnvironmentId: requiredInputString(i, "environmentId"),
    }),
  },
  "aws-appconfig:update-environment": {
    command: "UpdateEnvironmentCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        EnvironmentId: requiredInputString(i, "environmentId"),
        Name: optionalInputString(i, "name"),
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:delete-environment": {
    command: "DeleteEnvironmentCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      EnvironmentId: requiredInputString(i, "environmentId"),
    }),
    output: (_v, i) => ({
      environmentId: requiredInputString(i, "environmentId"),
      deleted: true,
    }),
  },
  "aws-appconfig:list-configuration-profiles": {
    command: "ListConfigurationProfilesCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-appconfig:create-configuration-profile": {
    command: "CreateConfigurationProfileCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        Name: requiredInputString(i, "name"),
        LocationUri: requiredInputString(i, "locationUri"),
        Description: optionalInputString(i, "description"),
        RetrievalRoleArn: optionalInputString(i, "retrievalRoleArn"),
      }),
  },
  "aws-appconfig:get-configuration-profile": {
    command: "GetConfigurationProfileCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      ConfigurationProfileId: requiredInputString(i, "configurationProfileId"),
    }),
  },
  "aws-appconfig:update-configuration-profile": {
    command: "UpdateConfigurationProfileCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        ConfigurationProfileId: requiredInputString(
          i,
          "configurationProfileId",
        ),
        Name: optionalInputString(i, "name"),
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:delete-configuration-profile": {
    command: "DeleteConfigurationProfileCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      ConfigurationProfileId: requiredInputString(i, "configurationProfileId"),
    }),
    output: (_v, i) => ({
      configurationProfileId: requiredInputString(i, "configurationProfileId"),
      deleted: true,
    }),
  },
  "aws-appconfig:create-hosted-configuration-version": {
    command: "CreateHostedConfigurationVersionCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        ConfigurationProfileId: requiredInputString(
          i,
          "configurationProfileId",
        ),
        Content: requiredInputString(i, "content"),
        ContentType:
          optionalInputString(i, "contentType") ?? "application/json",
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:get-hosted-configuration-version": {
    command: "GetHostedConfigurationVersionCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      ConfigurationProfileId: requiredInputString(i, "configurationProfileId"),
      VersionNumber: requiredInputNumber(i, "versionNumber"),
    }),
  },
  "aws-appconfig:list-hosted-configuration-versions": {
    command: "ListHostedConfigurationVersionsCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        ConfigurationProfileId: requiredInputString(
          i,
          "configurationProfileId",
        ),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-appconfig:delete-hosted-configuration-version": {
    command: "DeleteHostedConfigurationVersionCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      ConfigurationProfileId: requiredInputString(i, "configurationProfileId"),
      VersionNumber: requiredInputNumber(i, "versionNumber"),
    }),
    output: (_v, i) => ({
      versionNumber: requiredInputNumber(i, "versionNumber"),
      deleted: true,
    }),
  },
  "aws-appconfig:list-deployment-strategies": {
    command: "ListDeploymentStrategiesCommand",
    input: (i) =>
      definedFields({
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-appconfig:start-deployment": {
    command: "StartDeploymentCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        EnvironmentId: requiredInputString(i, "environmentId"),
        DeploymentStrategyId: requiredInputString(i, "deploymentStrategyId"),
        ConfigurationProfileId: requiredInputString(
          i,
          "configurationProfileId",
        ),
        ConfigurationVersion: requiredInputString(i, "configurationVersion"),
        Description: optionalInputString(i, "description"),
      }),
  },
  "aws-appconfig:get-deployment": {
    command: "GetDeploymentCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      EnvironmentId: requiredInputString(i, "environmentId"),
      DeploymentNumber: requiredInputNumber(i, "deploymentNumber"),
    }),
  },
  "aws-appconfig:list-deployments": {
    command: "ListDeploymentsCommand",
    input: (i) =>
      definedFields({
        ApplicationId: requiredInputString(i, "applicationId"),
        EnvironmentId: requiredInputString(i, "environmentId"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "aws-appconfig:stop-deployment": {
    command: "StopDeploymentCommand",
    input: (i) => ({
      ApplicationId: requiredInputString(i, "applicationId"),
      EnvironmentId: requiredInputString(i, "environmentId"),
      DeploymentNumber: requiredInputNumber(i, "deploymentNumber"),
    }),
  },
};

export function createAppConfigPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "aws-appconfig",
    packageName: "@aws-sdk/client-appconfig",
    clientExport: "AppConfigClient",
    operations: APPCONFIG_OPERATIONS,
  });
}
