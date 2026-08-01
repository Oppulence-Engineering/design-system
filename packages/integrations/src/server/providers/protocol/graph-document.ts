import { createRequire } from "node:module";

import { z } from "zod";

import type { IntegrationProviderPack } from "../../provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  requiredInputRecord,
  requiredInputString,
} from "../shared";
import {
  createProtocolPack,
  protocolConfigurationError,
  protocolInvocationError,
  type ProtocolInput,
  type ProtocolOperation,
} from "./client";

const driverRequire = createRequire(import.meta.url);

/**
 * MongoDB and Neo4j are drivers with a connection lifecycle, not HTTP clients,
 * so they belong on the protocol lane beside PostgreSQL rather than the vendor
 * lane the strategy map originally assigned them. Their connection string is
 * the credential, and it is never accepted as operation input.
 */
const MongoConnectionSchema = z
  .object({
    uri: z
      .string()
      .min(1)
      .max(2_048)
      .refine((value) => /^mongodb(\+srv)?:\/\//u.test(value), {
        message:
          "A MongoDB connection needs a mongodb:// or mongodb+srv:// URI.",
      }),
    database: z.string().min(1).max(128),
  })
  .strict();

const Neo4jConnectionSchema = z
  .object({
    uri: z
      .string()
      .min(1)
      .max(2_048)
      .refine((value) => /^(neo4j|bolt)(\+s|\+ssc)?:\/\//u.test(value), {
        message: "A Neo4j connection needs a neo4j:// or bolt:// URI.",
      }),
    username: z.string().min(1).max(255),
    password: z.string().min(1).max(4_096),
    database: z.string().max(128).optional(),
  })
  .strict();

// ------------------------------------------------------------------ MongoDB

export interface MongoConnection {
  collection(name: string): MongoCollection;
  listCollections(): Promise<unknown>;
}

interface MongoCollection {
  find(filter: unknown, options?: unknown): { toArray(): Promise<unknown[]> };
  insertMany(documents: readonly unknown[]): Promise<unknown>;
  updateMany(
    filter: unknown,
    update: unknown,
    options?: unknown,
  ): Promise<unknown>;
  deleteMany(filter: unknown): Promise<unknown>;
  aggregate(pipeline: readonly unknown[]): { toArray(): Promise<unknown[]> };
}

/** A collection name is part of the namespace, so it is validated. */
function collectionName(input: ProtocolInput): string {
  const value = requiredInputString(input, "collection", "collectionName");
  if (
    !/^[A-Za-z_][A-Za-z0-9_.-]{0,119}$/u.test(value) ||
    value.startsWith("system.")
  ) {
    throw protocolInvocationError();
  }
  return value;
}

function documents(input: ProtocolInput): unknown[] {
  const value = input.documents ?? input.docs ?? input.rows;
  if (!Array.isArray(value) || value.length === 0 || value.length > 1_000) {
    throw protocolInvocationError();
  }
  return value;
}

const MONGODB_OPERATIONS: Readonly<
  Record<string, ProtocolOperation<MongoConnection>>
> = {
  "mongodb:find-documents": {
    run: ({ client, input }) =>
      client
        .collection(collectionName(input))
        .find(
          optionalInputRecord(input, "filter", "query") ?? {},
          definedFields({
            projection: optionalInputRecord(input, "projection"),
            sort: optionalInputRecord(input, "sort"),
            limit: optionalInputNumber(input, "limit") ?? 100,
            skip: optionalInputNumber(input, "skip", "offset"),
          }),
        )
        .toArray(),
  },
  "mongodb:insert-documents": {
    run: ({ client, input }) =>
      client.collection(collectionName(input)).insertMany(documents(input)),
  },
  "mongodb:update-documents": {
    run: ({ client, input }) => {
      const filter = requiredInputRecord(input, "filter", "query");
      if (Object.keys(filter).length === 0) {
        // An empty filter rewrites the whole collection.
        throw protocolInvocationError();
      }
      return client
        .collection(collectionName(input))
        .updateMany(filter, requiredInputRecord(input, "update"), {
          upsert: input.upsert === true,
        });
    },
  },
  "mongodb:delete-documents": {
    run: ({ client, input }) => {
      const filter = requiredInputRecord(input, "filter", "query");
      if (Object.keys(filter).length === 0) throw protocolInvocationError();
      return client.collection(collectionName(input)).deleteMany(filter);
    },
  },
  "mongodb:aggregate-pipeline": {
    run: ({ client, input }) => {
      const pipeline = input.pipeline ?? input.stages;
      if (!Array.isArray(pipeline) || pipeline.length > 50) {
        throw protocolInvocationError();
      }
      return client
        .collection(collectionName(input))
        .aggregate(pipeline)
        .toArray();
    },
  },
  "mongodb:introspect-database": {
    run: ({ client }) => client.listCollections(),
  },
};

