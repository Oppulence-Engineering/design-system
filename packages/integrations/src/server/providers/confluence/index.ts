import type { IntegrationProviderPack } from "../../core/provider-pack";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import {
  definedFields,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
} from "../shared/sdk";
import {
  createAtlassianPack,
  createAtlassianProviderSdk,
  createConfluenceClient,
  type AtlassianClientFactory,
  type AtlassianOperation,
} from "../shared/clients/atlassian";
import { confluenceTriggerCoverage } from "../shared/clients/atlassian-triggers";

type ConfluenceInput = Readonly<Record<string, unknown>>;

/** v2 write endpoints take a storage-format body under a representation key. */
function contentBody(input: ConfluenceInput): Record<string, unknown> {
  return {
    representation:
      optionalInputString(input, "representation", "bodyFormat") ?? "storage",
    value: requiredInputString(input, "body", "content"),
  };
}

function pagination(input: ConfluenceInput): Record<string, unknown> {
  return definedFields({
    limit: optionalInputNumber(input, "limit", "maxResults"),
    cursor: optionalInputString(input, "cursor"),
  });
}

const CONFLUENCE_OPERATIONS: Readonly<Record<string, AtlassianOperation>> = {
  "confluence:read-page": {
    path: ["page", "getPageById"],
    params: (input) =>
      definedFields({
        id: requiredInputString(input, "pageId", "id"),
        "body-format": optionalInputString(input, "bodyFormat") ?? "storage",
      }),
  },
  "confluence:create-page": {
    path: ["page", "createPage"],
    params: (input) =>
      definedFields({
        spaceId: requiredInputString(input, "spaceId"),
        status: optionalInputString(input, "status") ?? "current",
        title: requiredInputString(input, "title"),
        parentId: optionalInputString(input, "parentId"),
        body: contentBody(input),
      }),
  },
  "confluence:update-page": {
    path: ["page", "updatePage"],
    params: (input) => ({
      id: requiredInputString(input, "pageId", "id"),
      status: optionalInputString(input, "status") ?? "current",
      title: requiredInputString(input, "title"),
      body: contentBody(input),
      // Confluence rejects an update that does not advance the version.
      version: {
        number: optionalInputNumber(input, "versionNumber", "version") ?? 1,
        message: optionalInputString(input, "versionMessage"),
      },
    }),
  },
  "confluence:delete-page": {
    path: ["page", "deletePage"],
    params: (input) => ({ id: requiredInputString(input, "pageId", "id") }),
    output: (_value, input) => ({
      pageId: requiredInputString(input, "pageId", "id"),
      deleted: true,
    }),
  },
  "confluence:list-pages-in-space": {
    path: ["page", "getPagesInSpace"],
    params: (input) => ({
      id: requiredInputString(input, "spaceId"),
      ...pagination(input),
    }),
  },
  "confluence:get-page-children": {
    path: ["children", "getChildPages"],
    params: (input) => ({
      id: requiredInputString(input, "pageId", "id"),
      ...pagination(input),
    }),
  },
  "confluence:get-page-descendants": {
    path: ["descendants", "getPageDescendants"],
    params: (input) => ({
      id: requiredInputString(input, "pageId", "id"),
      ...pagination(input),
    }),
  },
  "confluence:get-page-ancestors": {
    path: ["ancestors", "getPageAncestors"],
    params: (input) => ({
      id: requiredInputString(input, "pageId", "id"),
      ...pagination(input),
    }),
  },
  "confluence:list-page-versions": {
    path: ["version", "getPageVersions"],
    params: (input) => ({
      id: requiredInputString(input, "pageId", "id"),
      ...pagination(input),
    }),
  },
  "confluence:get-page-version": {
    path: ["version", "getPageVersionDetails"],
    params: (input) => ({
      "page-id": requiredInputString(input, "pageId"),
      "version-number": optionalInputNumber(input, "versionNumber") ?? 1,
    }),
  },
  "confluence:list-page-properties": {
    path: ["contentProperties", "getPageContentProperties"],
    params: (input) => ({
      "page-id": requiredInputString(input, "pageId"),
      ...pagination(input),
    }),
  },
  "confluence:create-page-property": {
    path: ["contentProperties", "createPageProperty"],
    params: (input) => ({
      "page-id": requiredInputString(input, "pageId"),
      key: requiredInputString(input, "key", "propertyKey"),
      value: input.value ?? {},
    }),
  },
  "confluence:delete-page-property": {
    path: ["contentProperties", "deletePagePropertyById"],
    params: (input) => ({
      "page-id": requiredInputString(input, "pageId"),
      "property-id": requiredInputString(input, "propertyId"),
    }),
    output: (_value, input) => ({
      propertyId: requiredInputString(input, "propertyId"),
      deleted: true,
    }),
  },
  "confluence:search-content": {
    path: ["search", "searchByCQL"],
    params: (input) =>
      definedFields({
        cql: requiredInputString(input, "cql", "query"),
        limit: optionalInputNumber(input, "limit", "maxResults"),
        cursor: optionalInputString(input, "cursor"),
      }),
  },
  "confluence:search-in-space": {
    path: ["search", "searchByCQL"],
    params: (input) => {
      const cql = requiredInputString(input, "cql", "query");
      const spaceKey = requiredInputString(input, "spaceKey", "space");
      return definedFields({
        // Scope the caller's CQL to the requested space.
        cql: `space="${spaceKey.replace(/"/gu, "")}" AND (${cql})`,
        limit: optionalInputNumber(input, "limit", "maxResults"),
        cursor: optionalInputString(input, "cursor"),
      });
    },
  },
  "confluence:list-blog-posts": {
    path: ["blogPost", "getBlogPosts"],
    params: pagination,
  },
  "confluence:get-blog-post": {
    path: ["blogPost", "getBlogPostById"],
    params: (input) => ({
      id: requiredInputString(input, "blogPostId", "id"),
      "body-format": optionalInputString(input, "bodyFormat") ?? "storage",
    }),
  },
  "confluence:create-blog-post": {
    path: ["blogPost", "createBlogPost"],
    params: (input) =>
      definedFields({
        spaceId: requiredInputString(input, "spaceId"),
        status: optionalInputString(input, "status") ?? "current",
        title: requiredInputString(input, "title"),
        body: contentBody(input),
      }),
  },
  "confluence:update-blog-post": {
    path: ["blogPost", "updateBlogPost"],
    params: (input) => ({
      id: requiredInputString(input, "blogPostId", "id"),
      status: optionalInputString(input, "status") ?? "current",
      title: requiredInputString(input, "title"),
      body: contentBody(input),
      version: {
        number: optionalInputNumber(input, "versionNumber", "version") ?? 1,
        message: optionalInputString(input, "versionMessage"),
      },
    }),
  },
  "confluence:delete-blog-post": {
    path: ["blogPost", "deleteBlogPost"],
    params: (input) => ({
      id: requiredInputString(input, "blogPostId", "id"),
    }),
    output: (_value, input) => ({
      blogPostId: requiredInputString(input, "blogPostId", "id"),
      deleted: true,
    }),
  },
  "confluence:list-blog-posts-in-space": {
    path: ["blogPost", "getBlogPostsInSpace"],
    params: (input) => ({
      id: requiredInputString(input, "spaceId"),
      ...pagination(input),
    }),
  },
  "confluence:create-comment": {
    path: ["comment", "createFooterComment"],
    params: (input) =>
      definedFields({
        pageId: optionalInputString(input, "pageId"),
        blogPostId: optionalInputString(input, "blogPostId"),
        parentCommentId: optionalInputString(input, "parentCommentId"),
        body: contentBody(input),
      }),
  },
  "confluence:list-comments": {
    path: ["comment", "getPageFooterComments"],
    params: (input) => ({
      id: requiredInputString(input, "pageId", "id"),
      ...pagination(input),
    }),
  },
  "confluence:update-comment": {
    path: ["comment", "updateFooterComment"],
    params: (input) => ({
      "comment-id": requiredInputString(input, "commentId"),
      body: contentBody(input),
      version: {
        number: optionalInputNumber(input, "versionNumber", "version") ?? 1,
        message: optionalInputString(input, "versionMessage"),
      },
    }),
  },
  "confluence:delete-comment": {
    path: ["comment", "deleteFooterComment"],
    params: (input) => ({
      "comment-id": requiredInputString(input, "commentId"),
    }),
    output: (_value, input) => ({
      commentId: requiredInputString(input, "commentId"),
      deleted: true,
    }),
  },
  "confluence:upload-attachment": {
    path: ["contentAttachments", "createAttachments"],
    params: (input) => ({
      id: requiredInputString(input, "pageId", "contentId"),
      attachments: [
        {
          file: requiredInputString(input, "content", "fileContent"),
          filename: requiredInputString(input, "filename", "fileName"),
          comment: optionalInputString(input, "comment"),
        },
      ],
    }),
  },
  "confluence:list-attachments": {
    path: ["attachment", "getPageAttachments"],
    params: (input) => ({
      id: requiredInputString(input, "pageId", "id"),
      ...pagination(input),
    }),
  },
  "confluence:delete-attachment": {
    path: ["attachment", "deleteAttachment"],
    params: (input) => ({ id: requiredInputString(input, "attachmentId") }),
    output: (_value, input) => ({
      attachmentId: requiredInputString(input, "attachmentId"),
      deleted: true,
    }),
  },
  "confluence:list-labels": {
    path: ["label", "getPageLabels"],
    params: (input) => ({
      id: requiredInputString(input, "pageId", "id"),
      ...pagination(input),
    }),
  },
  "confluence:add-label": {
    path: ["contentLabels", "addLabelsToContent"],
    params: (input) => ({
      id: requiredInputString(input, "pageId", "contentId"),
      body: [
        {
          prefix: optionalInputString(input, "prefix") ?? "global",
          name: requiredInputString(input, "label", "name"),
        },
      ],
    }),
  },
  "confluence:delete-label": {
    path: ["contentLabels", "removeLabelFromContentUsingQueryParameter"],
    params: (input) => ({
      id: requiredInputString(input, "pageId", "contentId"),
      name: requiredInputString(input, "label", "name"),
    }),
    output: (_value, input) => ({
      label: requiredInputString(input, "label", "name"),
      deleted: true,
    }),
  },
  "confluence:get-pages-by-label": {
    path: ["page", "getLabelPages"],
    params: (input) => ({
      id: requiredInputString(input, "labelId"),
      ...pagination(input),
    }),
  },
  "confluence:list-space-labels": {
    path: ["label", "getSpaceLabels"],
    params: (input) => ({
      id: requiredInputString(input, "spaceId"),
      ...pagination(input),
    }),
  },
  "confluence:get-space": {
    path: ["space", "getSpaceById"],
    params: (input) => ({ id: requiredInputString(input, "spaceId", "id") }),
  },
  "confluence:list-spaces": {
    path: ["space", "getSpaces"],
    params: (input) =>
      definedFields({
        ...pagination(input),
        keys: optionalInputString(input, "spaceKey"),
        type: optionalInputString(input, "type"),
      }),
  },
  "confluence:create-space": {
    path: ["space", "createSpace"],
    params: (input) =>
      definedFields({
        key: requiredInputString(input, "spaceKey", "key"),
        name: requiredInputString(input, "name"),
        description: optionalInputString(input, "description")
          ? {
              plain: {
                value: optionalInputString(input, "description"),
                representation: "plain",
              },
            }
          : undefined,
      }),
  },
  "confluence:update-space": {
    path: ["space", "updateSpace"],
    params: (input) =>
      definedFields({
        spaceKey: requiredInputString(input, "spaceKey", "key"),
        name: optionalInputString(input, "name"),
        description: optionalInputString(input, "description")
          ? {
              plain: {
                value: optionalInputString(input, "description"),
                representation: "plain",
              },
            }
          : undefined,
      }),
  },
  "confluence:delete-space": {
    path: ["space", "deleteSpace"],
    params: (input) => ({
      spaceKey: requiredInputString(input, "spaceKey", "key"),
    }),
    output: (_value, input) => ({
      spaceKey: requiredInputString(input, "spaceKey", "key"),
      deleted: true,
    }),
  },
  "confluence:list-space-properties": {
    path: ["spaceProperties", "getSpaceProperties"],
    params: (input) => ({
      "space-id": requiredInputString(input, "spaceId"),
      ...pagination(input),
    }),
  },
  "confluence:create-space-property": {
    path: ["spaceProperties", "createSpaceProperty"],
    params: (input) => ({
      "space-id": requiredInputString(input, "spaceId"),
      key: requiredInputString(input, "key", "propertyKey"),
      value: input.value ?? {},
    }),
  },
  "confluence:delete-space-property": {
    path: ["spaceProperties", "deleteSpacePropertyById"],
    params: (input) => ({
      "space-id": requiredInputString(input, "spaceId"),
      "property-id": requiredInputString(input, "propertyId"),
    }),
    output: (_value, input) => ({
      propertyId: requiredInputString(input, "propertyId"),
      deleted: true,
    }),
  },
  "confluence:list-space-permissions": {
    path: ["spacePermissions", "getSpacePermissionsAssignments"],
    params: (input) => ({
      id: requiredInputString(input, "spaceId"),
      ...pagination(input),
    }),
  },
  "confluence:list-tasks": {
    path: ["task", "getTasks"],
    params: (input) =>
      definedFields({
        ...pagination(input),
        status: optionalInputString(input, "status"),
        "space-id": optionalInputString(input, "spaceId"),
      }),
  },
  "confluence:get-task": {
    path: ["task", "getTaskById"],
    params: (input) => ({ id: requiredInputString(input, "taskId", "id") }),
  },
  "confluence:update-task": {
    path: ["task", "updateTask"],
    params: (input) => ({
      id: requiredInputString(input, "taskId", "id"),
      status: requiredInputString(input, "status"),
    }),
  },
  "confluence:get-user": {
    path: ["users", "getUser"],
    params: (input) => ({
      accountId: requiredInputString(input, "accountId"),
    }),
  },
};

export interface ConfluenceProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: AtlassianClientFactory;
}

/**
 * Executes the pinned Confluence actions. v2 owns pages, spaces, comments, and
 * tasks; CQL search, space updates, label writes, attachment uploads, and user
 * lookup exist only on v1, so the shared client exposes both.
 */
export function createConfluenceProviderSdk(
  config: ConfluenceProviderSdkConfig,
): IntegrationProviderSdk {
  return createAtlassianProviderSdk({
    integrationId: "confluence",
    operations: CONFLUENCE_OPERATIONS,
    oauthRuntime: config.oauthRuntime,
    clientFactory: config.clientFactory ?? createConfluenceClient,
  });
}

export function createConfluencePack(
  options: { clientFactory?: AtlassianClientFactory } = {},
): IntegrationProviderPack {
  return createAtlassianPack({
    integrationId: "confluence",
    operations: CONFLUENCE_OPERATIONS,
    clientFactory: options.clientFactory ?? createConfluenceClient,
    triggerCoverage: confluenceTriggerCoverage(),
  });
}

export function getConfluenceProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  const operationIds = Object.keys(CONFLUENCE_OPERATIONS);
  return { operations: operationIds.length, operationIds };
}
