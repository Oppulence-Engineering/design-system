import { describe, expect, test } from "bun:test";

import {
  createInMemoryIntegrationTriggerStore,
  createIntegrationCredentialReference,
  createIntegrationTriggerRoutes,
  createIntegrationTriggerRuntime,
  getProviderSdkCoverageReport,
  createIntegrationProviderSdkRegistry,
  IntegrationTriggerError,
  type IntegrationTriggerAuditRecord,
  type IntegrationTriggerEvent,
  type IntegrationTriggerSource,
} from "../src/server";

const reference = createIntegrationCredentialReference({
  integrationId: "airtable",
  connectionId: "connection_airtable",
  product: "eigenn",
});

const connection = {
  connectionId: "connection_airtable",
  integrationId: "airtable",
  product: "eigenn" as const,
  subjectId: "team_123",
};

function harness(
  sources: readonly IntegrationTriggerSource[],
  options: {
    onEvent?: (event: IntegrationTriggerEvent) => Promise<void>;
    now?: () => Date;
    maxAttempts?: number;
  } = {},
) {
  const events: IntegrationTriggerEvent[] = [];
  const audits: IntegrationTriggerAuditRecord[] = [];
  const store = createInMemoryIntegrationTriggerStore();
  const runtime = createIntegrationTriggerRuntime({
    sources,
    store,
    async onEvent(event) {
      events.push(event);
      await options.onEvent?.(event);
    },
    async audit(record) {
      audits.push(record);
    },
    ...(options.now ? { now: options.now } : {}),
    ...(options.maxAttempts ? { maxAttempts: options.maxAttempts } : {}),
  });
  return { runtime, events, audits, store };
}

function webhookSource(
  events: readonly { providerEvent: string; externalId?: string }[],
): IntegrationTriggerSource {
  return {
    kind: "webhook",
    integrationId: "airtable",
    triggerId: "airtable:airtable-webhook",
    async verify({ headers }) {
      if (headers.get("x-signature") !== "valid") return undefined;
      return { connection, events };
    },
  };
}

