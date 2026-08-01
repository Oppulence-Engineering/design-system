import type { IntegrationProviderPack } from "../../core/provider-pack";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import {
  definedFields,
  optionalInputString,
  requiredInputString,
} from "../shared/sdk";
import {
  createMicrosoftGraphPack,
  createMicrosoftGraphProviderSdk,
  graphSegment,
  optionalGraphSegment,
  type MicrosoftGraphClientFactory,
  type MicrosoftGraphOperation,
} from "../shared/clients/microsoft-graph";
import {
  graphCollectionQuery,
  graphEntityQuery,
} from "../shared/clients/microsoft-graph-query";

type GraphInput = Readonly<Record<string, unknown>>;

/**
 * Resolves a drive item to its Graph path. Graph addresses the root and a
 * child item differently, and `itemId` always wins over a folder path.
 */
function itemPath(input: GraphInput, ...names: string[]): string {
  const itemId = optionalGraphSegment(input, ...names);
  return itemId ? `/me/drive/items/${itemId}` : "/me/drive/root";
}

function parentPath(input: GraphInput): string {
  return itemPath(input, "parentId", "folderId", "parentFolderId");
}

const ONEDRIVE_OPERATIONS: Readonly<Record<string, MicrosoftGraphOperation>> = {
  "onedrive:create-folder": {
    method: "POST",
    path: (input) => `${parentPath(input)}/children`,
    body: (input) => ({
      name: requiredInputString(input, "folderName", "name"),
      folder: {},
      // Graph requires this annotation on a folder create.
      "@microsoft.graph.conflictBehavior":
        optionalInputString(input, "conflictBehavior") ?? "rename",
    }),
  },
  "onedrive:create-file": {
    method: "PUT",
    path: (input) =>
      `${parentPath(input)}:/${encodeURIComponent(requiredInputString(input, "fileName", "name"))}:/content`,
    body: (input) => requiredInputString(input, "content", "body"),
  },
  "onedrive:upload-file": {
    method: "PUT",
    path: (input) =>
      `${parentPath(input)}:/${encodeURIComponent(requiredInputString(input, "fileName", "name"))}:/content`,
    body: (input) => requiredInputString(input, "content", "fileContent"),
  },
  "onedrive:download-file": {
    method: "GET",
    path: (input) => `${itemPath(input, "itemId", "fileId")}/content`,
    responseType: "text",
    output: (value, input) => ({
      itemId: requiredInputString(input, "itemId", "fileId"),
      content: typeof value === "string" ? value : String(value ?? ""),
    }),
  },
  "onedrive:list-files": {
    method: "GET",
    path: (input) => `${itemPath(input, "folderId", "itemId")}/children`,
    query: graphCollectionQuery,
  },
  "onedrive:search-files": {
    method: "GET",
    path: (input) =>
      `/me/drive/root/search(q='${requiredInputString(input, "query", "search").replace(/'/gu, "''")}')`,
    query: graphCollectionQuery,
  },
  "onedrive:get-item-info": {
    method: "GET",
    path: (input) => itemPath(input, "itemId", "fileId", "folderId"),
    query: graphEntityQuery,
  },
  "onedrive:get-drive-info": {
    method: "GET",
    path: () => "/me/drive",
    query: graphEntityQuery,
  },
  "onedrive:move-rename-file": {
    method: "PATCH",
    path: (input) => itemPath(input, "itemId", "fileId"),
    body: (input) => {
      const destination = optionalInputString(
        input,
        "destinationFolderId",
        "parentId",
      );
      return definedFields({
        name: optionalInputString(input, "newName", "name"),
        parentReference: destination ? { id: destination } : undefined,
      });
    },
  },
  "onedrive:copy-file": {
    method: "POST",
    path: (input) => `${itemPath(input, "itemId", "fileId")}/copy`,
    body: (input) => {
      const destination = optionalInputString(
        input,
        "destinationFolderId",
        "parentId",
      );
      return definedFields({
        name: optionalInputString(input, "newName", "name"),
        parentReference: destination
          ? { driveItem: destination, id: destination }
          : undefined,
      });
    },
    // Graph answers a copy with 202 and a Location header, not a body.
    output: (_value, input) => ({
      itemId: requiredInputString(input, "itemId", "fileId"),
      accepted: true,
    }),
  },
  "onedrive:create-sharing-link": {
    method: "POST",
    path: (input) => `${itemPath(input, "itemId", "fileId")}/createLink`,
    body: (input) => ({
      type: optionalInputString(input, "linkType", "type") ?? "view",
      scope: optionalInputString(input, "scope") ?? "organization",
    }),
  },
  "onedrive:delete-file": {
    method: "DELETE",
    path: (input) => itemPath(input, "itemId", "fileId"),
  },
};

export interface OneDriveProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: MicrosoftGraphClientFactory;
}

/** Executes the pinned OneDrive file actions through Microsoft Graph. */
export function createOneDriveProviderSdk(
  config: OneDriveProviderSdkConfig,
): IntegrationProviderSdk {
  return createMicrosoftGraphProviderSdk({
    integrationId: "onedrive",
    operations: ONEDRIVE_OPERATIONS,
    oauthRuntime: config.oauthRuntime,
    ...(config.clientFactory ? { clientFactory: config.clientFactory } : {}),
  });
}

export function createOneDrivePack(): IntegrationProviderPack {
  return createMicrosoftGraphPack({
    integrationId: "onedrive",
    operations: ONEDRIVE_OPERATIONS,
    triggerCoverage: [],
  });
}

export function getOneDriveProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  const operationIds = Object.keys(ONEDRIVE_OPERATIONS);
  return { operations: operationIds.length, operationIds };
}
