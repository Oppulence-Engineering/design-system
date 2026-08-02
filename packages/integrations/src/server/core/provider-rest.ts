import { z } from "zod";

import { getIntegration } from "../../registry";
import type { IntegrationApiKeyRuntime } from "../runtime/api-key";
import type { IntegrationCredentialReference } from "../transport/credentials";
import type { IntegrationNoAuthRuntime } from "../runtime/no-auth";
import {
  IntegrationProviderSdkError,
  type IntegrationProviderSdk,
  type ProviderSdkInvocation,
  type ProviderSdkResult,
} from "./provider-sdk";
import type { IntegrationOAuthRuntime } from "../runtime/oauth";

/** Matches SimStudio's HTTP method vocabulary. */
export type IntegrationTypedRestMethod =
  | "DELETE"
  | "GET"
  | "HEAD"
  | "PATCH"
  | "POST"
  | "PUT";

/** Matches SimStudio's parameter visibility vocabulary. */
export type IntegrationTypedRestParameterVisibility =
  | "hidden"
  | "llm-only"
  | "user-only"
  | "user-or-llm";

export interface IntegrationTypedRestParameterItemSchema {
  readonly type?: string;
  readonly description?: string;
  readonly const?: string | number | boolean;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly additionalProperties?: boolean;
  readonly required?: readonly string[];
  readonly properties?: Readonly<
    Record<string, IntegrationTypedRestParameterItemSchema>
  >;
  readonly anyOf?: readonly IntegrationTypedRestParameterItemSchema[];
}

/** Matches the core parameter metadata accepted by SimStudio ToolConfig. */
export interface IntegrationTypedRestParameterDefinition {
  readonly type: string;
  readonly required?: boolean;
  readonly visibility?: IntegrationTypedRestParameterVisibility;
  readonly default?: unknown;
  readonly description?: string;
  readonly items?: IntegrationTypedRestParameterItemSchema;
}

export type IntegrationTypedRestOutputType =
  | "array"
  | "boolean"
  | "file"
  | "file[]"
  | "json"
  | "number"
  | "object"
  | "string";

/** Matches the core output metadata accepted by SimStudio ToolConfig. */
export interface IntegrationTypedRestOutputDefinition {
  readonly type: IntegrationTypedRestOutputType;
  readonly description?: string;
  readonly optional?: boolean;
  readonly nullable?: boolean;
  readonly properties?: Readonly<
    Record<string, IntegrationTypedRestOutputDefinition>
  >;
  readonly items?: IntegrationTypedRestOutputDefinition;
}

/**
 * Package extension for an explicit raw body. Sim-compatible tools can use a
 * plain record, string, or FormData directly.
 */
export type IntegrationTypedRestBody =
  | { readonly kind: "json"; readonly value: unknown }
  | { readonly kind: "raw"; readonly value: BodyInit }
  | { readonly kind: "text"; readonly value: string };

/** Matches SimStudio's request.retry shape. */
export interface IntegrationTypedRestRetryConfig {
  readonly enabled: boolean;
  readonly maxRetries?: number;
  readonly initialDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly retryIdempotentOnly?: boolean;
}

/**
 * SimStudio-compatible declarative tool shape. `inputSchema`, `outputSchema`,
 * and `maxResponseBytes` are package safety extensions. Schemas are derived
 * from `params` and `outputs` when an author does not provide a stricter Zod
 * schema, so existing SimStudio-shaped tools need no translation layer.
 */
