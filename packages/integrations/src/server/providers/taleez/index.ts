import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from taleez's published OpenAPI document:
 * https://api.taleez.com/openapi.json
 *
 * This provider is outside the pinned source, so its action table is its own
 * coverage. The table is the shallowest CRUD operations the document declares,
 * capped at 22 — a vendor's top-level resources, not everything it serves.
 */
const SPEC_NOTE =
  "taleez publishes no maintained Node SDK; its OpenAPI document at https://api.taleez.com/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-jobs",
    name: "List Jobs",
    description: "List all jobs in your company",
    method: "GET",
    url: (i) =>
      `/0/jobs${restQuery({ page: i.page, pageSize: i.pageSize, unitId: i.unitId, status: i.status, contract: i.contract, city: i.city, companyLabel: i.companyLabel, tag: i.tag, visibility: i.visibility, visibilityToken: i.visibilityToken, withDetails: i.withDetails, withProps: i.withProps, sort: i.sort })}`,
    input: z
      .object({
        page: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        unitId: SpecArray.optional(),
        status: SpecArray.optional(),
        contract: SpecArray.optional(),
        city: SpecArray.optional(),
        companyLabel: SpecArray.optional(),
        tag: SpecArray.optional(),
        visibility: SpecArray.optional(),
        visibilityToken: z.string().max(4_000).optional(),
        withDetails: z.boolean().optional(),
        withProps: z.boolean().optional(),
        sort: z
          .enum([
            "id",
            "dateCreation",
            "dateFirstPublish",
            "dateLastPublish",
            "label",
            "currentStatus",
            "contract",
            "companyLabel",
          ])
          .optional(),
      })
      .strict(),
  },
  {
    action: "get-job",
    name: "Get Job",
    description: "Get details of a job",
    method: "GET",
    url: (i) =>
      `/0/jobs/${restSegment(i.id)}${restQuery({ visibilityToken: i.visibilityToken })}`,
    input: z
      .object({
        id: z.string().max(4_000),
        visibilityToken: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-application",
    name: "Create Application",
    description: "Create an application for a job",
    method: "POST",
    url: (i) => `/0/jobs/${restSegment(i.id)}/applications`,
    input: z
      .object({
        id: z.string().max(4_000),
        firstName: z.string().max(4_000),
        lastName: z.string().max(4_000),
        email: z.string().max(4_000).optional(),
        phone: z.string().max(4_000).optional(),
        initialReferrer: z.string().max(4_000).optional(),
        bypassRequiredQuestions: z.boolean().optional(),
        locationId: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        answers: SpecArray.optional(),
      })
      .strict(),
    body: (i) => ({
      firstName: i.firstName,
      lastName: i.lastName,
      ...(i.email !== undefined ? { email: i.email } : {}),
      ...(i.phone !== undefined ? { phone: i.phone } : {}),
      ...(i.initialReferrer !== undefined
        ? { initialReferrer: i.initialReferrer }
        : {}),
      ...(i.bypassRequiredQuestions !== undefined
        ? { bypassRequiredQuestions: i.bypassRequiredQuestions }
        : {}),
      ...(i.locationId !== undefined ? { locationId: i.locationId } : {}),
      ...(i.answers !== undefined ? { answers: i.answers } : {}),
    }),
  },
  {
    action: "create-candidate",
    name: "Create Candidate",
    description: "Add candidates to a job",
    method: "POST",
    url: (i) => `/0/jobs/${restSegment(i.id)}/candidates`,
    input: z
      .object({
        id: z.string().max(4_000),
        ids: SpecArray.optional(),
        locationId: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.ids !== undefined ? { ids: i.ids } : {}),
      ...(i.locationId !== undefined ? { locationId: i.locationId } : {}),
    }),
  },
  {
    action: "list-questions",
    name: "List Questions",
    description: "Get questions of a job",
    method: "GET",
    url: (i) => `/0/jobs/${restSegment(i.id)}/questions`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "list-candidates",
    name: "List Candidates",
    description: "List all candidates in your company",
    method: "GET",
    url: (i) =>
      `/0/candidates${restQuery({ page: i.page, pageSize: i.pageSize, mail: i.mail, withProps: i.withProps })}`,
    input: z
      .object({
        page: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        mail: SpecArray.optional(),
        withProps: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "get-candidate",
    name: "Get Candidate",
    description: "Get a candidate",
    method: "GET",
    url: (i) => `/0/candidates/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "list-applications",
    name: "List Applications",
    description:
      "Get candidate applications list (can be : spontaneous, application to a job, association to a job)",
    method: "GET",
    url: (i) => `/0/candidates/${restSegment(i.id)}/applications`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "list-documents",
    name: "List Documents",
    description: "Get candidate document list",
    method: "GET",
    url: (i) => `/0/candidates/${restSegment(i.id)}/documents`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "create-document",
    name: "Create Document",
    description: "Add a document to a candidate",
    method: "POST",
    url: (i) =>
      `/0/candidates/${restSegment(i.id)}/documents${restQuery({ cv: i.cv })}`,
    input: z
      .object({
        id: z.string().max(4_000),
        cv: z.boolean().optional(),
        file: z.string().max(4_000),
      })
      .strict(),
    body: (i) => ({
      file: i.file,
    }),
    headers: () => ({ "content-type": "multipart/form-data" }),
  },
  {
    action: "list-pools",
    name: "List Pools",
    description: "List all pools in your company",
    method: "GET",
    url: (i) => `/0/pools${restQuery({ page: i.page, pageSize: i.pageSize })}`,
    input: z
      .object({
        page: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "list-candidate-properties",
    name: "List Candidate Properties",
    description: "List available candidate properties in your company",
    method: "GET",
    url: (i) =>
      `/0/candidate-properties${restQuery({ page: i.page, pageSize: i.pageSize, withDisabled: i.withDisabled })}`,
    input: z
      .object({
        page: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        withDisabled: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "get-candidate-property",
    name: "Get Candidate Property",
    description: "Get details of a candidate property",
    method: "GET",
    url: (i) => `/0/candidate-properties/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number().int().min(-1_000_000_000).max(1_000_000_000),
      })
      .strict(),
  },
  {
    action: "list-job-properties",
    name: "List Job Properties",
    description: "List available job properties in your company",
    method: "GET",
    url: (i) =>
      `/0/job-properties${restQuery({ page: i.page, pageSize: i.pageSize })}`,
    input: z
      .object({
        page: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "get-job-property",
    name: "Get Job Property",
    description: "Get details of a job property",
    method: "GET",
    url: (i) => `/0/job-properties/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number().int().min(-1_000_000_000).max(1_000_000_000),
      })
      .strict(),
  },
  {
    action: "list-events",
    name: "List Events",
    description: "List all events in your company",
    method: "GET",
    url: (i) =>
      `/0/events${restQuery({ page: i.page, pageSize: i.pageSize, sort: i.sort })}`,
    input: z
      .object({
        page: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        sort: z.enum(["id", "startDateTime", "endDateTime"]).optional(),
      })
      .strict(),
  },
  {
    action: "list-recruiters",
    name: "List Recruiters",
    description: "List all recruiters in your company",
    method: "GET",
    url: (i) =>
      `/0/recruiters${restQuery({ page: i.page, pageSize: i.pageSize })}`,
    input: z
      .object({
        page: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "list-units",
    name: "List Units",
    description: "List all units (entities) in your company",
    method: "GET",
    url: (i) => `/0/units${restQuery({ page: i.page, pageSize: i.pageSize })}`,
    input: z
      .object({
        page: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "create-tmp",
    name: "Create Tmp",
    description: "Upload a temporary document",
    method: "POST",
    url: "/0/documents/tmp",
    input: z
      .object({
        file: z.string().max(4_000),
      })
      .strict(),
    body: (i) => ({
      file: i.file,
    }),
    headers: () => ({ "content-type": "multipart/form-data" }),
  },
];

export function createTaleezPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "taleez",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    beyondBaseline: true,
    actions: ACTIONS,
  });
}
