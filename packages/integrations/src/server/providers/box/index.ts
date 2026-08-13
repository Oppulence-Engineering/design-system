import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import { requireOptionalSdk } from "../shared/optional-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";


/** Box object IDs are numeric strings. */
function boxId(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (!/^\d{1,24}$/u.test(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

/** Box treats "0" as the root folder, so an absent parent means the root. */
function parentId(input: VendorInput): string {
  return optionalInputString(input, "parentId", "folderId") === undefined
    ? "0"
    : boxId(input, "parentId", "folderId");
}

const BOX_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "box:upload-file": {
    path: ["uploads", "uploadFile"],
    params: (input) => [
      {
        attributes: {
          name: requiredInputString(input, "name", "fileName"),
          parent: { id: parentId(input) },
        },
        file: requiredInputString(input, "content", "fileContent"),
      },
    ],
  },
  "box:download-file": {
    path: ["downloads", "downloadFile"],
    params: (input) => [boxId(input, "fileId", "id")],
  },
  "box:get-file-info": {
    path: ["files", "getFileById"],
    params: (input) => [
      boxId(input, "fileId", "id"),
      definedFields({ fields: optionalInputStringArray(input, "fields") }),
    ],
  },
  "box:update-file": {
    path: ["files", "updateFileById"],
    params: (input) => [
      boxId(input, "fileId", "id"),
      definedFields({
        name: optionalInputString(input, "name"),
        description: optionalInputString(input, "description"),
        parent: optionalInputString(input, "parentId")
          ? { id: boxId(input, "parentId") }
          : undefined,
        tags: optionalInputStringArray(input, "tags"),
      }),
    ],
  },
  "box:delete-file": {
    path: ["files", "deleteFileById"],
    params: (input) => [boxId(input, "fileId", "id")],
    output: (_v, input) => ({
      fileId: boxId(input, "fileId", "id"),
      deleted: true,
    }),
  },
  "box:copy-file": {
    path: ["files", "copyFile"],
    params: (input) => [
      boxId(input, "fileId", "id"),
      definedFields({
        parent: { id: boxId(input, "destinationFolderId", "parentId") },
        name: optionalInputString(input, "name", "newName"),
      }),
    ],
  },
  "box:create-folder": {
    path: ["folders", "createFolder"],
    params: (input) => [
      {
        name: requiredInputString(input, "name", "folderName"),
        parent: { id: parentId(input) },
      },
    ],
  },
  "box:list-folder-items": {
    path: ["folders", "getFolderItems"],
    params: (input) => [
      // "0" is the root, so listing without a folder lists the account root.
      optionalInputString(input, "folderId", "id") === undefined
        ? "0"
        : boxId(input, "folderId", "id"),
      definedFields({
        limit: optionalInputNumber(input, "limit"),
        offset: optionalInputNumber(input, "offset"),
        fields: optionalInputStringArray(input, "fields"),
      }),
    ],
  },
  "box:delete-folder": {
    path: ["folders", "deleteFolderById"],
    params: (input) => [
      boxId(input, "folderId", "id"),
      definedFields({ recursive: input.recursive === true ? true : undefined }),
    ],
    output: (_v, input) => ({
      folderId: boxId(input, "folderId", "id"),
      deleted: true,
    }),
  },
  "box:search": {
    path: ["search", "searchForContent"],
    params: (input) => [
      definedFields({
        query: requiredInputString(input, "query", "search"),
        type: optionalInputString(input, "type"),
        ancestorFolderIds: optionalInputStringArray(input, "folderIds"),
        limit: optionalInputNumber(input, "limit"),
        offset: optionalInputNumber(input, "offset"),
      }),
    ],
  },
  "box:create-sign-request": {
    path: ["signRequests", "createSignRequest"],
    params: (input) => [
      definedFields({
        signers: input.signers,
        sourceFiles: optionalInputStringArray(input, "fileIds")?.map((id) => ({
          id,
          type: "file",
        })),
        parentFolder: optionalInputString(input, "parentFolderId")
          ? { id: boxId(input, "parentFolderId"), type: "folder" }
          : undefined,
        name: optionalInputString(input, "name"),
        emailSubject: optionalInputString(input, "emailSubject"),
      }),
    ],
  },
  "box:get-sign-request": {
    path: ["signRequests", "getSignRequestById"],
    params: (input) => [requiredInputString(input, "signRequestId", "id")],
  },
  "box:list-sign-requests": {
    path: ["signRequests", "getSignRequests"],
    params: (input) => [
      definedFields({
        limit: optionalInputNumber(input, "limit"),
        marker: optionalInputString(input, "marker", "cursor"),
      }),
    ],
  },
  "box:cancel-sign-request": {
    path: ["signRequests", "cancelSignRequest"],
    params: (input) => [requiredInputString(input, "signRequestId", "id")],
  },
  "box:resend-sign-request": {
    path: ["signRequests", "resendSignRequest"],
    params: (input) => [requiredInputString(input, "signRequestId", "id")],
    output: (_v, input) => ({
      signRequestId: requiredInputString(input, "signRequestId", "id"),
      resent: true,
    }),
  },
};

/** Box's generated SDK takes an auth object; a developer token is the token. */
export const createBoxClient: VendorClientFactory = (credential) => {
  const { BoxClient, BoxDeveloperTokenAuth } = requireOptionalSdk("box-typescript-sdk-gen") as {
    BoxClient: new (options: { auth: unknown }) => SdkMethodTarget;
    BoxDeveloperTokenAuth: new (options: { token: string }) => unknown;
  };
  return new BoxClient({
    auth: new BoxDeveloperTokenAuth({ token: vendorToken(credential) }),
  });
};

export function createBoxPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "box",
    driver: "box-typescript-sdk-gen@1.19.1",
    transportKind: "oauth2",
    operations: BOX_OPERATIONS,
    clientFactory: options.clientFactory ?? createBoxClient,
  });
}
