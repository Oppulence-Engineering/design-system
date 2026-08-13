import { z } from "zod";
import { requireOptionalSdk } from "../shared/optional-sdk";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  requiredInputRecord,
  requiredInputString,
} from "../shared/sdk";
import {
  createProtocolPack,
  protocolConfigurationError,
  protocolInvocationError,
  type ProtocolInput,
  type ProtocolOperation,
} from "../shared/clients/protocol";


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
  const { MongoClient } = requireOptionalSdk("mongodb") as {
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
