import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from close's published OpenAPI document:
 * https://api.close.com/api/openapi.json
 *
 * This provider is outside the pinned source, so its action table is its own
 * coverage. The table is the shallowest CRUD operations the document declares,
 * capped at 22 — a vendor's top-level resources, not everything it serves.
 */
const SPEC_NOTE =
  "close publishes no maintained Node SDK; its OpenAPI document at https://api.close.com/api/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-lead",
    name: "List Lead",
    description: "List Leads",
    method: "GET",
    url: (i) =>
      `/lead/${restQuery({ _limit: i.limit, _skip: i.skip, _fields: i.fields })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        skip: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        fields: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-lead",
    name: "Create Lead",
    description: "Create a new lead",
    method: "POST",
    url: "/lead/",
    input: z
      .object({
        body: SpecObject,
      })
      .strict(),
    body: (i) => ({
      ...(i.body ?? {}),
    }),
  },
  {
    action: "get-lead",
    name: "Get Lead",
    description: "Get a single Lead",
    method: "GET",
    url: (i) =>
      `/lead/${restSegment(i.id)}/${restQuery({ _fields: i.fields })}`,
    input: z
      .object({
        id: z.string().max(4_000),
        fields: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "update-lead",
    name: "Update Lead",
    description: "Update an existing lead",
    method: "PUT",
    url: (i) => `/lead/${restSegment(i.id)}/`,
    input: z
      .object({
        id: z.string().max(4_000),
        body: SpecObject,
      })
      .strict(),
    body: (i) => ({
      ...(i.body ?? {}),
    }),
  },
  {
    action: "delete-lead",
    name: "Delete Lead",
    description: "Delete a lead",
    method: "DELETE",
    url: (i) => `/lead/${restSegment(i.id)}/`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-contact",
    name: "List Contact",
    description: "List contacts",
    method: "GET",
    url: (i) =>
      `/contact/${restQuery({ _limit: i.limit, _skip: i.skip, _fields: i.fields, lead_id: i.leadId })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        skip: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        fields: z.string().max(4_000).optional(),
        leadId: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-contact",
    name: "Create Contact",
    description: "Create a new contact",
    method: "POST",
    url: (i) => `/contact/${restQuery({ _fields: i.fields })}`,
    input: z
      .object({
        fields: z.string().max(4_000).optional(),
        createdBy: z.string().max(4_000).optional(),
        dateCreated: z.string().max(4_000).optional(),
        emails: z.string().max(4_000).optional(),
        leadId: z.string().max(4_000).optional(),
        name: z.string().max(4_000).optional(),
        phones: z.string().max(4_000).optional(),
        timezone: z.string().max(4_000).optional(),
        title: z.string().max(4_000).optional(),
        urls: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.createdBy !== undefined ? { created_by: i.createdBy } : {}),
      ...(i.dateCreated !== undefined ? { date_created: i.dateCreated } : {}),
      ...(i.emails !== undefined ? { emails: i.emails } : {}),
      ...(i.leadId !== undefined ? { lead_id: i.leadId } : {}),
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.phones !== undefined ? { phones: i.phones } : {}),
      ...(i.timezone !== undefined ? { timezone: i.timezone } : {}),
      ...(i.title !== undefined ? { title: i.title } : {}),
      ...(i.urls !== undefined ? { urls: i.urls } : {}),
    }),
  },
  {
    action: "get-contact",
    name: "Get Contact",
    description: "Fetch a single contact",
    method: "GET",
    url: (i) =>
      `/contact/${restSegment(i.id)}/${restQuery({ _fields: i.fields })}`,
    input: z
      .object({
        id: z.string().max(4_000),
        fields: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "update-contact",
    name: "Update Contact",
    description: "Update an existing contact",
    method: "PUT",
    url: (i) =>
      `/contact/${restSegment(i.id)}/${restQuery({ _fields: i.fields })}`,
    input: z
      .object({
        id: z.string().max(4_000),
        fields: z.string().max(4_000).optional(),
        emails: z.string().max(4_000).optional(),
        leadId: z.string().max(4_000).optional(),
        name: z.string().max(4_000).optional(),
        phones: z.string().max(4_000).optional(),
        timezone: z.string().max(4_000).optional(),
        title: z.string().max(4_000).optional(),
        urls: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.emails !== undefined ? { emails: i.emails } : {}),
      ...(i.leadId !== undefined ? { lead_id: i.leadId } : {}),
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.phones !== undefined ? { phones: i.phones } : {}),
      ...(i.timezone !== undefined ? { timezone: i.timezone } : {}),
      ...(i.title !== undefined ? { title: i.title } : {}),
      ...(i.urls !== undefined ? { urls: i.urls } : {}),
    }),
  },
  {
    action: "delete-contact",
    name: "Delete Contact",
    description: "Delete a contact",
    method: "DELETE",
    url: (i) => `/contact/${restSegment(i.id)}/`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-opportunity",
    name: "List Opportunity",
    description: "List or filter opportunities",
    method: "GET",
    url: (i) =>
      `/opportunity/${restQuery({ _limit: i.limit, _skip: i.skip, _fields: i.fields, lead_id: i.leadId, organization_id: i.organizationId, user_id: i.userId, user_id__in: i.userIdIn, status_id: i.statusId, status_id__in: i.statusIdIn, status_type: i.statusType, status_type__in: i.statusTypeIn, status_label: i.statusLabel, status_label__in: i.statusLabelIn, status: i.status, status__in: i.statusIn, date_won: i.dateWon, date_won__gte: i.dateWonGte, date_won__gt: i.dateWonGt, date_won__lte: i.dateWonLte, date_won__lt: i.dateWonLt, date_created: i.dateCreated, date_created__gte: i.dateCreatedGte, date_created__gt: i.dateCreatedGt, date_created__lte: i.dateCreatedLte, date_created__lt: i.dateCreatedLt, date_updated: i.dateUpdated, date_updated__gte: i.dateUpdatedGte, date_updated__gt: i.dateUpdatedGt, date_updated__lte: i.dateUpdatedLte, date_updated__lt: i.dateUpdatedLt, value_period: i.valuePeriod, value_period__in: i.valuePeriodIn, query: i.query, lead_query: i.leadQuery, lead_saved_search_id: i.leadSavedSearchId, is_stalled: i.isStalled, _order_by: i.orderBy, _group_by: i.groupBy })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        skip: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        fields: z.string().max(4_000).optional(),
        leadId: z.string().max(4_000).optional(),
        organizationId: z.string().max(4_000).optional(),
        userId: z.string().max(4_000).optional(),
        userIdIn: z.string().max(4_000).optional(),
        statusId: z.string().max(4_000).optional(),
        statusIdIn: z.string().max(4_000).optional(),
        statusType: z.string().max(4_000).optional(),
        statusTypeIn: z.string().max(4_000).optional(),
        statusLabel: z.string().max(4_000).optional(),
        statusLabelIn: z.string().max(4_000).optional(),
        status: z.string().max(4_000).optional(),
        statusIn: z.string().max(4_000).optional(),
        dateWon: z.string().max(4_000).optional(),
        dateWonGte: z.string().max(4_000).optional(),
        dateWonGt: z.string().max(4_000).optional(),
        dateWonLte: z.string().max(4_000).optional(),
        dateWonLt: z.string().max(4_000).optional(),
        dateCreated: z.string().max(4_000).optional(),
        dateCreatedGte: z.string().max(4_000).optional(),
        dateCreatedGt: z.string().max(4_000).optional(),
        dateCreatedLte: z.string().max(4_000).optional(),
        dateCreatedLt: z.string().max(4_000).optional(),
        dateUpdated: z.string().max(4_000).optional(),
        dateUpdatedGte: z.string().max(4_000).optional(),
        dateUpdatedGt: z.string().max(4_000).optional(),
        dateUpdatedLte: z.string().max(4_000).optional(),
        dateUpdatedLt: z.string().max(4_000).optional(),
        valuePeriod: z.string().max(4_000).optional(),
        valuePeriodIn: z.string().max(4_000).optional(),
        query: z.string().max(4_000).optional(),
        leadQuery: z.string().max(4_000).optional(),
        leadSavedSearchId: z.string().max(4_000).optional(),
        isStalled: z.string().max(4_000).optional(),
        orderBy: z.string().max(4_000).optional(),
        groupBy: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-opportunity",
    name: "Create Opportunity",
    description: "Create an opportunity",
    method: "POST",
    url: "/opportunity/",
    input: z
      .object({
        attachments: z.string().max(4_000).optional(),
        confidence: z.string().max(4_000).optional(),
        contactId: z.string().max(4_000).optional(),
        createdBy: z.string().max(4_000).optional(),
        dateCreated: z.string().max(4_000).optional(),
        dateWon: z.string().max(4_000).optional(),
        leadId: z.string().max(4_000).optional(),
        note: z.string().max(4_000).optional(),
        noteHtml: z.string().max(4_000).optional(),
        pipelineId: z.string().max(4_000).optional(),
        statusId: z.string().max(4_000).optional(),
        userId: z.string().max(4_000).optional(),
        value: z.string().max(4_000).optional(),
        valuePeriod: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.attachments !== undefined ? { attachments: i.attachments } : {}),
      ...(i.confidence !== undefined ? { confidence: i.confidence } : {}),
      ...(i.contactId !== undefined ? { contact_id: i.contactId } : {}),
      ...(i.createdBy !== undefined ? { created_by: i.createdBy } : {}),
      ...(i.dateCreated !== undefined ? { date_created: i.dateCreated } : {}),
      ...(i.dateWon !== undefined ? { date_won: i.dateWon } : {}),
      ...(i.leadId !== undefined ? { lead_id: i.leadId } : {}),
      ...(i.note !== undefined ? { note: i.note } : {}),
      ...(i.noteHtml !== undefined ? { note_html: i.noteHtml } : {}),
      ...(i.pipelineId !== undefined ? { pipeline_id: i.pipelineId } : {}),
      ...(i.statusId !== undefined ? { status_id: i.statusId } : {}),
      ...(i.userId !== undefined ? { user_id: i.userId } : {}),
      ...(i.value !== undefined ? { value: i.value } : {}),
      ...(i.valuePeriod !== undefined ? { value_period: i.valuePeriod } : {}),
    }),
  },
  {
    action: "get-opportunity",
    name: "Get Opportunity",
    description: "Retrieve an opportunity",
    method: "GET",
    url: (i) =>
      `/opportunity/${restSegment(i.id)}/${restQuery({ _fields: i.fields })}`,
    input: z
      .object({
        id: z.string().max(4_000),
        fields: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "update-opportunity",
    name: "Update Opportunity",
    description: "Update an opportunity",
    method: "PUT",
    url: (i) => `/opportunity/${restSegment(i.id)}/`,
    input: z
      .object({
        id: z.string().max(4_000),
        attachments: SpecArray.optional(),
        confidence: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        contactId: z.string().max(4_000).optional(),
        dateWon: z.string().max(4_000).optional(),
        note: z.string().max(4_000).optional(),
        noteHtml: z.string().max(4_000).optional(),
        status: z.string().max(4_000).optional(),
        statusId: z.string().max(4_000).optional(),
        userId: z.string().max(4_000).optional(),
        value: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        valuePeriod: z.enum(["one_time", "monthly", "annual"]).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.attachments !== undefined ? { attachments: i.attachments } : {}),
      ...(i.confidence !== undefined ? { confidence: i.confidence } : {}),
      ...(i.contactId !== undefined ? { contact_id: i.contactId } : {}),
      ...(i.dateWon !== undefined ? { date_won: i.dateWon } : {}),
      ...(i.note !== undefined ? { note: i.note } : {}),
      ...(i.noteHtml !== undefined ? { note_html: i.noteHtml } : {}),
      ...(i.status !== undefined ? { status: i.status } : {}),
      ...(i.statusId !== undefined ? { status_id: i.statusId } : {}),
      ...(i.userId !== undefined ? { user_id: i.userId } : {}),
      ...(i.value !== undefined ? { value: i.value } : {}),
      ...(i.valuePeriod !== undefined ? { value_period: i.valuePeriod } : {}),
    }),
  },
  {
    action: "delete-opportunity",
    name: "Delete Opportunity",
    description: "Delete an opportunity",
    method: "DELETE",
    url: (i) => `/opportunity/${restSegment(i.id)}/`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-task",
    name: "List Task",
    description: "List or filter tasks",
    method: "GET",
    url: (i) =>
      `/task/${restQuery({ _limit: i.limit, _skip: i.skip, assigned_to: i.assignedTo, format: i.format, id: i.id, id__in: i.idIn, is_complete: i.isComplete, lead_id: i.leadId, _order_by: i.orderBy, organization_id: i.organizationId, _type: i.type, _type__in: i.typeIn, view: i.view, date: i.date, date__lt: i.dateLt, date__lte: i.dateLte, date__gt: i.dateGt, date__gte: i.dateGte, due_date: i.dueDate, due_date__lt: i.dueDateLt, due_date__lte: i.dueDateLte, due_date__gt: i.dueDateGt, due_date__gte: i.dueDateGte, date_created__lt: i.dateCreatedLt, date_created__lte: i.dateCreatedLte, date_created__gt: i.dateCreatedGt, date_created__gte: i.dateCreatedGte, date_updated__lt: i.dateUpdatedLt, date_updated__lte: i.dateUpdatedLte, date_updated__gt: i.dateUpdatedGt, date_updated__gte: i.dateUpdatedGte, _fields: i.fields })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        skip: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        assignedTo: z.string().max(4_000).optional(),
        format: z.string().max(4_000).optional(),
        id: z.string().max(4_000).optional(),
        idIn: z.string().max(4_000).optional(),
        isComplete: z.string().max(4_000).optional(),
        leadId: z.string().max(4_000).optional(),
        orderBy: z.string().max(4_000).optional(),
        organizationId: z.string().max(4_000).optional(),
        type: z.string().max(4_000).optional(),
        typeIn: z.string().max(4_000).optional(),
        view: z.string().max(4_000).optional(),
        date: z.string().max(4_000).optional(),
        dateLt: z.string().max(4_000).optional(),
        dateLte: z.string().max(4_000).optional(),
        dateGt: z.string().max(4_000).optional(),
        dateGte: z.string().max(4_000).optional(),
        dueDate: z.string().max(4_000).optional(),
        dueDateLt: z.string().max(4_000).optional(),
        dueDateLte: z.string().max(4_000).optional(),
        dueDateGt: z.string().max(4_000).optional(),
        dueDateGte: z.string().max(4_000).optional(),
        dateCreatedLt: z.string().max(4_000).optional(),
        dateCreatedLte: z.string().max(4_000).optional(),
        dateCreatedGt: z.string().max(4_000).optional(),
        dateCreatedGte: z.string().max(4_000).optional(),
        dateUpdatedLt: z.string().max(4_000).optional(),
        dateUpdatedLte: z.string().max(4_000).optional(),
        dateUpdatedGt: z.string().max(4_000).optional(),
        dateUpdatedGte: z.string().max(4_000).optional(),
        fields: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-task",
    name: "Create Task",
    description: "Create a task",
    method: "POST",
    url: (i) => `/task/${restQuery({ _fields: i.fields })}`,
    input: z
      .object({
        fields: z.string().max(4_000).optional(),
        body: SpecObject,
      })
      .strict(),
    body: (i) => ({
      ...(i.body ?? {}),
    }),
  },
  {
    action: "update-task",
    name: "Update Task",
    description: "Bulk-update tasks",
    method: "PUT",
    url: (i) =>
      `/task/${restQuery({ assigned_to: i.assignedTo, format: i.format, id: i.id, id__in: i.idIn, is_complete: i.isComplete, lead_id: i.leadId, _order_by: i.orderBy, organization_id: i.organizationId, _type: i.type, _type__in: i.typeIn, view: i.view, date: i.date, date__lt: i.dateLt, date__lte: i.dateLte, date__gt: i.dateGt, date__gte: i.dateGte, due_date: i.dueDate, due_date__lt: i.dueDateLt, due_date__lte: i.dueDateLte, due_date__gt: i.dueDateGt, due_date__gte: i.dueDateGte, date_created__lt: i.dateCreatedLt, date_created__lte: i.dateCreatedLte, date_created__gt: i.dateCreatedGt, date_created__gte: i.dateCreatedGte, date_updated__lt: i.dateUpdatedLt, date_updated__lte: i.dateUpdatedLte, date_updated__gt: i.dateUpdatedGt, date_updated__gte: i.dateUpdatedGte, _fields: i.fields })}`,
    input: z
      .object({
        assignedTo: z.string().max(4_000).optional(),
        format: z.string().max(4_000).optional(),
        id: z.string().max(4_000).optional(),
        idIn: z.string().max(4_000).optional(),
        isComplete: z.string().max(4_000).optional(),
        leadId: z.string().max(4_000).optional(),
        orderBy: z.string().max(4_000).optional(),
        organizationId: z.string().max(4_000).optional(),
        type: z.string().max(4_000).optional(),
        typeIn: z.string().max(4_000).optional(),
        view: z.string().max(4_000).optional(),
        date: z.string().max(4_000).optional(),
        dateLt: z.string().max(4_000).optional(),
        dateLte: z.string().max(4_000).optional(),
        dateGt: z.string().max(4_000).optional(),
        dateGte: z.string().max(4_000).optional(),
        dueDate: z.string().max(4_000).optional(),
        dueDateLt: z.string().max(4_000).optional(),
        dueDateLte: z.string().max(4_000).optional(),
        dueDateGt: z.string().max(4_000).optional(),
        dueDateGte: z.string().max(4_000).optional(),
        dateCreatedLt: z.string().max(4_000).optional(),
        dateCreatedLte: z.string().max(4_000).optional(),
        dateCreatedGt: z.string().max(4_000).optional(),
        dateCreatedGte: z.string().max(4_000).optional(),
        dateUpdatedLt: z.string().max(4_000).optional(),
        dateUpdatedLte: z.string().max(4_000).optional(),
        dateUpdatedGt: z.string().max(4_000).optional(),
        dateUpdatedGte: z.string().max(4_000).optional(),
        fields: z.string().max(4_000).optional(),
        priority: z.enum(["high", "medium"]).optional(),
        resolution: z.string().max(4_000).optional(),
        text: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.priority !== undefined ? { priority: i.priority } : {}),
      ...(i.resolution !== undefined ? { resolution: i.resolution } : {}),
      ...(i.text !== undefined ? { text: i.text } : {}),
    }),
  },
  {
    action: "get-task",
    name: "Get Task",
    description: "Fetch a task's details",
    method: "GET",
    url: (i) =>
      `/task/${restSegment(i.id)}/${restQuery({ _fields: i.fields })}`,
    input: z
      .object({
        id: z.string().max(4_000),
        fields: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "delete-task",
    name: "Delete Task",
    description: "Delete a task",
    method: "DELETE",
    url: (i) => `/task/${restSegment(i.id)}/`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-activity",
    name: "List Activity",
    description: "List or filter all activity types",
    method: "GET",
    url: (i) =>
      `/activity/${restQuery({ _limit: i.limit, _skip: i.skip, id__in: i.idIn, lead_id: i.leadId, contact_id: i.contactId, user_id: i.userId, organization_id: i.organizationId, _type: i.type, date_created__gte: i.dateCreatedGte, date_created__lte: i.dateCreatedLte, date_created__gt: i.dateCreatedGt, date_created__lt: i.dateCreatedLt, activity_at__gte: i.activityAtGte, activity_at__lte: i.activityAtLte, activity_at__gt: i.activityAtGt, activity_at__lt: i.activityAtLt, lead_id__in: i.leadIdIn, user_id__in: i.userIdIn, contact_id__in: i.contactIdIn, _type__in: i.typeIn, _fields: i.fields, _order_by: i.orderBy })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        skip: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        idIn: z.string().max(4_000).optional(),
        leadId: z.string().max(4_000).optional(),
        contactId: z.string().max(4_000).optional(),
        userId: z.string().max(4_000).optional(),
        organizationId: z.string().max(4_000).optional(),
        type: z.string().max(4_000).optional(),
        dateCreatedGte: z.string().max(4_000).optional(),
        dateCreatedLte: z.string().max(4_000).optional(),
        dateCreatedGt: z.string().max(4_000).optional(),
        dateCreatedLt: z.string().max(4_000).optional(),
        activityAtGte: z.string().max(4_000).optional(),
        activityAtLte: z.string().max(4_000).optional(),
        activityAtGt: z.string().max(4_000).optional(),
        activityAtLt: z.string().max(4_000).optional(),
        leadIdIn: z.string().max(4_000).optional(),
        userIdIn: z.string().max(4_000).optional(),
        contactIdIn: z.string().max(4_000).optional(),
        typeIn: z.string().max(4_000).optional(),
        fields: z.string().max(4_000).optional(),
        orderBy: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-call",
    name: "List Call",
    description: "List or filter all Call activities",
    method: "GET",
    url: (i) =>
      `/activity/call/${restQuery({ _limit: i.limit, _skip: i.skip, id__in: i.idIn, lead_id: i.leadId, contact_id: i.contactId, user_id: i.userId, organization_id: i.organizationId, _type: i.type, date_created__gte: i.dateCreatedGte, date_created__lte: i.dateCreatedLte, date_created__gt: i.dateCreatedGt, date_created__lt: i.dateCreatedLt, activity_at__gte: i.activityAtGte, activity_at__lte: i.activityAtLte, activity_at__gt: i.activityAtGt, activity_at__lt: i.activityAtLt, _fields: i.fields })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        skip: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        idIn: z.string().max(4_000).optional(),
        leadId: z.string().max(4_000).optional(),
        contactId: z.string().max(4_000).optional(),
        userId: z.string().max(4_000).optional(),
        organizationId: z.string().max(4_000).optional(),
        type: z.string().max(4_000).optional(),
        dateCreatedGte: z.string().max(4_000).optional(),
        dateCreatedLte: z.string().max(4_000).optional(),
        dateCreatedGt: z.string().max(4_000).optional(),
        dateCreatedLt: z.string().max(4_000).optional(),
        activityAtGte: z.string().max(4_000).optional(),
        activityAtLte: z.string().max(4_000).optional(),
        activityAtGt: z.string().max(4_000).optional(),
        activityAtLt: z.string().max(4_000).optional(),
        fields: z.string().max(4_000).optional(),
      })
      .strict(),
  },
];

export function createClosePack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "close",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    beyondBaseline: true,
    actions: ACTIONS,
  });
}
