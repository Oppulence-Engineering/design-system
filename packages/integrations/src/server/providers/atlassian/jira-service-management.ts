import { z } from "zod";

import type { IntegrationProviderPack } from "../../provider-pack";
import { createIntegrationTypedRestProvider } from "../../provider-rest";
import type { IntegrationProviderSdk } from "../../provider-sdk";
import type { IntegrationOAuthRuntime } from "../../runtime";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
  requiredInputStringArray,
} from "../shared";
import {
  createAtlassianPack,
  createAtlassianProviderSdk,
  createJiraServiceDeskClient,
  type AtlassianClientFactory,
  type AtlassianOperation,
} from "./client";
import { jiraServiceManagementTriggerCoverage } from "./triggers";

type JsmInput = Readonly<Record<string, unknown>>;

function pagination(input: JsmInput): Record<string, unknown> {
  return definedFields({
    start: optionalInputNumber(input, "start", "startAt"),
    limit: optionalInputNumber(input, "limit", "maxResults"),
  });
}

const JSM_OPERATIONS: Readonly<Record<string, AtlassianOperation>> = {
  "jira-service-management:get-service-desks": {
    path: ["serviceDesk", "getServiceDesks"],
    params: pagination,
  },
  "jira-service-management:get-request-types": {
    path: ["serviceDesk", "getRequestTypes"],
    params: (input) => ({
      serviceDeskId: requiredInputString(input, "serviceDeskId"),
      ...pagination(input),
    }),
  },
  "jira-service-management:get-request-type-fields": {
    path: ["serviceDesk", "getRequestTypeFields"],
    params: (input) => ({
      serviceDeskId: requiredInputString(input, "serviceDeskId"),
      requestTypeId: requiredInputString(input, "requestTypeId"),
    }),
  },
  "jira-service-management:create-request": {
    path: ["request", "createCustomerRequest"],
    params: (input) =>
      definedFields({
        serviceDeskId: requiredInputString(input, "serviceDeskId"),
        requestTypeId: requiredInputString(input, "requestTypeId"),
        requestFieldValues: optionalInputRecord(
          input,
          "requestFieldValues",
        ) ?? {
          summary: requiredInputString(input, "summary"),
          description: optionalInputString(input, "description"),
        },
        raiseOnBehalfOf: optionalInputString(input, "raiseOnBehalfOf"),
        requestParticipants: optionalInputStringArray(
          input,
          "requestParticipants",
        ),
      }),
  },
  "jira-service-management:get-request": {
    path: ["request", "getCustomerRequestByIdOrKey"],
    params: (input) =>
      definedFields({
        issueIdOrKey: requiredInputString(input, "issueIdOrKey", "requestId"),
        expand: optionalInputStringArray(input, "expand"),
      }),
  },
  "jira-service-management:get-requests": {
    path: ["request", "getCustomerRequests"],
    params: (input) =>
      definedFields({
        ...pagination(input),
        serviceDeskId: optionalInputString(input, "serviceDeskId"),
        requestTypeId: optionalInputString(input, "requestTypeId"),
        requestStatus: optionalInputString(input, "requestStatus"),
        searchTerm: optionalInputString(input, "searchTerm", "query"),
      }),
  },
  "jira-service-management:add-comment": {
    path: ["request", "createRequestComment"],
    params: (input) => ({
      issueIdOrKey: requiredInputString(input, "issueIdOrKey", "requestId"),
      body: requiredInputString(input, "body", "comment"),
      public: input.public === undefined ? true : Boolean(input.public),
    }),
  },
  "jira-service-management:get-comments": {
    path: ["request", "getRequestComments"],
    params: (input) => ({
      issueIdOrKey: requiredInputString(input, "issueIdOrKey", "requestId"),
      ...pagination(input),
    }),
  },
  "jira-service-management:get-customers": {
    path: ["serviceDesk", "getCustomers"],
    params: (input) =>
      definedFields({
        serviceDeskId: requiredInputString(input, "serviceDeskId"),
        query: optionalInputString(input, "query", "searchTerm"),
        ...pagination(input),
      }),
  },
  "jira-service-management:add-customer": {
    path: ["serviceDesk", "addCustomers"],
    params: (input) => ({
      serviceDeskId: requiredInputString(input, "serviceDeskId"),
      accountIds: requiredInputStringArray(input, "accountIds", "accountId"),
    }),
    output: (_value, input) => ({
      serviceDeskId: requiredInputString(input, "serviceDeskId"),
      added: true,
    }),
  },
  "jira-service-management:get-organizations": {
    path: ["organization", "getOrganizations"],
    params: pagination,
  },
  "jira-service-management:create-organization": {
    path: ["organization", "createOrganization"],
    params: (input) => ({ name: requiredInputString(input, "name") }),
  },
  "jira-service-management:add-organization": {
    path: ["organization", "addOrganization"],
    params: (input) => ({
      serviceDeskId: requiredInputString(input, "serviceDeskId"),
      organizationId: Number(requiredInputString(input, "organizationId")),
    }),
    output: (_value, input) => ({
      serviceDeskId: requiredInputString(input, "serviceDeskId"),
      organizationId: requiredInputString(input, "organizationId"),
      added: true,
    }),
  },
  "jira-service-management:get-queues": {
    path: ["serviceDesk", "getQueues"],
    params: (input) => ({
      serviceDeskId: requiredInputString(input, "serviceDeskId"),
      ...pagination(input),
    }),
  },
  "jira-service-management:get-sla": {
    path: ["request", "getSlaInformation"],
    params: (input) => ({
      issueIdOrKey: requiredInputString(input, "issueIdOrKey", "requestId"),
      ...pagination(input),
    }),
  },
  "jira-service-management:get-transitions": {
    path: ["request", "getCustomerTransitions"],
    params: (input) => ({
      issueIdOrKey: requiredInputString(input, "issueIdOrKey", "requestId"),
      ...pagination(input),
    }),
  },
  "jira-service-management:transition-request": {
    path: ["request", "performCustomerTransition"],
    params: (input) =>
      definedFields({
        issueIdOrKey: requiredInputString(input, "issueIdOrKey", "requestId"),
        id: requiredInputString(input, "transitionId"),
        additionalComment: optionalInputString(input, "comment")
          ? { body: optionalInputString(input, "comment") }
          : undefined,
      }),
    output: (_value, input) => ({
      issueIdOrKey: requiredInputString(input, "issueIdOrKey", "requestId"),
      transitioned: true,
    }),
  },
  "jira-service-management:get-participants": {
    path: ["request", "getRequestParticipants"],
    params: (input) => ({
      issueIdOrKey: requiredInputString(input, "issueIdOrKey", "requestId"),
      ...pagination(input),
    }),
  },
  "jira-service-management:add-participants": {
    path: ["request", "addRequestParticipants"],
    params: (input) => ({
      issueIdOrKey: requiredInputString(input, "issueIdOrKey", "requestId"),
      accountIds: requiredInputStringArray(input, "accountIds", "accountId"),
    }),
  },
  "jira-service-management:get-approvals": {
    path: ["request", "getApprovals"],
    params: (input) => ({
      issueIdOrKey: requiredInputString(input, "issueIdOrKey", "requestId"),
      ...pagination(input),
    }),
  },
  "jira-service-management:answer-approval": {
    path: ["request", "answerApproval"],
    params: (input) => ({
      issueIdOrKey: requiredInputString(input, "issueIdOrKey", "requestId"),
      approvalId: requiredInputString(input, "approvalId"),
      decision: requiredInputString(input, "decision"),
    }),
  },
};

