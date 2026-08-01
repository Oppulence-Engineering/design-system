import { describe, expect, test } from "bun:test";

import {
  BUILT_IN_PROVIDER_PACKS,
  createIntegrationCredentialReference,
  type IntegrationProviderSdk,
} from "../src/server";

/**
 * Coverage proves an action is *claimed*. It cannot prove the request that
 * action builds is the one the provider actually serves — a wrong path
 * typechecks, satisfies the pack contract, and reports as executable while
 * failing against the live API.
 *
 * These cases pin the emitted method and path for one representative action per
 * typed REST provider, so a mis-typed route fails here rather than in
 * production. They are written from the provider's published API, and reviewing
 * a change to one means re-checking that API.
 */
const CASES: ReadonlyArray<{
  readonly operationId: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly method: string;
  readonly path: string;
}> = [
  {
    operationId: "perplexity:chat",
    input: { messages: [{ role: "user", content: "hi" }] },
    method: "POST",
    path: "/chat/completions",
  },
  {
    // Perplexity's Search API is a distinct endpoint from chat completions.
    operationId: "perplexity:search",
    input: { query: "rust ownership" },
    method: "POST",
    path: "/search",
  },
  {
    operationId: "jina:read-url",
    input: { url: "https://example.test/a" },
    method: "POST",
    path: "/",
  },
  {
    operationId: "tavily:search",
    input: { query: "q" },
    method: "POST",
    path: "/search",
  },
  {
    operationId: "exa:search",
    input: { query: "q" },
    method: "POST",
    path: "/search",
  },
  {
    operationId: "brandfetch:get-brand",
    input: { domain: "example.com" },
    method: "GET",
    path: "/v2/brands/example.com",
  },
  {
    operationId: "hunter-io:email-verifier",
    input: { email: "a@b.test" },
    method: "GET",
    path: "/v2/email-verifier?email=a%40b.test",
  },
  {
    // Telegram authenticates by path segment, so the bot token belongs in the
    // URL the transport builds — not in a header.
    operationId: "telegram:send-message",
    input: { chatId: "-1001234567890", text: "hi" },
    method: "POST",
    path: "/sendMessage",
  },
  {
    operationId: "calendly:get-current-user",
    input: {},
    method: "GET",
    path: "/users/me",
  },
  {
    operationId: "typeform:get-form-details",
    input: { formId: "abc123" },
    method: "GET",
    path: "/forms/abc123",
  },
  {
    operationId: "discord:send-message",
    input: { channelId: "123456789012345678", content: "hi" },
    method: "POST",
    path: "/channels/123456789012345678/messages",
  },
  {
    operationId: "discord:ban-member",
    input: { guildId: "1", userId: "2" },
    method: "PUT",
    path: "/guilds/1/bans/2",
  },
  {
    operationId: "sendgrid:send-mail",
    input: {
      to: ["a@b.test"],
      from: "c@d.test",
      subject: "s",
      text: "t",
    },
    method: "POST",
    path: "/v3/mail/send",
  },
  {
    operationId: "pagerduty:get-incident",
    input: { incidentId: "PABC123" },
    method: "GET",
    path: "/incidents/PABC123",
  },
  {
    operationId: "linkedin:get-profile",
    input: {},
    method: "GET",
    path: "/v2/userinfo",
  },
  {
    operationId: "webflow:list-items",
    input: { collectionId: "abc123" },
    method: "GET",
    path: "/v2/collections/abc123/items",
  },
  {
    operationId: "clickup:get-task",
    input: { taskId: "9hz" },
    method: "GET",
    path: "/api/v2/task/9hz",
  },
  {
    // Tasks are created under a list, but addressed directly afterwards.
    operationId: "clickup:create-task",
    input: { listId: "901", name: "Ship it" },
    method: "POST",
    path: "/api/v2/list/901/task",
  },
  {
    // The workspace-wide filter is team-scoped and still spells folders
    // "project_ids", which is the easiest parameter here to get wrong.
    operationId: "clickup:search-tasks",
    input: { teamId: "42", folderIds: ["7"] },
    method: "GET",
    path: "/api/v2/team/42/task?project_ids%5B%5D=7",
  },
  {
    // Folderless lists hang off the space, not a folder.
    operationId: "clickup:get-lists",
    input: { spaceId: "2" },
    method: "GET",
    path: "/api/v2/space/2/list",
  },
  {
    operationId: "clickup:create-list",
    input: { folderId: "7", name: "Backlog" },
    method: "POST",
    path: "/api/v2/folder/7/list",
  },
  {
    // Checklist items are nested under their checklist, not under the task.
    operationId: "clickup:update-checklist-item",
    input: { checklistId: "cl1", checklistItemId: "ci2", resolved: true },
    method: "PUT",
    path: "/api/v2/checklist/cl1/checklist_item/ci2",
  },
  {
    operationId: "clickup:start-timer",
    input: { teamId: "42" },
    method: "POST",
    path: "/api/v2/team/42/time_entries/start",
  },
  {
    // The tag name is a path segment, so a name with a space must be encoded.
    operationId: "clickup:add-tag-to-task",
    input: { taskId: "9hz", tagName: "needs review" },
    method: "POST",
    path: "/api/v2/task/9hz/tag/needs%20review",
  },
  {
    // Devices are listed per tailnet but addressed globally afterwards, and
    // "-" is the documented alias for the credential's own tailnet.
    operationId: "tailscale:list-devices",
    input: {},
    method: "GET",
    path: "/api/v2/tailnet/-/devices",
  },
  {
    operationId: "tailscale:get-device",
    input: { deviceId: "n123CNTRL" },
    method: "GET",
    path: "/api/v2/device/n123CNTRL",
  },
  {
    operationId: "tailscale:authorize-device",
    input: { deviceId: "n123CNTRL", authorized: true },
    method: "POST",
    path: "/api/v2/device/n123CNTRL/authorized",
  },
  {
    // The DNS routes are lowercase and unseparated: "searchpaths", not
    // "search-paths" or "searchPaths".
    operationId: "tailscale:get-dns-search-paths",
    input: { tailnet: "example.com" },
    method: "GET",
    path: "/api/v2/tailnet/example.com/dns/searchpaths",
  },
  {
    // Users are acted on by sub-path, including deletion.
    operationId: "tailscale:delete-user",
    input: { userId: "12345" },
    method: "POST",
    path: "/api/v2/users/12345/delete",
  },
  {
    operationId: "tailscale:get-auth-key",
    input: { keyId: "k123CNTRL" },
    method: "GET",
    path: "/api/v2/tailnet/-/keys/k123CNTRL",
  },
  {
    operationId: "tailscale:set-acl",
    input: { policy: { acls: [] } },
    method: "POST",
    path: "/api/v2/tailnet/-/acl",
  },
  {
    // Listing records is a POST to a query sub-path, not a GET on the
    // collection — the easiest Attio route to get wrong.
    operationId: "attio:list-records",
    input: { object: "people" },
    method: "POST",
    path: "/v2/objects/people/records/query",
  },
  {
    operationId: "attio:get-record",
    input: { object: "people", recordId: "rec-1" },
    method: "GET",
    path: "/v2/objects/people/records/rec-1",
  },
  {
    // The upsert is a PUT on the collection, and the matching attribute is
    // what stops it creating a duplicate.
    operationId: "attio:assert-record-upsert",
    input: {
      object: "people",
      matchingAttribute: "email_addresses",
      values: {},
    },
    method: "PUT",
    path: "/v2/objects/people/records?matching_attribute=email_addresses",
  },
  {
    // Members live under workspace_members, not members.
    operationId: "attio:list-members",
    input: {},
    method: "GET",
    path: "/v2/workspace_members",
  },
  {
    // Attributes hang off either an object or a list under the same sub-path.
    operationId: "attio:list-attributes",
    input: { target: "lists", identifier: "sales" },
    method: "GET",
    path: "/v2/lists/sales/attributes",
  },
  {
    operationId: "attio:query-list-entries",
    input: { list: "sales" },
    method: "POST",
    path: "/v2/lists/sales/entries/query",
  },
  {
    // PostHog is Django REST Framework underneath: every project-scoped route
    // needs the trailing slash, or the API answers a redirect.
    operationId: "posthog:list-persons",
    input: { projectId: 42 },
    method: "GET",
    path: "/api/projects/42/persons/",
  },
  {
    operationId: "posthog:get-feature-flag",
    input: { projectId: 42, flagId: 7 },
    method: "GET",
    path: "/api/projects/42/feature_flags/7/",
  },
  {
    // HogQL runs through the generic query endpoint, not a /hogql route.
    operationId: "posthog:run-query-hogql",
    input: { projectId: 42, query: "select 1" },
    method: "POST",
    path: "/api/projects/42/query/",
  },
  {
    // Recording playlists are their own resource, not a sub-path of
    // session_recordings.
    operationId: "posthog:list-recording-playlists",
    input: { projectId: 42 },
    method: "GET",
    path: "/api/projects/42/session_recording_playlists/",
  },
  {
    // Organizations are not project-scoped.
    operationId: "posthog:get-organization",
    input: { organizationId: "org-1" },
    method: "GET",
    path: "/api/organizations/org-1/",
  },
  {
    // incident.io's document mixes v1 and v2; v2 is the current incidents API.
    operationId: "incident-io:list-incidents",
    input: {},
    method: "GET",
    path: "/v2/incidents",
  },
  {
    // The edit is an action sub-path, not a PUT on the incident.
    operationId: "incident-io:update-incident",
    input: {
      incidentId: "01ABC",
      incident: { name: "x" },
      notifyIncidentChannel: false,
    },
    method: "POST",
    path: "/v2/incidents/01ABC/actions/edit",
  },
  {
    // schedule_id is the one query parameter the spec marks required.
    operationId: "incident-io:list-schedule-entries",
    input: { scheduleId: "01SCH" },
    method: "GET",
    path: "/v2/schedule_entries?schedule_id=01SCH",
  },
  {
    // Severities ship no v2 path in the document, so v1 is the current one.
    operationId: "incident-io:list-severities",
    input: {},
    method: "GET",
    path: "/v1/severities",
  },
  {
    operationId: "incident-io:create-escalation-path",
    input: { name: "Primary", path: [] },
    method: "POST",
    path: "/v2/escalation_paths",
  },
  {
    // Rootly serves JSON:API, so a write carries a data envelope and the
    // vendor's own content type rather than application/json.
    operationId: "rootly:create-incident",
    input: { data: { type: "incidents" } },
    method: "POST",
    path: "/v1/incidents",
  },
  {
    // An action sub-path, not a PUT on the incident.
    operationId: "rootly:acknowledge-alert",
    input: { id: "alert-1" },
    method: "POST",
    path: "/v1/alerts/alert-1/acknowledge",
  },
  {
    // Rootly spells the unassign as a DELETE on an action path.
    operationId: "rootly:unassign-incident-role",
    input: { id: "inc-1", data: { type: "incident_role_assignments" } },
    method: "DELETE",
    path: "/v1/incidents/inc-1/unassign_role_from_user",
  },
  {
    operationId: "devin:list-sessions",
    input: {},
    method: "GET",
    path: "/v1/sessions",
  },
  {
    operationId: "granola:list-notes",
    input: {},
    method: "GET",
    path: "/v1/notes",
  },
  {
    operationId: "kalshi:get-markets",
    input: {},
    method: "GET",
    path: "/markets",
  },
  {
    operationId: "ahrefs:batch-analysis",
    input: { select: [], targets: [] },
    method: "POST",
    path: "/batch-analysis/batch-analysis",
  },
  {
    operationId: "agentphone:create-number",
    input: {},
    method: "POST",
    path: "/v1/numbers",
  },
  {
    operationId: "agentmail:list-threads",
    input: {},
    method: "GET",
    path: "/v0/threads",
  },
  {
    operationId: "leadmagic:company-search",
    input: {},
    method: "POST",
    path: "/v1/companies/company-search",
  },
  {
    operationId: "launchdarkly:list-projects",
    input: {},
    method: "GET",
    path: "/api/v2/projects",
  },
  {
    operationId: "stagehand:run-agent",
    input: { task: "task-1" },
    method: "POST",
    path: "/v1/agents/runs",
  },
  {
    operationId: "infisical:list-secrets",
    input: {},
    method: "GET",
    path: "/api/v4/secrets",
  },
  {
    operationId: "profound:list-categories",
    input: {},
    method: "GET",
    path: "/v1/org/categories",
  },
  {
    operationId: "sixtyfour-ai:enrich-lead",
    input: { leadInfo: {} },
    method: "POST",
    path: "/enrich-lead",
  },
  {
    operationId: "instantly:list-leads",
    input: {},
    method: "GET",
    path: "/api/v2/lead-lists",
  },
  {
    operationId: "lemlist:get-activities",
    input: {},
    method: "GET",
    path: "/activities/",
  },
  {
    operationId: "loops:update-contact",
    input: {},
    method: "PUT",
    path: "/v1/contacts/update",
  },
  {
    operationId: "mem0:search-memories",
    input: {},
    method: "GET",
    path: "/v1/memories/",
  },
  {
    operationId: "quartr:list-companies",
    input: {},
    method: "GET",
    path: "/companies",
  },
  {
    operationId: "daytona:create-sandbox",
    input: {},
    method: "POST",
    path: "/sandbox",
  },
  {
    operationId: "sentry:list-issues",
    input: { organizationIdOrSlug: "organizationIdOrSlug-1" },
    method: "GET",
    path: "/api/0/organizations/organizationIdOrSlug-1/issues/",
  },
  {
    operationId: "uptimerobot:list-monitors",
    input: {},
    method: "GET",
    path: "/monitors",
  },
  {
    operationId: "thrive:search-users",
    input: { apiVersion: "apiVersion-1" },
    method: "GET",
    path: "/api/user/search?api-version=apiVersion-1",
  },
  {
    operationId: "apify:run-actor",
    input: { runId: "runId-1" },
    method: "PUT",
    path: "/v2/actor-runs/runId-1",
  },
  {
    // LangSmith ingests a batch on a sub-path of the runs collection.
    operationId: "langsmith:create-runs-batch",
    input: {},
    method: "POST",
    path: "/api/v1/runs/batch",
  },
  {
    operationId: "wikipedia:get-page-summary",
    input: { title: "Rust" },
    method: "GET",
    path: "/api/rest_v1/page/summary/Rust",
  },
];

