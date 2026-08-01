import { createRequire } from "node:module";

import { IntegrationProviderSdkError } from "../../provider-sdk";
import type { IntegrationProviderPack } from "../../provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputRecord,
  requiredInputString,
  requiredInputStringArray,
  type SdkMethodTarget,
} from "../shared";
import {
  createVendorPack,
  requiredVendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "./client";

const supabaseRequire = createRequire(import.meta.url);

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/** A PostgREST table or bucket name appears in the path, so it is validated. */
function name(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (!/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/u.test(value)) throw invocationError();
  return value;
}

/** A storage object key may contain slashes but must not escape the bucket. */
function objectPath(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (value.length > 1_024 || value.includes("..") || value.startsWith("/")) {
    throw invocationError();
  }
  return value;
}

interface PostgrestBuilder extends PromiseLike<unknown> {
  select(columns?: string, options?: Record<string, unknown>): PostgrestBuilder;
  insert(values: unknown, options?: Record<string, unknown>): PostgrestBuilder;
  update(values: unknown): PostgrestBuilder;
  upsert(values: unknown, options?: Record<string, unknown>): PostgrestBuilder;
  delete(): PostgrestBuilder;
  eq(column: string, value: unknown): PostgrestBuilder;
  match(query: Record<string, unknown>): PostgrestBuilder;
  textSearch(
    column: string,
    query: string,
    options?: Record<string, unknown>,
  ): PostgrestBuilder;
  order(column: string, options?: Record<string, unknown>): PostgrestBuilder;
  limit(count: number): PostgrestBuilder;
  range(from: number, to: number): PostgrestBuilder;
  single(): PostgrestBuilder;
}

interface StorageBucketApi {
  upload(path: string, body: unknown, options?: unknown): Promise<unknown>;
  download(path: string): Promise<unknown>;
  list(prefix?: string, options?: unknown): Promise<unknown>;
  remove(paths: string[]): Promise<unknown>;
  move(from: string, to: string): Promise<unknown>;
  copy(from: string, to: string): Promise<unknown>;
  getPublicUrl(path: string): unknown;
  createSignedUrl(path: string, expiresIn: number): Promise<unknown>;
  createSignedUploadUrl(path: string): Promise<unknown>;
}

interface SupabaseSdkClient extends SdkMethodTarget {
  from(table: string): PostgrestBuilder;
  rpc(fn: string, args?: Record<string, unknown>): PostgrestBuilder;
  storage: {
    from(bucket: string): StorageBucketApi;
    createBucket(id: string, options?: unknown): Promise<unknown>;
    updateBucket(id: string, options?: unknown): Promise<unknown>;
    emptyBucket(id: string): Promise<unknown>;
    listBuckets(): Promise<unknown>;
    deleteBucket(id: string): Promise<unknown>;
  };
  functions: {
    invoke(name: string, options?: Record<string, unknown>): Promise<unknown>;
  };
}

function client(target: SdkMethodTarget): SupabaseSdkClient {
  return target as unknown as SupabaseSdkClient;
}

/** Applies the shared filter, ordering, and paging inputs to a query. */
function applyFilters(
  builder: PostgrestBuilder,
  input: VendorInput,
): PostgrestBuilder {
  let query = builder;
  const match = optionalInputRecord(input, "where", "match", "filters");
  if (match && Object.keys(match).length > 0) query = query.match(match);
  const orderBy = optionalInputString(input, "orderBy");
  if (orderBy) {
    query = query.order(orderBy, {
      ascending: optionalInputString(input, "orderDirection") !== "desc",
    });
  }
  const limit = optionalInputNumber(input, "limit");
  if (limit !== undefined) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) {
      throw invocationError();
    }
    query = query.limit(limit);
  }
  const offset = optionalInputNumber(input, "offset");
  if (offset !== undefined && limit !== undefined) {
    query = query.range(offset, offset + limit - 1);
  }
  return query;
}

function bucket(target: SdkMethodTarget, input: VendorInput): StorageBucketApi {
  return client(target).storage.from(name(input, "bucket", "bucketName"));
}

