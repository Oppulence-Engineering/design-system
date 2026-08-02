import type { IntegrationProviderPack } from "../../core/provider-pack";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import {
  definedFields,
  optionalInputBoolean,
  optionalInputRecord,
  optionalInputString,
  requiredInputString,
  requiredInputValue,
} from "../shared/sdk";
import {
  createMicrosoftGraphPack,
  createMicrosoftGraphProviderSdk,
  graphSegment,
  type MicrosoftGraphClientFactory,
  type MicrosoftGraphOperation,
} from "../shared/clients/microsoft-graph";

type GraphInput = Readonly<Record<string, unknown>>;

/**
 * Workbook endpoints hang off a drive item. A workbook opened on the user's
 * own OneDrive and one opened on a SharePoint drive differ only in the prefix.
 */
function workbook(input: GraphInput): string {
  const driveId = optionalInputString(input, "driveId");
  const item = graphSegment(input, "itemId", "workbookId", "fileId");
  return driveId
    ? `/drives/${encodeURIComponent(driveId)}/items/${item}/workbook`
    : `/me/drive/items/${item}/workbook`;
}

function worksheet(input: GraphInput): string {
  return `${workbook(input)}/worksheets/${graphSegment(input, "worksheetName", "worksheetId", "sheet")}`;
}

/** An A1-style range address, or the used range when none is given. */
function range(input: GraphInput): string {
  const address = optionalInputString(input, "range", "rangeAddress");
  if (!address) return `${worksheet(input)}/usedRange`;
  return `${worksheet(input)}/range(address='${address.replace(/'/gu, "''")}')`;
}

const EXCEL_OPERATIONS: Readonly<Record<string, MicrosoftGraphOperation>> = {
  "microsoft-excel:read-data": {
    method: "GET",
    path: range,
    output: (value) => {
      const record = (value ?? {}) as Record<string, unknown>;
      return definedFields({
        address: record.address,
        rowCount: record.rowCount,
        columnCount: record.columnCount,
        values: record.values,
        formulas: record.formulas,
        numberFormat: record.numberFormat,
      });
    },
  },
  "microsoft-excel:write-data": {
    method: "PATCH",
    path: range,
    body: (input) => ({ values: requiredInputValue(input, "values") }),
  },
  "microsoft-excel:clear-range": {
    method: "POST",
    path: (input) => `${range(input)}/clear`,
    body: (input) => ({
      applyTo: optionalInputString(input, "applyTo") ?? "Contents",
    }),
    output: (_value, input) => ({
      range: optionalInputString(input, "range", "rangeAddress") ?? "usedRange",
      cleared: true,
    }),
  },
  "microsoft-excel:format-range": {
    method: "PATCH",
    path: (input) => `${range(input)}/format`,
    body: (input) =>
      definedFields({
        font: optionalInputRecord(input, "font"),
        fill: optionalInputRecord(input, "fill"),
        horizontalAlignment: optionalInputString(input, "horizontalAlignment"),
        verticalAlignment: optionalInputString(input, "verticalAlignment"),
        wrapText: optionalInputBoolean(input, "wrapText"),
        columnWidth: optionalInputRecord(input, "columnWidth"),
      }),
  },
  "microsoft-excel:create-table": {
    method: "POST",
    path: (input) => `${worksheet(input)}/tables/add`,
    body: (input) => ({
      address: requiredInputString(input, "range", "rangeAddress", "address"),
      hasHeaders: optionalInputBoolean(input, "hasHeaders") ?? true,
    }),
  },
  "microsoft-excel:sort-range": {
    method: "POST",
    path: (input) => `${range(input)}/sort/apply`,
    body: (input) => ({
      fields:
        input.fields === undefined
          ? requiredInputValue(input, "sortFields")
          : requiredInputValue(input, "fields"),
      matchCase: optionalInputBoolean(input, "matchCase") ?? false,
      hasHeaders: optionalInputBoolean(input, "hasHeaders") ?? false,
    }),
    output: (_value, input) => ({
      range: optionalInputString(input, "range", "rangeAddress") ?? "usedRange",
      sorted: true,
    }),
  },
  "microsoft-excel:delete-worksheet": {
    method: "DELETE",
    path: worksheet,
    output: (_value, input) => ({
      worksheet: requiredInputString(
        input,
        "worksheetName",
        "worksheetId",
        "sheet",
      ),
      deleted: true,
    }),
  },
};

export interface MicrosoftExcelProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: MicrosoftGraphClientFactory;
}

/** Executes the pinned Excel workbook actions through the Graph workbook API. */
export function createMicrosoftExcelProviderSdk(
  config: MicrosoftExcelProviderSdkConfig,
): IntegrationProviderSdk {
  return createMicrosoftGraphProviderSdk({
    integrationId: "microsoft-excel",
    operations: EXCEL_OPERATIONS,
    oauthRuntime: config.oauthRuntime,
    ...(config.clientFactory ? { clientFactory: config.clientFactory } : {}),
  });
}

export function createMicrosoftExcelPack(): IntegrationProviderPack {
  return createMicrosoftGraphPack({
    integrationId: "microsoft-excel",
    operations: EXCEL_OPERATIONS,
    triggerCoverage: [],
  });
}

export function getMicrosoftExcelProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  const operationIds = Object.keys(EXCEL_OPERATIONS);
  return { operations: operationIds.length, operationIds };
}
