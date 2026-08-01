/**
 * Input coercion, SDK dispatch, and output normalisation shared by provider
 * packs. These helpers were written inside the first provider that needed
 * them and kept that provider's name; the behaviour was always generic.
 */
import { z } from "zod";
import { INTEGRATION_CATALOGUE } from "../../catalog";
import { IntegrationIdSchema } from "../../contracts";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { ProviderSdkInvocation } from "../provider-sdk";

export const ProviderSdkInvocationSchema = z
  .object({
    integrationId: IntegrationIdSchema,
    operationId: z.string().min(3).max(160),
    reference: z
      .object({
        connectionId: z.string().min(1).max(160),
        integrationId: IntegrationIdSchema,
        product: z.enum(["eigenn", "conduitt"]),
      })
      .strict(),
    input: z.record(z.string().min(1).max(160), z.unknown()).default({}),
    idempotencyKey: z.string().min(1).max(255).optional(),
  })
  .strict();

export function requireStringValue(
  value: unknown,
  code: IntegrationProviderSdkError["code"],
): string {
  if (typeof value !== "string" || !value.trim() || value.length > 1_000) {
    throw new IntegrationProviderSdkError(code);
  }
  return value;
}

export function asInputRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return { ...(value as Record<string, unknown>) };
}

export function optionalStringValue(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim() || value.length > 1_000) {
    return undefined;
  }
  return value;
}

export function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/gu, (character) => `_${character.toLowerCase()}`);
}

export function requiredInputString(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): string {
  for (const name of names) {
    const value = input[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  throw new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

export function optionalInputString(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): string | undefined {
  for (const name of names) {
    const value = input[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function optionalInputNumber(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): number | undefined {
  for (const name of names) {
    const value = input[name];
    if (value === undefined || value === null || value === "") continue;
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return number;
  }
  return undefined;
}

export function optionalInputBoolean(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): boolean | undefined {
  for (const name of names) {
    const value = input[name];
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
  }
  return undefined;
}

export function optionalInputJson(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): unknown {
  for (const name of names) {
    const value = input[name];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
  }
  return undefined;
}

export function optionalInputCsv(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): string[] | undefined {
  for (const name of names) {
    const value = input[name];
    if (Array.isArray(value)) {
      const values = value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      );
      return values.length > 0
        ? values.map((entry) => entry.trim())
        : undefined;
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }
  return undefined;
}

export function definedFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

export interface SdkMethodRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

export function optionalInputRecord(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): Record<string, unknown> | undefined {
  const value = optionalInputJson(input, ...names);
  if (value === undefined) return undefined;
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value as Record<string, unknown>;
}

export function optionalInputStringArray(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): string[] | undefined {
  const value = names
    .map((name) => input[name])
    .find((candidate) => candidate !== undefined && candidate !== null);
  if (value === undefined) return undefined;
  if (typeof value === "string" && !value.trim().startsWith("[")) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  const parsed =
    typeof value === "string" ? optionalInputJson({ value }, "value") : value;
  if (
    !Array.isArray(parsed) ||
    parsed.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return parsed.map((entry) => entry.trim());
}

export function requiredInputStringArray(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): string[] {
  const value = optionalInputStringArray(input, ...names);
  if (!value?.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

export function requiredInputNumber(
  input: Readonly<Record<string, unknown>>,
  name: string,
): number {
  const value = optionalInputNumber(input, name);
  if (value === undefined) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

export function requiredInputValue(
  input: Readonly<Record<string, unknown>>,
  name: string,
): unknown {
  const value = input[name];
  if (value === undefined || value === null || value === "") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

/** A vendor SDK client reached by dotted method path. */
export type SdkMethodTarget = Record<string, unknown>;

export function invokeSdkMethod(
  client: SdkMethodTarget,
  request: SdkMethodRequest,
): Promise<unknown> {
  let target: unknown = client;
  for (const segment of request.path.slice(0, -1)) {
    if (!target || typeof target !== "object") {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
      );
    }
    target = (target as Record<string, unknown>)[segment];
  }
  const method =
    target && typeof target === "object"
      ? (target as Record<string, unknown>)[request.path.at(-1) ?? ""]
      : undefined;
  if (typeof method !== "function") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return method.apply(target, request.arguments) as Promise<unknown>;
}

export function normalizeSdkOutput(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSdkOutput(entry, seen));
  }
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        normalizeSdkOutput(entry, seen),
      ]),
    );
  }
  return value;
}

export function sdkResponseData(value: unknown): unknown {
  if (value && typeof value === "object" && "data" in value) {
    return (value as { data: unknown }).data;
  }
  return value;
}

export function catalogueOperationIds(
  integrationId: string,
): readonly string[] {
  return Object.freeze(
    INTEGRATION_CATALOGUE.find(
      (integration) => integration.id === integrationId,
    )?.operations.map((operation) => operation.id) ?? [],
  );
}

export function requiredInputRecord(
  input: Readonly<Record<string, unknown>>,
  ...names: readonly string[]
): Record<string, unknown> {
  const record = optionalInputRecord(input, ...names);
  if (!record) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return record;
}

export function checkedProviderInvocation(
  rawInput: ProviderSdkInvocation,
  integrationId: string,
): ProviderSdkInvocation {
  const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  if (
    parsed.data.integrationId !== integrationId ||
    parsed.data.reference.integrationId !== integrationId
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
    );
  }
  return parsed.data;
}
