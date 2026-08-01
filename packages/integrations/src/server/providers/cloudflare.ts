import Cloudflare from "cloudflare";
import { z } from "zod";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationApiKeyRuntime } from "../api-key-runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import { createIntegrationTypedRestProvider } from "../provider-rest";
import type { IntegrationProviderPack } from "../provider-pack";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputBoolean,
  optionalInputCsv,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
} from "./shared";

type CloudflareSdkClient = Record<string, unknown>;

type CloudflareClientFactory = (apiKey: string) => CloudflareSdkClient;

export interface CloudflareProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: CloudflareClientFactory;
}

function createCloudflareClient(apiKey: string): CloudflareSdkClient {
  return new Cloudflare({ apiToken: apiKey }) as unknown as CloudflareSdkClient;
}

const CLOUDFLARE_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "cloudflare",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

// cloudflare@7.0.0 exposes individual zone-setting reads but not the source
// action's complete zone-settings collection endpoint, so that one action is
// the SDK-first exception and runs on the typed REST lane.
const CLOUDFLARE_REST_OPERATION_ID = "cloudflare:get-zone-settings";

const CLOUDFLARE_SDK_REVIEW =
  "cloudflare@7.0.0 exposes per-setting zone reads (zones.settings.get) but no collection endpoint returning every zone setting in one response.";

const CLOUDFLARE_SDK_OPERATION_IDS = Object.freeze(
  CLOUDFLARE_OPERATION_IDS.filter(
    (operationId) => operationId !== CLOUDFLARE_REST_OPERATION_ID,
  ),
);

interface CloudflareSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function cloudflareRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): CloudflareSdkRequest {
  return { path, arguments: arguments_ };
}

function cloudflareZoneId(input: Readonly<Record<string, unknown>>): string {
  return requiredInputString(input, "zoneId", "zone_id");
}

function cloudflareCsv(
  input: Readonly<Record<string, unknown>>,
  field: string,
): string[] | undefined {
  return optionalInputCsv(input, field);
}

function cloudflareDnsRecord(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return definedFields({
    zone_id: cloudflareZoneId(input),
    type: requiredInputString(input, "type"),
    name: requiredInputString(input, "name"),
    content: requiredInputString(input, "content"),
    ttl: optionalInputNumber(input, "ttl"),
    proxied: optionalInputBoolean(input, "proxied"),
    priority: optionalInputNumber(input, "priority"),
    comment: optionalInputString(input, "comment"),
    tags: cloudflareCsv(input, "tags"),
  });
}

const CLOUDFLARE_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => CloudflareSdkRequest
  >
> = {
  "cloudflare:list-zones": (input) =>
    cloudflareRequest(
      ["zones", "list"],
      definedFields({
        name: optionalInputString(input, "name"),
        status: optionalInputString(input, "status"),
        page: optionalInputNumber(input, "page"),
        per_page: optionalInputNumber(input, "per_page"),
        order: optionalInputString(input, "order"),
        direction: optionalInputString(input, "direction"),
        match: optionalInputString(input, "match"),
        account: optionalInputString(input, "accountId")
          ? { id: optionalInputString(input, "accountId") }
          : undefined,
      }),
    ),
  "cloudflare:get-zone-details": (input) =>
    cloudflareRequest(["zones", "get"], { zone_id: cloudflareZoneId(input) }),
  "cloudflare:create-zone": (input) =>
    cloudflareRequest(
      ["zones", "create"],
      definedFields({
        name: requiredInputString(input, "name"),
        account: { id: requiredInputString(input, "accountId", "account_id") },
        type: optionalInputString(input, "type"),
      }),
    ),
  "cloudflare:delete-zone": (input) =>
    cloudflareRequest(["zones", "delete"], {
      zone_id: cloudflareZoneId(input),
    }),
  "cloudflare:list-dns-records": (input) =>
    cloudflareRequest(
      ["dns", "records", "list"],
      definedFields({
        zone_id: cloudflareZoneId(input),
        type: optionalInputString(input, "type"),
        name: optionalInputString(input, "name"),
        content: optionalInputString(input, "content"),
        page: optionalInputNumber(input, "page"),
        per_page: optionalInputNumber(input, "per_page"),
        direction: optionalInputString(input, "direction"),
        match: optionalInputString(input, "match"),
        order: optionalInputString(input, "order"),
        proxied: optionalInputBoolean(input, "proxied"),
        search: optionalInputString(input, "search"),
        tag: optionalInputString(input, "tag"),
        tag_match: optionalInputString(input, "tag_match"),
        comment: optionalInputString(input, "commentFilter"),
      }),
    ),
  "cloudflare:create-dns-record": (input) =>
    cloudflareRequest(["dns", "records", "create"], cloudflareDnsRecord(input)),
  "cloudflare:update-dns-record": (input) =>
    cloudflareRequest(
      ["dns", "records", "edit"],
      requiredInputString(input, "recordId", "record_id"),
      cloudflareDnsRecord(input),
    ),
  "cloudflare:delete-dns-record": (input) =>
    cloudflareRequest(
      ["dns", "records", "delete"],
      requiredInputString(input, "recordId", "record_id"),
      { zone_id: cloudflareZoneId(input) },
    ),
  "cloudflare:list-certificates": (input) =>
    cloudflareRequest(
      ["ssl", "certificatePacks", "list"],
      definedFields({
        zone_id: cloudflareZoneId(input),
        status: optionalInputString(input, "status"),
        page: optionalInputNumber(input, "page"),
        per_page: optionalInputNumber(input, "per_page"),
        deploy: optionalInputBoolean(input, "deploy"),
      }),
    ),
  "cloudflare:update-zone-setting": (input) =>
    cloudflareRequest(
      ["zones", "settings", "edit"],
      requiredInputString(input, "settingId", "setting_id"),
      {
        zone_id: cloudflareZoneId(input),
        value: input.value,
      },
    ),
  "cloudflare:dns-analytics": (input) =>
    cloudflareRequest(
      ["dns", "analytics", "reports", "get"],
      definedFields({
        zone_id: cloudflareZoneId(input),
        since: optionalInputString(input, "since"),
        until: optionalInputString(input, "until"),
        metrics: optionalInputString(input, "metrics"),
        dimensions: optionalInputString(input, "dimensions"),
        filters: optionalInputString(input, "filters"),
        sort: cloudflareCsv(input, "sort"),
        limit: optionalInputNumber(input, "limit"),
      }),
    ),
  "cloudflare:purge-cache": (input) => {
    const purgeEverything = optionalInputBoolean(input, "purge_everything");
    const targets = definedFields({
      files: cloudflareCsv(input, "files"),
      tags: cloudflareCsv(input, "tags"),
      hosts: cloudflareCsv(input, "hosts"),
      prefixes: cloudflareCsv(input, "prefixes"),
    });
    if (!purgeEverything && Object.keys(targets).length === 0) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return cloudflareRequest(
      ["cache", "purge"],
      definedFields({
        zone_id: cloudflareZoneId(input),
        purge_everything: purgeEverything || undefined,
        ...targets,
      }),
    );
  },
};