const CANARY = "credential-canary-9f3a2b";

function recordingRuntime(sink: Array<Record<string, unknown>>) {
  return {
    async request(input: {
      request?: Record<string, unknown>;
      [key: string]: unknown;
    }) {
      sink.push(input.request ?? input);
      return Response.json({ ok: true });
    },
    async withCredential(
      _reference: unknown,
      run: (credential: Record<string, string>) => Promise<unknown>,
    ) {
      return run({ apiKey: CANARY, accessToken: CANARY });
    },
  };
}

function adapterFor(operationId: string): {
  adapter: IntegrationProviderSdk;
  requests: Array<Record<string, unknown>>;
} {
  const integrationId = operationId.slice(0, operationId.indexOf(":"));
  const requests: Array<Record<string, unknown>> = [];
  const runtime = recordingRuntime(requests);
  const pack = BUILT_IN_PROVIDER_PACKS.find(
    (candidate) => candidate.integrationId === integrationId,
  );
  if (!pack) throw new Error(`no pack ships ${integrationId}`);
  const adapters = pack.create({
    apiKeyRuntime: runtime,
    oauthRuntime: runtime,
    noAuthRuntime: runtime,
  } as never);
  const adapter = adapters.find((candidate) =>
    candidate.operationIds.includes(operationId),
  );
  if (!adapter) throw new Error(`no adapter executes ${operationId}`);
  return { adapter, requests };
}

