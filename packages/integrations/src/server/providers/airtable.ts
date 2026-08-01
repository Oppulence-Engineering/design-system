import { createRequire } from "node:module";
import { z } from "zod";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationOAuthRuntime } from "../runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import { createIntegrationTypedRestProvider } from "../provider-rest";
import type { IntegrationProviderPack } from "../provider-pack";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  optionalInputBoolean,
  optionalInputJson,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
} from "./shared";

const airtableRequire = createRequire(import.meta.url);

interface AirtableSdkRecord {
  id?: string;
  fields?: Record<string, unknown>;
  _rawJson?: unknown;
}

interface AirtableSdkTable {
  select(input: Record<string, unknown>): { all(): Promise<unknown> };
  find(recordId: string): Promise<unknown>;
  create(
    records: readonly unknown[],
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  update(
    recordId: string,
    fields: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  update(
    records: readonly unknown[],
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  destroy(recordIds: readonly string[]): Promise<unknown>;
}

interface AirtableSdkClient {
  base(baseId: string): { table(tableId: string): AirtableSdkTable };
}

type AirtableClientFactory = (accessToken: string) => AirtableSdkClient;

export interface AirtableProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: AirtableClientFactory;
}

function createAirtableClient(accessToken: string): AirtableSdkClient {
  const Airtable = airtableRequire("airtable") as new (options: {
    apiKey: string;
  }) => AirtableSdkClient;
  return new Airtable({ apiKey: accessToken });
}

const AIRTABLE_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "airtable",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

// airtable@0.12.2 exposes the table-record API only: no metadata (bases and
// schema) endpoints and no performUpsert. These four actions are the SDK-first
// exception and run on the typed REST lane instead.
const AIRTABLE_REST_OPERATION_IDS = Object.freeze([
  "airtable:list-bases",
  "airtable:list-tables",
  "airtable:get-base-schema",
  "airtable:upsert-records",
]);

const AIRTABLE_SDK_REVIEW =
  "airtable@0.12.2 exposes only the table-record API; it has no metadata (bases/tables/schema) methods and no performUpsert.";

const AIRTABLE_SDK_OPERATION_IDS = Object.freeze(
  AIRTABLE_OPERATION_IDS.filter(
    (operationId) => !AIRTABLE_REST_OPERATION_IDS.includes(operationId),
  ),
);

function requiredAirtableRecordArray(
  input: Readonly<Record<string, unknown>>,
  field: "records" | "recordIds",
): unknown[] {
  const value = optionalInputJson(input, field);
  if (!Array.isArray(value) || !value.length || value.length > 10) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

function requiredAirtableFields(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const fields = optionalInputJson(input, "fields");
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return fields as Record<string, unknown>;
}

function airtableWriteOptions(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return definedFields({
    typecast: optionalInputBoolean(input, "typecast"),
  });
}

function airtableOutput(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(airtableOutput);
  if (!value || typeof value !== "object") return value;
  const record = value as AirtableSdkRecord;
  if (record._rawJson && typeof record._rawJson === "object") {
    return record._rawJson;
  }
  if (record.id && !record.fields) return { id: record.id, deleted: true };
  return value;
}

/**
 * Executes the Airtable actions modelled by Airtable's official SDK. Metadata
 * and upsert source actions are deliberately unavailable until the SDK adds
 * public methods for them.
 */
export function createAirtableProviderSdk(
  config: AirtableProviderSdkConfig,
): IntegrationProviderSdk {
  const clientFactory = config.clientFactory ?? createAirtableClient;
  return {
    integrationId: "airtable",
    operationIds: AIRTABLE_SDK_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "airtable" ||
        invocation.reference.integrationId !== "airtable"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      if (!AIRTABLE_SDK_OPERATION_IDS.includes(invocation.operationId)) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const input = invocation.input;
          const table = clientFactory(credential.accessToken)
            .base(requiredInputString(input, "baseId"))
            .table(requiredInputString(input, "tableId"));
          let result: unknown;
          switch (invocation.operationId) {
            case "airtable:list-records":
              result = await table
                .select(
                  definedFields({
                    maxRecords: optionalInputNumber(input, "maxRecords"),
                    filterByFormula: optionalInputString(
                      input,
                      "filterFormula",
                    ),
                  }),
                )
                .all();
              break;
            case "airtable:get-record":
              result = await table.find(requiredInputString(input, "recordId"));
              break;
            case "airtable:create-records":
              result = await table.create(
                requiredAirtableRecordArray(input, "records"),
                airtableWriteOptions(input),
              );
              break;
            case "airtable:update-record":
              result = await table.update(
                requiredInputString(input, "recordId"),
                requiredAirtableFields(input),
                airtableWriteOptions(input),
              );
              break;
            case "airtable:update-multiple-records":
              result = await table.update(
                requiredAirtableRecordArray(input, "records"),
                airtableWriteOptions(input),
              );
              break;
            case "airtable:delete-records": {
              const recordIds = requiredAirtableRecordArray(input, "recordIds");
              if (
                recordIds.some(
                  (recordId) =>
                    typeof recordId !== "string" || !recordId.trim(),
                )
              ) {
                throw new IntegrationProviderSdkError(
                  "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
                );
              }
              result = await table.destroy(recordIds as string[]);
              break;
            }
            default:
              throw new IntegrationProviderSdkError(
                "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
              );
          }
          return {
            operationId: invocation.operationId,
            output: airtableOutput(result),
          };
        },
      );
    },
  };
}

const AirtableBaseSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    permissionLevel: z.string().optional(),
  })
  .loose();

const AirtableTableSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    primaryFieldId: z.string().optional(),
    fields: z.array(z.unknown()).optional(),
    views: z.array(z.unknown()).optional(),
  })
  .loose();

export interface AirtableMetadataProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "request">;
}

/**
 * Executes the four Airtable actions the official SDK cannot reach. Airtable's
 * OAuth profile resolves these relative paths against
 * `https://api.airtable.com/v0`, so the shared executor injects the credential
 * and the pack never handles a token.
 */
export function createAirtableMetadataProviderSdk(
  config: AirtableMetadataProviderSdkConfig,
): IntegrationProviderSdk {
  return createIntegrationTypedRestProvider({
    integrationId: "airtable",
    transport: { kind: "oauth2", runtime: config.oauthRuntime },
    tools: [
      {
        id: "airtable:list-bases",
        name: "List Bases",
        description: "List all bases the authenticated user has access to",
        version: "1.0.0",
        params: {
          offset: { type: "string", visibility: "user-or-llm" },
        },
        request: {
          method: "GET",
          url: (input) =>
            input.offset
              ? `/meta/bases?offset=${encodeURIComponent(input.offset)}`
              : "/meta/bases",
          headers: () => ({ accept: "application/json" }),
          retry: { enabled: true },
        },
        inputSchema: z.object({ offset: z.string().optional() }).strict(),
        outputSchema: z
          .object({
            bases: z.array(AirtableBaseSchema),
            offset: z.string().optional(),
          })
          .strict(),
      },
      {
        id: "airtable:list-tables",
        name: "List Tables",
        description: "List all tables and their schema in an Airtable base",
        version: "1.0.0",
        params: {
          baseId: { type: "string", required: true, visibility: "user-or-llm" },
        },
        request: {
          method: "GET",
          url: (input) =>
            `/meta/bases/${encodeURIComponent(input.baseId)}/tables`,
          headers: () => ({ accept: "application/json" }),
          retry: { enabled: true },
        },
        inputSchema: z.object({ baseId: z.string().min(1) }).strict(),
        transformResponse: async (response) => {
          const body = (await response.json()) as { tables?: unknown };
          return {
            tables: Array.isArray(body.tables)
              ? body.tables.map((table) => {
                  const parsed = AirtableTableSchema.parse(table);
                  // The list projection omits per-field and per-view detail;
                  // get-base-schema is the action that returns it.
                  const { fields: _fields, views: _views, ...summary } = parsed;
                  return summary;
                })
              : [],
          };
        },
        outputSchema: z
          .object({ tables: z.array(AirtableTableSchema) })
          .strict(),
      },
      {
        id: "airtable:get-base-schema",
        name: "Get Base Schema",
        description:
          "Get the schema of all tables, fields, and views in an Airtable base",
        version: "1.0.0",
        params: {
          baseId: { type: "string", required: true, visibility: "user-or-llm" },
        },
        request: {
          method: "GET",
          url: (input) =>
            `/meta/bases/${encodeURIComponent(input.baseId)}/tables`,
          headers: () => ({ accept: "application/json" }),
          retry: { enabled: true },
        },
        inputSchema: z.object({ baseId: z.string().min(1) }).strict(),
        // A base schema carries every field and view, so it needs more than
        // the shared 256 KiB default.
        maxResponseBytes: 512 * 1024,
        outputSchema: z
          .object({ tables: z.array(AirtableTableSchema) })
          .strict(),
      },
      {
        id: "airtable:upsert-records",
        name: "Upsert Records",
        description:
          "Update existing records or create new ones in an Airtable table, matching on the specified merge fields",
        version: "1.0.0",
        params: {
          baseId: { type: "string", required: true, visibility: "user-or-llm" },
          tableId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          records: { type: "array", required: true, visibility: "user-or-llm" },
          fieldsToMergeOn: {
            type: "array",
            required: true,
            visibility: "user-or-llm",
          },
          typecast: { type: "boolean", visibility: "user-or-llm" },
        },
        request: {
          method: "PATCH",
          url: (input) =>
            `/${encodeURIComponent(input.baseId)}/${encodeURIComponent(input.tableId)}`,
          headers: () => ({ accept: "application/json" }),
          body: (input) => ({
            performUpsert: { fieldsToMergeOn: input.fieldsToMergeOn },
            records: input.records,
            ...(input.typecast === undefined
              ? {}
              : { typecast: input.typecast }),
          }),
        },
        inputSchema: z
          .object({
            baseId: z.string().min(1),
            tableId: z.string().min(1),
            // Airtable rejects batches above 10 records on this endpoint.
            records: z
              .array(z.object({ fields: z.record(z.string(), z.unknown()) }))
              .min(1)
              .max(10),
            fieldsToMergeOn: z.array(z.string().min(1)).min(1).max(3),
            typecast: z.boolean().optional(),
          })
          .strict(),
        outputSchema: z
          .object({
            records: z.array(
              z
                .object({
                  id: z.string(),
                  createdTime: z.string().optional(),
                  fields: z.record(z.string(), z.unknown()).optional(),
                })
                .loose(),
            ),
            createdRecords: z.array(z.string()).optional(),
            updatedRecords: z.array(z.string()).optional(),
          })
          .strict(),
      },
    ],
  });
}