interface MongoSdkClient {
  connect(): Promise<unknown>;
  close(): Promise<void>;
  db(name: string): {
    collection(name: string): MongoCollection;
    listCollections(): { toArray(): Promise<unknown[]> };
  };
}

export type MongoConnectionFactory = (credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}) => Promise<{ client: MongoConnection; close: () => Promise<void> }>;

async function connectMongo(credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}): Promise<{ client: MongoConnection; close: () => Promise<void> }> {
  const parsed = MongoConnectionSchema.safeParse({
    ...credential.fields,
    uri: credential.fields.uri ?? credential.apiKey,
  });
  if (!parsed.success) throw protocolConfigurationError();
  const { MongoClient } = driverRequire("mongodb") as {
    MongoClient: new (uri: string, options?: unknown) => MongoSdkClient;
  };
  const client = new MongoClient(parsed.data.uri, {
    serverSelectionTimeoutMS: 10_000,
  });
  await client.connect();
  const database = client.db(parsed.data.database);
  return {
    client: {
      collection: (name) => database.collection(name),
      listCollections: () => database.listCollections().toArray(),
    },
    close: () => client.close(),
  };
}

export function createMongoDbPack(
  options: { connect?: MongoConnectionFactory } = {},
): IntegrationProviderPack {
  return createProtocolPack<MongoConnection>({
    integrationId: "mongodb",
    driver: "mongodb",
    operations: MONGODB_OPERATIONS,
    connect: options.connect ?? connectMongo,
  });
}

// -------------------------------------------------------------------- Neo4j

export interface Neo4jConnection {
  run(cypher: string, parameters: Record<string, unknown>): Promise<unknown>;
}

/**
 * A Cypher label or relationship type cannot be a bound parameter, so it is
 * validated as an identifier. Property values always bind.
 */
function cypherLabel(input: ProtocolInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/u.test(value)) {
    throw protocolInvocationError();
  }
  return value;
}

/** Builds `{key: $key, ...}` with every value bound. */
function propertyPattern(
  properties: Record<string, unknown>,
  prefix: string,
  parameters: Record<string, unknown>,
): string {
  const entries = Object.entries(properties);
  for (const [key] of entries) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/u.test(key)) {
      throw protocolInvocationError();
    }
  }
  for (const [key, value] of entries) parameters[`${prefix}_${key}`] = value;
  return entries.length === 0
    ? ""
    : `{${entries.map(([key]) => `${key}: $${prefix}_${key}`).join(", ")}}`;
}

const NEO4J_OPERATIONS: Readonly<
  Record<string, ProtocolOperation<Neo4jConnection>>
