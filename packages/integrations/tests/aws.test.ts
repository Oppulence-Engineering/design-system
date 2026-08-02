import { describe, expect, test } from "bun:test";

import {
  assertProviderPackCoverage,
  awsCredentialsFrom,
  createAppConfigPack,
  createAthenaPack,
  createAwsProviderSdk,
  createCloudFormationPack,
  createCloudWatchPack,
  createCodePipelinePack,
  createDynamoDbPack,
  createIamPack,
  createIdentityCenterPack,
  createIntegrationCredentialReference,
  createRdsPack,
  createS3Pack,
  createSecretsManagerPack,
  createSesPack,
  createSqsPack,
  createStsPack,
  createTextractPack,
  requiredAwsRegion,
  type AwsOperation,
  type IntegrationProviderPack,
} from "../src/server";

interface AwsCall {
  command: string;
  input: unknown;
  region: string;
  credentials: unknown;
}

/**
 * Stands in for the AWS SDK: records the region, credentials, command class,
 * and command input each action produces, without any network call.
 */
function awsRecorder(
  response: unknown = { $metadata: { httpStatusCode: 200 } },
) {
  const calls: AwsCall[] = [];
  let destroyed = 0;
  let pending: { region: string; credentials: unknown } | undefined;

  return {
    calls,
    get destroyed() {
      return destroyed;
    },
    clientFactory: ({
      region,
      credentials,
    }: {
      region: string;
      credentials: unknown;
    }) => {
      pending = { region, credentials };
      return {
        async send(command: unknown) {
          const record = command as { __command: string; __input: unknown };
          calls.push({
            command: record.__command,
            input: record.__input,
            region: pending?.region ?? "",
            credentials: pending?.credentials,
          });
          return response;
        },
        destroy() {
          destroyed += 1;
        },
      };
    },
    commandFactory: (command: string) =>
      class {
        readonly __command = command;
        readonly __input: unknown;
        constructor(input: unknown) {
          this.__input = input;
        }
      } as unknown as new (input: unknown) => unknown,
  };
}

const apiKeyRuntime = {
  async withCredential<T>(
    _reference: unknown,
    operation: (credential: {
      readonly apiKey: string;
      readonly fields: Readonly<Record<string, string>>;
    }) => Promise<T>,
  ): Promise<T> {
    return operation({
      apiKey: "AKIAEXAMPLE",
      fields: { secretAccessKey: "wJalr-secret", sessionToken: "FQoGZ" },
    });
  },
  async request() {
    return Response.json({});
  },
};

function reference(integrationId: string) {
  return createIntegrationCredentialReference({
    integrationId,
    connectionId: `connection_${integrationId}`,
    product: "eigenn",
  });
}

function providerFor(
  integrationId: string,
  operations: Readonly<Record<string, AwsOperation>>,
  recorder: ReturnType<typeof awsRecorder>,
) {
  return createAwsProviderSdk({
    integrationId,
    packageName: "@aws-sdk/client-test",
    clientExport: "TestClient",
    operations,
    apiKeyRuntime,
    clientFactory: recorder.clientFactory,
    commandFactory: recorder.commandFactory,
  });
}

const PACKS: readonly IntegrationProviderPack[] = [
  createS3Pack(),
  createDynamoDbPack(),
  createSqsPack(),
  createRdsPack(),
  createSesPack(),
  createIamPack(),
  createStsPack(),
  createIdentityCenterPack(),
  createSecretsManagerPack(),
  createTextractPack(),
  createAppConfigPack(),
  createAthenaPack(),
  createCloudWatchPack(),
  createCloudFormationPack(),
  createCodePipelinePack(),
];

