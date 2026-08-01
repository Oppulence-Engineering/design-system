import { z } from "zod";

import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationApiKeyRuntime } from "../../api-key-runtime";
import { createIntegrationSpecialProvider } from "../../provider-special";
import { IntegrationProviderSdkError } from "../../provider-sdk";
import type { IntegrationProviderSdk } from "../../provider-sdk";
import type { IntegrationProviderPack } from "../../provider-pack";
import { ProviderSdkInvocationSchema } from "../shared";

export type ProtocolInput = Readonly<Record<string, unknown>>;

export function protocolInvocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

export function protocolConfigurationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
  );
}

/**
 * A host an operator deliberately pointed a connection at. Unlike an HTTP
 * provider, a protocol connection has no fixed vendor host, so the target has
 * to come from somewhere — and it must not be operation input. Every protocol
 * adapter reads it from the encrypted credential instead, which is why a
 * caller cannot aim a query at an internal service by passing a different
 * host.
 */
const HostSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9._-]+$/u, "A host must be a name or address, not a URL.");

const PortSchema = z.coerce.number().int().min(1).max(65_535);

const BooleanFieldSchema = z
  .string()
  .transform((value) => value === "true" || value === "1")
  .optional();

/** PostgreSQL and MySQL share a connection shape. */
export const SqlConnectionSchema = z
  .object({
    host: HostSchema,
    port: PortSchema.optional(),
    user: z.string().min(1).max(255),
    password: z.string().max(4_096).optional(),
    database: z.string().min(1).max(255),
    ssl: BooleanFieldSchema,
  })
  .strict();

export const ClickHouseConnectionSchema = z
  .object({
    host: HostSchema,
    port: PortSchema.optional(),
    protocol: z.enum(["http", "https"]).optional(),
    username: z.string().min(1).max(255),
    password: z.string().max(4_096).optional(),
    database: z.string().min(1).max(255).optional(),
  })
  .strict();

export const RedisConnectionSchema = z
  .object({
    host: HostSchema,
    port: PortSchema.optional(),
    username: z.string().max(255).optional(),
    password: z.string().max(4_096).optional(),
    database: z.coerce.number().int().min(0).max(15).optional(),
    tls: BooleanFieldSchema,
  })
  .strict();

export const SshConnectionSchema = z
  .object({
    host: HostSchema,
    port: PortSchema.optional(),
    username: z.string().min(1).max(255),
    password: z.string().max(4_096).optional(),
    privateKey: z.string().max(16_384).optional(),
    passphrase: z.string().max(1_024).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.password ?? value.privateKey), {
    message: "An SSH connection needs a password or a private key.",
  });

export const JupyterConnectionSchema = z
  .object({
    baseUrl: z
      .string()
      .url()
      .max(2_000)
      .refine((value) => value.startsWith("https://"), {
        message: "A Jupyter server must be reached over HTTPS.",
      }),
    token: z.string().min(1).max(4_096),
  })
  .strict();

/**
 * Reads a protocol connection from the encrypted envelope. The primary key
 * carries the credential's headline secret and `fields` the rest, so a
 * connection string never has to be reassembled from operation input.
 */
export function protocolConnection<TSchema extends z.ZodType>(
  schema: TSchema,
  credential: {
    readonly apiKey: string;
    readonly fields: Readonly<Record<string, string>>;
  },
  primaryField: string,
): z.infer<TSchema> {
  const parsed = schema.safeParse({
    ...credential.fields,
    [primaryField]: credential.fields[primaryField] ?? credential.apiKey,
  });
  if (!parsed.success) {
    throw protocolConfigurationError();
  }
  return parsed.data;
}

/**
 * A SQL identifier cannot be a bound parameter, so it is validated against a
 * strict pattern and quoted for the dialect. Values always bind.
 */