/**
 * jira.js models the Service Desk API but not the two products that ship
 * alongside it: Forms and Assets each expose a separate host and specification
 * that no maintained SDK covers. Those actions use the typed REST lane with
 * the review recorded here.
 */
const JSM_FORMS_REVIEW =
  "jira.js@5.4.0 models the Service Desk API only; the Jira Service Management Forms API (/gateway/api/proforma) has no method in it or in any maintained SDK.";
const JSM_ASSETS_REVIEW =
  "jira.js@5.4.0 exposes insight.getInsightWorkspaces only; the Assets API (/jsm/assets/workspace/{id}/v1) has no method in it or in any maintained SDK.";

const JSM_FORM_OPERATIONS = [
  "jira-service-management:get-form-templates",
  "jira-service-management:get-form-structure",
  "jira-service-management:get-issue-forms",
  "jira-service-management:attach-form",
  "jira-service-management:save-form-answers",
  "jira-service-management:submit-form",
  "jira-service-management:get-form",
  "jira-service-management:get-form-answers",
  "jira-service-management:reopen-form",
  "jira-service-management:delete-form",
  "jira-service-management:externalise-form",
  "jira-service-management:internalise-form",
  "jira-service-management:copy-forms",
] as const;

const JSM_ASSET_OPERATIONS = [
  "jira-service-management:list-asset-schemas",
  "jira-service-management:get-asset-schema",
  "jira-service-management:list-asset-object-types",
  "jira-service-management:get-asset-object-type-attributes",
  "jira-service-management:search-assets-aql",
  "jira-service-management:get-asset-object",
  "jira-service-management:create-asset-object",
  "jira-service-management:update-asset-object",
  "jira-service-management:delete-asset-object",
] as const;

