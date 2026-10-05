import { describe, expect, it } from "bun:test";
import {
  ACTIVATION_EVENTS,
  createActivationTracker,
  listActivationEvents,
} from "../src/activation";
import { isEmissionEnabled } from "../src/gate";
import type { ServerTracker, TrackProperties } from "../src/server-tracker";

type Call =
  | { kind: "track"; name: string; properties?: TrackProperties }
  | { kind: "group"; payload: unknown };

const recordingTracker = (options: { throws?: boolean } = {}) => {
  const calls: Call[] = [];
  const tracker: ServerTracker = {
    enabled: true,
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
  it("sends the product event and the shared lifecycle event it feeds, grouped by workspace", () => {
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
      });
    }
    expect(calls[1]).toMatchObject({
      properties: {
        outcome: "conduitt_first_payment_recovered",
        event_version: ACTIVATION_EVENTS.first_valuable_outcome.version,
      },
    });
  });

  it("sends nothing outside production", () => {
    for (const environment of ["staging", "development", "test"] as const) {
      const { calls, tracker } = recordingTracker();
      const activation = createActivationTracker({
        tracker,
        product: "eigenn",
        environment,
      });

      const result = activation.track("eigenn_first_scenario_created", {
        workspaceId: "team_1",
        occurredAt,
        properties: { scenario_id: "sc_1" },
      });

      expect(result).toEqual({ sent: false, reason: "environment" });
      expect(calls).toEqual([]);
    }
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
        occurredAt,
        properties,
      });
      expect(result).toEqual({ sent: false, reason: "invalid_properties" });
    }
    expect(
      activation.track("conduitt_first_payment_recovered", {
        workspaceId: "",
        occurredAt,
        properties: base,
      }),
    ).toEqual({ sent: false, reason: "invalid_properties" });
    expect(calls).toEqual([]);
  });

  it("refuses another product's event and events with no persisted state", () => {
    const { calls, tracker } = recordingTracker();
    const activation = createActivationTracker({
      tracker,
      product: "conduitt",
      environment: "production",
    });

    const crossProduct = activation.track(
      // @ts-expect-error an Eigenn event is not trackable by the Conduitt tracker
      "eigenn_first_scenario_created",
      { workspaceId: "org_1", occurredAt, properties: { scenario_id: "s" } },
    );
    const uninstrumented = createActivationTracker({
      tracker,
      product: "eigenn",
      environment: "production",
    }).track(
      // @ts-expect-error not_instrumented events have no backing record yet
      "eigenn_first_plan_committed",
      { workspaceId: "team_1", occurredAt, properties: {} },
    );

    expect(crossProduct).toEqual({ sent: false, reason: "wrong_product" });
    expect(uninstrumented).toEqual({ sent: false, reason: "not_instrumented" });
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
        occurredAt,
        properties: {},
      }),
    ).toEqual({ sent: false, reason: "transport_error" });
  });

  it("upserts the workspace group with only allow-listed properties", () => {
    const { calls, tracker } = recordingTracker();
    const activation = createActivationTracker({
      tracker,
      product: "eigenn",
      environment: "production",
    });

    activation.upsertWorkspace({
      workspaceId: "team_1",
      name: "Acme",
      properties: {
        plan: "growth",
        trial_state: "trialing",
        // @ts-expect-error unknown keys are not part of the group contract
        owner_email: "ceo@acme.com",
      },
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
            trial_state: "trialing",
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
        expect(ACTIVATION_EVENTS[definition.feeds].product).toBe("shared");
      }
    }
  });
});

describe("emission gate", () => {
  it("lets the deployment environment override a production build", () => {
    expect(
      isEmissionEnabled({
        isProduction: true,
        explicitOptIn: false,
        environment: "staging",
      }),
    ).toBe(false);
    expect(
      isEmissionEnabled({
        isProduction: true,
        explicitOptIn: false,
        environment: "production",
      }),
    ).toBe(true);
    expect(
      isEmissionEnabled({ isProduction: true, explicitOptIn: false }),
    ).toBe(true);
    expect(
      isEmissionEnabled({
        isProduction: false,
        explicitOptIn: true,
        environment: "development",
      }),
    ).toBe(true);
  });
});
