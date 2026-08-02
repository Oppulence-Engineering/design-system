import { Buffer } from "node:buffer";
import { google } from "googleapis";
import { z } from "zod";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputBoolean,
  optionalInputString,
  requiredInputString,
  requiredInputValue,
  sdkResponseData,
} from "../shared/sdk";

type GoogleSlidesSdkClient = Record<string, unknown>;

type GoogleSlidesClientFactory = (accessToken: string) => GoogleSlidesSdkClient;

export interface GoogleSlidesProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleSlidesClientFactory;
  /**
   * Optional product-owned file persistence seam. The package downloads and
   * bounds export bytes; the product may retain them in its own file model.
   */
  exportSink?(input: {
    bytes: Uint8Array;
    mimeType: string;
    presentationId: string;
  }): Promise<unknown>;
  /** Bounds an encoded export so the execution route never serializes an unlimited file. */
  maxExportBytes?: number;
}

function createGoogleSlidesClient(accessToken: string): GoogleSlidesSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return {
    slides: google.slides({ version: "v1", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

const GOOGLE_SLIDES_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-slides",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleSlidesSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleSlidesRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleSlidesSdkRequest {
  return { path, arguments: [definedFields(request)] };
}

function requiredGoogleSlidesRecord(
  input: Readonly<Record<string, unknown>>,
  field: string,
): Record<string, unknown> {
  const value = input[field];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value as Record<string, unknown>;
}

function googleSlidesPresentationId(
  input: Readonly<Record<string, unknown>>,
): string {
  return requiredInputString(input, "presentationId");
}

function googleSlidesBatchUpdateRequest(
  input: Readonly<Record<string, unknown>>,
  requestName?: string,
): GoogleSlidesSdkRequest {
  const requestBody = requestName
    ? {
        requests: [
          { [requestName]: requiredGoogleSlidesRecord(input, "request") },
        ],
      }
    : { requests: requiredInputValue(input, "requests") };
  if (!Array.isArray(requestBody.requests) || !requestBody.requests.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return googleSlidesRequest(["slides", "presentations", "batchUpdate"], {
    presentationId: googleSlidesPresentationId(input),
    requestBody,
  });
}

const GOOGLE_SLIDES_BATCH_REQUEST_NAMES: Readonly<Record<string, string>> = {
  "google-slides:replace-all-text": "replaceAllText",
  "google-slides:replace-all-shapes-with-image": "replaceAllShapesWithImage",
  "google-slides:replace-image": "replaceImage",
  "google-slides:update-image-properties": "updateImageProperties",
  "google-slides:add-slide": "createSlide",
  "google-slides:add-image": "createImage",
  "google-slides:delete-object": "deleteObject",
  "google-slides:duplicate-object": "duplicateObject",
  "google-slides:reorder-slides": "updateSlidesPosition",
  "google-slides:create-table": "createTable",
  "google-slides:create-shape": "createShape",
  "google-slides:create-line": "createLine",
  "google-slides:insert-text": "insertText",
  "google-slides:delete-text": "deleteText",
  "google-slides:update-text-style": "updateTextStyle",
  "google-slides:update-paragraph-style": "updateParagraphStyle",
  "google-slides:create-paragraph-bullets": "createParagraphBullets",
  "google-slides:delete-paragraph-bullets": "deleteParagraphBullets",
  "google-slides:update-shape-properties": "updateShapeProperties",
  "google-slides:update-page-properties": "updatePageProperties",
  "google-slides:update-slide-properties": "updateSlideProperties",
  "google-slides:update-alt-text": "updatePageElementAltText",
  "google-slides:update-element-transform": "updatePageElementTransform",
  "google-slides:update-z-order": "updatePageElementsZOrder",
  "google-slides:group-objects": "groupObjects",
  "google-slides:ungroup-objects": "ungroupObjects",
  "google-slides:update-line-properties": "updateLineProperties",
  "google-slides:update-line-category": "updateLineCategory",
  "google-slides:reroute-line": "rerouteLine",
  "google-slides:insert-table-rows": "insertTableRows",
  "google-slides:insert-table-columns": "insertTableColumns",
  "google-slides:delete-table-row": "deleteTableRow",
  "google-slides:delete-table-column": "deleteTableColumn",
  "google-slides:merge-table-cells": "mergeTableCells",
  "google-slides:unmerge-table-cells": "unmergeTableCells",
  "google-slides:update-table-cell-properties": "updateTableCellProperties",
  "google-slides:update-table-border-properties": "updateTableBorderProperties",
  "google-slides:update-table-column-properties": "updateTableColumnProperties",
  "google-slides:update-table-row-properties": "updateTableRowProperties",
  "google-slides:embed-sheets-chart": "createSheetsChart",
  "google-slides:refresh-sheets-chart": "refreshSheetsChart",
  "google-slides:replace-all-shapes-with-sheets-chart":
    "replaceAllShapesWithSheetsChart",
  "google-slides:embed-video": "createVideo",
  "google-slides:update-video-properties": "updateVideoProperties",
};

const GOOGLE_SLIDES_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleSlidesSdkRequest
  >
> = {
  "google-slides:read-presentation": (input) =>
    googleSlidesRequest(["slides", "presentations", "get"], {
      presentationId: googleSlidesPresentationId(input),
      fields: optionalInputString(input, "fields"),
    }),
  "google-slides:write-to-presentation": (input) =>
    googleSlidesBatchUpdateRequest(input),
  "google-slides:create-presentation": (input) =>
    googleSlidesRequest(["slides", "presentations", "create"], {
      requestBody: definedFields({
        title: requiredInputString(input, "title"),
      }),
    }),
  "google-slides:copy-presentation": (input) =>
    googleSlidesRequest(["drive", "files", "copy"], {
      fileId:
        optionalInputString(input, "sourcePresentationId") ??
        googleSlidesPresentationId(input),
      supportsAllDrives: optionalInputBoolean(input, "supportsAllDrives"),
      requestBody: definedFields({
        name: requiredInputString(input, "title"),
        parents: optionalInputString(input, "destinationFolderId")
          ? [optionalInputString(input, "destinationFolderId")]
          : undefined,
      }),
    }),
  "google-slides:export-presentation": (input) =>
    googleSlidesRequest(["drive", "files", "export"], {
      fileId: googleSlidesPresentationId(input),
      mimeType: requiredInputString(input, "mimeType"),
      responseType: "arraybuffer",
    }),
  "google-slides:batch-update-raw": (input) =>
    googleSlidesBatchUpdateRequest(input),
  "google-slides:get-thumbnail": (input) =>
    googleSlidesRequest(["slides", "presentations", "pages", "getThumbnail"], {
      presentationId: googleSlidesPresentationId(input),
      pageObjectId: requiredInputString(input, "pageObjectId"),
      "thumbnailProperties.mimeType": optionalInputString(input, "mimeType"),
      "thumbnailProperties.thumbnailSize": optionalInputString(
        input,
        "thumbnailSize",
      ),
    }),
  "google-slides:get-page": (input) =>
    googleSlidesRequest(["slides", "presentations", "pages", "get"], {
      presentationId: googleSlidesPresentationId(input),
      pageObjectId: requiredInputString(input, "pageObjectId"),
    }),
  ...Object.fromEntries(
    Object.entries(GOOGLE_SLIDES_BATCH_REQUEST_NAMES).map(
      ([operationId, requestName]) => [
        operationId,
        (input: Readonly<Record<string, unknown>>) =>
          googleSlidesBatchUpdateRequest(input, requestName),
      ],
    ),
  ),
};

function assertGoogleSlidesOperationCoverage(): void {
  const expected = new Set(GOOGLE_SLIDES_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_SLIDES_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Slides provider SDK operation coverage is incomplete.",
    );
  }
}

function googleSlidesExportOutput(
  value: unknown,
  maximumBytes: number,
): Uint8Array | unknown {
  const data = sdkResponseData(value);
  if (!data || typeof data !== "object" || !("byteLength" in data)) {
    return data;
  }
  const bytes = new Uint8Array(data as ArrayBufferLike);
  if (bytes.byteLength > maximumBytes) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return bytes;
}

/**
 * All pinned Slides actions route through Google's official client. Batch
 * actions accept the documented Google Slides Request body in `input.request`;
 * this keeps the package responsible for OAuth, client construction, and
 * atomic execution while products retain only business-level request data.
 */
export function createGoogleSlidesProviderSdk(
  config: GoogleSlidesProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleSlidesOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleSlidesClient;
  const maximumExportBytes = config.maxExportBytes ?? 25 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maximumExportBytes) ||
    maximumExportBytes < 1 ||
    maximumExportBytes > 100 * 1024 * 1024
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return {
    integrationId: "google-slides",
    operationIds: GOOGLE_SLIDES_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-slides" ||
        invocation.reference.integrationId !== "google-slides"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_SLIDES_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const result = await invokeSdkMethod(
            clientFactory(credential.accessToken),
            requestFactory(invocation.input),
          );
          if (invocation.operationId === "google-slides:export-presentation") {
            const exported = googleSlidesExportOutput(
              result,
              maximumExportBytes,
            );
            const mimeType = requiredInputString(invocation.input, "mimeType");
            const output =
              exported instanceof Uint8Array
                ? config.exportSink
                  ? await config.exportSink({
                      bytes: exported,
                      mimeType,
                      presentationId: googleSlidesPresentationId(
                        invocation.input,
                      ),
                    })
                  : {
                      encoding: "base64",
                      mimeType,
                      data: Buffer.from(exported).toString("base64"),
                    }
                : exported;
            return { operationId: invocation.operationId, output };
          }
          return {
            operationId: invocation.operationId,
            output: sdkResponseData(result),
          };
        },
      );
    },
  };
}

export function getGoogleSlidesProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleSlidesOperationCoverage();
  return {
    operations: GOOGLE_SLIDES_OPERATION_IDS.length,
    operationIds: GOOGLE_SLIDES_OPERATION_IDS,
  };
}
