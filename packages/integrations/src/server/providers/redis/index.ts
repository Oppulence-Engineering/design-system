import type { IntegrationProviderPack } from "../../core/provider-pack";
import { requireOptionalSdk } from "../shared/optional-sdk";
import {
  optionalInputNumber,
  optionalInputString,
  requiredInputNumber,
  requiredInputString,
  requiredInputStringArray,
} from "../shared/sdk";
import {
  createProtocolPack,
  protocolConnection,
  protocolInvocationError,
  RedisConnectionSchema,
  type ProtocolInput,
  type ProtocolOperation,
} from "../shared/clients/protocol";


export interface RedisConnection {
  send(command: readonly string[]): Promise<unknown>;
}

function key(input: ProtocolInput): string {
  return requiredInputString(input, "key");
}

/** Redis returns integers, strings, arrays, or null; all are safe to pass on. */
function command(
  build: (input: ProtocolInput) => readonly string[],
): ProtocolOperation<RedisConnection> {
  return { run: ({ client, input }) => client.send(build(input)) };
}

/**
 * Commands that mutate the server or read another tenant's data have no place
 * behind a shared connection, so the escape-hatch action allows only the
 * data-plane verbs the catalogue already exposes plus common read-only ones.
 */
const ALLOWED_RAW_COMMANDS = new Set([
  "APPEND",
  "DECR",
  "DECRBY",
  "DEL",
  "EXISTS",
  "EXPIRE",
  "EXPIREAT",
  "GET",
  "GETDEL",
  "GETRANGE",
  "GETSET",
  "HDEL",
  "HEXISTS",
  "HGET",
  "HGETALL",
  "HINCRBY",
  "HKEYS",
  "HLEN",
  "HMGET",
  "HSET",
  "HSETNX",
  "HVALS",
  "INCR",
  "INCRBY",
  "INCRBYFLOAT",
  "LINDEX",
  "LLEN",
  "LPOP",
  "LPUSH",
  "LRANGE",
  "LREM",
  "LSET",
  "MGET",
  "MSET",
  "PERSIST",
  "PEXPIRE",
  "PTTL",
  "RENAME",
  "RPOP",
  "RPUSH",
  "SADD",
  "SCARD",
  "SDIFF",
  "SET",
  "SETEX",
  "SETNX",
  "SINTER",
  "SISMEMBER",
  "SMEMBERS",
  "SREM",
  "STRLEN",
  "SUNION",
  "TTL",
  "TYPE",
  "ZADD",
  "ZCARD",
  "ZCOUNT",
  "ZINCRBY",
  "ZRANGE",
  "ZRANK",
  "ZREM",
  "ZSCORE",
]);

const REDIS_OPERATIONS: Readonly<
  Record<string, ProtocolOperation<RedisConnection>>
