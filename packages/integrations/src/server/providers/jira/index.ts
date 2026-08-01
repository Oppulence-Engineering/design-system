import type { IntegrationProviderPack } from "../../core/provider-pack";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputRecord,
  requiredInputString,
  requiredInputStringArray,
} from "../shared/sdk";
import {
  createAtlassianPack,
  createAtlassianProviderSdk,
  createJiraClient,
  type AtlassianClientFactory,
  type AtlassianOperation,
} from "../shared/clients/atlassian";
import { jiraTriggerCoverage } from "../shared/clients/atlassian-triggers";

type JiraInput = Readonly<Record<string, unknown>>;

function issueKey(input: JiraInput): string {
  return requiredInputString(input, "issueIdOrKey", "issueKey", "issueId");
}

/**
 * Jira v3 takes rich text as Atlassian Document Format. Accept a prepared ADF
 * document when a caller has one and otherwise wrap plain text, so a simple
 * comment does not require the caller to know about ADF.
 */
function documentBody(input: JiraInput, ...names: string[]): unknown {
  // Only inspect a value that is already an object: routing plain prose
  // through the JSON coercion helpers would reject it as malformed JSON.
  for (const name of names) {
    const value = input[name];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (record.type === "doc") return record;
    }
  }
  const text = requiredInputString(input, ...names);
  return {
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function issueFields(input: JiraInput): Record<string, unknown> {
  const explicit = optionalInputRecord(input, "fields");
  if (explicit) return explicit;
  const description = optionalInputString(input, "description");
  return definedFields({
    project: optionalInputString(input, "projectKey", "projectId")
      ? { key: optionalInputString(input, "projectKey", "projectId") }
      : undefined,
    summary: optionalInputString(input, "summary"),
    issuetype: optionalInputString(input, "issueType", "issuetype")
      ? { name: optionalInputString(input, "issueType", "issuetype") }
      : undefined,
    description: description ? documentBody(input, "description") : undefined,
    priority: optionalInputString(input, "priority")
      ? { name: optionalInputString(input, "priority") }
      : undefined,
    labels: optionalInputStringArray(input, "labels"),
    assignee: optionalInputString(input, "assigneeAccountId")
      ? { accountId: optionalInputString(input, "assigneeAccountId") }
      : undefined,
    parent: optionalInputString(input, "parentKey")
      ? { key: optionalInputString(input, "parentKey") }
      : undefined,
  });
}

const JIRA_OPERATIONS: Readonly<Record<string, AtlassianOperation>> = {
  "jira:read-issue": {
    path: ["issues", "getIssue"],
    params: (input) =>
      definedFields({
        issueIdOrKey: issueKey(input),
        fields: optionalInputStringArray(input, "fields"),
        expand: optionalInputString(input, "expand"),
      }),
  },
  "jira:read-bulk-issues": {
    path: ["issues", "bulkFetchIssues"],
    params: (input) =>
      definedFields({
        issueIdsOrKeys: requiredInputStringArray(
          input,
          "issueIdsOrKeys",
          "issueKeys",
        ),
        fields: optionalInputStringArray(input, "fields"),
        expand: optionalInputStringArray(input, "expand"),
      }),
  },
  "jira:write-issue": {
    path: ["issues", "createIssue"],
    params: (input) => ({ fields: issueFields(input) }),
  },
  "jira:update-issue": {
    path: ["issues", "editIssue"],
    params: (input) =>
      definedFields({
        issueIdOrKey: issueKey(input),
        fields: issueFields(input),
        update: optionalInputRecord(input, "update"),
        notifyUsers:
          input.notifyUsers === undefined
            ? undefined
            : Boolean(input.notifyUsers),
      }),
  },
  "jira:delete-issue": {
    path: ["issues", "deleteIssue"],
    params: (input) =>
      definedFields({
        issueIdOrKey: issueKey(input),
        deleteSubtasks: optionalInputString(input, "deleteSubtasks"),
      }),
    output: (_value, input) => ({ issueKey: issueKey(input), deleted: true }),
  },
  "jira:assign-issue": {
    path: ["issues", "assignIssue"],
    params: (input) => ({
      issueIdOrKey: issueKey(input),
      // Passing null unassigns; -1 assigns the project default.
      accountId:
        optionalInputString(input, "accountId", "assigneeAccountId") ?? null,
    }),
    output: (_value, input) => ({ issueKey: issueKey(input), assigned: true }),
  },
  "jira:transition-issue": {
    path: ["issues", "doTransition"],
    params: (input) =>
      definedFields({
        issueIdOrKey: issueKey(input),
        transition: { id: requiredInputString(input, "transitionId") },
        fields: optionalInputRecord(input, "fields"),
      }),
    output: (_value, input) => ({
      issueKey: issueKey(input),
      transitionId: requiredInputString(input, "transitionId"),
      transitioned: true,
    }),
  },
  "jira:get-transitions": {
    path: ["issues", "getTransitions"],
    params: (input) => ({ issueIdOrKey: issueKey(input) }),
  },
  "jira:search-issues": {
    path: ["issueSearch", "searchForIssuesUsingJqlEnhancedSearchPost"],
    params: (input) =>
      definedFields({
        jql: requiredInputString(input, "jql", "query"),
        maxResults: optionalInputNumber(input, "maxResults", "limit") ?? 50,
        nextPageToken: optionalInputString(input, "nextPageToken", "cursor"),
        fields: optionalInputStringArray(input, "fields"),
      }),
  },
  "jira:add-comment": {
    path: ["issueComments", "addComment"],
    params: (input) => ({
      issueIdOrKey: issueKey(input),
      comment: documentBody(input, "comment", "body"),
    }),
  },
  "jira:get-comments": {
    path: ["issueComments", "getComments"],
    params: (input) =>
      definedFields({
        issueIdOrKey: issueKey(input),
        maxResults: optionalInputNumber(input, "maxResults", "limit"),
        startAt: optionalInputNumber(input, "startAt"),
        orderBy: optionalInputString(input, "orderBy"),
      }),
  },
  "jira:update-comment": {
    path: ["issueComments", "updateComment"],
    params: (input) => ({
      issueIdOrKey: issueKey(input),
      id: requiredInputString(input, "commentId"),
      comment: documentBody(input, "comment", "body"),
    }),
  },
  "jira:delete-comment": {
    path: ["issueComments", "deleteComment"],
    params: (input) => ({
      issueIdOrKey: issueKey(input),
      id: requiredInputString(input, "commentId"),
    }),
    output: (_value, input) => ({
      commentId: requiredInputString(input, "commentId"),
      deleted: true,
    }),
  },
  "jira:get-attachments": {
    path: ["issues", "getIssue"],
    params: (input) => ({
      issueIdOrKey: issueKey(input),
      fields: ["attachment"],
    }),
    output: (value) => {
      const record = (value ?? {}) as { fields?: { attachment?: unknown } };
      return { attachments: record.fields?.attachment ?? [] };
    },
  },
  "jira:add-attachment": {
    path: ["issueAttachments", "addAttachment"],
    params: (input) => ({
      issueIdOrKey: issueKey(input),
      attachment: {
        filename: requiredInputString(input, "filename", "fileName"),
        file: requiredInputString(input, "content", "fileContent"),
      },
    }),
  },
  "jira:delete-attachment": {
    path: ["issueAttachments", "removeAttachment"],
    params: (input) => ({ id: requiredInputString(input, "attachmentId") }),
    output: (_value, input) => ({
      attachmentId: requiredInputString(input, "attachmentId"),
      deleted: true,
    }),
  },
  "jira:add-worklog": {
    path: ["issueWorklogs", "addWorklog"],
    params: (input) =>
      definedFields({
        issueIdOrKey: issueKey(input),
        timeSpent: optionalInputString(input, "timeSpent"),
        timeSpentSeconds: optionalInputNumber(input, "timeSpentSeconds"),
        started: optionalInputString(input, "started"),
        comment: optionalInputString(input, "comment")
          ? documentBody(input, "comment")
          : undefined,
      }),
  },
  "jira:get-worklogs": {
    path: ["issueWorklogs", "getIssueWorklog"],
    params: (input) =>
      definedFields({
        issueIdOrKey: issueKey(input),
        maxResults: optionalInputNumber(input, "maxResults", "limit"),
        startAt: optionalInputNumber(input, "startAt"),
      }),
  },
  "jira:update-worklog": {
    path: ["issueWorklogs", "updateWorklog"],
    params: (input) =>
      definedFields({
        issueIdOrKey: issueKey(input),
        id: requiredInputString(input, "worklogId"),
        timeSpent: optionalInputString(input, "timeSpent"),
        timeSpentSeconds: optionalInputNumber(input, "timeSpentSeconds"),
        started: optionalInputString(input, "started"),
        comment: optionalInputString(input, "comment")
          ? documentBody(input, "comment")
          : undefined,
      }),
  },
  "jira:delete-worklog": {
    path: ["issueWorklogs", "deleteWorklog"],
    params: (input) => ({
      issueIdOrKey: issueKey(input),
      id: requiredInputString(input, "worklogId"),
    }),
    output: (_value, input) => ({
      worklogId: requiredInputString(input, "worklogId"),
      deleted: true,
    }),
  },
  "jira:create-issue-link": {
    path: ["issueLinks", "linkIssues"],
    params: (input) => ({
      type: { name: requiredInputString(input, "linkType", "type") },
      inwardIssue: { key: requiredInputString(input, "inwardIssueKey") },
      outwardIssue: { key: requiredInputString(input, "outwardIssueKey") },
    }),
    output: () => ({ linked: true }),
  },
  "jira:delete-issue-link": {
    path: ["issueLinks", "deleteIssueLink"],
    params: (input) => ({ linkId: requiredInputString(input, "linkId") }),
    output: (_value, input) => ({
      linkId: requiredInputString(input, "linkId"),
      deleted: true,
    }),
  },
  "jira:add-watcher": {
    path: ["issueWatchers", "addWatcher"],
    params: (input) => ({
      issueIdOrKey: issueKey(input),
      accountId: requiredInputString(input, "accountId"),
    }),
    output: (_value, input) => ({
      issueKey: issueKey(input),
      accountId: requiredInputString(input, "accountId"),
      watching: true,
    }),
  },
  "jira:remove-watcher": {
    path: ["issueWatchers", "removeWatcher"],
    params: (input) => ({
      issueIdOrKey: issueKey(input),
      accountId: requiredInputString(input, "accountId"),
    }),
    output: (_value, input) => ({
      issueKey: issueKey(input),
      accountId: requiredInputString(input, "accountId"),
      watching: false,
    }),
  },
  "jira:get-users": {
    path: ["users", "getAllUsers"],
    params: (input) =>
      definedFields({
        maxResults: optionalInputNumber(input, "maxResults", "limit"),
        startAt: optionalInputNumber(input, "startAt"),
      }),
  },
  "jira:search-users": {
    path: ["userSearch", "findUsers"],
    params: (input) =>
      definedFields({
        query: requiredInputString(input, "query", "search"),
        maxResults: optionalInputNumber(input, "maxResults", "limit"),
        startAt: optionalInputNumber(input, "startAt"),
      }),
  },
  "jira:list-projects": {
    path: ["projects", "searchProjects"],
    params: (input) =>
      definedFields({
        query: optionalInputString(input, "query", "search"),
        maxResults: optionalInputNumber(input, "maxResults", "limit"),
        startAt: optionalInputNumber(input, "startAt"),
      }),
  },
  "jira:get-project": {
    path: ["projects", "getProject"],
    params: (input) =>
      definedFields({
        projectIdOrKey: requiredInputString(
          input,
          "projectIdOrKey",
          "projectKey",
          "projectId",
        ),
        expand: optionalInputString(input, "expand"),
      }),
  },
  "jira:list-issue-types": {
    path: ["issueTypes", "getIssueAllTypes"],
  },
  "jira:get-fields": {
    path: ["issueFields", "getFields"],
  },
};

export interface JiraProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: AtlassianClientFactory;
}

/** Executes the pinned Jira actions through the maintained jira.js client. */
export function createJiraProviderSdk(
  config: JiraProviderSdkConfig,
): IntegrationProviderSdk {
  return createAtlassianProviderSdk({
    integrationId: "jira",
    operations: JIRA_OPERATIONS,
    oauthRuntime: config.oauthRuntime,
    clientFactory: config.clientFactory ?? createJiraClient,
  });
}

export function createJiraPack(
  options: { clientFactory?: AtlassianClientFactory } = {},
): IntegrationProviderPack {
  return createAtlassianPack({
    integrationId: "jira",
    operations: JIRA_OPERATIONS,
    clientFactory: options.clientFactory ?? createJiraClient,
    triggerCoverage: jiraTriggerCoverage(),
  });
}

export function getJiraProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  const operationIds = Object.keys(JIRA_OPERATIONS);
  return { operations: operationIds.length, operationIds };
}

void requiredInputRecord;
