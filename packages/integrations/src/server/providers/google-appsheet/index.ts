import { createRequire } from "node:module";

import { z } from "zod";

import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import { createIntegrationTypedRestProvider } from "../../core/provider-rest";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import type { IntegrationApiKeyRuntime } from "../../runtime/api-key";
import {
  definedFields,
  optionalInputNumber,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
  requiredInputStringArray,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  requiredVendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";

const mapsRequire = createRequire(import.meta.url);

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

// ------------------------------------------------------------ Google AppSheet

const APPSHEET_SDK_REVIEW =
  "AppSheet is not a googleapis service and has no published Node SDK; its API is a single Action endpoint per table.";

const AppSheetRowsSchema = z
  .object({
    appId: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9._-]+$/u),
    tableName: z.string().min(1).max(128),
    rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
    properties: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const AppSheetResponseSchema = z
  .object({ Rows: z.array(z.record(z.string(), z.unknown())) })
  .loose();

/**
 * Every AppSheet action posts to the same table endpoint and differs only in
 * the Action field, so the four source actions share one request shape.
 */
function appSheetTool(
  id: string,
  name: string,
  description: string,
  action: "Find" | "Add" | "Edit" | "Delete",
) {
  return {
    id,
    name,
    description,
    version: "1.0.0",
    params: {
      appId: {
        type: "string",
        required: true,
        visibility: "user-or-llm" as const,
      },
      tableName: {
        type: "string",
        required: true,
        visibility: "user-or-llm" as const,
      },
      rows: {
        type: "array",
        required: action !== "Find",
        visibility: "user-or-llm" as const,
      },
      properties: { type: "object", visibility: "user-or-llm" as const },
    },
    request: {
      method: "POST" as const,
      url: (input: { appId: string; tableName: string }) =>
        `/api/v2/apps/${encodeURIComponent(input.appId)}/tables/${encodeURIComponent(input.tableName)}/Action`,
      headers: () => ({ accept: "application/json" }),
      body: (input: {
        rows?: unknown[];
        properties?: Record<string, unknown>;
      }) => ({
        Action: action,
        Properties: input.properties ?? {},
        Rows: input.rows ?? [],
      }),
    },
    inputSchema:
      action === "Find"
        ? AppSheetRowsSchema.extend({
            rows: AppSheetRowsSchema.shape.rows.optional(),
          })
        : AppSheetRowsSchema,
    outputSchema: AppSheetResponseSchema,
    maxResponseBytes: 512 * 1024,
  };
}

export interface GoogleAppSheetProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "request">;
}

export function createGoogleAppSheetProviderSdk(
  config: GoogleAppSheetProviderSdkConfig,
): IntegrationProviderSdk {
  return createIntegrationTypedRestProvider({
    integrationId: "google-appsheet",
    transport: { kind: "api_key", runtime: config.apiKeyRuntime },
    tools: [
      appSheetTool(
        "google-appsheet:find-rows",
        "Find Rows",
        "Read rows from an AppSheet table.",
        "Find",
      ),
      appSheetTool(
        "google-appsheet:add-rows",
        "Add Rows",
        "Add new rows to an AppSheet table.",
        "Add",
      ),
      appSheetTool(
        "google-appsheet:edit-rows",
        "Edit Rows",
        "Update existing rows in an AppSheet table.",
        "Edit",
      ),
      appSheetTool(
        "google-appsheet:delete-rows",
        "Delete Rows",
        "Delete rows from an AppSheet table.",
        "Delete",
      ),
    ],
  });
}

export function createGoogleAppSheetPack(): IntegrationProviderPack {
  const ids = [
    "google-appsheet:find-rows",
    "google-appsheet:add-rows",
    "google-appsheet:edit-rows",
    "google-appsheet:delete-rows",
  ];
  return {
    integrationId: "google-appsheet",
    coverage: ids.map((sourceOperationId) => ({
      sourceOperationId,
      lane: "typed_rest" as const,
      disposition: "supported" as const,
      sdkReview: APPSHEET_SDK_REVIEW,
    })),
    triggerCoverage: [],
    create(context) {
      if (!context.apiKeyRuntime) return [];
      return [
        createGoogleAppSheetProviderSdk({
          apiKeyRuntime: context.apiKeyRuntime,
        }),
      ];
    },
  };
}
