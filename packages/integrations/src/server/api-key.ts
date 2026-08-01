import type { IntegrationId } from "../contracts";
import { getIntegration } from "../registry";
import {
  IntegrationApiKeyCredentialSchema,
  type IntegrationApiKeyCredential,
} from "./credentials";

export interface ApiKeyProviderConfiguration {
  integrationId: IntegrationId;
  /**
   * Omit both transport fields for SDK-only providers. Their key is still
   * encrypted and available to a package-owned vendor client, but callers
   * cannot make arbitrary HTTP requests through this generic transport.
   */
  apiBaseUrl?: string;
  /** The credential is supplied in this server-side HTTP header. */
  credentialHeader?: string;
  /** Optional static prefix, for example `Bearer`. */
  credentialPrefix?: string;
  /** Defaults to 15 seconds. It bounds provider response headers. */
  requestTimeoutMs?: number;
}

export interface ApiKeyProviderRequest {
  path: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
}

export interface ApiKeyProviderSdk {
  configuration: ApiKeyProviderConfiguration;
  request(
    credential: IntegrationApiKeyCredential,
    request: ApiKeyProviderRequest,
  ): Promise<Response>;
}

export class ApiKeyProviderError extends Error {
  readonly code:
    | "API_KEY_PROVIDER_CONFIGURATION_INVALID"
    | "API_KEY_PROVIDER_TRANSPORT_UNAVAILABLE"
    | "API_KEY_PROVIDER_INVALID_PATH"
    | "API_KEY_PROVIDER_REQUEST_FAILED";

  constructor(code: ApiKeyProviderError["code"]) {
    super("The provider request could not be completed.");
    this.name = "ApiKeyProviderError";
    this.code = code;
  }
}

const SAFE_HEADER_NAME = /^[A-Za-z0-9-]{1,64}$/u;
const UNSAFE_ENCODED_PATH_TOKENS = /%(?:2f|5c|3f|23)/iu;
const UNSAFE_CREDENTIAL_HEADERS = new Set([
  "connection",
  "content-length",
  "cookie",
  "host",
  "proxy-authorization",
  "set-cookie",
  "transfer-encoding",
]);

function validateSecureUrl(value: string): void {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("unsafe URL");
    }
  } catch {
    throw new ApiKeyProviderError("API_KEY_PROVIDER_CONFIGURATION_INVALID");
  }
}

function providerApiUrl(apiBaseUrl: string, path: string): URL {
  if (
    path.length > 2_000 ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("#") ||
    UNSAFE_ENCODED_PATH_TOKENS.test(path)
  ) {
    throw new ApiKeyProviderError("API_KEY_PROVIDER_INVALID_PATH");
  }
  try {
    const base = new URL(apiBaseUrl);
    const relative = new URL(path, "https://integration.invalid");
    const basePath = base.pathname.replace(/\/+$/u, "");
    const relativePath = relative.pathname.replace(/^\/+/, "");
    base.pathname = `${basePath}/${relativePath}`.replace(/\/+/gu, "/");
    base.search = relative.search;
    base.hash = "";
    return base;
  } catch (error) {
    if (error instanceof ApiKeyProviderError) {
      throw error;
    }
    throw new ApiKeyProviderError("API_KEY_PROVIDER_INVALID_PATH");
  }
}

async function withTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Provider request timed out."));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function credentialValue(
  credential: IntegrationApiKeyCredential,
  prefix: string | undefined,
): string {
  return prefix ? `${prefix} ${credential.apiKey}` : credential.apiKey;
}

/**
 * Shared API-key provider transport. A provider profile supplies only its
 * public API base URL and header convention; products never receive the raw
 * key after this server-side client has been created.
 */
export function createApiKeyProviderSdk(
  configuration: ApiKeyProviderConfiguration,
  fetcher: typeof fetch = fetch,
): ApiKeyProviderSdk {
  const requestTimeoutMs = configuration.requestTimeoutMs ?? 15_000;
  const hasTransport =
    configuration.apiBaseUrl !== undefined ||
    configuration.credentialHeader !== undefined;
  const headerName = configuration.credentialHeader?.toLocaleLowerCase("en-US");
  if (
    !Number.isSafeInteger(requestTimeoutMs) ||
    requestTimeoutMs < 100 ||
    requestTimeoutMs > 120_000 ||
    (hasTransport &&
      (!configuration.apiBaseUrl ||
        !configuration.credentialHeader ||
        !SAFE_HEADER_NAME.test(configuration.credentialHeader) ||
        !headerName ||
        UNSAFE_CREDENTIAL_HEADERS.has(headerName))) ||
    (configuration.credentialPrefix !== undefined &&
      (!configuration.credentialPrefix ||
        configuration.credentialPrefix.length > 160 ||
        /[\r\n]/u.test(configuration.credentialPrefix))) ||
    (configuration.credentialPrefix !== undefined && !hasTransport)
  ) {
    throw new ApiKeyProviderError("API_KEY_PROVIDER_CONFIGURATION_INVALID");
  }
  if (configuration.apiBaseUrl) {
    validateSecureUrl(configuration.apiBaseUrl);
  }
  if (
    !getIntegration(configuration.integrationId)?.products.some((product) =>
      product.authMethods.includes("api_key"),
    )
  ) {
    throw new ApiKeyProviderError("API_KEY_PROVIDER_CONFIGURATION_INVALID");
  }

  return {
    configuration,

    async request(rawCredential, request) {
      if (!configuration.apiBaseUrl || !configuration.credentialHeader) {
        throw new ApiKeyProviderError("API_KEY_PROVIDER_TRANSPORT_UNAVAILABLE");
      }
      const credential = IntegrationApiKeyCredentialSchema.parse(rawCredential);
      const url = providerApiUrl(configuration.apiBaseUrl, request.path);
      const headers = new Headers(request.headers);
      headers.set(
        configuration.credentialHeader,
        credentialValue(credential, configuration.credentialPrefix),
      );
      try {
        return await withTimeout(requestTimeoutMs, (signal) =>
          fetcher(url, {
            method: request.method ?? "GET",
            headers,
            body: request.body,
            signal,
          }),
        );
      } catch {
        throw new ApiKeyProviderError("API_KEY_PROVIDER_REQUEST_FAILED");
      }
    },
  };
}