export function getAirtableProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  return {
    operations: AIRTABLE_SDK_OPERATION_IDS.length,
    operationIds: AIRTABLE_SDK_OPERATION_IDS,
  };
}

export interface AirtablePackConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential" | "request">;
  clientFactory?: AirtableClientFactory;
}

/**
 * Airtable's complete delivery unit: the official SDK for record actions and
 * the typed REST lane for the four metadata and upsert actions it cannot
 * reach.
 */
export function createAirtablePack(): IntegrationProviderPack {
  return {
    integrationId: "airtable",
    coverage: AIRTABLE_OPERATION_IDS.map((sourceOperationId) =>
      AIRTABLE_REST_OPERATION_IDS.includes(sourceOperationId)
        ? {
            sourceOperationId,
            lane: "typed_rest" as const,
            disposition: "supported" as const,
            sdkReview: AIRTABLE_SDK_REVIEW,
          }
        : {
            sourceOperationId,
            lane: "sdk" as const,
            disposition: "supported" as const,
          },
    ),
    triggerCoverage: [
      {
        sourceTriggerId: "airtable:airtable-webhook",
        disposition: "deferred",
        reason:
          "Airtable webhooks require a per-base subscription with cursor-based payload retrieval; scheduled with the trigger family work.",
      },
    ],
    create(context) {
      if (!context.oauthRuntime) return [];
      return [
        createAirtableProviderSdk({ oauthRuntime: context.oauthRuntime }),
        createAirtableMetadataProviderSdk({
          oauthRuntime: context.oauthRuntime,
        }),
      ];
    },
  };
}
