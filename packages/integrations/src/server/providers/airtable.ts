import { createRequire } from "node:module";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationOAuthRuntime } from "../runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
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

// airtable@0.12.2 exposes the table-record API only. Its public SDK does not
// cover the metadata (bases/schema) endpoints or performUpsert. Those source
// actions stay catalogue-only rather than escaping to raw REST.
const AIRTABLE_SDK_OPERATION_IDS = Object.freeze(
  AIRTABLE_OPERATION_IDS.filter(
    (operationId) =>
      ![
        "airtable:list-bases",
        "airtable:list-tables",
        "airtable:get-base-schema",
        "airtable:upsert-records",
      ].includes(operationId),
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

export function getAirtableProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  return {
    operations: AIRTABLE_SDK_OPERATION_IDS.length,
    operationIds: AIRTABLE_SDK_OPERATION_IDS,
  };
}
