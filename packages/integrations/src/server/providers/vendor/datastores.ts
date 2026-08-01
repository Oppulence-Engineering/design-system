import { createRequire } from "node:module";

import { IntegrationProviderSdkError } from "../../provider-sdk";
import type { IntegrationProviderPack } from "../../provider-pack";
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
} from "../shared";
import {
  createVendorPack,
  requiredVendorField,
  vendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "./client";

const datastoreRequire = createRequire(import.meta.url);

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

// ------------------------------------------------------------------ Algolia

const ALGOLIA_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "algolia:search": {
    path: ["searchSingleIndex"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        searchParams: definedFields({
          query: optionalInputString(input, "query", "search") ?? "",
          filters: optionalInputString(input, "filters"),
          hitsPerPage: optionalInputNumber(input, "limit", "hitsPerPage"),
          page: optionalInputNumber(input, "page"),
        }),
      },
    ],
  },
  "algolia:browse-records": {
    path: ["browse"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        browseParams: definedFields({
          query: optionalInputString(input, "query"),
          filters: optionalInputString(input, "filters"),
          cursor: optionalInputString(input, "cursor"),
        }),
      },
    ],
  },
  "algolia:add-record": {
    path: ["saveObject"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        body: requiredInputRecord(input, "record", "object", "body"),
      },
    ],
  },
  "algolia:get-record": {
    path: ["getObject"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        objectID: requiredInputString(input, "objectID", "objectId", "id"),
      },
    ],
  },
  "algolia:get-records": {
    path: ["getObjects"],
    params: (input) => [
      {
        requests: requiredInputStringArray(input, "objectIDs", "ids").map(
          (objectID) => ({
            indexName: resourceName(input, "index", "indexName"),
            objectID,
          }),
        ),
      },
    ],
  },
  "algolia:partial-update-record": {
    path: ["partialUpdateObject"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        objectID: requiredInputString(input, "objectID", "objectId", "id"),
        attributesToUpdate: requiredInputRecord(input, "attributes", "record"),
        createIfNotExists: input.createIfNotExists !== false,
      },
    ],
  },
  "algolia:delete-record": {
    path: ["deleteObject"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        objectID: requiredInputString(input, "objectID", "objectId", "id"),
      },
    ],
  },
  "algolia:batch-operations": {
    path: ["batch"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        batchWriteParams: { requests: input.requests ?? input.operations },
      },
    ],
  },
  "algolia:delete-by-filter": {
    path: ["deleteBy"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        deleteByParams: definedFields({
          filters: requiredInputString(input, "filters"),
        }),
      },
    ],
  },
  "algolia:clear-records": {
    path: ["clearObjects"],
    params: (input) => [
      { indexName: resourceName(input, "index", "indexName") },
    ],
  },
  "algolia:list-indices": { path: ["listIndices"] },
  "algolia:get-settings": {
    path: ["getSettings"],
    params: (input) => [
      { indexName: resourceName(input, "index", "indexName") },
    ],
  },
  "algolia:update-settings": {
    path: ["setSettings"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        indexSettings: requiredInputRecord(input, "settings"),
      },
    ],
  },
  "algolia:delete-index": {
    path: ["deleteIndex"],
    params: (input) => [
      { indexName: resourceName(input, "index", "indexName") },
    ],
    output: (_v, input) => ({
      index: resourceName(input, "index", "indexName"),
      deleted: true,
    }),
  },
  "algolia:copy-move-index": {
    path: ["operationIndex"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        operationIndexParams: {
          operation: optionalInputString(input, "operation") ?? "copy",
          destination: resourceName(input, "destination", "destinationIndex"),
        },
      },
    ],
  },
  "algolia:get-task-status": {
    path: ["getTask"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        taskID: requiredInputNumber(input, "taskID"),
      },
    ],
  },
};

/** Algolia's write key is the secret; the application ID identifies the app. */
export const createAlgoliaClient: VendorClientFactory = (credential) => {
  const { algoliasearch } = datastoreRequire("algoliasearch") as {
    algoliasearch(appId: string, apiKey: string): SdkMethodTarget;
  };
  return algoliasearch(
    requiredVendorField(credential, "applicationId"),
    vendorToken(credential),
  );
};

