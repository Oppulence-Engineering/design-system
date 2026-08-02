import { describe, expect, it } from "vitest";

import { IntervalService } from "./interval";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("IntervalService", () => {
  it("waits for the first interval by default", async () => {
    let runs = 0;
    const service = new IntervalService({
      intervalMs: 40,
      onInterval: async () => {
        runs += 1;
      },
    });

    service.start();
    expect(runs).toBe(0);

    await wait(100);
    service.stop();
    expect(runs).toBeGreaterThanOrEqual(1);
  });

  it("runs immediately on the leading edge", async () => {
    let runs = 0;
    const service = new IntervalService({
      intervalMs: 1_000,
      leadingEdge: true,
      onInterval: async () => {
        runs += 1;
      },
    });

    service.start();
    await wait(10);
    service.stop();

    expect(runs).toBe(1);
  });

  it("stops scheduling after stop", async () => {
    let runs = 0;
    const service = new IntervalService({
      intervalMs: 25,
      onInterval: async () => {
        runs += 1;
      },
    });

    service.start();
    await wait(120);
    service.stop();

    const atStop = runs;
    await wait(150);

    expect(runs).toBe(atStop);
  });

  it("ignores a second start", async () => {
    let runs = 0;
    const service = new IntervalService({
      intervalMs: 1_000,
      leadingEdge: true,
      onInterval: async () => {
        runs += 1;
      },
    });

    service.start();
    service.start();
    await wait(10);
    service.stop();

    expect(runs).toBe(1);
  });

  it("reports whether work was in flight when stopped", async () => {
    const service = new IntervalService({
      intervalMs: 1_000,
      leadingEdge: true,
      onInterval: async () => {
        await wait(60);
      },
    });

    service.start();
    await wait(10);
    expect(service.stop().isExecuting).toBe(true);

    await wait(80);
    expect(service.stop().isExecuting).toBe(false);
  });

  it("does not overlap executions", async () => {
    let inFlight = 0;
    let overlapped = false;
    const service = new IntervalService({
      intervalMs: 10,
      leadingEdge: true,
      onInterval: async () => {
        inFlight += 1;
        if (inFlight > 1) overlapped = true;
        await wait(40);
        inFlight -= 1;
      },
    });

    service.start();
    await wait(200);
    service.stop();
    await wait(80);

    expect(overlapped).toBe(false);
  });

  it("reports the current interval and updates it", () => {
    const service = new IntervalService({
      intervalMs: 30,
      onInterval: async () => {},
    });

    expect(service.intervalMs).toBe(30);
    service.updateInterval(60);
    expect(service.intervalMs).toBe(60);
  });

  /*
   * Restarting while a tick was still awaiting left two timers: `start`
   * scheduled one and the in-flight tick's `finally` scheduled another. Only
   * one is legitimate, and the orphan fired first — running earlier than the
   * work plus the interval, then cancelling the correct timer on its way in.
   */
  it("keeps the schedule after a stop and start mid-execution", async () => {
    const WORK = 30;
    const INTERVAL = 40;
    const ticks: number[] = [];
    const started = Date.now();

    const service = new IntervalService({
      intervalMs: INTERVAL,
      onInterval: async () => {
        ticks.push(Date.now() - started);
        await wait(WORK);
      },
    });

    service.start();
    await wait(INTERVAL + 10); // first tick is running
    service.stop();
    service.start();
    await wait(200);
    service.stop();
    await wait(WORK * 3);

    expect(ticks.length).toBeGreaterThanOrEqual(2);

    // Each tick starts a full interval after the previous one finished, so
    // consecutive starts sit at least WORK + INTERVAL apart, minus scheduler
    // slack.
    const gaps = ticks.slice(1).map((tick, index) => tick - ticks[index]!);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(WORK + INTERVAL - 15);
    }
  });
});
