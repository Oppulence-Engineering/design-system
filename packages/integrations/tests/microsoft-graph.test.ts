import { describe, expect, test } from "bun:test";

import {
  assertProviderPackCoverage,
  createAzureAdPack,
  createAzureAdProviderSdk,
  createIntegrationCredentialReference,
  createInMemoryIntegrationTriggerStore,
  createIntegrationTriggerRuntime,
  createMicrosoftExcelPack,
  createMicrosoftExcelProviderSdk,
  createMicrosoftGraphOAuth2Provider,
  createMicrosoftPlannerPack,
  createMicrosoftPlannerProviderSdk,
  createMicrosoftTeamsChatSubscriptionSource,
  createMicrosoftTeamsPack,
  createMicrosoftTeamsProviderSdk,
  createOneDrivePack,
  createOutlookPollTriggerSource,
  createOutlookPack,
  createOutlookProviderSdk,
  createSharePointPack,
  createSharePointProviderSdk,
  type IntegrationProviderPack,
  type IntegrationTriggerEvent,
  type MicrosoftGraphClient,
} from "../src/server";

interface GraphCall {
  path: string;
  method: string;
  query?: Record<string, unknown>;
  headers: Record<string, string>;
  body?: unknown;
}

/** Records what each pack sends to Graph without touching the network. */
function graphRecorder(response: unknown = { id: "graph_1" }) {
  const calls: GraphCall[] = [];
  const client: MicrosoftGraphClient = {
    api(path) {
      const call: GraphCall = { path, method: "", headers: {} };
      const builder = {
        version() {
          return builder;
        },
        query(parameters: Record<string, unknown>) {
          call.query = parameters;
          return builder;
        },
        header(name: string, value: string) {
          call.headers[name] = value;
          return builder;
        },
        responseType() {
          return builder;
        },
        async get() {
          call.method = "GET";
          calls.push(call);
          return response;
        },
        async post(body?: unknown) {
          call.method = "POST";
          call.body = body;
          calls.push(call);
          return response;
        },
        async patch(body?: unknown) {
          call.method = "PATCH";
          call.body = body;
          calls.push(call);
          return response;
        },
        async put(body?: unknown) {
          call.method = "PUT";
          call.body = body;
          calls.push(call);
          return response;
        },
        async delete() {
          call.method = "DELETE";
          calls.push(call);
          return undefined;
        },
      };
      return builder;
    },
  };
  return { calls, clientFactory: () => client };
}

const oauthRuntime = {
  async withCredential<T>(
    _reference: unknown,
    operation: (credential: {
      accessToken: string;
      scope: readonly string[];
      tokenType: string;
    }) => Promise<T>,
  ): Promise<T> {
    return operation({
      accessToken: "graph-token",
      scope: [],
      tokenType: "Bearer",
    });
  },
  async request() {
    return Response.json({});
  },
};

function reference(integrationId: string) {
  return createIntegrationCredentialReference({
    integrationId,
    connectionId: `connection_${integrationId}`,
    product: "eigenn",
  });
}

