import { Buffer } from "node:buffer";
import Firecrawl from "@mendable/firecrawl-js";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationApiKeyRuntime } from "../../runtime/api-key";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputBoolean,
  optionalInputJson,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
} from "../shared/sdk";

type FirecrawlSdkClient = Record<string, unknown>;

type FirecrawlClientFactory = (apiKey: string) => FirecrawlSdkClient;

export interface FirecrawlProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: FirecrawlClientFactory;
  /** Maximum decoded size accepted for a document parsing upload. */
  maxFileBytes?: number;
}

function createFirecrawlClient(apiKey: string): FirecrawlSdkClient {
  return new Firecrawl({ apiKey }) as unknown as FirecrawlSdkClient;
}

const FIRECRAWL_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "firecrawl",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface FirecrawlSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function firecrawlRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): FirecrawlSdkRequest {
  return { path, arguments: arguments_ };
}

function firecrawlJsonObject(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): Record<string, unknown> | undefined {
  const value = optionalInputJson(input, ...names);
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value as Record<string, unknown>;
}

function firecrawlStringArray(
  input: Readonly<Record<string, unknown>>,
  name: string,
): string[] | undefined {
  const value = input[name];
  if (value === undefined || value === null || value === "") return undefined;
  const parsed =
    typeof value === "string" && value.trim().startsWith("[")
      ? optionalInputJson(input, name)
      : value;
  const values = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "string"
      ? parsed.split(/[,\n]/u)
      : undefined;
  if (
    !values ||
    values.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return values.map((entry) => entry.trim());
}

function requiredFirecrawlUrls(
  input: Readonly<Record<string, unknown>>,
): string[] {
  const urls = firecrawlStringArray(input, "urls");
  if (!urls?.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return urls;
}

function firecrawlOptionalInteger(
  input: Readonly<Record<string, unknown>>,
  name: string,
  minimum = 1,
): number | undefined {
  const value = optionalInputNumber(input, name);
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < minimum) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

function firecrawlScrapeOptions(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const inherited = firecrawlJsonObject(input, "scrapeOptions") ?? {};
  return definedFields({
    ...inherited,
    formats: optionalInputJson(input, "formats") ?? inherited.formats,
    onlyMainContent:
      optionalInputBoolean(input, "onlyMainContent") ??
      inherited.onlyMainContent,
    includeTags:
      firecrawlStringArray(input, "includeTags") ?? inherited.includeTags,
    excludeTags:
      firecrawlStringArray(input, "excludeTags") ?? inherited.excludeTags,
    maxAge: firecrawlOptionalInteger(input, "maxAge", 0) ?? inherited.maxAge,
    headers: firecrawlJsonObject(input, "headers") ?? inherited.headers,
    waitFor: firecrawlOptionalInteger(input, "waitFor", 0) ?? inherited.waitFor,
    mobile: optionalInputBoolean(input, "mobile") ?? inherited.mobile,
    skipTlsVerification:
      optionalInputBoolean(input, "skipTlsVerification") ??
      inherited.skipTlsVerification,
    timeout: firecrawlOptionalInteger(input, "timeout", 1) ?? inherited.timeout,
    parsers: optionalInputJson(input, "parsers") ?? inherited.parsers,
    actions: optionalInputJson(input, "actions") ?? inherited.actions,
    location: firecrawlJsonObject(input, "location") ?? inherited.location,
    removeBase64Images:
      optionalInputBoolean(input, "removeBase64Images") ??
      inherited.removeBase64Images,
    blockAds: optionalInputBoolean(input, "blockAds") ?? inherited.blockAds,
    proxy: optionalInputString(input, "proxy") ?? inherited.proxy,
    storeInCache:
      optionalInputBoolean(input, "storeInCache") ?? inherited.storeInCache,
    zeroDataRetention:
      optionalInputBoolean(input, "zeroDataRetention") ??
      inherited.zeroDataRetention,
  });
}

function firecrawlFile(
  input: Readonly<Record<string, unknown>>,
  maximumBytes: number,
): Record<string, unknown> {
  const rawFile = input.file;
  if (!rawFile || typeof rawFile !== "object" || Array.isArray(rawFile)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const file = rawFile as Record<string, unknown>;
  const encoded = optionalInputString(file, "base64", "data", "content");
  if (!encoded || !/^[A-Za-z0-9+/_=-]*$/u.test(encoded)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const data = Buffer.from(encoded, "base64");
  if (!data.byteLength || data.byteLength > maximumBytes) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return {
    data,
    filename: optionalInputString(file, "filename", "name") ?? "document",
    contentType:
      optionalInputString(file, "mimeType", "contentType", "type") ??
      "application/octet-stream",
  };
}

const FIRECRAWL_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (
      input: Readonly<Record<string, unknown>>,
      maximumFileBytes: number,
    ) => FirecrawlSdkRequest
  >
> = {
  "firecrawl:scrape": (input) =>
    firecrawlRequest(
      ["scrape"],
      requiredInputString(input, "url"),
      firecrawlScrapeOptions(input),
    ),
  "firecrawl:batch-scrape": (input) =>
    firecrawlRequest(
      ["startBatchScrape"],
      requiredFirecrawlUrls(input),
      definedFields({
        options: firecrawlScrapeOptions(input),
        maxConcurrency: firecrawlOptionalInteger(input, "maxConcurrency"),
        ignoreInvalidURLs: optionalInputBoolean(input, "ignoreInvalidURLs"),
        zeroDataRetention: optionalInputBoolean(input, "zeroDataRetention"),
      }),
    ),
  "firecrawl:batch-scrape-status": (input) =>
    firecrawlRequest(
      ["getBatchScrapeStatus"],
      requiredInputString(input, "jobId"),
    ),
  "firecrawl:search": (input) =>
    firecrawlRequest(
      ["search"],
      requiredInputString(input, "query"),
      definedFields({
        limit: firecrawlOptionalInteger(input, "limit"),
        sources: optionalInputJson(input, "sources"),
        categories: optionalInputJson(input, "categories"),
        tbs: optionalInputString(input, "tbs"),
        location: firecrawlJsonObject(input, "location"),
        country: optionalInputString(input, "country"),
        timeout: firecrawlOptionalInteger(input, "timeout", 1),
        ignoreInvalidURLs: optionalInputBoolean(input, "ignoreInvalidURLs"),
        scrapeOptions: firecrawlJsonObject(input, "scrapeOptions"),
      }),
    ),
  "firecrawl:crawl": (input) =>
    firecrawlRequest(
      ["startCrawl"],
      requiredInputString(input, "url"),
      definedFields({
        limit: firecrawlOptionalInteger(input, "limit"),
        maxDiscoveryDepth:
          firecrawlOptionalInteger(input, "maxDiscoveryDepth") ??
          firecrawlOptionalInteger(input, "maxDepth"),
        excludePaths: firecrawlStringArray(input, "excludePaths"),
        includePaths: firecrawlStringArray(input, "includePaths"),
        scrapeOptions: firecrawlScrapeOptions(input),
        prompt: optionalInputString(input, "prompt"),
        sitemap: optionalInputString(input, "sitemap"),
        crawlEntireDomain: optionalInputBoolean(input, "crawlEntireDomain"),
        allowExternalLinks: optionalInputBoolean(input, "allowExternalLinks"),
        allowSubdomains: optionalInputBoolean(input, "allowSubdomains"),
        ignoreQueryParameters: optionalInputBoolean(
          input,
          "ignoreQueryParameters",
        ),
        delay: firecrawlOptionalInteger(input, "delay", 0),
        maxConcurrency: firecrawlOptionalInteger(input, "maxConcurrency"),
      }),
    ),
  "firecrawl:crawl-status": (input) =>
    firecrawlRequest(["getCrawlStatus"], requiredInputString(input, "jobId")),
  "firecrawl:cancel-crawl": (input) =>
    firecrawlRequest(["cancelCrawl"], requiredInputString(input, "jobId")),
  "firecrawl:map": (input) =>
    firecrawlRequest(
      ["map"],
      requiredInputString(input, "url"),
      definedFields({
        search: optionalInputString(input, "search"),
        sitemap: optionalInputString(input, "sitemap"),
        includeSubdomains: optionalInputBoolean(input, "includeSubdomains"),
        ignoreQueryParameters: optionalInputBoolean(
          input,
          "ignoreQueryParameters",
        ),
        limit: firecrawlOptionalInteger(input, "limit"),
        timeout: firecrawlOptionalInteger(input, "timeout", 1),
        location: firecrawlJsonObject(input, "location"),
      }),
    ),
  "firecrawl:extract": (input) =>
    firecrawlRequest(
      ["startExtract"],
      definedFields({
        urls: firecrawlStringArray(input, "urls"),
        prompt: optionalInputString(input, "prompt"),
        schema: firecrawlJsonObject(input, "schema"),
        enableWebSearch: optionalInputBoolean(input, "enableWebSearch"),
        ignoreSitemap: optionalInputBoolean(input, "ignoreSitemap"),
        includeSubdomains: optionalInputBoolean(input, "includeSubdomains"),
        showSources: optionalInputBoolean(input, "showSources"),
        ignoreInvalidURLs: optionalInputBoolean(input, "ignoreInvalidURLs"),
        scrapeOptions: firecrawlJsonObject(input, "scrapeOptions"),
      }),
    ),
  "firecrawl:extract-status": (input) =>
    firecrawlRequest(["getExtractStatus"], requiredInputString(input, "jobId")),
  "firecrawl:agent": (input) =>
    firecrawlRequest(
      ["startAgent"],
      definedFields({
        prompt: requiredInputString(input, "prompt"),
        urls: firecrawlStringArray(input, "urls"),
        schema: firecrawlJsonObject(input, "schema"),
        maxCredits: firecrawlOptionalInteger(input, "maxCredits"),
        strictConstrainToURLs: optionalInputBoolean(
          input,
          "strictConstrainToURLs",
        ),
      }),
    ),
  "firecrawl:parse-document": (input, maximumFileBytes) =>
    firecrawlRequest(
      ["parse"],
      firecrawlFile(input, maximumFileBytes),
      firecrawlScrapeOptions(input),
    ),
  "firecrawl:credit-usage": () => firecrawlRequest(["getCreditUsage"]),
};

function assertFirecrawlOperationCoverage(): void {
  const expected = new Set(FIRECRAWL_OPERATION_IDS);
  const implemented = Object.keys(FIRECRAWL_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Firecrawl provider SDK operation coverage is incomplete.");
  }
}

/** All pinned Firecrawl actions use Firecrawl's official TypeScript SDK. */
export function createFirecrawlProviderSdk(
  config: FirecrawlProviderSdkConfig,
): IntegrationProviderSdk {
  assertFirecrawlOperationCoverage();
  const maximumFileBytes = config.maxFileBytes ?? 25 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maximumFileBytes) ||
    maximumFileBytes < 1_024 ||
    maximumFileBytes > 100 * 1024 * 1024
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const clientFactory = config.clientFactory ?? createFirecrawlClient;
  return {
    integrationId: "firecrawl",
    operationIds: FIRECRAWL_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "firecrawl" ||
        invocation.reference.integrationId !== "firecrawl"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        FIRECRAWL_OPERATION_REQUESTS[invocation.operationId];
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
            requestFactory(invocation.input, maximumFileBytes),
          ),
        }),
      );
    },
  };
}

export function getFirecrawlProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertFirecrawlOperationCoverage();
  return {
    operations: FIRECRAWL_OPERATION_IDS.length,
    operationIds: FIRECRAWL_OPERATION_IDS,
  };
}
