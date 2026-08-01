import { google } from "googleapis";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationOAuthRuntime } from "../runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputBoolean,
  optionalInputString,
  optionalInputStringArray,
  requiredInputNumber,
  requiredInputString,
  requiredInputStringArray,
  requiredInputValue,
  sdkResponseData,
} from "./shared";

type GoogleSheetsSdkClient = Record<string, unknown>;

type GoogleSheetsClientFactory = (accessToken: string) => GoogleSheetsSdkClient;

export interface GoogleSheetsProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleSheetsClientFactory;
}

function createGoogleSheetsClient(accessToken: string): GoogleSheetsSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

const GOOGLE_SHEETS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-sheets",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleSheetsSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleSheetsRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleSheetsSdkRequest {
  return { path, arguments: [definedFields(request)] };
}

function googleSheetsRange(
  input: Readonly<Record<string, unknown>>,
  fallback: string,
): string {
  const range = optionalInputString(input, "range");
  if (range) return range;
  const sheetName = optionalInputString(input, "sheetName");
  const cellRange = optionalInputString(input, "cellRange");
  if (sheetName && cellRange) return `${sheetName}!${cellRange}`;
  if (sheetName) return sheetName;
  return fallback;
}

function googleSheetsValues(
  input: Readonly<Record<string, unknown>>,
): unknown[][] {
  const rawValues = requiredInputValue(input, "values");
  if (!Array.isArray(rawValues)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  if (
    rawValues.length > 0 &&
    rawValues[0] &&
    typeof rawValues[0] === "object" &&
    !Array.isArray(rawValues[0])
  ) {
    const records = rawValues as Array<Record<string, unknown>>;
    const headers = [
      ...new Set(records.flatMap((record) => Object.keys(record))),
    ];
    return [
      headers,
      ...records.map((record) =>
        headers.map((header) => {
          const value = record[header];
          return value && typeof value === "object"
            ? JSON.stringify(value)
            : (value ?? "");
        }),
      ),
    ];
  }
  if (rawValues.some((row) => !Array.isArray(row))) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return rawValues as unknown[][];
}

function googleSheetsValueRange(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    majorDimension: optionalInputString(input, "majorDimension") ?? "ROWS",
    values: googleSheetsValues(input),
  };
}

const GOOGLE_SHEETS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleSheetsSdkRequest
  >
