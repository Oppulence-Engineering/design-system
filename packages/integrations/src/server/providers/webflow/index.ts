import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

const NoSdkNote =
  "publishes no maintained first-party Node SDK; its HTTP API is the supported integration surface.";

// ------------------------------------------------------------------ Webflow

const WebflowId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9]+$/u);

const WEBFLOW_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-items",
    name: "List Items",
    description: "Lists the items in a CMS collection.",
    method: "GET",
    url: (i) =>
      `/v2/collections/${restSegment(i.collectionId)}/items${restQuery({
        offset: i.offset,
        limit: i.limit,
      })}`,
    input: z
      .object({
        collectionId: WebflowId,
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
  },
  {
    action: "get-item",
    name: "Get Item",
    description: "Reads one CMS item.",
    method: "GET",
    url: (i) =>
      `/v2/collections/${restSegment(i.collectionId)}/items/${restSegment(i.itemId)}`,
    input: z.object({ collectionId: WebflowId, itemId: WebflowId }).strict(),
  },
  {
    action: "create-item",
    name: "Create Item",
    description: "Creates a CMS item.",
    method: "POST",
    url: (i) => `/v2/collections/${restSegment(i.collectionId)}/items`,
    input: z
      .object({
        collectionId: WebflowId,
        fieldData: z.record(z.string(), z.unknown()),
        isArchived: z.boolean().optional(),
        isDraft: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      fieldData: i.fieldData,
      isArchived: i.isArchived ?? false,
      // A new item stays a draft unless the caller says otherwise, so a
      // create cannot accidentally publish to a live site.
      isDraft: i.isDraft ?? true,
    }),
  },
  {
    action: "update-item",
    name: "Update Item",
    description: "Updates a CMS item.",
    method: "PATCH",
    url: (i) =>
      `/v2/collections/${restSegment(i.collectionId)}/items/${restSegment(i.itemId)}`,
    input: z
      .object({
        collectionId: WebflowId,
        itemId: WebflowId,
        fieldData: z.record(z.string(), z.unknown()),
        isArchived: z.boolean().optional(),
        isDraft: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      fieldData: i.fieldData,
      ...(i.isArchived === undefined ? {} : { isArchived: i.isArchived }),
      ...(i.isDraft === undefined ? {} : { isDraft: i.isDraft }),
    }),
  },
  {
    action: "delete-item",
    name: "Delete Item",
    description: "Deletes a CMS item.",
    method: "DELETE",
    url: (i) =>
      `/v2/collections/${restSegment(i.collectionId)}/items/${restSegment(i.itemId)}`,
    input: z.object({ collectionId: WebflowId, itemId: WebflowId }).strict(),
    emptyResponse: true,
  },
];

export function createWebflowPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "webflow",
    sdkReview: `Webflow ${NoSdkNote}`,
    transportKind: "oauth2",
    actions: WEBFLOW_ACTIONS,
  });
}
