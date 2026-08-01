import { createRequire } from "node:module";

import { IntegrationProviderSdkError } from "../../core/provider-sdk";
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
