import { createRequire } from "node:module";

import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputNumber,
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

const datadogRequire = createRequire(import.meta.url);

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/** Datadog timestamps are Unix seconds. */
function unixSeconds(input: VendorInput, ...names: string[]): number {
  const value = requiredInputNumber(input, names[0]);
  if (!Number.isSafeInteger(value) || value < 0) throw invocationError();
  return value;
}

const DATADOG_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "datadog:submit-metrics": {
    path: ["metricsV2", "submitMetrics"],
    params: (input) => [
      {
        body: {
          series: [
            definedFields({
              metric: requiredInputString(input, "metric", "name"),
              type: optionalInputNumber(input, "type") ?? 0,
              points: [
                {
                  timestamp:
                    optionalInputNumber(input, "timestamp") ??
                    Math.floor(Date.now() / 1_000),
                  value: requiredInputNumber(input, "value"),
                },
              ],
              tags: optionalInputStringArray(input, "tags"),
              resources: optionalInputStringArray(input, "resources")?.map(
                (name) => ({ name, type: "host" }),
              ),
            }),
          ],
        },
      },
    ],
  },
  "datadog:query-timeseries": {
    path: ["metrics", "queryMetrics"],
    params: (input) => [
      {
        from: unixSeconds(input, "from"),
        to: unixSeconds(input, "to"),
        query: requiredInputString(input, "query"),
      },
    ],
  },
  "datadog:create-event": {
    path: ["events", "createEvent"],
    params: (input) => [
      {
        body: definedFields({
          title: requiredInputString(input, "title"),
          text: requiredInputString(input, "text"),
          alertType: optionalInputString(input, "alertType"),
          priority: optionalInputString(input, "priority"),
          tags: optionalInputStringArray(input, "tags"),
          aggregationKey: optionalInputString(input, "aggregationKey"),
        }),
      },
    ],
  },
  "datadog:create-monitor": {
    path: ["monitors", "createMonitor"],
    params: (input) => [
      {
        body: definedFields({
          name: requiredInputString(input, "name"),
          type: requiredInputString(input, "type"),
          query: requiredInputString(input, "query"),
          message: optionalInputString(input, "message"),
          tags: optionalInputStringArray(input, "tags"),
          options: optionalInputRecord(input, "options"),
        }),
      },
    ],
  },
  "datadog:get-monitor": {
    path: ["monitors", "getMonitor"],
    params: (input) => [{ monitorId: requiredInputNumber(input, "monitorId") }],
  },
  "datadog:list-monitors": {
    path: ["monitors", "listMonitors"],
    params: (input) => [
      definedFields({
        name: optionalInputString(input, "name"),
        tags: optionalInputStringArray(input, "tags")?.join(","),
        page: optionalInputNumber(input, "page"),
        pageSize: optionalInputNumber(input, "pageSize", "limit"),
      }),
    ],
  },
  "datadog:mute-monitor": {
    path: ["monitors", "updateMonitor"],
    params: (input) => [
      {
        monitorId: requiredInputNumber(input, "monitorId"),
        body: {
          options: {
            // A muted monitor still evaluates; it just stops notifying.
            silenced: input.unmute === true ? {} : { "*": null },
          },
        },
      },
    ],
  },
  "datadog:query-logs": {
    path: ["logsV2", "listLogs"],
    params: (input) => [
      {
        body: {
          filter: definedFields({
            query: requiredInputString(input, "query"),
            from: optionalInputString(input, "from") ?? "now-15m",
            to: optionalInputString(input, "to") ?? "now",
          }),
          page: definedFields({
            limit: optionalInputNumber(input, "limit") ?? 50,
            cursor: optionalInputString(input, "cursor"),
          }),
        },
      },
    ],
  },
  "datadog:send-logs": {
    path: ["logs", "submitLog"],
    params: (input) => [
      {
        body: [
          definedFields({
            message: requiredInputString(input, "message"),
            ddsource: optionalInputString(input, "source", "ddsource"),
            ddtags: optionalInputStringArray(input, "tags")?.join(","),
            hostname: optionalInputString(input, "hostname"),
            service: optionalInputString(input, "service"),
          }),
        ],
      },
    ],
  },
  "datadog:create-downtime": {
    path: ["downtimes", "createDowntime"],
    params: (input) => [
      {
        body: {
          data: {
            type: "downtime",
            attributes: definedFields({
              scope: requiredInputString(input, "scope"),
              message: optionalInputString(input, "message"),
              schedule: {
                start: optionalInputString(input, "start"),
                end: optionalInputString(input, "end"),
              },
            }),
          },
        },
      },
    ],
  },
  "datadog:list-downtimes": {
    path: ["downtimes", "listDowntimes"],
    params: (input) => [
      definedFields({
        currentOnly: input.currentOnly === true ? true : undefined,
        pageLimit: optionalInputNumber(input, "limit", "pageLimit"),
      }),
    ],
  },
  "datadog:cancel-downtime": {
    path: ["downtimes", "cancelDowntime"],
    params: (input) => [
      { downtimeId: requiredInputString(input, "downtimeId") },
    ],
    output: (_v, input) => ({
      downtimeId: requiredInputString(input, "downtimeId"),
      cancelled: true,
    }),
  },
};

/**
 * Datadog authenticates with an API key plus an application key, and the site
 * differs per region. All three live in the credential envelope; the site is a
 * non-secret deployment value, but sending a key to the wrong region would
 * leak it, so it is not accepted as operation input.
 */
export const createDatadogClient: VendorClientFactory = (credential) => {
  const { client, v1, v2 } = datadogRequire("@datadog/datadog-api-client") as {
    client: {
      createConfiguration(options: Record<string, unknown>): unknown;
      setServerVariables(
        configuration: unknown,
        variables: Record<string, string>,
      ): void;
    };
    v1: Record<string, new (configuration: unknown) => unknown>;
    v2: Record<string, new (configuration: unknown) => unknown>;
  };
  const configuration = client.createConfiguration({
    authMethods: {
      apiKeyAuth: vendorToken(credential),
      appKeyAuth: requiredVendorField(credential, "applicationKey"),
    },
  });
  const site = vendorField(credential, "site");
  if (site) {
    client.setServerVariables(configuration, { site });
  }
  // Each source action names the API group it belongs to; the client is a
  // façade that constructs the matching versioned API on first use.
  const apis: Record<string, unknown> = {};
  const resolve = (group: string): unknown => {
    if (!(group in apis)) {
      const name = `${group.replace(/V2$/u, "")[0].toUpperCase()}${group.replace(/V2$/u, "").slice(1)}Api`;
      const Api =
        group.endsWith("V2") || group === "logsV2" || group === "metricsV2"
          ? v2[name]
          : (v1[name] ?? v2[name]);
      if (typeof Api !== "function") {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
        );
      }
      apis[group] = new Api(configuration);
    }
    return apis[group];
  };
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, group: string) => resolve(group),
  });
};

export function createDatadogPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "datadog",
    driver: "@datadog/datadog-api-client@1.60.0",
    transportKind: "api_key",
    operations: DATADOG_OPERATIONS,
    clientFactory: options.clientFactory ?? createDatadogClient,
  });
}
