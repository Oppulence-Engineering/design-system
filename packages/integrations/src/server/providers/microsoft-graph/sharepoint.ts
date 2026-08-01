import type { IntegrationProviderPack } from "../../provider-pack";
import type { IntegrationProviderSdk } from "../../provider-sdk";
import type { IntegrationOAuthRuntime } from "../../runtime";
import {
  definedFields,
  optionalInputRecord,
  optionalInputString,
  requiredInputRecord,
  requiredInputString,
} from "../shared";
import {
  createMicrosoftGraphPack,
  createMicrosoftGraphProviderSdk,
  graphSegment,
  optionalGraphSegment,
  type MicrosoftGraphClientFactory,
  type MicrosoftGraphOperation,
} from "./client";
import { graphCollectionQuery, graphEntityQuery } from "./query";

type GraphInput = Readonly<Record<string, unknown>>;

function site(input: GraphInput): string {
  return `/sites/${graphSegment(input, "siteId", "site")}`;
}

function list(input: GraphInput): string {
  return `${site(input)}/lists/${graphSegment(input, "listId", "list")}`;
}

/** SharePoint pages live on the sitePages resource, which needs the beta-era
 * @odata.type discriminator even on v1.0. */
function pageBody(input: GraphInput): Record<string, unknown> {
  return definedFields({
    "@odata.type": "#microsoft.graph.sitePage",
    name: optionalInputString(input, "pageName", "name"),
    title: optionalInputString(input, "title"),
    pageLayout: optionalInputString(input, "pageLayout"),
    publishingState: optionalInputString(input, "publishingState"),
  });
}

const SHAREPOINT_OPERATIONS: Readonly<Record<string, MicrosoftGraphOperation>> =
  {
    "sharepoint:create-page": {
      method: "POST",
      path: (input) => `${site(input)}/pages`,
      body: (input) => ({
        ...pageBody(input),
        name: requiredInputString(input, "pageName", "name"),
        title: requiredInputString(input, "title"),
      }),
    },
    "sharepoint:read-page": {
      method: "GET",
      path: (input) => {
        const pageId = optionalGraphSegment(input, "pageId");
        return pageId
          ? `${site(input)}/pages/${pageId}`
          : `${site(input)}/pages`;
      },
      query: (input) =>
        optionalInputString(input, "pageId")
          ? graphEntityQuery(input)
          : graphCollectionQuery(input),
    },
    "sharepoint:update-page": {
      method: "PATCH",
      path: (input) => `${site(input)}/pages/${graphSegment(input, "pageId")}`,
      body: pageBody,
    },
    "sharepoint:publish-page": {
      method: "POST",
      path: (input) =>
        `${site(input)}/pages/${graphSegment(input, "pageId")}/publish`,
      output: (_value, input) => ({
        pageId: requiredInputString(input, "pageId"),
        published: true,
      }),
    },
    "sharepoint:delete-page": {
      method: "DELETE",
      path: (input) => `${site(input)}/pages/${graphSegment(input, "pageId")}`,
    },
    "sharepoint:list-sites": {
      method: "GET",
      path: () => "/sites",
      query: (input) => ({
        ...graphCollectionQuery(input),
        // Graph requires a search term to enumerate sites; "*" lists all.
        $search: optionalInputString(input, "search", "query") ?? "*",
      }),
    },
    "sharepoint:create-list": {
      method: "POST",
      path: (input) => `${site(input)}/lists`,
      body: (input) =>
        definedFields({
          displayName: requiredInputString(input, "listName", "displayName"),
          description: optionalInputString(input, "description"),
          list: optionalInputRecord(input, "listSettings") ?? {
            template: optionalInputString(input, "template") ?? "genericList",
          },
          columns: optionalInputRecord(input, "columns"),
        }),
    },
    "sharepoint:read-list": {
      method: "GET",
      path: (input) => {
        const listId = optionalGraphSegment(input, "listId", "list");
        return listId
          ? `${site(input)}/lists/${listId}`
          : `${site(input)}/lists`;
      },
      query: (input) =>
        optionalInputString(input, "listId", "list")
          ? graphEntityQuery(input)
          : graphCollectionQuery(input),
    },
    "sharepoint:add-list-item": {
      method: "POST",
      path: (input) => `${list(input)}/items`,
      body: (input) => ({ fields: requiredInputRecord(input, "fields") }),
    },
    "sharepoint:get-list-item": {
      method: "GET",
      path: (input) => {
        const itemId = optionalGraphSegment(input, "itemId");
        return itemId
          ? `${list(input)}/items/${itemId}`
          : `${list(input)}/items`;
      },
      query: (input) => ({
        ...(optionalInputString(input, "itemId")
          ? graphEntityQuery(input)
          : graphCollectionQuery(input)),
        // Field values are not returned unless explicitly expanded.
        $expand: optionalInputString(input, "expand") ?? "fields",
      }),
    },
    "sharepoint:update-list-item": {
      method: "PATCH",
      path: (input) =>
        `${list(input)}/items/${graphSegment(input, "itemId")}/fields`,
      body: (input) => requiredInputRecord(input, "fields"),
    },
    "sharepoint:delete-list-item": {
      method: "DELETE",
      path: (input) => `${list(input)}/items/${graphSegment(input, "itemId")}`,
    },
    "sharepoint:upload-file": {
      method: "PUT",
      path: (input) => {
        const folder = optionalGraphSegment(input, "folderId", "parentId");
        const name = encodeURIComponent(
          requiredInputString(input, "fileName", "name"),
        );
        return folder
          ? `${site(input)}/drive/items/${folder}:/${name}:/content`
          : `${site(input)}/drive/root:/${name}:/content`;
      },
      body: (input) => requiredInputString(input, "content", "fileContent"),
    },
    "sharepoint:download-file": {
      method: "GET",
      path: (input) =>
        `${site(input)}/drive/items/${graphSegment(input, "itemId", "fileId")}/content`,
      responseType: "text",
      output: (value, input) => ({
        itemId: requiredInputString(input, "itemId", "fileId"),
        content: typeof value === "string" ? value : String(value ?? ""),
      }),
    },
    "sharepoint:get-drive-item": {
      method: "GET",
      path: (input) => {
        const itemId = optionalGraphSegment(input, "itemId", "fileId");
        return itemId
          ? `${site(input)}/drive/items/${itemId}`
          : `${site(input)}/drive/root/children`;
      },
      query: (input) =>
        optionalInputString(input, "itemId", "fileId")
          ? graphEntityQuery(input)
          : graphCollectionQuery(input),
    },
    "sharepoint:delete-file": {
      method: "DELETE",
      path: (input) =>
        `${site(input)}/drive/items/${graphSegment(input, "itemId", "fileId")}`,
    },
  };

export interface SharePointProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: MicrosoftGraphClientFactory;
}

/** Executes the pinned SharePoint page, list, and drive actions through Graph. */
export function createSharePointProviderSdk(
  config: SharePointProviderSdkConfig,
): IntegrationProviderSdk {
  return createMicrosoftGraphProviderSdk({
    integrationId: "sharepoint",
    operations: SHAREPOINT_OPERATIONS,
    oauthRuntime: config.oauthRuntime,
    ...(config.clientFactory ? { clientFactory: config.clientFactory } : {}),
  });
}

export function createSharePointPack(): IntegrationProviderPack {
  return createMicrosoftGraphPack({
    integrationId: "sharepoint",
    operations: SHAREPOINT_OPERATIONS,
    triggerCoverage: [],
  });
}

export function getSharePointProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  const operationIds = Object.keys(SHAREPOINT_OPERATIONS);
  return { operations: operationIds.length, operationIds };
}