function assertCloudflareOperationCoverage(): void {
  const expected = new Set(CLOUDFLARE_SDK_OPERATION_IDS);
  const implemented = Object.keys(CLOUDFLARE_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Cloudflare provider SDK operation coverage is incomplete.",
    );
  }
}

/**
 * Executes Cloudflare actions exposed by Cloudflare's official SDK. A missing
 * SDK method remains catalogue-only instead of falling back to raw REST.
 */
export function createCloudflareProviderSdk(
  config: CloudflareProviderSdkConfig,
): IntegrationProviderSdk {
  assertCloudflareOperationCoverage();
  const clientFactory = config.clientFactory ?? createCloudflareClient;
  return {
    integrationId: "cloudflare",
    operationIds: CLOUDFLARE_SDK_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "cloudflare" ||
        invocation.reference.integrationId !== "cloudflare"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        CLOUDFLARE_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await invokeSdkMethod(
            clientFactory(credential.apiKey),
            requestFactory(invocation.input),
          ),
        }),
      );
    },
  };
}

export function getCloudflareProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertCloudflareOperationCoverage();
  return {
    operations: CLOUDFLARE_SDK_OPERATION_IDS.length,
    operationIds: CLOUDFLARE_SDK_OPERATION_IDS,
  };
}

export interface CloudflareZoneSettingsProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "request">;
}

/**
 * Reads the whole zone-settings collection, which the official SDK models only
 * one setting at a time. Cloudflare's API-key profile resolves this relative
 * path against `https://api.cloudflare.com/client/v4`.
 */
export function createCloudflareZoneSettingsProviderSdk(
  config: CloudflareZoneSettingsProviderSdkConfig,
): IntegrationProviderSdk {
  return createIntegrationTypedRestProvider({
    integrationId: "cloudflare",
    transport: { kind: "api_key", runtime: config.apiKeyRuntime },
    tools: [
      {
        id: CLOUDFLARE_REST_OPERATION_ID,
        name: "Get Zone Settings",
        description:
          "Gets all settings for a zone including SSL mode, caching level, and security settings.",
        version: "1.0.0",
        params: {
          zoneId: { type: "string", required: true, visibility: "user-or-llm" },
        },
        request: {
          method: "GET",
          url: (input) => `/zones/${encodeURIComponent(input.zoneId)}/settings`,
          headers: () => ({ accept: "application/json" }),
          retry: { enabled: true },
        },
        inputSchema: z.object({ zoneId: z.string().min(1) }).strict(),
        // A zone returns well over a hundred settings.
        maxResponseBytes: 512 * 1024,
        outputSchema: z
          .object({
            success: z.boolean(),
            result: z.array(
              z
                .object({
                  id: z.string(),
                  value: z.unknown().optional(),
                  editable: z.boolean().optional(),
                  modified_on: z.string().nullable().optional(),
                })
                .loose(),
            ),
            errors: z.array(z.unknown()).optional(),
            messages: z.array(z.unknown()).optional(),
          })
          .strict(),
      },
    ],
  });
}

/**
 * Cloudflare's complete delivery unit: the official SDK for every action it
 * models, plus the typed REST lane for the zone-settings collection read.
 */
export function createCloudflarePack(): IntegrationProviderPack {
  return {
    integrationId: "cloudflare",
    coverage: CLOUDFLARE_OPERATION_IDS.map((sourceOperationId) =>
      sourceOperationId === CLOUDFLARE_REST_OPERATION_ID
        ? {
            sourceOperationId,
            lane: "typed_rest" as const,
            disposition: "supported" as const,
            sdkReview: CLOUDFLARE_SDK_REVIEW,
          }
        : {
            sourceOperationId,
            lane: "sdk" as const,
            disposition: "supported" as const,
          },
    ),
    triggerCoverage: [],
    create(context) {
      if (!context.apiKeyRuntime) return [];
      return [
        createCloudflareProviderSdk({ apiKeyRuntime: context.apiKeyRuntime }),
        createCloudflareZoneSettingsProviderSdk({
          apiKeyRuntime: context.apiKeyRuntime,
        }),
      ];
    },
  };
}
