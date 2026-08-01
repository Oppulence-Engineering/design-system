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

// -------------------------------------------------------------------- Attio

/**
 * Objects and lists are addressed either by UUID or by their workspace API
 * slug ("people", "companies"), so both spellings have to pass.
 */
const AttioSlugOrId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);

/** Record, entry, note, task, comment, thread, and webhook IDs are UUIDs. */
const AttioUuid = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/u);

/**
 * Attio wraps every write in a `data` envelope and every attribute payload in
 * `values`. The exact value shape depends on the attribute's type, so it stays
 * open here rather than being guessed at.
 */
const AttioValues = z.record(z.string(), z.unknown());

/** A query filter, whose operators are Attio's own nested JSON grammar. */
const AttioFilter = z.record(z.string(), z.unknown());

/** Sorts are an ordered array of attribute/direction objects. */
const AttioSorts = z.array(z.record(z.string(), z.unknown())).max(32);

const AttioLimit = z.number().int().min(1).max(500).optional();
const AttioOffset = z.number().int().min(0).max(1_000_000).optional();

/** Attributes hang off either an object or a list, under the same sub-path. */
const AttioAttributeTarget = z.enum(["objects", "lists"]);

const ATTIO_ACTIONS: readonly RestAction<any>[] = [
  // ---------------------------------------------------------------- records
  {
    // Attio serves listing and searching from one query endpoint; this is the
    // paging-only half of it.
    action: "list-records",
    name: "List Records",
    description: "Lists the records of an object.",
    method: "POST",
    url: (i) => `/v2/objects/${restSegment(i.object)}/records/query`,
    input: z
      .object({
        object: AttioSlugOrId,
        sorts: AttioSorts.optional(),
        limit: AttioLimit,
        offset: AttioOffset,
      })
      .strict(),
    body: (i) => ({
      ...(i.sorts ? { sorts: i.sorts } : {}),
      ...(i.limit !== undefined ? { limit: i.limit } : {}),
      ...(i.offset !== undefined ? { offset: i.offset } : {}),
    }),
  },
  {
    // The filtered half of the same query endpoint.
    action: "search-records",
    name: "Search Records",
    description: "Finds the records of an object matching a filter.",
    method: "POST",
    url: (i) => `/v2/objects/${restSegment(i.object)}/records/query`,
    input: z
      .object({
        object: AttioSlugOrId,
        filter: AttioFilter,
        sorts: AttioSorts.optional(),
        limit: AttioLimit,
        offset: AttioOffset,
      })
      .strict(),
    body: (i) => ({
      filter: i.filter,
      ...(i.sorts ? { sorts: i.sorts } : {}),
      ...(i.limit !== undefined ? { limit: i.limit } : {}),
      ...(i.offset !== undefined ? { offset: i.offset } : {}),
    }),
  },
  {
    action: "get-record",
    name: "Get Record",
    description: "Reads one record of an object.",
    method: "GET",
    url: (i) =>
      `/v2/objects/${restSegment(i.object)}/records/${restSegment(i.recordId)}`,
    input: z.object({ object: AttioSlugOrId, recordId: AttioUuid }).strict(),
  },
  {
    action: "create-record",
    name: "Create Record",
    description: "Creates a record of an object.",
    method: "POST",
    url: (i) => `/v2/objects/${restSegment(i.object)}/records`,
    input: z.object({ object: AttioSlugOrId, values: AttioValues }).strict(),
    body: (i) => ({ data: { values: i.values } }),
  },
  {
    action: "update-record",
    name: "Update Record",
    description: "Changes the supplied attributes of a record.",
    method: "PATCH",
    url: (i) =>
      `/v2/objects/${restSegment(i.object)}/records/${restSegment(i.recordId)}`,
    input: z
      .object({
        object: AttioSlugOrId,
        recordId: AttioUuid,
        values: AttioValues,
      })
      .strict(),
    body: (i) => ({ data: { values: i.values } }),
  },
  {
    action: "delete-record",
    name: "Delete Record",
    description: "Deletes one record of an object.",
    method: "DELETE",
    url: (i) =>
      `/v2/objects/${restSegment(i.object)}/records/${restSegment(i.recordId)}`,
    input: z.object({ object: AttioSlugOrId, recordId: AttioUuid }).strict(),
    // Attio answers a delete with an empty data envelope; "optional" also
    // tolerates a bodiless response.
    emptyResponse: "optional",
  },
  {
    action: "assert-record-upsert",
    name: "Assert Record (Upsert)",
    description:
      "Creates a record, or updates the existing one that matches on an attribute.",
    method: "PUT",
    url: (i) =>
      `/v2/objects/${restSegment(i.object)}/records${restQuery({
        matching_attribute: i.matchingAttribute,
      })}`,
    input: z
      .object({
        object: AttioSlugOrId,
        // Which attribute decides identity; without it this would create a
        // duplicate rather than update.
        matchingAttribute: AttioSlugOrId,
        values: AttioValues,
      })
      .strict(),
    body: (i) => ({ data: { values: i.values } }),
  },

  // ------------------------------------------------------------------ notes
  {
    action: "list-notes",
    name: "List Notes",
    description: "Lists notes, optionally those on one record.",
    method: "GET",
    url: (i) =>
      `/v2/notes${restQuery({
        limit: i.limit,
        offset: i.offset,
        parent_object: i.parentObject,
        parent_record_id: i.parentRecordId,
      })}`,
    input: z
      .object({
        parentObject: AttioSlugOrId.optional(),
        parentRecordId: AttioUuid.optional(),
        limit: AttioLimit,
        offset: AttioOffset,
      })
      .strict(),
  },
  {
    action: "get-note",
    name: "Get Note",
    description: "Reads one note.",
    method: "GET",
    url: (i) => `/v2/notes/${restSegment(i.noteId)}`,
    input: z.object({ noteId: AttioUuid }).strict(),
  },
  {
    action: "create-note",
    name: "Create Note",
    description: "Adds a note to a record.",
    method: "POST",
    url: "/v2/notes",
    input: z
      .object({
        parentObject: AttioSlugOrId,
        parentRecordId: AttioUuid,
        title: z.string().max(1_024),
        content: z.string().max(100_000),
        format: z.enum(["plaintext", "markdown"]).optional(),
        createdAt: z.string().max(64).optional(),
      })
      .strict(),
    body: (i) => ({
      data: {
        parent_object: i.parentObject,
        parent_record_id: i.parentRecordId,
        title: i.title,
        format: i.format ?? "plaintext",
        content: i.content,
        ...(i.createdAt !== undefined ? { created_at: i.createdAt } : {}),
      },
    }),
  },
  {
    action: "delete-note",
    name: "Delete Note",
    description: "Deletes one note.",
    method: "DELETE",
    url: (i) => `/v2/notes/${restSegment(i.noteId)}`,
    input: z.object({ noteId: AttioUuid }).strict(),
    emptyResponse: "optional",
  },

  // ------------------------------------------------------------------ tasks
  {
    action: "list-tasks",
    name: "List Tasks",
    description: "Lists tasks, optionally those linked to one record.",
    method: "GET",
    url: (i) =>
      `/v2/tasks${restQuery({
        limit: i.limit,
        offset: i.offset,
        sort: i.sort,
        linked_object: i.linkedObject,
        linked_record_id: i.linkedRecordId,
        assignee: i.assignee,
        is_completed: i.isCompleted,
      })}`,
    input: z
      .object({
        linkedObject: AttioSlugOrId.optional(),
        linkedRecordId: AttioUuid.optional(),
        assignee: z.string().max(320).optional(),
        isCompleted: z.boolean().optional(),
        sort: z.enum(["created_at:asc", "created_at:desc"]).optional(),
        limit: AttioLimit,
        offset: AttioOffset,
      })
      .strict(),
  },
  {
    action: "get-task",
    name: "Get Task",
    description: "Reads one task.",
    method: "GET",
    url: (i) => `/v2/tasks/${restSegment(i.taskId)}`,
    input: z.object({ taskId: AttioUuid }).strict(),
  },
  {
    action: "create-task",
    name: "Create Task",
    description: "Creates a task, optionally linked to records.",
    method: "POST",
    url: "/v2/tasks",
    input: z
      .object({
        content: z.string().min(1).max(100_000),
        format: z.enum(["plaintext"]).optional(),
        deadlineAt: z.string().max(64).optional(),
        isCompleted: z.boolean().optional(),
        assignees: z
          .array(z.record(z.string(), z.unknown()))
          .max(64)
          .optional(),
        linkedRecords: z
          .array(z.record(z.string(), z.unknown()))
          .max(64)
          .optional(),
      })
      .strict(),
    body: (i) => ({
      data: {
        content: i.content,
        format: i.format ?? "plaintext",
        ...(i.deadlineAt !== undefined ? { deadline_at: i.deadlineAt } : {}),
        is_completed: i.isCompleted ?? false,
        assignees: i.assignees ?? [],
        linked_records: i.linkedRecords ?? [],
      },
    }),
  },
  {
    action: "update-task",
    name: "Update Task",
    description: "Changes a task's deadline, completion, or links.",
    method: "PATCH",
    url: (i) => `/v2/tasks/${restSegment(i.taskId)}`,
    input: z
      .object({
        taskId: AttioUuid,
        deadlineAt: z.string().max(64).optional(),
        isCompleted: z.boolean().optional(),
        assignees: z
          .array(z.record(z.string(), z.unknown()))
          .max(64)
          .optional(),
        linkedRecords: z
          .array(z.record(z.string(), z.unknown()))
          .max(64)
          .optional(),
      })
      .strict(),
    body: (i) => ({
      data: {
        ...(i.deadlineAt !== undefined ? { deadline_at: i.deadlineAt } : {}),
        ...(i.isCompleted !== undefined ? { is_completed: i.isCompleted } : {}),
        ...(i.assignees ? { assignees: i.assignees } : {}),
        ...(i.linkedRecords ? { linked_records: i.linkedRecords } : {}),
      },
    }),
  },
  {
    action: "delete-task",
    name: "Delete Task",
    description: "Deletes one task.",
    method: "DELETE",
    url: (i) => `/v2/tasks/${restSegment(i.taskId)}`,
    input: z.object({ taskId: AttioUuid }).strict(),
    emptyResponse: "optional",
  },

  // ---------------------------------------------------------------- objects
  {
    action: "list-objects",
    name: "List Objects",
    description: "Lists the objects defined in the workspace.",
    method: "GET",
    url: "/v2/objects",
    input: z.object({}).strict(),
  },
  {
    action: "get-object",
    name: "Get Object",
    description: "Reads one object's definition.",
    method: "GET",
    url: (i) => `/v2/objects/${restSegment(i.object)}`,
    input: z.object({ object: AttioSlugOrId }).strict(),
  },
  {
    action: "create-object",
    name: "Create Object",
    description: "Defines a new object in the workspace.",
    method: "POST",
    url: "/v2/objects",
    input: z
      .object({
        apiSlug: AttioSlugOrId,
        singularNoun: z.string().min(1).max(256),
        pluralNoun: z.string().min(1).max(256),
      })
      .strict(),
    body: (i) => ({
      data: {
        api_slug: i.apiSlug,
        singular_noun: i.singularNoun,
        plural_noun: i.pluralNoun,
      },
    }),
  },
  {
    action: "update-object",
    name: "Update Object",
    description: "Renames an object or changes its API slug.",
    method: "PATCH",
    url: (i) => `/v2/objects/${restSegment(i.object)}`,
    input: z
      .object({
        object: AttioSlugOrId,
        apiSlug: AttioSlugOrId.optional(),
        singularNoun: z.string().min(1).max(256).optional(),
        pluralNoun: z.string().min(1).max(256).optional(),
      })
      .strict(),
    body: (i) => ({
      data: {
        ...(i.apiSlug !== undefined ? { api_slug: i.apiSlug } : {}),
        ...(i.singularNoun !== undefined
          ? { singular_noun: i.singularNoun }
          : {}),
        ...(i.pluralNoun !== undefined ? { plural_noun: i.pluralNoun } : {}),
      },
    }),
  },

  // ------------------------------------------------------------------ lists
  {
    action: "list-lists",
    name: "List Lists",
    description: "Lists the lists the credential can reach.",
    method: "GET",
    url: "/v2/lists",
    input: z.object({}).strict(),
  },
  {
    action: "get-list",
    name: "Get List",
    description: "Reads one list's definition.",
    method: "GET",
    url: (i) => `/v2/lists/${restSegment(i.list)}`,
    input: z.object({ list: AttioSlugOrId }).strict(),
  },
  {
    action: "create-list",
    name: "Create List",
    description: "Creates a list over an object.",
    method: "POST",
    url: "/v2/lists",
    input: z
      .object({
        name: z.string().min(1).max(256),
        apiSlug: AttioSlugOrId,
        parentObject: AttioSlugOrId,
        // Attio requires the access model to be stated, not defaulted.
        workspaceAccess: z.enum(["full-access", "read-and-write", "read-only"]),
        workspaceMemberAccess: z
          .array(z.record(z.string(), z.unknown()))
          .max(256)
          .optional(),
      })
      .strict(),
    body: (i) => ({
      data: {
        name: i.name,
        api_slug: i.apiSlug,
        parent_object: i.parentObject,
        workspace_access: i.workspaceAccess,
        workspace_member_access: i.workspaceMemberAccess ?? [],
      },
    }),
  },
  {
    action: "update-list",
    name: "Update List",
    description: "Renames a list or changes its access model.",
    method: "PATCH",
    url: (i) => `/v2/lists/${restSegment(i.list)}`,
    input: z
      .object({
        list: AttioSlugOrId,
        name: z.string().min(1).max(256).optional(),
        apiSlug: AttioSlugOrId.optional(),
        workspaceAccess: z
          .enum(["full-access", "read-and-write", "read-only"])
          .optional(),
        workspaceMemberAccess: z
          .array(z.record(z.string(), z.unknown()))
          .max(256)
          .optional(),
      })
      .strict(),
    body: (i) => ({
      data: {
        ...(i.name !== undefined ? { name: i.name } : {}),
        ...(i.apiSlug !== undefined ? { api_slug: i.apiSlug } : {}),
        ...(i.workspaceAccess !== undefined
          ? { workspace_access: i.workspaceAccess }
          : {}),
        ...(i.workspaceMemberAccess
          ? { workspace_member_access: i.workspaceMemberAccess }
          : {}),
      },
    }),
  },

  // ----------------------------------------------------------- list entries
  {
    action: "query-list-entries",
    name: "Query List Entries",
    description: "Finds the entries of a list matching a filter.",
    method: "POST",
    url: (i) => `/v2/lists/${restSegment(i.list)}/entries/query`,
    input: z
      .object({
        list: AttioSlugOrId,
        filter: AttioFilter.optional(),
        sorts: AttioSorts.optional(),
        limit: AttioLimit,
        offset: AttioOffset,
      })
      .strict(),
    body: (i) => ({
      ...(i.filter ? { filter: i.filter } : {}),
      ...(i.sorts ? { sorts: i.sorts } : {}),
      ...(i.limit !== undefined ? { limit: i.limit } : {}),
      ...(i.offset !== undefined ? { offset: i.offset } : {}),
    }),
  },
  {
    action: "get-list-entry",
    name: "Get List Entry",
    description: "Reads one list entry.",
    method: "GET",
    url: (i) =>
      `/v2/lists/${restSegment(i.list)}/entries/${restSegment(i.entryId)}`,
    input: z.object({ list: AttioSlugOrId, entryId: AttioUuid }).strict(),
  },
  {
    action: "create-list-entry",
    name: "Create List Entry",
    description: "Adds a record to a list.",
    method: "POST",
    url: (i) => `/v2/lists/${restSegment(i.list)}/entries`,
    input: z
      .object({
        list: AttioSlugOrId,
        parentRecordId: AttioUuid,
        parentObject: AttioSlugOrId,
        entryValues: AttioValues.optional(),
      })
      .strict(),
    body: (i) => ({
      data: {
        parent_record_id: i.parentRecordId,
        parent_object: i.parentObject,
        entry_values: i.entryValues ?? {},
      },
    }),
  },
  {
    action: "update-list-entry",
    name: "Update List Entry",
    description: "Changes the supplied entry values on a list entry.",
    method: "PATCH",
    url: (i) =>
      `/v2/lists/${restSegment(i.list)}/entries/${restSegment(i.entryId)}`,
    input: z
      .object({
        list: AttioSlugOrId,
        entryId: AttioUuid,
        entryValues: AttioValues,
      })
      .strict(),
    body: (i) => ({ data: { entry_values: i.entryValues } }),
  },
  {
    action: "delete-list-entry",
    name: "Delete List Entry",
    description: "Removes one entry from a list.",
    method: "DELETE",
    url: (i) =>
      `/v2/lists/${restSegment(i.list)}/entries/${restSegment(i.entryId)}`,
    input: z.object({ list: AttioSlugOrId, entryId: AttioUuid }).strict(),
    emptyResponse: "optional",
  },

  // ---------------------------------------------------------------- members
  {
    action: "list-members",
    name: "List Members",
    description: "Lists the workspace's members.",
    method: "GET",
    url: "/v2/workspace_members",
    input: z.object({}).strict(),
  },
  {
    action: "get-member",
    name: "Get Member",
    description: "Reads one workspace member.",
    method: "GET",
    url: (i) => `/v2/workspace_members/${restSegment(i.workspaceMemberId)}`,
    input: z.object({ workspaceMemberId: AttioUuid }).strict(),
  },

  // --------------------------------------------------------------- comments
  {
    action: "create-comment",
    name: "Create Comment",
    description: "Posts a comment, starting or continuing a thread.",
    method: "POST",
    url: "/v2/comments",
    input: z
      .object({
        content: z.string().min(1).max(100_000),
        format: z.enum(["plaintext"]).optional(),
        author: z.record(z.string(), z.unknown()),
        // Continues an existing thread, or anchors a new one to a record.
        threadId: AttioUuid.optional(),
        recordId: AttioUuid.optional(),
        object: AttioSlugOrId.optional(),
        entryId: AttioUuid.optional(),
        list: AttioSlugOrId.optional(),
        createdAt: z.string().max(64).optional(),
      })
      .strict(),
    body: (i) => ({
      data: {
        format: i.format ?? "plaintext",
        content: i.content,
        author: i.author,
        ...(i.threadId !== undefined ? { thread_id: i.threadId } : {}),
        ...(i.recordId !== undefined ? { record_id: i.recordId } : {}),
        ...(i.object !== undefined ? { object: i.object } : {}),
        ...(i.entryId !== undefined ? { entry_id: i.entryId } : {}),
        ...(i.list !== undefined ? { list: i.list } : {}),
        ...(i.createdAt !== undefined ? { created_at: i.createdAt } : {}),
      },
    }),
  },
  {
    action: "get-comment",
    name: "Get Comment",
    description: "Reads one comment.",
    method: "GET",
    url: (i) => `/v2/comments/${restSegment(i.commentId)}`,
    input: z.object({ commentId: AttioUuid }).strict(),
  },
  {
    action: "delete-comment",
    name: "Delete Comment",
    description: "Deletes one comment.",
    method: "DELETE",
    url: (i) => `/v2/comments/${restSegment(i.commentId)}`,
    input: z.object({ commentId: AttioUuid }).strict(),
    emptyResponse: "optional",
  },

  // ---------------------------------------------------------------- threads
  {
    action: "list-threads",
    name: "List Threads",
    description: "Lists comment threads, optionally those on one record.",
    method: "GET",
    url: (i) =>
      `/v2/threads${restQuery({
        record_id: i.recordId,
        object: i.object,
        entry_id: i.entryId,
        list: i.list,
        limit: i.limit,
        offset: i.offset,
      })}`,
    input: z
      .object({
        recordId: AttioUuid.optional(),
        object: AttioSlugOrId.optional(),
        entryId: AttioUuid.optional(),
        list: AttioSlugOrId.optional(),
        limit: AttioLimit,
        offset: AttioOffset,
      })
      .strict(),
  },
  {
    action: "get-thread",
    name: "Get Thread",
    description: "Reads one comment thread.",
    method: "GET",
    url: (i) => `/v2/threads/${restSegment(i.threadId)}`,
    input: z.object({ threadId: AttioUuid }).strict(),
  },

  // --------------------------------------------------------------- webhooks
  {
    action: "list-webhooks",
    name: "List Webhooks",
    description: "Lists the workspace's webhooks.",
    method: "GET",
    url: (i) =>
      `/v2/webhooks${restQuery({ limit: i.limit, offset: i.offset })}`,
    input: z.object({ limit: AttioLimit, offset: AttioOffset }).strict(),
  },
  {
    action: "get-webhook",
    name: "Get Webhook",
    description: "Reads one webhook's target and subscriptions.",
    method: "GET",
    url: (i) => `/v2/webhooks/${restSegment(i.webhookId)}`,
    input: z.object({ webhookId: AttioUuid }).strict(),
  },
  {
    action: "create-webhook",
    name: "Create Webhook",
    description: "Registers a webhook target with its event subscriptions.",
    method: "POST",
    url: "/v2/webhooks",
    input: z
      .object({
        targetUrl: z.string().url().max(2_048),
        subscriptions: z
          .array(z.record(z.string(), z.unknown()))
          .min(1)
          .max(64),
      })
      .strict(),
    body: (i) => ({
      data: { target_url: i.targetUrl, subscriptions: i.subscriptions },
    }),
  },
  {
    action: "update-webhook",
    name: "Update Webhook",
    description: "Changes a webhook's target or subscriptions.",
    method: "PATCH",
    url: (i) => `/v2/webhooks/${restSegment(i.webhookId)}`,
    input: z
      .object({
        webhookId: AttioUuid,
        targetUrl: z.string().url().max(2_048).optional(),
        subscriptions: z
          .array(z.record(z.string(), z.unknown()))
          .max(64)
          .optional(),
      })
      .strict(),
    body: (i) => ({
      data: {
        ...(i.targetUrl !== undefined ? { target_url: i.targetUrl } : {}),
        ...(i.subscriptions ? { subscriptions: i.subscriptions } : {}),
      },
    }),
  },
  {
    action: "delete-webhook",
    name: "Delete Webhook",
    description: "Deletes one webhook.",
    method: "DELETE",
    url: (i) => `/v2/webhooks/${restSegment(i.webhookId)}`,
    input: z.object({ webhookId: AttioUuid }).strict(),
    emptyResponse: "optional",
  },

  // ------------------------------------------------------------- attributes
  {
    action: "list-attributes",
    name: "List Attributes",
    description: "Lists the attributes of an object or a list.",
    method: "GET",
    url: (i) =>
      `/v2/${restSegment(i.target)}/${restSegment(i.identifier)}/attributes${restQuery(
        { limit: i.limit, offset: i.offset },
      )}`,
    input: z
      .object({
        target: AttioAttributeTarget,
        identifier: AttioSlugOrId,
        limit: AttioLimit,
        offset: AttioOffset,
      })
      .strict(),
  },
  {
    action: "get-attribute",
    name: "Get Attribute",
    description: "Reads one attribute of an object or a list.",
    method: "GET",
    url: (i) =>
      `/v2/${restSegment(i.target)}/${restSegment(i.identifier)}/attributes/${restSegment(i.attribute)}`,
    input: z
      .object({
        target: AttioAttributeTarget,
        identifier: AttioSlugOrId,
        attribute: AttioSlugOrId,
      })
      .strict(),
  },
  {
    action: "create-attribute",
    name: "Create Attribute",
    description: "Defines a new attribute on an object or a list.",
    method: "POST",
    url: (i) =>
      `/v2/${restSegment(i.target)}/${restSegment(i.identifier)}/attributes`,
    input: z
      .object({
        target: AttioAttributeTarget,
        identifier: AttioSlugOrId,
        title: z.string().min(1).max(256),
        apiSlug: AttioSlugOrId,
        type: z.string().min(1).max(64),
        description: z.string().max(2_048).optional(),
        isRequired: z.boolean(),
        isUnique: z.boolean(),
        isMultiselect: z.boolean(),
        defaultValue: z.record(z.string(), z.unknown()).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
    body: (i) => ({
      data: {
        title: i.title,
        api_slug: i.apiSlug,
        type: i.type,
        description: i.description ?? null,
        is_required: i.isRequired,
        is_unique: i.isUnique,
        is_multiselect: i.isMultiselect,
        default_value: i.defaultValue ?? null,
        config: i.config ?? {},
      },
    }),
  },
  {
    action: "update-attribute",
    name: "Update Attribute",
    description: "Changes an attribute's title, slug, or constraints.",
    method: "PATCH",
    url: (i) =>
      `/v2/${restSegment(i.target)}/${restSegment(i.identifier)}/attributes/${restSegment(i.attribute)}`,
    input: z
      .object({
        target: AttioAttributeTarget,
        identifier: AttioSlugOrId,
        attribute: AttioSlugOrId,
        title: z.string().min(1).max(256).optional(),
        apiSlug: AttioSlugOrId.optional(),
        description: z.string().max(2_048).optional(),
        isRequired: z.boolean().optional(),
        isUnique: z.boolean().optional(),
        isArchived: z.boolean().optional(),
        defaultValue: z.record(z.string(), z.unknown()).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
    body: (i) => ({
      data: {
        ...(i.title !== undefined ? { title: i.title } : {}),
        ...(i.apiSlug !== undefined ? { api_slug: i.apiSlug } : {}),
        ...(i.description !== undefined ? { description: i.description } : {}),
        ...(i.isRequired !== undefined ? { is_required: i.isRequired } : {}),
        ...(i.isUnique !== undefined ? { is_unique: i.isUnique } : {}),
        ...(i.isArchived !== undefined ? { is_archived: i.isArchived } : {}),
        ...(i.defaultValue ? { default_value: i.defaultValue } : {}),
        ...(i.config ? { config: i.config } : {}),
      },
    }),
  },
];

export function createAttioPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "attio",
    sdkReview: `Attio ${NoSdkNote} The attio-client packages on npm are unofficial and unmaintained.`,
    transportKind: "oauth2",
    actions: ATTIO_ACTIONS,
  });
}
