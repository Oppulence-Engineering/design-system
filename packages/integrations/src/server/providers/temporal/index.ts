import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import { requireOptionalSdk } from "../shared/optional-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  requiredInputString,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  requiredVendorField,
  vendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";


function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/**
 * Temporal is handle-based: the client resolves a workflow or schedule to a
 * handle, and the handle carries the actions. Like Reddit, every action uses
 * the executor's invoke hook rather than a dotted path.
 */
interface TemporalClient extends SdkMethodTarget {
  workflow: {
    start(
      workflowType: string,
      options: Record<string, unknown>,
    ): Promise<unknown>;
    signalWithStart(
      workflowType: string,
      options: Record<string, unknown>,
    ): Promise<unknown>;
    getHandle(workflowId: string, runId?: string): TemporalWorkflowHandle;
    list(options?: Record<string, unknown>): AsyncIterable<unknown>;
    count(query?: string): Promise<unknown>;
  };
  schedule: {
    create(options: Record<string, unknown>): Promise<unknown>;
    list(options?: Record<string, unknown>): AsyncIterable<unknown>;
    getHandle(scheduleId: string): TemporalScheduleHandle;
  };
  taskQueue: {
    describe(taskQueue: string, options?: unknown): Promise<unknown>;
  };
  workflowService: {
    resetWorkflowExecution(request: unknown): Promise<unknown>;
  };
  namespace: string;
}

interface TemporalWorkflowHandle {
  signal(name: string, ...args: unknown[]): Promise<unknown>;
  query(name: string, ...args: unknown[]): Promise<unknown>;
  executeUpdate(name: string, options?: unknown): Promise<unknown>;
  describe(): Promise<unknown>;
  fetchHistory(): Promise<unknown>;
  cancel(): Promise<unknown>;
  terminate(reason?: string): Promise<unknown>;
}

interface TemporalScheduleHandle {
  describe(): Promise<unknown>;
  pause(note?: string): Promise<unknown>;
  unpause(note?: string): Promise<unknown>;
  trigger(overlap?: unknown): Promise<unknown>;
  delete(): Promise<unknown>;
}

/** A workflow, schedule, or task-queue ID is a user-chosen string. */
function temporalId(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  // Temporal IDs are caller-chosen, but they travel in gRPC metadata and
  // visibility queries, so control characters and whitespace are rejected.
  if (value.length > 1_000 || !/^[\u0021-\u007E]+$/u.test(value)) {
    throw invocationError();
  }
  return value;
}

function client(target: SdkMethodTarget): TemporalClient {
  return target as unknown as TemporalClient;
}

function workflowHandle(
  target: SdkMethodTarget,
  input: VendorInput,
): TemporalWorkflowHandle {
  return client(target).workflow.getHandle(
    temporalId(input, "workflowId"),
    optionalInputString(input, "runId"),
  );
}

function scheduleHandle(
  target: SdkMethodTarget,
  input: VendorInput,
): TemporalScheduleHandle {
  return client(target).schedule.getHandle(temporalId(input, "scheduleId"));
}

/** Workflow and activity arguments arrive as an array. */
function workflowArgs(input: VendorInput): unknown[] {
  const args = input.args ?? input.arguments ?? input.input;
  if (args === undefined) return [];
  if (!Array.isArray(args) || args.length > 64) throw invocationError();
  return args;
}

/** Collects a bounded page from Temporal's async listing iterators. */
async function collect(
  iterable: AsyncIterable<unknown>,
  limit: number,
): Promise<unknown> {
  const items: unknown[] = [];
  for await (const item of iterable) {
    items.push(item);
    if (items.length >= limit) break;
  }
  return { items, count: items.length, truncated: items.length >= limit };
}

function startOptions(input: VendorInput): Record<string, unknown> {
  return definedFields({
    workflowId: temporalId(input, "workflowId"),
    taskQueue: temporalId(input, "taskQueue"),
    args: workflowArgs(input),
    memo: optionalInputRecord(input, "memo"),
    searchAttributes: optionalInputRecord(input, "searchAttributes"),
    workflowExecutionTimeout: optionalInputString(input, "executionTimeout"),
    workflowRunTimeout: optionalInputString(input, "runTimeout"),
  });
}