export interface IntegrationTypedRestTool<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly params: Readonly<
    Record<string, IntegrationTypedRestParameterDefinition>
  >;
  readonly outputs?: Readonly<
    Record<string, IntegrationTypedRestOutputDefinition>
  >;
  readonly oauth?: {
    readonly required: boolean;
    readonly provider: string;
    readonly requiredScopes?: readonly string[];
  };
  readonly request: {
    readonly url: string | ((params: TInput) => string);
    readonly method:
      | IntegrationTypedRestMethod
      | ((params: TInput) => IntegrationTypedRestMethod);
    readonly headers: (params: TInput) => HeadersInit;
    readonly body?: (
      params: TInput,
    ) =>
      | IntegrationTypedRestBody
      | FormData
      | Readonly<Record<string, unknown>>
      | string
      | undefined;
    readonly retry?: IntegrationTypedRestRetryConfig;
  };
  readonly transformResponse?: (
    response: Response,
    params?: TInput,
  ) => Promise<TOutput> | TOutput;
  /** Optional stricter validation than the schema derived from `params`. */
  readonly inputSchema?: z.ZodType<TInput>;
  /** Optional safe projection validation instead of the schema from `outputs`. */
  readonly outputSchema?: z.ZodType<TOutput>;
  /** Defaults to 256 KiB and is bounded to one MiB. */
  readonly maxResponseBytes?: number;
}

export type IntegrationTypedRestTransport =
  | {
      readonly kind: "api_key";
      readonly runtime: Pick<IntegrationApiKeyRuntime, "request">;
    }
  | {
      readonly kind: "none";
      readonly runtime: Pick<IntegrationNoAuthRuntime, "request">;
    }
  | {
      readonly kind: "oauth2";
      readonly runtime: Pick<IntegrationOAuthRuntime, "request">;
    };

export interface IntegrationTypedRestProviderConfig {
  readonly integrationId: string;
  readonly tools: readonly IntegrationTypedRestTool<any, any>[];
  readonly transport: IntegrationTypedRestTransport;
}

const MAX_RESPONSE_BYTES = 1_048_576;
const DEFAULT_RESPONSE_BYTES = 256 * 1024;
const MAX_RETRIES = 5;
const MAX_RETRY_DELAY_MS = 10_000;
const UNSAFE_HEADERS = new Set([
  "authorization",
  "connection",
  "content-length",
  "cookie",
  "host",
  "proxy-authorization",
  "set-cookie",
  "transfer-encoding",
]);
const UNSAFE_RESPONSE_HEADERS = new Set(["proxy-authenticate", "set-cookie"]);
const METHODS = new Set<IntegrationTypedRestMethod>([
  "DELETE",
  "GET",
  "HEAD",
  "PATCH",
  "POST",
  "PUT",
]);
const IDEMPOTENT_METHODS = new Set<IntegrationTypedRestMethod>([
  "DELETE",
  "GET",
  "HEAD",
  "PUT",
]);

interface ResolvedTypedRestTool {
  readonly inputSchema: z.ZodType<any>;
  readonly outputSchema: z.ZodType<any>;
  readonly tool: IntegrationTypedRestTool<any, any>;
}

function configurationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
  );
}

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

function requestError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_EXECUTION_REQUEST_FAILED",
  );
}

function responseError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_EXECUTION_RESPONSE_INVALID",
  );
}

function maximumResponseBytes(value: number | undefined): number {
  const maximum = value ?? DEFAULT_RESPONSE_BYTES;
  if (
    !Number.isSafeInteger(maximum) ||
    maximum < 1_024 ||
    maximum > MAX_RESPONSE_BYTES
  ) {
    throw configurationError();
  }
  return maximum;
}