describe("integration trigger runtime", () => {
  test("delivers verified webhook events without exposing raw payloads", async () => {
    const { runtime, events } = harness([
      webhookSource([{ providerEvent: "record.created", externalId: "rec_1" }]),
    ]);

    const result = await runtime.deliver({
      integrationId: "airtable",
      triggerId: "airtable:airtable-webhook",
      rawBody: new TextEncoder().encode("{}"),
      headers: new Headers({ "x-signature": "valid" }),
    });

    expect(result).toMatchObject({
      accepted: true,
      delivered: 1,
      duplicates: 0,
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      integrationId: "airtable",
      triggerId: "airtable:airtable-webhook",
      providerEvent: "record.created",
      externalId: "rec_1",
    });
    expect(events[0]?.idempotencyKey).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(events[0])).not.toContain("x-signature");
  });

  test("rejects a delivery whose signature does not verify", async () => {
    const { runtime, events } = harness([webhookSource([])]);

    await expect(
      runtime.deliver({
        integrationId: "airtable",
        triggerId: "airtable:airtable-webhook",
        rawBody: new TextEncoder().encode("{}"),
        headers: new Headers({ "x-signature": "forged" }),
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_TRIGGER_SIGNATURE_INVALID",
    });
    expect(events).toEqual([]);
  });

  test("suppresses a replayed delivery of the same provider event", async () => {
    const { runtime, events, audits } = harness([
      webhookSource([{ providerEvent: "record.created", externalId: "rec_1" }]),
    ]);
    const deliver = () =>
      runtime.deliver({
        integrationId: "airtable",
        triggerId: "airtable:airtable-webhook",
        rawBody: new TextEncoder().encode("{}"),
        headers: new Headers({ "x-signature": "valid" }),
      });

    await deliver();
    const replay = await deliver();

    expect(replay).toMatchObject({ delivered: 0, duplicates: 1 });
    expect(events).toHaveLength(1);
    expect(audits.map((record) => record.action)).toEqual([
      "delivered",
      "duplicate",
    ]);
  });

  test("derives the same key for a replay when the provider supplies no id", async () => {
    const { runtime, events } = harness([
      webhookSource([{ providerEvent: "record.created" }]),
    ]);
    const deliver = () =>
      runtime.deliver({
        integrationId: "airtable",
        triggerId: "airtable:airtable-webhook",
        rawBody: new TextEncoder().encode("{}"),
        headers: new Headers({ "x-signature": "valid" }),
      });

    await deliver();
    await deliver();

    expect(events).toHaveLength(1);
  });

  test("retries a failing product handler and reports failure after the last attempt", async () => {
    let attempts = 0;
    const { runtime, audits } = harness(
      [webhookSource([{ providerEvent: "record.created", externalId: "r" }])],
      {
        maxAttempts: 3,
        async onEvent() {
          attempts += 1;
          throw new Error("product queue unavailable");
        },
      },
    );

    await expect(
      runtime.deliver({
        integrationId: "airtable",
        triggerId: "airtable:airtable-webhook",
        rawBody: new TextEncoder().encode("{}"),
        headers: new Headers({ "x-signature": "valid" }),
      }),
    ).rejects.toBeInstanceOf(IntegrationTriggerError);

    expect(attempts).toBe(3);
    expect(audits.at(-1)?.action).toBe("failed");
  });

  test("advances and resumes from the poll cursor", async () => {
    const seen: Array<string | undefined> = [];
    const pages: Record<
      string,
      {
        events: { providerEvent: string; externalId: string }[];
        cursor: string;
      }
    > = {
      start: {
        events: [{ providerEvent: "record.created", externalId: "rec_1" }],
        cursor: "page_2",
      },
      page_2: {
        events: [{ providerEvent: "record.created", externalId: "rec_2" }],
        cursor: "page_3",
      },
    };
    const { runtime, events } = harness([
      {
        kind: "poll",
        integrationId: "airtable",
        triggerId: "airtable:airtable-webhook",
        intervalSeconds: 60,
        async poll({ cursor }) {
          seen.push(cursor);
          return pages[cursor ?? "start"];
        },
      },
    ]);

    const first = await runtime.poll({
      reference,
      subjectId: "team_123",
      triggerId: "airtable:airtable-webhook",
    });
    const second = await runtime.poll({
      reference,
      subjectId: "team_123",
      triggerId: "airtable:airtable-webhook",
      force: true,
    });

    expect(seen).toEqual([undefined, "page_2"]);
    expect(first.cursor).toBe("page_2");
    expect(second.cursor).toBe("page_3");
    expect(events.map((event) => event.externalId)).toEqual(["rec_1", "rec_2"]);
  });

  test("refuses a poll inside the source's interval unless forced", async () => {
    const { runtime } = harness([
      {
        kind: "poll",
        integrationId: "airtable",
        triggerId: "airtable:airtable-webhook",
        intervalSeconds: 3_600,
        async poll() {
          return { events: [] };
        },
      },
    ]);

    await runtime.poll({
      reference,
      subjectId: "team_123",
      triggerId: "airtable:airtable-webhook",
    });

    await expect(
      runtime.poll({
        reference,
        subjectId: "team_123",
        triggerId: "airtable:airtable-webhook",
      }),
    ).rejects.toMatchObject({ code: "INTEGRATION_TRIGGER_NOT_DUE" });
  });

  test("renews a subscription only inside its renewal window", async () => {
    let renewals = 0;
    let clock = Date.parse("2026-07-31T00:00:00.000Z");
    const { runtime } = harness(
      [
        {
          kind: "subscription",
          integrationId: "airtable",
          triggerId: "airtable:airtable-webhook",
          renewWithinSeconds: 900,
          async subscribe() {
            return {
              subscriptionId: "sub_1",
              expiresAt: "2026-07-31T01:00:00.000Z",
            };
          },
          async renew() {
            renewals += 1;
            return { expiresAt: "2026-07-31T02:00:00.000Z" };
          },
          async unsubscribe() {},
          async verify() {
            return undefined;
          },
        },
      ],
      { now: () => new Date(clock) },
    );

    await runtime.subscribe({
      reference,
      triggerId: "airtable:airtable-webhook",
      callbackUrl: "https://app.example/integrations/airtable/triggers/x",
    });

    // 60 minutes out, well outside the 15-minute renewal window.
    await expect(
      runtime.renewDue({ reference, triggerId: "airtable:airtable-webhook" }),
    ).resolves.toEqual({ renewed: false });
    expect(renewals).toBe(0);

    // 10 minutes from expiry, inside the window.
    clock = Date.parse("2026-07-31T00:50:00.000Z");
    await expect(
      runtime.renewDue({ reference, triggerId: "airtable:airtable-webhook" }),
    ).resolves.toMatchObject({ renewed: true });
    expect(renewals).toBe(1);
  });

  test("unsubscribes and clears durable state on disconnect", async () => {
    const unsubscribed: string[] = [];
    const { runtime, store } = harness([
      {
        kind: "subscription",
        integrationId: "airtable",
        triggerId: "airtable:airtable-webhook",
        async subscribe() {
          return { subscriptionId: "sub_1" };
        },
        async unsubscribe({ subscriptionId }) {
          unsubscribed.push(subscriptionId);
        },
        async verify() {
          return undefined;
        },
      },
    ]);
    await runtime.subscribe({
      reference,
      triggerId: "airtable:airtable-webhook",
      callbackUrl: "https://app.example/integrations/airtable/triggers/x",
    });

    await runtime.disconnect(reference);

    expect(unsubscribed).toEqual(["sub_1"]);
    await expect(
      store.readCheckpoint({
        connectionId: "connection_airtable",
        integrationId: "airtable",
        product: "eigenn",
        triggerId: "airtable:airtable-webhook",
      }),
    ).resolves.toBeUndefined();
  });

  test("clears local state even when the provider rejects the unsubscribe", async () => {
    const { runtime, store, audits } = harness([
      {
        kind: "subscription",
        integrationId: "airtable",
        triggerId: "airtable:airtable-webhook",
        async subscribe() {
          return { subscriptionId: "sub_1" };
        },
        async unsubscribe() {
          throw new Error("already deleted upstream");
        },
        async verify() {
          return undefined;
        },
      },
    ]);
    await runtime.subscribe({
      reference,
      triggerId: "airtable:airtable-webhook",
      callbackUrl: "https://app.example/integrations/airtable/triggers/x",
    });

    await runtime.disconnect(reference);

    expect(audits.at(-1)).toMatchObject({
      action: "failed",
      detail: "unsubscribe",
    });
    await expect(
      store.readCheckpoint({
        connectionId: "connection_airtable",
        integrationId: "airtable",
        product: "eigenn",
        triggerId: "airtable:airtable-webhook",
      }),
    ).resolves.toBeUndefined();
  });

  test("reports freshness and failure state", async () => {
    let clock = Date.parse("2026-07-31T00:00:00.000Z");
    const { runtime } = harness(
      [
        webhookSource([
          { providerEvent: "record.created", externalId: "rec_1" },
        ]),
      ],
      { now: () => new Date(clock) },
    );

    await expect(
      runtime.getHealth({ reference, triggerId: "airtable:airtable-webhook" }),
    ).resolves.toMatchObject({ state: "unregistered" });

    await runtime.deliver({
      integrationId: "airtable",
      triggerId: "airtable:airtable-webhook",
      rawBody: new TextEncoder().encode("{}"),
      headers: new Headers({ "x-signature": "valid" }),
    });

    await expect(
      runtime.getHealth({ reference, triggerId: "airtable:airtable-webhook" }),
    ).resolves.toMatchObject({ state: "healthy", freshnessSeconds: 0 });

    clock += 48 * 60 * 60 * 1_000;
    await expect(
      runtime.getHealth({ reference, triggerId: "airtable:airtable-webhook" }),
    ).resolves.toMatchObject({ state: "stale" });
  });

  test("rejects a source whose trigger ID is not namespaced by its provider", () => {
    expect(() =>
      createIntegrationTriggerRuntime({
        sources: [
          {
            kind: "webhook",
            integrationId: "airtable",
            triggerId: "notion:page-updated",
            async verify() {
              return undefined;
            },
          },
        ],
        store: createInMemoryIntegrationTriggerStore(),
        async onEvent() {},
      }),
    ).toThrow(IntegrationTriggerError);
  });

  test("mounts delivery on a bounded webhook route", async () => {
    const { runtime, events } = harness([
      webhookSource([{ providerEvent: "record.created", externalId: "rec_1" }]),
    ]);
    const routes = createIntegrationTriggerRoutes({ runtime });

    const accepted = await routes.handle(
      new Request(
        "https://app.example/integrations/airtable/triggers/airtable%3Aairtable-webhook",
        {
          method: "POST",
          headers: { "x-signature": "valid" },
          body: "{}",
        },
      ),
    );
    const forged = await routes.handle(
      new Request(
        "https://app.example/integrations/airtable/triggers/airtable%3Aairtable-webhook",
        { method: "POST", headers: { "x-signature": "no" }, body: "{}" },
      ),
    );
    const unknown = await routes.handle(
      new Request(
        "https://app.example/integrations/airtable/triggers/airtable%3Amissing",
        { method: "POST", body: "{}" },
      ),
    );

    expect(accepted?.status).toBe(202);
    expect(forged?.status).toBe(401);
    expect(unknown?.status).toBe(404);
    expect(events).toHaveLength(1);
  });

  test("counts registered trigger sources as executable coverage", () => {
    const registry = createIntegrationProviderSdkRegistry([]);
    const empty = getProviderSdkCoverageReport(registry);
    const withTriggers = getProviderSdkCoverageReport(registry, [
      { integrationId: "airtable", triggerId: "airtable:airtable-webhook" },
      // A trigger outside the pinned source must not inflate coverage.
      { integrationId: "airtable", triggerId: "airtable:invented" },
    ]);

    expect(empty.executableTriggers).toBe(0);
    expect(empty.unimplementedTriggers).toBe(empty.sourceTriggers);
    expect(withTriggers.executableTriggers).toBe(1);
    expect(withTriggers.unimplementedTriggers).toBe(
      withTriggers.sourceTriggers - 1,
    );
  });
});