> = {
  "neo4j:execute-cypher": {
    run: ({ client, input }) => {
      const cypher = requiredInputString(input, "cypher", "query");
      if (cypher.length > 100_000) throw protocolInvocationError();
      return client.run(
        cypher,
        optionalInputRecord(input, "parameters", "params") ?? {},
      );
    },
  },
  "neo4j:query-match": {
    run: ({ client, input }) => {
      const parameters: Record<string, unknown> = {};
      const label = cypherLabel(input, "label", "nodeLabel");
      const pattern = propertyPattern(
        optionalInputRecord(input, "properties", "where") ?? {},
        "match",
        parameters,
      );
      const limit = optionalInputNumber(input, "limit") ?? 100;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) {
        throw protocolInvocationError();
      }
      parameters.limit = limit;
      return client.run(
        `MATCH (n:${label} ${pattern}) RETURN n LIMIT $limit`,
        parameters,
      );
    },
  },
  "neo4j:create-nodes-relationships": {
    run: ({ client, input }) => {
      const parameters: Record<string, unknown> = {};
      const label = cypherLabel(input, "label", "nodeLabel");
      const pattern = propertyPattern(
        requiredInputRecord(input, "properties"),
        "create",
        parameters,
      );
      return client.run(`CREATE (n:${label} ${pattern}) RETURN n`, parameters);
    },
  },
  "neo4j:merge-find-or-create": {
    run: ({ client, input }) => {
      const parameters: Record<string, unknown> = {};
      const label = cypherLabel(input, "label", "nodeLabel");
      const pattern = propertyPattern(
        requiredInputRecord(input, "properties", "match"),
        "merge",
        parameters,
      );
      return client.run(`MERGE (n:${label} ${pattern}) RETURN n`, parameters);
    },
  },
  "neo4j:update-properties-set": {
    run: ({ client, input }) => {
      const parameters: Record<string, unknown> = {};
      const label = cypherLabel(input, "label", "nodeLabel");
      const match = propertyPattern(
        requiredInputRecord(input, "where", "match"),
        "match",
        parameters,
      );
      const updates = requiredInputRecord(input, "set", "properties");
      const assignments = Object.entries(updates).map(([key]) => {
        if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/u.test(key)) {
          throw protocolInvocationError();
        }
        return `n.${key} = $set_${key}`;
      });
      if (assignments.length === 0) throw protocolInvocationError();
      for (const [key, value] of Object.entries(updates)) {
        parameters[`set_${key}`] = value;
      }
      return client.run(
        `MATCH (n:${label} ${match}) SET ${assignments.join(", ")} RETURN n`,
        parameters,
      );
    },
  },
  "neo4j:delete-nodes-relationships": {
    run: ({ client, input }) => {
      const parameters: Record<string, unknown> = {};
      const label = cypherLabel(input, "label", "nodeLabel");
      const where = requiredInputRecord(input, "where", "match");
      if (Object.keys(where).length === 0) {
        // Without a predicate this deletes every node of the label.
        throw protocolInvocationError();
      }
      const pattern = propertyPattern(where, "match", parameters);
      // DETACH removes attached relationships, which a bare DELETE refuses.
      return client.run(
        `MATCH (n:${label} ${pattern}) DETACH DELETE n`,
        parameters,
      );
    },
  },
  "neo4j:introspect-schema": {
    run: ({ client }) => client.run("CALL db.schema.visualization()", {}),
  },
};

interface Neo4jDriver {
  session(config?: Record<string, unknown>): {
    run(cypher: string, parameters: Record<string, unknown>): Promise<unknown>;
    close(): Promise<void>;
  };
  close(): Promise<void>;
}

export type Neo4jConnectionFactory = (credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}) => Promise<{ client: Neo4jConnection; close: () => Promise<void> }>;

async function connectNeo4j(credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}): Promise<{ client: Neo4jConnection; close: () => Promise<void> }> {
  const parsed = Neo4jConnectionSchema.safeParse({
    ...credential.fields,
    password: credential.fields.password ?? credential.apiKey,
  });
  if (!parsed.success) throw protocolConfigurationError();
  const neo4j = driverRequire("neo4j-driver") as {
    driver(uri: string, auth: unknown): Neo4jDriver;
    auth: { basic(user: string, password: string): unknown };
  };
  const driver = neo4j.driver(
    parsed.data.uri,
    neo4j.auth.basic(parsed.data.username, parsed.data.password),
  );
  const session = driver.session(
    parsed.data.database ? { database: parsed.data.database } : {},
  );
  return {
    client: { run: (cypher, parameters) => session.run(cypher, parameters) },
    close: async () => {
      await session.close();
      await driver.close();
    },
  };
}

export function createNeo4jPack(
  options: { connect?: Neo4jConnectionFactory } = {},
): IntegrationProviderPack {
  return createProtocolPack<Neo4jConnection>({
    integrationId: "neo4j",
    driver: "neo4j-driver",
    operations: NEO4J_OPERATIONS,
    connect: options.connect ?? connectNeo4j,
  });
}
