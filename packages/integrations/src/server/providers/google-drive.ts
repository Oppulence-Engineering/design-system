import { Buffer } from "node:buffer";
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
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
  sdkResponseData,
} from "./shared";

type GoogleDriveSdkClient = Record<string, unknown>;

type GoogleDriveClientFactory = (accessToken: string) => GoogleDriveSdkClient;

export interface GoogleDriveProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleDriveClientFactory;
}

function createGoogleDriveClient(accessToken: string): GoogleDriveSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({
    version: "v3",
    auth,
  }) as unknown as GoogleDriveSdkClient;
}

const GOOGLE_DRIVE_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-drive",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleDriveSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleDriveRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleDriveSdkRequest {
  return { path, arguments: [definedFields(request)] };
}

function googleDriveOptionalFolderId(
  input: Readonly<Record<string, unknown>>,
): string | undefined {
  return (
    optionalInputString(input, "folderSelector") ??
    optionalInputString(input, "folderId")
  );
}

function escapeGoogleDriveQuery(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function googleDriveListQuery(
  input: Readonly<Record<string, unknown>>,
): string {
  const conditions = ["trashed = false"];
  const folderId = googleDriveOptionalFolderId(input);
  if (folderId)
    conditions.push(`'${escapeGoogleDriveQuery(folderId)}' in parents`);
  const query = optionalInputString(input, "query");
  if (query)
    conditions.push(`name contains '${escapeGoogleDriveQuery(query)}'`);
  return conditions.join(" and ");
}

function googleDriveSearchQuery(
  input: Readonly<Record<string, unknown>>,
): string {
  const query = optionalInputString(input, "query");
  if (!query) return "trashed = false";
  return /\btrashed\s*=/u.test(query) ? query : `${query} and trashed = false`;
}

function googleDriveMediaBody(
  input: Readonly<Record<string, unknown>>,
): unknown {
  const value = input.file ?? input.content;
  if (value === undefined || value === null || value === "") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

function googleDriveResponseData(value: unknown): unknown {
  const data = sdkResponseData(value);
  if (data instanceof ArrayBuffer) {
    return {
      content: Buffer.from(data).toString("base64"),
      encoding: "base64",
    };
  }
  if (ArrayBuffer.isView(data)) {
    return {
      content: Buffer.from(
        data.buffer,
        data.byteOffset,
        data.byteLength,
      ).toString("base64"),
      encoding: "base64",
    };
  }
  return data;
}

const GOOGLE_DRIVE_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleDriveSdkRequest
  >
> = {
  "google-drive:list-files": (input) =>
    googleDriveRequest(["files", "list"], {
      q: googleDriveListQuery(input),
      pageSize: optionalInputNumber(input, "pageSize"),
      pageToken: optionalInputString(input, "pageToken"),
      fields: "files(*),nextPageToken",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }),
  "google-drive:search-files": (input) =>
    googleDriveRequest(["files", "list"], {
      q: googleDriveSearchQuery(input),
      pageSize: optionalInputNumber(input, "pageSize"),
      pageToken: optionalInputString(input, "pageToken"),
      fields: "files(*),nextPageToken",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }),
  "google-drive:get-file-info": (input) =>
    googleDriveRequest(["files", "get"], {
      fileId: requiredInputString(input, "fileId"),
      fields: "*",
      supportsAllDrives: true,
    }),
  "google-drive:get-file-content": (input) =>
    googleDriveRequest(["files", "get"], {
      fileId: requiredInputString(input, "fileId"),
      alt: "media",
      responseType: "arraybuffer",
      supportsAllDrives: true,
    }),
  "google-drive:create-folder": (input) =>
    googleDriveRequest(["files", "create"], {
      requestBody: definedFields({
        name: requiredInputString(input, "fileName"),
        mimeType: "application/vnd.google-apps.folder",
        parents: googleDriveOptionalFolderId(input)
          ? [googleDriveOptionalFolderId(input)]
          : undefined,
      }),
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:create-file": (input) =>
    googleDriveRequest(["files", "create"], {
      requestBody: definedFields({
        name: requiredInputString(input, "fileName"),
        mimeType: optionalInputString(input, "mimeType") ?? "text/plain",
        parents: googleDriveOptionalFolderId(input)
          ? [googleDriveOptionalFolderId(input)]
          : undefined,
      }),
      media: {
        mimeType: optionalInputString(input, "mimeType") ?? "text/plain",
        body: googleDriveMediaBody(input),
      },
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:upload-file": (input) =>
    googleDriveRequest(["files", "create"], {
      requestBody: definedFields({
        name: requiredInputString(input, "fileName"),
        mimeType: optionalInputString(input, "mimeType") ?? "text/plain",
        parents: googleDriveOptionalFolderId(input)
          ? [googleDriveOptionalFolderId(input)]
          : undefined,
      }),
      media: {
        mimeType: optionalInputString(input, "mimeType") ?? "text/plain",
        body: googleDriveMediaBody(input),
      },
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:download-file": (input) =>
    googleDriveRequest(["files", "get"], {
      fileId: requiredInputString(input, "fileId"),
      alt: "media",
      responseType: "arraybuffer",
      supportsAllDrives: true,
    }),
  "google-drive:copy-file": (input) =>
    googleDriveRequest(["files", "copy"], {
      fileId: requiredInputString(input, "fileId"),
      requestBody: definedFields({
        name: optionalInputString(input, "newName"),
        parents: optionalInputString(input, "destinationFolderId")
          ? [optionalInputString(input, "destinationFolderId")]
          : undefined,
      }),
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:update-file": (input) =>
    googleDriveRequest(["files", "update"], {
      fileId: requiredInputString(input, "fileId"),
      requestBody: definedFields({
        name: optionalInputString(input, "name"),
        description: optionalInputString(input, "description"),
        starred: optionalInputBoolean(input, "starred"),
      }),
      addParents: optionalInputString(input, "addParents"),
      removeParents: optionalInputString(input, "removeParents"),
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:move-to-trash": (input) =>
    googleDriveRequest(["files", "update"], {
      fileId: requiredInputString(input, "fileId"),
      requestBody: { trashed: true },
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:restore-from-trash": (input) =>
    googleDriveRequest(["files", "update"], {
      fileId: requiredInputString(input, "fileId"),
      requestBody: { trashed: false },
      supportsAllDrives: true,
      fields: "*",
    }),
  "google-drive:delete-permanently": (input) =>
    googleDriveRequest(["files", "delete"], {
      fileId: requiredInputString(input, "fileId"),
      supportsAllDrives: true,
    }),
  "google-drive:share-file": (input) =>
    googleDriveRequest(
      ["permissions", "create"],
      (() => {
        const transferOwnership = optionalInputBoolean(
          input,
          "transferOwnership",
        );
        return {
          fileId: requiredInputString(input, "fileId"),
          requestBody: definedFields({
            type: requiredInputString(input, "type"),
            role: requiredInputString(input, "role"),
            emailAddress: optionalInputString(input, "email"),
            domain: optionalInputString(input, "domain"),
          }),
          transferOwnership,
          moveToNewOwnersRoot: optionalInputBoolean(
            input,
            "moveToNewOwnersRoot",
          ),
          sendNotificationEmail:
            transferOwnership === true
              ? true
              : optionalInputBoolean(input, "sendNotification"),
          emailMessage: optionalInputString(input, "emailMessage"),
          supportsAllDrives: true,
        };
      })(),
    ),
  "google-drive:remove-sharing": (input) =>
    googleDriveRequest(["permissions", "delete"], {
      fileId: requiredInputString(input, "fileId"),
      permissionId: requiredInputString(input, "permissionId"),
      supportsAllDrives: true,
    }),
  "google-drive:list-permissions": (input) =>
    googleDriveRequest(["permissions", "list"], {
      fileId: requiredInputString(input, "fileId"),
      pageToken: optionalInputString(input, "pageToken"),
      supportsAllDrives: true,
      fields: "nextPageToken,permissions(*)",
    }),
  "google-drive:export-file": (input) =>
    googleDriveRequest(["files", "export"], {
      fileId: requiredInputString(input, "fileId"),
      mimeType: requiredInputString(input, "mimeType"),
      responseType: "arraybuffer",
    }),
  "google-drive:list-revisions": (input) =>
    googleDriveRequest(["revisions", "list"], {
      fileId: requiredInputString(input, "fileId"),
      pageSize: optionalInputNumber(input, "pageSize"),
      pageToken: optionalInputString(input, "pageToken"),
      fields: "nextPageToken,revisions(*)",
    }),
  "google-drive:get-revision": (input) =>
    googleDriveRequest(["revisions", "get"], {
      fileId: requiredInputString(input, "fileId"),
      revisionId: requiredInputString(input, "revisionId"),
      fields: "*",
    }),
  "google-drive:list-comments": (input) =>
    googleDriveRequest(["comments", "list"], {
      fileId: requiredInputString(input, "fileId"),
      includeDeleted: optionalInputBoolean(input, "includeDeleted"),
      pageSize: optionalInputNumber(input, "pageSize"),
      startModifiedTime: optionalInputString(input, "startModifiedTime"),
      pageToken: optionalInputString(input, "pageToken"),
      fields: "nextPageToken,comments(*)",
    }),
  "google-drive:create-comment": (input) =>
    googleDriveRequest(["comments", "create"], {
      fileId: requiredInputString(input, "fileId"),
      requestBody: definedFields({
        content: requiredInputString(input, "content"),
        anchor: optionalInputString(input, "anchor"),
      }),
      fields: "*",
    }),
  "google-drive:delete-comment": (input) =>
    googleDriveRequest(["comments", "delete"], {
      fileId: requiredInputString(input, "fileId"),
      commentId: requiredInputString(input, "commentId"),
    }),
  "google-drive:get-drive-info": () =>
    googleDriveRequest(["about", "get"], { fields: "*" }),
};

function assertGoogleDriveOperationCoverage(): void {
  const expected = new Set(GOOGLE_DRIVE_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_DRIVE_OPERATION_REQUESTS);
  const specialOperations = new Set(["google-drive:move-file"]);
  if (
    expected.size !== implemented.length + specialOperations.size ||
    implemented.some((operationId) => !expected.has(operationId)) ||
    [...specialOperations].some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Drive provider SDK operation coverage is incomplete.",
    );
  }
}

async function invokeGoogleDriveMove(
  client: GoogleDriveSdkClient,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const fileId = requiredInputString(input, "fileId");
  const destinationFolderId = requiredInputString(input, "destinationFolderId");
  const existing = googleDriveResponseData(
    await invokeSdkMethod(
      client,
      googleDriveRequest(["files", "get"], {
        fileId,
        fields: "parents",
        supportsAllDrives: true,
      }),
    ),
  );
  const existingRecord =
    existing && typeof existing === "object"
      ? (existing as Record<string, unknown>)
      : undefined;
  const removeParents =
    optionalInputBoolean(input, "removeFromCurrent") === false
      ? undefined
      : Array.isArray(existingRecord?.parents)
        ? existingRecord.parents
            .filter((parent): parent is string => typeof parent === "string")
            .join(",")
        : undefined;
  return invokeSdkMethod(
    client,
    googleDriveRequest(["files", "update"], {
      fileId,
      addParents: destinationFolderId,
      removeParents,
      requestBody: {},
      supportsAllDrives: true,
      fields: "*",
    }),
  );
}

/** All pinned Google Drive actions use Google's official Node.js SDK. */
export function createGoogleDriveProviderSdk(
  config: GoogleDriveProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleDriveOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleDriveClient;
  return {
    integrationId: "google-drive",
    operationIds: GOOGLE_DRIVE_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-drive" ||
        invocation.reference.integrationId !== "google-drive"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_DRIVE_OPERATION_REQUESTS[invocation.operationId];
      if (
        !requestFactory &&
        invocation.operationId !== "google-drive:move-file"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const client = clientFactory(credential.accessToken);
          const result =
            invocation.operationId === "google-drive:move-file"
              ? await invokeGoogleDriveMove(client, invocation.input)
              : await invokeSdkMethod(
                  client,
                  requestFactory!(invocation.input),
                );
          return {
            operationId: invocation.operationId,
            output: googleDriveResponseData(result),
          };
        },
      );
    },
  };
}

export function getGoogleDriveProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleDriveOperationCoverage();
  return {
    operations: GOOGLE_DRIVE_OPERATION_IDS.length,
    operationIds: GOOGLE_DRIVE_OPERATION_IDS,
  };
}
