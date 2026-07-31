import { describe, expect, test } from "bun:test";

import { buildIntegrationDirectory } from "../src/connection";
import { IntegrationDirectoryLoaderController } from "../src/react-controller";

const directory = buildIntegrationDirectory({
  product: "eigenn",
  connections: [],
});

describe("React directory loader controller", () => {
  test("reports loading, errors, and refreshes through a product-owned loader", async () => {
    let calls = 0;
    const controller = new IntegrationDirectoryLoaderController(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("Safe loader failure");
      }
      return directory;
    });
    const states: boolean[] = [];
    controller.subscribe((state) => states.push(state.isLoading));

    await controller.refresh();
    expect(controller.state.isLoading).toBeFalse();
    expect(controller.state.error?.message).toBe("Safe loader failure");

    await controller.state.refresh();
    expect(controller.state.isLoading).toBeFalse();
    expect(controller.state.error).toBeUndefined();
    expect(controller.state.directory).toBe(directory);
    expect(states).toEqual([true, false, true, false]);
  });

  test("cancels stale requests and never publishes after disposal", async () => {
    let resolveFirst: ((value: typeof directory) => void) | undefined;
    let firstSignal: AbortSignal | undefined;
    const first = new Promise<typeof directory>((resolve) => {
      resolveFirst = resolve;
    });
    const controller = new IntegrationDirectoryLoaderController(
      ({ signal } = {}) => {
        firstSignal = signal;
        return first;
      },
    );
    const states: boolean[] = [];
    controller.subscribe((state) => states.push(state.isLoading));

    const pending = controller.refresh();
    controller.dispose();
    resolveFirst!(directory);
    await pending;

    expect(firstSignal?.aborted).toBeTrue();
    expect(states).toEqual([true]);
  });
});