const JSM_REST_REVIEWS: Readonly<Record<string, string>> = Object.fromEntries([
  ...JSM_FORM_OPERATIONS.map((id) => [id, JSM_FORMS_REVIEW]),
  ...JSM_ASSET_OPERATIONS.map((id) => [id, JSM_ASSETS_REVIEW]),
]);

/** Forms and Assets both answer with an opaque, product-defined document. */
const OpaqueDocumentSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

const DeletedSchema = z.object({ deleted: z.literal(true) }).strict();

function formsPath(input: Record<string, unknown>, suffix: string): string {
  return `/gateway/api/proforma/cloudid/${encodeURIComponent(String(input.cloudId))}${suffix}`;
}

function assetsPath(input: Record<string, unknown>, suffix: string): string {
  return `/jsm/assets/workspace/${encodeURIComponent(String(input.workspaceId))}/v1${suffix}`;
}

const CloudIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9-]+$/u);
const WorkspaceIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9-]+$/u);
const IdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);
const IssueKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);

export interface JiraServiceManagementRestProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "request">;
}

/**
 * Executes the Forms and Assets actions the Service Desk SDK cannot reach.
 * Both are addressed relative to the Atlassian API gateway that the OAuth
 * profile already targets.
 */
export function createJiraServiceManagementRestProviderSdk(
  config: JiraServiceManagementRestProviderSdkConfig,
): IntegrationProviderSdk {
  const json = () => ({ accept: "application/json" });
  return createIntegrationTypedRestProvider({
    integrationId: "jira-service-management",
    transport: { kind: "oauth2", runtime: config.oauthRuntime },
    tools: [
      {
        id: "jira-service-management:get-form-templates",
        name: "Get Form Templates",
        description: "Lists the form templates available on a project.",
        version: "1.0.0",
        params: {
          cloudId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          projectId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "GET",
          url: (input) =>
            formsPath(
              input,
              `/api/2/projects/${encodeURIComponent(input.projectId)}/forms`,
            ),
          headers: json,
          retry: { enabled: true },
        },
        inputSchema: z
          .object({ cloudId: CloudIdSchema, projectId: IdSchema })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:get-form-structure",
        name: "Get Form Structure",
        description: "Reads the field structure of a form template.",
        version: "1.0.0",
        params: {
          cloudId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          projectId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          formTemplateId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "GET",
          url: (input) =>
            formsPath(
              input,
              `/api/2/projects/${encodeURIComponent(input.projectId)}/forms/${encodeURIComponent(input.formTemplateId)}`,
            ),
          headers: json,
          retry: { enabled: true },
        },
        inputSchema: z
          .object({
            cloudId: CloudIdSchema,
            projectId: IdSchema,
            formTemplateId: IdSchema,
          })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:get-issue-forms",
        name: "Get Issue Forms",
        description: "Lists the forms attached to a request.",
        version: "1.0.0",
        params: {
          cloudId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          issueIdOrKey: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "GET",
          url: (input) =>
            formsPath(
              input,
              `/api/2/issue/${encodeURIComponent(input.issueIdOrKey)}/form`,
            ),
          headers: json,
          retry: { enabled: true },
        },
        inputSchema: z
          .object({ cloudId: CloudIdSchema, issueIdOrKey: IssueKeySchema })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:attach-form",
        name: "Attach Form",
        description: "Attaches a form template to a request.",
        version: "1.0.0",
        params: {
          cloudId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          issueIdOrKey: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          formTemplateId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "POST",
          url: (input) =>
            formsPath(
              input,
              `/api/2/issue/${encodeURIComponent(input.issueIdOrKey)}/form`,
            ),
          headers: json,
          body: (input) => ({ formTemplate: { id: input.formTemplateId } }),
        },
        inputSchema: z
          .object({
            cloudId: CloudIdSchema,
            issueIdOrKey: IssueKeySchema,
            formTemplateId: IdSchema,
          })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:get-form",
        name: "Get Form",
        description: "Reads one form attached to a request.",
        version: "1.0.0",
        params: {
          cloudId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          issueIdOrKey: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          formId: { type: "string", required: true, visibility: "user-or-llm" },
        },
        request: {
          method: "GET",
          url: (input) =>
            formsPath(
              input,
              `/api/2/issue/${encodeURIComponent(input.issueIdOrKey)}/form/${encodeURIComponent(input.formId)}`,
            ),
          headers: json,
          retry: { enabled: true },
        },
        inputSchema: z
          .object({
            cloudId: CloudIdSchema,
            issueIdOrKey: IssueKeySchema,
            formId: IdSchema,
          })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:get-form-answers",
        name: "Get Form Answers",
        description: "Reads the submitted answers of a form.",
        version: "1.0.0",
        params: {
          cloudId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          issueIdOrKey: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          formId: { type: "string", required: true, visibility: "user-or-llm" },
        },
        request: {
          method: "GET",
          url: (input) =>
            formsPath(
              input,
              `/api/2/issue/${encodeURIComponent(input.issueIdOrKey)}/form/${encodeURIComponent(input.formId)}/format/answers`,
            ),
          headers: json,
          retry: { enabled: true },
        },
        inputSchema: z
          .object({
            cloudId: CloudIdSchema,
            issueIdOrKey: IssueKeySchema,
            formId: IdSchema,
          })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:save-form-answers",
        name: "Save Form Answers",
        description: "Saves answers to a form without submitting it.",
        version: "1.0.0",
        params: {
          cloudId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          issueIdOrKey: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          formId: { type: "string", required: true, visibility: "user-or-llm" },
          answers: {
            type: "object",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "PUT",
          url: (input) =>
            formsPath(
              input,
              `/api/2/issue/${encodeURIComponent(input.issueIdOrKey)}/form/${encodeURIComponent(input.formId)}/format/answers`,
            ),
          headers: json,
          body: (input) => ({ answers: input.answers }),
        },
        inputSchema: z
          .object({
            cloudId: CloudIdSchema,
            issueIdOrKey: IssueKeySchema,
            formId: IdSchema,
            answers: z.record(z.string(), z.unknown()),
          })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      ...(
        [
          ["submit-form", "submit", "POST"],
          ["reopen-form", "reopen", "POST"],
          ["externalise-form", "action/external", "POST"],
          ["internalise-form", "action/internal", "POST"],
        ] as const
      ).map(([action, suffix]) => ({
        id: `jira-service-management:${action}`,
        name: action,
        description: `Performs the ${action.replace(/-/gu, " ")} action on a form.`,
        version: "1.0.0",
        params: {
          cloudId: {
            type: "string",
            required: true,
            visibility: "user-or-llm" as const,
          },
          issueIdOrKey: {
            type: "string",
            required: true,
            visibility: "user-or-llm" as const,
          },
          formId: {
            type: "string",
            required: true,
            visibility: "user-or-llm" as const,
          },
        },
        request: {
          method: "POST" as const,
          url: (input: {
            cloudId: string;
            issueIdOrKey: string;
            formId: string;
          }) =>
            formsPath(
              input,
              `/api/2/issue/${encodeURIComponent(input.issueIdOrKey)}/form/${encodeURIComponent(input.formId)}/${suffix}`,
            ),
          headers: json,
        },
        inputSchema: z
          .object({
            cloudId: CloudIdSchema,
            issueIdOrKey: IssueKeySchema,
            formId: IdSchema,
          })
          .strict(),
        transformResponse: async (response: Response) =>
          response.status === 204
            ? { ok: true }
            : ((await response.json()) as unknown),
        outputSchema: OpaqueDocumentSchema,
      })),
      {
        id: "jira-service-management:delete-form",
        name: "Delete Form",
        description: "Removes a form from a request.",
        version: "1.0.0",
        params: {
          cloudId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          issueIdOrKey: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          formId: { type: "string", required: true, visibility: "user-or-llm" },
        },
        request: {
          method: "DELETE",
          url: (input) =>
            formsPath(
              input,
              `/api/2/issue/${encodeURIComponent(input.issueIdOrKey)}/form/${encodeURIComponent(input.formId)}`,
            ),
          headers: json,
        },
        inputSchema: z
          .object({
            cloudId: CloudIdSchema,
            issueIdOrKey: IssueKeySchema,
            formId: IdSchema,
          })
          .strict(),
        transformResponse: async () => ({ deleted: true as const }),
        outputSchema: DeletedSchema,
      },
      {
        id: "jira-service-management:copy-forms",
        name: "Copy Forms",
        description: "Copies the forms of one request onto another.",
        version: "1.0.0",
        params: {
          cloudId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          issueIdOrKey: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          targetIssueIdOrKey: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "POST",
          url: (input) =>
            formsPath(
              input,
              `/api/2/issue/${encodeURIComponent(input.issueIdOrKey)}/form/copy`,
            ),
          headers: json,
          body: (input) => ({ targetIssueIdOrKey: input.targetIssueIdOrKey }),
        },
        inputSchema: z
          .object({
            cloudId: CloudIdSchema,
            issueIdOrKey: IssueKeySchema,
            targetIssueIdOrKey: IssueKeySchema,
          })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:list-asset-schemas",
        name: "List Asset Schemas",
        description: "Lists the object schemas in an Assets workspace.",
        version: "1.0.0",
        params: {
          workspaceId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "GET",
          url: (input) => assetsPath(input, "/objectschema/list"),
          headers: json,
          retry: { enabled: true },
        },
        inputSchema: z.object({ workspaceId: WorkspaceIdSchema }).strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:get-asset-schema",
        name: "Get Asset Schema",
        description: "Reads one Assets object schema.",
        version: "1.0.0",
        params: {
          workspaceId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          schemaId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "GET",
          url: (input) =>
            assetsPath(
              input,
              `/objectschema/${encodeURIComponent(input.schemaId)}`,
            ),
          headers: json,
          retry: { enabled: true },
        },
        inputSchema: z
          .object({ workspaceId: WorkspaceIdSchema, schemaId: IdSchema })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:list-asset-object-types",
        name: "List Asset Object Types",
        description: "Lists the object types of an Assets schema.",
        version: "1.0.0",
        params: {
          workspaceId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          schemaId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "GET",
          url: (input) =>
            assetsPath(
              input,
              `/objectschema/${encodeURIComponent(input.schemaId)}/objecttypes/flat`,
            ),
          headers: json,
          retry: { enabled: true },
        },
        inputSchema: z
          .object({ workspaceId: WorkspaceIdSchema, schemaId: IdSchema })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:get-asset-object-type-attributes",
        name: "Get Asset Object Type Attributes",
        description: "Reads the attributes defined on an Assets object type.",
        version: "1.0.0",
        params: {
          workspaceId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          objectTypeId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "GET",
          url: (input) =>
            assetsPath(
              input,
              `/objecttype/${encodeURIComponent(input.objectTypeId)}/attributes`,
            ),
          headers: json,
          retry: { enabled: true },
        },
        inputSchema: z
          .object({ workspaceId: WorkspaceIdSchema, objectTypeId: IdSchema })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:search-assets-aql",
        name: "Search Assets by AQL",
        description: "Runs an Assets Query Language search.",
        version: "1.0.0",
        params: {
          workspaceId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          qlQuery: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          page: { type: "number", visibility: "user-or-llm" },
          resultsPerPage: { type: "number", visibility: "user-or-llm" },
        },
        request: {
          method: "POST",
          url: (input) => assetsPath(input, "/object/aql"),
          headers: json,
          body: (input) => ({
            qlQuery: input.qlQuery,
            page: input.page ?? 1,
            resultPerPage: input.resultsPerPage ?? 25,
          }),
        },
        inputSchema: z
          .object({
            workspaceId: WorkspaceIdSchema,
            qlQuery: z.string().min(1).max(4_000),
            page: z.number().int().min(1).max(1_000).optional(),
            resultsPerPage: z.number().int().min(1).max(200).optional(),
          })
          .strict(),
        maxResponseBytes: 512 * 1024,
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:get-asset-object",
        name: "Get Asset Object",
        description: "Reads one Assets object.",
        version: "1.0.0",
        params: {
          workspaceId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          objectId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "GET",
          url: (input) =>
            assetsPath(input, `/object/${encodeURIComponent(input.objectId)}`),
          headers: json,
          retry: { enabled: true },
        },
        inputSchema: z
          .object({ workspaceId: WorkspaceIdSchema, objectId: IdSchema })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:create-asset-object",
        name: "Create Asset Object",
        description: "Creates an Assets object.",
        version: "1.0.0",
        params: {
          workspaceId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          objectTypeId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          attributes: {
            type: "array",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "POST",
          url: (input) => assetsPath(input, "/object/create"),
          headers: json,
          body: (input) => ({
            objectTypeId: input.objectTypeId,
            attributes: input.attributes,
          }),
        },
        inputSchema: z
          .object({
            workspaceId: WorkspaceIdSchema,
            objectTypeId: IdSchema,
            attributes: z.array(z.record(z.string(), z.unknown())).min(1),
          })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:update-asset-object",
        name: "Update Asset Object",
        description: "Updates an Assets object.",
        version: "1.0.0",
        params: {
          workspaceId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          objectId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          attributes: {
            type: "array",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "PUT",
          url: (input) =>
            assetsPath(input, `/object/${encodeURIComponent(input.objectId)}`),
          headers: json,
          body: (input) => ({ attributes: input.attributes }),
        },
        inputSchema: z
          .object({
            workspaceId: WorkspaceIdSchema,
            objectId: IdSchema,
            attributes: z.array(z.record(z.string(), z.unknown())).min(1),
          })
          .strict(),
        outputSchema: OpaqueDocumentSchema,
      },
      {
        id: "jira-service-management:delete-asset-object",
        name: "Delete Asset Object",
        description: "Deletes an Assets object.",
        version: "1.0.0",
        params: {
          workspaceId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
          objectId: {
            type: "string",
            required: true,
            visibility: "user-or-llm",
          },
        },
        request: {
          method: "DELETE",
          url: (input) =>
            assetsPath(input, `/object/${encodeURIComponent(input.objectId)}`),
          headers: json,
        },
        inputSchema: z
          .object({ workspaceId: WorkspaceIdSchema, objectId: IdSchema })
          .strict(),
        transformResponse: async () => ({ deleted: true as const }),
        outputSchema: DeletedSchema,
      },
    ],
  });
}

export interface JiraServiceManagementProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: AtlassianClientFactory;
}

/** Executes the pinned JSM Service Desk actions through jira.js. */
export function createJiraServiceManagementProviderSdk(
  config: JiraServiceManagementProviderSdkConfig,
): IntegrationProviderSdk {
  return createAtlassianProviderSdk({
    integrationId: "jira-service-management",
    operations: JSM_OPERATIONS,
    oauthRuntime: config.oauthRuntime,
    clientFactory: config.clientFactory ?? createJiraServiceDeskClient,
  });
}

/**
 * Jira Service Management's complete delivery unit: the Service Desk SDK for
 * requests, queues, SLAs, and organizations, plus the typed REST lane for the
 * Forms and Assets products that ship with it and have no SDK.
 */
export function createJiraServiceManagementPack(
  options: { clientFactory?: AtlassianClientFactory } = {},
): IntegrationProviderPack {
  return createAtlassianPack({
    integrationId: "jira-service-management",
    operations: JSM_OPERATIONS,
    clientFactory: options.clientFactory ?? createJiraServiceDeskClient,
    triggerCoverage: jiraServiceManagementTriggerCoverage(),
    restCoverage: JSM_REST_REVIEWS,
    createRestAdapters: (context) =>
      context.oauthRuntime
        ? [
            createJiraServiceManagementRestProviderSdk({
              oauthRuntime: context.oauthRuntime,
            }),
          ]
        : [],
  });
}

export function getJiraServiceManagementProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  const operationIds = [
    ...Object.keys(JSM_OPERATIONS),
    ...JSM_FORM_OPERATIONS,
    ...JSM_ASSET_OPERATIONS,
  ];
  return { operations: operationIds.length, operationIds };
}