describe("typed REST wire shape", () => {
  for (const wireCase of CASES) {
    test(`${wireCase.operationId} requests ${wireCase.method} ${wireCase.path}`, async () => {
      const { adapter, requests } = adapterFor(wireCase.operationId);
      const integrationId = wireCase.operationId.slice(
        0,
        wireCase.operationId.indexOf(":"),
      );

      await adapter.execute({
        integrationId,
        operationId: wireCase.operationId,
        reference: createIntegrationCredentialReference({
          integrationId: integrationId as never,
          connectionId: "connection_wire",
          product: "eigenn",
        }),
        input: wireCase.input,
      } as never);

      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        method: wireCase.method,
        path: wireCase.path,
      });
      // The pack builds the request; only the transport may add the credential.
      expect(JSON.stringify(requests[0])).not.toContain(CANARY);
    });
  }

  test("every claimed typed REST action is executed by an adapter", () => {
    // A pack can declare coverage for an action it never builds a request for.
    // Coverage alone would still report that action as executable.
    const unexecutable: string[] = [];
    for (const pack of BUILT_IN_PROVIDER_PACKS) {
      const claimed = pack.coverage.filter(
        (entry) =>
          entry.lane === "typed_rest" && entry.disposition === "supported",
      );
      if (!claimed.length) continue;
      for (const entry of claimed) {
        try {
          adapterFor(entry.sourceOperationId);
        } catch {
          unexecutable.push(entry.sourceOperationId);
        }
      }
    }
    expect(unexecutable).toEqual([]);
  });

  test("each typed REST provider is pinned by at least one wire case", () => {
    // Without this, adding a provider silently adds unverified routes.
    const pinned = new Set(
      CASES.map((wireCase) =>
        wireCase.operationId.slice(0, wireCase.operationId.indexOf(":")),
      ),
    );
    const shipped = BUILT_IN_PROVIDER_PACKS.filter((pack) =>
      pack.coverage.some(
        (entry) =>
          entry.lane === "typed_rest" && entry.disposition === "supported",
      ),
    ).map((pack) => pack.integrationId);
    // The providers that predate this file close the six original SDK gaps and
    // are covered by their own execution tests.
    const legacy = new Set([
      "airtable",
      "cloudflare",
      "vercel",
      "cal-com",
      "google-appsheet",
      "google-maps",
      "jira-service-management",
      "arxiv",
    ]);
    expect(shipped.filter((id) => !pinned.has(id) && !legacy.has(id))).toEqual(
      [],
    );
  });
});