function safeHeaders(input: HeadersInit): Headers {
  const headers = new Headers(input);
  for (const name of headers.keys()) {
    if (UNSAFE_HEADERS.has(name.toLocaleLowerCase("en-US"))) {
      throw configurationError();
    }
  }
  return headers;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function isTypedRestBody(value: unknown): value is IntegrationTypedRestBody {
  return (
    value !== null &&
    typeof value === "object" &&
    "kind" in value &&
    ((value as { kind?: unknown }).kind === "json" ||
      (value as { kind?: unknown }).kind === "raw" ||
      (value as { kind?: unknown }).kind === "text")
  );
}

function isPlainRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requestBody(
  configured:
    | IntegrationTypedRestBody
    | FormData
    | Readonly<Record<string, unknown>>
    | string
    | undefined,
  headers: Headers,
): BodyInit | undefined {
  if (configured === undefined) {
    return undefined;
  }
  if (typeof configured === "string") {
    if (!headers.has("content-type")) {
      headers.set("content-type", "text/plain;charset=UTF-8");
    }
    return configured;
  }
  if (isFormData(configured)) {
    return configured;
  }
  if (isTypedRestBody(configured)) {
    if (configured.kind === "json") {
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
      try {
        return JSON.stringify(configured.value);
      } catch {
        throw invocationError();
      }
    }
    if (configured.kind === "text") {
      if (!headers.has("content-type")) {
        headers.set("content-type", "text/plain;charset=UTF-8");
      }
      return configured.value;
    }
    return configured.value;
  }
  if (isPlainRecord(configured)) {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    try {
      return JSON.stringify(configured);
    } catch {
      throw invocationError();
    }
  }
  throw invocationError();
}

function ensureRelativeUrl(value: string): string {
  if (
    value.length > 2_000 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("#") ||
    /%(?:2f|5c|3f|23)/iu.test(value)
  ) {
    throw invocationError();
  }
  return value;
}

function resolveRequestValue<TInput, TValue>(
  configured: TValue | ((params: TInput) => TValue),
  input: TInput,
): TValue {
  return typeof configured === "function"
    ? (configured as (params: TInput) => TValue)(input)
    : configured;
}

function resolveMethod(
  configured:
    | IntegrationTypedRestMethod
    | ((params: Record<string, unknown>) => IntegrationTypedRestMethod),
  input: Record<string, unknown>,
): IntegrationTypedRestMethod {
  const method = resolveRequestValue(configured, input);
  if (!METHODS.has(method)) {
    throw invocationError();
  }
  return method;
}

function retryConfiguration(
  retry: IntegrationTypedRestRetryConfig | undefined,
): Required<IntegrationTypedRestRetryConfig> {
  const resolved = {
    enabled: retry?.enabled ?? false,
    maxRetries: retry?.maxRetries ?? 2,
    initialDelayMs: retry?.initialDelayMs ?? 250,
    maxDelayMs: retry?.maxDelayMs ?? 2_000,
    retryIdempotentOnly: retry?.retryIdempotentOnly ?? true,
  };
  if (
    typeof resolved.enabled !== "boolean" ||
    typeof resolved.retryIdempotentOnly !== "boolean" ||
    !Number.isSafeInteger(resolved.maxRetries) ||
    resolved.maxRetries < 0 ||
    resolved.maxRetries > MAX_RETRIES ||
    !Number.isSafeInteger(resolved.initialDelayMs) ||
    resolved.initialDelayMs < 0 ||
    resolved.initialDelayMs > MAX_RETRY_DELAY_MS ||
    !Number.isSafeInteger(resolved.maxDelayMs) ||
    resolved.maxDelayMs < resolved.initialDelayMs ||
    resolved.maxDelayMs > MAX_RETRY_DELAY_MS
  ) {
    throw configurationError();
  }
  return resolved;
}

async function pause(milliseconds: number): Promise<void> {
  if (milliseconds > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  }
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function schemaFromType(
  type: string,
  items?:
    | IntegrationTypedRestParameterItemSchema
    | IntegrationTypedRestOutputDefinition,
): z.ZodTypeAny {
  switch (type) {
    case "boolean":
      return z.boolean();
    case "number":
      return z.number();
    case "array":
    case "file[]":
      return z.array(
        items ? schemaFromType(items.type ?? "json", items) : z.unknown(),
      );
    case "object": {
      const properties = items?.properties;
      if (!properties) {
        return z.record(z.string(), z.unknown());
      }
      return z.object(
        Object.fromEntries(
          Object.entries(properties).map(([key, definition]) => [
            key,
            schemaFromType(definition.type ?? "json", definition),
          ]),
        ),
      );
    }
    case "string":
      return z.string();
    default:
      return z.unknown();
  }
}

function inputSchemaFrom(
  params: Readonly<Record<string, IntegrationTypedRestParameterDefinition>>,
): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [name, parameter] of Object.entries(params)) {
    let schema = schemaFromType(parameter.type, parameter.items);
    if (parameter.default !== undefined) {
      schema = schema.default(parameter.default);
    }
    shape[name] = parameter.required ? schema : schema.optional();
  }
  return z.object(shape).strict();
}

