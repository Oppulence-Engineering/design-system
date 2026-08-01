import { Buffer } from "node:buffer";
import { Dropbox } from "dropbox";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationOAuthRuntime } from "../runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import {
  ProviderSdkInvocationSchema,
  optionalInputJson,
  optionalInputString,
  requiredInputString,
} from "./shared";

type DropboxSdkClient = Record<
  string,
  (input?: Record<string, unknown>) => Promise<unknown>
>;

type DropboxClientFactory = (accessToken: string) => DropboxSdkClient;

export interface DropboxProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  /** Defaults to 25 MiB; package payloads stay well below Dropbox's 150 MiB single-upload limit. */
  maxFileBytes?: number;
  clientFactory?: DropboxClientFactory;
}

function createDropboxClient(accessToken: string): DropboxSdkClient {
  return new Dropbox({ accessToken }) as unknown as DropboxSdkClient;
}

const DROPBOX_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "dropbox",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

function dropboxPath(
  input: Readonly<Record<string, unknown>>,
  ...fields: readonly string[]
): string {
  for (const field of fields) {
    const value = input[field];
    if (value === "") return "";
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  throw new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

function optionalDropboxObject(
  input: Readonly<Record<string, unknown>>,
  field: string,
): Record<string, unknown> {
  const value = optionalInputJson(input, field);
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value as Record<string, unknown>;
}

function dropboxFile(
  input: Readonly<Record<string, unknown>>,
  maximumBytes: number,
): Buffer {
  const raw = input.file;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const encoded = optionalInputString(
    raw as Record<string, unknown>,
    "base64",
    "data",
    "content",
  );
  if (!encoded || !/^[A-Za-z0-9+/_=-]*$/u.test(encoded)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const data = Buffer.from(encoded, "base64");
  if (!data.byteLength || data.byteLength > maximumBytes) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return data;
}

function dropboxArgs(
  input: Readonly<Record<string, unknown>>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  // `options` is constrained to an object and merged only with the package's
  // chosen SDK method. It can never select a host, route, credential, or a
  // method outside the explicit action mapping below.
  return { ...optionalDropboxObject(input, "options"), ...defaults };
}

interface DropboxDownloadResponse {
  result?: {
    fileBinary?: Uint8Array;
    fileBlob?: { arrayBuffer(): Promise<ArrayBuffer>; type?: string };
    [key: string]: unknown;
  };
}

async function dropboxOutput(
  value: unknown,
  maximumBytes: number,
): Promise<unknown> {
  if (!value || typeof value !== "object" || !("result" in value)) {
    return value;
  }
  const result = (value as DropboxDownloadResponse).result;
  if (!result || typeof result !== "object") return result;
  const { fileBinary, fileBlob, ...metadata } = result;
  if (!fileBinary && !fileBlob) return result;
  const bytes = fileBinary
    ? Buffer.from(fileBinary)
    : Buffer.from(await fileBlob!.arrayBuffer());
  if (bytes.byteLength > maximumBytes) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  const data = bytes.toString("base64");
  return {
    ...metadata,
    file: {
      data,
      encoding: "base64",
      mimeType: fileBlob?.type || "application/octet-stream",
      byteLength: bytes.byteLength,
    },
  };
}

function callDropbox(
  client: DropboxSdkClient,
  method: string,
  input?: Record<string, unknown>,
): Promise<unknown> {
  const operation = client[method];
  if (typeof operation !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return operation(input);
}

/** All pinned Dropbox actions use Dropbox's official JavaScript SDK. */
export function createDropboxProviderSdk(
  config: DropboxProviderSdkConfig,
): IntegrationProviderSdk {
  const maximumFileBytes = config.maxFileBytes ?? 25 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maximumFileBytes) ||
    maximumFileBytes < 1_024 ||
    maximumFileBytes > 100 * 1024 * 1024
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const clientFactory = config.clientFactory ?? createDropboxClient;
  return {
    integrationId: "dropbox",
    operationIds: DROPBOX_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "dropbox" ||
        invocation.reference.integrationId !== "dropbox"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      if (!DROPBOX_OPERATION_IDS.includes(invocation.operationId)) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const input = invocation.input;
          const client = clientFactory(credential.accessToken);
          let output: unknown;
          switch (invocation.operationId) {
            case "dropbox:upload-file":
              output = await callDropbox(
                client,
                "filesUpload",
                dropboxArgs(input, {
                  path: dropboxPath(input, "path", "destinationPath"),
                  contents: dropboxFile(input, maximumFileBytes),
                }),
              );
              break;
            case "dropbox:download-file":
              output = await callDropbox(
                client,
                "filesDownload",
                dropboxArgs(input, { path: dropboxPath(input, "path") }),
              );
              break;
            case "dropbox:list-folder":
              output = await callDropbox(
                client,
                "filesListFolder",
                dropboxArgs(input, { path: dropboxPath(input, "path") }),
              );
              break;
            case "dropbox:create-folder":
              output = await callDropbox(
                client,
                "filesCreateFolderV2",
                dropboxArgs(input, { path: dropboxPath(input, "path") }),
              );
              break;
            case "dropbox:delete-file-folder":
              output = await callDropbox(
                client,
                "filesDeleteV2",
                dropboxArgs(input, { path: dropboxPath(input, "path") }),
              );
              break;
            case "dropbox:copy-file-folder":
              output = await callDropbox(
                client,
                "filesCopyV2",
                dropboxArgs(input, {
                  from_path: dropboxPath(input, "fromPath"),
                  to_path: dropboxPath(input, "toPath"),
                }),
              );
              break;
            case "dropbox:move-file-folder":
              output = await callDropbox(
                client,
                "filesMoveV2",
                dropboxArgs(input, {
                  from_path: dropboxPath(input, "fromPath"),
                  to_path: dropboxPath(input, "toPath"),
                }),
              );
              break;
            case "dropbox:get-metadata":
              output = await callDropbox(
                client,
                "filesGetMetadata",
                dropboxArgs(input, { path: dropboxPath(input, "path") }),
              );
              break;
            case "dropbox:create-shared-link":
              output = await callDropbox(
                client,
                "sharingCreateSharedLinkWithSettings",
                dropboxArgs(input, {
                  path: dropboxPath(input, "path"),
                  settings: optionalDropboxObject(input, "settings"),
                }),
              );
              break;
            case "dropbox:list-shared-links": {
              const path = optionalInputString(input, "path");
              output = await callDropbox(
                client,
                "sharingListSharedLinks",
                dropboxArgs(input, {
                  ...(path ? { path } : {}),
                }),
              );
              break;
            }
            case "dropbox:search-files":
              output = await callDropbox(
                client,
                "filesSearchV2",
                dropboxArgs(input, {
                  query: requiredInputString(input, "query"),
                }),
              );
              break;
            case "dropbox:list-revisions":
              output = await callDropbox(
                client,
                "filesListRevisions",
                dropboxArgs(input, { path: dropboxPath(input, "path") }),
              );
              break;
            case "dropbox:restore-file":
              output = await callDropbox(
                client,
                "filesRestore",
                dropboxArgs(input, {
                  path: dropboxPath(input, "path"),
                  rev: requiredInputString(input, "rev", "revision"),
                }),
              );
              break;
            default:
              throw new IntegrationProviderSdkError(
                "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
              );
          }
          return {
            operationId: invocation.operationId,
            output: await dropboxOutput(output, maximumFileBytes),
          };
        },
      );
    },
  };
}

export function getDropboxProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  return {
    operations: DROPBOX_OPERATION_IDS.length,
    operationIds: DROPBOX_OPERATION_IDS,
  };
}