export function createAlgoliaPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "algolia",
    driver: "algoliasearch@5.56.0",
    transportKind: "api_key",
    operations: ALGOLIA_OPERATIONS,
    clientFactory: options.clientFactory ?? createAlgoliaClient,
  });
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
  const { Redis } = datastoreRequire("@upstash/redis") as {
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

// ----------------------------------------------------------------- Pinecone

interface PineconeClient extends SdkMethodTarget {
  index(name: string): PineconeIndex;
  listIndexes(): Promise<unknown>;
  describeIndex(name: string): Promise<unknown>;
  inference: {
    embed(model: string, inputs: unknown, params: unknown): Promise<unknown>;
  };
}

interface PineconeIndex {
  namespace(name: string): PineconeIndex;
  upsert(vectors: unknown): Promise<unknown>;
  update(vector: unknown): Promise<unknown>;
  deleteMany(ids: unknown): Promise<unknown>;
  query(request: unknown): Promise<unknown>;
  fetch(ids: readonly string[]): Promise<unknown>;
  listPaginated(options?: unknown): Promise<unknown>;
  describeIndexStats(): Promise<unknown>;
  upsertRecords(records: unknown): Promise<unknown>;
  searchRecords(request: unknown): Promise<unknown>;
}

/** Resolves the index, and its namespace when one is given. */
function pineconeIndex(
  client: SdkMethodTarget,
  input: VendorInput,
): PineconeIndex {
  const index = (client as unknown as PineconeClient).index(
    resourceName(input, "index", "indexName"),
  );
  const namespace = optionalInputString(input, "namespace");
  return namespace ? index.namespace(resourceName(input, "namespace")) : index;
}

const PINECONE_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "pinecone:list-indexes": { path: ["listIndexes"] },
  "pinecone:describe-index": {
    path: ["describeIndex"],
    params: (i) => [resourceName(i, "index", "indexName")],
  },
  "pinecone:describe-index-stats": {
    path: ["index"],
    invoke: ({ client, input }) =>
      pineconeIndex(client, input).describeIndexStats(),
  },
  "pinecone:generate-embeddings": {
    path: ["inference", "embed"],
    params: (i) => [
      requiredInputString(i, "model"),
      requiredInputStringArray(i, "inputs", "texts", "text"),
      definedFields({ inputType: optionalInputString(i, "inputType") }),
    ],
  },
  "pinecone:upsert-text": {
    path: ["index"],
    invoke: ({ client, input }) =>
      pineconeIndex(client, input).upsertRecords(
        input.records ?? input.texts ?? [],
      ),
  },
  "pinecone:update-vector": {
    path: ["index"],
    invoke: ({ client, input }) =>
      pineconeIndex(client, input).update(
        definedFields({
          id: requiredInputString(input, "id", "vectorId"),
          values: input.values ?? input.vector,
          metadata: optionalInputRecord(input, "metadata"),
        }),
      ),
  },
  "pinecone:delete-vectors": {
    path: ["index"],
    invoke: ({ client, input }) =>
      pineconeIndex(client, input).deleteMany(
        requiredInputStringArray(input, "ids", "vectorIds", "id"),
      ),
  },
  "pinecone:fetch-vectors": {
    path: ["index"],
    invoke: ({ client, input }) =>
      pineconeIndex(client, input).fetch(
        requiredInputStringArray(input, "ids", "vectorIds", "id"),
      ),
  },
  "pinecone:list-vector-ids": {
    path: ["index"],
    invoke: ({ client, input }) =>
      pineconeIndex(client, input).listPaginated(
        definedFields({
          prefix: optionalInputString(input, "prefix"),
          limit: optionalInputNumber(input, "limit"),
          paginationToken: optionalInputString(input, "cursor"),
        }),
      ),
  },
  "pinecone:search-with-vector": {
    path: ["index"],
    invoke: ({ client, input }) =>
      pineconeIndex(client, input).query(
        definedFields({
          vector: input.vector ?? input.values,
          topK: optionalInputNumber(input, "topK", "limit") ?? 10,
          filter: optionalInputRecord(input, "filter"),
          includeMetadata: input.includeMetadata !== false,
          includeValues: input.includeValues === true,
        }),
      ),
  },
  "pinecone:search-with-text": {
    path: ["index"],
    invoke: ({ client, input }) =>
      pineconeIndex(client, input).searchRecords({
        query: definedFields({
          topK: optionalInputNumber(input, "topK", "limit") ?? 10,
          inputs: { text: requiredInputString(input, "text", "query") },
          filter: optionalInputRecord(input, "filter"),
        }),
      }),
  },
};

export const createPineconeClient: VendorClientFactory = (credential) => {
  const { Pinecone } = datastoreRequire("@pinecone-database/pinecone") as {
    Pinecone: new (config: { apiKey: string }) => SdkMethodTarget;
  };
  return new Pinecone({ apiKey: vendorToken(credential) });
};

export function createPineconePack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "pinecone",
    driver: "@pinecone-database/pinecone@8.2.0",
    transportKind: "api_key",
    operations: PINECONE_OPERATIONS,
    clientFactory: options.clientFactory ?? createPineconeClient,
  });
}

// ------------------------------------------------------------------- Qdrant

const QDRANT_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "qdrant:upsert": {
    path: ["upsert"],
    params: (i) => [
      resourceName(i, "collection", "collectionName"),
      { wait: true, points: i.points ?? i.vectors },
    ],
  },
  "qdrant:search": {
    path: ["search"],
    params: (i) => [
      resourceName(i, "collection", "collectionName"),
      definedFields({
        vector: i.vector ?? i.values,
        limit: optionalInputNumber(i, "limit", "topK") ?? 10,
        filter: optionalInputRecord(i, "filter"),
        with_payload: i.withPayload !== false,
      }),
    ],
  },
  "qdrant:fetch": {
    path: ["retrieve"],
    params: (i) => [
      resourceName(i, "collection", "collectionName"),
      {
        ids: requiredInputStringArray(i, "ids", "id"),
        with_payload: i.withPayload !== false,
      },
    ],
  },
};