> = {
  "google-sheets:read-data": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "get"], {
      spreadsheetId: requiredInputString(input, "spreadsheetId"),
      range: googleSheetsRange(input, "A1:Z1000"),
    }),
  "google-sheets:write-data": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "update"], {
      spreadsheetId: requiredInputString(input, "spreadsheetId"),
      range: googleSheetsRange(input, "Sheet1!A2"),
      valueInputOption:
        optionalInputString(input, "valueInputOption") ?? "USER_ENTERED",
      includeValuesInResponse: optionalInputBoolean(
        input,
        "includeValuesInResponse",
      ),
      responseValueRenderOption: optionalInputString(
        input,
        "responseValueRenderOption",
      ),
      requestBody: googleSheetsValueRange(input),
    }),
  "google-sheets:update-data": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "update"], {
      spreadsheetId: requiredInputString(input, "spreadsheetId"),
      range: googleSheetsRange(input, "Sheet1!A2"),
      valueInputOption:
        optionalInputString(input, "valueInputOption") ?? "USER_ENTERED",
      includeValuesInResponse: optionalInputBoolean(
        input,
        "includeValuesInResponse",
      ),
      responseValueRenderOption: optionalInputString(
        input,
        "responseValueRenderOption",
      ),
      requestBody: googleSheetsValueRange(input),
    }),
  "google-sheets:append-data": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "append"], {
      spreadsheetId: requiredInputString(input, "spreadsheetId"),
      range: googleSheetsRange(input, "Sheet1!A1"),
      valueInputOption:
        optionalInputString(input, "valueInputOption") ?? "USER_ENTERED",
      insertDataOption: optionalInputString(input, "insertDataOption"),
      includeValuesInResponse: optionalInputBoolean(
        input,
        "includeValuesInResponse",
      ),
      responseValueRenderOption: optionalInputString(
        input,
        "responseValueRenderOption",
      ),
      requestBody: googleSheetsValueRange(input),
    }),
  "google-sheets:clear-data": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "clear"], {
      spreadsheetId: requiredInputString(input, "spreadsheetId"),
      range: googleSheetsRange(input, "Sheet1"),
      requestBody: {},
    }),
  "google-sheets:get-spreadsheet-info": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "get"], {
      spreadsheetId: requiredInputString(input, "spreadsheetId"),
      includeGridData: optionalInputBoolean(input, "includeGridData"),
    }),
  "google-sheets:create-spreadsheet": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "create"], {
      requestBody: definedFields({
        properties: definedFields({
          title: requiredInputString(input, "title"),
          locale: optionalInputString(input, "locale"),
          timeZone: optionalInputString(input, "timeZone"),
        }),
        sheets: optionalInputStringArray(input, "sheetTitles")?.map(
          (title) => ({
            properties: { title },
          }),
        ),
      }),
    }),
  "google-sheets:batch-read": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "batchGet"], {
      spreadsheetId: requiredInputString(input, "spreadsheetId"),
      ranges: requiredInputStringArray(input, "ranges"),
      majorDimension: optionalInputString(input, "majorDimension"),
      valueRenderOption: optionalInputString(input, "valueRenderOption"),
      dateTimeRenderOption: optionalInputString(input, "dateTimeRenderOption"),
    }),
  "google-sheets:batch-update": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "batchUpdate"], {
      spreadsheetId: requiredInputString(input, "spreadsheetId"),
      requestBody: definedFields({
        data: requiredInputValue(input, "data"),
        valueInputOption:
          optionalInputString(input, "valueInputOption") ?? "USER_ENTERED",
        includeValuesInResponse: optionalInputBoolean(
          input,
          "includeValuesInResponse",
        ),
        responseValueRenderOption: optionalInputString(
          input,
          "responseValueRenderOption",
        ),
      }),
    }),
  "google-sheets:batch-clear": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "values", "batchClear"], {
      spreadsheetId: requiredInputString(input, "spreadsheetId"),
      requestBody: { ranges: requiredInputStringArray(input, "ranges") },
    }),
  "google-sheets:copy-sheet": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "sheets", "copyTo"], {
      spreadsheetId: requiredInputString(input, "sourceSpreadsheetId"),
      sheetId: requiredInputNumber(input, "sheetId"),
      requestBody: {
        destinationSpreadsheetId: requiredInputString(
          input,
          "destinationSpreadsheetId",
        ),
      },
    }),
  "google-sheets:delete-rows": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "batchUpdate"], {
      spreadsheetId: requiredInputString(input, "spreadsheetId"),
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: requiredInputNumber(input, "sheetId"),
                dimension: "ROWS",
                startIndex: requiredInputNumber(input, "startIndex"),
                endIndex: requiredInputNumber(input, "endIndex"),
              },
            },
          },
        ],
      },
    }),
  "google-sheets:delete-sheet": (input) =>
    googleSheetsRequest(["sheets", "spreadsheets", "batchUpdate"], {
      spreadsheetId: requiredInputString(input, "spreadsheetId"),
      requestBody: {
        requests: [
          { deleteSheet: { sheetId: requiredInputNumber(input, "sheetId") } },
        ],
      },
    }),
  "google-sheets:delete-spreadsheet": (input) =>
    googleSheetsRequest(["drive", "files", "delete"], {
      fileId: requiredInputString(input, "spreadsheetId"),
    }),
};

function assertGoogleSheetsOperationCoverage(): void {
  const expected = new Set(GOOGLE_SHEETS_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_SHEETS_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Sheets provider SDK operation coverage is incomplete.",
    );
  }
}

/** All pinned Google Sheets actions use Google's official Node.js SDK. */
export function createGoogleSheetsProviderSdk(
  config: GoogleSheetsProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleSheetsOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleSheetsClient;
  return {
    integrationId: "google-sheets",
    operationIds: GOOGLE_SHEETS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-sheets" ||
        invocation.reference.integrationId !== "google-sheets"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_SHEETS_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: sdkResponseData(
            await invokeSdkMethod(
              clientFactory(credential.accessToken),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getGoogleSheetsProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleSheetsOperationCoverage();
  return {
    operations: GOOGLE_SHEETS_OPERATION_IDS.length,
    operationIds: GOOGLE_SHEETS_OPERATION_IDS,
  };
}