> = {
  "redis:get": command((input) => ["GET", key(input)]),
  "redis:set": command((input) => {
    const ttl = optionalInputNumber(input, "ttl", "expireSeconds");
    return [
      "SET",
      key(input),
      requiredInputString(input, "value"),
      ...(ttl === undefined ? [] : ["EX", String(Math.trunc(ttl))]),
    ];
  }),
  "redis:setnx": command((input) => [
    "SETNX",
    key(input),
    requiredInputString(input, "value"),
  ]),
  "redis:delete": command((input) => [
    "DEL",
    ...requiredInputStringArray(input, "keys", "key"),
  ]),
  "redis:exists": command((input) => [
    "EXISTS",
    ...requiredInputStringArray(input, "keys", "key"),
  ]),
  "redis:list-keys": command((input) => [
    // SCAN does not block the server the way KEYS does.
    "SCAN",
    String(Math.trunc(optionalInputNumber(input, "cursor") ?? 0)),
    "MATCH",
    optionalInputString(input, "pattern", "match") ?? "*",
    "COUNT",
    String(Math.trunc(optionalInputNumber(input, "count", "limit") ?? 100)),
  ]),
  "redis:incr": command((input) => ["INCR", key(input)]),
  "redis:incrby": command((input) => [
    "INCRBY",
    key(input),
    String(
      requiredInputNumber(
        input,
        input.increment === undefined ? "by" : "increment",
      ),
    ),
  ]),
  "redis:expire": command((input) => [
    "EXPIRE",
    key(input),
    String(
      requiredInputNumber(
        input,
        input.seconds === undefined ? "ttl" : "seconds",
      ),
    ),
  ]),
  "redis:persist": command((input) => ["PERSIST", key(input)]),
  "redis:ttl": command((input) => ["TTL", key(input)]),
  "redis:hset": command((input) => [
    "HSET",
    key(input),
    requiredInputString(input, "field"),
    requiredInputString(input, "value"),
  ]),
  "redis:hget": command((input) => [
    "HGET",
    key(input),
    requiredInputString(input, "field"),
  ]),
  "redis:hgetall": command((input) => ["HGETALL", key(input)]),
  "redis:hdel": command((input) => [
    "HDEL",
    key(input),
    ...requiredInputStringArray(input, "fields", "field"),
  ]),
  "redis:lpush": command((input) => [
    "LPUSH",
    key(input),
    ...requiredInputStringArray(input, "values", "value"),
  ]),
  "redis:rpush": command((input) => [
    "RPUSH",
    key(input),
    ...requiredInputStringArray(input, "values", "value"),
  ]),
  "redis:lpop": command((input) => ["LPOP", key(input)]),
  "redis:rpop": command((input) => ["RPOP", key(input)]),
  "redis:llen": command((input) => ["LLEN", key(input)]),
  "redis:lrange": command((input) => [
    "LRANGE",
    key(input),
    String(Math.trunc(optionalInputNumber(input, "start") ?? 0)),
    String(Math.trunc(optionalInputNumber(input, "stop", "end") ?? -1)),
  ]),
  "redis:command": command((input) => {
    const name = requiredInputString(input, "command", "name").toUpperCase();
    if (!ALLOWED_RAW_COMMANDS.has(name)) {
      throw protocolInvocationError();
    }
    const args = input.args ?? input.arguments ?? [];
    if (!Array.isArray(args) || args.length > 64) {
      throw protocolInvocationError();
    }
    return [
      name,
      ...args.map((value) => {
        if (typeof value === "string") return value;
        if (typeof value === "number" || typeof value === "boolean") {
          return String(value);
        }
        throw protocolInvocationError();
      }),
    ];
  }),
};

interface RedisSdkClient {
  connect(): Promise<unknown>;
  quit(): Promise<unknown>;
  sendCommand(command: string[]): Promise<unknown>;
}

export type RedisConnectionFactory = (credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}) => Promise<{ client: RedisConnection; close: () => Promise<void> }>;

async function connectRedis(credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}): Promise<{ client: RedisConnection; close: () => Promise<void> }> {
  const settings = protocolConnection(
    RedisConnectionSchema,
    credential,
    "password",
  );
  const { createClient } = requireOptionalSdk("redis") as {
    createClient(config: Record<string, unknown>): RedisSdkClient;
  };
  const client = createClient({
    socket: {
      host: settings.host,
      port: settings.port ?? 6_379,
      ...(settings.tls ? { tls: true } : {}),
      connectTimeout: 10_000,
    },
    ...(settings.username ? { username: settings.username } : {}),
    ...(settings.password ? { password: settings.password } : {}),
    ...(settings.database === undefined ? {} : { database: settings.database }),
  });
  await client.connect();
  return {
    client: {
      send: (command) => client.sendCommand([...command]),
    },
    close: async () => {
      await client.quit();
    },
  };
}

export function createRedisPack(
  options: { connect?: RedisConnectionFactory } = {},
): IntegrationProviderPack {
  return createProtocolPack<RedisConnection>({
    integrationId: "redis",
    driver: "redis",
    operations: REDIS_OPERATIONS,
    connect: options.connect ?? connectRedis,
  });
}