describe("Microsoft Graph provider family", () => {
  test("every pack accounts for all of its source actions and triggers", () => {
    const packs: readonly IntegrationProviderPack[] = [
      createAzureAdPack(),
      createOutlookPack(),
      createOneDrivePack(),
      createSharePointPack(),
      createMicrosoftPlannerPack(),
      createMicrosoftTeamsPack(),
      createMicrosoftExcelPack(),
    ];

    for (const pack of packs) {
      expect(() =>
        assertProviderPackCoverage(pack, { oauthRuntime }),
      ).not.toThrow();
      // The family is SDK-first throughout; nothing should have escaped to REST.
      expect(
        pack.coverage.every(
          (entry) => entry.disposition === "supported" && entry.lane === "sdk",
        ),
      ).toBe(true);
    }

    expect(packs.reduce((total, pack) => total + pack.coverage.length, 0)).toBe(
      107,
    );
  });

  test("builds a group membership reference from the directoryObjects URL", async () => {
    const recorder = graphRecorder();
    const provider = createAzureAdProviderSdk({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
    });

    const result = await provider.execute({
      integrationId: "azure-ad",
      operationId: "azure-ad:add-group-member",
      reference: reference("azure-ad"),
      input: { groupId: "group_1", memberId: "user_1" },
    });

    expect(recorder.calls[0]).toMatchObject({
      path: "/groups/group_1/members/$ref",
      method: "POST",
      body: {
        "@odata.id": "https://graph.microsoft.com/v1.0/directoryObjects/user_1",
      },
    });
    // The $ref write returns 204, so the adapter reports the outcome itself.
    expect(result.output).toEqual({
      groupId: "group_1",
      memberId: "user_1",
      added: true,
    });
  });

  test("rejects a path segment that would escape the Graph resource", async () => {
    const recorder = graphRecorder();
    const provider = createAzureAdProviderSdk({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
    });

    await expect(
      provider.execute({
        integrationId: "azure-ad",
        operationId: "azure-ad:get-user",
        reference: reference("azure-ad"),
        input: { userId: "user_1/../../groups" },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
    expect(recorder.calls).toEqual([]);
  });

  test("sends Outlook mail with recipients Graph expects", async () => {
    const recorder = graphRecorder();
    const provider = createOutlookProviderSdk({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
    });

    await provider.execute({
      integrationId: "outlook",
      operationId: "outlook:send-email",
      reference: reference("outlook"),
      input: {
        to: ["a@example.com", "b@example.com"],
        cc: ["c@example.com"],
        subject: "Q3",
        body: "See attached.",
      },
    });

    expect(recorder.calls[0]).toMatchObject({
      path: "/me/sendMail",
      method: "POST",
      body: {
        message: {
          subject: "Q3",
          body: { contentType: "HTML", content: "See attached." },
          toRecipients: [
            { emailAddress: { address: "a@example.com" } },
            { emailAddress: { address: "b@example.com" } },
          ],
          ccRecipients: [{ emailAddress: { address: "c@example.com" } }],
        },
        saveToSentItems: true,
      },
    });
  });

  test("maps the invite response to the matching Graph action", async () => {
    const recorder = graphRecorder();
    const provider = createOutlookProviderSdk({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
    });

    for (const [response, action] of [
      ["accept", "accept"],
      ["decline", "decline"],
      ["tentative", "tentativelyAccept"],
    ]) {
      await provider.execute({
        integrationId: "outlook",
        operationId: "outlook:respond-to-invite",
        reference: reference("outlook"),
        input: { eventId: "event_1", response },
      });
    }

    expect(recorder.calls.map((call) => call.path)).toEqual([
      "/me/events/event_1/accept",
      "/me/events/event_1/decline",
      "/me/events/event_1/tentativelyAccept",
    ]);
  });

  test("expands SharePoint list-item fields, which Graph omits by default", async () => {
    const recorder = graphRecorder();
    const provider = createSharePointProviderSdk({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
    });

    await provider.execute({
      integrationId: "sharepoint",
      operationId: "sharepoint:get-list-item",
      reference: reference("sharepoint"),
      input: { siteId: "site_1", listId: "list_1", itemId: "item_1" },
    });

    expect(recorder.calls[0]?.path).toBe(
      "/sites/site_1/lists/list_1/items/item_1",
    );
    expect(recorder.calls[0]?.query).toMatchObject({ $expand: "fields" });
  });

  test("sends the Planner ETag as an If-Match header and requires it", async () => {
    const recorder = graphRecorder();
    const provider = createMicrosoftPlannerProviderSdk({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
    });

    await provider.execute({
      integrationId: "microsoft-planner",
      operationId: "microsoft-planner:update-task",
      reference: reference("microsoft-planner"),
      input: { taskId: "task_1", title: "Renamed", etag: 'W/"abc"' },
    });

    expect(recorder.calls[0]).toMatchObject({
      path: "/planner/tasks/task_1",
      method: "PATCH",
      headers: { "If-Match": 'W/"abc"' },
      body: { title: "Renamed" },
    });

    await expect(
      provider.execute({
        integrationId: "microsoft-planner",
        operationId: "microsoft-planner:update-task",
        reference: reference("microsoft-planner"),
        input: { taskId: "task_1", title: "Renamed" },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
  });

  test("routes a Teams reaction to the chat or channel message path", async () => {
    const recorder = graphRecorder();
    const provider = createMicrosoftTeamsProviderSdk({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
    });

    await provider.execute({
      integrationId: "microsoft-teams",
      operationId: "microsoft-teams:add-reaction",
      reference: reference("microsoft-teams"),
      input: { chatId: "chat_1", messageId: "msg_1", reactionType: "heart" },
    });
    await provider.execute({
      integrationId: "microsoft-teams",
      operationId: "microsoft-teams:add-reaction",
      reference: reference("microsoft-teams"),
      input: { teamId: "team_1", channelId: "chan_1", messageId: "msg_2" },
    });

    expect(recorder.calls.map((call) => call.path)).toEqual([
      "/chats/chat_1/messages/msg_1/setReaction",
      "/teams/team_1/channels/chan_1/messages/msg_2/setReaction",
    ]);
    expect(recorder.calls[1]?.body).toEqual({ reactionType: "like" });
  });

  test("falls back to the Excel used range when no address is given", async () => {
    const recorder = graphRecorder({ address: "A1:B2", values: [[1, 2]] });
    const provider = createMicrosoftExcelProviderSdk({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
    });

    const usedRange = await provider.execute({
      integrationId: "microsoft-excel",
      operationId: "microsoft-excel:read-data",
      reference: reference("microsoft-excel"),
      input: { itemId: "item_1", worksheetName: "Sheet1" },
    });
    await provider.execute({
      integrationId: "microsoft-excel",
      operationId: "microsoft-excel:read-data",
      reference: reference("microsoft-excel"),
      input: { itemId: "item_1", worksheetName: "Sheet1", range: "A1:B2" },
    });

    expect(recorder.calls.map((call) => call.path)).toEqual([
      "/me/drive/items/item_1/workbook/worksheets/Sheet1/usedRange",
      "/me/drive/items/item_1/workbook/worksheets/Sheet1/range(address='A1:B2')",
    ]);
    expect(usedRange.output).toEqual({ address: "A1:B2", values: [[1, 2]] });
  });

  test("strips Graph service annotations but keeps paging state", async () => {
    const recorder = graphRecorder({
      "@odata.context": "https://graph.microsoft.com/$metadata#users",
      "@odata.nextLink": "https://graph.microsoft.com/v1.0/users?$skiptoken=x",
      value: [{ id: "user_1", "@odata.etag": "W/1", displayName: "Ada" }],
    });
    const provider = createAzureAdProviderSdk({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
    });

    const result = await provider.execute({
      integrationId: "azure-ad",
      operationId: "azure-ad:list-users",
      reference: reference("azure-ad"),
      input: {},
    });

    expect(result.output).toEqual({
      nextLink: "https://graph.microsoft.com/v1.0/users?$skiptoken=x",
      value: [{ id: "user_1", displayName: "Ada" }],
    });
  });

  test("polls Outlook forward from the newest message seen", async () => {
    const recorder = graphRecorder({
      value: [
        { id: "m2", receivedDateTime: "2026-07-31T10:00:00Z", subject: "b" },
        { id: "m1", receivedDateTime: "2026-07-31T09:00:00Z", subject: "a" },
      ],
    });
    const events: IntegrationTriggerEvent[] = [];
    const runtime = createIntegrationTriggerRuntime({
      sources: [
        createOutlookPollTriggerSource({
          oauthRuntime,
          clientFactory: recorder.clientFactory,
        }),
      ],
      store: createInMemoryIntegrationTriggerStore(),
      async onEvent(event) {
        events.push(event);
      },
    });

    const first = await runtime.poll({
      reference: reference("outlook"),
      subjectId: "team_1",
      triggerId: "outlook:outlook-poller",
    });
    await runtime.poll({
      reference: reference("outlook"),
      subjectId: "team_1",
      triggerId: "outlook:outlook-poller",
      force: true,
    });

    expect(first.cursor).toBe("2026-07-31T10:00:00Z");
    // Oldest first, so a product processes the mailbox in arrival order.
    expect(events.map((event) => event.externalId)).toEqual(["m1", "m2"]);
    // The second poll replays the same IDs and must be suppressed.
    expect(events).toHaveLength(2);
    expect(recorder.calls[1]?.query).toMatchObject({
      $filter: "receivedDateTime gt 2026-07-31T10:00:00Z",
    });
  });

  test("rejects a Teams notification whose clientState does not match", async () => {
    const recorder = graphRecorder();
    const source = createMicrosoftTeamsChatSubscriptionSource({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
      clientState: "shared-secret",
      async resolveConnection() {
        return {
          connectionId: "connection_microsoft-teams",
          integrationId: "microsoft-teams",
          product: "eigenn",
          subjectId: "team_1",
        };
      },
    });
    const body = (clientState: string) =>
      new TextEncoder().encode(
        JSON.stringify({
          value: [
            {
              subscriptionId: "sub_1",
              clientState,
              changeType: "created",
              resource: "chats/1/messages/2",
              resourceData: { id: "msg_1" },
            },
          ],
        }),
      );

    await expect(
      source.verify({
        rawBody: body("forged"),
        headers: new Headers(),
        subscriptionId: undefined,
      }),
    ).resolves.toBeUndefined();

    const accepted = await source.verify({
      rawBody: body("shared-secret"),
      headers: new Headers(),
      subscriptionId: undefined,
    });
    expect(accepted?.events[0]).toMatchObject({
      providerEvent: "chatMessage.created",
      externalId: "msg_1",
    });
  });

  test("renews a Teams subscription through the Graph subscriptions resource", async () => {
    const recorder = graphRecorder({
      id: "sub_1",
      expirationDateTime: "2026-08-01T00:00:00Z",
    });
    const source = createMicrosoftTeamsChatSubscriptionSource({
      oauthRuntime,
      clientFactory: recorder.clientFactory,
      clientState: "shared-secret",
      now: () => new Date("2026-07-31T00:00:00Z"),
      async resolveConnection() {
        return undefined;
      },
    });

    const created = await source.subscribe({
      reference: reference("microsoft-teams"),
      callbackUrl:
        "https://app.example/integrations/microsoft-teams/triggers/x",
    });
    await source.renew?.({
      reference: reference("microsoft-teams"),
      subscriptionId: "sub_1",
    });
    await source.unsubscribe({
      reference: reference("microsoft-teams"),
      subscriptionId: "sub_1",
    });

    expect(created).toEqual({
      subscriptionId: "sub_1",
      expiresAt: "2026-08-01T00:00:00Z",
    });
    expect(recorder.calls.map((call) => `${call.method} ${call.path}`)).toEqual(
      [
        "POST /subscriptions",
        "PATCH /subscriptions/sub_1",
        "DELETE /subscriptions/sub_1",
      ],
    );
    expect(recorder.calls[0]?.body).toMatchObject({
      resource: "/me/chats/getAllMessages",
      clientState: "shared-secret",
    });
  });

  test("registers one Entra ID authority per Microsoft provider", () => {
    const provider = createMicrosoftGraphOAuth2Provider({
      integrationId: "outlook",
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "https://app.example/callback",
      tenant: "contoso.onmicrosoft.com",
    });

    expect(provider).toMatchObject({
      integrationId: "outlook",
      authorizationEndpoint:
        "https://login.microsoftonline.com/contoso.onmicrosoft.com/oauth2/v2.0/authorize",
      apiBaseUrl: "https://graph.microsoft.com/v1.0",
    });
    expect(provider.scopes).toContain("Mail.Send");
    expect(provider.scopes).toContain("offline_access");

    expect(() =>
      createMicrosoftGraphOAuth2Provider({
        integrationId: "outlook",
        clientId: "client",
        redirectUri: "https://app.example/callback",
        tenant: "../evil",
      }),
    ).toThrow();
  });
});
