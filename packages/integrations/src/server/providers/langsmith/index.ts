import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from LangSmith's published OpenAPI document:
 * https://api.smith.langchain.com/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "LangSmith publishes no maintained Node SDK; its OpenAPI document at https://api.smith.langchain.com/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "create-run",
    name: "Create Run",
    description: "Forward a single run to LangSmith for ingestion.",
    method: "POST",
    url: "/api/v1/runs",
    input: z
      .object({
        dottedOrder: z.string().max(4_000).optional(),
        endTime: z.string().max(4_000).optional(),
        error: z.string().max(4_000).optional(),
        events: SpecArray.optional(),
        extra: SpecObject.optional(),
        id: z.string().max(4_000).optional(),
        inputAttachments: SpecObject.optional(),
        inputs: SpecObject.optional(),
        name: z.string().max(4_000).optional(),
        outputAttachments: SpecObject.optional(),
        outputs: SpecObject.optional(),
        parentRunId: z.string().max(4_000).optional(),
        referenceExampleId: z.string().max(4_000).optional(),
        runType: z
          .enum([
            "tool",
            "chain",
            "llm",
            "retriever",
            "embedding",
            "prompt",
            "parser",
          ])
          .optional(),
        serialized: SpecObject.optional(),
        sessionId: z.string().max(4_000).optional(),
        sessionName: z.string().max(4_000).optional(),
        startTime: z.string().max(4_000).optional(),
        status: z.string().max(4_000).optional(),
        tags: SpecArray.optional(),
        traceId: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.dottedOrder !== undefined ? { dotted_order: i.dottedOrder } : {}),
      ...(i.endTime !== undefined ? { end_time: i.endTime } : {}),
      ...(i.error !== undefined ? { error: i.error } : {}),
      ...(i.events !== undefined ? { events: i.events } : {}),
      ...(i.extra !== undefined ? { extra: i.extra } : {}),
      ...(i.id !== undefined ? { id: i.id } : {}),
      ...(i.inputAttachments !== undefined
        ? { input_attachments: i.inputAttachments }
        : {}),
      ...(i.inputs !== undefined ? { inputs: i.inputs } : {}),
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.outputAttachments !== undefined
        ? { output_attachments: i.outputAttachments }
        : {}),
      ...(i.outputs !== undefined ? { outputs: i.outputs } : {}),
      ...(i.parentRunId !== undefined ? { parent_run_id: i.parentRunId } : {}),
      ...(i.referenceExampleId !== undefined
        ? { reference_example_id: i.referenceExampleId }
        : {}),
      ...(i.runType !== undefined ? { run_type: i.runType } : {}),
      ...(i.serialized !== undefined ? { serialized: i.serialized } : {}),
      ...(i.sessionId !== undefined ? { session_id: i.sessionId } : {}),
      ...(i.sessionName !== undefined ? { session_name: i.sessionName } : {}),
      ...(i.startTime !== undefined ? { start_time: i.startTime } : {}),
      ...(i.status !== undefined ? { status: i.status } : {}),
      ...(i.tags !== undefined ? { tags: i.tags } : {}),
      ...(i.traceId !== undefined ? { trace_id: i.traceId } : {}),
    }),
  },
  {
    action: "create-runs-batch",
    name: "Create Runs Batch",
    description: "Forward multiple runs to LangSmith in a single batch.",
    method: "POST",
    url: "/api/v1/runs/batch",
    input: z
      .object({
        patch: SpecArray.optional(),
        post: SpecArray.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.patch !== undefined ? { patch: i.patch } : {}),
      ...(i.post !== undefined ? { post: i.post } : {}),
    }),
  },
  {
    action: "update-run",
    name: "Update Run",
    description:
      "Patch an existing LangSmith run with outputs, status, or timing once it completes.",
    method: "PATCH",
    url: (i) => `/api/v1/runs/${restSegment(i.runId)}`,
    input: z
      .object({
        runId: z.string().max(4_000),
        dottedOrder: z.string().max(4_000).optional(),
        endTime: z.string().max(4_000).optional(),
        error: z.string().max(4_000).optional(),
        events: SpecArray.optional(),
        extra: SpecObject.optional(),
        id: z.string().max(4_000).optional(),
        inputAttachments: SpecObject.optional(),
        inputs: SpecObject.optional(),
        name: z.string().max(4_000).optional(),
        outputAttachments: SpecObject.optional(),
        outputs: SpecObject.optional(),
        parentRunId: z.string().max(4_000).optional(),
        referenceExampleId: z.string().max(4_000).optional(),
        runType: z
          .enum([
            "tool",
            "chain",
            "llm",
            "retriever",
            "embedding",
            "prompt",
            "parser",
          ])
          .optional(),
        serialized: SpecObject.optional(),
        sessionId: z.string().max(4_000).optional(),
        sessionName: z.string().max(4_000).optional(),
        startTime: z.string().max(4_000).optional(),
        status: z.string().max(4_000).optional(),
        tags: SpecArray.optional(),
        traceId: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.dottedOrder !== undefined ? { dotted_order: i.dottedOrder } : {}),
      ...(i.endTime !== undefined ? { end_time: i.endTime } : {}),
      ...(i.error !== undefined ? { error: i.error } : {}),
      ...(i.events !== undefined ? { events: i.events } : {}),
      ...(i.extra !== undefined ? { extra: i.extra } : {}),
      ...(i.id !== undefined ? { id: i.id } : {}),
      ...(i.inputAttachments !== undefined
        ? { input_attachments: i.inputAttachments }
        : {}),
      ...(i.inputs !== undefined ? { inputs: i.inputs } : {}),
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.outputAttachments !== undefined
        ? { output_attachments: i.outputAttachments }
        : {}),
      ...(i.outputs !== undefined ? { outputs: i.outputs } : {}),
      ...(i.parentRunId !== undefined ? { parent_run_id: i.parentRunId } : {}),
      ...(i.referenceExampleId !== undefined
        ? { reference_example_id: i.referenceExampleId }
        : {}),
      ...(i.runType !== undefined ? { run_type: i.runType } : {}),
      ...(i.serialized !== undefined ? { serialized: i.serialized } : {}),
      ...(i.sessionId !== undefined ? { session_id: i.sessionId } : {}),
      ...(i.sessionName !== undefined ? { session_name: i.sessionName } : {}),
      ...(i.startTime !== undefined ? { start_time: i.startTime } : {}),
      ...(i.status !== undefined ? { status: i.status } : {}),
      ...(i.tags !== undefined ? { tags: i.tags } : {}),
      ...(i.traceId !== undefined ? { trace_id: i.traceId } : {}),
    }),
  },
  {
    action: "get-run",
    name: "Get Run",
    description: "Retrieve a single LangSmith run by ID.",
    method: "GET",
    url: (i) =>
      `/api/v2/runs/${restSegment(i.runId)}${restQuery({ project_id: i.projectId, selects: i.selects, start_time: i.startTime })}`,
    input: z
      .object({
        runId: z.string().max(4_000),
        projectId: z.string().max(4_000),
        selects: SpecArray.optional(),
        startTime: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-feedback",
    name: "Create Feedback",
    description: "Attach a score, correction, or comment to a LangSmith run.",
    method: "POST",
    url: "/api/v1/feedback",
    input: z
      .object({
        createdAt: z.string().max(4_000).optional(),
        modifiedAt: z.string().max(4_000).optional(),
        key: z.string().max(4_000),
        score: z.string().max(4_000).optional(),
        value: z.string().max(4_000).optional(),
        comment: z.string().max(4_000).optional(),
        correction: z.string().max(4_000).optional(),
        feedbackGroupId: z.string().max(4_000).optional(),
        comparativeExperimentId: z.string().max(4_000).optional(),
        runId: z.string().max(4_000).optional(),
        sessionId: z.string().max(4_000).optional(),
        traceId: z.string().max(4_000).optional(),
        startTime: z.string().max(4_000).optional(),
        feedbackThreadId: z.string().max(4_000).optional(),
        extendTraceRetention: z.boolean().optional(),
        id: z.string().max(4_000).optional(),
        feedbackSource: z.string().max(4_000).optional(),
        feedbackConfig: z.string().max(4_000).optional(),
        error: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.createdAt !== undefined ? { created_at: i.createdAt } : {}),
      ...(i.modifiedAt !== undefined ? { modified_at: i.modifiedAt } : {}),
      key: i.key,
      ...(i.score !== undefined ? { score: i.score } : {}),
      ...(i.value !== undefined ? { value: i.value } : {}),
      ...(i.comment !== undefined ? { comment: i.comment } : {}),
      ...(i.correction !== undefined ? { correction: i.correction } : {}),
      ...(i.feedbackGroupId !== undefined
        ? { feedback_group_id: i.feedbackGroupId }
        : {}),
      ...(i.comparativeExperimentId !== undefined
        ? { comparative_experiment_id: i.comparativeExperimentId }
        : {}),
      ...(i.runId !== undefined ? { run_id: i.runId } : {}),
      ...(i.sessionId !== undefined ? { session_id: i.sessionId } : {}),
      ...(i.traceId !== undefined ? { trace_id: i.traceId } : {}),
      ...(i.startTime !== undefined ? { start_time: i.startTime } : {}),
      ...(i.feedbackThreadId !== undefined
        ? { feedback_thread_id: i.feedbackThreadId }
        : {}),
      ...(i.extendTraceRetention !== undefined
        ? { extend_trace_retention: i.extendTraceRetention }
        : {}),
      ...(i.id !== undefined ? { id: i.id } : {}),
      ...(i.feedbackSource !== undefined
        ? { feedback_source: i.feedbackSource }
        : {}),
      ...(i.feedbackConfig !== undefined
        ? { feedback_config: i.feedbackConfig }
        : {}),
      ...(i.error !== undefined ? { error: i.error } : {}),
    }),
  },
];

export function createLangsmithPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "langsmith",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
  });
}
