import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Apify's published OpenAPI document:
 * https://docs.apify.com/api/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Apify publishes no maintained Node SDK; its OpenAPI document at https://docs.apify.com/api/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "run-actor",
    name: "Run Actor",
    description:
      "Run an APIFY actor synchronously and get results (max 5 minutes)",
    method: "PUT",
    url: (i) => `/v2/actor-runs/${restSegment(i.runId)}`,
    input: z
      .object({
        runId: z.string().max(4_000),
        statusMessage: z.string().max(4_000).optional(),
        isStatusMessageTerminal: z.boolean().optional(),
        generalAccess: z
          .enum([
            "ANYONE_WITH_ID_CAN_READ",
            "ANYONE_WITH_NAME_CAN_READ",
            "FOLLOW_USER_SETTING",
            "RESTRICTED",
          ])
          .optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.statusMessage !== undefined
        ? { statusMessage: i.statusMessage }
        : {}),
      ...(i.isStatusMessageTerminal !== undefined
        ? { isStatusMessageTerminal: i.isStatusMessageTerminal }
        : {}),
      ...(i.generalAccess !== undefined
        ? { generalAccess: i.generalAccess }
        : {}),
    }),
  },
  {
    action: "run-actor-async",
    name: "Run Actor (Async)",
    description:
      "Run an APIFY actor asynchronously with polling for long-running tasks",
    method: "DELETE",
    url: (i) => `/v2/actor-runs/${restSegment(i.runId)}`,
    input: z
      .object({
        runId: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "run-task",
    name: "Run Task",
    description:
      "Run a saved APIFY actor task synchronously and get dataset items (max 5 minutes)",
    method: "POST",
    url: (i) =>
      `/v2/actor-tasks/${restSegment(i.actorTaskId)}/runs${restQuery({ timeout: i.timeout, memory: i.memory, maxItems: i.maxItems, maxTotalChargeUsd: i.maxTotalChargeUsd, restartOnError: i.restartOnError, build: i.build, waitForFinish: i.waitForFinish, webhooks: i.webhooks })}`,
    input: z
      .object({
        actorTaskId: z.string().max(4_000),
        timeout: z.number().optional(),
        memory: z.number().optional(),
        maxItems: z.number().optional(),
        maxTotalChargeUsd: z.number().optional(),
        restartOnError: z.boolean().optional(),
        build: z.string().max(4_000).optional(),
        waitForFinish: z.number().optional(),
        webhooks: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-dataset-items",
    name: "Get Dataset Items",
    description: "Retrieve items stored in an APIFY dataset",
    method: "GET",
    url: (i) =>
      `/v2/datasets/${restSegment(i.datasetId)}/items${restQuery({ format: i.format, clean: i.clean, offset: i.offset, limit: i.limit, fields: i.fields, outputFields: i.outputFields, omit: i.omit, unwind: i.unwind, flatten: i.flatten, desc: i.desc, attachment: i.attachment, delimiter: i.delimiter, bom: i.bom, xmlRoot: i.xmlRoot, xmlRow: i.xmlRow, skipHeaderRow: i.skipHeaderRow, skipHidden: i.skipHidden, skipEmpty: i.skipEmpty, simplified: i.simplified, view: i.view, skipFailedPages: i.skipFailedPages, feedTitle: i.feedTitle, feedDescription: i.feedDescription, signature: i.signature })}`,
    input: z
      .object({
        datasetId: z.string().max(4_000),
        format: z.string().max(4_000).optional(),
        clean: z.boolean().optional(),
        offset: z.number().optional(),
        limit: z.number().optional(),
        fields: z.string().max(4_000).optional(),
        outputFields: z.string().max(4_000).optional(),
        omit: z.string().max(4_000).optional(),
        unwind: z.string().max(4_000).optional(),
        flatten: z.string().max(4_000).optional(),
        desc: z.boolean().optional(),
        attachment: z.boolean().optional(),
        delimiter: z.string().max(4_000).optional(),
        bom: z.boolean().optional(),
        xmlRoot: z.string().max(4_000).optional(),
        xmlRow: z.string().max(4_000).optional(),
        skipHeaderRow: z.boolean().optional(),
        skipHidden: z.boolean().optional(),
        skipEmpty: z.boolean().optional(),
        simplified: z.boolean().optional(),
        view: z.string().max(4_000).optional(),
        skipFailedPages: z.boolean().optional(),
        feedTitle: z.string().max(4_000).optional(),
        feedDescription: z.string().max(4_000).optional(),
        signature: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-run",
    name: "Get Run",
    description: "Get the status and details of an APIFY actor run",
    method: "GET",
    url: (i) =>
      `/v2/actor-runs/${restSegment(i.runId)}${restQuery({ waitForFinish: i.waitForFinish })}`,
    input: z
      .object({
        runId: z.string().max(4_000),
        waitForFinish: z.number().optional(),
      })
      .strict(),
  },
];

export function createApifyPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "apify",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
  });
}
