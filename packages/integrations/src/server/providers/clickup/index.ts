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

// ------------------------------------------------------------------ ClickUp

/**
 * ClickUp identifiers are opaque short strings. Task IDs additionally accept a
 * workspace's custom format ("DEV-1234") when `customTaskIds` is set, which is
 * why the hyphen is allowed.
 */
const ClickUpId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/u);

/** Tag names are user-authored and may contain spaces, so only length bounds. */
const ClickUpTagName = z.string().min(1).max(128);

/** Epoch milliseconds — every ClickUp date field is a Unix millisecond stamp. */
const ClickUpTimestamp = z.number().int().min(0).max(4_102_444_800_000);

/**
 * Resolving a task by a workspace's custom ID requires both query parameters;
 * ClickUp ignores `custom_task_ids` when `team_id` is absent.
 */
const CustomTaskIdShape = {
  customTaskIds: z.boolean().optional(),
  teamId: ClickUpId.optional(),
};

function customTaskIdQuery(i: {
  customTaskIds?: boolean;
  teamId?: string;
}): Record<string, unknown> {
  return { custom_task_ids: i.customTaskIds, team_id: i.teamId };
}

const CLICKUP_ACTIONS: readonly RestAction<any>[] = [
  // ------------------------------------------------------------------ tasks
  {
    action: "create-task",
    name: "Create Task",
    description: "Creates a task in a list.",
    method: "POST",
    url: (i) =>
      `/api/v2/list/${restSegment(i.listId)}/task${restQuery(
        customTaskIdQuery(i),
      )}`,
    input: z
      .object({
        listId: ClickUpId,
        name: z.string().min(1).max(1_024),
        description: z.string().max(50_000).optional(),
        markdownDescription: z.string().max(50_000).optional(),
        assignees: z.array(z.number().int()).max(100).optional(),
        tags: z.array(ClickUpTagName).max(100).optional(),
        status: z.string().max(256).optional(),
        // ClickUp priority is 1 (urgent) through 4 (low).
        priority: z.number().int().min(1).max(4).optional(),
        dueDate: ClickUpTimestamp.optional(),
        dueDateTime: z.boolean().optional(),
        startDate: ClickUpTimestamp.optional(),
        startDateTime: z.boolean().optional(),
        timeEstimate: z.number().int().min(0).optional(),
        notifyAll: z.boolean().optional(),
        parent: ClickUpId.optional(),
        ...CustomTaskIdShape,
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.markdownDescription !== undefined
        ? { markdown_description: i.markdownDescription }
        : {}),
      ...(i.assignees ? { assignees: i.assignees } : {}),
      ...(i.tags ? { tags: i.tags } : {}),
      ...(i.status !== undefined ? { status: i.status } : {}),
      ...(i.priority !== undefined ? { priority: i.priority } : {}),
      ...(i.dueDate !== undefined ? { due_date: i.dueDate } : {}),
      ...(i.dueDateTime !== undefined ? { due_date_time: i.dueDateTime } : {}),
      ...(i.startDate !== undefined ? { start_date: i.startDate } : {}),
      ...(i.startDateTime !== undefined
        ? { start_date_time: i.startDateTime }
        : {}),
      ...(i.timeEstimate !== undefined
        ? { time_estimate: i.timeEstimate }
        : {}),
      ...(i.notifyAll !== undefined ? { notify_all: i.notifyAll } : {}),
      ...(i.parent !== undefined ? { parent: i.parent } : {}),
    }),
  },
  {
    action: "get-task",
    name: "Get Task",
    description: "Reads one task.",
    method: "GET",
    url: (i) =>
      `/api/v2/task/${restSegment(i.taskId)}${restQuery({
        ...customTaskIdQuery(i),
        include_subtasks: i.includeSubtasks,
        include_markdown_description: i.includeMarkdownDescription,
      })}`,
    input: z
      .object({
        taskId: ClickUpId,
        includeSubtasks: z.boolean().optional(),
        includeMarkdownDescription: z.boolean().optional(),
        ...CustomTaskIdShape,
      })
      .strict(),
  },
  {
    action: "update-task",
    name: "Update Task",
    description: "Changes a task's fields, status, or assignees.",
    method: "PUT",
    url: (i) =>
      `/api/v2/task/${restSegment(i.taskId)}${restQuery(customTaskIdQuery(i))}`,
    input: z
      .object({
        taskId: ClickUpId,
        name: z.string().min(1).max(1_024).optional(),
        description: z.string().max(50_000).optional(),
        markdownDescription: z.string().max(50_000).optional(),
        status: z.string().max(256).optional(),
        priority: z.number().int().min(1).max(4).optional(),
        dueDate: ClickUpTimestamp.optional(),
        dueDateTime: z.boolean().optional(),
        startDate: ClickUpTimestamp.optional(),
        startDateTime: z.boolean().optional(),
        timeEstimate: z.number().int().min(0).optional(),
        // Assignees are edited as a delta, not replaced wholesale.
        addAssignees: z.array(z.number().int()).max(100).optional(),
        removeAssignees: z.array(z.number().int()).max(100).optional(),
        archived: z.boolean().optional(),
        parent: ClickUpId.optional(),
        ...CustomTaskIdShape,
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.markdownDescription !== undefined
        ? { markdown_description: i.markdownDescription }
        : {}),
      ...(i.status !== undefined ? { status: i.status } : {}),
      ...(i.priority !== undefined ? { priority: i.priority } : {}),
      ...(i.dueDate !== undefined ? { due_date: i.dueDate } : {}),
      ...(i.dueDateTime !== undefined ? { due_date_time: i.dueDateTime } : {}),
      ...(i.startDate !== undefined ? { start_date: i.startDate } : {}),
      ...(i.startDateTime !== undefined
        ? { start_date_time: i.startDateTime }
        : {}),
      ...(i.timeEstimate !== undefined
        ? { time_estimate: i.timeEstimate }
        : {}),
      ...(i.addAssignees || i.removeAssignees
        ? {
            assignees: {
              ...(i.addAssignees ? { add: i.addAssignees } : {}),
              ...(i.removeAssignees ? { rem: i.removeAssignees } : {}),
            },
          }
        : {}),
      ...(i.archived !== undefined ? { archived: i.archived } : {}),
      ...(i.parent !== undefined ? { parent: i.parent } : {}),
    }),
  },
  {
    action: "delete-task",
    name: "Delete Task",
    description: "Permanently deletes one task.",
    method: "DELETE",
    url: (i) =>
      `/api/v2/task/${restSegment(i.taskId)}${restQuery(customTaskIdQuery(i))}`,
    input: z.object({ taskId: ClickUpId, ...CustomTaskIdShape }).strict(),
    // ClickUp answers a delete with 200 and an empty object; "optional" also
    // tolerates a bodiless response rather than reporting it as malformed.
    emptyResponse: "optional",
  },
  {
    action: "get-tasks",
    name: "Get Tasks",
    description: "Lists the tasks in a list.",
    method: "GET",
    url: (i) =>
      `/api/v2/list/${restSegment(i.listId)}/task${restQuery({
        archived: i.archived,
        page: i.page,
        order_by: i.orderBy,
        reverse: i.reverse,
        subtasks: i.subtasks,
        include_closed: i.includeClosed,
        "statuses[]": i.statuses,
        "assignees[]": i.assignees,
        due_date_gt: i.dueDateGt,
        due_date_lt: i.dueDateLt,
        date_updated_gt: i.dateUpdatedGt,
      })}`,
    input: z
      .object({
        listId: ClickUpId,
        archived: z.boolean().optional(),
        // ClickUp paginates from page 0 at 100 tasks per page.
        page: z.number().int().min(0).max(10_000).optional(),
        orderBy: z.enum(["id", "created", "updated", "due_date"]).optional(),
        reverse: z.boolean().optional(),
        subtasks: z.boolean().optional(),
        includeClosed: z.boolean().optional(),
        statuses: z.array(z.string().max(256)).max(50).optional(),
        assignees: z.array(z.string().max(64)).max(100).optional(),
        dueDateGt: ClickUpTimestamp.optional(),
        dueDateLt: ClickUpTimestamp.optional(),
        dateUpdatedGt: ClickUpTimestamp.optional(),
      })
      .strict(),
  },
  {
    action: "search-tasks",
    name: "Search Tasks",
    description: "Finds tasks across a workspace, filtered by location.",
    method: "GET",
    url: (i) =>
      `/api/v2/team/${restSegment(i.teamId)}/task${restQuery({
        page: i.page,
        order_by: i.orderBy,
        reverse: i.reverse,
        subtasks: i.subtasks,
        include_closed: i.includeClosed,
        "space_ids[]": i.spaceIds,
        "project_ids[]": i.folderIds,
        "list_ids[]": i.listIds,
        "statuses[]": i.statuses,
        "assignees[]": i.assignees,
        due_date_gt: i.dueDateGt,
        due_date_lt: i.dueDateLt,
      })}`,
    input: z
      .object({
        teamId: ClickUpId,
        page: z.number().int().min(0).max(10_000).optional(),
        orderBy: z.enum(["id", "created", "updated", "due_date"]).optional(),
        reverse: z.boolean().optional(),
        subtasks: z.boolean().optional(),
        includeClosed: z.boolean().optional(),
        spaceIds: z.array(ClickUpId).max(100).optional(),
        // ClickUp's team task filter still spells folders "project_ids".
        folderIds: z.array(ClickUpId).max(100).optional(),
        listIds: z.array(ClickUpId).max(100).optional(),
        statuses: z.array(z.string().max(256)).max(50).optional(),
        assignees: z.array(z.string().max(64)).max(100).optional(),
        dueDateGt: ClickUpTimestamp.optional(),
        dueDateLt: ClickUpTimestamp.optional(),
      })
      .strict(),
  },

  // --------------------------------------------------------------- comments
  {
    action: "create-comment",
    name: "Create Comment",
    description: "Posts a comment on a task.",
    method: "POST",
    url: (i) =>
      `/api/v2/task/${restSegment(i.taskId)}/comment${restQuery(
        customTaskIdQuery(i),
      )}`,
    input: z
      .object({
        taskId: ClickUpId,
        commentText: z.string().min(1).max(50_000),
        assignee: z.number().int().optional(),
        notifyAll: z.boolean().optional(),
        ...CustomTaskIdShape,
      })
      .strict(),
    body: (i) => ({
      comment_text: i.commentText,
      ...(i.assignee !== undefined ? { assignee: i.assignee } : {}),
      ...(i.notifyAll !== undefined ? { notify_all: i.notifyAll } : {}),
    }),
  },
  {
    action: "get-comments",
    name: "Get Comments",
    description: "Lists the comments on a task.",
    method: "GET",
    url: (i) =>
      `/api/v2/task/${restSegment(i.taskId)}/comment${restQuery({
        ...customTaskIdQuery(i),
        start: i.start,
        start_id: i.startId,
      })}`,
    input: z
      .object({
        taskId: ClickUpId,
        // Comment paging is keyset: the date and ID of the last comment read.
        start: ClickUpTimestamp.optional(),
        startId: z.string().max(128).optional(),
        ...CustomTaskIdShape,
      })
      .strict(),
  },
  {
    action: "update-comment",
    name: "Update Comment",
    description: "Edits a comment's text, assignee, or resolved state.",
    method: "PUT",
    url: (i) => `/api/v2/comment/${restSegment(i.commentId)}`,
    input: z
      .object({
        commentId: ClickUpId,
        commentText: z.string().min(1).max(50_000),
        assignee: z.number().int().optional(),
        resolved: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      comment_text: i.commentText,
      ...(i.assignee !== undefined ? { assignee: i.assignee } : {}),
      ...(i.resolved !== undefined ? { resolved: i.resolved } : {}),
    }),
  },
  {
    action: "delete-comment",
    name: "Delete Comment",
    description: "Deletes one comment.",
    method: "DELETE",
    url: (i) => `/api/v2/comment/${restSegment(i.commentId)}`,
    input: z.object({ commentId: ClickUpId }).strict(),
    emptyResponse: "optional",
  },

  // ------------------------------------------------------------------- tags
  {
    action: "add-tag-to-task",
    name: "Add Tag to Task",
    description: "Applies an existing space tag to a task.",
    method: "POST",
    url: (i) =>
      `/api/v2/task/${restSegment(i.taskId)}/tag/${restSegment(
        i.tagName,
      )}${restQuery(customTaskIdQuery(i))}`,
    input: z
      .object({
        taskId: ClickUpId,
        tagName: ClickUpTagName,
        ...CustomTaskIdShape,
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "remove-tag-from-task",
    name: "Remove Tag from Task",
    description: "Removes a tag from a task without deleting the tag.",
    method: "DELETE",
    url: (i) =>
      `/api/v2/task/${restSegment(i.taskId)}/tag/${restSegment(
        i.tagName,
      )}${restQuery(customTaskIdQuery(i))}`,
    input: z
      .object({
        taskId: ClickUpId,
        tagName: ClickUpTagName,
        ...CustomTaskIdShape,
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "get-space-tags",
    name: "Get Space Tags",
    description: "Lists the tags defined in a space.",
    method: "GET",
    url: (i) => `/api/v2/space/${restSegment(i.spaceId)}/tag`,
    input: z.object({ spaceId: ClickUpId }).strict(),
  },

  // ---------------------------------------------------------------- members
  {
    action: "get-task-members",
    name: "Get Task Members",
    description: "Lists the members with access to a task.",
    method: "GET",
    url: (i) => `/api/v2/task/${restSegment(i.taskId)}/member`,
    input: z.object({ taskId: ClickUpId }).strict(),
  },
  {
    action: "get-list-members",
    name: "Get List Members",
    description: "Lists the members with access to a list.",
    method: "GET",
    url: (i) => `/api/v2/list/${restSegment(i.listId)}/member`,
    input: z.object({ listId: ClickUpId }).strict(),
  },

  // ---------------------------------------------------------- custom fields
  {
    action: "get-custom-fields",
    name: "Get Custom Fields",
    description: "Lists the custom fields available on a list.",
    method: "GET",
    url: (i) => `/api/v2/list/${restSegment(i.listId)}/field`,
    input: z.object({ listId: ClickUpId }).strict(),
  },
  {
    action: "set-custom-field-value",
    name: "Set Custom Field Value",
    description: "Sets one custom field's value on a task.",
    method: "POST",
    url: (i) =>
      `/api/v2/task/${restSegment(i.taskId)}/field/${restSegment(
        i.fieldId,
      )}${restQuery(customTaskIdQuery(i))}`,
    input: z
      .object({
        taskId: ClickUpId,
        // Custom field IDs are UUIDs, which are longer than a ClickUp ID.
        fieldId: z.string().min(1).max(64),
        // The accepted shape depends on the field's type, so it stays open.
        value: z.unknown(),
        valueOptions: z.record(z.string(), z.unknown()).optional(),
        ...CustomTaskIdShape,
      })
      .strict(),
    body: (i) => ({
      value: i.value,
      ...(i.valueOptions ? { value_options: i.valueOptions } : {}),
    }),
  },
  {
    action: "remove-custom-field-value",
    name: "Remove Custom Field Value",
    description: "Clears one custom field's value on a task.",
    method: "DELETE",
    url: (i) =>
      `/api/v2/task/${restSegment(i.taskId)}/field/${restSegment(
        i.fieldId,
      )}${restQuery(customTaskIdQuery(i))}`,
    input: z
      .object({
        taskId: ClickUpId,
        fieldId: z.string().min(1).max(64),
        ...CustomTaskIdShape,
      })
      .strict(),
    emptyResponse: "optional",
  },

  // ------------------------------------------------------------- checklists
  {
    action: "create-checklist",
    name: "Create Checklist",
    description: "Adds a checklist to a task.",
    method: "POST",
    url: (i) =>
      `/api/v2/task/${restSegment(i.taskId)}/checklist${restQuery(
        customTaskIdQuery(i),
      )}`,
    input: z
      .object({
        taskId: ClickUpId,
        name: z.string().min(1).max(1_024),
        ...CustomTaskIdShape,
      })
      .strict(),
    body: (i) => ({ name: i.name }),
  },
  {
    action: "update-checklist",
    name: "Update Checklist",
    description: "Renames or reorders a checklist.",
    method: "PUT",
    url: (i) => `/api/v2/checklist/${restSegment(i.checklistId)}`,
    input: z
      .object({
        checklistId: z.string().min(1).max(64),
        name: z.string().min(1).max(1_024).optional(),
        position: z.number().int().min(0).max(10_000).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.position !== undefined ? { position: i.position } : {}),
    }),
  },
  {
    action: "delete-checklist",
    name: "Delete Checklist",
    description: "Deletes a checklist and its items.",
    method: "DELETE",
    url: (i) => `/api/v2/checklist/${restSegment(i.checklistId)}`,
    input: z.object({ checklistId: z.string().min(1).max(64) }).strict(),
    emptyResponse: "optional",
  },
  {
    action: "create-checklist-item",
    name: "Create Checklist Item",
    description: "Adds an item to a checklist.",
    method: "POST",
    url: (i) =>
      `/api/v2/checklist/${restSegment(i.checklistId)}/checklist_item`,
    input: z
      .object({
        checklistId: z.string().min(1).max(64),
        name: z.string().min(1).max(1_024),
        assignee: z.number().int().optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      ...(i.assignee !== undefined ? { assignee: i.assignee } : {}),
    }),
  },
  {
    action: "update-checklist-item",
    name: "Update Checklist Item",
    description: "Edits a checklist item's name, assignee, or resolved state.",
    method: "PUT",
    url: (i) =>
      `/api/v2/checklist/${restSegment(
        i.checklistId,
      )}/checklist_item/${restSegment(i.checklistItemId)}`,
    input: z
      .object({
        checklistId: z.string().min(1).max(64),
        checklistItemId: z.string().min(1).max(64),
        name: z.string().min(1).max(1_024).optional(),
        assignee: z.number().int().optional(),
        resolved: z.boolean().optional(),
        // Nesting an item under another item in the same checklist.
        parent: z.string().min(1).max(64).optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.assignee !== undefined ? { assignee: i.assignee } : {}),
      ...(i.resolved !== undefined ? { resolved: i.resolved } : {}),
      ...(i.parent !== undefined ? { parent: i.parent } : {}),
    }),
  },
  {
    action: "delete-checklist-item",
    name: "Delete Checklist Item",
    description: "Deletes one checklist item.",
    method: "DELETE",
    url: (i) =>
      `/api/v2/checklist/${restSegment(
        i.checklistId,
      )}/checklist_item/${restSegment(i.checklistItemId)}`,
    input: z
      .object({
        checklistId: z.string().min(1).max(64),
        checklistItemId: z.string().min(1).max(64),
      })
      .strict(),
    emptyResponse: "optional",
  },

  // ---------------------------------------------------------- time tracking
  {
    action: "get-time-entries",
    name: "Get Time Entries",
    description: "Lists tracked time in a workspace over a date range.",
    method: "GET",
    url: (i) =>
      `/api/v2/team/${restSegment(i.teamId)}/time_entries${restQuery({
        start_date: i.startDate,
        end_date: i.endDate,
        assignee: i.assignee,
        include_task_tags: i.includeTaskTags,
        include_location_names: i.includeLocationNames,
        space_id: i.spaceId,
        folder_id: i.folderId,
        list_id: i.listId,
        task_id: i.taskId,
        // Only the flag: the workspace is already the path segment here, so
        // re-sending it as `team_id` would be redundant.
        custom_task_ids: i.customTaskIds,
      })}`,
    input: z
      .object({
        teamId: ClickUpId,
        startDate: ClickUpTimestamp.optional(),
        endDate: ClickUpTimestamp.optional(),
        // Comma-separated user IDs, per ClickUp's filter format.
        assignee: z.string().max(512).optional(),
        includeTaskTags: z.boolean().optional(),
        includeLocationNames: z.boolean().optional(),
        spaceId: ClickUpId.optional(),
        folderId: ClickUpId.optional(),
        listId: ClickUpId.optional(),
        taskId: ClickUpId.optional(),
        customTaskIds: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "create-time-entry",
    name: "Create Time Entry",
    description: "Records a completed block of tracked time.",
    method: "POST",
    url: (i) =>
      `/api/v2/team/${restSegment(i.teamId)}/time_entries${restQuery({
        custom_task_ids: i.customTaskIds,
      })}`,
    input: z
      .object({
        teamId: ClickUpId,
        start: ClickUpTimestamp,
        // Milliseconds of tracked time.
        duration: z
          .number()
          .int()
          .min(1)
          .max(86_400_000 * 31),
        description: z.string().max(10_000).optional(),
        tags: z.array(ClickUpTagName).max(100).optional(),
        assignee: z.number().int().optional(),
        // ClickUp names the linked task "tid" on time-entry writes.
        taskId: ClickUpId.optional(),
        billable: z.boolean().optional(),
        customTaskIds: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      start: i.start,
      duration: i.duration,
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.tags ? { tags: i.tags } : {}),
      ...(i.assignee !== undefined ? { assignee: i.assignee } : {}),
      ...(i.taskId !== undefined ? { tid: i.taskId } : {}),
      ...(i.billable !== undefined ? { billable: i.billable } : {}),
    }),
  },
  {
    action: "update-time-entry",
    name: "Update Time Entry",
    description: "Changes a recorded time entry.",
    method: "PUT",
    url: (i) =>
      `/api/v2/team/${restSegment(i.teamId)}/time_entries/${restSegment(
        i.timerId,
      )}${restQuery({ custom_task_ids: i.customTaskIds })}`,
    input: z
      .object({
        teamId: ClickUpId,
        timerId: z.string().min(1).max(64),
        description: z.string().max(10_000).optional(),
        tags: z.array(ClickUpTagName).max(100).optional(),
        // Tag edits are explicit: replace, add, or remove.
        tagAction: z.enum(["replace", "add", "remove"]).optional(),
        start: ClickUpTimestamp.optional(),
        end: ClickUpTimestamp.optional(),
        duration: z
          .number()
          .int()
          .min(1)
          .max(86_400_000 * 31)
          .optional(),
        taskId: ClickUpId.optional(),
        billable: z.boolean().optional(),
        customTaskIds: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.tags ? { tags: i.tags } : {}),
      ...(i.tagAction !== undefined ? { tag_action: i.tagAction } : {}),
      ...(i.start !== undefined ? { start: i.start } : {}),
      ...(i.end !== undefined ? { end: i.end } : {}),
      ...(i.duration !== undefined ? { duration: i.duration } : {}),
      ...(i.taskId !== undefined ? { tid: i.taskId } : {}),
      ...(i.billable !== undefined ? { billable: i.billable } : {}),
    }),
  },
  {
    action: "delete-time-entry",
    name: "Delete Time Entry",
    description: "Deletes one recorded time entry.",
    method: "DELETE",
    url: (i) =>
      `/api/v2/team/${restSegment(i.teamId)}/time_entries/${restSegment(
        i.timerId,
      )}`,
    input: z
      .object({ teamId: ClickUpId, timerId: z.string().min(1).max(64) })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "start-timer",
    name: "Start Timer",
    description: "Starts the running timer for the authenticated user.",
    method: "POST",
    url: (i) =>
      `/api/v2/team/${restSegment(i.teamId)}/time_entries/start${restQuery({
        custom_task_ids: i.customTaskIds,
      })}`,
    input: z
      .object({
        teamId: ClickUpId,
        taskId: ClickUpId.optional(),
        description: z.string().max(10_000).optional(),
        tags: z.array(ClickUpTagName).max(100).optional(),
        billable: z.boolean().optional(),
        customTaskIds: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.taskId !== undefined ? { tid: i.taskId } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.tags ? { tags: i.tags } : {}),
      ...(i.billable !== undefined ? { billable: i.billable } : {}),
    }),
  },
  {
    action: "stop-timer",
    name: "Stop Timer",
    description: "Stops the running timer for the authenticated user.",
    method: "POST",
    url: (i) => `/api/v2/team/${restSegment(i.teamId)}/time_entries/stop`,
    input: z.object({ teamId: ClickUpId }).strict(),
  },
  {
    action: "get-running-timer",
    name: "Get Running Timer",
    description: "Reads the timer currently running for a user.",
    method: "GET",
    url: (i) =>
      `/api/v2/team/${restSegment(i.teamId)}/time_entries/current${restQuery({
        assignee: i.assignee,
      })}`,
    input: z
      .object({
        teamId: ClickUpId,
        assignee: z.string().max(512).optional(),
      })
      .strict(),
  },

  // -------------------------------------------------------------- hierarchy
  {
    action: "get-workspaces",
    name: "Get Workspaces",
    description: "Lists the workspaces the credential can reach.",
    method: "GET",
    url: "/api/v2/team",
    input: z.object({}).strict(),
  },
  {
    action: "get-spaces",
    name: "Get Spaces",
    description: "Lists the spaces in a workspace.",
    method: "GET",
    url: (i) =>
      `/api/v2/team/${restSegment(i.teamId)}/space${restQuery({
        archived: i.archived,
      })}`,
    input: z
      .object({ teamId: ClickUpId, archived: z.boolean().optional() })
      .strict(),
  },
  {
    action: "get-folders",
    name: "Get Folders",
    description: "Lists the folders in a space.",
    method: "GET",
    url: (i) =>
      `/api/v2/space/${restSegment(i.spaceId)}/folder${restQuery({
        archived: i.archived,
      })}`,
    input: z
      .object({ spaceId: ClickUpId, archived: z.boolean().optional() })
      .strict(),
  },
  {
    action: "get-lists",
    name: "Get Lists",
    description:
      "Lists the lists in a folder, or the folderless lists in a space.",
    method: "GET",
    url: (i) =>
      i.folderId
        ? `/api/v2/folder/${restSegment(i.folderId)}/list${restQuery({
            archived: i.archived,
          })}`
        : `/api/v2/space/${restSegment(i.spaceId)}/list${restQuery({
            archived: i.archived,
          })}`,
    input: z
      .object({
        folderId: ClickUpId.optional(),
        spaceId: ClickUpId.optional(),
        archived: z.boolean().optional(),
      })
      .strict()
      // Folder lists and folderless lists are different endpoints, so the
      // caller must name exactly one parent rather than have one silently win.
      .refine(
        (i) => Boolean(i.folderId) !== Boolean(i.spaceId),
        "Supply exactly one of folderId or spaceId.",
      ),
  },
  {
    action: "create-folder",
    name: "Create Folder",
    description: "Creates a folder in a space.",
    method: "POST",
    url: (i) => `/api/v2/space/${restSegment(i.spaceId)}/folder`,
    input: z
      .object({ spaceId: ClickUpId, name: z.string().min(1).max(1_024) })
      .strict(),
    body: (i) => ({ name: i.name }),
  },
  {
    action: "create-list",
    name: "Create List",
    description: "Creates a list in a folder, or a folderless list in a space.",
    method: "POST",
    url: (i) =>
      i.folderId
        ? `/api/v2/folder/${restSegment(i.folderId)}/list`
        : `/api/v2/space/${restSegment(i.spaceId)}/list`,
    input: z
      .object({
        folderId: ClickUpId.optional(),
        spaceId: ClickUpId.optional(),
        name: z.string().min(1).max(1_024),
        content: z.string().max(50_000).optional(),
        dueDate: ClickUpTimestamp.optional(),
        dueDateTime: z.boolean().optional(),
        priority: z.number().int().min(1).max(4).optional(),
        assignee: z.number().int().optional(),
        status: z.string().max(256).optional(),
      })
      .strict()
      .refine(
        (i) => Boolean(i.folderId) !== Boolean(i.spaceId),
        "Supply exactly one of folderId or spaceId.",
      ),
    body: (i) => ({
      name: i.name,
      ...(i.content !== undefined ? { content: i.content } : {}),
      ...(i.dueDate !== undefined ? { due_date: i.dueDate } : {}),
      ...(i.dueDateTime !== undefined ? { due_date_time: i.dueDateTime } : {}),
      ...(i.priority !== undefined ? { priority: i.priority } : {}),
      ...(i.assignee !== undefined ? { assignee: i.assignee } : {}),
      ...(i.status !== undefined ? { status: i.status } : {}),
    }),
  },
];

export function createClickUpPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "clickup",
    sdkReview: `ClickUp ${NoSdkNote} The community clickup.js packages are unmaintained and do not model the v2 surface.`,
    transportKind: "oauth2",
    actions: CLICKUP_ACTIONS,
    deferrals: {
      "upload-attachment":
        "The attachment endpoint takes multipart/form-data with a file part, and this lane serialises a JSON body against one host.",
    },
  });
}
