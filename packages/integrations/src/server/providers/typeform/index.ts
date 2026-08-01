import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

const NoSdkNote =
  "publishes no maintained Node SDK; its HTTP API is the supported integration surface.";

// ----------------------------------------------------------------- Typeform

const FormId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9]+$/u);

const TYPEFORM_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-forms",
    name: "List Forms",
    description: "Lists the forms in the workspace.",
    method: "GET",
    url: (i) =>
      `/forms${restQuery({
        page: i.page,
        page_size: i.pageSize,
        search: i.search,
        workspace_id: i.workspaceId,
      })}`,
    input: z
      .object({
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(200).optional(),
        search: z.string().max(256).optional(),
        workspaceId: z.string().max(64).optional(),
      })
      .strict(),
  },
  {
    action: "get-form-details",
    name: "Get Form Details",
    description: "Reads a form's definition.",
    method: "GET",
    url: (i) => `/forms/${restSegment(i.formId)}`,
    input: z.object({ formId: FormId }).strict(),
    maxResponseBytes: 1_048_576,
  },
  {
    action: "create-form",
    name: "Create Form",
    description: "Creates a form from a definition.",
    method: "POST",
    url: "/forms",
    input: z
      .object({
        title: z.string().min(1).max(256),
        fields: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
    body: (i) => ({
      title: i.title,
      ...(i.fields ? { fields: i.fields } : {}),
      ...(i.settings ? { settings: i.settings } : {}),
    }),
  },
  {
    action: "update-form",
    name: "Update Form",
    description: "Replaces a form's definition.",
    method: "PUT",
    url: (i) => `/forms/${restSegment(i.formId)}`,
    input: z
      .object({
        formId: FormId,
        definition: z.record(z.string(), z.unknown()),
      })
      .strict(),
    body: (i) => i.definition,
  },
  {
    action: "delete-form",
    name: "Delete Form",
    description: "Deletes a form.",
    method: "DELETE",
    url: (i) => `/forms/${restSegment(i.formId)}`,
    input: z.object({ formId: FormId }).strict(),
    emptyResponse: true,
  },
  {
    action: "retrieve-responses",
    name: "Retrieve Responses",
    description: "Reads the submitted responses for a form.",
    method: "GET",
    url: (i) =>
      `/forms/${restSegment(i.formId)}/responses${restQuery({
        page_size: i.pageSize,
        since: i.since,
        until: i.until,
        completed: i.completed,
        after: i.after,
      })}`,
    input: z
      .object({
        formId: FormId,
        pageSize: z.number().int().min(1).max(1_000).optional(),
        since: z.string().max(64).optional(),
        until: z.string().max(64).optional(),
        completed: z.boolean().optional(),
        after: z.string().max(128).optional(),
      })
      .strict(),
    maxResponseBytes: 1_048_576,
  },
  {
    action: "form-insights",
    name: "Form Insights",
    description: "Reads view and submission metrics for a form.",
    method: "GET",
    url: (i) => `/insights/${restSegment(i.formId)}/summary`,
    input: z.object({ formId: FormId }).strict(),
  },
  {
    action: "download-file",
    name: "Download File",
    description: "Downloads a file uploaded through a form response.",
    method: "GET",
    url: (i) =>
      `/forms/${restSegment(i.formId)}/responses/${restSegment(i.responseId)}/fields/${restSegment(i.fieldId)}/files/${restSegment(i.filename)}`,
    input: z
      .object({
        formId: FormId,
        responseId: z.string().min(1).max(128),
        fieldId: z.string().min(1).max(128),
        filename: z.string().min(1).max(256),
      })
      .strict(),
    maxResponseBytes: 1_048_576,
  },
];

export function createTypeformPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "typeform",
    sdkReview: `Typeform ${NoSdkNote}`,
    transportKind: "api_key",
    actions: TYPEFORM_ACTIONS,
  });
}
