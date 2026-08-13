import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import { requireOptionalSdk } from "../shared/optional-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  requiredInputNumber,
  requiredInputRecord,
  requiredInputString,
  requiredInputStringArray,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  requiredVendorField,
  vendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/** An index, collection, or namespace name appears in the request path. */
function resourceName(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(value)) throw invocationError();
  return value;
}

// ------------------------------------------------------------------ Upstash

/**
 * Upstash speaks Redis over HTTP, so its actions mirror the Redis provider's.
 * Its SDK exposes one method per command rather than a generic sender, and the
 * escape hatch is limited to the same data-plane verbs.
 */
const UPSTASH_ALLOWED_COMMANDS = new Set([
  "APPEND",
  "DECR",
  "DECRBY",
  "DEL",
  "EXISTS",
  "EXPIRE",
  "GET",
  "GETDEL",
  "GETRANGE",
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
  "LINDEX",
  "LLEN",
  "LPOP",
  "LPUSH",
  "LRANGE",
  "LREM",
  "MGET",
  "MSET",
  "PERSIST",
  "RPOP",
  "RPUSH",
  "SADD",
  "SCARD",
  "SISMEMBER",
  "SMEMBERS",
  "SREM",
  "STRLEN",
  "TTL",
  "TYPE",
  "ZADD",
  "ZCARD",
  "ZRANGE",
  "ZREM",
  "ZSCORE",
]);

function redisKey(input: VendorInput): string {
  const value = requiredInputString(input, "key");
  if (value.length > 512) throw invocationError();
  return value;
}

const UPSTASH_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "upstash:get": { path: ["get"], params: (i) => [redisKey(i)] },
  "upstash:set": {
    path: ["set"],
    params: (i) => {
      const ttl = optionalInputNumber(i, "ttl", "expireSeconds");
      return [
        redisKey(i),
        requiredInputString(i, "value"),
        ...(ttl === undefined ? [] : [{ ex: Math.trunc(ttl) }]),
      ];
    },
  },
  "upstash:setnx": {
    path: ["setnx"],
    params: (i) => [redisKey(i), requiredInputString(i, "value")],
  },
  "upstash:delete": {
    path: ["del"],
    params: (i) => requiredInputStringArray(i, "keys", "key"),
  },
  "upstash:exists": {
    path: ["exists"],
    params: (i) => requiredInputStringArray(i, "keys", "key"),
  },
  "upstash:list-keys": {
    path: ["scan"],
    params: (i) => [
      Math.trunc(optionalInputNumber(i, "cursor") ?? 0),
      definedFields({
        match: optionalInputString(i, "pattern", "match"),
        count: optionalInputNumber(i, "count", "limit"),
      }),
    ],
  },
  "upstash:incr": { path: ["incr"], params: (i) => [redisKey(i)] },
  "upstash:incrby": {
    path: ["incrby"],
    params: (i) => [redisKey(i), requiredInputNumber(i, "increment")],
  },
  "upstash:expire": {
    path: ["expire"],
    params: (i) => [redisKey(i), requiredInputNumber(i, "seconds")],
  },
  "upstash:ttl": { path: ["ttl"], params: (i) => [redisKey(i)] },
  "upstash:hset": {
    path: ["hset"],
    params: (i) => [
      redisKey(i),
      { [requiredInputString(i, "field")]: requiredInputString(i, "value") },
    ],
  },
  "upstash:hget": {
    path: ["hget"],
    params: (i) => [redisKey(i), requiredInputString(i, "field")],
  },
  "upstash:hgetall": { path: ["hgetall"], params: (i) => [redisKey(i)] },
  "upstash:lpush": {
    path: ["lpush"],
    params: (i) => [
      redisKey(i),
      ...requiredInputStringArray(i, "values", "value"),
    ],
  },
  "upstash:lrange": {
    path: ["lrange"],
    params: (i) => [
      redisKey(i),
      Math.trunc(optionalInputNumber(i, "start") ?? 0),
      Math.trunc(optionalInputNumber(i, "stop", "end") ?? -1),
    ],
  },
  "upstash:command": {
    path: ["exec"],
    invoke: ({ client, input }) => {
      const name = requiredInputString(input, "command", "name").toUpperCase();
      if (!UPSTASH_ALLOWED_COMMANDS.has(name)) throw invocationError();
      const args = input.args ?? input.arguments ?? [];
      if (!Array.isArray(args) || args.length > 64) throw invocationError();
      const exec = (
        client as unknown as {
          exec(command: readonly unknown[]): Promise<unknown>;
        }
      ).exec;
      return exec.call(client, [name, ...args]);
    },
  },
};

/** Upstash's REST URL identifies the database; the token authenticates. */
export const createUpstashClient: VendorClientFactory = (credential) => {
  const { Redis } = requireOptionalSdk("@upstash/redis") as {
    Redis: new (config: { url: string; token: string }) => SdkMethodTarget;
  };
  return new Redis({
    url: requiredVendorField(credential, "restUrl"),
    token: vendorToken(credential),
  });
};

export function createUpstashPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "upstash",
    driver: "@upstash/redis@1.38.1",
    transportKind: "api_key",
    operations: UPSTASH_OPERATIONS,
    clientFactory: options.clientFactory ?? createUpstashClient,
  });
}
