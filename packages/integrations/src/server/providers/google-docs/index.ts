import { google } from "googleapis";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputBoolean,
  optionalInputNumber,
  optionalInputString,
  requiredInputNumber,
  requiredInputString,
  sdkResponseData,
} from "../shared/sdk";

type GoogleDocsSdkClient = Record<string, unknown>;

type GoogleDocsClientFactory = (accessToken: string) => GoogleDocsSdkClient;

export interface GoogleDocsProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleDocsClientFactory;
}

function createGoogleDocsClient(accessToken: string): GoogleDocsSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return {
    docs: google.docs({ version: "v1", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

const GOOGLE_DOCS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-docs",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleDocsSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleDocsRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleDocsSdkRequest {
  return { path, arguments: [definedFields(request)] };
}

function googleDocsId(input: Readonly<Record<string, unknown>>): string {
  return (
    optionalInputString(input, "documentId") ??
    requiredInputString(input, "manualDocumentId")
  );
}

function googleDocsRange(
  input: Readonly<Record<string, unknown>>,
): Record<string, number> {
  const startIndex = requiredInputNumber(input, "startIndex");
  const endIndex = requiredInputNumber(input, "endIndex");
  if (endIndex <= startIndex) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return { startIndex, endIndex };
}

function googleDocsLocation(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const index = optionalInputNumber(input, "index");
  return index !== undefined && index >= 1
    ? { location: { index } }
    : { endOfSegmentLocation: {} };
}

function googleDocsBatchRequest(
  input: Readonly<Record<string, unknown>>,
  request: Record<string, unknown>,
): GoogleDocsSdkRequest {
  return googleDocsRequest(["docs", "documents", "batchUpdate"], {
    documentId: googleDocsId(input),
    requestBody: { requests: [request] },
  });
}

const GOOGLE_DOCS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleDocsSdkRequest
  >
> = {
  "google-docs:read-document": (input) =>
    googleDocsRequest(["docs", "documents", "get"], {
      documentId: googleDocsId(input),
    }),
  "google-docs:write-to-document": (input) =>
    googleDocsBatchRequest(input, {
      insertText: {
        endOfSegmentLocation: {},
        text: requiredInputString(input, "content"),
      },
    }),
  "google-docs:insert-text": (input) =>
    googleDocsBatchRequest(input, {
      insertText: {
        ...googleDocsLocation(input),
        text: requiredInputString(input, "text"),
      },
    }),
  "google-docs:find-replace-text": (input) =>
    googleDocsBatchRequest(input, {
      replaceAllText: {
        containsText: {
          text: requiredInputString(input, "searchText"),
          matchCase: optionalInputBoolean(input, "matchCase") ?? false,
        },
        replaceText: optionalInputString(input, "replaceText") ?? "",
      },
    }),
  "google-docs:insert-table": (input) =>
    googleDocsBatchRequest(input, {
      insertTable: {
        ...googleDocsLocation(input),
        rows: requiredInputNumber(input, "rows"),
        columns: requiredInputNumber(input, "columns"),
      },
    }),
  "google-docs:insert-image": (input) => {
    const width = optionalInputNumber(input, "width");
    const height = optionalInputNumber(input, "height");
    return googleDocsBatchRequest(input, {
      insertInlineImage: definedFields({
        ...googleDocsLocation(input),
        uri: requiredInputString(input, "imageUrl"),
        objectSize:
          width === undefined && height === undefined
            ? undefined
            : definedFields({
                width:
                  width === undefined
                    ? undefined
                    : { magnitude: width, unit: "PT" },
                height:
                  height === undefined
                    ? undefined
                    : { magnitude: height, unit: "PT" },
              }),
      }),
    });
  },
  "google-docs:insert-page-break": (input) =>
    googleDocsBatchRequest(input, {
      insertPageBreak: googleDocsLocation(input),
    }),
  "google-docs:apply-text-style": (input) => {
    const bold = optionalInputBoolean(input, "bold");
    const italic = optionalInputBoolean(input, "italic");
    const underline = optionalInputBoolean(input, "underline");
    const fontSize = optionalInputNumber(input, "fontSize");
    const fields = [
      bold === undefined ? undefined : "bold",
      italic === undefined ? undefined : "italic",
      underline === undefined ? undefined : "underline",
      fontSize === undefined ? undefined : "fontSize",
    ].filter((field): field is string => Boolean(field));
    if (!fields.length) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleDocsBatchRequest(input, {
      updateTextStyle: {
        range: googleDocsRange(input),
        textStyle: definedFields({
          bold,
          italic,
          underline,
          fontSize:
            fontSize === undefined
              ? undefined
              : { magnitude: fontSize, unit: "PT" },
        }),
        fields: fields.join(","),
      },
    });
  },
  "google-docs:apply-paragraph-style": (input) => {
    const namedStyleType = optionalInputString(input, "namedStyleType");
    const alignment = optionalInputString(input, "alignment");
    const fields = [
      namedStyleType === undefined ? undefined : "namedStyleType",
      alignment === undefined ? undefined : "alignment",
    ].filter((field): field is string => Boolean(field));
    if (!fields.length) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleDocsBatchRequest(input, {
      updateParagraphStyle: {
        range: googleDocsRange(input),
        paragraphStyle: definedFields({ namedStyleType, alignment }),
        fields: fields.join(","),
      },
    });
  },
  "google-docs:create-bullets": (input) =>
    googleDocsBatchRequest(input, {
      createParagraphBullets: {
        range: googleDocsRange(input),
        bulletPreset:
          optionalInputString(input, "bulletPreset") ??
          "BULLET_DISC_CIRCLE_SQUARE",
      },
    }),
  "google-docs:delete-bullets": (input) =>
    googleDocsBatchRequest(input, {
      deleteParagraphBullets: { range: googleDocsRange(input) },
    }),
  "google-docs:delete-content-range": (input) =>
    googleDocsBatchRequest(input, {
      deleteContentRange: { range: googleDocsRange(input) },
    }),
  "google-docs:create-named-range": (input) =>
    googleDocsBatchRequest(input, {
      createNamedRange: {
        name: requiredInputString(input, "name"),
        range: googleDocsRange(input),
      },
    }),
  "google-docs:delete-named-range": (input) => {
    const namedRangeId = optionalInputString(input, "namedRangeId");
    const name = optionalInputString(input, "namedRangeName");
    if ((!namedRangeId && !name) || (namedRangeId && name)) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleDocsBatchRequest(input, {
      deleteNamedRange: namedRangeId ? { namedRangeId } : { name },
    });
  },
};

function assertGoogleDocsOperationCoverage(): void {
  const expected = new Set(GOOGLE_DOCS_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_DOCS_OPERATION_REQUESTS);
  const specialOperations = new Set(["google-docs:create-document"]);
  if (
    expected.size !== implemented.length + specialOperations.size ||
    implemented.some((operationId) => !expected.has(operationId)) ||
    [...specialOperations].some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Docs provider SDK operation coverage is incomplete.",
    );
  }
}

async function invokeGoogleDocsCreate(
  client: GoogleDocsSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const title = requiredInputString(input, "title");
  const folderId =
    optionalInputString(input, "folderSelector") ??
    optionalInputString(input, "folderId");
  const created = await invokeSdkMethod(
    client,
    googleDocsRequest(["drive", "files", "create"], {
      requestBody: definedFields({
        name: title,
        mimeType: "application/vnd.google-apps.document",
        parents: folderId ? [folderId] : undefined,
      }),
      supportsAllDrives: true,
      fields: "id,name,mimeType,createdTime,modifiedTime,webViewLink",
    }),
  );
  const document = sdkResponseData(created);
  const record =
    document && typeof document === "object"
      ? (document as Record<string, unknown>)
      : undefined;
  const documentId = typeof record?.id === "string" ? record.id : undefined;
  if (!documentId) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const content = optionalInputString(input, "content");
  if (!content) return created;
  return invokeSdkMethod(
    client,
    googleDocsRequest(["docs", "documents", "batchUpdate"], {
      documentId,
      requestBody: {
        requests: [{ insertText: { endOfSegmentLocation: {}, text: content } }],
      },
    }),
  );
}

/** All pinned Google Docs actions use Google's official Node.js SDK. */
export function createGoogleDocsProviderSdk(
  config: GoogleDocsProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleDocsOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleDocsClient;
  return {
    integrationId: "google-docs",
    operationIds: GOOGLE_DOCS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-docs" ||
        invocation.reference.integrationId !== "google-docs"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_DOCS_OPERATION_REQUESTS[invocation.operationId];
      if (
        !requestFactory &&
        invocation.operationId !== "google-docs:create-document"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const client = clientFactory(credential.accessToken);
          const output =
            invocation.operationId === "google-docs:create-document"
              ? await invokeGoogleDocsCreate(client, invocation.input)
              : await invokeSdkMethod(
                  client,
                  requestFactory!(invocation.input),
                );
          return {
            operationId: invocation.operationId,
            output: sdkResponseData(output),
          };
        },
      );
    },
  };
}

export function getGoogleDocsProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleDocsOperationCoverage();
  return {
    operations: GOOGLE_DOCS_OPERATION_IDS.length,
    operationIds: GOOGLE_DOCS_OPERATION_IDS,
  };
}