const SUPABASE_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "supabase:get-many-rows": {
    path: ["from"],
    invoke: ({ client: target, input }) =>
      applyFilters(
        client(target)
          .from(name(input, "table", "tableName"))
          .select(optionalInputString(input, "select", "columns") ?? "*"),
        input,
      ),
  },
  "supabase:get-a-row": {
    path: ["from"],
    invoke: ({ client: target, input }) =>
      client(target)
        .from(name(input, "table", "tableName"))
        .select(optionalInputString(input, "select", "columns") ?? "*")
        .match(requiredInputRecord(input, "where", "match"))
        .single(),
  },
  "supabase:create-a-row": {
    path: ["from"],
    invoke: ({ client: target, input }) =>
      client(target)
        .from(name(input, "table", "tableName"))
        .insert(requiredInputRecord(input, "row", "data", "values"))
        .select(),
  },
  "supabase:update-a-row": {
    path: ["from"],
    invoke: ({ client: target, input }) =>
      client(target)
        .from(name(input, "table", "tableName"))
        .update(requiredInputRecord(input, "row", "data", "values"))
        .match(requiredInputRecord(input, "where", "match"))
        .select(),
  },
  "supabase:upsert-a-row": {
    path: ["from"],
    invoke: ({ client: target, input }) =>
      client(target)
        .from(name(input, "table", "tableName"))
        .upsert(
          requiredInputRecord(input, "row", "data", "values"),
          definedFields({
            onConflict: optionalInputString(input, "onConflict"),
          }),
        )
        .select(),
  },
  "supabase:delete-a-row": {
    path: ["from"],
    invoke: ({ client: target, input }) =>
      client(target)
        .from(name(input, "table", "tableName"))
        .delete()
        // A delete with no predicate would empty the table.
        .match(requiredInputRecord(input, "where", "match"))
        .select(),
  },
  "supabase:count-rows": {
    path: ["from"],
    invoke: ({ client: target, input }) =>
      applyFilters(
        client(target)
          .from(name(input, "table", "tableName"))
          .select("*", { count: "exact", head: true }),
        input,
      ),
  },
  "supabase:full-text-search": {
    path: ["from"],
    invoke: ({ client: target, input }) =>
      applyFilters(
        client(target)
          .from(name(input, "table", "tableName"))
          .select(optionalInputString(input, "select", "columns") ?? "*")
          .textSearch(
            name(input, "column", "field"),
            requiredInputString(input, "query", "search"),
            definedFields({ type: optionalInputString(input, "searchType") }),
          ),
        input,
      ),
  },
  "supabase:vector-search": {
    path: ["rpc"],
    invoke: ({ client: target, input }) =>
      // Vector similarity is exposed through a database function, since
      // PostgREST has no operator for it.
      client(target).rpc(name(input, "functionName", "function"), {
        query_embedding: input.embedding ?? input.queryEmbedding,
        match_threshold: optionalInputNumber(input, "threshold") ?? 0.8,
        match_count: optionalInputNumber(input, "limit", "matchCount") ?? 10,
      }),
  },
  "supabase:call-rpc-function": {
    path: ["rpc"],
    invoke: ({ client: target, input }) =>
      client(target).rpc(
        name(input, "functionName", "function"),
        optionalInputRecord(input, "args", "params") ?? {},
      ),
  },
  "supabase:invoke-edge-function": {
    path: ["functions", "invoke"],
    invoke: ({ client: target, input }) =>
      client(target).functions.invoke(
        name(input, "functionName", "function"),
        definedFields({
          body: optionalInputRecord(input, "body", "payload"),
          method: optionalInputString(input, "method"),
        }),
      ),
  },
  "supabase:introspect-schema": {
    path: ["rpc"],
    invoke: ({ client: target }) =>
      // information_schema is not exposed over PostgREST by default, so this
      // reads the table list PostgREST itself publishes.
      client(target).rpc("pg_meta_tables", {}),
  },
  "supabase:storage-upload-file": {
    path: ["storage"],
    invoke: ({ client: target, input }) =>
      bucket(target, input).upload(
        objectPath(input, "path", "key"),
        requiredInputString(input, "content", "fileContent"),
        definedFields({
          contentType: optionalInputString(input, "contentType"),
          upsert: input.upsert === true,
        }),
      ),
  },
  "supabase:storage-download-file": {
    path: ["storage"],
    invoke: ({ client: target, input }) =>
      bucket(target, input).download(objectPath(input, "path", "key")),
  },
  "supabase:storage-list-files": {
    path: ["storage"],
    invoke: ({ client: target, input }) =>
      bucket(target, input).list(
        optionalInputString(input, "prefix", "path") ?? "",
        definedFields({
          limit: optionalInputNumber(input, "limit"),
          offset: optionalInputNumber(input, "offset"),
        }),
      ),
  },
  "supabase:storage-delete-files": {
    path: ["storage"],
    invoke: ({ client: target, input }) =>
      bucket(target, input).remove(
        requiredInputStringArray(input, "paths", "path").map((path) =>
          objectPath({ path }, "path"),
        ),
      ),
  },
  "supabase:storage-move-file": {
    path: ["storage"],
    invoke: ({ client: target, input }) =>
      bucket(target, input).move(
        objectPath(input, "from", "sourcePath"),
        objectPath(input, "to", "destinationPath"),
      ),
  },
  "supabase:storage-copy-file": {
    path: ["storage"],
    invoke: ({ client: target, input }) =>
      bucket(target, input).copy(
        objectPath(input, "from", "sourcePath"),
        objectPath(input, "to", "destinationPath"),
      ),
  },
  "supabase:storage-get-public-url": {
    path: ["storage"],
    invoke: async ({ client: target, input }) =>
      bucket(target, input).getPublicUrl(objectPath(input, "path", "key")),
  },
  "supabase:storage-create-signed-url": {
    path: ["storage"],
    invoke: ({ client: target, input }) =>
      bucket(target, input).createSignedUrl(
        objectPath(input, "path", "key"),
        optionalInputNumber(input, "expiresIn") ?? 3_600,
      ),
  },
  "supabase:storage-create-signed-upload-url": {
    path: ["storage"],
    invoke: ({ client: target, input }) =>
      bucket(target, input).createSignedUploadUrl(
        objectPath(input, "path", "key"),
      ),
  },
  "supabase:storage-create-bucket": {
    path: ["storage", "createBucket"],
    invoke: ({ client: target, input }) =>
      client(target).storage.createBucket(
        name(input, "bucket", "bucketName", "id"),
        definedFields({
          public: input.public === true,
          fileSizeLimit: optionalInputString(input, "fileSizeLimit"),
          allowedMimeTypes: optionalInputStringArray(input, "allowedMimeTypes"),
        }),
      ),
  },
  "supabase:storage-update-bucket": {
    path: ["storage", "updateBucket"],
    invoke: ({ client: target, input }) =>
      client(target).storage.updateBucket(
        name(input, "bucket", "bucketName", "id"),
        definedFields({
          public: input.public === true,
          fileSizeLimit: optionalInputString(input, "fileSizeLimit"),
          allowedMimeTypes: optionalInputStringArray(input, "allowedMimeTypes"),
        }),
      ),
  },
  "supabase:storage-empty-bucket": {
    path: ["storage", "emptyBucket"],
    invoke: ({ client: target, input }) =>
      client(target).storage.emptyBucket(
        name(input, "bucket", "bucketName", "id"),
      ),
  },
  "supabase:storage-list-buckets": {
    path: ["storage", "listBuckets"],
    invoke: ({ client: target }) => client(target).storage.listBuckets(),
  },
  "supabase:storage-delete-bucket": {
    path: ["storage", "deleteBucket"],
    invoke: ({ client: target, input }) =>
      client(target).storage.deleteBucket(
        name(input, "bucket", "bucketName", "id"),
      ),
  },
};

/**
 * Supabase is per-project: the project URL identifies the instance and the
 * service-role key authenticates against it. The URL is a non-secret
 * deployment value stored beside the key in the encrypted envelope.
 */
export const createSupabaseClient: VendorClientFactory = (credential) => {
  const { createClient } = supabaseRequire("@supabase/supabase-js") as {
    createClient(
      url: string,
      key: string,
      options?: Record<string, unknown>,
    ): SdkMethodTarget;
  };
  return createClient(
    requiredVendorField(credential, "projectUrl"),
    vendorToken(credential),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
};

export function createSupabasePack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "supabase",
    driver: "@supabase/supabase-js@2.111.0",
    transportKind: "api_key",
    operations: SUPABASE_OPERATIONS,
    clientFactory: options.clientFactory ?? createSupabaseClient,
  });
}
