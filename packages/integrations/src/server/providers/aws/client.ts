import { createRequire } from "node:module";

import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationApiKeyRuntime } from "../../api-key-runtime";
import { IntegrationProviderSdkError } from "../../provider-sdk";
import type { IntegrationProviderSdk } from "../../provider-sdk";
import type { IntegrationProviderPack } from "../../provider-pack";
import {
  normalizeSdkOutput,
  optionalInputString,
  ProviderSdkInvocationSchema,
} from "../shared";

const awsRequire = createRequire(import.meta.url);

type AwsInput = Readonly<Record<string, unknown>>;

/**
 * One AWS action, addressed by the command class the service module exports.
 * AWS SDK v3 models every operation as `client.send(new XCommand(input))`, so
 * a command name plus an input mapper describes an action completely.
 */
export interface AwsServiceModule {
  readonly packageName: string;
  readonly clientExport: string;
}

export interface AwsOperation {
  readonly command: string;
  readonly input?: (input: AwsInput) => Record<string, unknown>;
  readonly output?: (value: unknown, input: AwsInput) => unknown;
  /**
   * Overrides the pack's default service module. Several source providers span
   * two AWS services — CloudWatch actions split between metrics and Logs, and
   * Identity Center reads users from Identity Store and accounts from
   * Organizations.
   */
  readonly module?: AwsServiceModule;
}

export interface AwsSdkClient {
  send(command: unknown): Promise<unknown>;
  destroy?(): void;
}

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export type AwsClientFactory = (input: {
  region: string;
  credentials: AwsCredentials;
}) => AwsSdkClient;

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/**
 * AWS regions select an endpoint, so an unvalidated value would let operation
 * input redirect the request. Only the documented region syntax is accepted.
 */
export function requiredAwsRegion(input: AwsInput): string {
  const region = optionalInputString(input, "region", "awsRegion");
  if (!region || !/^[a-z]{2}(-[a-z]+)+-\d$/u.test(region)) {
    throw invocationError();
  }
  return region;
}

/**
 * Reads the AWS key pair from the encrypted envelope. The access key ID is the
 * primary credential; the secret access key and optional session token live in
 * the composite `fields` map.
 */
export function awsCredentialsFrom(credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}): AwsCredentials {
  const secretAccessKey = credential.fields.secretAccessKey;
  if (!secretAccessKey) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const sessionToken = credential.fields.sessionToken;
  return {
    accessKeyId: credential.apiKey,
    secretAccessKey,
    ...(sessionToken ? { sessionToken } : {}),
  };
}

/**
 * Builds a lazily-loaded client factory for one AWS service module, so
 * registering a single AWS pack does not pull in all fifteen service clients.
 */
export function awsClientFactory(
  packageName: string,
  clientExport: string,
): AwsClientFactory {
  return ({ region, credentials }) => {
    const module = awsRequire(packageName) as Record<string, unknown>;
    const Client = module[clientExport] as
      | (new (config: unknown) => AwsSdkClient)
      | undefined;
    if (typeof Client !== "function") {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
      );
    }
    return new Client({ region, credentials });
  };
}

function awsCommandFactory(
  packageName: string,
): (command: string) => new (input: unknown) => unknown {
  return (command) => {
    const module = awsRequire(packageName) as Record<string, unknown>;
    const Command = module[command] as
      | (new (input: unknown) => unknown)
      | undefined;
    if (typeof Command !== "function") {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
      );
    }
    return Command;
  };
}

/** AWS echoes request metadata on every response; products do not need it. */
export function awsOutput(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return normalizeSdkOutput(value);
  }
  const { $metadata: _metadata, ...rest } = value as Record<string, unknown>;
  return normalizeSdkOutput(rest);
}

export interface AwsProviderSdkConfig {
  integrationId: string;
  packageName: string;
  clientExport: string;
  operations: Readonly<Record<string, AwsOperation>>;
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: AwsClientFactory;
  commandFactory?: (command: string) => new (input: unknown) => unknown;
}

/**
 * Builds one AWS-backed adapter from an operation table. Every AWS provider
 * shares this executor, so credential assembly, region validation, and
 * response metadata stripping are defined once.
 */
export function createAwsProviderSdk(
  config: AwsProviderSdkConfig,
): IntegrationProviderSdk {
  const operationIds = Object.freeze(Object.keys(config.operations));
  const defaultModule: AwsServiceModule = {
    packageName: config.packageName,
    clientExport: config.clientExport,
  };
  const clientFor = (module: AwsServiceModule): AwsClientFactory =>
    config.clientFactory ??
    awsClientFactory(module.packageName, module.clientExport);
  const commandFor = (
    module: AwsServiceModule,
  ): ((command: string) => new (input: unknown) => unknown) =>
    config.commandFactory ?? awsCommandFactory(module.packageName);

  return {
    integrationId: config.integrationId,
    operationIds,
    executionLane: "sdk",
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) throw invocationError();
      const invocation = parsed.data;
      if (
        invocation.integrationId !== config.integrationId ||
        invocation.reference.integrationId !== config.integrationId
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const operation = config.operations[invocation.operationId];
      if (!operation) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      const region = requiredAwsRegion(invocation.input);
      const commandInput = operation.input?.(invocation.input) ?? {};

      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const module = operation.module ?? defaultModule;
          const client = clientFor(module)({
            region,
            credentials: awsCredentialsFrom(credential),
          });
          try {
            const Command = commandFor(module)(operation.command);
            const result = await client.send(new Command(commandInput));
            return {
              operationId: invocation.operationId,
              output: operation.output
                ? operation.output(result, invocation.input)
                : awsOutput(result),
            };
          } finally {
            // Each invocation builds its own client; release its sockets.
            client.destroy?.();
          }
        },
      );
    },
  };
}

export interface AwsPackConfig {
  integrationId: string;
  packageName: string;
  clientExport: string;
  operations: Readonly<Record<string, AwsOperation>>;
  clientFactory?: AwsClientFactory;
  commandFactory?: (command: string) => new (input: unknown) => unknown;
}

/** Wraps an AWS operation table as a delivery unit. */
export function createAwsPack(config: AwsPackConfig): IntegrationProviderPack {
  const baseline = SIMSTUDIO_BASELINE.integrations.find(
    (integration) => integration.id === config.integrationId,
  );
  if (!baseline) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return {
    integrationId: config.integrationId,
    coverage: baseline.operations.map((operation) =>
      config.operations[operation.id]
        ? {
            sourceOperationId: operation.id,
            lane: "sdk" as const,
            disposition: "supported" as const,
          }
        : {
            sourceOperationId: operation.id,
            disposition: "deferred" as const,
            reason: `No ${config.packageName} command is mapped for this action.`,
          },
    ),
    triggerCoverage: baseline.triggers.map((trigger) => ({
      sourceTriggerId: trigger.id,
      disposition: "deferred" as const,
      reason:
        "AWS event delivery runs through EventBridge or SNS, which is scheduled with the trigger family work.",
    })),
    create(context) {
      if (!context.apiKeyRuntime) return [];
      return [
        createAwsProviderSdk({
          integrationId: config.integrationId,
          packageName: config.packageName,
          clientExport: config.clientExport,
          operations: config.operations,
          apiKeyRuntime: context.apiKeyRuntime,
          ...(config.clientFactory
            ? { clientFactory: config.clientFactory }
            : {}),
          ...(config.commandFactory
            ? { commandFactory: config.commandFactory }
            : {}),
        }),
      ];
    },
  };
}