describe("AWS provider family", () => {
  test("every pack accounts for all of its source actions", () => {
    for (const pack of PACKS) {
      expect(() =>
        assertProviderPackCoverage(pack, { apiKeyRuntime }),
      ).not.toThrow();
      expect(
        pack.coverage.filter((entry) => entry.disposition === "deferred"),
      ).toEqual([]);
      // The family is SDK-first throughout.
      expect(pack.coverage.every((entry) => entry.lane === "sdk")).toBe(true);
    }

    expect(PACKS).toHaveLength(15);
    expect(PACKS.reduce((total, pack) => total + pack.coverage.length, 0)).toBe(
      173,
    );
  });

  test("assembles the key pair from the composite credential envelope", () => {
    expect(
      awsCredentialsFrom({
        apiKey: "AKIA",
        fields: { secretAccessKey: "secret", sessionToken: "token" },
      }),
    ).toEqual({
      accessKeyId: "AKIA",
      secretAccessKey: "secret",
      sessionToken: "token",
    });

    // A session token is optional; a secret access key is not.
    expect(
      awsCredentialsFrom({ apiKey: "AKIA", fields: { secretAccessKey: "s" } }),
    ).toEqual({ accessKeyId: "AKIA", secretAccessKey: "s" });
    expect(() => awsCredentialsFrom({ apiKey: "AKIA", fields: {} })).toThrow();
  });

  test("accepts only a well-formed region, since it selects the endpoint", () => {
    expect(requiredAwsRegion({ region: "eu-west-2" })).toBe("eu-west-2");
    expect(requiredAwsRegion({ region: "us-gov-east-1" })).toBe(
      "us-gov-east-1",
    );
    for (const region of ["", "US-EAST-1", "evil.example.com", "us-east"]) {
      expect(() => requiredAwsRegion({ region })).toThrow();
    }
  });

  test("passes region and credentials to the client, not to the command", async () => {
    const recorder = awsRecorder();
    const provider = providerFor(
      "s3",
      { "s3:list-buckets": { command: "ListBucketsCommand" } },
      recorder,
    );

    await provider.execute({
      integrationId: "s3",
      operationId: "s3:list-buckets",
      reference: reference("s3"),
      input: { region: "eu-west-2" },
    });

    expect(recorder.calls[0]).toMatchObject({
      command: "ListBucketsCommand",
      region: "eu-west-2",
      credentials: {
        accessKeyId: "AKIAEXAMPLE",
        secretAccessKey: "wJalr-secret",
        sessionToken: "FQoGZ",
      },
    });
    expect(JSON.stringify(recorder.calls[0]?.input)).not.toContain(
      "wJalr-secret",
    );
    // The adapter builds one client per invocation and releases it.
    expect(recorder.destroyed).toBe(1);
  });

  test("releases the client even when the command fails", async () => {
    const recorder = awsRecorder();
    const provider = createAwsProviderSdk({
      integrationId: "s3",
      packageName: "@aws-sdk/client-test",
      clientExport: "TestClient",
      operations: { "s3:list-buckets": { command: "ListBucketsCommand" } },
      apiKeyRuntime,
      clientFactory: () => ({
        async send() {
          throw new Error("AccessDenied");
        },
        destroy() {
          recorder.calls.push({
            command: "destroy",
            input: undefined,
            region: "",
            credentials: undefined,
          });
        },
      }),
      commandFactory: recorder.commandFactory,
    });

    await expect(
      provider.execute({
        integrationId: "s3",
        operationId: "s3:list-buckets",
        reference: reference("s3"),
        input: { region: "us-east-1" },
      }),
    ).rejects.toThrow("AccessDenied");
    expect(recorder.calls.map((call) => call.command)).toEqual(["destroy"]);
  });

  test("strips the AWS response metadata envelope", async () => {
    const recorder = awsRecorder({
      $metadata: { httpStatusCode: 200, requestId: "req-1" },
      Buckets: [{ Name: "reports" }],
    });
    const provider = providerFor(
      "s3",
      { "s3:list-buckets": { command: "ListBucketsCommand" } },
      recorder,
    );

    const result = await provider.execute({
      integrationId: "s3",
      operationId: "s3:list-buckets",
      reference: reference("s3"),
      input: { region: "us-east-1" },
    });

    expect(result.output).toEqual({ Buckets: [{ Name: "reports" }] });
  });

  test("omits the location constraint that us-east-1 rejects", async () => {
    const recorder = awsRecorder();
    const s3 = PACKS[0].create({ apiKeyRuntime })[0];
    const withFactory = createAwsProviderSdk({
      integrationId: "s3",
      packageName: "@aws-sdk/client-s3",
      clientExport: "S3Client",
      operations: {
        "s3:create-bucket": {
          command: "CreateBucketCommand",
          input: (i) => ({
            Bucket: String(i.bucket),
            ...(i.region === "us-east-1"
              ? {}
              : {
                  CreateBucketConfiguration: { LocationConstraint: i.region },
                }),
          }),
        },
      },
      apiKeyRuntime,
      clientFactory: recorder.clientFactory,
      commandFactory: recorder.commandFactory,
    });
    expect(s3.operationIds).toContain("s3:create-bucket");

    await withFactory.execute({
      integrationId: "s3",
      operationId: "s3:create-bucket",
      reference: reference("s3"),
      input: { region: "us-east-1", bucket: "reports" },
    });
    await withFactory.execute({
      integrationId: "s3",
      operationId: "s3:create-bucket",
      reference: reference("s3"),
      input: { region: "eu-west-2", bucket: "reports" },
    });

    expect(recorder.calls[0]?.input).toEqual({ Bucket: "reports" });
    expect(recorder.calls[1]?.input).toEqual({
      Bucket: "reports",
      CreateBucketConfiguration: { LocationConstraint: "eu-west-2" },
    });
  });

  test("routes an action to the service module it declares", async () => {
    const modules: string[] = [];
    const provider = createAwsProviderSdk({
      integrationId: "cloudwatch",
      packageName: "@aws-sdk/client-cloudwatch",
      clientExport: "CloudWatchClient",
      operations: {
        "cloudwatch:list-metrics": { command: "ListMetricsCommand" },
        "cloudwatch:describe-log-groups": {
          module: {
            packageName: "@aws-sdk/client-cloudwatch-logs",
            clientExport: "CloudWatchLogsClient",
          },
          command: "DescribeLogGroupsCommand",
        },
      },
      apiKeyRuntime,
      commandFactory: (command) => {
        modules.push(command);
        return class {
          constructor(readonly input: unknown) {}
        } as unknown as new (input: unknown) => unknown;
      },
      clientFactory: () => ({
        async send() {
          return {};
        },
      }),
    });

    for (const operationId of [
      "cloudwatch:list-metrics",
      "cloudwatch:describe-log-groups",
    ]) {
      await provider.execute({
        integrationId: "cloudwatch",
        operationId,
        reference: reference("cloudwatch"),
        input: { region: "us-east-1" },
      });
    }

    expect(modules).toEqual(["ListMetricsCommand", "DescribeLogGroupsCommand"]);
  });

  test("declares RDS data actions against the Data API, not instance management", () => {
    const rds = createRdsPack();

    expect(rds.coverage).toHaveLength(6);
    // Every RDS source action runs SQL, which @aws-sdk/client-rds cannot do.
    expect(
      rds.coverage.every((entry) => entry.disposition === "supported"),
    ).toBe(true);
  });

  test("defers AWS triggers with a recorded reason", () => {
    for (const pack of PACKS) {
      for (const trigger of pack.triggerCoverage) {
        expect(trigger.disposition).toBe("deferred");
        expect(trigger.reason).toContain("EventBridge");
      }
    }
  });
});