export function quoteIdentifier(
  value: string,
  dialect: "postgres" | "mysql" | "clickhouse",
): string {
  if (!/^[A-Za-z_][A-Za-z0-9_$]{0,127}$/u.test(value)) {
    throw protocolInvocationError();
  }
  return dialect === "mysql" || dialect === "clickhouse"
    ? `\`${value}\``
    : `"${value}"`;
}

/** Accepts `schema.table` as well as a bare table name. */
export function quoteQualifiedName(
  value: string,
  dialect: "postgres" | "mysql" | "clickhouse",
): string {
  return value
    .split(".")
    .map((part) => quoteIdentifier(part, dialect))
    .join(".");
}

export interface ProtocolOperation<TConnection> {
  /**
   * Runs one action against an open protocol client. The adapter owns opening
   * and closing; an operation never manages the connection lifecycle.
   */
  readonly run: (context: {
    client: TConnection;
    input: ProtocolInput;
  }) => Promise<unknown>;
}

export interface ProtocolProviderSdkConfig<TConnection> {
  integrationId: string;
  operations: Readonly<Record<string, ProtocolOperation<TConnection>>>;
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  /** Opens a client from the decrypted connection settings. */
  connect: (credential: {
    readonly apiKey: string;
    readonly fields: Readonly<Record<string, string>>;
  }) => Promise<{ client: TConnection; close: () => Promise<void> }>;
}

/**
 * Builds a protocol-backed adapter. Every database, cache, shell, and
 * file-transfer provider shares this executor, so connection teardown happens
 * on every path — including a failed operation — in one place.
 */
export function createProtocolProviderSdk<TConnection>(
  config: ProtocolProviderSdkConfig<TConnection>,
): IntegrationProviderSdk {
  const operationIds = Object.freeze(Object.keys(config.operations));

  return createIntegrationSpecialProvider({
    integrationId: config.integrationId,
    operationIds,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) throw protocolInvocationError();
      const invocation = parsed.data;
      const operation = config.operations[invocation.operationId];
      if (!operation) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }

      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const connection = await config.connect(credential);
          try {
            return {
              operationId: invocation.operationId,
              output: await operation.run({
                client: connection.client,
                input: invocation.input,
              }),
            };
          } finally {
            // A leaked socket or pooled client outlives the request and
            // eventually exhausts the server; close on every path.
            await connection.close().catch(() => undefined);
          }
        },
      );
    },
  });
}

export interface ProtocolPackConfig<TConnection> extends Omit<
  ProtocolProviderSdkConfig<TConnection>,
  "apiKeyRuntime"
> {
  /** Names the driver, for the deferred-action reason. */
  driver: string;
}

/** Wraps a protocol operation table as a delivery unit. */
export function createProtocolPack<TConnection>(
  config: ProtocolPackConfig<TConnection>,
): IntegrationProviderPack {
  const baseline = SIMSTUDIO_BASELINE.integrations.find(
    (integration) => integration.id === config.integrationId,
  );
  if (!baseline) throw protocolConfigurationError();

  return {
    integrationId: config.integrationId,
    coverage: baseline.operations.map((operation) =>
      config.operations[operation.id]
        ? {
            sourceOperationId: operation.id,
            lane: "special" as const,
            disposition: "supported" as const,
          }
        : {
            sourceOperationId: operation.id,
            disposition: "deferred" as const,
            reason: `No ${config.driver} operation is mapped for this action.`,
          },
    ),
    triggerCoverage: baseline.triggers.map((trigger) => ({
      sourceTriggerId: trigger.id,
      disposition: "deferred" as const,
      reason:
        "Protocol change-feeds need a durable listener process; scheduled with the trigger family work.",
    })),
    create(context) {
      if (!context.apiKeyRuntime) return [];
      return [
        createProtocolProviderSdk({
          integrationId: config.integrationId,
          operations: config.operations,
          connect: config.connect,
          apiKeyRuntime: context.apiKeyRuntime,
        }),
      ];
    },
  };
}