function outputSchemaFrom(
  outputs: Readonly<Record<string, IntegrationTypedRestOutputDefinition>>,
): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [name, output] of Object.entries(outputs)) {
    let schema = schemaFromType(output.type, output);
    if (output.nullable) {
      schema = schema.nullable();
    }
    shape[name] = output.optional ? schema.optional() : schema;
  }
  return z.object(shape);
}

async function readBoundedResponse(
  response: Response,
  maximumBytes: number,
): Promise<Response> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw responseError();
  }
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      length += value.byteLength;
      if (length > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw responseError();
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  for (const name of UNSAFE_RESPONSE_HEADERS) {
    headers.delete(name);
  }
  const statusWithoutBody = [204, 205, 304].includes(response.status);
  return new Response(statusWithoutBody ? null : bytes, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

async function request(
  transport: IntegrationTypedRestTransport,
  reference: IntegrationCredentialReference,
  input: {
    body: BodyInit | undefined;
    headers: Headers;
    method: IntegrationTypedRestMethod;
    path: string;
  },
): Promise<Response> {
  const providerRequest = {
    path: input.path,
    method: input.method,
    headers: input.headers,
    body: input.body,
  };
  try {
    if (transport.kind === "oauth2") {
      return await transport.runtime.request({
        reference,
        ...providerRequest,
      });
    }
    if (transport.kind === "api_key") {
      return await transport.runtime.request({
        reference,
        request: providerRequest,
      });
    }
    return await transport.runtime.request({
      integrationId: reference.integrationId,
      request: providerRequest,
    });
  } catch (error) {
    if (error instanceof IntegrationProviderSdkError) {
      throw error;
    }
    throw requestError();
  }
}

async function requestWithRetry(
  transport: IntegrationTypedRestTransport,
  reference: IntegrationCredentialReference,
  input: {
    body: BodyInit | undefined;
    headers: Headers;
    method: IntegrationTypedRestMethod;
    path: string;
  },
  retry: Required<IntegrationTypedRestRetryConfig>,
): Promise<Response> {
  const retries =
    retry.enabled &&
    (!retry.retryIdempotentOnly || IDEMPOTENT_METHODS.has(input.method))
      ? retry.maxRetries
      : 0;
  let attempt = 0;
  while (true) {
    try {
      const response = await request(transport, reference, input);
      if (!retryableStatus(response.status) || attempt >= retries) {
        return response;
      }
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
    }
    const delay = Math.min(
      retry.initialDelayMs * 2 ** attempt,
      retry.maxDelayMs,
    );
    attempt += 1;
    await pause(delay);
  }
}

function validMetadata(tool: IntegrationTypedRestTool<any, any>): boolean {
  if (
    !tool.id ||
    !tool.name ||
    !tool.description ||
    !tool.version ||
    !tool.params ||
    typeof tool.params !== "object" ||
    !tool.request ||
    typeof tool.request.headers !== "function" ||
    !(
      typeof tool.request.url === "string" ||
      typeof tool.request.url === "function"
    ) ||
    !(
      typeof tool.request.method === "string" ||
      typeof tool.request.method === "function"
    )
  ) {
    return false;
  }
  return Object.values(tool.params).every(
    (parameter) =>
      parameter &&
      typeof parameter.type === "string" &&
      (!parameter.visibility ||
        ["hidden", "llm-only", "user-only", "user-or-llm"].includes(
          parameter.visibility,
        )),
  );
}

/**
 * Creates a package-owned declarative REST adapter using the core SimStudio
 * ToolConfig authoring shape. The shared executor owns credential injection,
 * relative-provider URLs, retry discipline, bounded response reads, and the
 * schema-validated output projection. Use only after SDK-first evaluation
 * concludes no maintained SDK can safely cover the operation.
 */
export function createIntegrationTypedRestProvider(
  config: IntegrationTypedRestProviderConfig,
): IntegrationProviderSdk {
  const expectedAuthMethod =
    config.transport.kind === "api_key"
      ? "api_key"
      : config.transport.kind === "oauth2"
        ? "oauth2"
        : "none";
  if (
    !config.integrationId ||
    !config.tools.length ||
    !getIntegration(config.integrationId)?.products.some((product) =>
      product.authMethods.includes(expectedAuthMethod),
    )
  ) {
    throw configurationError();
  }
  const tools = new Map<string, ResolvedTypedRestTool>();
  for (const tool of config.tools) {
    if (
      !tool.id.startsWith(`${config.integrationId}:`) ||
      tools.has(tool.id) ||
      !validMetadata(tool) ||
      (tool.oauth?.required === true && config.transport.kind !== "oauth2") ||
      (tool.oauth &&
        (typeof tool.oauth.provider !== "string" ||
          !tool.oauth.provider ||
          (tool.oauth.requiredScopes !== undefined &&
            !tool.oauth.requiredScopes.every(
              (scope) => typeof scope === "string" && Boolean(scope),
            ))))
    ) {
      throw configurationError();
    }
    const inputSchema = tool.inputSchema ?? inputSchemaFrom(tool.params);
    const outputSchema =
      tool.outputSchema ??
      (tool.outputs ? outputSchemaFrom(tool.outputs) : undefined);
    if (!outputSchema) {
      throw configurationError();
    }
    maximumResponseBytes(tool.maxResponseBytes);
    retryConfiguration(tool.request.retry);
    if (typeof tool.request.url === "string") {
      try {
        ensureRelativeUrl(tool.request.url);
      } catch {
        throw configurationError();
      }
    }
    if (
      typeof tool.request.method === "string" &&
      !METHODS.has(tool.request.method)
    ) {
      throw configurationError();
    }
    tools.set(tool.id, { tool, inputSchema, outputSchema });
  }

  return {
    integrationId: config.integrationId,
    operationIds: [...tools.keys()],
    executionLane: "typed_rest",
    async execute(
      invocation: ProviderSdkInvocation,
    ): Promise<ProviderSdkResult> {
      if (
        invocation.integrationId !== config.integrationId ||
        invocation.reference.integrationId !== config.integrationId
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const resolvedTool = tools.get(invocation.operationId);
      if (!resolvedTool) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      const { tool } = resolvedTool;
      const parsedInput = resolvedTool.inputSchema.safeParse(invocation.input);
      if (!parsedInput.success) {
        throw invocationError();
      }
      let path: string;
      let method: IntegrationTypedRestMethod;
      let headers: Headers;
      let body: BodyInit | undefined;
      try {
        path = ensureRelativeUrl(
          resolveRequestValue(tool.request.url, parsedInput.data),
        );
        method = resolveMethod(tool.request.method, parsedInput.data);
        headers = safeHeaders(tool.request.headers(parsedInput.data));
        body = requestBody(tool.request.body?.(parsedInput.data), headers);
      } catch (error) {
        if (error instanceof IntegrationProviderSdkError) {
          throw error;
        }
        throw invocationError();
      }
      const upstream = await requestWithRetry(
        config.transport,
        invocation.reference,
        { path, method, headers, body },
        retryConfiguration(tool.request.retry),
      );
      const response = await readBoundedResponse(
        upstream,
        maximumResponseBytes(tool.maxResponseBytes),
      );
      let output: unknown;
      try {
        output = tool.transformResponse
          ? await tool.transformResponse(response, parsedInput.data)
          : await response.json();
      } catch {
        throw responseError();
      }
      const parsedOutput = resolvedTool.outputSchema.safeParse(output);
      if (!parsedOutput.success) {
        throw responseError();
      }
      return { operationId: invocation.operationId, output: parsedOutput.data };
    },
  };
}
