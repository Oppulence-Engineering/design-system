import { afterEach, describe, expect, it } from "bun:test";
import {
  ACTIVATION_EVENTS,
  createActivationTracker,
  listActivationEvents,
} from "../src/activation";
import {
  isEmissionEnabled,
  isEmissionEnabledFromProcessEnv,
} from "../src/gate";
import {
  createServerTracker,
  type ServerTracker,
  type TrackProperties,
} from "../src/server-tracker";

type Call =
  | { kind: "track"; name: string; properties?: TrackProperties }
  | { kind: "group"; payload: unknown };

const recordingTracker = (
  options: { throws?: boolean; enabled?: boolean } = {},
) => {
  const calls: Call[] = [];
  const tracker: ServerTracker = {
    enabled: options.enabled ?? true,
    track: (name, properties) => {
      if (options.throws) throw new Error("network down");
      calls.push({ kind: "track", name, properties });
    },
    identify: () => {},
    upsertGroup: (payload) => {
      calls.push({ kind: "group", payload });
    },
    fireOnceForOrg: async () => {},
  };
  return { calls, tracker };
};

const occurredAt = new Date("2026-10-05T12:00:00.000Z");

describe("activation tracker", () => {
  it("sends the product event and the shared lifecycle event it feeds, grouped by workspace and stamped with the domain time", () => {
    const { calls, tracker } = recordingTracker();
    const activation = createActivationTracker({
      tracker,
      product: "conduitt",
      environment: "production",
      appVersion: "1.4.0",
    });

    const result = activation.track("conduitt_first_payment_recovered", {
      workspaceId: "org_123",
      profileId: "user_1",
      occurredAt,
      properties: {
        invoice_id: "inv_1",
        payment_id: "pay_1",
        amount_minor: 12_500,
        currency: "USD",
      },
    });

    expect(result).toEqual({ sent: true });
    expect(calls.map((call) => call.kind === "track" && call.name)).toEqual([
      "conduitt_first_payment_recovered",
      "first_valuable_outcome",
    ]);
    for (const call of calls) {
      expect(call.kind === "track" && call.properties).toMatchObject({
        profileId: "user_1",
        groups: ["org_123"],
        workspace_id: "org_123",
        product: "conduitt",
        environment: "production",
        app_version: "1.4.0",
        source: "server",
        occurred_at: "2026-10-05T12:00:00.000Z",
        __timestamp: "2026-10-05T12:00:00.000Z",
      });
    }
    expect(calls[1]).toMatchObject({
      properties: {
        outcome: "conduitt_first_payment_recovered",
        event_version: ACTIVATION_EVENTS.first_valuable_outcome.version,
      },
    });
  });

  it("omits the profile for a system-caused outcome instead of guessing one", () => {
    const { calls, tracker } = recordingTracker();
    createActivationTracker({
      tracker,
      product: "eigenn",
      environment: "production",
    }).track("eigenn_current_position_ready", {
      workspaceId: "team_1",
      profileId: null,
      occurredAt,
      properties: {},
    });

    expect(
      calls[0]?.kind === "track" && calls[0].properties,
    ).not.toHaveProperty("profileId");
  });

  it("sends nothing outside production or when the tracker is not wired", () => {
    for (const environment of ["staging", "development", "test"] as const) {
      const { calls, tracker } = recordingTracker();
      const result = createActivationTracker({
        tracker,
        product: "eigenn",
        environment,
      }).track("eigenn_first_scenario_created", {
        workspaceId: "team_1",
        profileId: "user_1",
        occurredAt,
        properties: { scenario_id: "sc_1" },
      });

      expect(result).toEqual({ sent: false, reason: "environment" });
      expect(calls).toEqual([]);
    }

    const { calls, tracker } = recordingTracker({ enabled: false });
    const result = createActivationTracker({
      tracker,
      product: "eigenn",
      environment: "production",
    }).track("eigenn_first_scenario_created", {
      workspaceId: "team_1",
      profileId: "user_1",
      occurredAt,
      properties: { scenario_id: "sc_1" },
    });
    expect(result).toEqual({ sent: false, reason: "disabled" });
    expect(calls).toEqual([]);
  });

  it("rejects properties that break the event contract", () => {
    const { calls, tracker } = recordingTracker();
    const activation = createActivationTracker({
      tracker,
      product: "conduitt",
      environment: "production",
    });
    const base = {
      invoice_id: "inv_1",
      payment_id: "pay_1",
      amount_minor: 100,
      currency: "USD",
    };

    for (const properties of [
      { ...base, amount_minor: 10.5 },
      { ...base, amount_minor: 0 },
      { ...base, currency: "dollars" },
      { ...base, payment_id: "" },
    ]) {
      const result = activation.track("conduitt_first_payment_recovered", {
        workspaceId: "org_1",
        profileId: null,
        occurredAt,
        properties,
      });
      expect(result).toEqual({ sent: false, reason: "invalid_properties" });
    }
    expect(
      activation.track("conduitt_first_payment_recovered", {
        workspaceId: "",
        profileId: null,
        occurredAt,
        properties: base,
      }),
    ).toEqual({ sent: false, reason: "invalid_properties" });
    expect(calls).toEqual([]);
  });

  it("refuses another product's event, uninstrumented events, and direct sends of fed lifecycle steps", () => {
    const { calls, tracker } = recordingTracker();
    const conduitt = createActivationTracker({
      tracker,
      product: "conduitt",
      environment: "production",
    });
    const eigenn = createActivationTracker({
      tracker,
      product: "eigenn",
      environment: "production",
    });

    const crossProduct = conduitt.track(
      // @ts-expect-error an Eigenn event is not trackable by the Conduitt tracker
      "eigenn_first_scenario_created",
      {
        workspaceId: "org_1",
        profileId: null,
        occurredAt,
        properties: { scenario_id: "s" },
      },
    );
    const uninstrumented = eigenn.track(
      // @ts-expect-error not_instrumented events have no backing record yet
      "eigenn_first_plan_committed",
      { workspaceId: "team_1", profileId: null, occurredAt, properties: {} },
    );
    const fedStep = eigenn.track(
      // @ts-expect-error fed lifecycle steps are sent only by product events
      "data_source_connected",
      {
        workspaceId: "team_1",
        profileId: null,
        occurredAt,
        properties: { outcome: "manual" },
      },
    );

    expect(crossProduct).toEqual({ sent: false, reason: "wrong_product" });
    expect(uninstrumented).toEqual({ sent: false, reason: "not_instrumented" });
    expect(fedStep).toEqual({ sent: false, reason: "fed_only" });
    expect(calls).toEqual([]);
  });

  it("never throws when the transport fails", () => {
    const { tracker } = recordingTracker({ throws: true });
    const activation = createActivationTracker({
      tracker,
      product: "eigenn",
      environment: "production",
    });

    expect(
      activation.track("eigenn_current_position_ready", {
        workspaceId: "team_1",
        profileId: null,
        occurredAt,
        properties: {},
      }),
    ).toEqual({ sent: false, reason: "transport_error" });
  });

  it("upserts the workspace group, dropping only the properties that break the contract", () => {
    const { calls, tracker } = recordingTracker();
    const activation = createActivationTracker({
      tracker,
      product: "eigenn",
      environment: "production",
    });

    const fromUntypedCaller = {
      plan: "growth",
      trial_state: "unpaid",
      connection_state: "flaky",
      owner_email: "ceo@acme.com",
    };
    activation.upsertWorkspace({
      workspaceId: "team_1",
      name: "Acme",
      // @ts-expect-error out-of-enum values and unknown keys break the contract
      properties: fromUntypedCaller,
    });

    expect(calls).toEqual([
      {
        kind: "group",
        payload: {
          id: "team_1",
          type: "workspace",
          name: "Acme",
          properties: {
            plan: "growth",
            trial_state: "unpaid",
            product: "eigenn",
          },
        },
      },
    ]);
  });
});