const TEMPORAL_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "temporal:start-workflow": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target).workflow.start(
        temporalId(input, "workflowType", "type"),
        startOptions(input),
      ),
  },
  "temporal:signal-with-start": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target).workflow.signalWithStart(
        temporalId(input, "workflowType", "type"),
        {
          ...startOptions(input),
          signal: temporalId(input, "signalName", "signal"),
          signalArgs: input.signalArgs ?? [],
        },
      ),
  },
  "temporal:signal-workflow": {
    path: [],
    invoke: async ({ client: target, input }) => {
      await workflowHandle(target, input).signal(
        temporalId(input, "signalName", "signal"),
        ...workflowArgs(input),
      );
      return { workflowId: temporalId(input, "workflowId"), signalled: true };
    },
  },
  "temporal:query-workflow": {
    path: [],
    invoke: ({ client: target, input }) =>
      workflowHandle(target, input).query(
        temporalId(input, "queryName", "query"),
        ...workflowArgs(input),
      ),
  },
  "temporal:update-workflow": {
    path: [],
    invoke: ({ client: target, input }) =>
      // Unlike a signal, an update is validated and returns a result.
      workflowHandle(target, input).executeUpdate(
        temporalId(input, "updateName", "update"),
        { args: workflowArgs(input) },
      ),
  },
  "temporal:describe-workflow": {
    path: [],
    invoke: ({ client: target, input }) =>
      workflowHandle(target, input).describe(),
  },
  "temporal:get-workflow-history": {
    path: [],
    invoke: ({ client: target, input }) =>
      workflowHandle(target, input).fetchHistory(),
  },
  "temporal:cancel-workflow": {
    path: [],
    invoke: async ({ client: target, input }) => {
      // Cancellation is cooperative: the workflow decides how to respond.
      await workflowHandle(target, input).cancel();
      return {
        workflowId: temporalId(input, "workflowId"),
        cancellationRequested: true,
      };
    },
  },
  "temporal:terminate-workflow": {
    path: [],
    invoke: async ({ client: target, input }) => {
      await workflowHandle(target, input).terminate(
        optionalInputString(input, "reason"),
      );
      return { workflowId: temporalId(input, "workflowId"), terminated: true };
    },
  },
  "temporal:reset-workflow": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target).workflowService.resetWorkflowExecution({
        namespace: client(target).namespace,
        workflowExecution: {
          workflowId: temporalId(input, "workflowId"),
          runId: optionalInputString(input, "runId"),
        },
        workflowTaskFinishEventId: optionalInputNumber(input, "eventId") ?? 3,
        reason:
          optionalInputString(input, "reason") ??
          "Reset through the Oppulence integration.",
      }),
  },
  "temporal:list-workflows": {
    path: [],
    invoke: ({ client: target, input }) =>
      collect(
        client(target).workflow.list(
          definedFields({ query: optionalInputString(input, "query") }),
        ),
        optionalInputNumber(input, "limit") ?? 100,
      ),
  },
  "temporal:count-workflows": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target).workflow.count(optionalInputString(input, "query")),
  },
  "temporal:describe-task-queue": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target).taskQueue.describe(temporalId(input, "taskQueue")),
  },
  "temporal:create-schedule": {
    path: [],
    invoke: ({ client: target, input }) =>
      client(target).schedule.create({
        scheduleId: temporalId(input, "scheduleId"),
        spec: optionalInputRecord(input, "spec") ?? {
          cronExpressions: [requiredInputString(input, "cron")],
        },
        action: {
          type: "startWorkflow",
          workflowType: temporalId(input, "workflowType", "type"),
          taskQueue: temporalId(input, "taskQueue"),
          args: workflowArgs(input),
        },
      }),
  },
  "temporal:list-schedules": {
    path: [],
    invoke: ({ client: target, input }) =>
      collect(
        client(target).schedule.list(),
        optionalInputNumber(input, "limit") ?? 100,
      ),
  },
  "temporal:describe-schedule": {
    path: [],
    invoke: ({ client: target, input }) =>
      scheduleHandle(target, input).describe(),
  },
  "temporal:pause-schedule": {
    path: [],
    invoke: async ({ client: target, input }) => {
      await scheduleHandle(target, input).pause(
        optionalInputString(input, "note"),
      );
      return { scheduleId: temporalId(input, "scheduleId"), paused: true };
    },
  },
  "temporal:unpause-schedule": {
    path: [],
    invoke: async ({ client: target, input }) => {
      await scheduleHandle(target, input).unpause(
        optionalInputString(input, "note"),
      );
      return { scheduleId: temporalId(input, "scheduleId"), paused: false };
    },
  },
  "temporal:trigger-schedule": {
    path: [],
    invoke: async ({ client: target, input }) => {
      await scheduleHandle(target, input).trigger(
        optionalInputString(input, "overlap"),
      );
      return { scheduleId: temporalId(input, "scheduleId"), triggered: true };
    },
  },
  "temporal:delete-schedule": {
    path: [],
    invoke: async ({ client: target, input }) => {
      // Workflows the schedule already started keep running.
      await scheduleHandle(target, input).delete();
      return { scheduleId: temporalId(input, "scheduleId"), deleted: true };
    },
  },
};

/**
 * Temporal Cloud authenticates with an API key over TLS and addresses a
 * namespace on a regional gRPC endpoint. Both the address and the namespace
 * are non-secret connection state, held beside the key.
 */
export const createTemporalClient: VendorClientFactory = (credential) => {
  const { Client, Connection } = requireOptionalSdk("@temporalio/client") as {
    Client: new (options: Record<string, unknown>) => TemporalClient;
    Connection: { lazy(options: Record<string, unknown>): unknown };
  };
  const namespace = requiredVendorField(credential, "namespace");
  const connection = Connection.lazy({
    address: requiredVendorField(credential, "address"),
    tls: vendorField(credential, "tls") === "false" ? false : {},
    apiKey: vendorToken(credential),
  });
  return Object.assign(new Client({ connection, namespace }), {
    namespace,
  }) as unknown as SdkMethodTarget;
};

export function createTemporalPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "temporal",
    driver: "@temporalio/client@1.21.1",
    transportKind: "api_key",
    operations: TEMPORAL_OPERATIONS,
    clientFactory: options.clientFactory ?? createTemporalClient,
  });
}