/** Qdrant is self-hosted or cloud, so the URL comes from the connection. */
export const createQdrantClient: VendorClientFactory = (credential) => {
  const { QdrantClient } = datastoreRequire("@qdrant/js-client-rest") as {
    QdrantClient: new (config: {
      url: string;
      apiKey?: string;
    }) => SdkMethodTarget;
  };
  return new QdrantClient({
    url: requiredVendorField(credential, "url"),
    apiKey: vendorToken(credential),
  });
};

export function createQdrantPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "qdrant",
    driver: "@qdrant/js-client-rest@1.18.0",
    transportKind: "api_key",
    operations: QDRANT_OPERATIONS,
    clientFactory: options.clientFactory ?? createQdrantClient,
  });
}

// ------------------------------------------------------------ Elasticsearch

const ELASTICSEARCH_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "elasticsearch:search": {
    path: ["search"],
    params: (i) => [
      definedFields({
        index: resourceName(i, "index", "indexName"),
        query: optionalInputRecord(i, "query") ?? { match_all: {} },
        size: optionalInputNumber(i, "size", "limit"),
        from: optionalInputNumber(i, "from", "offset"),
        sort: i.sort,
      }),
    ],
  },
  "elasticsearch:count-documents": {
    path: ["count"],
    params: (i) => [
      definedFields({
        index: resourceName(i, "index", "indexName"),
        query: optionalInputRecord(i, "query"),
      }),
    ],
  },
  "elasticsearch:index-document": {
    path: ["index"],
    params: (i) => [
      definedFields({
        index: resourceName(i, "index", "indexName"),
        id: optionalInputString(i, "id", "documentId"),
        document: requiredInputRecord(i, "document", "body"),
        refresh: i.refresh === true ? true : undefined,
      }),
    ],
  },
  "elasticsearch:get-document": {
    path: ["get"],
    params: (i) => [
      {
        index: resourceName(i, "index", "indexName"),
        id: requiredInputString(i, "id", "documentId"),
      },
    ],
  },
  "elasticsearch:update-document": {
    path: ["update"],
    params: (i) => [
      {
        index: resourceName(i, "index", "indexName"),
        id: requiredInputString(i, "id", "documentId"),
        doc: requiredInputRecord(i, "document", "doc", "body"),
      },
    ],
  },
  "elasticsearch:delete-document": {
    path: ["delete"],
    params: (i) => [
      {
        index: resourceName(i, "index", "indexName"),
        id: requiredInputString(i, "id", "documentId"),
      },
    ],
  },
  "elasticsearch:bulk-operations": {
    path: ["bulk"],
    params: (i) => [
      definedFields({
        index: optionalInputString(i, "index", "indexName"),
        operations: i.operations ?? i.body,
        refresh: i.refresh === true ? true : undefined,
      }),
    ],
  },
  "elasticsearch:create-index": {
    path: ["indices", "create"],
    params: (i) => [
      definedFields({
        index: resourceName(i, "index", "indexName"),
        mappings: optionalInputRecord(i, "mappings"),
        settings: optionalInputRecord(i, "settings"),
      }),
    ],
  },
  "elasticsearch:delete-index": {
    path: ["indices", "delete"],
    params: (i) => [{ index: resourceName(i, "index", "indexName") }],
    output: (_v, i) => ({
      index: resourceName(i, "index", "indexName"),
      deleted: true,
    }),
  },
  "elasticsearch:get-index-info": {
    path: ["indices", "get"],
    params: (i) => [{ index: resourceName(i, "index", "indexName") }],
  },
  "elasticsearch:list-indices": {
    path: ["cat", "indices"],
    params: () => [{ format: "json" }],
  },
  "elasticsearch:cluster-health": { path: ["cluster", "health"] },
  "elasticsearch:cluster-stats": { path: ["cluster", "stats"] },
};

/**
 * Elasticsearch is self-hosted or Elastic Cloud, so the node URL comes from
 * the connection. Either an API key or a cloud ID plus key identifies it.
 */
export const createElasticsearchClient: VendorClientFactory = (credential) => {
  const { Client } = datastoreRequire("@elastic/elasticsearch") as {
    Client: new (config: Record<string, unknown>) => SdkMethodTarget;
  };
  const cloudId = vendorField(credential, "cloudId");
  return new Client({
    ...(cloudId
      ? { cloud: { id: cloudId } }
      : { node: requiredVendorField(credential, "node") }),
    auth: { apiKey: vendorToken(credential) },
    requestTimeout: 30_000,
  });
};

export function createElasticsearchPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "elasticsearch",
    driver: "@elastic/elasticsearch@9.4.3",
    transportKind: "api_key",
    operations: ELASTICSEARCH_OPERATIONS,
    clientFactory: options.clientFactory ?? createElasticsearchClient,
  });
}