describe("activation event dictionary", () => {
  it("documents every event with a product, version, and backing record", () => {
    const names = new Set(listActivationEvents().map((event) => event.name));
    for (const { name, ...definition } of listActivationEvents()) {
      expect(definition.version).toBeGreaterThanOrEqual(1);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(definition.backingRecord.length).toBeGreaterThan(0);
      if (definition.product !== "shared") {
        expect(name.startsWith(`${definition.product}_`)).toBe(true);
      }
      if (definition.feeds) {
        expect(names.has(definition.feeds)).toBe(true);
        const fed = listActivationEvents().find(
          (event) => event.name === definition.feeds,
        );
        expect(fed?.fedOnly).toBe(true);
      }
    }
  });
});

describe("emission gate", () => {
  it("sends only from production, lets an opt-in enable local development, and never sends from staging or test", () => {
    const cases = [
      [{ environment: "production" }, true],
      [{ environment: "staging", explicitOptIn: true }, false],
      [{ environment: "test", explicitOptIn: true }, false],
      [{ environment: "development", explicitOptIn: true }, true],
      [{ environment: "development" }, false],
      [{ isProduction: true }, true],
      [{ explicitOptIn: true }, true],
      [{}, false],
    ] as const;

    for (const [input, expected] of cases) {
      expect(
        isEmissionEnabled({
          isProduction: false,
          explicitOptIn: false,
          ...input,
        }),
      ).toBe(expected);
    }
  });
});

describe("process-env gate and server tracker", () => {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  afterEach(() => {
    process.env = { ...saved };
    globalThis.fetch = realFetch;
  });

  it("reads NODE_ENV at runtime when no deployment environment is set", () => {
    delete process.env.OPENPANEL_ENVIRONMENT;
    delete process.env.NEXT_PUBLIC_OPENPANEL_ENVIRONMENT;
    delete process.env.NEXT_PUBLIC_ENABLE_OPENPANEL;

    process.env.NODE_ENV = "production";
    expect(isEmissionEnabledFromProcessEnv()).toBe(true);
    process.env.NODE_ENV = "development";
    expect(isEmissionEnabledFromProcessEnv()).toBe(false);
  });

  it("does not attach an identified user to later events that name no profile", async () => {
    process.env.OPENPANEL_ENVIRONMENT = "production";
    const bodies: Array<{ type: string; payload: Record<string, unknown> }> =
      [];
    globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    const tracker = createServerTracker({
      clientId: "client",
      clientSecret: "secret",
    });
    tracker.identify({ profileId: "user_a" });
    tracker.track("system_event", { groups: ["org_b"] });
    await new Promise((resolve) => setTimeout(resolve, 10));

    const trackBody = bodies.find((body) => body.type === "track");
    expect(trackBody?.payload).not.toHaveProperty("profileId");
    expect(bodies.some((body) => body.type === "identify")).toBe(true);
  });
});
